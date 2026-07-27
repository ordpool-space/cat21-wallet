import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchCat21ListingForCat,
  postBidToCat21Bazaar,
  publishCat21Listing,
  unlistCat21,
} from './cat21-bazaar-client';
import {
  CAT21_BAZAAR_BASE_URL,
  Cat21BazaarCreateBidRequest,
  Cat21SessionHeaders,
} from './cat21-bazaar.types';

vi.mock('axios');

const HEADERS: Cat21SessionHeaders = {
  'X-Cat21-Session-Address': 'bc1pordinals',
  'X-Cat21-Session-Valid-Until': '2026-08-01T00:00:00.000Z',
  'X-Cat21-Session-Signature': 'SIG',
};

const REQUEST = {
  catNumber: 42,
  cats: [42, 100],
  network: 'mainnet',
  askSats: 21_000,
  payTo: 'bc1qpayment',
  catTxid: 'ab49227cce490e2137872f7d08924187ee4f4bc7e8b3bda7ac63d7bba1d897df',
  catVout: 0,
  ordinalsAddress: 'bc1pordinals',
};

/** Build an axios-shaped error the isAxiosError guard accepts. */
function axiosError(status: number, data?: unknown) {
  return { isAxiosError: true, response: { status, data }, message: `http-${status}` };
}

afterEach(() => vi.clearAllMocks());

describe('publishCat21Listing', () => {
  it('POSTs to <base>/api/v1/listings with the request body and all three session headers', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 201 });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });

    expect(res).toEqual({ ok: true, value: undefined });
    expect(axios.post).toHaveBeenCalledWith(`${CAT21_BAZAAR_BASE_URL}/api/v1/listings`, REQUEST, {
      headers: { 'Content-Type': 'application/json', ...HEADERS },
    });
  });

  it('401 → session-rejected', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(401));
    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });
    expect(res).toEqual({ ok: false, error: { code: 'session-rejected' } });
  });

  it('422 not-current-owner → mapped verbatim', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(422, { message: 'not-current-owner' }));
    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });
    expect(res).toEqual({ ok: false, error: { code: 'not-current-owner' } });
  });

  it('422 cats-bundle-drift → mapped verbatim', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(422, { code: 'cats-bundle-drift' }));
    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });
    expect(res).toEqual({ ok: false, error: { code: 'cats-bundle-drift' } });
  });

  it('422 with an unknown backend code → rejected with the code in detail', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(422, { message: 'some-new-code' }));
    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });
    expect(res).toEqual({ ok: false, error: { code: 'rejected', detail: 'some-new-code' } });
  });

  it('429 → rate-limited', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(429));
    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });
    expect(res).toEqual({ ok: false, error: { code: 'rate-limited' } });
  });

  it('no response (network failure) → network-error', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await publishCat21Listing({ request: REQUEST, headers: HEADERS });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('network-error');
  });
});

describe('unlistCat21', () => {
  it('DELETEs <base>/api/v1/listings/cat/<catNumber> with the session headers', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.delete).mockResolvedValueOnce({ status: 204 });
    const res = await unlistCat21({ catNumber: 42, headers: HEADERS });
    expect(res).toEqual({ ok: true, value: undefined });
    expect(axios.delete).toHaveBeenCalledWith(`${CAT21_BAZAAR_BASE_URL}/api/v1/listings/cat/42`, {
      headers: { ...HEADERS },
    });
  });

  it('401 → session-rejected', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.delete).mockRejectedValueOnce(axiosError(401));
    const res = await unlistCat21({ catNumber: 42, headers: HEADERS });
    expect(res).toEqual({ ok: false, error: { code: 'session-rejected' } });
  });
});

describe('fetchCat21ListingForCat', () => {
  it('200 → { askSats, payTo }', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { askSats: 21_000, payTo: 'bc1qpayment' } });
    const res = await fetchCat21ListingForCat({ catNumber: 42 });
    expect(res).toEqual({ ok: true, value: { askSats: 21_000, payTo: 'bc1qpayment' } });
  });

  it('404 → value null (no listing is not an error)', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockRejectedValueOnce(axiosError(404));
    const res = await fetchCat21ListingForCat({ catNumber: 42 });
    expect(res).toEqual({ ok: true, value: null });
  });
});

const BID_REQUEST: Cat21BazaarCreateBidRequest = {
  network: 'mainnet',
  catTxid: 'ab49227cce490e2137872f7d08924187ee4f4bc7e8b3bda7ac63d7bba1d897df',
  catVout: 0,
  cats: [42],
  headlineCatNumber: 42,
  bidSats: 21_000,
  buyerOrdinalsAddress: 'bc1pbuyerordinals',
  buyerPaymentAddress: 'bc1qbuyerpayment',
  sellerPaymentAddress: 'bc1qsellerpayment',
  psbtBase64: 'cHNidP8BAP0Y',
};

describe('postBidToCat21Bazaar', () => {
  it('POSTs to <base>/api/v1/bids with the request body and NO session headers', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 201 });

    const res = await postBidToCat21Bazaar({ request: BID_REQUEST });

    expect(res).toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledWith(`${CAT21_BAZAAR_BASE_URL}/api/v1/bids`, BID_REQUEST, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('400 psbt-price-mismatch → mapped verbatim', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(400, { message: 'psbt-price-mismatch' }));
    const res = await postBidToCat21Bazaar({ request: BID_REQUEST });
    expect(res).toEqual({ ok: false, error: { code: 'psbt-price-mismatch' } });
  });

  it('400 cats-bundle-drift → mapped verbatim (buyer must re-observe)', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(400, { code: 'cats-bundle-drift' }));
    const res = await postBidToCat21Bazaar({ request: BID_REQUEST });
    expect(res).toEqual({ ok: false, error: { code: 'cats-bundle-drift' } });
  });

  it('400 with an unknown backend code → rejected with the code in detail', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(400, { message: 'some-new-code' }));
    const res = await postBidToCat21Bazaar({ request: BID_REQUEST });
    expect(res).toEqual({ ok: false, error: { code: 'rejected', detail: 'some-new-code' } });
  });

  it('429 → rate-limited', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError(429));
    const res = await postBidToCat21Bazaar({ request: BID_REQUEST });
    expect(res).toEqual({ ok: false, error: { code: 'rate-limited' } });
  });

  it('no response (network failure) → network-error', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await postBidToCat21Bazaar({ request: BID_REQUEST });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('network-error');
  });
});
