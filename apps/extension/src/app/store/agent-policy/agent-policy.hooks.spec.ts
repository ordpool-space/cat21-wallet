import { describe, expect, it } from 'vitest';

import { accountIdToSliceKey } from './agent-policy.hooks';

describe('accountIdToSliceKey', () => {
  it('formats fingerprint and accountIndex with a `:` separator', () => {
    expect(accountIdToSliceKey({ fingerprint: 'deadbeef', accountIndex: 0 })).toBe('deadbeef:0');
    expect(accountIdToSliceKey({ fingerprint: 'cafebabe', accountIndex: 42 })).toBe('cafebabe:42');
  });

  it('round-trips distinct (fingerprint, index) pairs to distinct keys', () => {
    // No two pairs should collide on the same key. Pin this so a
    // future format change (different separator, base-encoding the
    // index) preserves the property.
    const a = accountIdToSliceKey({ fingerprint: 'aa', accountIndex: 1 });
    const b = accountIdToSliceKey({ fingerprint: 'aa', accountIndex: 2 });
    const c = accountIdToSliceKey({ fingerprint: 'ab', accountIndex: 1 });
    const d = accountIdToSliceKey({ fingerprint: 'aab', accountIndex: 1 });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it('handles accountIndex zero', () => {
    // Sanity: the default first-account case must produce a stable key.
    expect(accountIdToSliceKey({ fingerprint: 'x', accountIndex: 0 })).toBe('x:0');
  });
});
