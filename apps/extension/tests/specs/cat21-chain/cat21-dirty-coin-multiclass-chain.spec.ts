import { expect } from '@playwright/test';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { type DirtyCoinAsset, seedDirtyCoin } from 'ordpool-sdk/e2e';

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

// The two coins are the ENTIRE funding pool of a freshly-onboarded wallet (see
// the fresh-mnemonic note below), so selection is deterministic: both cover a
// mint, the dirty coin is smaller, so best-fit (smallest covering) takes the
// dirty coin when the guard is off and the clean coin when it is on. That gap is
// what makes the spec falsifiable — the mutation check below flips exactly it.
//
// seedDirtyCoin's three documented traps, and why this avoids them:
//   1. every coin clean -> guard never engaged: the dirty coin is real+indexed.
//   2. dirty too large to be a best-fit candidate: dirty (10 000) < clean.
//   3. dirty is the ONLY coin -> proves FLAGS not AVOIDS: a clean coin is present
//      and is where a correct guard steers.
const DIRTY_SATS = 10_000; // covers a mint, below the clean coin
const CLEAN_FUNDING_BTC = 0.001; // 100_000 sats, well above

// All four asset classes the wallet guards. Cats come from cat21-ord
// (--index-cat21); inscriptions + runes + rare sats come from the full ord
// (ord.ordpool.space, --index-runes --index-sats), the two `/output` sources the
// SDK's `classifyOutpoint` merges.
const ASSET_CLASSES: DirtyCoinAsset[] = ['inscription', 'cat', 'rune', 'rareSat'];

/**
 * CAT-21 FOUR-CLASS DIRTY-COIN FUNDING SAFETY — end to end, in the wallet's OWN
 * autonomous wiring on regtest.
 *
 * The maintainer's decision: the wallet warns on ALL asset classes, not cats
 * only. So the funding-safety guard must refuse a funding coin carrying an
 * inscription, a cat, a rune, or a rare sat. This matters most for THIS
 * consumer: YOLO / agent mode signs with no confirmation dialog, so the guard is
 * the last line of defence against silently spending an asset as fee funding.
 *
 * The wallet's runtime guard is the SDK core's `select-funding`, which calls the
 * ContentScanPort's `classify(outpoint)` on every candidate regardless of size
 * and refuses any it flags `has-assets`. The wallet backs that port with the
 * SDK's `classifyOutpoint`, which merges the full ord (inscriptions + runes +
 * rare sats) and cat21-ord (cats). A non-2xx from either REJECTS, so an
 * unclassifiable coin is dropped from the auto-fundable pool (fail-closed).
 * Unlike the mainnet-gated `available` pre-filter, this guard runs on regtest.
 *
 * A FRESH random mnemonic per test is load-bearing, not hygiene. The wallet's
 * funding scan reads its native-segwit index-0 address; a fixed test seed shares
 * that address across every run, so residual clean UTXOs from earlier runs
 * accumulate there and a smaller covering one gets picked ahead of the dirty
 * coin — the mint then avoids the dirty coin whether the guard is on or off, and
 * the spec passes with the guard deleted. Onboarding a fresh seed makes the pool
 * exactly {clean, dirty}, so the outcome depends on the guard alone.
 *
 * Per class we prove:
 *   1. SILENT    — a real mint broadcasts with no click.
 *   2. NOT SPENT — the mint tx does NOT consume the asset coin's outpoint; the
 *      coin is still unspent on chain. The guard skipped the smaller covering
 *      coin because it carries an asset, and funded from the clean coin.
 *
 * MUTATION CHECK (run once by hand, per the "a test that cannot fail is not
 * evidence" HARD RULE): in use-cat21-rpc-deps.ts make `classifyOutpoint` return
 * 'clean' unconditionally. Each class then goes RED — the mint spends the
 * smaller covering coin, which is the asset coin. Restore and each goes GREEN.
 *
 * Prereqs: the regtest stack WITH the full ord (:8081) up (SDK bootstrap
 * `--with-ord-stock`). The SDK seed helpers reach the stack via docker exec and
 * read REGTEST_* (bitcoind container, wallet, ord containers); point them at the
 * running stack (local: cubes-e2e-* ; CI: ordpool-e2e-consumer-*).
 */
