//
// This file is the entrypoint to the extension's background script
// https://developer.chrome.com/docs/extensions/mv3/architecture-overview/#background_script
import type { RpcRequests } from '@leather.io/rpc';
import { getCat21OrdApiClient } from '@leather.io/services';

import { listenForSessionDurationPort } from '@shared/analytics/session-duration-tracking';
import { logger } from '@shared/logger';
import { CONTENT_SCRIPT_PORT, type LegacyMessageFromContentScript } from '@shared/message-types';
import { warnUsersAboutDevToolsDangers } from '@shared/utils/dev-tools-warning-log';

import { queueAnalyticsRequest } from './background-analytics';
import { makeBackgroundProbeStateCache } from './cat21/background-probe-state';
import { decodeWalletProbeState } from './cat21/decode-wallet-probe-state';
import { installCat21NmhAgent } from './cat21/install-cat21-nmh-agent';
import { makeReadOnlyProbeWires } from './cat21/make-read-only-probe-wires';
import { initContextMenuActions } from './init-context-menus';
import { internalBackgroundMessageHandler } from './messaging/internal-methods/message-handler';
import {
  handleLegacyExternalMethodFormat,
  isLegacyMessage,
} from './messaging/legacy/legacy-external-message-handler';
import { rpcMessageHandler } from './messaging/rpc-message-handler';
import { triggerRequestPopupWindowOpen } from './messaging/rpc-request-utils';
import { initAddressMonitor } from './monitors/address-monitor';

// HACK -- Cat21 (MV3 listener-ordering rule): every chrome.runtime
// listener is registered at the TOP of this module, BEFORE any
// side-effect-having boot code (installCat21NmhAgent,
// initContextMenuActions, etc.). MV3 re-evaluates the SW module on
// each wake-up; listeners must be in place when the first inbound
// event arrives. See the deferred installCat21NmhAgent() below for
// the second half of the contract.

// Listen for connection to the content-script - port for two-way communication.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== CONTENT_SCRIPT_PORT) return;

  port.onMessage.addListener((message: LegacyMessageFromContentScript | RpcRequests, port) => {
    if (!port.sender?.tab?.id)
      return logger.error('Message reached background script without a corresponding tab');

    // Chromium/Firefox discrepancy
    const originUrl = port.sender?.origin ?? port.sender?.url;

    if (!originUrl)
      return logger.error('Message reached background script without a corresponding origin');

    // Legacy JWT format messages
    if (isLegacyMessage(message)) {
      void handleLegacyExternalMethodFormat(message, port);
      return;
    }

    // TODO:
    // Here we'll handle all messages using the rpc style comm method
    // For now all messages are handled as legacy format
    void rpcMessageHandler(message, port);
  });
});

//
// Events from the extension frames script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void internalBackgroundMessageHandler(message, sender, sendResponse);
  // Listener fn must return `true` to indicate the response will be async
  return true;
});

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason === 'install' && process.env.WALLET_ENVIRONMENT !== 'testing') {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`index.html`),
    });
  }
});

initContextMenuActions();
warnUsersAboutDevToolsDangers();

// Cat21 NMH agent surface (Path 3 — MCP host autonomous calls). The
// dispatcher itself runs IN THE POPUP: this background module just
// opens the connectNative port, routes read-only probes inline, and
// relays mutating cat21_* through the popup-side Cat21RpcService via
// `triggerRequestPopupWindowOpen`. Idempotent — no-op when the host
// is unreachable (the lifecycle backs off and "gives up" without
// throwing, so a missing native-messaging-host registration just
// silently surfaces as "MCP host not connected" to agents).
const cat21ProbeStateCache = makeBackgroundProbeStateCache({
  storage: chrome.storage.local,
  onChanged: chrome.storage.onChanged,
  decode: decodeWalletProbeState,
});
cat21ProbeStateCache.bootstrap().catch(e => {
  logger.error('cat21 probe-state bootstrap failed: ', e);
});
// HACK -- Cat21 (defer NMH boot off the SW critical path): wiring
// `installCat21NmhAgent` inline at module init breaks the dapp's
// `chrome.runtime.connect({name:'content-script'})` flow under
// headless-xvfb Chromium. Symptom: CS dispatches getAddresses,
// SW never delivers the port message to its onConnect listener,
// the approval popup never spawns, the dapp's
// `Cat21Provider.request(...)` Promise hangs.
//
// Bisect (2026-06-25):
//   - Wallet commit b48d77f7f (2026-06-19) wired installCat21NmhAgent
//     at SW boot. Last green ordpool e2e: 2026-06-17 14:45.
//     First red: 2026-06-19 — same day b48d77f7f landed.
//   - Run 28153103778 (wallet HEAD 8ea3b0b8d, installCat21NmhAgent
//     commented out): GREEN. Full mint roundtrip including popup
//     approval flow.
//   - Run 28154386200 (wallet HEAD 6716baf7f, this setTimeout(0)
//     wrapper): GREEN.
//
// Why setTimeout(0) fixes it: connectNative('cat21-nmh-app') starts
// a synchronous-from-Chrome's-perspective NMH host lookup. Until
// that lookup completes (or fails fast on "host not installed"),
// the SW's port-routing pipeline doesn't drain new content-script
// connects. Deferring to the next macrotask lets the SW finish
// processing the initial event-queue (including any queued
// content-script `port.connect`) before initiating the native-host
// lookup. NMH is Path 3 (opportunistic MCP-bot bridge); it's fine
// to come up one tick later — no agent is connected at SW boot
// anyway.
setTimeout(() => {
  installCat21NmhAgent({
    connectNative: chrome.runtime.connectNative.bind(chrome.runtime),
    storage: chrome.storage.session,
    onMessage: chrome.runtime.onMessage,
    triggerPopupOpen: triggerRequestPopupWindowOpen,
    getState: cat21ProbeStateCache.read,
    readOnlyProbes: makeReadOnlyProbeWires({
      getState: cat21ProbeStateCache.read,
      cat21OrdClient: getCat21OrdApiClient(),
    }),
    // cat21-result-bus integrity check: accept only messages whose
    // sender is one of our own extension pages. `sender.id ===
    // chrome.runtime.id` rules out other extensions; `sender.tab ===
    // undefined` rules out content scripts running in a tab.
    verifyResultBusSender: sender => sender?.id === chrome.runtime.id && sender?.tab === undefined,
    onHostNotInstalled: () => logger.info('cat21 NMH host not installed — Path 3 disabled'),
  });
}, 0);

initAddressMonitor().catch(e => {
  logger.error('Unable to Initialise Address Monitor: ', e);
});

listenForSessionDurationPort({
  onSessionEnd(sessionMetadata) {
    void queueAnalyticsRequest('user_session_complete', sessionMetadata);
  },
});
