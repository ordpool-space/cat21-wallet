import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getCatIdAtOutput,
  getEsploraTx,
  installRegtestRoutes,
  mine,
  mintCatViaRawTx,
  newCapture,
  newRegtestAddress,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitForCatAtOutput,
  waitOutputIndexed,
} from './regtest-harness';

/**
 * CAT-21 PATH-3 AUTONOMOUS TRANSFER — real-button-FREE chain-truth proof.
 *
 * The click-driven transfer spec (cat21-transfer-chain) proves the transfer
 * WIRING; the autonomous-mint spec proves the silent-sign GATE. Neither proves
 * the COMBINATION: that an NMH agent, in autonomous mode within policy, actually
 * moves a cat with no human click. A wiring bug specific to the autonomous
 * transfer path (wrong intent narrowing, funding gate never opening, the cat
 * hint not resolving on a fresh NMH boot) would pass both existing specs and
 * still ship broken. This closes that.
 *
 * Setup: fund the wallet's native-segwit (pays the fee; the cat UTXO is
 * preserved), mint a cat the wallet owns (raw nLockTime=21 to its taproot
 * address), enable agent mode with the default permissive policy, then stash an
 * AUTONOMOUS transfer intent exactly as the native-messaging host does, open the
 * transfer-confirm route and RELOAD (fresh popup boot, cold React-Query cache).
 * NO click is issued. We prove:
 *
 *   1. SILENT   — a real broadcast happens with zero clicks on the approve
 *      button (the auto-confirm path drove it).
 *   2. CHAIN    — the transfer tx is on chain with locktime == 21 and output 0
 *      (the cat) paying the recipient.
 *   3. INDEXER  — cat21-ord re-homes the SAME cat id onto the transfer's output
 *      0, now owned by the recipient (ordinal theory: cat rides the first sat).
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts header (same stack/config).
 */
test.describe('CAT-21 autonomous transfer (Path 3 / NMH, regtest chain truth)', () => {
  test('silent-signs + broadcasts a real transfer with NO click (agent mode, within cap)', async ({
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
    const ordinalsAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');

    // Fund the fee source and mint a wallet-owned cat.
    const fundingTxid = fundAddress(fundingAddress, 0.001);
    const catMintTxid = mintCatViaRawTx(ordinalsAddress);
    await waitElectrsSynced();
    const fundingTx = await getEsploraTx(fundingTxid);
    const fundingVout = fundingTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
    expect(fundingVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(fundingTxid, fundingVout);
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    expect(catId).toMatch(/^[0-9a-f]{64}i\d+$/);

    // Recipient we control (not the wallet).
    const recipient = newRegtestAddress('bech32m');

    // Enable agent mode with the default permissive policy (the same gate the
    // autonomous-mint spec opens: enabled=true, per-action + fee caps generous
    // enough for a small transfer fee).
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
    await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
    await page.getByTestId('cat21-agent-policy-save').click();

    // Stash an AUTONOMOUS transfer intent as the NMH host does, open the confirm
    // route, then reload for a cold boot. From here NO click: the route resolves
    // the cat via the catId hint, waits for the funding gate, then silent-signs.
    const requestId = 'e2e-autonomous-transfer';
    await stashCat21Request(page, requestId, {
      catId,
      recipient,
      feeRate: 5,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-transfer-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // 1. SILENT: auto-confirm broadcasts with no click on the approve button.
    const errorLabel = page.getByTestId('cat21-confirmation-error');
    await expect
      .poll(
        async () => {
          if (capture.txids.length > 0) return true;
          if (await errorLabel.isVisible().catch(() => false)) {
            throw new Error(`autonomous transfer rejected: ${await errorLabel.textContent()}`);
          }
          return false;
        },
        { timeout: 90_000, intervals: [1500], message: 'autonomous transfer never broadcast' }
      )
      .toBe(true);
    const transferTxid = capture.txids[capture.txids.length - 1];

    // 2. CHAIN TRUTH.
    const transferTx = await getEsploraTx(transferTxid);
    expect(transferTx.locktime).toBe(21);
    expect(transferTx.vout[0]?.scriptpubkey_address).toBe(recipient);

    // 3. INDEXER TRUTH: the SAME cat now lives on the transfer output 0.
    mine(1);
    await waitElectrsSynced();
    const output = await waitForCatAtOutput(transferTxid, 0);
    expect(output.cats).toContain(catId);
    expect(output.address).toBe(recipient);
  });
});
