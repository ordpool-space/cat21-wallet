import { describe, expect, it, vi } from 'vitest';

import outputWithCat from '../infrastructure/api/cat21-ord/__fixtures__/output-with-cat.json';
import outputWithoutCat from '../infrastructure/api/cat21-ord/__fixtures__/output-without-cat.json';
import type { Cat21OrdApiClient } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';
import type {
  LeatherApiClient,
  LeatherApiUtxo,
} from '../infrastructure/api/leather/leather-api.client';
import type { MempoolApiClient } from '../infrastructure/api/mempool/mempool-api.client';
import type { SettingsService } from '../infrastructure/settings/settings.service';
import type { BitcoinTransactionsService } from '../transactions/bitcoin-transactions.service';
import { UtxosService } from './utxos.service';

/**
 * The caller half of WAL HARD RULE #2 (a cat-bearing UTXO is never spent by the
 * BTC send flow): on mainnet `getDescriptorUtxos` must hand the UTXOs cat21-ord
 * reports as holding a cat to `getUtxoTotals`, which routes them into
 * `protected`. A 546-sat cat is above the dust threshold, so without this
 * hand-over it would sit in `available`.
 *
 * The collaborators are stubbed at the service's IO boundary. cat21-ord answers
 * with the captured `/output` responses in `__fixtures__` (a real 546-sat cat,
 * and a coin without one); the Leather UTXO carries `value` as the wire string.
 * The `as unknown as` casts follow this package's convention for class-typed
 * collaborators, of which the service reads one method each.
 */

// The cat UTXO is the captured cat's own outpoint.
const CAT = { txid: outputWithCat.transaction, vout: 0, value: '546', height: 840_000 };
const PLAIN = { txid: 'a'.repeat(64), vout: 1, value: '50000', height: 840_000 };

function leatherUtxo(u: typeof CAT): LeatherApiUtxo {
  return { ...u, address: 'bc1qtest', path: 'm/84/0/0/0/0' } as unknown as LeatherApiUtxo;
}

function service(mode: 'mainnet' | 'testnet') {
  const leatherApiClient = {
    fetchUtxos: vi.fn(() => Promise.resolve([leatherUtxo(CAT), leatherUtxo(PLAIN)])),
  } as unknown as LeatherApiClient;
  const bitcoinTransactionsService = {
    getDescriptorTransactions: vi.fn(() => Promise.resolve([])),
  } as unknown as BitcoinTransactionsService;
  const settings = {
    getSettings: () => ({ network: { chain: { bitcoin: { mode } } } }),
  } as unknown as SettingsService;
  const fetchOutput = vi.fn((outpoint: string) =>
    Promise.resolve(outpoint === `${CAT.txid}:${CAT.vout}` ? outputWithCat : outputWithoutCat)
  );
  const cat21OrdClient = { fetchOutput } as unknown as Cat21OrdApiClient;
  const utxos = new UtxosService(
    leatherApiClient,
    {} as unknown as MempoolApiClient,
    bitcoinTransactionsService,
    settings,
    cat21OrdClient
  );
  return { utxos, fetchOutput };
}

describe('UtxosService.getDescriptorUtxos', () => {
  it('on mainnet routes the UTXO cat21-ord reports as holding a cat into protected, never available', async () => {
    const { utxos } = service('mainnet');
    const totals = await utxos.getDescriptorUtxos('f', 'wpkh(xpub)');
    expect(totals.protected.map(u => u.txid)).toEqual([CAT.txid]);
    expect(totals.available.map(u => u.txid)).toEqual([PLAIN.txid]);
  });

  it('off mainnet does not probe cat21-ord, so the protected bucket is empty', async () => {
    // Pins the probe's scope as it is: cat UTXO protection runs on mainnet only.
    const { utxos, fetchOutput } = service('testnet');
    const totals = await utxos.getDescriptorUtxos('f', 'tr(xpub)');
    expect(totals.protected).toEqual([]);
    expect(fetchOutput).toHaveBeenCalledTimes(0);
  });
});
