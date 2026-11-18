import { type Page, expect } from '@playwright/test';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { seedDirtyCoin } from 'ordpool-sdk/e2e';

import { test } from '../../fixtures/fixtures';
import {
  captureCat21Result,
  getCatIdAtOutput,
  getCatNumber,
  installRegtestRoutes,
  mine,
  mintCatViaRawTx,
  newCapture,
  newRegtestAddress,
  readReceiveAddress,
  stashCat21Request,
  switchToRegtestNetwork,
  waitElectrsSynced,
  waitOutpointClassifiedDirty,
  waitOutputIndexed,
} from './regtest-harness';

/**
 * CAT-21 DIRTY-COIN FUNDING for TRANSFER and the buyer OFFER (cat21_buy), on
 * regtest, in the wallet's own wiring. The four-state funding rule from HQ, for
 * the two cat actions beyond mint:
 *
 *   - AUTONOMOUS (audit step 1.5): the agent gets the same funding answer a
 *     person gets (an asset coin is `asset-notice`), and the `'refuse'` policy
 *     stops it before signing with the typed `asset-spend-not-permitted`, which
 *     names the coin. No owner opt-in for spending asset coins exists.
 *   - MANUAL (B6): the pre-approve notice names the asset on the coin and
 *     Approve stays live, because cat21-wallet keeps payments and ordinals on
 *     separate addresses.
 *
 * Every test uses a FRESH mnemonic whose only funding coin carries a named rare
 * sat. The shared test account accumulates clean coins from other specs, and a
 * clean coin would simply be picked, so the dirty coin would never be the
 * question. A rare sat (not an inscription) is seeded with a raw transaction
 * that does not touch the ord wallet other specs use, and it is not
 * cat-protected, so it reaches funding selection.
 *
 * Prereq: regtest stack with full ord and cat21-ord; the buy tests also need the
 * cat21-indexer backend (see cat21-buy-chain.spec.ts).
 */

// Covers a transfer fee, and a bid of BID_SATS + the 546-sat cat + fee.
const DIRTY_SATS = 30_000;
const BID_SATS = 8_000;

interface DirtyWallet {
  fundingAddress: string;
  ordinalsAddress: string;
  dirtyTxid: string;
  dirtyOutpoint: string;
}

/** A fresh wallet on regtest whose ONLY funding coin carries a named rare sat. */
async function freshWalletWithDirtyCoinOnly(
  page: Page,
  extensionId: string,
  signIn: (mnemonic: string) => Promise<void>
): Promise<DirtyWallet> {
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await signIn(generateMnemonic(wordlist));
  await switchToRegtestNetwork(page, extensionId);
  const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
  const ordinalsAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');
  const dirty = await seedDirtyCoin({
    asset: 'rareSat',
    address: fundingAddress,
    valueSats: DIRTY_SATS,
  });
  expect(dirty.assetId.length).toBeGreaterThan(0);
  mine(3);
  await waitElectrsSynced();
  await waitOutputIndexed(dirty.txid, dirty.vout);
  // The funding scan must see the rare sat before the popup reads it.
  await waitOutpointClassifiedDirty(dirty.outpoint);
  return { fundingAddress, ordinalsAddress, dirtyTxid: dirty.txid, dirtyOutpoint: dirty.outpoint };
}

/** Enable agent mode with the default permissive policy. */
async function enableAgentMode(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
  await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
  await page.getByTestId('cat21-agent-policy-save').click();
}

/** The denial an autonomous request must end in: refused, naming the dirty coin. */
function expectAssetSpendRefusal(
  result: { ok: boolean; value?: Record<string, unknown> },
  dirtyTxid: string
): void {
  expect(result.ok).toBe(false);
  expect(result.value?.reason).toBe('asset-spend-not-permitted');
  const facts = result.value?.assetSpendNotPermitted as
    | { coin?: { txid?: string; assets?: { rareSat?: unknown } } }
    | undefined;
  expect(facts?.coin?.txid).toBe(dirtyTxid);
  // The refusal NAMES the asset, the same fact the person's notice shows.
  expect(facts?.coin?.assets?.rareSat).toBeTruthy();
}

