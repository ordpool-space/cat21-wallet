/**
 * HACK -- Cat21 (audit C1): no-op replacement for `@sentry/react`
 * and `@sentry/browser`. Cat21 Wallet ships zero telemetry per
 * PRIVACY-POLICY.md.
 *
 * Wired via webpack's `resolve.alias` so every `import ... from
 * '@sentry/react'` or `import ... from '@sentry/browser'` lands
 * here, regardless of which package the upstream Leather call site
 * names. Zero bytes from the real `@sentry/*` packages ship in the
 * production bundle.
 *
 * Surface kept small: only the symbols upstream Leather actually
 * imports (`captureMessage`, `captureException`, `setTag`, `init`,
 * the two router-tracing integrations, `browserTracingIntegration`,
 * `feedbackIntegration`). Add new exports here as quarterly upstream
 * sync surfaces them.
 */
function noop() {
  /* see file header */
}

function noopAsync() {
  return Promise.resolve();
}

export function captureMessage(_message: string, _level?: unknown): string {
  return '';
}

export function captureException(_error: unknown, _context?: unknown): string {
  return '';
}

export function setTag(_key: string, _value: unknown): void {
  /* noop */
}

export function setTags(_tags: Record<string, unknown>): void {
  /* noop */
}

export function setUser(_user: unknown): void {
  /* noop */
}

export function setExtra(_key: string, _value: unknown): void {
  /* noop */
}

export function setContext(_name: string, _context: unknown): void {
  /* noop */
}

export function addBreadcrumb(_breadcrumb: unknown): void {
  /* noop */
}

export function init(_options?: unknown): void {
  /* noop */
}

export function browserTracingIntegration(_options?: unknown): { name: string } {
  return { name: 'noop-browser-tracing' };
}

export function reactRouterV7BrowserTracingIntegration(_options?: unknown): { name: string } {
  return { name: 'noop-react-router-v7-tracing' };
}

export function feedbackIntegration(_options?: unknown): {
  name: string;
  createForm(): Promise<null>;
} {
  return {
    name: 'noop-feedback',
    createForm: () => Promise.resolve(null),
  };
}

// Some upstream call sites use `Sentry.captureException(...)` via
// `import * as Sentry from '@sentry/react'`. The namespace import
// resolves these names from the module's exports — which we provide
// above — so the `* as Sentry` form just works.

// Default export for `import Sentry from '...'` style (rare but
// possible).
const noopSentry = {
  captureMessage,
  captureException,
  setTag,
  setTags,
  setUser,
  setExtra,
  setContext,
  addBreadcrumb,
  init,
  browserTracingIntegration,
  reactRouterV7BrowserTracingIntegration,
  feedbackIntegration,
  // Misc methods upstream uses opportunistically; all noop.
  withScope(callback: (scope: unknown) => void): void {
    callback({ setTag: noop, setUser: noop, setExtra: noop, setContext: noop });
  },
  startSpan: noop,
  startTransaction: () => ({ finish: noop, setName: noop, setData: noop }),
  flush: () => Promise.resolve(true),
  close: noopAsync,
};

export default noopSentry;
