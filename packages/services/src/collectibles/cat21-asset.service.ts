import { injectable } from 'inversify';

import type { Cat21Asset } from '@leather.io/models';

import { Cat21OrdApiClient } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';
import { AccountRequest } from '../types';
import { mapOrdCat21ToCat21Asset } from './collectibles.utils';

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

    try {
      const results = await Promise.all(
        addresses.map(address =>
          this.cat21OrdClient.fetchAddressCat21s(address, { signal }).then(
            res => ({ address, catIds: res.inscriptions }),
            () => ({ address, catIds: [] as string[] })
          )
        )
      );

      const catIds = results.flatMap(r => r.catIds);
      if (catIds.length === 0) return [];

      const catDetails = await Promise.all(
        catIds.map(id =>
          this.cat21OrdClient.fetchCat21(id, { signal }).then(
            cat => mapOrdCat21ToCat21Asset(cat),
            () => undefined
          )
        )
      );

      return catDetails.filter((asset): asset is Cat21Asset => Boolean(asset));
    } catch {
      return [];
    }
  }

  private collectAddresses(request: AccountRequest): string[] {
    const bitcoin = request.account.bitcoin;
    if (!bitcoin) return [];
    const addresses: string[] = [];
    if (
      !request.exclusions?.taprootAddresses &&
      bitcoin.zeroIndexTaprootPayerAddress
    ) {
      addresses.push(bitcoin.zeroIndexTaprootPayerAddress);
    }
    if (
      !request.exclusions?.nativeSegwitAddresses &&
      bitcoin.zeroIndexNativeSegwitPayerAddress
    ) {
      addresses.push(bitcoin.zeroIndexNativeSegwitPayerAddress);
    }
    return addresses;
  }
}
