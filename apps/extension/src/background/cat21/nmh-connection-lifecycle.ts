/**
 * Lifecycle harness for the cat21 NMH port. Wraps
 * `chrome.runtime.connectNative` with two pieces of structure the
 * raw API doesn't provide:
 *
 *   1. **Idempotent connect.** A second call while a port is alive
 *      is a no-op; specs and the background entrypoint can call
 *      `ensureConnected()` defensively without worrying about
 *      duplicate listeners.
 *
 *   2. **Backoff reconnect on disconnect.** When the native-host
 *      binary exits (crash, manual restart, OS reboot) Chrome
 *      fires `onDisconnect`. Without reconnect logic the wallet
 *      goes silent for agents until the user reloads the
 *      extension. The harness re-connects with capped exponential
 *      backoff (1s, 2s, 4s, ... up to 60s) until the host comes
 *      back; subsequent disconnects reset the backoff to the
 *      initial value.
 *
 * Why not auto-connect at boot in the background entrypoint? The
 * connectNative call fires onDisconnect almost immediately when
 * no host binary is installed, and we don't want a tight reconnect
 * loop in that case. The harness distinguishes "host installed but
 * crashed" (reconnect) from "host never installed"
 * (stop after first attempt's quick onDisconnect). The signal: if
 * the port disconnects within `INSTALL_DETECTION_MS`, we assume
 * the host isn't installed and stop reconnecting. The wallet's
 * settings UI offers a manual "install MCP host" walkthrough; an
 * explicit user action (re-clicking that) restarts the lifecycle.
 *
 * Everything is dependency-injected so specs can drive the FSM
 * without a real Chrome runtime. Production calls:
 *
 *   - `connectNative` = `chrome.runtime.connectNative`
 *   - `attach` = `(port) => attachNativeHostToPopupRelay({ port, …})`
 *   - `setTimeout` / `clearTimeout` = the globals
 */

/**
 * The shape this module needs from a `chrome.runtime.Port`. Same
 * interface as `connect-native-host.ts → NativeHostPortLike` so
 * the attach can consume the harness's output directly.
 */
// HACK -- Cat21: removed `export` (internal port type, mirrors NativeHostPortLike from connect-native-host.ts). HARD RULE #5.
interface PortLike {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (msg: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

// HACK -- Cat21: removed `export` (callers reference the function via inference). HARD RULE #5.
interface ConnectNativeLike {
  (application: string): PortLike;
}

/**
 * Caller-tunable knobs. All have production-sensible defaults; the
 * specs override `initialBackoffMs` + `installDetectionMs` to make
 * test runs sub-second.
 */
// HACK -- Cat21: removed `export` (caller passes inline; restore on broader use). HARD RULE #5.
interface NmhLifecycleArgs {
  /** The native-host application name. */
  applicationName: string;
  /** The DI'd connect function (production: `chrome.runtime.connectNative`). */
  connectNative: ConnectNativeLike;
  /**
   * Called every time a fresh port is established. Production:
   * `attachNativeHostToPopupRelay({ port, … })`.
   * Specs: a vi.fn that records each call.
   */
  attach(port: PortLike): void;
  /** Initial backoff before the first reconnect attempt. Default 1_000. */
  initialBackoffMs?: number;
  /** Cap on the exponential backoff. Default 60_000. */
  maxBackoffMs?: number;
  /**
   * If the port disconnects within this many ms of being created,
   * the harness treats it as "host not installed" and stops
   * reconnecting. Default 250.
   */
  installDetectionMs?: number;
  /** Injectable for specs. Production: globalThis.setTimeout. */
  setTimeoutFn?(cb: () => void, ms: number): ReturnType<typeof setTimeout>;
  /** Injectable for specs. Production: globalThis.clearTimeout. */
  clearTimeoutFn?(handle: ReturnType<typeof setTimeout>): void;
  /** Injectable for specs. Production: () => Date.now(). */
  now?(): number;
  /**
   * Called when the harness gives up reconnecting (host not
   * installed). Production: log + leave the wallet quiet for
   * agents. Specs: assertion seam.
   */
  onHostNotInstalled?(): void;
}

/**
 * Lifecycle handle. The single public op is `ensureConnected()`:
 * idempotent. `disconnect()` is the teardown for tests + extension
 * unload; it stops reconnect attempts and detaches the current
 * port if any.
 */
// HACK -- Cat21: removed `export` (consumers read via factory return type). HARD RULE #5.
interface NmhLifecycle {
  ensureConnected(): void;
  disconnect(): void;
  /** Read-only state probe; specs use to assert FSM state. */
  state(): 'idle' | 'connecting' | 'connected' | 'backoff' | 'gave-up';
}

export function createNmhLifecycle(args: NmhLifecycleArgs): NmhLifecycle {
  const initial = args.initialBackoffMs ?? 1_000;
  const max = args.maxBackoffMs ?? 60_000;
  const installWindow = args.installDetectionMs ?? 250;
  const setTimeoutFn = args.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = args.clearTimeoutFn ?? clearTimeout;
  const now = args.now ?? (() => Date.now());

  let backoffMs = initial;
  let pendingReconnect: ReturnType<typeof setTimeout> | null = null;
  let fsm: 'idle' | 'connecting' | 'connected' | 'backoff' | 'gave-up' = 'idle';
  let stopped = false;
  let lastConnectStartAt = 0;

  function connect() {
    if (stopped || fsm === 'connected' || fsm === 'connecting') return;
    fsm = 'connecting';
    lastConnectStartAt = now();
    const fresh = args.connectNative(args.applicationName);
    fresh.onDisconnect.addListener(() => {
      // The disconnect-fires-immediately heuristic — if Chrome
      // closes the port within `installDetectionMs` of the connect
      // call, the host isn't installed (no binary to spawn).
      const elapsed = now() - lastConnectStartAt;
      if (stopped) return;
      // Heuristic: if the port closes within `installDetectionMs`
      // of the connect call, the host binary almost certainly
      // isn't installed (Chrome rejects connectNative immediately
      // for missing hosts). Give up rather than tight-loop.
      if (elapsed < installWindow) {
        fsm = 'gave-up';
        args.onHostNotInstalled?.();
        return;
      }
      // Genuine disconnect after a working connection — schedule a
      // backoff reconnect. The first one uses `initialBackoffMs`;
      // subsequent disconnects-without-success double up to
      // `maxBackoffMs`.
      fsm = 'backoff';
      pendingReconnect = setTimeoutFn(() => {
        pendingReconnect = null;
        connect();
      }, backoffMs);
      backoffMs = Math.min(backoffMs * 2, max);
    });
    args.attach(fresh);
    fsm = 'connected';
    // Successful connect resets backoff so a future disconnect
    // starts fresh.
    backoffMs = initial;
  }

  return {
    ensureConnected() {
      if (fsm === 'connected' || fsm === 'connecting' || fsm === 'backoff' || fsm === 'gave-up') {
        return;
      }
      connect();
    },
    disconnect() {
      stopped = true;
      if (pendingReconnect != null) clearTimeoutFn(pendingReconnect);
      pendingReconnect = null;
      fsm = 'idle';
    },
    state() {
      return fsm;
    },
  };
}
