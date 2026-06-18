import { installCat21DispatchListener } from './cat21-dispatch-listener';
import { createCat21Dispatcher, makeWiringPendingDeps } from './cat21-dispatcher';
import { connectToNativeHost } from './connect-native-host';

/**
 * Background-script bootstrap for the two Cat21 transports.
 *
 * The popup ↔ background channel (Path 2) lives on
 * `chrome.runtime.onMessage`; this module installs the listener that
 * routes inbound `cat21-dispatch` envelopes through a
 * `Cat21Dispatcher`. The MCP-host ↔ background channel (Path 3) lives
 * on `chrome.runtime.connectNative`; this module opens the native
 * host port and attaches the same dispatcher.
 *
 * Both channels currently share a single dispatcher constructed from
 * `makeWiringPendingDeps()`. That means every cat-flow call returns a
 * typed `wiring-pending` denial — the user sees a clear "not yet
 * wired" message in the popup instead of "channel closed before reply
 * received". A future iteration replaces the deps with the real
 * `wireCat21Dispatcher({...})` once the cross-context Redux state
 * wire is solved (background.ts → live store hydration is a
 * separate slice of work).
 *
 * The function is idempotent in practice: chrome's
 * `addListener` survives across service-worker restarts via the
 * registration cache, and `connectNative` opening twice is a no-op
 * (Chrome reuses the existing native-host process if one is alive).
 * Still — call exactly once at background-script startup.
 */
export function installCat21Listeners(): void {
  // One dispatcher, two transports. The getter is a function (not an
  // arrow) so a future state-backed swap reads from a module-level
  // mutable reference without changing call sites — the getter is
  // called fresh per inbound message, so account switches or
  // store-rehydration events that rebuild the dispatcher take effect
  // immediately.
  const dispatcher = createCat21Dispatcher(makeWiringPendingDeps());
  function getDispatcher() {
    return dispatcher;
  }

  installCat21DispatchListener({
    chromeApi: chrome.runtime,
    getDispatcher,
  });

  // Path 3 bridge: open the native-host port. Chrome will spawn the
  // MCP host binary on first call; if the host isn't installed the
  // port disconnects immediately and the MCP-side tools/list returns
  // "extension not connected" — that's intentional, not a bug.
  try {
    connectToNativeHost({
      connectNative: name => chrome.runtime.connectNative(name),
      dispatcher,
    });
  } catch (err) {
    // Native messaging not configured on this machine (no host
    // manifest installed). The MCP integration is opt-in; don't
    // crash the background script.
    // eslint-disable-next-line no-console
    console.warn('Cat21 native-host bridge unavailable:', err);
  }
}
