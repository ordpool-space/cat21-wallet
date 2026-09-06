import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getEsploraTx,
  installRegtestRoutes,
  mine,
  newCapture,
  readReceiveAddress,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitForCatAtOutput,
  waitOutputIndexed,
} from './regtest-harness';

/**
 * CAT-21 MINT — real-button chain-truth proof.
 *
 * Nothing below the button click is mocked. The wallet, switched to a live
 * regtest chain, derives its own bcrt addresses, is funded on-chain, then the
 * spec CLICKS the mint form's Review button and the confirmation dialog's
 * Approve button. The wallet builds the mint PSBT via ordpool-sdk, signs it
 * with its real keychain, and broadcasts it to electrs. We then prove:
 *
 *   1. CHAIN TRUTH   — electrs reports the broadcast tx with locktime == 21
 *                      (the CAT-21 protocol marker; HARD RULE #1).
 *   2. INDEXER TRUTH — cat21-ord, after the block confirms, reports a cat on
 *                      the mint's output 0 (the recipient the user typed).
 *
 * Prerequisites (bring the stack up first):
 *   cd ordpool-sdk/e2e && docker compose -f docker-compose.regtest.yml \
 *     --profile ord up -d --build
 *
 * Run (local; the pinned Chromium override avoids re-downloading a build):
 *   PW_CHROMIUM_EXE=~/Library/Caches/ms-playwright/chromium-1234/chrome-mac/Chromium.app/Contents/MacOS/Chromium \
 *     pnpm --filter @leather.io/extension exec playwright test \
 *       --config playwright.chain.config.ts cat21-mint-chain
 */
test.describe('CAT-21 mint (regtest chain truth)', () => {
  test('mints a real cat: locktime=21 on chain, cat indexed by cat21-ord', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    if (process.env.CHAIN_DEBUG) {
      page.on('console', m => console.error('[page]', m.type(), m.text()));
      page.on('requestfailed', r =>
        console.error('[reqfail]', r.method(), r.url(), r.failure()?.errorText)
      );
      context.on('request', r => {
        const u = r.url();
        if (/18443|ord\.cat21|localhost:(3000|8080)|leather|hiro|mempool/.test(u)) {
          console.error('[req]', r.method(), u);
        }
      });
    }

    const capture = newCapture();
    await installRegtestRoutes(context, capture);

    // 1. Land on an extension page so `chrome.*` is available to the
    //    sign-in helper's storage writes, then sign in and switch the
    //    wallet to the built-in regtest network.
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);
    await switchToRegtestNetwork(page, extensionId);

    // 2. Read the wallet's OWN regtest addresses (ground truth from its
    //    keychain): native-segwit for funding, taproot for the minted cat.
    const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
    const recipientAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');
    expect(fundingAddress.startsWith('bcrt1q')).toBeTruthy();
    expect(recipientAddress.startsWith('bcrt1p')).toBeTruthy();

    // 3. Fund the wallet on-chain, then wait until electrs + cat21-ord have
    //    indexed the funding output (the mint's content-scan reads cat21-ord
    //    for every candidate funding UTXO).
    const fundingTxid = fundAddress(fundingAddress, 0.001);
    await waitElectrsSynced();
    const fundingTx = await getEsploraTx(fundingTxid);
    const fundingVout = fundingTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
    expect(fundingVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(fundingTxid, fundingVout);

    // 4. Drive the mint form (real buttons).
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-mint`);
    await page.getByTestId('cat21-mint-form').waitFor({ state: 'visible' });
    await page.locator('input[name="recipient"]').fill(recipientAddress);
    await page.locator('input[name="feeRate"]').fill('5');
    await page.getByTestId('cat21-mint-form-submit').click();

    // 6. Approve on the Cat21 confirmation dialog → build + sign + broadcast.
    //    The confirm route fetches the account's UTXOs asynchronously, so the
    //    funding selection can lose a race with that fetch on the very first
    //    click (surfacing as the transient `funding-pick-failed`). We re-click
    //    while that is the only error — each render re-binds the approve
    //    handler to freshly-loaded UTXOs — until the wallet broadcasts. Any
    //    other error fails loudly. The service guards against double-submit,
    //    so repeated clicks are safe.
    const approve = page.getByTestId('cat21-confirmation-approve');
    const errorLabel = page.getByTestId('cat21-confirmation-error');
    await approve.waitFor({ state: 'visible' });
    await expect
      .poll(
        async () => {
          if (capture.txids.length > 0) return true;
          if (await errorLabel.isVisible()) {
            const detail = (await errorLabel.textContent()) ?? '';
            if (!/funding-pick-failed|Insufficient funds/.test(detail)) {
              throw new Error(`mint rejected: ${detail}`);
            }
          }
          if (await approve.isEnabled().catch(() => false)) {
            await approve.click().catch(() => undefined);
          }
          return false;
        },
        { timeout: 90_000, intervals: [1500], message: 'wallet never broadcast a mint tx' }
      )
      .toBe(true);

    const mintTxid = capture.txids[capture.txids.length - 1];

    // 7. CHAIN TRUTH: electrs confirms the marker.
    const mintTx = await getEsploraTx(mintTxid);
    expect(mintTx.locktime).toBe(21);
    // Output 0 is the cat, sent to the recipient the user typed.
    expect(mintTx.vout[0]?.scriptpubkey_address).toBe(recipientAddress);

    // 8. INDEXER TRUTH: mine the tx in, then cat21-ord recognizes the cat.
    mine(1);
    await waitElectrsSynced();
    const output = await waitForCatAtOutput(mintTxid, 0);
    expect(output.cats.length).toBeGreaterThan(0);
    expect(output.cats[0]).toMatch(/^[0-9a-f]{64}i\d+$/);
  });
});
