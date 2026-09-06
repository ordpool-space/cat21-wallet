import { expect } from '@playwright/test';

import { test } from '../../fixtures/fixtures';
import {
  approveUntilBroadcast,
  fundAddress,
  getCatIdAtOutput,
  getEsploraTx,
  installRegtestRoutes,
  mine,
  mintCatViaRawTx,
  newCapture,
  newRegtestAddress,
  readReceiveAddress,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitForCatAtOutput,
  waitOutputIndexed,
} from './regtest-harness';

/**
 * CAT-21 TRANSFER — real-button chain-truth proof.
 *
 * Setup mints a cat the wallet owns via a real nLockTime=21 tx to its taproot
 * address (as an external minter / ord would). Then the spec CLICKS the
 * transfer form (catId + recipient + fee) and the confirmation's Approve
 * button. The wallet builds the transfer PSBT via ordpool-sdk, signs the cat
 * input + funding inputs with its keychain, and broadcasts. We prove:
 *
 *   1. CHAIN TRUTH   — electrs reports the transfer tx with locktime == 21 and
 *                      the cat output (0) paying the recipient the user typed.
 *   2. INDEXER TRUTH — cat21-ord re-homes the SAME cat id onto the transfer's
 *                      output 0, now owned by the recipient (ordinal theory:
 *                      the cat rode the first sat, fee paid from funding).
 *
 * Prerequisites + run: see cat21-mint-chain.spec.ts header (same stack/config).
 */
test.describe('CAT-21 transfer (regtest chain truth)', () => {
  test('transfers a real cat: locktime=21 on chain, cat moves to recipient', async ({
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
    expect(fundingAddress.startsWith('bcrt1q')).toBeTruthy();
    expect(ordinalsAddress.startsWith('bcrt1p')).toBeTruthy();

    // Fund the native-segwit address (pays the transfer fee — the cat UTXO is
    // preserved, never spent for fees).
    const fundingTxid = fundAddress(fundingAddress, 0.001);
    // Mint a cat OWNED by the wallet: a real nLockTime=21 tx to its taproot addr.
    const catMintTxid = mintCatViaRawTx(ordinalsAddress);

    await waitElectrsSynced();
    const fundingTx = await getEsploraTx(fundingTxid);
    const fundingVout = fundingTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
    expect(fundingVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(fundingTxid, fundingVout);
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    expect(catId).toMatch(/^[0-9a-f]{64}i\d+$/);

    // Recipient: a fresh regtest address we control (not the wallet's).
    const recipient = newRegtestAddress('bech32m');

    // Drive the transfer form (real buttons).
    await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-transfer`);
    await page.getByTestId('cat21-transfer-form').waitFor({ state: 'visible' });
    await page.locator('input[name="catId"]').fill(catId);
    await page.locator('input[name="recipient"]').fill(recipient);
    await page.locator('input[name="feeRate"]').fill('5');
    await page.getByTestId('cat21-transfer-form-submit').click();

    // Approve → build + sign + broadcast (retry over the async UTXO fetch).
    const transferTxid = await approveUntilBroadcast(page, capture);

    // 1. CHAIN TRUTH: electrs confirms marker + cat output pays the recipient.
    const transferTx = await getEsploraTx(transferTxid);
    expect(transferTx.locktime).toBe(21);
    expect(transferTx.vout[0]?.scriptpubkey_address).toBe(recipient);

    // 2. INDEXER TRUTH: the SAME cat now lives on the transfer's output 0,
    //    owned by the recipient.
    mine(1);
    await waitElectrsSynced();
    const output = await waitForCatAtOutput(transferTxid, 0);
    expect(output.cats).toContain(catId);
    expect(output.address).toBe(recipient);
  });
});
