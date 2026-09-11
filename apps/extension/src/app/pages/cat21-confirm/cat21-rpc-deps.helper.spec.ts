import type { AgentActionKind } from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

import { stripCat21Prefix, toBidNetwork, toNetworkLabel } from './cat21-rpc-deps.helper';

/**
 * `stripCat21Prefix` is the single seam that translates the agent-policy's
 * `cat21_*` operation allowlist into the bare operation names the SDK structural
 * gate enforces. It is security-adjacent: in autonomous (Path 3) mode this list
 * is what the gate checks before signing without a prompt, so a mis-mapping here
 * would silently widen or narrow what a bot may do. These tests pin the exact
 * mapping and the undefined-vs-empty contract the gateConfig spread relies on.
 */
describe('stripCat21Prefix', () => {
  it('maps every cat21_ operation kind to its bare SDK gate name', () => {
    const source: AgentActionKind[] = [
      'cat21_mint',
      'cat21_transfer',
      'cat21_create_offer',
      'cat21_accept_offer',
    ];

    expect(stripCat21Prefix(source)).toEqual(['mint', 'transfer', 'create_offer', 'accept_offer']);
  });

  it('preserves the caller order and multi-underscore names (create_offer, accept_offer)', () => {
    // Only the leading "cat21_" is stripped; the internal underscore stays.
    expect(stripCat21Prefix(['cat21_accept_offer', 'cat21_mint'])).toEqual([
      'accept_offer',
      'mint',
    ]);
  });

  it('returns undefined (not []) for an undefined source so gateConfig omits the key', () => {
    expect(stripCat21Prefix(undefined)).toBeUndefined();
  });

  it('returns undefined (not []) for an empty source', () => {
    expect(stripCat21Prefix([])).toBeUndefined();
  });

  it('maps a single-operation allowlist to exactly that one operation', () => {
    // A bot restricted to buying must not have that list widened by the mapping.
    expect(stripCat21Prefix(['cat21_accept_offer'])).toEqual(['accept_offer']);
  });
});

describe('toNetworkLabel', () => {
  it('passes mainnet and regtest through, everything else is testnet', () => {
    expect(toNetworkLabel('mainnet')).toBe('mainnet');
    expect(toNetworkLabel('regtest')).toBe('regtest');
    expect(toNetworkLabel('testnet')).toBe('testnet');
    expect(toNetworkLabel('signet')).toBe('testnet');
    expect(toNetworkLabel('anything')).toBe('testnet');
  });
});

describe('toBidNetwork', () => {
  it('maps mainnet and regtest through, everything else to testnet3', () => {
    expect(toBidNetwork('mainnet')).toBe('mainnet');
    expect(toBidNetwork('regtest')).toBe('regtest');
    // Note the target differs from toNetworkLabel: the bid DTO enum uses testnet3.
    expect(toBidNetwork('testnet')).toBe('testnet3');
    expect(toBidNetwork('signet')).toBe('testnet3');
  });
});
