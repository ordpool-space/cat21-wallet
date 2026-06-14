import { injectable } from 'inversify';

import type { InscriptionAsset } from '@leather.io/models';

import { Cat21OrdApiClient } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';
import { AccountRequest } from '../types';
import { mapOrdInscriptionToInscriptionAsset } from './collectibles.utils';

/**
 * Returns the cats held by the addresses bound to the given account.
 *
 * Per ADR-9, cat21-ord is the sole authority for cat data. This service walks
 * the account's zero-index payer addresses (native segwit + taproot) and asks
 * cat21-ord for the inscriptions at each, then fetches per-inscription metadata
 * to build the `InscriptionAsset` shape the existing collectibles UI renders.
 *
 * The walk is intentionally limited to the zero-index payer addresses for now;
 * full descriptor expansion (gap-limited xpub walk) is a later phase. Cat21 is
 * a hot wallet for active trading — heavy address derivation is a vault-side
 * concern, not a fast-path UI concern.
 */
@injectable()
export class InscriptionsService {
  constructor(private readonly cat21OrdClient: Cat21OrdApiClient) {}

  public async getAccountInscriptions(
    request: AccountRequest,
    signal?: AbortSignal
  ): Promise<InscriptionAsset[]> {
    if (!request.account.bitcoin) return [];

    const addresses = this.collectAddresses(request);
    if (addresses.length === 0) return [];

    try {
      const results = await Promise.all(
        addresses.map(address =>
          this.cat21OrdClient.fetchAddressInscriptions(address, { signal }).then(
            res => ({ address, inscriptions: res.inscriptions }),
            () => ({ address, inscriptions: [] as string[] })
          )
        )
      );

      const inscriptionIds = results.flatMap(r => r.inscriptions);
      if (inscriptionIds.length === 0) return [];

      const inscriptionDetails = await Promise.all(
        inscriptionIds.map(id =>
          this.cat21OrdClient.fetchInscription(id, { signal }).then(
            inscription => mapOrdInscriptionToInscriptionAsset(inscription),
            () => undefined
          )
        )
      );

      return inscriptionDetails.filter((asset): asset is InscriptionAsset => Boolean(asset));
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
