import { describe, expect, it, vi } from 'vitest';

import type { Cat21AcceptOfferIntent, Validated } from '../types';
import {
  Cat21OfferValidation,
  validateAcceptOffer,
} from './accept-offer-validator';

interface SdkArgs {
  psbt: Uint8Array;
  expectedSellerUtxo: { txid: string; vout: number };
  floorPriceSats: number;
  expectedSellerPaymentAddress: string;
  network: 'mainnet' | 'testnet';
}
type SdkDelegate = (sdkArgs: SdkArgs) => Cat21OfferValidation;

const VALID_TXID = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';

function brandIntent(
  overrides: Partial<Cat21AcceptOfferIntent> = {}
): Validated<Cat21AcceptOfferIntent> {
  return {
    offerPsbt: 'dummy-not-decoded-here',
    expectedCatId: VALID_CAT_ID,
    expectedPriceSats: 100_000,
    expectedSellerUtxo: { txid: VALID_TXID, vout: 0 },
    ...overrides,
  } as Validated<Cat21AcceptOfferIntent>;
}

describe('validateAcceptOffer', () => {

  it('delegates to the SDK callback with the correct ValidateCat21BuyOfferArgs shape', () => {
    const delegate = vi.fn<SdkDelegate>(
      () => ({ ok: true, pricePaidSats: 100_000, postageSats: 546 })
    );
    const psbt = new Uint8Array([0x70, 0x73, 0x62, 0x74, 0xff]);
    validateAcceptOffer(
      {
        intent: brandIntent(),
        psbtBytes: psbt,
        expectedSellerPaymentAddress: 'bc1qfoo',
        network: 'mainnet',
      },
      delegate
    );
    expect(delegate).toHaveBeenCalledWith({
      psbt,
      expectedSellerUtxo: { txid: VALID_TXID, vout: 0 },
      floorPriceSats: 100_000,
      expectedSellerPaymentAddress: 'bc1qfoo',
      network: 'mainnet',
    });
  });

  it('passes intent.expectedPriceSats as floorPriceSats (intent pins floor)', () => {
    const delegate = vi.fn<SdkDelegate>(
      () => ({ ok: true, pricePaidSats: 75_000, postageSats: 546 })
    );
    validateAcceptOffer(
      {
        intent: brandIntent({ expectedPriceSats: 75_000 }),
        psbtBytes: new Uint8Array(),
        expectedSellerPaymentAddress: 'bc1qfoo',
        network: 'mainnet',
      },
      delegate
    );
    expect(delegate.mock.calls[0][0].floorPriceSats).toBe(75_000);
  });

  it('returns the SDK ok-success verbatim when SDK accepts AND pricePaidSats equals expected', () => {
    function delegate(): Cat21OfferValidation {
      return { ok: true, pricePaidSats: 100_000, postageSats: 546 };
    }
    const result = validateAcceptOffer(
      {
        intent: brandIntent(),
        psbtBytes: new Uint8Array(),
        expectedSellerPaymentAddress: 'bc1qfoo',
        network: 'mainnet',
      },
      delegate
    );
    expect(result).toEqual({ ok: true, pricePaidSats: 100_000, postageSats: 546 });
  });

  it('returns wrong-price ValidationFailure when SDK accepts but pricePaidSats > expected', () => {
    // The SDK is happy because pricePaidSats >= floor. The wallet rejects because
    // the intent demanded EXACTLY expectedPriceSats; the buyer overpaid.
    // (Could be benign, but the wallet's contract is strict equality so any drift
    // — by-design overpayment, sniped-out shape — surfaces visibly.)
    function delegate(): Cat21OfferValidation {
      return { ok: true, pricePaidSats: 110_000, postageSats: 546 };
    }
    const result = validateAcceptOffer(
      {
        intent: brandIntent(),
        psbtBytes: new Uint8Array(),
        expectedSellerPaymentAddress: 'bc1qfoo',
        network: 'mainnet',
      },
      delegate
    );
    expect(result).toEqual({
      ok: false,
      reason: 'wrong-price',
      detail: 'intent.expectedPriceSats=100000, psbt pays 110000',
    });
  });

  it('returns the SDK ValidationFailure verbatim when SDK rejects', () => {
    function delegate(): Cat21OfferValidation {
      return {
        ok: false,
        reason: 'payment-output-wrong-address',
        detail: 'expected bc1qfoo, got bc1qbar',
      };
    }
    const result = validateAcceptOffer(
      {
        intent: brandIntent(),
        psbtBytes: new Uint8Array(),
        expectedSellerPaymentAddress: 'bc1qfoo',
        network: 'mainnet',
      },
      delegate
    );
    expect(result).toEqual({
      ok: false,
      reason: 'payment-output-wrong-address',
      detail: 'expected bc1qfoo, got bc1qbar',
    });
  });

  it('passes expectedSellerPaymentAddress + network through to the SDK', () => {
    const delegate = vi.fn<SdkDelegate>(
      () => ({ ok: true, pricePaidSats: 100_000, postageSats: 546 })
    );
    validateAcceptOffer(
      {
        intent: brandIntent(),
        psbtBytes: new Uint8Array(),
        expectedSellerPaymentAddress: 'tb1q-testnet-addr',
        network: 'testnet',
      },
      delegate
    );
    expect(delegate.mock.calls[0][0].expectedSellerPaymentAddress).toBe('tb1q-testnet-addr');
    expect(delegate.mock.calls[0][0].network).toBe('testnet');
  });
});
