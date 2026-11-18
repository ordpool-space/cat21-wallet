import type { BrowserContext, Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* HACK -- Cat21: live-network stubs (audit T11). HQ: no test talks to a real
   system, and a stubbed response comes only from a captured real one under
   version control, with source and capture date.

   Every request to a non-loopback http(s) host that no spec route answered
   reaches this context route and gets one of three answers:
     - a captured response from tests/fixtures/live-net/ (each file names the
       CI run it was captured in and when). An EXACT fixture matches method +
       full URL (the fixed mainnet test account, constant URLs). A TEMPLATE
       fixture matches the URL with its account part replaced by a placeholder
       (a fresh wallet's address, xpub descriptor or Stacks principal), so one
       captured empty-account answer serves every fresh wallet;
     - blocked: a host whose responses are display-only images above the
       capture size cap (`BLOCKED`), aborted without a stub;
     - unstubbed: aborted, and reported through `onUnstubbed`, so the test
       fails. Adding a stub means capturing the real response first.
   Spec routes registered later (the regtest harness) take precedence, so a
   rewrite to a local service never reaches this handler. */

interface LiveNetStub {
  match: 'exact' | 'template';
  method: string;
  url: string;
  source: string;
  capturedAt: string;
  status: number;
  contentType: string;
  bodyEncoding: 'utf8' | 'base64';
  body: string;
}

const STUB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'live-net');

// Account parts of a URL, in the order the templates were generated with.
const DESCRIPTOR = /\b(wpkh|tr)\([^)]*\)/gu;
const BTC_ADDRESS = /\b(?:bc1|tb1|bcrt1)[02-9ac-hj-np-z]{20,}\b/gu;
// A Stacks principal, but not a contract id (`SP….name`), which names a token.
const STX_ADDRESS = /\bS[PT][0-9A-Z]{28,41}\b(?![.])/gu;

function liveNetTemplateOf(url: string): string {
  return url
    .replace(DESCRIPTOR, (_m, kind: string) => `${kind}(<descriptor>)`)
    .replace(BTC_ADDRESS, '<btc-address>')
    .replace(STX_ADDRESS, '<stx-address>');
}

const BLOCKED: { host: string; why: string }[] = [
  {
    host: 'images.leather.io',
    why: 'token icons, display only; several are above the capture size cap',
  },
];

function loadStubs(): Map<string, LiveNetStub> {
  const stubs = new Map<string, LiveNetStub>();
  for (const file of fs.readdirSync(STUB_DIR)) {
    if (!file.endsWith('.json')) continue;
    const stub = JSON.parse(fs.readFileSync(path.join(STUB_DIR, file), 'utf8')) as LiveNetStub;
    stubs.set(`${stub.match} ${stub.method} ${stub.url}`, stub);
  }
  return stubs;
}

const STUBS = loadStubs();

function isRemoteHttp(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

/** `METHOD host /first-segment`, the same key the LIVE-NET recorder prints. */
export function liveNetKey(method: string, url: URL): string {
  const firstSegment = url.pathname.split('/').filter(Boolean)[0] ?? '';
  return `${method} ${url.hostname} /${firstSegment}`;
}

export async function installLiveNetStubs(
  context: BrowserContext,
  onUnstubbed: (key: string) => void
): Promise<void> {
  await context.route(isRemoteHttp, async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const stub =
      STUBS.get(`exact ${method} ${url.href}`) ??
      STUBS.get(`template ${method} ${liveNetTemplateOf(url.href)}`);
    if (stub) {
      await route.fulfill({
        status: stub.status,
        contentType: stub.contentType,
        body: Buffer.from(stub.body, stub.bodyEncoding),
      });
      return;
    }
    if (!BLOCKED.some(b => b.host === url.hostname)) {
      onUnstubbed(liveNetKey(method, url));
    }
    await route.abort('blockedbyclient');
  });
}
