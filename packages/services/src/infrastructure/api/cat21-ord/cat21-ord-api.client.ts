import axios from 'axios';
import { inject, injectable } from 'inversify';
import { z } from 'zod';

import { Types } from '../../../inversify.types';
import type { HttpCacheService } from '../../cache/http-cache.service';
import { RateLimiterService, RateLimiterType } from '../../rate-limiter/rate-limiter.service';
import { ApiRequestOptions } from '../types';
import {
  OrdAddressInscriptions,
  OrdInscription,
  OrdOutput,
  OrdStatus,
  ordAddressInscriptionsSchema,
  ordInscriptionSchema,
  ordOutputSchema,
  ordStatusSchema,
} from './cat21-ord-api.schema';
import { getCat21OrdBasePath } from './cat21-ord-api.utils';

/**
 * cat21-ord is the sole authority on cat data (ADR-9). Endpoints follow ord's
 * JSON convention; the server is configured with `--index-cat21 --index-sats
 * --index-addresses` so inscription numbers equal cat numbers, and address-based
 * lookup is supported.
 *
 * The `Accept: application/json` header is critical — without it, ord falls back
 * to HTML rendering even on /inscription/<id> endpoints.
 *
 * All requests share the Cat21Ord rate-limiter queue and the http-cache.
 * Per ADR-11, axios is the HTTP client — the same library Leather uses, kept
 * uniform across the codebase.
 */
@injectable()
export class Cat21OrdApiClient {
  constructor(
    @inject(Types.CacheService) private readonly cache: HttpCacheService,
    private readonly limiter: RateLimiterService
  ) {}

  /**
   * `GET /address/<address>` — list of inscription IDs at a bitcoin address.
   * The wallet calls this on asset-view load and on background refresh.
   */
  public async fetchAddressInscriptions(
    address: string,
    { signal, skipCache }: ApiRequestOptions = {}
  ): Promise<OrdAddressInscriptions> {
    const url = `${getCat21OrdBasePath()}/address/${encodeURIComponent(address)}`;

    const fetchFn = async () => {
      const res = await this.limiter.add(
        RateLimiterType.Cat21Ord,
        () =>
          axios.get<unknown>(url, {
            signal,
            headers: { Accept: 'application/json' },
          }),
        { signal }
      );
      return ordAddressInscriptionsSchema.parse(res.data);
    };

    return skipCache
      ? fetchFn()
      : this.cache.fetchWithCache(['cat21-ord-address-inscriptions', address], fetchFn);
  }

  /**
   * `GET /inscription/<id>` — per-cat metadata.
   */
  public async fetchInscription(
    id: string,
    { signal, skipCache }: ApiRequestOptions = {}
  ): Promise<OrdInscription> {
    const url = `${getCat21OrdBasePath()}/inscription/${encodeURIComponent(id)}`;

    const fetchFn = async () => {
      const res = await this.limiter.add(
        RateLimiterType.Cat21Ord,
        () =>
          axios.get<unknown>(url, {
            signal,
            headers: { Accept: 'application/json' },
          }),
        { signal }
      );
      return ordInscriptionSchema.parse(res.data);
    };

    return skipCache
      ? fetchFn()
      : this.cache.fetchWithCache(['cat21-ord-inscription', id], fetchFn);
  }

  /**
   * `GET /output/<outpoint>` — UTXO classification. Used by the send-flow's
   * cat-coin-control to filter out cat-bearing UTXOs from the BTC spend pool.
   *
   * The `outpoint` shape is `<txid>:<vout>`.
   */
  public async fetchOutput(
    outpoint: string,
    { signal, skipCache }: ApiRequestOptions = {}
  ): Promise<OrdOutput> {
    const url = `${getCat21OrdBasePath()}/output/${encodeURIComponent(outpoint)}`;

    const fetchFn = async () => {
      const res = await this.limiter.add(
        RateLimiterType.Cat21Ord,
        () =>
          axios.get<unknown>(url, {
            signal,
            headers: { Accept: 'application/json' },
          }),
        { signal }
      );
      return ordOutputSchema.parse(res.data);
    };

    return skipCache
      ? fetchFn()
      : this.cache.fetchWithCache(['cat21-ord-output', outpoint], fetchFn);
  }

  /**
   * `GET /status` — operational state probe. Used at startup to confirm
   * cat21-ord is reachable and configured with the index flags we require.
   *
   * Zod schema enforces `chain === 'mainnet'` and the three index flags must
   * all be true; failure surfaces as a parse error and the UI falls back to
   * "cat21-ord unreachable" mode.
   */
  public async fetchStatus({ signal, skipCache }: ApiRequestOptions = {}): Promise<OrdStatus> {
    const url = `${getCat21OrdBasePath()}/status`;

    const fetchFn = async () => {
      const res = await this.limiter.add(
        RateLimiterType.Cat21Ord,
        () =>
          axios.get<unknown>(url, {
            signal,
            headers: { Accept: 'application/json' },
          }),
        { signal }
      );
      return ordStatusSchema.parse(res.data);
    };

    return skipCache ? fetchFn() : this.cache.fetchWithCache(['cat21-ord-status'], fetchFn);
  }
}

/* Re-export for consumer convenience so a single import yields client + types.
 * Keeps the existing BIS-style import shape that the revived InscriptionsService
 * expects. */
export type { OrdAddressInscriptions, OrdInscription, OrdOutput, OrdStatus };
export { z };

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
 * Failure mode: if cat21-ord cannot be reached or the per-UTXO probe throws,
 * the safe answer is "treat the UTXO as cat-bearing" — i.e. the BTC send
 * flow won't touch it. This is the right default: if we cannot verify a UTXO
 * is cat-free, we don't risk spending a cat by mistake.
 */
export async function fetchCatBearingUtxoIds(
  client: Cat21OrdApiClient,
  utxos: { txid: string; vout: number }[],
  options: ApiRequestOptions = {}
): Promise<{ txid: string; vout: number }[]> {
  if (utxos.length === 0) return [];

  const checks = await Promise.all(
    utxos.map(async utxo => {
      try {
        const out = await client.fetchOutput(`${utxo.txid}:${utxo.vout}`, options);
        return { utxo, hasCat: out.inscriptions.length > 0 };
      } catch {
        return { utxo, hasCat: true };
      }
    })
  );

  return checks.filter(c => c.hasCat).map(c => c.utxo);
}

