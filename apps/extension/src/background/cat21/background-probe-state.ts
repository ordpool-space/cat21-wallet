/**
 * Background-resident wallet-state cache the read-only NMH probes
 * read from. The probes (`make-read-only-probe-wires.ts`) demand a
 * synchronous `getState()`; chrome.storage.local is async. This
 * module bridges the gap with a tiny pattern:
 *
 *   - on `bootstrap()`, async-load the relevant slices from
 *     chrome.storage.local once
 *   - register a `chrome.storage.onChanged` listener that keeps
 *     the in-memory cache up to date as the popup writes through
 *     redux-persist
 *   - expose `read()` as the sync getState the wires need
 *
 * The expected shape of the persisted Redux is a single
 * `'persist:root'` key whose value is a JSON string mapping
 * slice-name → JSON-encoded slice (redux-persist v6 default). The
 * caller passes a `decode` callback that pulls the four fields we
 * surface — network, accountId, activeAccountAddress,
 * agentModeEnabled — out of that envelope. Keeping the decode
 * pluggable means we don't bind this module to the wallet's
 * internal slice shape; the entrypoint owns the schema.
 *
 * Default value before the first load completes:
 *   { network: 'mainnet', accountId: '', activeAccountAddress:
 *     undefined, agentModeEnabled: false }
 * The probes' `wallet_status` returns that as-is; `list_cats`
 * sees `undefined` address and returns `[]` (the boot-race-friendly
 * empty fallback iter 14d added).
 *
 * Specs drive the bootstrap + change-listener with in-memory
 * storage fakes — no chrome.* globals.
 */
import { type SessionStorageLike } from './popup-bridge';

/**
 * Same shape as `make-read-only-probe-wires.ts`'s `ProbeStateLike`
 * — kept duplicated so neither module depends on the other (the
 * background entrypoint is the join point).
 */
// HACK -- Cat21: removed `export` (the cache surface returns this; consumers read via inference). HARD RULE #5.
interface BackgroundProbeState {
  network: 'mainnet' | 'testnet';
  accountId: string;
  activeAccountAddress: string | undefined;
  agentModeEnabled: boolean;
}

/**
 * Minimal `chrome.storage.local`-shaped shim. Production passes
 * the global; specs pass an in-memory map. We narrow to the three
 * methods we touch so the production type doesn't pull the full
 * `chrome` types into the test runtime.
 *
 * (Reuses `SessionStorageLike` from `popup-bridge.ts` because the
 * shape happens to match — they're both
 * `chrome.storage.StorageArea`-shaped.)
 */
// HACK -- Cat21: removed `export` (local-storage shape mirrors SessionStorageLike). HARD RULE #5.
type LocalStorageLike = SessionStorageLike;

/**
 * Subset of `chrome.storage.onChanged`-shaped events. We only need
 * `addListener({key → {oldValue, newValue}}, areaName)`; production
 * passes the global, specs deliver synthesized events.
 */
// HACK -- Cat21: removed `export` (event shape; consumers pass inline). HARD RULE #5.
interface OnChangedLike {
  addListener(
    listener: (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string
    ) => void
  ): void;
}

interface MakeBackgroundProbeStateArgs {
  storage: LocalStorageLike;
  onChanged: OnChangedLike;
  /**
   * The redux-persist top-level key. Default `'persist:root'`. The
   * background entrypoint may override if the wallet ever
   * rewrites its persistence scheme.
   */
  rootKey?: string;
  /**
   * Pulls the four probe fields out of whatever the wallet has
   * stored under `rootKey`. The caller owns the slice-shape
   * dependency; this module stays slice-agnostic. Return the
   * defaults when the input is null/malformed.
   */
  decode(rawRoot: unknown): BackgroundProbeState;
}

const DEFAULT_STATE: BackgroundProbeState = {
  network: 'mainnet',
  accountId: '',
  activeAccountAddress: undefined,
  agentModeEnabled: false,
};

/**
 * Cache surface. `bootstrap()` is the async one-shot load called at
 * boot; until it resolves, `read()` returns `DEFAULT_STATE` (the
 * boot-race-friendly value the probes handle gracefully).
 */
export function makeBackgroundProbeStateCache(args: MakeBackgroundProbeStateArgs) {
  const rootKey = args.rootKey ?? 'persist:root';
  let cached: BackgroundProbeState = DEFAULT_STATE;

  args.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes[rootKey];
    if (!change || !('newValue' in change)) return;
    cached = args.decode(change.newValue);
  });

  return {
    async bootstrap(): Promise<void> {
      const result = await args.storage.get(rootKey);
      cached = args.decode(result[rootKey]);
    },
    read(): BackgroundProbeState {
      return cached;
    },
  };
}
