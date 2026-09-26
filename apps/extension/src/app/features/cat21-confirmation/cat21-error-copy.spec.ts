import { describe, expect, it } from 'vitest';

import { humanizeCat21Error } from './cat21-error-copy';

describe('humanizeCat21Error', () => {
  it('maps insufficient-funds to an actionable "add funds" step', () => {
    expect(
      humanizeCat21Error('intent-invariant-violated', 'funding-pick-failed: Insufficient funds')
    ).toBe('Add funds to your wallet, then try again.');
    expect(humanizeCat21Error('funding-pick-failed')).toBe(
      'Add funds to your wallet, then try again.'
    );
  });

  it('maps a locked wallet to an unlock step', () => {
    expect(humanizeCat21Error('agent-disabled', 'wallet-locked')).toBe(
      'Unlock your wallet, then try again.'
    );
  });

  it('maps policy limits to a settings step, per limit', () => {
    expect(humanizeCat21Error('spend-above-action-cap')).toMatch(/spending limit/);
    expect(humanizeCat21Error('fee-rate-above-ceiling')).toMatch(/fee is above your limit/);
    expect(humanizeCat21Error('counterparty-not-allowlisted')).toMatch(/allowed list/);
  });

  it('maps a missing cat to a refresh step', () => {
    expect(humanizeCat21Error('intent-invariant-violated', 'cat-not-found')).toBe(
      'This cat could not be loaded. Refresh and try again.'
    );
  });

  it('maps a broadcast failure to a wait-and-retry step', () => {
    expect(humanizeCat21Error('broadcast-failed', 'mempool rejected')).toBe(
      'The network did not accept this. Wait a moment, then try again.'
    );
  });

  it('falls back to a plain sentence for an unknown reason, never the code', () => {
    const out = humanizeCat21Error('some-brand-new-reason', 'weird detail');
    expect(out).toBe('This could not be completed. Refresh and try again.');
  });

  describe('no raw code or engineering vocabulary ever reaches the user', () => {
    // Every reason the rpc layer can emit, plus the details that ride inside
    // intent-invariant-violated. Returning the raw `reason` (the old
    // behaviour) makes this red: a hyphenated code is not a sentence.
    const reasons = [
      'agent-disabled',
      'broadcast-failed',
      'counterparty-not-allowlisted',
      'fee-rate-above-ceiling',
      'floor-price-violation',
      'intent-invariant-violated',
      'payment-output-wrong-address',
      'policy-denied',
      'price-below-floor',
      'sighash-not-all',
      'spend-above-action-cap',
      'transport-not-trusted-for-autonomous',
      'wiring-pending',
      'wrong-price',
      // Unlisted reasons — the real risk (a lookup + guard can both pass while
      // the FALLBACK is the thing that leaks). Including these makes the
      // fallback path itself subject to the no-raw-code guard: mutating the
      // fallback to `return reason` turns this red on exactly these rows.
      'a-brand-new-unmapped-reason-code',
      'some-future-sdk-error-nobody-has-yet',
    ];
    const details = [
      undefined,
      'wallet-locked',
      'user-rejected',
      'funding-pick-failed',
      'cat-not-found',
      'cat-utxo-resolve-failed',
      'cat-data-not-loaded',
      'Insufficient funds',
    ];
    // Code-shaped fragments no sentence should contain. The strongest guard
    // is `not.toContain(reason)` below (returning the raw code fails); these
    // catch a stray engineering token leaking through a detail passthrough.
    const bannedFragments = ['psbt', 'sighash', 'nlocktime', 'regtest', 'utxo', 'invariant'];

    it('every (reason, detail) yields a second-person sentence with no raw token', () => {
      for (const reason of reasons) {
        for (const detail of details) {
          const out = humanizeCat21Error(reason, detail);
          // A finished sentence: ends with a period, starts capitalised.
          expect(out.endsWith('.')).toBe(true);
          expect(out[0]).toBe(out[0].toUpperCase());
          // Never the raw reason itself, nor any code-shaped fragment.
          const lower = out.toLowerCase();
          expect(lower).not.toContain(reason);
          for (const frag of bannedFragments) {
            expect(lower).not.toContain(frag);
          }
        }
      }
    });
  });
});
