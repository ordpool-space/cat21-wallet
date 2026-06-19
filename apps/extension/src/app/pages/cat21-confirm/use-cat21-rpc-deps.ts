import { useMemo } from 'react';
import { useStore } from 'react-redux';

import * as btc from '@scure/btc-signer';
import { useQuery } from '@tanstack/react-query';
import {
  type AgentActionKind,
  CAT21_POSTAGE_SATS,
  broadcastCat21,
  pickLargestFundingUtxoThatCovers,
  validateCat21BuyOfferPsbt,
} from 'ordpool-sdk/core';

import { getCat21OrdApiClient } from '@leather.io/services';

import { useBitcoinClient } from '@app/query/bitcoin/clients/bitcoin-client';
import { useCurrentNativeSegwitUtxos } from '@app/query/bitcoin/utxos/utxos.hooks';
import { type RootState, useAppDispatch } from '@app/store';
import { useCurrentAccountId } from '@app/store/accounts/account';
import { useSignBitcoinTx } from '@app/store/accounts/blockchain/bitcoin/bitcoin.hooks';
import { useNativeSegwitAccountIndexAddressIndexZero } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';
import { accountIdToSliceKey } from '@app/store/agent-policy/agent-policy.hooks';
import { selectAgentPolicyForAccount } from '@app/store/agent-policy/agent-policy.selectors';
import { incrementSpentToday } from '@app/store/agent-policy/agent-policy.slice';
import { useCurrentNetwork } from '@app/store/networks/networks.selectors';
import { makeAgentPolicyDeps } from '@background/cat21/agent-policy-deps';
import {
  type Cat21RpcDeps,
  walletNetworkToSdkNetwork,
} from '@background/cat21/cat21-rpc.service';

/**
 * Build the popup-side `Cat21RpcDeps` for `Cat21RpcService`. Every
 * dep on the interface now has a real wiring chain — the popup runs
 * the full mint / transfer / create-offer / accept-offer pipelines
 * against Leather's keychain + electrs + mempool layers.
 *
 * Wired deps:
 *   - `getAccountContext()` — current account's native-segwit address
 *     (index 0) and the active network's mainnet/testnet flag
 *   - `agentMode.enabled` — reads the per-account policy from the store
 *   - `evaluateAgentPolicy(intent)` — `makeAgentPolicyDeps` factory from
 *     iter 10
 *   - `recordSpend(sats)` — dispatches `incrementSpentToday` so the
 *     daily cap survives across messages
 *   - `validateBuyOfferPsbt(args)` — pure SDK call; the deps arg shape
 *     mirrors the SDK input one-to-one, only the network string ↔ enum
 *     translation is local
 *   - `broadcast(signedTx)` — SDK's `broadcastCat21` decides
 *     mempool-vs-slipstream by weight; mempool path goes through
 *     Leather's existing `transactionsApi.broadcastTransaction`
 *   - `pickFundingUtxo(requiredSats)` — first available native-segwit
 *     UTXO with value ≥ requiredSats, scriptPubKey decoded from the
 *     UTXO's address via @scure/btc-signer
 *   - `resolveCatUtxo(catId)` — synchronous lookup against a React-
 *     Query-cached `/cat/<id>` response that the popup pre-fetches via
 *     the `catIdHint` argument. Returns a 546-sat `Cat21TransferCatInput`
 *     with `txid`/`vout` parsed out of `satpoint` and `scriptPubKey`
 *     decoded from the cat's current `address`.
 *   - `confirmListingPublication()` — resolves immediately. The popup
 *     IS the user's listing-publish consent: the dialog they clicked
 *     to land here already named the cat, the price, and the seller
 *     payment address. A second prompt would be pure ceremony in
 *     Path 2; in Path 3 the service skips this callback entirely.
 *   - `signWithConfirmation` / `signSilently` — both route to Leather's
 *     `useSignBitcoinTx()` for software wallets, `ledgerNavigate` for
 *     Ledger. `'all' | number[]` input-indexes map to its
 *     `undefined | number[]` convention. Signed tx is finalised then
 *     handed back as `{ hex, weight }`.
 *
 * Hooks are read at render time; the returned deps object is memoised
 * so `service.mint()` etc. see a stable reference. `getState` reads
 * the latest store snapshot on every dep call (not via React subscription)
 * so an account switch / policy edit that happens *during* a long
 * sign-then-broadcast roundtrip is reflected by the next dep invocation.
 *
 * `catIdHint` is the cat id the popup is about to act on, taken from
 * the intent (`catId` for transfer / createOffer, `expectedCatId` for
 * acceptOffer). When set, the hook pre-fetches the cat from cat21-ord
 * so `resolveCatUtxo` can answer synchronously. Mint flows omit it.
 */