test.describe('CAT-21 dirty-coin funding for transfer and buy (regtest)', () => {
  test('AUTONOMOUS transfer: a rare-sat-only fee coin is refused asset-spend-not-permitted, nothing broadcast', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    const capture = newCapture();
    await installRegtestRoutes(context, capture);
    const wallet = await freshWalletWithDirtyCoinOnly(page, extensionId, m =>
      onboardingPage.signInExistingUser(m)
    );
    const catMintTxid = mintCatViaRawTx(wallet.ordinalsAddress);
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    await enableAgentMode(page, extensionId);

    const requestId = 'e2e-dirty-coin-autonomous-transfer';
    const answer = captureCat21Result(context, requestId);
    await stashCat21Request(page, requestId, {
      catId,
      recipient: newRegtestAddress('bech32m'),
      feeRate: 5,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-transfer-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    expectAssetSpendRefusal(await answer, wallet.dirtyTxid);
    // The refusal happened before signing, so nothing reached the network.
    expect(capture.txids).toEqual([]);
  });

  test('AUTONOMOUS buy: a rare-sat-only buyer coin is refused asset-spend-not-permitted, no bid', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    await installRegtestRoutes(context, newCapture());
    const wallet = await freshWalletWithDirtyCoinOnly(page, extensionId, m =>
      onboardingPage.signInExistingUser(m)
    );
    const catMintTxid = mintCatViaRawTx(newRegtestAddress('bech32m'));
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    const catNumber = await getCatNumber(catId);
    await enableAgentMode(page, extensionId);

    const requestId = 'e2e-dirty-coin-autonomous-buy';
    const answer = captureCat21Result(context, requestId);
    await stashCat21Request(page, requestId, {
      catId,
      catNumber,
      bidSats: BID_SATS,
      sellerPaymentAddress: newRegtestAddress('bech32'),
      feeRate: 5,
      mode: 'autonomous',
    });
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-buy-confirm?cat21RequestId=${requestId}`
    );
    await page.reload();

    // A refused bid is never signed, so it is never posted: the answer is a
    // denial, not a `{ kind: 'bid' }`.
    expectAssetSpendRefusal(await answer, wallet.dirtyTxid);
  });

  test('MANUAL transfer: the notice NAMES the rare sat on the fee coin, Approve live', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    await installRegtestRoutes(context, newCapture());
    const wallet = await freshWalletWithDirtyCoinOnly(page, extensionId, m =>
      onboardingPage.signInExistingUser(m)
    );
    const catMintTxid = mintCatViaRawTx(wallet.ordinalsAddress);
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);

    const requestId = 'e2e-dirty-coin-manual-transfer';
    // mode 'manual' + transport 'popup': the route renders the human dialog.
    await stashCat21Request(
      page,
      requestId,
      { catId, recipient: newRegtestAddress('bech32m'), feeRate: 5, mode: 'manual' },
      'popup'
    );
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-transfer-confirm?cat21RequestId=${requestId}`
    );

    const notice = page.getByTestId('cat21-funding-notice');
    await notice.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByTestId('cat21-funding-notice-asset').first()).toBeVisible();
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
  });

  test('MANUAL buy: the notice NAMES the rare sat on the buyer coin, Approve live', async ({
    context,
    page,
    extensionId,
    onboardingPage,
  }) => {
    await installRegtestRoutes(context, newCapture());
    await freshWalletWithDirtyCoinOnly(page, extensionId, m =>
      onboardingPage.signInExistingUser(m)
    );
    const catMintTxid = mintCatViaRawTx(newRegtestAddress('bech32m'));
    await waitElectrsSynced();
    const catId = await getCatIdAtOutput(catMintTxid, 0);
    const catNumber = await getCatNumber(catId);

    const requestId = 'e2e-dirty-coin-manual-buy';
    await stashCat21Request(
      page,
      requestId,
      {
        catId,
        catNumber,
        bidSats: BID_SATS,
        sellerPaymentAddress: newRegtestAddress('bech32'),
        feeRate: 5,
        mode: 'manual',
      },
      'popup'
    );
    await page.goto(
      `chrome-extension://${extensionId}/index.html#/cat21-buy-confirm?cat21RequestId=${requestId}`
    );

    const notice = page.getByTestId('cat21-funding-notice');
    await notice.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.getByTestId('cat21-funding-notice-asset').first()).toBeVisible();
    await expect(page.getByTestId('cat21-confirmation-approve')).toBeEnabled();
  });
});
