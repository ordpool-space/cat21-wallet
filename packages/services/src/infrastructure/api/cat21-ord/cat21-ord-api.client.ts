import axios from 'axios';
import { inject, injectable } from 'inversify';
import { z } from 'zod';

import { Types } from '../../../inversify.types';
import type { HttpCacheService } from '../../cache/http-cache.service';
import { RateLimiterService, RateLimiterType } from '../../rate-limiter/rate-limiter.service';
import { ApiRequestOptions } from '../types';
import {
  OrdAddressCat21s,
  OrdCat21,
  OrdOutput,
  OrdStatus,
  ordAddressCat21sSchema,
  ordCat21Schema,
  ordOutputSchema,
  ordStatusSchema,
} from './cat21-ord-api.schema';
import { getCat21OrdBasePath } from './cat21-ord-api.utils';

/**
 * cat21-ord is the sole authority on cat data (ADR-9). Endpoints follow ord's
 * JSON convention; the server is configured with `--index-cat21 --index-sats
 * --index-addresses` so cat numbers equal ord's inscription numbers, and
 * address-based lookup is supported.
 *
 * The `Accept: application/json` header is critical — without it, ord falls back
 * to HTML rendering even on the /inscription/<id> endpoint (which is ord's
 * canonical URL path for what we model as a cat).
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
   * `GET /address/<address>` — list of cat IDs at a bitcoin address.
   * The wallet calls this on asset-view load and on background refresh.
   */
  public async fetchAddressCat21s(
    address: string,
    { signal, skipCache }: ApiRequestOptions = {}
  ): Promise<OrdAddressCat21s> {
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
      return ordAddressCat21sSchema.parse(res.data);
    };

    return skipCache
      ? fetchFn()
      : this.cache.fetchWithCache(['cat21-ord-address-cat21s', address], fetchFn);
  }

  /**
   * `GET /cat/<id>` — per-cat metadata. cat21-ord rewrites `/cat/<id>` to
   * the canonical ord route `/inscription/<id>` server-side (see
   * `cat21-ord/src/subcommand/server.rs`), so we get to use the cat-native
   * URL on every request the wallet makes.
   */
  public async fetchCat21(
    id: string,
    { signal, skipCache }: ApiRequestOptions = {}
  ): Promise<OrdCat21> {
    const url = `${getCat21OrdBasePath()}/cat/${encodeURIComponent(id)}`;

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
      return ordCat21Schema.parse(res.data);
    };

    return skipCache ? fetchFn() : this.cache.fetchWithCache(['cat21-ord-cat21', id], fetchFn);
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

/* Re-export for consumer convenience so a single import yields client + types. */
export type { OrdAddressCat21s, OrdCat21, OrdOutput, OrdStatus };
export { z };

/* HACK -- Cat21: `fetchCatBearingUtxoIds` lives in its own DI-free module so the
 * flagship send-flow safety helper can be imported + tested against a real
 * cat21-ord without standing up the inversify client. Re-exported here so
 * existing importers of this file keep resolving it. */
export { fetchCatBearingUtxoIds } from './fetch-cat-bearing-utxo-ids';
export type { Cat21OutputProbe } from './fetch-cat-bearing-utxo-ids';