export function useCat21RpcDeps(catIdHint?: string): Cat21RpcDeps {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const currentAccount = useCurrentAccountId();
  const paymentAddress = useNativeSegwitAccountIndexAddressIndexZero(currentAccount);
  const network = useCurrentNetwork();
  const networkLabel: 'mainnet' | 'testnet' =
    network.chain.bitcoin.mode === 'mainnet' ? 'mainnet' : 'testnet';
  const accountKey = accountIdToSliceKey(currentAccount);
  const bitcoinClient = useBitcoinClient();
  const utxoQuery = useCurrentNativeSegwitUtxos();

  // Pre-fetch the cat the popup is about to act on. The service-side
  // `resolveCatUtxo` is synchronous by contract (the rpc-service spec
  // stubs are sync); we close over the React-Query cache so the closure
  // can answer without awaiting. `enabled: !!catIdHint` keeps mint
  // popups from issuing the query at all.
  const signBitcoinTx = useSignBitcoinTx();
  const cat21OrdClient = getCat21OrdApiClient();
  const catQuery = useQuery({
    queryKey: ['cat21-ord-cat', catIdHint],
    queryFn: () => cat21OrdClient.fetchCat21(catIdHint as string),
    enabled: catIdHint != null,
    staleTime: 30_000,
  });

  return useMemo<Cat21RpcDeps>(() => {
    const agentPolicy = makeAgentPolicyDeps({
      getState: () => store.getState(),
      dispatch: action => {
        // The deps factory's dispatch type is narrow on
        // incrementSpentToday; runtime is plain redux dispatch.
        dispatch(action);
      },
      accountId: accountKey,
      dayKeyFn: () => new Date().toISOString().slice(0, 10),
    });

    return {
      // ---- Real wires ----
      getAccountContext: () => {
        const policy = selectAgentPolicyForAccount(store.getState(), accountKey);
        return {
          paymentAddress: paymentAddress ?? '',
          network: networkLabel,
          allowedOperations: stripCat21Prefix(policy?.allowedOperations),
        };
      },
      agentMode: agentPolicy.agentMode,
      evaluateAgentPolicy: agentPolicy.evaluateAgentPolicy,
      recordSpend: sats => {
        dispatch(
          incrementSpentToday({
            accountId: accountKey,
            sats,
            dayKey: new Date().toISOString().slice(0, 10),
          })
        );
      },
      // Pure SDK call. The deps interface mirrors the SDK arg shape
      // exactly; we just translate the wallet's 'mainnet'|'testnet'
      // string into the SDK's Network enum.
      validateBuyOfferPsbt: args =>
        validateCat21BuyOfferPsbt({
          psbt: args.psbt,
          expectedSellerUtxo: args.expectedSellerUtxo,
          floorPriceSats: args.floorPriceSats,
          expectedSellerPaymentAddress: args.expectedSellerPaymentAddress,
          network: walletNetworkToSdkNetwork(args.network),
        }),
      // Wallet-routed broadcast via Leather's existing
      // `transactionsApi.broadcastTransaction` (which the wallet
      // points at api.ordpool.space / mempool.space / blockstream.info
      // per its current routing). Channel-decision delegated to the
      // SDK's `broadcastCat21` so oversize CAT-21 txs route to
      // Slipstream automatically.
      broadcast: async signedTx => {
        const result = await broadcastCat21(
          { hex: signedTx.hex, weight: signedTx.weight },
          async (hex: string) => {
            const resp = await bitcoinClient.transactionsApi.broadcastTransaction(hex);
            if (!resp.ok) {
              throw new Error(`broadcast HTTP ${resp.status}: ${await resp.text()}`);
            }
            return await resp.text();
          }
        );
        return { txid: result.txid, channel: result.channel };
      },
      // SDK-canonical coin selection. `pickLargestFundingUtxoThatCovers`
      // is the SDK's default strategy (see its JSDoc): highest mint-
      // success probability at high fee rates, defragments the wallet
      // over time, avoids sub-dust change absorption. First-fit (which
      // this used to do) hits exactly those failure modes.
      //
      // scriptPubKey is decoded from the picked UTXO's address (native
      // segwit P2WPKH for the current account). The keychain payer-
      // based derivation lives behind `useNativeSegwitPayer`; the
      // address → script path is enough for the SDK mint builder to
      // construct a valid witness UTXO.
      pickFundingUtxo: requiredSats => {
        const available = utxoQuery.isLoading ? [] : utxoQuery.utxos.available;
        const picked = pickLargestFundingUtxoThatCovers({
          utxos: available,
          targetSpendSats: requiredSats,
        });
        if (!picked) {
          throw new Error(
            `no available UTXO of >= ${requiredSats} sats (have ${available.length})`
          );
        }
        const scureNetwork = networkLabel === 'mainnet' ? btc.NETWORK : btc.TEST_NETWORK;
        const scriptPubKey = btc.OutScript.encode(btc.Address(scureNetwork).decode(picked.address));
        return {
          txid: picked.txid,
          vout: picked.vout,
          value: picked.value,
          scriptPubKey,
        };
      },
      // Synchronous answer from the React-Query cache populated by the
      // hook above. Throws (caught one frame up as
      // `intent-invariant-violated: cat-utxo-resolve-failed: …`) if:
      //   - the popup wasn't constructed with this catId in its hint
      //     (defensive: caller-asserted catId mismatch),
      //   - the query hasn't resolved yet (popup opened, user clicked
      //     before the cat fetch returned),
      //   - the query errored,
      //   - cat21-ord returned a cat without an address (unconfirmed
      //     or already-spent UTXO),
      //   - the satpoint failed to parse into txid:vout.
      // CAT21_POSTAGE_SATS is the protocol-pinned 546; ord doesn't
      // emit the UTXO value on `/cat/<id>` and a cat-bearing UTXO is
      // always exactly 546 sats by HARD RULE — no need to round-trip
      // through `/output/<outpoint>` for the value.
      resolveCatUtxo: catId => {
        if (catIdHint == null || catId !== catIdHint) {
          throw new Error(
            `catId mismatch: hook hint ${catIdHint ?? '<none>'}, service asked for ${catId}`
          );
        }
        if (catQuery.error) throw catQuery.error;
        if (!catQuery.data) throw new Error('cat-data-not-loaded');
        const cat = catQuery.data;
        if (!cat.address) {
          throw new Error('cat21-ord returned cat without address');
        }
        const [txid, voutStr] = cat.satpoint.split(':');
        const vout = Number(voutStr);
        if (!txid || Number.isNaN(vout)) {
          throw new Error(`malformed satpoint: ${cat.satpoint}`);
        }
        const scureNetwork = networkLabel === 'mainnet' ? btc.NETWORK : btc.TEST_NETWORK;
        const scriptPubKey = btc.OutScript.encode(btc.Address(scureNetwork).decode(cat.address));
        return {
          txid,
          vout,
          value: CAT21_POSTAGE_SATS,
          scriptPubKey,
        };
      },
      // The popup dialog the user clicked Confirm on already states
      // the cat, price, and payment address — it IS the consent. No
      // second prompt; resolve immediately so the service moves on
      // to building the listing. Autonomous mode skips the callback
      // upstream in cat21-rpc.service.ts.
      confirmListingPublication: () => Promise.resolve(),
      // Signer wiring: both `signWithConfirmation` and `signSilently`
      // route to Leather's existing `useSignBitcoinTx()` here, which
      // dispatches to the keychain (software wallet) or the
      // multi-step Ledger flow per `whenWallet({ software, ledger })`.
      //
      // In popup context, the user already approved at the parent
      // dialog level, so the two paths converge — `signWithConfirmation`
      // doesn't show an extra prompt and `signSilently` doesn't need
      // to skip one. The mode-resolver still gates which one the
      // service picks: the popup transport forces `'manual'`, so
      // `signSilently` is effectively unreachable from Path 2 today.
      // Path 3 (NMH-driven autonomous) is the genuine `signSilently`
      // caller and lands later via the background NMH listener.
      //
      // `inputIndexes === 'all'` is signalled to `useSignBitcoinTx` as
      // `undefined` (its convention for "sign every input"); a numeric
      // array passes through verbatim. After signing, `finalize()`
      // assembles witness data into the tx; `hex` + `weight` go to
      // the service for broadcast-channel decision and submission.
      signWithConfirmation: async (psbt, _intent, inputIndexes) => {
        const inputsToSign = inputIndexes === 'all' ? undefined : inputIndexes;
        const signedTx = await signBitcoinTx(psbt, inputsToSign);
        signedTx.finalize();
        return { hex: signedTx.hex, weight: signedTx.weight };
      },
      signSilently: async (psbt, inputIndexes) => {
        const inputsToSign = inputIndexes === 'all' ? undefined : inputIndexes;
        const signedTx = await signBitcoinTx(psbt, inputsToSign);
        signedTx.finalize();
        return { hex: signedTx.hex, weight: signedTx.weight };
      },
    };
    // tanstack-query returns a fresh result object on every render even
    // when the data didn't change. Depend on the load-bearing fields
    // (data + isLoading) so a stable query-result identity-change
    // doesn't rebuild the deps and re-create the agent-policy gate.
  }, [
    store,
    dispatch,
    paymentAddress,
    networkLabel,
    accountKey,
    bitcoinClient,
    utxoQuery.utxos,
    utxoQuery.isLoading,
    signBitcoinTx,
    catIdHint,
    catQuery.data,
    catQuery.error,
  ]);
}

/**
 * Translate the agent-policy's `cat21_*` operation kinds to the bare
 * names the SDK structural gate's `Cat21OperationGateConfig.allowedOperations`
 * uses (`'mint' | 'transfer' | 'create_offer' | 'accept_offer'`). The
 * two layers of the SDK chose different conventions; this is the
 * single seam where the prefix is stripped.
 *
 * Returns `undefined` (not an empty array) when the source field is
 * missing OR empty so `gateConfig` can spread-conditionally and omit
 * the `allowedOperations` key entirely (the SDK treats unset and
 * empty array as equivalently permissive, but omitting reads cleaner).
 */
type SdkGateOperationKind = 'mint' | 'transfer' | 'create_offer' | 'accept_offer';

function stripCat21Prefix(
  source: ReadonlyArray<AgentActionKind> | undefined,
): ReadonlyArray<SdkGateOperationKind> | undefined {
  if (!source || source.length === 0) return undefined;
  return source.map(k => k.slice('cat21_'.length) as SdkGateOperationKind);
}
