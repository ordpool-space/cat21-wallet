import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';

import type { Cat21Transport } from '@background/cat21/mode-resolver';
import { type SessionStorageLike, fetchCat21Request } from '@background/cat21/popup-bridge';
import type { Cat21Intent } from '@background/cat21/types';

/**
 * Result returned by `useCat21RequestFromUrl`. The popup uses it to
 * decide between two intent sources:
 *
 *   - URL-driven (Path 3 via `triggerRequestPopupWindowOpen`): popup
 *     opened with `?cat21RequestId=<id>`, the intent + transport tag
 *     come from `chrome.storage.session`.
 *   - State-driven (Path 2 manual): popup navigated to from inside
 *     the wallet, intent rides on `react-router`'s `location.state`.
 *
 * `status === 'idle'` is the Path-2 case (no URL request id). The
 * popup uses `location.state.intent` and posts no result back to
 * the background.
 *
 * `status === 'loading'` is the Path-3 wait between popup-load and
 * `chrome.storage.session.get` resolving. The dialog shows a small
 * spinner; nothing kicks off yet.
 *
 * `status === 'ready'` is the Path-3 happy case. `intent` and
 * `transport` are populated; the route auto-fires when
 * `transport === 'mcp-nmh'`.
 *
 * `status === 'expired'` is "URL has a cat21RequestId, but storage
 * doesn't" — most commonly because the wallet restarted between
 * popup-open and popup-load. The dialog surfaces a clean
 * "request expired" message instead of crashing.
 */
// HACK -- Cat21: removed `export` (the hook returns this; consumers read fields via inference). HARD RULE #5 — restore on direct use.
type Cat21RequestFromUrlState =
  | { status: 'idle' }
  | { status: 'loading'; requestId: string }
  | {
      status: 'ready';
      requestId: string;
      intent: Cat21Intent;
      transport: Cat21Transport;
    }
  | { status: 'expired'; requestId: string }
  | { status: 'error'; requestId: string; message: string };

/**
 * Default storage shim — reads from `chrome.storage.session` in
 * production. Specs / tests inject a fake via the `storage` arg so
 * they don't need to mock the global `chrome` object.
 *
 * `chrome.storage.session` returns the result via callback in MV3;
 * the Promise-returning form is also available. We adapt to the
 * `SessionStorageLike` shape `popup-bridge` defines so the same
 * type flows through both ends.
 */
function defaultStorage(): SessionStorageLike {
  return {
    set(items) {
      return chrome.storage.session.set(items);
    },
    get(keys) {
      return chrome.storage.session.get(keys);
    },
    remove(keys) {
      return chrome.storage.session.remove(keys);
    },
  };
}

/**
 * Reads `cat21RequestId` from the current location's search params
 * and resolves the stashed intent from `chrome.storage.session` via
 * `fetchCat21Request`. Idempotent w.r.t. re-renders — the effect
 * only re-fires when the request id itself changes.
 *
 * The `storage` arg is the testing seam — tests pass an in-memory
 * fake; production lets the default `chrome.storage.session` shim
 * flow through. Without the seam every spec would need to monkey-
 * patch the global `chrome` object.
 */
export function useCat21RequestFromUrl(
  storageOverride?: SessionStorageLike
): Cat21RequestFromUrlState {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestId = params.get('cat21RequestId');

  // `defaultStorage()` builds a fresh object; as an inline default param it
  // was a NEW reference every render, so the effect below (dep: [requestId,
  // storage]) re-fired on every render and its setState spun into an infinite
  // render loop (React "Maximum update depth exceeded") whenever a
  // `cat21RequestId` was present (the Path-3 / NMH auto-confirm path).
  // Memoize so the storage reference is stable across renders.
  const storage = useMemo(() => storageOverride ?? defaultStorage(), [storageOverride]);

  const [state, setState] = useState<Cat21RequestFromUrlState>(
    requestId ? { status: 'loading', requestId } : { status: 'idle' }
  );

  useEffect(() => {
    if (!requestId) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading', requestId });
    let cancelled = false;
    void (async () => {
      try {
        const stashed = await fetchCat21Request(storage, requestId);
        if (cancelled) return;
        if (!stashed) {
          setState({ status: 'expired', requestId });
          return;
        }
        setState({
          status: 'ready',
          requestId,
          intent: stashed.intent,
          transport: stashed.transport,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          requestId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, storage]);

  return state;
}
