/**
 * Spec stubs — shapes-only commit. Implementations land with the
 * module implementations; every `it.todo` becomes a real test.
 *
 * Positive-assertion style per workspace rule: pin exact strings /
 * header values, not absence-of-calls.
 */
import { describe, it } from 'vitest';

describe('cat21SessionStorageKey', () => {
  it.todo('is namespaced per address (two addresses → two keys)');
});

describe('getOrCreateCat21Session', () => {
  it.todo('first call signs the EXACT canonical session message from buildCat21SessionMessage (pinned string incl. address + validUntilIso)');
  it.todo('returns the three headers with address, validUntilIso, and the base64 signature the signer produced');
  it.todo('validUntilIso is nowMs + CAT21_SESSION_VALIDITY_MS (24 h)');
  it.todo('second call within validity returns the cached token — signer called exactly once across both calls');
  it.todo('cached token with < 60 s validity left is discarded and a fresh one is signed (grace window)');
  it.todo('expired cached token is discarded and a fresh one is signed');
  it.todo('corrupt JSON in storage is treated as a miss, not a crash');
});

describe('clearCat21Session', () => {
  it.todo('after clearing, the next getOrCreateCat21Session signs a fresh token (signer called again)');
  it.todo('clearing address A leaves address B\'s cached session intact');
});
