import { injectable } from 'inversify';

import type { Cat21Asset } from '@leather.io/models';

import { Cat21OrdApiClient } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';
import { AccountRequest } from '../types';
import { mapOrdCat21ToCat21Asset, sortOrdCat21ByBlockHeight } from './collectibles.utils';

/**
 * Returns the cats held by the addresses bound to the given account.
 *
 * Per ADR-9, cat21-ord is the sole authority for cat data. This service walks
 * the account's zero-index payer addresses (native segwit + taproot) and asks
 * cat21-ord for the cats at each, then fetches per-cat metadata to build the
 * `Cat21Asset` shape the collectibles UI renders.
 *
 * The walk is intentionally limited to the zero-index payer addresses for now;
 * full descriptor expansion (gap-limited xpub walk) is a later phase. Cat21 is
 * a hot wallet for active trading — heavy address derivation is a vault-side
 * concern, not a fast-path UI concern.
 */
@injectable()
export class Cat21AssetService {
  constructor(private readonly cat21OrdClient: Cat21OrdApiClient) {}

  public async getAccountCat21Assets(
    request: AccountRequest,
    signal?: AbortSignal
  ): Promise<Cat21Asset[]> {
    if (!request.account.bitcoin) return [];

    const addresses = this.collectAddresses(request);
    if (addresses.length === 0) return [];

    /* HACK -- Cat21: failures are not caught per item, matching upstream's
     * InscriptionsService, which wrapped one Promise.all in a single try and
     * let anything inside reach it. Best-in-Slot returned rich objects in one
     * call per descriptor, so upstream had no per-item fetch and no per-item
     * failure to swallow; ord's /address/ returns bare ids, so we fetch each
     * cat. Swallowing those rejections individually turned "every cat failed
     * to parse" into "this account owns no cats", which is indistinguishable
     * from an empty wallet and hid a schema mismatch against ord. A read that
     * cannot complete returns nothing rather than returning a quiet subset. */
    try {
      const results = await Promise.all(
        addresses.map(address => this.cat21OrdClient.fetchAddressCat21s(address, { signal }))
      );

      const catIds = results.flatMap(res => res.cats);
      if (catIds.length === 0) return [];

      const cats = await Promise.all(
        catIds.map(id => this.cat21OrdClient.fetchCat21(id, { signal }))
      );

      return cats.sort(sortOrdCat21ByBlockHeight).map(mapOrdCat21ToCat21Asset);
    } catch {
      return [];
    }
  }

  private collectAddresses(request: AccountRequest): string[] {
    const bitcoin = request.account.bitcoin;
    if (!bitcoin) return [];
    const addresses: string[] = [];
    if (!request.exclusions?.taprootAddresses && bitcoin.zeroIndexTaprootPayerAddress) {
      addresses.push(bitcoin.zeroIndexTaprootPayerAddress);
    }
    if (!request.exclusions?.nativeSegwitAddresses && bitcoin.zeroIndexNativeSegwitPayerAddress) {
      addresses.push(bitcoin.zeroIndexNativeSegwitPayerAddress);
    }
    return addresses;
  }
}
