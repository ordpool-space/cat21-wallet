import { expect } from '@playwright/test';

import { ordOutputSchema } from '../../../../../packages/services/src/infrastructure/api/cat21-ord/cat21-ord-api.schema';
// The wallet's REAL cat-UTXO protection helpers, imported straight from the
// services package source. `fetch-cat-bearing-utxo-ids.ts` is DI-free (type-only
// imports), so it loads in a plain node/playwright context; `ordOutputSchema`
// is pure zod.
import { fetchCatBearingUtxoIds } from '../../../../../packages/services/src/infrastructure/api/cat21-ord/fetch-cat-bearing-utxo-ids';
import { test } from '../../fixtures/fixtures';
import {
  fundAddress,
  getEsploraTx,
  getOrdOutputByOutpoint,
  mintCatViaRawTx,
  newRegtestAddress,
  waitElectrsSynced,
  waitForCatAtOutput,
  waitOutputIndexed,
} from './regtest-harness';

/**
 * CAT-21 UTXO PROTECTION — real-infra proof of the wallet's headline safety
 * promise ("won't spend cat sats", HARD RULE #2).
 *
 * The BTC send flow routes any cat-bearing UTXO into the `protected` bucket so
 * coin-selection can never pick it. The load-bearing seam is
 * `fetchCatBearingUtxoIds`, which probes cat21-ord `/output/<outpoint>` per UTXO
 * and keeps the ones whose `cats` array is non-empty, parsed by
 * `ordOutputSchema`. That probe is MAINNET-GATED in `UtxosService`
 * (`networkMode === 'mainnet'`), so it never runs against real infra in any
 * regtest E2E and its schema could silently drift — exactly the string-vs-number
 * `/output` shape mistake that hit cat21-indexer's `getCatsAtOutput`. This spec
 * exercises the wallet's REAL schema + REAL filter against a REAL cat21-ord, so
 * a shape drift turns this red instead of silently unprotecting mainnet holders.
 *
 * We assert both directions against real data:
 *   1. SCHEMA AGREEMENT — a real minted cat's `/output` parses with `ordOutputSchema`
 *      and yields a non-empty `cats` whose id is the cat's inscription id; a real
 *      plain UTXO parses with an empty `cats`. (Guards the drift / bug class.)
 *   2. FILTER TRUTH — the wallet's real `fetchCatBearingUtxoIds`, over a client
 *      that really fetches + parses from cat21-ord, returns EXACTLY the cat UTXO
 *      out of [cat, plain]. (Guards the probe+filter the send flow depends on.)
 *
 * Note the honest limit: the send-form refusal itself is mainnet-gated and
 * cannot be driven end-to-end on regtest without changing that production gate,
 * which is out of scope for a test. This proves the seam the gate feeds.
 *
 * Prereqs/run: see cat21-mint-chain.spec.ts (same stack). No backend needed.
 */
test.describe('CAT-21 UTXO protection (regtest chain truth)', () => {
  test('wallet schema + fetchCatBearingUtxoIds flag a real cat, not a plain UTXO', async () => {
    // A real cat UTXO (from a real nLockTime=21 mint) and a real plain UTXO.
    const catAddress = newRegtestAddress('bech32m');
    const plainAddress = newRegtestAddress('bech32');
    const catTxid = mintCatViaRawTx(catAddress);
    const plainTxid = fundAddress(plainAddress, 0.0004);

    await waitElectrsSynced();
    const catOutput = await waitForCatAtOutput(catTxid, 0);
    expect(catOutput.cats.length).toBeGreaterThan(0);

    const plainTx = await getEsploraTx(plainTxid);
    const plainVout = plainTx.vout.findIndex(o => o.scriptpubkey_address === plainAddress);
    expect(plainVout).toBeGreaterThanOrEqual(0);
    await waitOutputIndexed(plainTxid, plainVout);

    // 1. SCHEMA AGREEMENT against the REAL cat21-ord /output.
    const catParsed = ordOutputSchema.parse(await getOrdOutputByOutpoint(`${catTxid}:0`));
    expect(catParsed.cats.length).toBeGreaterThan(0);
    // cat21-ord emits cats as inscription-id STRINGS `<txid>i<n>` (the shape the
    // string-vs-number bug class turns on). Prove it's the real cat's id.
    expect(catParsed.cats[0]).toBe(`${catTxid}i0`);

    const plainParsed = ordOutputSchema.parse(
      await getOrdOutputByOutpoint(`${plainTxid}:${plainVout}`)
    );
    expect(plainParsed.cats).toEqual([]);

    // 2. FILTER TRUTH: the wallet's real fetchCatBearingUtxoIds over a client
    // that really hits + parses cat21-ord returns EXACTLY the cat UTXO.
    const realFetchClient = {
      // real fetch + real parse; structurally satisfies Cat21OutputProbe.
      async fetchOutput(outpoint: string) {
        return ordOutputSchema.parse(await getOrdOutputByOutpoint(outpoint));
      },
    };
    const catUtxo = { txid: catTxid, vout: 0 };
    const plainUtxo = { txid: plainTxid, vout: plainVout };
    const flagged = await fetchCatBearingUtxoIds(realFetchClient, [catUtxo, plainUtxo]);
    expect(flagged).toEqual([catUtxo]);
  });
});
