import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import {
  type ContentScanPort,
  type CoreFundingUtxo,
  KnownOrdinalWalletType,
  type MintCoreParams,
  Network,
  type UtxoAssetDetail,
  type UtxoClassification,
  type UtxosPort,
  expertRequiredCause,
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

function coin(id: string, value: number): CoreFundingUtxo {
  return { txid: id.repeat(64).slice(0, 64), vout: 0, value };
}
function op(u: { txid: string; vout: number }): string {
  return `${u.txid}:${u.vout}`;
}

function params(over: Partial<MintCoreParams> = {}): MintCoreParams {
  return {
    walletType: KnownOrdinalWalletType.cat21wallet,
    network: Network.Mainnet,
    paymentPublicKey: PAYMENT_PUB,
    paymentAddress: PAYMENT_ADDR,
    recipientAddress: ORDINALS_ADDR,
    feeRatePerVbyte: 10,
    ...over,
  };
}

// Ports return resolved promises (no `async` without `await`, per the
// wallet's require-await rule).
function utxosPort(coins: CoreFundingUtxo[]): UtxosPort {
  return { spendableUtxos: () => Promise.resolve(coins) };
}
function scanPort(verdicts: Record<string, UtxoClassification> = {}): ContentScanPort {
  return { classify: outpoint => Promise.resolve(verdicts[outpoint] ?? 'clean') };
}

const INSCRIPTION_ID = `${'ab'.repeat(32)}i0`;

/**
 * The object form the wallet's production port returns
 * (`classifyOutpointVerdict`): `has-assets` WITH a detail that names the
 * inscription, so the core can put the name in front of the user.
 */
const NAMED: UtxoClassification = {
  verdict: 'has-assets',
  assets: { inscriptionIds: [INSCRIPTION_ID], runeNames: [], catIds: [], rareSat: null },
};

/** One covering coin that carries NAMED assets: the pool where topology decides. */
function dirtyOnly(classification: UtxoClassification = NAMED) {
  const asset = coin('d', 100_000);
  return {
    asset,
    ports: { utxos: utxosPort([asset]), scan: scanPort({ [op(asset)]: classification }) },
  };
}

/** One covering coin whose scan REJECTS: content unknown (ord unreachable or not indexed). */
function unknownOnly() {
  const asset = coin('e', 100_000);
  const scan: ContentScanPort = {
    classify: () => Promise.reject(new Error('ord has not indexed this output')),
  };
  return { asset, ports: { utxos: utxosPort([asset]), scan } };
}

describe('funding-topology contract (wallet <-> SDK simulate*)', () => {
  it('MANUAL (separate-payment-address): a NAMED-asset-only pool previews asset-notice with a spendable coin and the names', async () => {
    // The manual dialog threads isOneAddressWallet -> 'separate-payment-address'.
    // A coin comes back, which is what lets the CTA stay enabled behind a notice,
    // and the detail rides along, which is what the notice renders.
    const { asset, ports } = dirtyOnly();
    const sim = await simulateMint(params({ fundingTopology: 'separate-payment-address' }), ports);

    expect(sim.status).toBe('asset-notice');
    expect(sim.fundingUtxo?.txid).toBe(asset.txid);
    expect(sim.recommendation.recommended?.assets?.inscriptionIds).toEqual([INSCRIPTION_ID]);
    expect(expertRequiredCause(sim.recommendation)).toBe('named-assets');
  });

  it('MANUAL (separate-payment-address): a scan that REJECTS blocks with bucket failed and cause unknown-content', async () => {
    // A coin whose content is unknown is never behind a notice, on any topology:
    // a notice that cannot say what the coin holds informs nobody.
    const { asset, ports } = unknownOnly();
    const sim = await simulateMint(params({ fundingTopology: 'separate-payment-address' }), ports);

    expect(sim.status).toBe('expert-required');
    expect(sim.fundingUtxo).toBeNull();
    expect(sim.recommendation.recommended?.txid).toBe(asset.txid);
    expect(sim.recommendation.recommended?.bucket).toBe('failed');
    expect(expertRequiredCause(sim.recommendation)).toBe('unknown-content');
  });

  it('MANUAL (separate-payment-address): a BARE has-assets verdict blocks with cause unnamed-assets', async () => {
    // The bare string says something is there and not what, so there is nothing
    // for a notice to name.
    const { ports } = dirtyOnly('has-assets');
    const sim = await simulateMint(params({ fundingTopology: 'separate-payment-address' }), ports);

    expect(sim.status).toBe('expert-required');
    expect(sim.fundingUtxo).toBeNull();
    expect(sim.recommendation.recommended?.bucket).toBe('assets');
    expect(expertRequiredCause(sim.recommendation)).toBe('unnamed-assets');
  });

  it('MANUAL (separate-payment-address): a detail that names nothing blocks like a bare verdict', async () => {
    const nothingNamed: UtxoAssetDetail = {
      inscriptionIds: [],
      runeNames: [],
      catIds: [],
      rareSat: null,
    };
    const { ports } = dirtyOnly({ verdict: 'has-assets', assets: nothingNamed });
    const sim = await simulateMint(params({ fundingTopology: 'separate-payment-address' }), ports);

    expect(sim.status).toBe('expert-required');
    expect(expertRequiredCause(sim.recommendation)).toBe('unnamed-assets');
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
    // Blocked, and the assets are still named: the autonomous path passes no
    // topology, so this is the answer an agent stands on.
    expect(expertRequiredCause(sim.recommendation)).toBe('named-assets');
    expect(sim.recommendation.recommended?.assets?.inscriptionIds).toEqual([INSCRIPTION_ID]);
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
