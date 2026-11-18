// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type CoreFundingUtxo, type UtxoClassification, getDummyKeypair } from 'ordpool-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import { fundingPreviewCoin } from '@app/features/cat21-confirmation/cat21-funding-notice.model';
import type { Cat21AccountContext, Cat21RpcDeps } from '@background/cat21/cat21-rpc.service';
import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
  Cat21CreateOfferIntent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

import { fundingPreviewApplies, simulateFundingPreview } from './simulate-funding-preview';
import { useCat21FundingPreview } from './use-cat21-funding-preview';

/**
 * The manual pre-approve funding preview (mint, transfer, buy): the pure
 * `simulateFundingPreview` decision and the `useCat21FundingPreview` hook that
 * runs it, both driven through the REAL SDK `simulate*` with stubbed ports (the
 * SUT's IO boundary).
 *
 * The pure cases pin that each action runs ITS OWN simulate with ITS OWN
 * coverage target: a transfer or buy that fell through to the mint simulate
 * would preview the wrong coverage and name the wrong coin, and the confirm
 * route would pin it. The hook cases pin what React adds: the query must not
 * run while the funding UTXOs or the cat are still loading, because the query
 * key ignores that data, so an early run caches a wrong answer (`insufficient`
 * from an empty set, `not-applicable` from a cat not yet loaded) for the
 * dialog's life.
 *
 * Addresses are real mainnet shapes in the wallet's separate-address layout: a
 * native-segwit payment address and a taproot ordinals address, where the cat
 * lives.
 */

const { dummyPublicKey } = getDummyKeypair(btc.NETWORK);
const accountKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000003');

function addressOf(payment: { address?: string }): string {
  if (!payment.address) throw new Error('btc-signer returned no address');
  return payment.address;
}

const PAYMENT_ADDR = addressOf(btc.p2wpkh(accountKey, btc.NETWORK));
const p2trOrdinals = btc.p2tr(dummyPublicKey.slice(1), undefined, btc.NETWORK);
const ORDINALS_ADDR = addressOf(p2trOrdinals);
const OTHER_ADDR = addressOf(btc.p2wpkh(dummyPublicKey, btc.NETWORK));
const CAT_ID = `${'01'.repeat(32)}i0`;
const INSCRIPTION_ID = `${'ab'.repeat(32)}i0`;

/** A coin carrying a NAMED inscription, in the production port's object form. */
const NAMED: UtxoClassification = {
  verdict: 'has-assets',
  assets: { inscriptionIds: [INSCRIPTION_ID], runeNames: [], catIds: [], rareSat: null },
};

function ctx(): Cat21AccountContext {
  return {
    paymentAddress: PAYMENT_ADDR,
    paymentPublicKey: hex.encode(accountKey),
    ordinalsAddress: ORDINALS_ADDR,
    ordinalsPublicKey: hex.encode(dummyPublicKey),
    network: 'mainnet',
  };
}

/** The cat at the account's ordinals address (546 sats, fixed at mint). */
const CAT_UTXO = {
  txid: 'fe'.repeat(32),
  vout: 0,
  value: 546,
  scriptPubKey: p2trOrdinals.script,
};

/** A funding coin; `id` must be a hex digit (it is repeated into the txid). */
function coin(id: string, value: number): CoreFundingUtxo {
  return { txid: id.repeat(64).slice(0, 64), vout: 0, value };
}

/**
 * The preview reads only the account context, the funding UTXOs, the scan and
 * the cat resolver. Every signing / broadcast dep is a bare spy the preview
 * must never reach (it simulates, it does not sign).
 */
