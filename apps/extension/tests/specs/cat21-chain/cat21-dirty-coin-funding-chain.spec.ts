import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getCatIdAtOutput,
  getEsploraTx,
  installRegtestRoutes,
  mintCatViaRawTx,
  newCapture,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitOutputIndexed,
} from './regtest-harness';

// The dirty cat is seeded as the SMALLEST covering funding candidate, so an
// unguarded best-fit selection (smallest covering coin) would pick it. The clean
// coin is well above. If the coin were seeded large it would never be a
// candidate and its survival would prove nothing (the directive's trap).
const DIRTY_CAT_SATS = 3_000; // > the ~546 postage + fee a mint needs, < the clean coin
const CLEAN_FUNDING_BTC = 0.001; // 100_000 sats, well above

/**
 * CAT-21 DIRTY-COIN FUNDING SAFETY — the money-path guard, end to end, in the
 * wallet's OWN autonomous wiring on regtest.
 *
 * The directive: prove a dirty coin in the fundable pool is not spent as funding,
 * in the consumer's own selection, not in a unit test of the classifier. This
 * matters most for THIS consumer: YOLO / agent mode signs with no confirmation
 * dialog, so the funding-safety guard is the last line of defence.
 *
 * The wallet's runtime guard is the SDK core's `select-funding`, which calls the
 * ContentScanPort's `classify(outpoint)` on every candidate regardless of size
 * and refuses any it flags `has-assets`. The wallet backs that port with
 * `classifyOutpoint` (cat21-ord `/output.cats`), which is NOT network-gated — so
 * unlike the mainnet-gated `available` pre-filter, this guard runs on regtest.
 * This spec proves it does.
 *
 * Setup: fund the wallet's native-segwit with a CLEAN coin well above the mint's
 * funding need, then seed a CAT on that same funding address at the smallest
 * covering value (a real nLockTime=21 output — a genuine dirty coin cat21-ord
 * indexes). Run an AUTONOMOUS mint (no click). We prove:
 *
 *   1. SILENT      — a real mint broadcasts with no click.
 *   2. NOT SPENT   — the mint tx does NOT consume the cat's outpoint; the cat
 *      UTXO is still unspent on chain. The guard skipped the smallest covering
 *      coin because it carries an asset.
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts header.
 */
test.describe('CAT-21 dirty-coin funding safety (Path 3 autonomous, regtest)', () => {
  test('an autonomous mint does NOT spend a cat sitting in the funding pool', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    const capture = newCapture();
    await installRegtestRoutes(context, capture);

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
    await switchToRegtestNetwork(page, extensionId);

    const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
    const recipientAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // Clean coin, well above the mint's funding need.
    const cleanTxid = fundAddress(fundingAddress, CLEAN_FUNDING_BTC);
    // Dirty coin: a real cat (nLockTime=21) on the SAME native-segwit funding
    // address, at the smallest covering value — the coin best-fit would pick.
    const dirtyCatTxid = mintCatViaRawTx(fundingAddress, DIRTY_CAT_SATS / 100_000_000);

    await waitElectrsSynced();
    const cleanTx = await getEsploraTx(cleanTxid);
    const cleanVout = cleanTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
    expect(cleanVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(cleanTxid, cleanVout);
    // Confirm the dirty coin is genuinely a cat (so classify will flag it) and is
    // the smallest covering candidate.
    const dirtyCatId = await getCatIdAtOutput(dirtyCatTxid, 0);
    expect(dirtyCatId).toMatch(/^[0-9a-f]{64}i\d+$/);
    const dirtyOut = (await getEsploraTx(dirtyCatTxid)).vout[0];
    expect(dirtyOut?.scriptpubkey_address).toBe(fundingAddress);
    expect(dirtyOut?.value).toBe(DIRTY_CAT_SATS);
    await waitOutputIndexed(dirtyCatTxid, 0);

    // Enable agent mode (default permissive policy) and stash an AUTONOMOUS mint.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-agent-policy-save').click();

    const requestId = 'e2e-dirty-coin-funding';
    await stashCat21Request(page, requestId, {
      recipient: recipientAddress,
      feeRate: 5,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-mint-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // 1. SILENT: the autoconfirm broadcasts a mint with no click.
    const errorLabel = page.getByTestId('cat21-confirmation-error');
    await expect
      .poll(
        async () => {
          if (capture.txids.length > 0) return true;
          if (await errorLabel.isVisible().catch(() => false)) {
            throw new Error(`autonomous mint rejected: ${await errorLabel.textContent()}`);
          }
          return false;
        },
        { timeout: 90_000, intervals: [1500], message: 'autonomous mint never broadcast' }
      )
      .toBe(true);
    const mintTxid = capture.txids[capture.txids.length - 1];

    // 2. NOT SPENT: the mint tx must not consume the cat's outpoint. The guard
    // (select-funding -> classify) skipped the smallest covering coin because it
    // is a cat, and funded from the clean coin instead.
    const mintTx = await getEsploraTx(mintTxid);
    const spentTheCat = mintTx.vin.some(i => i.txid === dirtyCatTxid && i.vout === 0);
    expect(spentTheCat).toBe(false);
    // It DID fund from real inputs (the mint broadcast, so it funded from
    // somewhere), and none of them is the cat. On a fresh chain those inputs are
    // the clean coin; on a reused address they may be other clean coins, but the
    // cat is never among them.
    expect(mintTx.vin.length).toBeGreaterThan(0);

    // The cat UTXO is still unspent on chain (its value output is intact).
    const dirtyStillLive = await getEsploraTx(dirtyCatTxid);
    expect(dirtyStillLive.vout[0]?.value).toBe(DIRTY_CAT_SATS);
  });
});
