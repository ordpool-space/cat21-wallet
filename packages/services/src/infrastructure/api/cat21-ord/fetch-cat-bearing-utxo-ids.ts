import type { ApiRequestOptions } from '../types';
import type { OrdOutput } from './cat21-ord-api.schema';

/**
 * The single cat21-ord capability `fetchCatBearingUtxoIds` needs: probe one
 * output. Typing it structurally (rather than against the full
 * `Cat21OrdApiClient` class) keeps this module free of the DI decorators, so the
 * flagship safety helper can be imported and tested without standing up the
 * inversify container, cache, and rate-limiter. A real `Cat21OrdApiClient`
 * satisfies it.
 */
export interface Cat21OutputProbe {
  fetchOutput(outpoint: string, options?: ApiRequestOptions): Promise<OrdOutput>;
}

/**
 * Phase 3.0 safety helper: returns the subset of given UTXOs that hold cats.
 * Used by `UtxosService.getDescriptorProtectedUtxos` to ensure the BTC send
 * flow never picks a cat-bearing UTXO as a payment input.
 *
 * On the wire this is one `/output/<txid>:<vout>` query per UTXO, queued
 * through the cat21-ord rate-limiter. A per-UTXO probe is more conservative
 * than a per-address scan: it tolerates address-reuse, multi-cat outputs,
 * and not-yet-indexed receive addresses correctly.
 *
 * The `out.cats` check reads the wire field as cat21-ord actually emits it:
 * its response-rewriting middleware renames ord's `inscriptions` to `cats` in
 * JSON, so the upstream name never arrives. A non-empty array means the output
 * holds a cat.
 *
 * Failure mode: if cat21-ord cannot be reached or the per-UTXO probe throws,
 * the safe answer is "treat the UTXO as cat-bearing" — i.e. the BTC send
 * flow won't touch it. This is the right default: if we cannot verify a UTXO
 * is cat-free, we don't risk spending a cat by mistake.
 */
export async function fetchCatBearingUtxoIds(
  client: Cat21OutputProbe,
  utxos: { txid: string; vout: number }[],
  options: ApiRequestOptions = {}
): Promise<{ txid: string; vout: number }[]> {
  if (utxos.length === 0) return [];

  const checks = await Promise.all(
    utxos.map(async utxo => {
      try {
        const out = await client.fetchOutput(`${utxo.txid}:${utxo.vout}`, options);
        return { utxo, hasCat: out.cats.length > 0 };
      } catch {
        return { utxo, hasCat: true };
      }
    })
  );

  return checks.filter(c => c.hasCat).map(c => c.utxo);
}
