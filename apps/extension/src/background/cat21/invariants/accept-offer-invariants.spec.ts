import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import type { Cat21AcceptOfferIntent } from '../types';
import {
  ACCEPT_OFFER_PRICE_MIN_SATS,
  ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS,
  ACCEPT_OFFER_PSBT_MAX_BYTES,
  AcceptOfferInvariantError,
  enforceAcceptOfferInvariants,
} from './accept-offer-invariants';

const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';
const VALID_TXID = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

const publicKey = hex.decode('030000000000000000000000000000000000000000000000000000000000000001');
const p2wpkh = btc.p2wpkh(publicKey, btc.NETWORK);

function buildRealPsbt(): Uint8Array {
  const tx = new btc.Transaction({ allowUnknownInputs: true });
  tx.addInput({
    txid: VALID_TXID,
    index: 0,
    witnessUtxo: { script: p2wpkh.script, amount: 546n },
    sighashType: btc.SigHash.ALL,
  });
  tx.addOutputAddress(p2wpkh.address!, 546n, btc.NETWORK);
  tx.addOutputAddress(p2wpkh.address!, 100_000n, btc.NETWORK);
  return tx.toPSBT();
}

function makeIntent(overrides: Partial<Cat21AcceptOfferIntent> = {}): Cat21AcceptOfferIntent {
  return {
    offerPsbt: hex.encode(buildRealPsbt()),
    expectedCatId: VALID_CAT_ID,
    expectedPriceSats: 100_000,
    expectedSellerUtxo: { txid: VALID_TXID, vout: 0 },
    ...overrides,
  };
}

