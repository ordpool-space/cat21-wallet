import { inject, injectable } from 'inversify';

import { OwnedUtxo } from '@leather.io/models';
import { hasBitcoinAddress } from '@leather.io/utils';

/* HACK -- Cat21: Cat21OrdApiClient + fetchCatBearingUtxoIds imports per
 * Phase 3.0 safety. Without these, BtcBalancesService cannot route cat-bearing
 * UTXOs out of the `available` bucket. */
import {
  Cat21OrdApiClient,
  fetchCatBearingUtxoIds,
} from '../infrastructure/api/cat21-ord/cat21-ord-api.client';
import { LeatherApiClient } from '../infrastructure/api/leather/leather-api.client';
import { MempoolApiClient } from '../infrastructure/api/mempool/mempool-api.client';
import { selectBitcoinNetworkMode } from '../infrastructure/settings/settings.selectors';
import type { SettingsService } from '../infrastructure/settings/settings.service';
import { Types } from '../inversify.types';
import { BitcoinTransactionsService } from '../transactions/bitcoin-transactions.service';
import { AccountRequest } from '../types/request.types';
import {
  createOwnedUtxoFromLeather,
  createOwnedUtxoFromMempool,
  getUtxoTotals,
} from './utxos.utils';

export interface UtxoTotals {
  confirmed: OwnedUtxo[];
  inbound: OwnedUtxo[];
  outbound: OwnedUtxo[];
  /* HACK -- Cat21: `protected` bucket re-added per ADR-12. Holds cat-bearing
   * UTXOs that must not be spent by the BTC send flow. Currently always empty
   * — cat21-ord-driven UTXO classification is a coin-control phase task. */
  protected: OwnedUtxo[];
  dust: OwnedUtxo[];
  unspendable: OwnedUtxo[];
  available: OwnedUtxo[];
}

export const emptyUtxos: UtxoTotals = {
  confirmed: [],
  inbound: [],
  outbound: [],
  protected: [],
  dust: [],
  unspendable: [],
  available: [],
};

@injectable()
export class UtxosService {
  constructor(
    private readonly leatherApiClient: LeatherApiClient,
    private readonly mempoolApiClient: MempoolApiClient,
    private readonly bitcoinTransactionsService: BitcoinTransactionsService,
    @inject(Types.SettingsService) private readonly settings: SettingsService,
    /* HACK -- Cat21: Cat21OrdApiClient injected for per-UTXO cat probing per
     * Phase 3.0 safety. Skipped on regtest (no cat21-ord there). */
    private readonly cat21OrdClient: Cat21OrdApiClient
  ) {}
  /**
   * Retrieve categorized UTXO lists for given Bitcoin account.
   */
  public async getAccountUtxos(
    { account, exclusions }: AccountRequest,
    signal?: AbortSignal
  ): Promise<UtxoTotals> {
    if (!hasBitcoinAddress(account)) return emptyUtxos;

    const [nativeSegwitUtxos, taprootUtxos] = await Promise.all([
      !exclusions?.nativeSegwitAddresses
        ? this.getDescriptorUtxos(
            account.id.fingerprint,
            account.bitcoin.nativeSegwitDescriptor,
            signal
          )
        : Promise.resolve(emptyUtxos),
      !exclusions?.taprootAddresses
        ? this.getDescriptorUtxos(account.id.fingerprint, account.bitcoin.taprootDescriptor, signal)
        : Promise.resolve(emptyUtxos),
    ]);
    return {
      confirmed: [...nativeSegwitUtxos.confirmed, ...taprootUtxos.confirmed],
      inbound: [...nativeSegwitUtxos.inbound, ...taprootUtxos.inbound],
      outbound: [...nativeSegwitUtxos.outbound, ...taprootUtxos.outbound],
      protected: [...nativeSegwitUtxos.protected, ...taprootUtxos.protected],
      dust: [...nativeSegwitUtxos.dust, ...taprootUtxos.dust],
      unspendable: [...nativeSegwitUtxos.unspendable, ...taprootUtxos.unspendable],
      available: [...nativeSegwitUtxos.available, ...taprootUtxos.available],
    };
  }

  /**
   * Retrieve categorized UTXO lists for given Bitcoin xpub descriptor.
   */
  public async getDescriptorUtxos(
    fingerprint: string,
    descriptor: string,
    signal?: AbortSignal
  ): Promise<UtxoTotals> {
    const [totalUtxos, btcTxs] = await Promise.all([
      this.getDescriptorTotalUtxos(descriptor, fingerprint, signal),
      this.bitcoinTransactionsService.getDescriptorTransactions(descriptor, signal),
    ]);
    /* HACK -- Cat21: cat-bearing UTXO probe per Phase 3.0 safety. Per-output
     * /output query on cat21-ord, rate-limited. Failure mode is "assume cat
     * present" (see fetchCatBearingUtxoIds doc); the resulting UTXOs land in
     * the `protected` bucket and never reach `available`. */
    const networkMode = selectBitcoinNetworkMode(this.settings.getSettings());
    const catBearingUtxoIds =
      networkMode === 'mainnet'
        ? await fetchCatBearingUtxoIds(this.cat21OrdClient, totalUtxos, { signal })
        : [];
    return getUtxoTotals(fingerprint, totalUtxos, btcTxs, catBearingUtxoIds);
  }

  private async getDescriptorTotalUtxos(
    descriptor: string,
    fingerprint: string,
    signal?: AbortSignal
  ): Promise<OwnedUtxo[]> {
    const networkMode = selectBitcoinNetworkMode(this.settings.getSettings());
    if (networkMode === 'regtest') {
      const mempoolApiUtxos = await this.mempoolApiClient.fetchDescriptorUtxos(descriptor, {
        signal,
      });
      return mempoolApiUtxos.map(utxo => createOwnedUtxoFromMempool(utxo, fingerprint));
    }
    const leatherApiUtxos = await this.leatherApiClient.fetchUtxos(descriptor, { signal });
    return leatherApiUtxos.map(utxo => createOwnedUtxoFromLeather(utxo, fingerprint));
  }
}
