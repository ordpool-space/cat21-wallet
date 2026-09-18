import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import {
  type ContentScanPort,
  type CoreFundingUtxo,
  KnownOrdinalWalletType,
  type MintCoreParams,
  Network,
  type UtxosPort,
  simulateMint,
} from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

/**
 * The funding-topology CONTRACT the manual notice dialog and the autonomous path
 * both stand on, pinned at the wallet <-> SDK seam. `simulateMint` is the
 * pre-approve preview: content-checked funding selection + two-pass fee, no
 * signing or broadcast, and the SAME computation `executeMint` repeats, so a
 * dialog built on its `status` cannot disagree with what actually happens.
 *
 * The dialog state machine (which maps `status` to the CTA) is written against
 * THIS contract, not against prose. Addresses are the wallet's real shapes: a
 * native-segwit payment address and a taproot ordinals address (cat21-wallet's
 * separate-address layout), so the fee/vsize path runs on the script types the
 * wallet actually funds from.
 *
 * `fundingTopology` is a params property the CALLER derives (the core can't:
 * it holds the payment address but not the ordinals one). A well-formed caller,
 * UI or agent, passes its derived topology and acts on the named-asset answer;
 * an agent is protected by getting the same facts, not by being denied them.
 * Omitting the field yields the blocking default, which is the safe fallback
 * for a caller that FORGOT to thread it, not a mechanism for declining.
 */

/** A p2*.address is `string | undefined`; assert-present without the banned `!`. */
function addressOf(payment: { address?: string }): string {
  if (!payment.address) throw new Error('btc-signer returned no address');
  return payment.address;
}

const PAYMENT_PUB = hex.decode(
  '0278875d226dd610b06c41d698c9fe0ea4915c797ddc31a3310299d9acd07ff37b'
);
const ORDINALS_PUB = hex.decode('5df12ac222a1cd78dd4681c7c7a56f3e273884a086b2b6100957d20c73be3c37');
const PAYMENT_ADDR = addressOf(btc.p2wpkh(PAYMENT_PUB, btc.NETWORK));
const ORDINALS_ADDR = addressOf(btc.p2tr(ORDINALS_PUB, undefined, btc.NETWORK));

const coin = (id: string, value: number): CoreFundingUtxo => ({
  txid: id.repeat(64).slice(0, 64),
  vout: 0,
  value,
});
const op = (u: { txid: string; vout: number }) => `${u.txid}:${u.vout}`;

const params = (over: Partial<MintCoreParams> = {}): MintCoreParams => ({
  walletType: KnownOrdinalWalletType.cat21wallet,
  network: Network.Mainnet,
  paymentPublicKey: PAYMENT_PUB,
  paymentAddress: PAYMENT_ADDR,
  recipientAddress: ORDINALS_ADDR,
  feeRatePerVbyte: 10,
  ...over,
});

const utxosPort = (coins: CoreFundingUtxo[]): UtxosPort => ({ spendableUtxos: async () => coins });
const scanPort = (verdicts: Record<string, 'clean' | 'has-assets'> = {}): ContentScanPort => ({
  classify: async outpoint => verdicts[outpoint] ?? 'clean',
});

/** One covering coin that carries assets: the pool where topology decides. */
function dirtyOnly() {
  const asset = coin('d', 100_000);
  return {
    asset,
    ports: { utxos: utxosPort([asset]), scan: scanPort({ [op(asset)]: 'has-assets' }) },
  };
}

describe('funding-topology contract (wallet <-> SDK simulate*)', () => {
  it('MANUAL (separate-payment-address): a dirty-only pool previews asset-notice with a spendable coin', async () => {
    // The manual dialog threads isOneAddressWallet -> 'separate-payment-address'.
    // A coin comes back, which is what lets the CTA stay enabled behind a notice.
    const { asset, ports } = dirtyOnly();
    const sim = await simulateMint(params({ fundingTopology: 'separate-payment-address' }), ports);

    expect(sim.status).toBe('asset-notice');
    expect(sim.fundingUtxo?.txid).toBe(asset.txid);
  });

  it('OMITTED topology: a dirty-only pool previews expert-required with no coin (safe default for a caller that forgot)', async () => {
    // The blocking default when NO topology is threaded. It guards a caller that
    // forgot to derive-and-pass one; it is NOT how an agent declines (an agent
    // passes its topology and acts on the named-asset answer, same as the UI).
    // Worth pinning because it stays TRUE regardless: a caller that supplies
    // nothing must never be handed a coin that carries assets. Mutation: swap
    // params() for params({ fundingTopology: 'separate-payment-address' }) and
    // both expectations red (it returns asset-notice + a coin).
    const { ports } = dirtyOnly();
    const sim = await simulateMint(params(), ports);

    expect(sim.status).toBe('expert-required');
    expect(sim.fundingUtxo).toBeNull();
  });

  it('a clean coin previews ready with the topology threaded, so the quiet path is unchanged', async () => {
    const clean = coin('c', 100_000);
    const sim = await simulateMint(params({ fundingTopology: 'separate-payment-address' }), {
      utxos: utxosPort([clean]),
      scan: scanPort(),
    });

    expect(sim.status).toBe('ready');
    expect(sim.fundingUtxo?.txid).toBe(clean.txid);
  });
});
