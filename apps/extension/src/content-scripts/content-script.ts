/**
 Extensions that read or write to web pages utilize a content script. The content script
 contains JavaScript that executes in the contexts of a page that has been loaded into
 the browser. Content scripts read and modify the DOM of web pages the browser visits.
 https://developer.chrome.com/docs/extensions/mv3/architecture-overview/#contentScripts
 */
import {
  AuthenticationRequestEvent,
  DomEventName,
  PsbtRequestEvent,
  SignatureRequestEvent,
  TransactionRequestEvent,
} from '@shared/inpage-types';
import {
  CONTENT_SCRIPT_PORT,
  ExternalMethods,
  LegacyMessageFromContentScript,
  LegacyMessageToContentScript,
  MESSAGE_SOURCE,
} from '@shared/message-types';
import { RouteUrls } from '@shared/route-urls';

let backgroundPort: any;

// Connection to background script - fires onConnect event in background script
// and establishes two-way communication
function connect() {
  backgroundPort = chrome.runtime.connect({ name: CONTENT_SCRIPT_PORT });
  // HACK -- Cat21 (debug-connect): trace port lifecycle. Repeated
  // reconnects = SW thrash; a reconnect AT click time = the dapp's
  // dispatch race the port was holding to. Remove once pinned.
  backgroundPort.onDisconnect.addListener(() => {
    // eslint-disable-next-line no-console
    console.log('[CAT21-CS] port-disconnected; reconnecting');
    connect();
  });
}

connect();
// eslint-disable-next-line no-console
console.log('[CAT21-CS] content-script loaded', window.location.href);

// Sends message to background script that an event has fired
function sendMessageToBackground(message: LegacyMessageFromContentScript) {
  backgroundPort.postMessage(message);
}

// Receives message from background script to execute in browser
chrome.runtime.onMessage.addListener((message: LegacyMessageToContentScript) => {
  // HACK -- Cat21 (debug-connect): debug probe relay. Background
  // sends `{source: 'CAT21-DEBUG', text: '...'}` to surface internal
  // diagnostic checkpoints in the dapp page console (which Playwright
  // captures). Doesn't get postMessaged to the page (the existing
  // filter below blocks that). Remove once root cause pinned.
  if ((message as any)?.source === 'CAT21-DEBUG') {
    // eslint-disable-next-line no-console
    console.log('[CAT21-BG]', (message as any).text);
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[CAT21-CS] bg->page', (message as any)?.method ?? (message as any)?.id ?? 'unknown');
  if (message.source === MESSAGE_SOURCE || (message as any).jsonrpc === '2.0') {
    window.postMessage(message, window.location.origin);
  }
});

interface ForwardDomEventToBackgroundArgs {
  payload: string;
  method: LegacyMessageFromContentScript['method'];
  urlParam: string;
  path: RouteUrls;
}
function forwardDomEventToBackground({ payload, method }: ForwardDomEventToBackgroundArgs) {
  sendMessageToBackground({
    method,
    payload,
    source: MESSAGE_SOURCE,
  });
}

document.addEventListener(DomEventName.request, (event: any) => {
  // HACK -- Cat21 (debug-connect): trace probe for the ordpool e2e
  // popup-not-appearing investigation. Remove once pinned.
  // eslint-disable-next-line no-console
  console.log('[CAT21-CS] dispatch->bg', event.detail?.method, event.detail?.id);

  // Parallel SW-liveness probe: chrome.runtime.sendMessage returns
  // a Promise that rejects if the SW isn't listening. If the port
  // path is broken but rt.sendMessage works, the SW is alive but
  // the port handler isn't routing. If rt.sendMessage also fails,
  // the SW itself is dead or the runtime is detached.
  void chrome.runtime
    .sendMessage({ source: 'CAT21-DEBUG-PROBE', method: event.detail?.method })
    .then(r => {
      // eslint-disable-next-line no-console
      console.log('[CAT21-CS] rt.sendMessage ok response=', JSON.stringify(r));
    })
    .catch(e => {
      // eslint-disable-next-line no-console
      console.log('[CAT21-CS] rt.sendMessage FAILED:', e?.message ?? String(e));
    });

  // Also probe the port directly with a try/catch around postMessage.
  try {
    sendMessageToBackground({ source: MESSAGE_SOURCE, ...event.detail });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.log('[CAT21-CS] sendMessageToBackground THREW:', e?.message ?? String(e));
  }
});

// Listen for a CustomEvent (auth request) coming from the web app
document.addEventListener(DomEventName.authenticationRequest, ((
  event: AuthenticationRequestEvent
) => {
  forwardDomEventToBackground({
    path: RouteUrls.Onboarding,
    payload: event.detail.authenticationRequest,
    urlParam: 'authRequest',
    method: ExternalMethods.authenticationRequest,
  });
}) as EventListener);

// Listen for a CustomEvent (transaction request) coming from the web app
document.addEventListener(DomEventName.transactionRequest, ((event: TransactionRequestEvent) => {
  forwardDomEventToBackground({
    path: RouteUrls.TransactionRequest,
    payload: event.detail.transactionRequest,
    urlParam: 'request',
    method: ExternalMethods.transactionRequest,
  });
}) as EventListener);

// Listen for a CustomEvent (signature request) coming from the web app
document.addEventListener(DomEventName.signatureRequest, ((event: SignatureRequestEvent) => {
  forwardDomEventToBackground({
    path: RouteUrls.SignatureRequest,
    payload: event.detail.signatureRequest,
    urlParam: 'request',
    method: ExternalMethods.signatureRequest,
  });
}) as EventListener);

// Listen for a CustomEvent (structured data signature request) coming from the web app
document.addEventListener(DomEventName.structuredDataSignatureRequest, ((
  event: SignatureRequestEvent
) => {
  forwardDomEventToBackground({
    path: RouteUrls.SignatureRequest,
    payload: event.detail.signatureRequest,
    urlParam: 'request',
    method: ExternalMethods.structuredDataSignatureRequest,
  });
}) as EventListener);

// Listen for a CustomEvent (psbt request) coming from the web app
document.addEventListener(DomEventName.psbtRequest, ((event: PsbtRequestEvent) => {
  forwardDomEventToBackground({
    path: RouteUrls.PsbtRequest,
    payload: event.detail.psbtRequest,
    urlParam: 'request',
    method: ExternalMethods.psbtRequest,
  });
}) as EventListener);

function addLeatherToPage() {
  const inpage = document.createElement('script');
  inpage.src = chrome.runtime.getURL('inpage.js');
  inpage.id = 'leather-provider';
  document.body.appendChild(inpage);
}

// Don't block thread to add Leather to page
requestAnimationFrame(() => addLeatherToPage());
