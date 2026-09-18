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
 * `fundingTopology` is a params property, not a port, so the autonomous path
 * declines the relaxation by simply not passing it (see the load-bearing case).
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

  it('AUTONOMOUS (topology omitted): a dirty-only pool previews expert-required with no coin', async () => {
    // Load-bearing safety property: the MCP/agent path passes no topology, so it
    // gets the BLOCKING answer and no coin, so an unattended dirty spend cannot
    // happen. Passing 'separate-payment-address' here would return asset-notice +
    // a coin (exactly that spend), so this assertion is what forbids it.
    // Mutation: swap params() for params({ fundingTopology: 'separate-payment-address' })
    // and both expectations red.
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