function previewDeps(
  coins: CoreFundingUtxo[],
  classify: (outpoint: string) => Promise<UtxoClassification> = () => Promise.resolve('clean'),
  resolveCatUtxo: Cat21RpcDeps['resolveCatUtxo'] = () => CAT_UTXO,
  account: Cat21AccountContext = ctx()
) {
  return {
    getAccountContext: () => account,
    agentMode: { enabled: false },
    evaluateAgentPolicy: () => ({ allowed: true as const }),
    // A snapshot at call time, like a real UTXO read: coins added after a query
    // ran are not visible to that query.
    spendableUtxos: () => Promise.resolve([...coins]),
    classifyOutpoint: classify,
    resolveCatUtxo: vi.fn(resolveCatUtxo),
    signWithConfirmation: vi.fn(),
    confirmListingPublication: vi.fn(),
    validateBuyOfferPsbt: vi.fn(),
    signSilently: vi.fn(),
    signBuyOfferInputs: vi.fn(),
    broadcast: vi.fn(),
    postBid: vi.fn(),
    recordSpend: vi.fn(),
  } satisfies Cat21RpcDeps;
}

const MINT: Cat21MintIntent = { recipient: OTHER_ADDR, feeRate: 5 };
const TRANSFER: Cat21TransferIntent = { catId: CAT_ID, recipient: OTHER_ADDR, feeRate: 5 };
const BUY: Cat21BuyIntent = {
  catId: CAT_ID,
  catNumber: 42,
  bidSats: 21_000,
  sellerPaymentAddress: OTHER_ADDR,
  feeRate: 5,
};

describe('fundingPreviewApplies', () => {
  it('applies to manual mint, transfer and buy', () => {
    expect(fundingPreviewApplies(MINT)).toBe(true);
    expect(fundingPreviewApplies(TRANSFER)).toBe(true);
    expect(fundingPreviewApplies(BUY)).toBe(true);
    expect(fundingPreviewApplies({ ...BUY, mode: 'manual' })).toBe(true);
  });

  it('does not apply to autonomous intents, listings, accepts, or no intent', () => {
    expect(fundingPreviewApplies({ ...TRANSFER, mode: 'autonomous' })).toBe(false);
    expect(fundingPreviewApplies({ ...BUY, mode: 'autonomous' })).toBe(false);
    const listing: Cat21CreateOfferIntent = {
      catId: CAT_ID,
      priceSats: 10_000,
      paymentAddress: PAYMENT_ADDR,
    };
    expect(fundingPreviewApplies(listing)).toBe(false);
    const accept: Cat21AcceptOfferIntent = {
      offerPsbt: 'cHNidP8=',
      expectedCatId: CAT_ID,
      expectedPriceSats: 10_000,
      expectedSellerUtxo: { txid: CAT_UTXO.txid, vout: 0 },
    };
    expect(fundingPreviewApplies(accept)).toBe(false);
    expect(fundingPreviewApplies(undefined)).toBe(false);
  });
});

