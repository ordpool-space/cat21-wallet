/**
 * @test-kind unit
 * Real:   the extension store and its redux-persist persistor, the in-memory-key slice,
 *         @stacks/encryption encrypt and decrypt
 * Faked:  chrome.storage.local.get (callback form read by shared/storage/storage-driver.ts,
 *         answering a persisted root shaped by keySlice's entity state and
 *         persistConfig.version) and chrome.storage.session.get (the
 *         `{ encryptionKey }` record initalizeWalletSession writes); the test chooses when each answers
 * Proves: the popup restores the session keys whichever of the two reads finishes first
 */
import { bytesToHex } from '@stacks/common';
import { encryptMnemonic } from '@stacks/encryption';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decodeText } from '@shared/utils/text-encoding';

/*
 * `restoreWalletSession` runs on popup boot. It needs two reads that finish in
 * any order: the session key from `chrome.storage.session` and the encrypted
 * software keys, which reach the store when redux-persist rehydrates from
 * `chrome.storage.local`. These specs drive both reads by hand against the
 * real store and persistor, so the order is chosen by the test.
 */

const fingerprint = 'f0f0f0f0';
const sessionKey = 'session-encryption-key';
const mnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

interface Harness {
  releaseRehydration(): void;
  sessionReads: number;
  sessionAnswered: Promise<void>;
}

function deferredChromeStorage(persistedRoot: unknown, sessionValue: unknown): Harness {
  const sessionAnswered = Promise.withResolvers<void>();
  const harness: Harness = {
    releaseRehydration() {
      throw new Error('chrome.storage.local.get was never called');
    },
    sessionReads: 0,
    sessionAnswered: sessionAnswered.promise,
  };
  Object.assign(globalThis.chrome.storage.local, {
    get(key: string, callback: (items: Record<string, unknown>) => void) {
      harness.releaseRehydration = () => callback({ [key]: persistedRoot });
    },
  });
  Object.assign(globalThis.chrome.storage, {
    session: {
      get() {
        harness.sessionReads += 1;
        sessionAnswered.resolve();
        return Promise.resolve({ encryptionKey: sessionValue });
      },
    },
  });
  return harness;
}

async function persistedRootWithOneSoftwareKey() {
  const encrypted = await encryptMnemonic(mnemonic, sessionKey);
  return {
    softwareKeys: {
      ids: [fingerprint],
      entities: {
        [fingerprint]: {
          type: 'software',
          id: fingerprint,
          encryptedSecretKey: bytesToHex(encrypted),
        },
      },
    },
    _persist: { version: 3, rehydrated: true },
  };
}

async function loadSubject() {
  const { restoreWalletSession } = await import('./session-restore');
  const { store, persistor } = await import('@app/store');
  return { restoreWalletSession, store, persistor };
}

function restoredSecretKey(state: { inMemoryKeys: { keys: Record<string, string> } }) {
  const bytes = state.inMemoryKeys.keys[fingerprint];
  return bytes === undefined ? undefined : decodeText(bytes);
}

describe('restoreWalletSession', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('restores the keys when the session read finishes before redux-persist rehydrates', async () => {
    const harness = deferredChromeStorage(await persistedRootWithOneSoftwareKey(), sessionKey);
    const { restoreWalletSession, store, persistor } = await loadSubject();

    const restoring = restoreWalletSession();
    await harness.sessionAnswered;

    expect(persistor.getState().bootstrapped).toBe(false);

    harness.releaseRehydration();
    await restoring;

    expect(restoredSecretKey(store.getState())).toBe(mnemonic);
    expect(persistor.getState().bootstrapped).toBe(true);
  });

  it('restores the keys when redux-persist rehydrated before the session read', async () => {
    const harness = deferredChromeStorage(await persistedRootWithOneSoftwareKey(), sessionKey);
    const { restoreWalletSession, store, persistor } = await loadSubject();

    harness.releaseRehydration();
    await vi.waitFor(() => expect(persistor.getState().bootstrapped).toBe(true));

    await restoreWalletSession();

    expect(restoredSecretKey(store.getState())).toBe(mnemonic);
  });

  it('returns without waiting for rehydration when there is no session key', async () => {
    const harness = deferredChromeStorage(await persistedRootWithOneSoftwareKey(), undefined);
    const { restoreWalletSession, store, persistor } = await loadSubject();

    await restoreWalletSession();

    expect(harness.sessionReads).toBe(1);
    expect(persistor.getState().bootstrapped).toBe(false);
    expect(store.getState().inMemoryKeys.keys).toEqual({});
  });
});
