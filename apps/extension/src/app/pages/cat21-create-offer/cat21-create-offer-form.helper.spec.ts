import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CREATE_OFFER_FORM_VALUES,
  validateAndCoerceCreateOfferForm,
} from './cat21-create-offer-form.helper';

const VALID_CAT_ID = `${'0'.repeat(64)}i0`;

describe('validateAndCoerceCreateOfferForm', () => {
  describe('happy path', () => {
    it('coerces a complete form into an intent', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: VALID_CAT_ID,
        priceSats: '50000',
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent).toEqual({
          catId: VALID_CAT_ID,
          priceSats: 50_000,
          paymentAddress: 'bc1qaaa',
        });
      }
    });

    it('accepts the postage floor (546 sats) exactly', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: VALID_CAT_ID,
        priceSats: '546',
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(true);
    });

    it('trims whitespace', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: `  ${VALID_CAT_ID}  `,
        priceSats: '21000',
        paymentAddress: '  bc1qaaa  ',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent.catId).toBe(VALID_CAT_ID);
        expect(result.intent.paymentAddress).toBe('bc1qaaa');
      }
    });
  });

  describe('field errors', () => {
    it('rejects an empty catId', () => {
      const result = validateAndCoerceCreateOfferForm({
        ...DEFAULT_CREATE_OFFER_FORM_VALUES,
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.catId).toMatch(/required/);
    });

    it('rejects a malformed catId', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: 'not-a-cat-id',
        priceSats: '21000',
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.catId).toMatch(/64-hex-txid/);
    });

    it('rejects a price below the 546 postage floor', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: VALID_CAT_ID,
        priceSats: '500',
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.priceSats).toMatch(/postage floor/);
    });

    it('rejects a fractional price', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: VALID_CAT_ID,
        priceSats: '21000.5',
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.priceSats).toMatch(/positive integer/);
    });

    it('rejects a non-positive price', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: VALID_CAT_ID,
        priceSats: '0',
        paymentAddress: 'bc1qaaa',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.priceSats).toMatch(/positive integer/);
    });

    it('rejects an empty payment address', () => {
      const result = validateAndCoerceCreateOfferForm({
        catId: VALID_CAT_ID,
        priceSats: '21000',
        paymentAddress: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.paymentAddress).toMatch(/required/);
    });
  });
});