describe('simulateFundingPreview', () => {
  it('transfer: a named-asset-only fee coin previews asset-notice, names the asset, returns the coin to pin', async () => {
    const asset = coin('d', 100_000);
    const d = previewDeps([asset], () => Promise.resolve(NAMED));
    const state = await simulateFundingPreview(TRANSFER, d);
    expect(state).toMatchObject({ status: 'asset-notice', fundingUtxo: { txid: asset.txid } });
    if (!('assets' in state)) throw new Error('expected a resolved preview');
    expect(state.assets?.inscriptionIds).toEqual([INSCRIPTION_ID]);
    // It resolved THIS cat (the transfer's own input 0), not a mint's nothing.
    expect(d.resolveCatUtxo).toHaveBeenCalledWith(CAT_ID);
  });

  it('SEAM: the coin the route pins carries what the notice showed (bucket + named assets), for mint, transfer and buy', async () => {
    // The SDK honours a pin only while the coin carries nothing beyond the
    // bucket and assets it was pinned with; a bare outpoint of an asset coin is
    // refused `contents-changed`. So the preview must hand the ANNOTATED coin
    // through `fundingPreviewCoin` to the route. If the annotation were lost
    // (e.g. the preview copied only txid/vout/value), every manual
    // notice-and-proceed would fail closed while each unit stayed green.
    for (const intent of [MINT, TRANSFER, BUY]) {
      const asset = coin('d', 100_000);
      const state = await simulateFundingPreview(
        intent,
        previewDeps([asset], () => Promise.resolve(NAMED))
      );
      expect(fundingPreviewCoin(state)).toMatchObject({
        txid: asset.txid,
        bucket: 'assets',
        assets: { inscriptionIds: [INSCRIPTION_ID] },
      });
    }
  });

  it('transfer and buy: an unresolvable cat previews not-applicable, leaving the typed denial to the service', async () => {
    // The service resolves the same cat before any funding and refuses with
    // cat-utxo-resolve-failed ("This cat could not be loaded."), so no coin can
    // be spent; the preview must not hold the CTA behind a scan-failure message.
    // A transfer or buy that fell through to the mint simulate would preview
    // `ready` here instead.
    for (const intent of [TRANSFER, BUY]) {
      const d = previewDeps([coin('c', 100_000)], undefined, () => {
        throw new Error('cat-data-not-loaded');
      });
      expect(await simulateFundingPreview(intent, d)).toEqual({ status: 'not-applicable' });
      expect(d.resolveCatUtxo).toHaveBeenCalledWith(CAT_ID);
    }
  });

  it('buy: covers price + cat + fee, so a coin that funds a mint but not the bid previews insufficient', async () => {
    // 10_000 sats covers a mint (546 + fee) but not a 21_000 bid + 546 cat + fee.
    // A buy that fell through to the mint simulate would preview `ready` here.
    const small = coin('5', 10_000);
    const state = await simulateFundingPreview(BUY, previewDeps([small]));
    expect(state.status).toBe('insufficient');
    const mintState = await simulateFundingPreview(MINT, previewDeps([small]));
    expect(mintState).toMatchObject({ status: 'ready', fundingUtxo: { txid: small.txid } });
  });

  it('buy: a named-asset-only buyer coin previews asset-notice from the BUYER coin, returned to pin', async () => {
    const asset = coin('d', 100_000);
    const d = previewDeps([asset], () => Promise.resolve(NAMED));
    const state = await simulateFundingPreview(BUY, d);
    expect(state).toMatchObject({ status: 'asset-notice', fundingUtxo: { txid: asset.txid } });
    if (!('assets' in state)) throw new Error('expected a resolved preview');
    expect(state.assets?.inscriptionIds).toEqual([INSCRIPTION_ID]);
    expect(d.resolveCatUtxo).toHaveBeenCalledWith(CAT_ID);
  });

  it('mint: a clean coin previews ready and returns it to pin, with no cat lookup', async () => {
    const clean = coin('c', 100_000);
    const d = previewDeps([clean]);
    const state = await simulateFundingPreview(MINT, d);
    expect(state).toMatchObject({
      status: 'ready',
      assets: null,
      fundingUtxo: { txid: clean.txid },
    });
    expect(d.resolveCatUtxo).toHaveBeenCalledTimes(0);
  });

  it('ONE-ADDRESS wallet: an asset-only coin previews expert-required with no coin to pin, for transfer and buy', async () => {
    // payment === ordinals: the HQ table's DISABLED row. The CTA is held
    // (`isApproveBlocked` on expert-required) and nothing is pinned, so the
    // service runs under the `'refuse'` policy too.
    const oneAddress: Cat21AccountContext = {
      ...ctx(),
      ordinalsAddress: PAYMENT_ADDR,
      ordinalsPublicKey: hex.encode(accountKey),
    };
    const oneAddressCat = { ...CAT_UTXO, scriptPubKey: btc.p2wpkh(accountKey, btc.NETWORK).script };
    for (const intent of [TRANSFER, BUY]) {
      const d = previewDeps(
        [coin('d', 100_000)],
        () => Promise.resolve(NAMED),
        () => oneAddressCat,
        oneAddress
      );
      const state = await simulateFundingPreview(intent, d);
      expect(state).toMatchObject({ status: 'expert-required', fundingUtxo: null });
    }
  });

  it('ONE-ADDRESS wallet: the blocked preview carries the cause and NAMES the recommended coin’s assets', async () => {
    // The justification half of the block above: the notice can only name the
    // assets if the preview hands them over with the SDK's cause.
    const oneAddress: Cat21AccountContext = {
      ...ctx(),
      ordinalsAddress: PAYMENT_ADDR,
      ordinalsPublicKey: hex.encode(accountKey),
    };
    const oneAddressCat = { ...CAT_UTXO, scriptPubKey: btc.p2wpkh(accountKey, btc.NETWORK).script };
    for (const intent of [MINT, TRANSFER, BUY]) {
      const d = previewDeps(
        [coin('d', 100_000)],
        () => Promise.resolve(NAMED),
        () => oneAddressCat,
        oneAddress
      );
      const state = await simulateFundingPreview(intent, d);
      expect(state).toMatchObject({ status: 'expert-required', cause: 'named-assets' });
      if (!('assets' in state)) throw new Error('expected a resolved preview');
      expect(state.assets?.inscriptionIds).toEqual([INSCRIPTION_ID]);
    }
  });

  it('a covering coin whose assets the scan did not name previews expert-required with cause unnamed-assets', async () => {
    const d = previewDeps([coin('d', 100_000)], () => Promise.resolve('has-assets'));
    const state = await simulateFundingPreview(TRANSFER, d);
    expect(state).toMatchObject({
      status: 'expert-required',
      cause: 'unnamed-assets',
      assets: null,
    });
  });

  it('autonomous transfer is not-applicable even when called directly', async () => {
    const state = await simulateFundingPreview(
      { ...TRANSFER, mode: 'autonomous' },
      previewDeps([coin('c', 100_000)])
    );
    expect(state).toEqual({ status: 'not-applicable' });
  });
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useCat21FundingPreview', () => {
  it('holds a transfer preview at loading while the cat loads, then previews it once the cat lands', async () => {
    let catLoaded = false;
    const deps = previewDeps([coin('c', 100_000)], undefined, () => {
      if (!catLoaded) throw new Error('cat-data-not-loaded');
      return CAT_UTXO;
    });
    const { result, rerender } = renderHook(
      ({ catLoading }) => useCat21FundingPreview(TRANSFER, deps, false, catLoading),
      { wrapper: wrapper(), initialProps: { catLoading: true } }
    );
    expect(result.current).toEqual({ status: 'loading' });

    catLoaded = true;
    rerender({ catLoading: false });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(deps.resolveCatUtxo).toHaveBeenCalledTimes(1);
  });

  it('holds a mint preview at loading while the funding UTXOs load, then previews the funded wallet', async () => {
    // While the UTXO query loads, the spendable set reads empty. The stub reads
    // this array at call time, so pushing the coin is the query landing; a
    // preview that ran before it would have cached `insufficient`.
    const coins: CoreFundingUtxo[] = [];
    const deps = previewDeps(coins);
    const { result, rerender } = renderHook(
      ({ fundingLoading }) => useCat21FundingPreview(MINT, deps, fundingLoading, false),
      { wrapper: wrapper(), initialProps: { fundingLoading: true } }
    );
    expect(result.current).toEqual({ status: 'loading' });

    coins.push(coin('c', 100_000));
    rerender({ fundingLoading: false });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('is not-applicable for an autonomous transfer (no dialog, no simulate)', () => {
    const deps = previewDeps([coin('c', 100_000)]);
    const { result } = renderHook(
      () => useCat21FundingPreview({ ...TRANSFER, mode: 'autonomous' }, deps, false, false),
      { wrapper: wrapper() }
    );
    expect(result.current).toEqual({ status: 'not-applicable' });
  });
});
