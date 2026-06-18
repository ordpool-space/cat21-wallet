import { useMemo } from 'react';
import { useStore } from 'react-redux';

import * as btc from '@scure/btc-signer';
import { Network, broadcastCat21, validateCat21BuyOfferPsbt } from 'ordpool-sdk/core';

import { useBitcoinClient } from '@app/query/bitcoin/clients/bitcoin-client';
import { useCurrentNativeSegwitUtxos } from '@app/query/bitcoin/utxos/utxos.hooks';
import { type RootState, useAppDispatch } from '@app/store';
import { useCurrentAccountId } from '@app/store/accounts/account';
import { useNativeSegwitAccountIndexAddressIndexZero } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';
import { accountIdToSliceKey } from '@app/store/agent-policy/agent-policy.hooks';
import { incrementSpentToday } from '@app/store/agent-policy/agent-policy.slice';
import { useCurrentNetwork } from '@app/store/networks/networks.selectors';
import { makeAgentPolicyDeps } from '@background/cat21/agent-policy-deps';
import { makeWiringPendingDeps } from '@background/cat21/cat21-dispatcher';
import type { Cat21RpcDeps } from '@background/cat21/cat21-rpc.service';

/**
 * Build the popup-side `Cat21RpcDeps` for `Cat21RpcService`. Slices that
 * have a real wiring chain are wired here; everything else falls through
 * to `makeWiringPendingDeps()` so the corresponding service method
 * surfaces a typed `wiring-pending` denial.
 *
 * Currently wired:
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
 *
 * Wiring-pending (returns the iter-9 stub for each):
 *   - resolveCatUtxo — cat21-ord query for the wallet's cat-bearing UTXO
 *   - confirmListingPublication — offer-creation UI flow
 *   - signWithConfirmation / signSilently — keychain signers
 *
 * Hooks are read at render time; the returned deps object is memoised
 * so `service.mint()` etc. see a stable reference. `getState` reads
 * the latest store snapshot on every dep call (not via React subscription)
 * so an account switch / policy edit that happens *during* a long
 * sign-then-broadcast roundtrip is reflected by the next dep invocation.
 */
export function useCat21RpcDeps(): Cat21RpcDeps {
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

  return useMemo<Cat21RpcDeps>(() => {
    const wiringPending = makeWiringPendingDeps();
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
      getAccountContext: () => ({
        paymentAddress: paymentAddress ?? '',
        network: networkLabel,
      }),
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
          network: args.network === 'mainnet' ? Network.Mainnet : Network.Testnet3,
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
      // First UTXO in the available bucket with sufficient value, plus
      // the scriptPubKey decoded from the UTXO's address (native segwit
      // P2WPKH for the current account). The keychain payer-based
      // derivation lives behind `useNativeSegwitPayer`; until that's
      // wired here, the address → script path is enough for the SDK
      // mint builder to construct a valid witness UTXO.
      pickFundingUtxo: requiredSats => {
        const available = utxoQuery.isLoading ? [] : utxoQuery.utxos.available;
        const picked = available.find(u => u.value >= requiredSats);
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
      // ---- Still wiring-pending (one slice each lands later) ----
      resolveCatUtxo: wiringPending.resolveCatUtxo,
      confirmListingPublication: wiringPending.confirmListingPublication,
      signWithConfirmation: wiringPending.signWithConfirmation,
      signSilently: wiringPending.signSilently,
    };
  }, [store, dispatch, paymentAddress, networkLabel, accountKey, bitcoinClient, utxoQuery]);
}
