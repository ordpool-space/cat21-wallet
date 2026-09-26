import { type Page, expect } from '@playwright/test';
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
  waitOutpointClassifiedClean,
  waitOutpointClassifiedDirty,
  waitOutputIndexed,
} from './regtest-harness';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Captures the manual mint funding preview's three states at 390px against real
 * regtest data (production `useCat21FundingPreview` -> `simulateMint`):
 *   1. SAFE (`ready`): clean coin, no notice, Approve live.
 *   2. NOTICE (`asset-notice`): sole covering coin is a RARE SAT, named, Approve
 *      live. Rare sat (not inscription): its seed builds a raw tx that does not
 *      collide with the multiclass spec's ord wallet, and it is not cat-protected
 *      so it reaches the preview. A one-address block cannot arise on this
 *      separate-address wallet.
 *   3. INSUFFICIENT: no covering coin, add-funds notice, Approve live.
 *
 * Fresh mnemonic per test. Prereq: regtest stack with full ord (:8081),
 * `--with-ord-stock`.
 */

const OUT_DIR =
  process.env.CAT21_UX_CAPTURE_DIR ?? path.join(here, '../../../playwright-report/ux-capture');

const CLEAN_FUNDING_BTC = 0.001; // 100_000 sats, well above a mint's need
const DIRTY_SATS = 10_000; // covers a mint; the sole coin in the notice case

/** Stash a manual mint intent and open its dialog at the 390px popup width. */
async function openMintDialog(page: Page, extensionId: string, recipient: string): Promise<void> {
  const requestId = `funding-capture-${Date.now()}`;
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
    await installRegtestRoutes(context, newCapture());

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
    // The preview reads `ready` only once ord has indexed the coin as clean;
    // wait for that so the popup does not race an unindexed read into a block.
    await waitOutpointClassifiedClean(`${cleanTxid}:${cleanVout}`);

    await openMintDialog(page, extensionId, recipient);

    // The CTA is HELD while the scan is in flight and enables only once the
    // preview resolves to `ready` — so waiting for it to enable is a positive
    // proof of a resolved safe funding (a dead/errored preview keeps it held).
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
    await expect(page.getByTestId('cat21-funding-notice')).toHaveCount(0);
    await expect(page.getByTestId('cat21-funding-notice-insufficient')).toHaveCount(0);
    await expect(page.getByTestId('cat21-funding-notice-unavailable')).toHaveCount(0);
    await expect(page.getByTestId('cat21-funding-notice-checking')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT_DIR, 'mint-safe-popup-390.png') });
  });

  test('NOTICE: the only covering coin carries a rare sat — named, Approve live', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await installRegtestRoutes(context, newCapture());

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInExistingUser(generateMnemonic(wordlist));
    await switchToRegtestNetwork(page, extensionId);

    const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
    const recipient = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // ONLY coin in the pool: a rare-sat coin that covers the mint. rareSat (not
    // inscription) avoids the multiclass spec's ord-wallet collision and is not
    // cat-protected, so it reaches the preview and the four-class scan flags it.
    const dirty = await seedDirtyCoin({
      asset: 'rareSat',
      address: fundingAddress,
      valueSats: DIRTY_SATS,
    });
    expect(dirty.assetId.length).toBeGreaterThan(0);
    mine(3);
    await waitElectrsSynced();
    await waitOutputIndexed(dirty.txid, dirty.vout);
    await waitOutpointClassifiedDirty(dirty.outpoint);

    await openMintDialog(page, extensionId, recipient);

    const notice = page.getByTestId('cat21-funding-notice');
    await notice.waitFor({ state: 'visible', timeout: 30_000 });
    // The rare sat is NAMED (an asset row is present), not merely counted.
    await expect(page.getByTestId('cat21-funding-notice-asset').first()).toBeVisible();
    // A separate-payment-address wallet proceeds: Approve stays live.
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
    await page.screenshot({ path: path.join(OUT_DIR, 'mint-notice-popup-390.png') });
  });

  test('INSUFFICIENT: no covering coin — add-funds notice, Approve live', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await installRegtestRoutes(context, newCapture());

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInExistingUser(generateMnemonic(wordlist));
    await switchToRegtestNetwork(page, extensionId);

    // A fresh, UNFUNDED wallet: nothing covers the mint.
    const recipient = await readReceiveAddress(page, extensionId, 'btc-taproot');
    await waitElectrsSynced();

    await openMintDialog(page, extensionId, recipient);

    const notice = page.getByTestId('cat21-funding-notice-insufficient');
    await notice.waitFor({ state: 'visible', timeout: 30_000 });
    // No covering coin to lose, so a click is safe (the service blocks it, and a
    // cap violation would surface first): Approve stays live.
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
    await page.screenshot({ path: path.join(OUT_DIR, 'mint-insufficient-popup-390.png') });
  });
});
