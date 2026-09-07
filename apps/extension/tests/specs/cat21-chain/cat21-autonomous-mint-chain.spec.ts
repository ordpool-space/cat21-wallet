import { expect } from '@playwright/test';

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
  waitForCatAtOutput,
  waitOutputIndexed,
} from './regtest-harness';

/**
 * CAT-21 PATH-3 AUTONOMOUS MINT — real-button-FREE chain-truth proof.
 *
 * This is the silent-sign complement to the four click-driven flows, and the
 * end-to-end proof for the Gap-1 fix: the Path-3 (NMH) autoconfirm must silent-
 * sign a legitimately-unlockable wallet on a fresh popup boot rather than
 * false-deny it while the in-memory key is still deriving.
 *
 * With agent mode enabled and a WITHIN-cap intent, the spec stashes an
 * autonomous mint request exactly as the native-messaging host does, opens the
 * confirm route with `?cat21RequestId=`, and issues NO click. The wallet
 * auto-confirms, silent-signs with its keychain, and broadcasts a real cat. We
 * prove:
 *
 *   1. SILENT   — a real broadcast happens with zero clicks on the approve
 *                 button (the auto-confirm path drove it).
 *   2. CHAIN    — electrs reports the tx with locktime == 21, output 0 paying
 *                 the recipient.
 *   3. INDEXER  — cat21-ord recognizes the cat.
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts (same stack/config).
 */
test.describe('CAT-21 autonomous mint (Path 3 / NMH, regtest chain truth)', () => {
  test('silent-signs + broadcasts a real cat with NO click (agent mode, within cap)', async ({
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

    // Fund + wait for the funding output to be indexed (mint content-scan).
    const fundingTxid = fundAddress(fundingAddress, 0.001);
    await waitElectrsSynced();
    const fundingTx = await getEsploraTx(fundingTxid);
    const fundingVout = fundingTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
    expect(fundingVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(fundingTxid, fundingVout);

    // Enable agent mode with the default permissive policy (enabled=true;
    // per-action cap 10000 > the 546-sat mint; fee cap 50 > 5). Just save the
    // defaults — this is what makes the autonomous silent-sign gate open.
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-agent-policy-save').click();

    // Stash an AUTONOMOUS mint intent exactly as the NMH host does, open the
    // Path-3 confirm route, then RELOAD so the popup boots with a fresh
    // React-Query cache — exactly as a real NMH-opened popup does (no
    // pre-warmed UTXO set). From here the spec issues NO click: the autoconfirm
    // waits for the in-memory key to re-derive (unlock gate) AND for the
    // native-segwit UTXO query's first success (funding gate), then silent-signs
    // a real cat. No warm step: the funding gate in the route is what makes the
    // single-shot autoconfirm robust, so the test proves that gate rather than
    // papering over the race with a warm.
    const requestId = 'e2e-autonomous-mint-broadcast';
    await stashCat21Request(page, requestId, {
      recipient: recipientAddress,
      feeRate: 5,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-mint-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // 1. SILENT: the route auto-confirms (transport mcp-nmh + mode autonomous +
    //    wallet unlocked after async key derivation — the Gap-1 fix path) and
    //    broadcasts, with no click on cat21-confirmation-approve.
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
        { timeout: 60_000, intervals: [1000], message: 'autonomous mint never broadcast' }
      )
      .toBe(true);
    const mintTxid = capture.txids[capture.txids.length - 1];

    // 2. CHAIN TRUTH.
    const mintTx = await getEsploraTx(mintTxid);
    expect(mintTx.locktime).toBe(21);
    expect(mintTx.vout[0]?.scriptpubkey_address).toBe(recipientAddress);

    // 3. INDEXER TRUTH.
    mine(1);
    await waitElectrsSynced();
    const output = await waitForCatAtOutput(mintTxid, 0);
    expect(output.cats.length).toBeGreaterThan(0);
    expect(output.cats[0]).toMatch(/^[0-9a-f]{64}i\d+$/);
  });
});
