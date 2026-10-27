/**
 * Production factory for the three read-only NMH probe callbacks
 * (`listCatsAtActiveAccount`, `readWalletStatus`, `readCat21OrdStatus`)
 * that `attachNativeHostToPopupRelay` consumes. Bridges between:
 *
 *   - cat21-ord HTTPS (via the inversify-DI'd `Cat21OrdApiClient`
 *     from `@leather.io/services`)
 *   - Redux store (via a `getState()` callback the background
 *     entrypoint passes in)
 *
 * Why a factory: the wallet's Redux store and the cat21-ord client
 * both need to exist before the NMH attach happens, but the
 * background entrypoint is the only place that has both. Encoding
 * the wiring once here keeps the entrypoint thin and the probe
 * handler dependency-injected.
 *
 * Lazy reads on every call: the active account / network / agent-
 * mode flag can change while the wallet is open (account switch,
 * settings toggle). The factory captures only the `getState`
 * callback; each probe re-reads. The cat21-ord client is held by
 * reference because its DI'd instance never changes.
 *
 * Failure modes:
 *
 *   - cat21-ord unreachable → `fetchAddressCat21s`/`fetchStatus`
 *     reject. The probe handler catches and encodes the error
 *     inline on the payload, so the agent learns the probe failed
 *     rather than confusing empty data with "no cats".
 *   - active-account address not yet resolved (wallet still
 *     booting) → `getActiveAccountAddress` returns `undefined`,
 *     and we resolve `listCatsAtActiveAccount` to `[]`. The agent
 *     can re-poll via `wallet_status` to learn when the wallet is
 *     ready.
 */
import { type Cat21OrdApiClient } from '@leather.io/services';

/**
 * Subset of the wallet's Redux state shape we read for the probe
 * answers. Kept narrow on purpose — the background entrypoint
 * widens to the real RootState before passing the getState
 * callback in.
 */
// HACK -- Cat21: removed `export` (caller passes inline; restore on broader use). HARD RULE #5.
interface ProbeStateLike {
  network: 'mainnet' | 'testnet';
  /** `${fingerprint}:${accountIndex}` (matches accountIdToSliceKey). */
  accountId: string;
  /** Active-account native-segwit address; undefined if not yet derived. */
  activeAccountAddress: string | undefined;
  /** Per-account agent-mode flag from the iter-10 agent-policy slice. */
  agentModeEnabled: boolean;
}

interface MakeProbeWiresArgs {
  /** Reads the wallet's current state at call time. */
  getState(): ProbeStateLike;
  /** DI'd cat21-ord HTTP client (constant reference across calls). */
  cat21OrdClient: Pick<Cat21OrdApiClient, 'fetchAddressCat21s' | 'fetchStatus'>;
}

/**
 * Build the `readOnlyProbes` deps object the relay attach expects.
 * Each callback is a thin shim over the wallet's existing client +
 * store. The shape returned matches `AttachArgs['readOnlyProbes']`
 * in `attach-native-host-to-popup-relay.ts`.
 */
export function makeReadOnlyProbeWires(args: MakeProbeWiresArgs): {
  listCatsAtActiveAccount(): Promise<string[]>;
  readWalletStatus(): {
    network: 'mainnet' | 'testnet';
    accountId: string;
    agentMode: { enabled: boolean };
  };
  readCat21OrdStatus(): Promise<{ reachable: boolean; height?: number; cats?: number }>;
} {
  return {
    async listCatsAtActiveAccount() {
      const state = args.getState();
      if (state.activeAccountAddress == null) return [];
      const result = await args.cat21OrdClient.fetchAddressCat21s(state.activeAccountAddress);
      return result.cats;
    },
    readWalletStatus() {
      const state = args.getState();
      return {
        network: state.network,
        accountId: state.accountId,
        agentMode: { enabled: state.agentModeEnabled },
      };
    },
    async readCat21OrdStatus() {
      try {
        const status = await args.cat21OrdClient.fetchStatus();
        return { reachable: true, height: status.height, cats: status.cats };
      } catch {
        return { reachable: false };
      }
    },
  };
}
