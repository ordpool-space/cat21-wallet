import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import {
  CREATE_OFFER_PRICE_MIN_SATS,
  CREATE_OFFER_PRICE_SANITY_CEILING_SATS,
  CreateOfferInvariantError,
  enforceCreateOfferInvariants,
} from './create-offer-invariants';

const publicKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000001');
const mainnetAddr = btc.p2wpkh(publicKey, btc.NETWORK).address!;
const testnetAddr = btc.p2wpkh(publicKey, btc.TEST_NETWORK).address!;
const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';

describe('enforceCreateOfferInvariants', () => {
  describe('cat-id-malformed', () => {
    it('throws when catId is not a string', () => {
      try {
        enforceCreateOfferInvariants(
          { catId: 123 as unknown as string, priceSats: 100_000, paymentAddress: mainnetAddr },
          'mainnet'
        );
        throw new Error('did not throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CreateOfferInvariantError);
        expect((err as CreateOfferInvariantError).reason).toBe('cat-id-malformed');
      }
    });

    it('throws when catId lacks the txidi<index> shape', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          { catId: 'not-a-cat-id', priceSats: 100_000, paymentAddress: mainnetAddr },
          'mainnet'
        )
      ).toThrow('cat-id-malformed');
    });

    it('throws when catId has non-hex characters in the txid portion', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          {
            catId: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXi0',
            priceSats: 100_000,
            paymentAddress: mainnetAddr,
          },
          'mainnet'
        )
      ).toThrow('cat-id-malformed');
    });

    it('accepts a well-formed catId with multi-digit index', () => {
      const result = enforceCreateOfferInvariants(
        {
          catId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi42',
          priceSats: 100_000,
          paymentAddress: mainnetAddr,
        },
        'mainnet'
      );
      expect(result.catId).toMatch(/i42$/);
    });
  });

  describe('price-below-dust', () => {
    it('throws when priceSats is 0', () => {
      try {
        enforceCreateOfferInvariants(
          { catId: VALID_CAT_ID, priceSats: 0, paymentAddress: mainnetAddr },
          'mainnet'
        );
        throw new Error('did not throw');
      } catch (err) {
        expect((err as CreateOfferInvariantError).reason).toBe('price-below-dust');
      }
    });

    it('throws when priceSats is below the dust floor (545)', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          { catId: VALID_CAT_ID, priceSats: 545, paymentAddress: mainnetAddr },
          'mainnet'
        )
      ).toThrow('price-below-dust');
    });

    it('accepts priceSats exactly at the dust floor (546)', () => {
      const result = enforceCreateOfferInvariants(
        {
          catId: VALID_CAT_ID,
          priceSats: CREATE_OFFER_PRICE_MIN_SATS,
          paymentAddress: mainnetAddr,
        },
        'mainnet'
      );
      expect(result.priceSats).toBe(546);
    });
  });

  describe('price-above-sanity-ceiling', () => {
    it('throws when priceSats exceeds the 21 BTC × 10 ceiling', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          {
            catId: VALID_CAT_ID,
            priceSats: CREATE_OFFER_PRICE_SANITY_CEILING_SATS + 1,
            paymentAddress: mainnetAddr,
          },
          'mainnet'
        )
      ).toThrow('price-above-sanity-ceiling');
    });

    it('accepts priceSats exactly at the ceiling', () => {
      const result = enforceCreateOfferInvariants(
        {
          catId: VALID_CAT_ID,
          priceSats: CREATE_OFFER_PRICE_SANITY_CEILING_SATS,
          paymentAddress: mainnetAddr,
        },
        'mainnet'
      );
      expect(result.priceSats).toBe(CREATE_OFFER_PRICE_SANITY_CEILING_SATS);
    });
  });

  describe('payment-address validity', () => {
    it('throws when paymentAddress is not a parseable Bitcoin address', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          { catId: VALID_CAT_ID, priceSats: 100_000, paymentAddress: 'not-an-address' },
          'mainnet'
        )
      ).toThrow('payment-address-not-a-bitcoin-address');
    });

    it('throws when paymentAddress is mainnet but network is testnet', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          { catId: VALID_CAT_ID, priceSats: 100_000, paymentAddress: mainnetAddr },
          'testnet'
        )
      ).toThrow('payment-address-wrong-network');
    });

    it('throws when paymentAddress is testnet but network is mainnet', () => {
      expect(() =>
        enforceCreateOfferInvariants(
          { catId: VALID_CAT_ID, priceSats: 100_000, paymentAddress: testnetAddr },
          'mainnet'
        )
      ).toThrow('payment-address-wrong-network');
    });

    it('accepts a network-matching mainnet paymentAddress', () => {
      const result = enforceCreateOfferInvariants(
        { catId: VALID_CAT_ID, priceSats: 100_000, paymentAddress: mainnetAddr },
        'mainnet'
      );
      expect(result.paymentAddress).toBe(mainnetAddr);
    });

    it('accepts a network-matching testnet paymentAddress', () => {
      const result = enforceCreateOfferInvariants(
        { catId: VALID_CAT_ID, priceSats: 100_000, paymentAddress: testnetAddr },
        'testnet'
      );
      expect(result.paymentAddress).toBe(testnetAddr);
    });
  });

  describe('happy path returns the branded intent', () => {
    it('returns the same intent object on success (no field rewrite)', () => {
      const raw = { catId: VALID_CAT_ID, priceSats: 100_000, paymentAddress: mainnetAddr };
      const result = enforceCreateOfferInvariants(raw, 'mainnet');
      expect(result).toBe(raw); // Same reference: brand cast, not clone.
    });

    it('runs invariants in declared order (catId → price → address)', () => {
      // All three invariants would fail; surface the catId one first.
      try {
        enforceCreateOfferInvariants(
          { catId: 'bad', priceSats: 0, paymentAddress: 'bad' },
          'mainnet'
        );
        throw new Error('did not throw');
      } catch (err) {
        expect((err as CreateOfferInvariantError).reason).toBe('cat-id-malformed');
      }
    });
  });
});
