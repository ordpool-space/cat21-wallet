/*
 * HACK -- Cat21 (audit C1): every code path in this file is a no-op.
 * Cat21 Wallet ships zero telemetry per PRIVACY-POLICY.md. The
 * upstream Leather analytics surface (Mixpanel, Sentry, the
 * deriveAnalyticsIdentifier(publicKey) per-user fingerprint) was
 * leaking BTC-balance reports, route history, and an xpub-derived
 * identifier when the env vars were populated.
 *
 * The exports stay so the upstream call sites still compile (~100
 * `analytics.track(...)` sites across the codebase) — they all
 * route to noop. The module deliberately imports NOTHING from
 * `@sentry/*` or `mixpanel-browser`: zero bytes ship in the
 * production bundle.
 *
 * Quarterly upstream sync: when Leather adds a new `analytics.track`
 * call, our noop client makes the call a no-op without further
 * action. When Leather adds a new telemetry vendor (e.g. PostHog),
 * the HACK marker rule means the new import line surfaces in the
 * diff and we strip it here.
 */
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { base58 } from '@scure/base';

import { configureAnalyticsClient } from '@leather.io/analytics';
import { noop } from '@leather.io/utils';

function getNoopAnalyticsClient() {
  return {
    identify() {
      return Promise.resolve();
    },
    track: noop,
    getPeople() {
      return { set: noop };
    },
    setGroup: noop,
    getGroup() {
      return { set: noop };
    },
  };
}

export const analytics = configureAnalyticsClient({
  client: getNoopAnalyticsClient(),
  defaultProperties: {
    platform: 'extension',
  },
});

export function decorateAnalyticsEventsWithContext(
  _getEventContextProperties: () => Record<string, unknown>
) {
  // noop — see file header
}

export function initAnalytics() {
  // noop — see file header
}

// Kept for byte-compat with upstream Leather code that derives a
// per-user identifier; we DO NOT call `analytics.identify` with it
// anywhere in this wallet (see `identifyUser` below — also a noop).
/** @knipignore */
export function deriveAnalyticsIdentifier(publicKey: Uint8Array) {
  return base58.encode(ripemd160(sha256(publicKey)).slice(0, 8));
}

export function identifyUser(_publicKey: Uint8Array) {
  // noop — we do not identify users (see file header)
  return Promise.resolve();
}

export function initSentry() {
  // noop — see file header
}

export function openFeedbackSheet(): Promise<null> {
  // noop — see file header. The settings "Feedback" link routes
  // here today; we'll point users at a real GitHub-issues URL
  // when the settings UI lands a proper redirect.
  return Promise.resolve(null);
}
