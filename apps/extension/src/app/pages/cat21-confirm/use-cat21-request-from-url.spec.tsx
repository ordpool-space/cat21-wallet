// @vitest-environment jsdom
/**
 * Integration spec for `useCat21RequestFromUrl` (iter 15). Pins the
 * popup-side state machine that bridges Path 3's URL stash to the
 * Cat21ConfirmRoute container:
 *
 *   - No `cat21RequestId` URL param → `status: 'idle'` (Path 2)
 *   - Param present, storage holds the stash → loading → ready
 *   - Param present, storage is empty → expired
 *   - Param present, storage throws → error
 *
 * The chrome.storage.session seam is injected via the hook's
 * `storage` arg; specs never touch a real `chrome.*` global. Uses
 * @testing-library/react (hoisted at workspace root) + jsdom (already
 * a devDep of apps/extension).
 *
 * Sibling-coverage note: the underlying popup-bridge round-trip is
 * already covered by `popup-bridge.spec.ts` (7 specs) and
 * `nmh-popup-relay.spec.ts` (5 specs). This spec pins the React-side
 * wiring those background-side specs can't reach.
 */
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  type SessionStorageLike,
  cat21RequestStorageKey,
  stashCat21Request,
} from '@background/cat21/popup-bridge';

import { useCat21RequestFromUrl } from './use-cat21-request-from-url';

function makeFakeStorage(): SessionStorageLike & { peek(): Record<string, unknown> } {
  const state: Record<string, unknown> = {};
  return {
    set(items) {
      for (const [k, v] of Object.entries(items)) state[k] = v;
      return Promise.resolve();
    },
    get(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of want) if (k in state) out[k] = state[k];
      return Promise.resolve(out);
    },
    remove(keys) {
      const want = Array.isArray(keys) ? keys : [keys];
      for (const k of want) delete state[k];
      return Promise.resolve();
    },
    peek() {
      return state;
    },
  };
}

function wrapWithRouter(initialEntries: string[]) {
  function RouterWrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  }
  return RouterWrapper;
}

const SAMPLE_INTENT = {
  recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  feeRate: 5,
} as const;

describe('useCat21RequestFromUrl', () => {
  it('returns idle when no cat21RequestId URL param is present (Path 2)', () => {
    const storage = makeFakeStorage();
    const { result } = renderHook(() => useCat21RequestFromUrl(storage), {
      wrapper: wrapWithRouter(['/cat21-mint-confirm']),
    });
    expect(result.current).toEqual({ status: 'idle' });
  });

  it('starts in loading then transitions to ready when the stash exists (Path 3 happy path)', async () => {
    const storage = makeFakeStorage();
    const { requestId } = await stashCat21Request({
      intent: { ...SAMPLE_INTENT },
      transport: 'mcp-nmh',
      storage,
    });

    const { result } = renderHook(() => useCat21RequestFromUrl(storage), {
      wrapper: wrapWithRouter([`/cat21-mint-confirm?cat21RequestId=${requestId}`]),
    });

    // First synchronous render: storage.get is in flight, status is 'loading'.
    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    if (result.current.status !== 'ready') throw new Error('narrowing');
    expect(result.current.requestId).toBe(requestId);
    expect(result.current.intent).toEqual(SAMPLE_INTENT);
    expect(result.current.transport).toBe('mcp-nmh');
  });

  it('transitions to expired when the URL has an id but storage is empty (wallet restart between open and load)', async () => {
    const storage = makeFakeStorage();
    const requestId = 'cat21-request-stale-id';

    const { result } = renderHook(() => useCat21RequestFromUrl(storage), {
      wrapper: wrapWithRouter([`/cat21-mint-confirm?cat21RequestId=${requestId}`]),
    });

    await waitFor(() => {
      expect(result.current.status).toBe('expired');
    });
    if (result.current.status !== 'expired') throw new Error('narrowing');
    expect(result.current.requestId).toBe(requestId);
  });

  it('transitions to error when storage.get rejects', async () => {
    const storage: SessionStorageLike = {
      set: () => Promise.resolve(),
      get: () => Promise.reject(new Error('quota exceeded')),
      remove: () => Promise.resolve(),
    };

    const { result } = renderHook(() => useCat21RequestFromUrl(storage), {
      wrapper: wrapWithRouter(['/cat21-mint-confirm?cat21RequestId=any']),
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    if (result.current.status !== 'error') throw new Error('narrowing');
    expect(result.current.message).toBe('quota exceeded');
  });

  it('stashes round-trip through cat21RequestStorageKey (sanity check on the storage shape)', async () => {
    const storage = makeFakeStorage();
    const { requestId } = await stashCat21Request({
      intent: { ...SAMPLE_INTENT },
      transport: 'mcp-nmh',
      storage,
    });
    expect(storage.peek()[cat21RequestStorageKey(requestId)]).toBeDefined();

    const { result } = renderHook(() => useCat21RequestFromUrl(storage), {
      wrapper: wrapWithRouter([`/cat21-mint-confirm?cat21RequestId=${requestId}`]),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
