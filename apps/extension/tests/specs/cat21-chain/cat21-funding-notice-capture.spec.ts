import { expect } from '@playwright/test';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDirtyCoin } from 'ordpool-sdk/e2e';

import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getEsploraTx,
  installRegtestRoutes,
  mine,
  newCapture,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitOutpointClassifiedDirty,
  waitOutputIndexed,
} from './regtest-harness';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * FUNDING-SAFETY NOTICE — the three states a manual mint's funding preview can
 * reach, each captured at the real 390px popup width, against a live regtest
 * chain with controlled funding so each state is DETERMINISTIC (unlike the
 * routeless cat21-confirm-capture spec, which renders on an unfunded default
 * network where the preview would race).
 *
 * The preview is the SDK core's `simulateMint` — the SAME computation the manual
 * execute repeats — so what the dialog shows is what Approve does.
 *
 *   1. SAFE (`ready`)        — a clean coin covers the mint. NO notice; the
 *      dialog is byte-identical to the shipped safe screenshot, Approve live.
 *   2. NOTICE (`asset-notice`) — the ONLY covering coin carries an inscription.
 *      A separate-payment-address wallet (cat21-wallet) proceeds WITH a notice
 *      that NAMES the inscription; Approve stays live (the human decides).
 *   3. INSUFFICIENT (`insufficient`) — no spendable coin covers the mint. The
 *      notice explains why and Approve is DISABLED.
 *
 * There is NO one-address "block/warning" state to capture here: cat21-wallet
 * keeps its payment and ordinals addresses separate, so the SDK never returns
 * `expert-required` for the asset-only case — it returns `asset-notice`. That
 * one-address warning cannot arise in a separate-address wallet; the honest note
 * is that it is not manufacturable here.
 *
 * A FRESH random mnemonic per test is load-bearing (see the multiclass spec):
 * onboarding a pristine seed makes the funding pool exactly what the test seeds,
 * so the preview's outcome depends only on that.
 *
 * Prereqs: the regtest stack WITH the full ord (:8081) up (SDK bootstrap
 * `--with-ord-stock`), so `seedDirtyCoin` and the merged `classifyOutpoint`
 * resolve. Screenshots land in CAT21_UX_CAPTURE_DIR (or a repo-local report dir).
 */

const OUT_DIR =
  process.env.CAT21_UX_CAPTURE_DIR ?? path.join(here, '../../../playwright-report/ux-capture');

const CLEAN_FUNDING_BTC = 0.001; // 100_000 sats, well above a mint's need
const DIRTY_SATS = 10_000; // covers a mint; the sole coin in the notice case

/** Open the mint confirm dialog at the 390px popup width and wait for its body. */
async function openMintDialog(
  page: import('@playwright/test').Page,
  extensionId: string,
  recipient: string,
  requestId: string
): Promise<void> {
  // mode:'manual' so the route renders the human dialog and WAITS (autoconfirm
  // fires only for mcp-nmh + autonomous). transport 'popup' models Path 2.
  await stashCat21Request(page, requestId, { recipient, feeRate: 5, mode: 'manual' }, 'popup');
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto(
    `chrome-extension://${extensionId}/action-popup.html#/cat21-mint-confirm?cat21RequestId=${requestId}`
  );
  await page.getByTestId('cat21-confirmation-approve').waitFor({ state: 'visible' });
  await page.getByTestId('cat21-confirmation-rows').waitFor({ state: 'visible' });
}

test.describe('CAT-21 mint funding-safety notice (manual Path 2, regtest)', () => {
  test('SAFE: a clean coin funds the mint — no notice, Approve live', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const capture = newCapture();
    await installRegtestRoutes(context, capture);

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInExistingUser(generateMnemonic(wordlist));
    await switchToRegtestNetwork(page, extensionId);

    const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
    const recipient = await readReceiveAddress(page, extensionId, 'btc-taproot');

    const cleanTxid = fundAddress(fundingAddress, CLEAN_FUNDING_BTC);
    mine(3);
    await waitElectrsSynced();
    const cleanTx = await getEsploraTx(cleanTxid);
    const cleanVout = cleanTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
    expect(cleanVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(cleanTxid, cleanVout);

    await openMintDialog(page, extensionId, recipient, `safe-${Date.now()}`);

    // The CTA is HELD (disabled) while the preview is in flight and enables only
    // once it resolves to `ready`. So waiting for Approve to become enabled is a
    // positive proof the preview resolved to a safe funding — a dead/errored
    // preview would keep it disabled and fail here. THEN there is no notice, no
    // block, no checking line: the safe dialog is byte-identical to the shipped
    // screenshot.
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
    await expect(page.getByTestId('cat21-funding-notice')).toHaveCount(0);
    await expect(page.getByTestId('cat21-funding-notice-blocked')).toHaveCount(0);
    await expect(page.getByTestId('cat21-funding-notice-checking')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT_DIR, 'mint-safe-popup-390.png') });
  });

  test('NOTICE: the only covering coin carries an inscription — named, Approve live', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const capture = newCapture();
    await installRegtestRoutes(context, capture);

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInExistingUser(generateMnemonic(wordlist));
    await switchToRegtestNetwork(page, extensionId);

    const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
    const recipient = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // ONLY coin in the pool: an inscription-bearing coin that covers the mint.
    // An inscription (not a cat) is deliberate — a cat coin is filtered out of
    // the spendable bucket by the cat-protection guard and would never reach the
    // funding preview, giving `insufficient`. An inscription coin IS spendable
    // (cat21-wallet only cat-protects), so it reaches the preview and the merged
    // classify flags it — the asset-notice case this shot exists to show.
    const dirty = await seedDirtyCoin({
      asset: 'inscription',
      address: fundingAddress,
      valueSats: DIRTY_SATS,
    });
    expect(dirty.assetId.length).toBeGreaterThan(0);
    mine(3);
    await waitElectrsSynced();
    await waitOutputIndexed(dirty.txid, dirty.vout);
    // Wait until the guard's own merged classify SEES the asset, so the preview
    // reads a real dirty coin (asset-notice), not a not-yet-indexed one (which
    // fail-closes to a scan-failed block instead).
    await waitOutpointClassifiedDirty(dirty.outpoint);

    await openMintDialog(page, extensionId, recipient, `notice-${Date.now()}`);

    const notice = page.getByTestId('cat21-funding-notice');
    await notice.waitFor({ state: 'visible', timeout: 30_000 });
    // The inscription is NAMED (an asset row is present), not merely counted.
    await expect(page.getByTestId('cat21-funding-notice-asset').first()).toBeVisible();
    // A separate-payment-address wallet proceeds: Approve stays live.
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
    await page.screenshot({ path: path.join(OUT_DIR, 'mint-notice-popup-390.png') });
  });

  test('INSUFFICIENT: no spendable coin covers the mint — blocked, Approve disabled', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const capture = newCapture();
    await installRegtestRoutes(context, capture);

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInExistingUser(generateMnemonic(wordlist));
    await switchToRegtestNetwork(page, extensionId);

    // A fresh, UNFUNDED wallet: nothing covers the mint.
    const recipient = await readReceiveAddress(page, extensionId, 'btc-taproot');
    await waitElectrsSynced();

    await openMintDialog(page, extensionId, recipient, `insufficient-${Date.now()}`);

    const blocked = page.getByTestId('cat21-funding-notice-blocked');
    await blocked.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeDisabled();
    await page.screenshot({ path: path.join(OUT_DIR, 'mint-insufficient-popup-390.png') });
  });
});
