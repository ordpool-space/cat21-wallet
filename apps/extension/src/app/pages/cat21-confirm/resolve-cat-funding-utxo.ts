import * as btc from '@scure/btc-signer';
import { type Cat21TransferCatInput, Network, toScureNetwork } from 'ordpool-sdk/core';

import type { OrdCat21 } from '@leather.io/services';

/**
 * Map a cat21-ord `/cat/<id>` record (`OrdCat21`) to the
 * `Cat21TransferCatInput` the SDK core signs over as input 0 of a
 * transfer or a buy-offer.
 *
 * The UTXO value is PRESERVED from `cat.value` ("sats held by the cat's
 * current output"), never assumed to be 546. Per the SDK HARD RULE "cat
 * UTXO size — set ONCE at mint, PRESERVED by every later operation", a
 * cat can ride an any-size UTXO: an external `nLockTime=21` mint, a
 * grown cat, or an inscription-that-is-also-a-cat. The core commits
 * `value` as the input-0 witnessUtxo amount, so a wrong value produces
 * an invalid signature (real UTXO ≠ signed amount) and, on output 0,
 * silently drops the surplus sats.
 *
 * Throws (caught one frame up as `cat-utxo-resolve-failed`) when the cat
 * is not in a movable on-chain state: no `address` (unconfirmed / spent),
 * no `value`, or a `satpoint` that does not parse into `txid:vout`. A
 * 546-sat fallback is deliberately NOT used — that is the bug this
 * helper exists to prevent.
 */
export function resolveCatFundingUtxo(
  cat: OrdCat21,
  networkLabel: 'mainnet' | 'testnet' | 'regtest'
): Cat21TransferCatInput {
  if (!cat.address) {
    throw new Error('cat21-ord returned cat without address');
  }
  if (cat.value == null) {
    throw new Error('cat21-ord returned cat without a UTXO value');
  }
  const [txid, voutStr] = cat.satpoint.split(':');
  const vout = Number(voutStr);
  if (!txid || Number.isNaN(vout)) {
    throw new Error(`malformed satpoint: ${cat.satpoint}`);
  }
  // regtest (bcrt) is NOT scure's TEST_NETWORK (tb); use the SDK's mapping so
  // a regtest cat address decodes correctly for the E2E chain-truth harness.
  const scureNetwork = toScureNetwork(toSdkNetwork(networkLabel));
  const scriptPubKey = btc.OutScript.encode(btc.Address(scureNetwork).decode(cat.address));
  return { txid, vout, value: cat.value, scriptPubKey };
}

/** Map the wallet's coarse network label to the SDK `Network` enum. */
function toSdkNetwork(networkLabel: 'mainnet' | 'testnet' | 'regtest'): Network {
  if (networkLabel === 'mainnet') return Network.Mainnet;
  if (networkLabel === 'regtest') return Network.Regtest;
  return Network.Testnet3;
}
