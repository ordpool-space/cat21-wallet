import { useMemo } from 'react';
import { useStore } from 'react-redux';

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
 *
 * Wiring-pending (returns the iter-9 stub for each):
 *   - pickFundingUtxo / resolveCatUtxo — UTXO query layer
 *   - confirmListingPublication — offer-creation UI flow
 *   - validateBuyOfferPsbt — SDK call (cheap to wire next)
 *   - signWithConfirmation / signSilently — keychain signers
 *   - broadcast — mempool/electrs POST
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
      // ---- Still wiring-pending (one slice each lands later) ----
      pickFundingUtxo: wiringPending.pickFundingUtxo,
      resolveCatUtxo: wiringPending.resolveCatUtxo,
      confirmListingPublication: wiringPending.confirmListingPublication,
      validateBuyOfferPsbt: wiringPending.validateBuyOfferPsbt,
      signWithConfirmation: wiringPending.signWithConfirmation,
      signSilently: wiringPending.signSilently,
      broadcast: wiringPending.broadcast,
    };
  }, [store, dispatch, paymentAddress, networkLabel, accountKey]);
}
