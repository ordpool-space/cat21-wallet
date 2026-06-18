/**
 * Background-entrypoint glue for the cat21 NMH agent surface.
 * Bundles the four iter-12+14 modules into a single function the
 * extension's background script calls at boot:
 *
 *   - `createNmhLifecycle` (iter 14e) owns the connectNative port
 *     lifecycle: idempotent connect, backoff reconnect on
 *     disconnect, install-detection give-up heuristic.
 *
 *   - `attachNativeHostToPopupRelay` (iter 12+14) gets called by
 *     the lifecycle's `attach` callback on every fresh port. It
 *     routes inbound messages: read-only probes inline,
 *     mutating cat21_* through the popup-side Cat21RpcService.
 *
 *   - `makeReadOnlyProbeWires` (iter 14d) produces the three
 *     read-only probe callbacks from the wallet's Redux state +
 *     cat21OrdClient.
 *
 *   - `triggerRequestPopupWindowOpen` (Leather upstream) is the
 *     mechanism the relay calls to open the popup with the
 *     stashed-intent URL.
 *
 * The background entrypoint passes:
 *
 *   - the `chrome.runtime.connectNative` callable
 *   - a thin `chrome.storage.session` adapter
 *   - `chrome.runtime.onMessage` (`add/removeListener`)
 *   - a function that reads the wallet's Redux state (the
 *     background-side getState — likely a thin wrapper over
 *     `chrome.storage.local` for the redux-persist'd slices)
 *   - the DI'd `Cat21OrdApiClient` via getCat21OrdApiClient
 *   - the `triggerRequestPopupWindowOpen` import
 *
 * Why a separate module: keeps the background entrypoint
 * (`background.ts`) a thin three-line call site and makes the wire-
 * up testable end-to-end without rendering the whole extension
 * boot path.
 */
import { type RouteUrls } from '@shared/route-urls';

import { attachNativeHostToPopupRelay } from './attach-native-host-to-popup-relay';
import { createNmhLifecycle } from './nmh-connection-lifecycle';
import { type SessionStorageLike } from './popup-bridge';

const CAT21_NMH_APPLICATION_NAME = 'space.cat21.wallet';

/**
 * Background-resident wallet state the read-only probes need. The
 * entrypoint computes this from `chrome.storage.local` + the
 * wallet's existing background-side helpers; this module stays
 * agnostic to where the values come from so specs can drive the
 * whole agent surface with in-memory state.
 */
// HACK -- Cat21: removed `export` (callers pass inline; restore on broader use). HARD RULE #5.
interface BackgroundProbeState {
  network: 'mainnet' | 'testnet';
  accountId: string;
  activeAccountAddress: string | undefined;
  agentModeEnabled: boolean;
}

/**
 * Read-only probe wires shape — copied here from
 * `make-read-only-probe-wires.ts` to avoid the dep just to lift
 * the type. (The factory itself lives there and is what
 * production callers use; this module is the glue that hands the
 * resulting wires to the attach.)
 */
// HACK -- Cat21: removed `export` (mirrors AttachArgs.readOnlyProbes; consumers pass inline). HARD RULE #5.
interface ReadOnlyProbeWiresLike {
  listCatsAtActiveAccount(): Promise<string[]>;
  readWalletStatus(): {
    network: 'mainnet' | 'testnet';
    accountId: string;
    agentMode: { enabled: boolean };
  };
  readCat21OrdStatus(): Promise<{ reachable: boolean; height?: number; cats?: number }>;
}

/**
 * What the background entrypoint passes in. Every Chrome surface
 * is dependency-injected so specs drive the wire without a real
 * `chrome.*` global.
 */
// HACK -- Cat21: removed `export` (parameter shape; consumers pass inline). HARD RULE #5.
interface InstallCat21NmhAgentArgs {
  /** `chrome.runtime.connectNative` */
  connectNative(applicationName: string): {
    postMessage(message: unknown): void;
    onMessage: { addListener(cb: (msg: unknown) => void): void };
    onDisconnect: { addListener(cb: () => void): void };
  };
  /** `chrome.storage.session` adapted to SessionStorageLike. */
  storage: SessionStorageLike;
  /** `chrome.runtime.onMessage`'s `{addListener, removeListener}` pair. */
  onMessage: {
    addListener(listener: (msg: unknown) => void): void;
    removeListener(listener: (msg: unknown) => void): void;
  };
  /** Production wires `triggerRequestPopupWindowOpen`. */
  triggerPopupOpen(route: RouteUrls, urlParams: URLSearchParams): Promise<unknown>;
  /** Reads the wallet's background-side state on each call. */
  getState(): BackgroundProbeState;
  /** Read-only probe wires produced by makeReadOnlyProbeWires. */
  readOnlyProbes: ReadOnlyProbeWiresLike;
  /** Called when the harness gives up reconnecting (install detection). */
  onHostNotInstalled?(): void;
}

/**
 * Wire the cat21 NMH agent surface and return a teardown handle.
 * Idempotent w.r.t. multiple calls — the lifecycle's
 * `ensureConnected` is no-op when a port is alive. Teardown stops
 * any pending reconnect and detaches the current port.
 */
export function installCat21NmhAgent(args: InstallCat21NmhAgentArgs): {
  ensureConnected(): void;
  teardown(): void;
  state(): 'idle' | 'connecting' | 'connected' | 'backoff' | 'gave-up';
} {
  const lifecycle = createNmhLifecycle({
    applicationName: CAT21_NMH_APPLICATION_NAME,
    connectNative: args.connectNative,
    attach(port) {
      attachNativeHostToPopupRelay({
        port,
        storage: args.storage,
        onMessage: args.onMessage,
        triggerPopupOpen: args.triggerPopupOpen,
        readOnlyProbes: args.readOnlyProbes,
      });
    },
    onHostNotInstalled: args.onHostNotInstalled,
  });
  lifecycle.ensureConnected();
  // `getState` is captured by the readOnlyProbes the caller built;
  // we mention it here only so the entrypoint's intent (lazy reads)
  // is visible at the wiring site.
  void args.getState;
  return {
    ensureConnected: () => lifecycle.ensureConnected(),
    teardown: () => lifecycle.disconnect(),
    state: () => lifecycle.state(),
  };
}