describe('enforceAcceptOfferInvariants', () => {

  describe('expected-cat-id-malformed', () => {

    it('throws when expectedCatId is not a string', () => {
      expect(() =>
        enforceAcceptOfferInvariants(
          makeIntent({ expectedCatId: 123 as unknown as string }),
          'mainnet'
        )
      ).toThrow('expected-cat-id-malformed');
    });

    it('throws when expectedCatId lacks the txidi<index> shape', () => {
      expect(() =>
        enforceAcceptOfferInvariants(makeIntent({ expectedCatId: 'no-i-marker' }), 'mainnet')
      ).toThrow('expected-cat-id-malformed');
    });

    it('accepts a well-formed expectedCatId', () => {
      const result = enforceAcceptOfferInvariants(makeIntent(), 'mainnet');
      expect(result.expectedCatId).toBe(VALID_CAT_ID);
    });
  });

  describe('expected-price boundaries', () => {

    it('throws when expectedPriceSats is 0', () => {
      expect(() =>
        enforceAcceptOfferInvariants(makeIntent({ expectedPriceSats: 0 }), 'mainnet')
      ).toThrow('expected-price-below-dust');
    });

    it('throws when expectedPriceSats is below 546', () => {
      expect(() =>
        enforceAcceptOfferInvariants(makeIntent({ expectedPriceSats: 545 }), 'mainnet')
      ).toThrow('expected-price-below-dust');
    });

    it('accepts expectedPriceSats exactly at 546', () => {
      const result = enforceAcceptOfferInvariants(
        makeIntent({ expectedPriceSats: ACCEPT_OFFER_PRICE_MIN_SATS }),
        'mainnet'
      );
      expect(result.expectedPriceSats).toBe(546);
    });

    it('throws when expectedPriceSats exceeds 21_000_000_000', () => {
      expect(() =>
        enforceAcceptOfferInvariants(
          makeIntent({ expectedPriceSats: ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS + 1 }),
          'mainnet'
        )
      ).toThrow('expected-price-above-sanity-ceiling');
    });

    it('accepts expectedPriceSats exactly at 21_000_000_000', () => {
      const result = enforceAcceptOfferInvariants(
        makeIntent({ expectedPriceSats: ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS }),
        'mainnet'
      );
      expect(result.expectedPriceSats).toBe(ACCEPT_OFFER_PRICE_SANITY_CEILING_SATS);
    });
  });

  describe('expected-seller-utxo structure', () => {

    it('throws when expectedSellerUtxo.txid is not 64-char hex', () => {
      expect(() =>
        enforceAcceptOfferInvariants(
          makeIntent({ expectedSellerUtxo: { txid: 'short', vout: 0 } }),
          'mainnet'
        )
      ).toThrow('expected-seller-utxo-malformed');
    });

    it('throws when expectedSellerUtxo.vout is negative', () => {
      expect(() =>
        enforceAcceptOfferInvariants(
          makeIntent({ expectedSellerUtxo: { txid: VALID_TXID, vout: -1 } }),
          'mainnet'
        )
      ).toThrow('expected-seller-utxo-malformed');
    });

    it('throws when expectedSellerUtxo.vout is non-integer', () => {
      expect(() =>
        enforceAcceptOfferInvariants(
          makeIntent({ expectedSellerUtxo: { txid: VALID_TXID, vout: 1.5 } }),
          'mainnet'
        )
      ).toThrow('expected-seller-utxo-malformed');
    });

    it('accepts a well-formed expectedSellerUtxo', () => {
      const result = enforceAcceptOfferInvariants(makeIntent(), 'mainnet');
      expect(result.expectedSellerUtxo).toEqual({ txid: VALID_TXID, vout: 0 });
    });
  });

  describe('offer-psbt structure', () => {

    it('throws when offerPsbt is an empty string', () => {
      expect(() =>
        enforceAcceptOfferInvariants(makeIntent({ offerPsbt: '' }), 'mainnet')
      ).toThrow('offer-psbt-empty');
    });

    it('throws when offerPsbt exceeds the size ceiling', () => {
      const huge = '00'.repeat(ACCEPT_OFFER_PSBT_MAX_BYTES);
      expect(() =>
        enforceAcceptOfferInvariants(makeIntent({ offerPsbt: huge }), 'mainnet')
      ).toThrow('offer-psbt-too-large');
    });

    it('throws when offerPsbt is not valid base64 or hex', () => {
      expect(() =>
        enforceAcceptOfferInvariants(makeIntent({ offerPsbt: '!!!not-base64!!!' }), 'mainnet')
      ).toThrow('offer-psbt-not-parseable');
    });

    it('throws when offerPsbt parses but is not a real PSBT (no magic bytes)', () => {
      expect(() =>
        enforceAcceptOfferInvariants(
          makeIntent({ offerPsbt: hex.encode(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00])) }),
          'mainnet'
        )
      ).toThrow('offer-psbt-not-parseable');
    });

    it('accepts a real PSBT in hex form', () => {
      const result = enforceAcceptOfferInvariants(makeIntent(), 'mainnet');
      expect(Array.from(result.psbtBytes.slice(0, 5))).toEqual([0x70, 0x73, 0x62, 0x74, 0xff]);
    });

    it('accepts a real PSBT in base64 form', () => {
      const psbt = buildRealPsbt();
      const base64Encoded = btoa(String.fromCharCode(...psbt));
      const result = enforceAcceptOfferInvariants(
        makeIntent({ offerPsbt: base64Encoded }),
        'mainnet'
      );
      expect(Array.from(result.psbtBytes.slice(0, 5))).toEqual([0x70, 0x73, 0x62, 0x74, 0xff]);
    });
  });

  describe('happy path returns the branded intent + decoded bytes', () => {

    it('returns an object with psbtBytes attached', () => {
      const result = enforceAcceptOfferInvariants(makeIntent(), 'mainnet');
      expect(result.psbtBytes).toBeInstanceOf(Uint8Array);
      expect(result.expectedCatId).toBe(VALID_CAT_ID);
    });

    it('runs invariants in order (catId → price → utxo → psbt)', () => {
      // Bad catId, bad price, bad utxo, bad psbt — surfaces the catId one first.
      try {
        enforceAcceptOfferInvariants(
          {
            offerPsbt: '',
            expectedCatId: 'bad',
            expectedPriceSats: 0,
            expectedSellerUtxo: { txid: 'bad', vout: -1 },
          },
          'mainnet'
        );
        throw new Error('did not throw');
      } catch (err) {
        expect((err as AcceptOfferInvariantError).reason).toBe('expected-cat-id-malformed');
      }
    });
  });
});
