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

// HACK -- Cat21 (event-listener ordering): register every
// chrome.runtime listener at the TOP of the module, BEFORE any other
// side-effect-having boot code. In MV3 the service worker re-evaluates
// this module on each wake-up; if a listener registration sits behind
// `installCat21NmhAgent` (or any other slow / potentially-throwing
// init), an incoming port.connect arrives before its listener exists
// and is silently dropped. The 2026-06-19 wiring of installCat21NmhAgent
// (commit b48d77f7f) broke the ordpool e2e regtest mint workflow this
// way — the dapp's content-script port message reached a SW with no
// `onConnect` handler, the request hung at the dapp side, and the
// approval popup never spawned. Last green run: 2026-06-17 14:45,
// first red: 2026-06-19. Listeners-first restores the contract.

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
// HACK -- Cat21 (debug-bisect2): defer NMH wiring off the SW's
// initial sync evaluation tick. With it inline, `connectNative` is
// called before the runtime listeners route their first event; the
// dapp's content-script port.connect arrives during that window and
// is silently dropped (bisect confirmed: with NMH disabled the
// ordpool e2e regtest popup spawns; with it inline it never does).
// setTimeout(0) defers to the next macrotask, giving the runtime
// pipeline a chance to drain.
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
