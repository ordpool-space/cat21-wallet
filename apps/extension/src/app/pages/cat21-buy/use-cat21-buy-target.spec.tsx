// @vitest-environment jsdom
/**
 * Behaviour spec for `useCat21BuyTarget`. The load-bearing rules it encodes:
 *
 *   - The ask price and seller payout address come from the shared LINK first,
 *     then fall back to the Bazaar listing — NEVER from an on-chain owner lookup
 *     (payment-address-provenance HARD RULE). This spec pins that precedence:
 *     when a link value and a listing value disagree, the link wins.
 *   - cat21-ord not knowing the number is `not-found`, not an error.
 *   - a missing (or failed) listing is best-effort context, never fatal: the
 *     target still resolves `ready`, with whatever the link carried.
 *
 * Both IO seams are mocked at the module boundary: `getCat21OrdApiClient` (the
 * cat21-ord client) and `fetchCat21ListingForCat` (the Bazaar read). Their
 * return shapes mirror the live responses the sibling schema / bazaar-client
 * specs verify against the real servers.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCat21BuyTarget } from './use-cat21-buy-target';

const fetchCat21 = vi.fn();
const fetchCat21ListingForCat = vi.fn();

vi.mock('@leather.io/services', () => ({
  getCat21OrdApiClient: () => ({ fetchCat21 }),
}));
vi.mock('@app/common/cat21-bazaar/cat21-bazaar-client', () => ({
  fetchCat21ListingForCat: (...args: unknown[]) => fetchCat21ListingForCat(...args),
}));

const CAT_ID = 'ab'.repeat(32) + 'i0';

beforeEach(() => {
  fetchCat21.mockReset();
  fetchCat21ListingForCat.mockReset();
});

describe('useCat21BuyTarget', () => {
  it('stays idle when the parsed target has no cat number', () => {
    const { result } = renderHook(() => useCat21BuyTarget());

    act(() =>
      result.current.resolve({ catNumber: null, askSats: null, sellerPaymentAddress: null })
    );

    expect(result.current.view).toEqual({ step: 'idle' });
    expect(fetchCat21).not.toHaveBeenCalled();
  });

  it('resolves ready from the listing on the by-number path', async () => {
    fetchCat21.mockResolvedValueOnce({ id: CAT_ID, number: 42 });
    fetchCat21ListingForCat.mockResolvedValueOnce({
      ok: true,
      value: { askSats: 21_000, payTo: 'bc1qlisting' },
    });

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() => result.current.resolve({ catNumber: 42, askSats: null, sellerPaymentAddress: null }));

    await waitFor(() => expect(result.current.view.step).toBe('ready'));
    expect(result.current.view).toEqual({
      step: 'ready',
      catId: CAT_ID,
      catNumber: 42,
      askSats: 21_000,
      sellerPaymentAddress: 'bc1qlisting',
    });
    // by-number path resolves the cat number as a string for cat21-ord.
    expect(fetchCat21).toHaveBeenCalledWith('42');
  });

  it('prefers the LINK ask + payTo over the listing (payment-address provenance)', async () => {
    fetchCat21.mockResolvedValueOnce({ id: CAT_ID, number: 42 });
    // The listing disagrees with the link on BOTH fields.
    fetchCat21ListingForCat.mockResolvedValueOnce({
      ok: true,
      value: { askSats: 999, payTo: 'bc1qlisting' },
    });

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() =>
      result.current.resolve({
        catNumber: 42,
        askSats: 21_000,
        sellerPaymentAddress: 'bc1qfromlink',
      })
    );

    await waitFor(() => expect(result.current.view.step).toBe('ready'));
    if (result.current.view.step !== 'ready') throw new Error('narrowing');
    // Link wins on both — the value the seller pinned in the shared link.
    expect(result.current.view.askSats).toBe(21_000);
    expect(result.current.view.sellerPaymentAddress).toBe('bc1qfromlink');
  });

  it('falls back to the listing when the link carried neither ask nor payTo', async () => {
    fetchCat21.mockResolvedValueOnce({ id: CAT_ID, number: 7 });
    fetchCat21ListingForCat.mockResolvedValueOnce({
      ok: true,
      value: { askSats: 5000, payTo: 'bc1qlisting' },
    });

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() => result.current.resolve({ catNumber: 7, askSats: null, sellerPaymentAddress: null }));

    await waitFor(() => expect(result.current.view.step).toBe('ready'));
    if (result.current.view.step !== 'ready') throw new Error('narrowing');
    expect(result.current.view.askSats).toBe(5000);
    expect(result.current.view.sellerPaymentAddress).toBe('bc1qlisting');
  });

  it('resolves ready with nulls when there is no listing and no link data', async () => {
    fetchCat21.mockResolvedValueOnce({ id: CAT_ID, number: 42 });
    fetchCat21ListingForCat.mockResolvedValueOnce({ ok: true, value: null });

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() => result.current.resolve({ catNumber: 42, askSats: null, sellerPaymentAddress: null }));

    await waitFor(() => expect(result.current.view.step).toBe('ready'));
    expect(result.current.view).toEqual({
      step: 'ready',
      catId: CAT_ID,
      catNumber: 42,
      askSats: null,
      sellerPaymentAddress: null,
    });
  });

  it('treats a failed listing read as best-effort (still ready, using link data)', async () => {
    fetchCat21.mockResolvedValueOnce({ id: CAT_ID, number: 42 });
    fetchCat21ListingForCat.mockResolvedValueOnce({ ok: false, error: { code: 'network-error' } });

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() =>
      result.current.resolve({
        catNumber: 42,
        askSats: 21_000,
        sellerPaymentAddress: 'bc1qfromlink',
      })
    );

    await waitFor(() => expect(result.current.view.step).toBe('ready'));
    if (result.current.view.step !== 'ready') throw new Error('narrowing');
    // Listing failed, but the link data carries the target through.
    expect(result.current.view.askSats).toBe(21_000);
    expect(result.current.view.sellerPaymentAddress).toBe('bc1qfromlink');
  });

  it('is not-found when cat21-ord does not know the cat number', async () => {
    fetchCat21.mockRejectedValueOnce(new Error('404'));

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() =>
      result.current.resolve({ catNumber: 999999, askSats: null, sellerPaymentAddress: null })
    );

    await waitFor(() => expect(result.current.view.step).toBe('not-found'));
    // A cat that doesn't exist must never reach the listing read.
    expect(fetchCat21ListingForCat).not.toHaveBeenCalled();
  });

  it('reset returns the view to idle', async () => {
    fetchCat21.mockResolvedValueOnce({ id: CAT_ID, number: 42 });
    fetchCat21ListingForCat.mockResolvedValueOnce({ ok: true, value: null });

    const { result } = renderHook(() => useCat21BuyTarget());
    act(() => result.current.resolve({ catNumber: 42, askSats: null, sellerPaymentAddress: null }));
    await waitFor(() => expect(result.current.view.step).toBe('ready'));

    act(() => result.current.reset());
    await waitFor(() => expect(result.current.view).toEqual({ step: 'idle' }));
  });
});
