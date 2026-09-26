import { describe, expect, it, vi } from 'vitest';

import type { OrdOutput } from './cat21-ord-api.schema';
import { Cat21OutputProbe, fetchCatBearingUtxoIds } from './fetch-cat-bearing-utxo-ids';

/**
 * The send-flow safety helper: it decides which UTXOs must be withheld from the
 * BTC spend pool because they carry a cat. A false negative here spends a cat as
 * a miner fee, which is unrecoverable, so the tests below assert the load-bearing
 * behaviours by value (which UTXOs come back) and specifically pin the fail-safe:
 * when a probe cannot answer, the UTXO is treated as cat-bearing.
 *
 * The probe is mocked at the one method the helper depends on (`fetchOutput`),
 * which is the real IO boundary. Its return shape is `OrdOutput` exactly as
 * `ordOutputSchema` produces it (verified byte-for-byte against a live
 * ord.cat21.space `/output` response in the sibling schema spec), so the mock
 * cannot encode a shape the real server never sends.
 */

function outputWith(cats: string[]): OrdOutput {
  // Minimal real-shaped OrdOutput: value + cats are the two modelled fields; the
  // rest arrive via passthrough and the helper never reads them.
  return { value: 546, cats } as OrdOutput;
}

function probe(byOutpoint: Record<string, OrdOutput | Error>): {
  client: Cat21OutputProbe;
  fetchOutput: ReturnType<typeof vi.fn>;
} {
  const fetchOutput = vi.fn((outpoint: string): Promise<OrdOutput> => {
    const entry = byOutpoint[outpoint];
    if (entry === undefined) return Promise.reject(new Error(`unexpected outpoint ${outpoint}`));
    if (entry instanceof Error) return Promise.reject(entry);
    return Promise.resolve(entry);
  });
  return { client: { fetchOutput }, fetchOutput };
}

const A = { txid: 'a'.repeat(64), vout: 0 };
const B = { txid: 'b'.repeat(64), vout: 1 };
const C = { txid: 'c'.repeat(64), vout: 2 };

describe('fetchCatBearingUtxoIds', () => {
  it('returns an empty list without probing when given no utxos', async () => {
    const { client, fetchOutput } = probe({});

    const result = await fetchCatBearingUtxoIds(client, []);

    expect(result).toEqual([]);
    expect(fetchOutput).not.toHaveBeenCalled();
  });

  it('returns none when every probed output is cat-free', async () => {
    const { client } = probe({
      [`${A.txid}:${A.vout}`]: outputWith([]),
      [`${B.txid}:${B.vout}`]: outputWith([]),
    });

    const result = await fetchCatBearingUtxoIds(client, [A, B]);

    expect(result).toEqual([]);
  });

  it('returns every utxo when every probed output holds a cat', async () => {
    const { client } = probe({
      [`${A.txid}:${A.vout}`]: outputWith([`${A.txid}i0`]),
      [`${B.txid}:${B.vout}`]: outputWith([`${B.txid}i0`]),
    });

    const result = await fetchCatBearingUtxoIds(client, [A, B]);

    expect(result).toEqual([A, B]);
  });

  it('returns only the cat-bearing subset when mixed', async () => {
    const { client } = probe({
      [`${A.txid}:${A.vout}`]: outputWith([`${A.txid}i0`]), // cat
      [`${B.txid}:${B.vout}`]: outputWith([]), // clean
      [`${C.txid}:${C.vout}`]: outputWith([`${C.txid}i0`, `${C.txid}i1`]), // multi-cat
    });

    const result = await fetchCatBearingUtxoIds(client, [A, B, C]);

    expect(result).toEqual([A, C]);
  });

  it('treats a probe that throws as cat-bearing (fail-safe: never spend an unverifiable utxo)', async () => {
    const { client } = probe({
      [`${A.txid}:${A.vout}`]: new Error('cat21-ord unreachable'),
      [`${B.txid}:${B.vout}`]: outputWith([]),
    });

    const result = await fetchCatBearingUtxoIds(client, [A, B]);

    // A could not be verified cat-free, so it is protected; B is proven clean.
    expect(result).toEqual([A]);
  });

  it('protects an utxo whose probe throws AND the genuinely cat-bearing ones together', async () => {
    const { client } = probe({
      [`${A.txid}:${A.vout}`]: new Error('parse error'),
      [`${B.txid}:${B.vout}`]: outputWith([`${B.txid}i0`]),
      [`${C.txid}:${C.vout}`]: outputWith([]),
    });

    const result = await fetchCatBearingUtxoIds(client, [A, B, C]);

    expect(result).toEqual([A, B]);
  });

  it('probes with the exact `txid:vout` outpoint string ord expects', async () => {
    const { client, fetchOutput } = probe({
      [`${A.txid}:${A.vout}`]: outputWith([]),
      [`${B.txid}:${B.vout}`]: outputWith([]),
    });

    await fetchCatBearingUtxoIds(client, [A, B]);

    expect(fetchOutput).toHaveBeenCalledWith(`${A.txid}:0`, expect.anything());
    expect(fetchOutput).toHaveBeenCalledWith(`${B.txid}:1`, expect.anything());
  });

  it('forwards the request options (signal / skipCache) to every probe', async () => {
    const { client, fetchOutput } = probe({
      [`${A.txid}:${A.vout}`]: outputWith([]),
    });
    const signal = new AbortController().signal;

    await fetchCatBearingUtxoIds(client, [A], { signal, skipCache: true });

    expect(fetchOutput).toHaveBeenCalledWith(`${A.txid}:0`, { signal, skipCache: true });
  });

  it('preserves the caller-supplied utxo objects by identity, not copies', async () => {
    const { client } = probe({
      [`${A.txid}:${A.vout}`]: outputWith([`${A.txid}i0`]),
    });

    const result = await fetchCatBearingUtxoIds(client, [A]);

    expect(result[0]).toBe(A);
  });
});