test.describe('CAT-21 four-class dirty-coin funding safety (Path 3 autonomous, regtest)', () => {
  for (const asset of ASSET_CLASSES) {
    test(`an autonomous mint does NOT spend a ${asset} coin in the funding pool`, async ({
      context,
      page,
      extensionId,
      onboardingPage,
    }) => {
      const capture = newCapture();
      await installRegtestRoutes(context, capture);

      // Fresh, never-before-seen wallet -> pristine funding address (see header).
      await page.goto(`chrome-extension://${extensionId}/index.html`);
      await onboardingPage.signInExistingUser(generateMnemonic(wordlist));
      await switchToRegtestNetwork(page, extensionId);

      const fundingAddress = await readReceiveAddress(page, extensionId, 'btc');
      const recipientAddress = await readReceiveAddress(page, extensionId, 'btc-taproot');

      // Clean coin, well above the mint's funding need.
      const cleanTxid = fundAddress(fundingAddress, CLEAN_FUNDING_BTC);
      // Dirty coin: a real, indexed asset on the SAME native-segwit funding
      // address, below the clean coin — the coin best-fit would pick.
      const dirty = await seedDirtyCoin({
        asset,
        address: fundingAddress,
        valueSats: DIRTY_SATS,
      });
      expect(dirty.outpoint).toMatch(/^[0-9a-f]{64}:\d+$/);
      // The seed genuinely put a real asset on the coin (guards against a vacuous
      // pass where the seed silently produced a clean coin).
      expect(dirty.assetId.length).toBeGreaterThan(0);
      expect(dirty.value).toBe(DIRTY_SATS);

      // Bury both coins under extra confirmations. A freshly-seeded coin sits in
      // the block ord is still settling at the tip, and its `/output` can read
      // asset-present one moment and empty the next during that settle. Moving
      // the tip away finalises the coin's block, so the guard's mint-time read is
      // stable (with the classify precondition below as the belt-and-braces).
      mine(3);

      await waitElectrsSynced();
      const cleanTx = await getEsploraTx(cleanTxid);
      const cleanVout = cleanTx.vout.findIndex(o => o.scriptpubkey_address === fundingAddress);
      expect(cleanVout).toBeGreaterThanOrEqual(0);
      await waitOutputIndexed(cleanTxid, cleanVout);
      await waitOutputIndexed(dirty.txid, dirty.vout);
      // Precondition: the guard's own merged classify sees the asset before the
      // mint runs, so a slow ord-stock read can't let a genuinely dirty coin
      // slip through as clean (a wait on state, not a fixed sleep).
      await waitOutpointClassifiedDirty(dirty.outpoint);

      // Enable agent mode (default permissive policy) and stash an AUTONOMOUS mint.
      await page.goto(`chrome-extension://${extensionId}/index.html#/cat21-agent-policy`);
      await page.getByTestId('cat21-agent-policy-form').waitFor({ state: 'visible' });
      await page.getByTestId('cat21-agent-policy-save').click();

      const requestId = `e2e-dirty-${asset}`;
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

      // 2. NOT SPENT: the mint tx must not consume the asset coin's outpoint. The
      // guard (select-funding -> classify) skipped the smaller covering coin
      // because it carries an asset, and funded from the clean coin instead.
      const mintTx = await getEsploraTx(mintTxid);
      const spentTheAsset = mintTx.vin.some(i => i.txid === dirty.txid && i.vout === dirty.vout);
      expect(spentTheAsset).toBe(false);
      // The clean coin is the only other candidate, so the mint funded from it.
      const spentTheClean = mintTx.vin.some(i => i.txid === cleanTxid && i.vout === cleanVout);
      expect(spentTheClean).toBe(true);

      // The asset coin is still unspent on chain (its value output is intact).
      const dirtyStillLive = await getEsploraTx(dirty.txid);
      expect(dirtyStillLive.vout[dirty.vout]?.value).toBe(DIRTY_SATS);
    });
  }
});
