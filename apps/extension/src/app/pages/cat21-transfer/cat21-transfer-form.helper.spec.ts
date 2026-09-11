import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TRANSFER_FORM_VALUES,
  validateAndCoerceTransferForm,
} from './cat21-transfer-form.helper';

const VALID_CAT_ID = `${'0'.repeat(64)}i0`;

describe('validateAndCoerceTransferForm', () => {
  describe('happy path', () => {
    it('coerces a complete form into an intent', () => {
      const result = validateAndCoerceTransferForm({
        catId: VALID_CAT_ID,
        recipient: 'bc1qaaa',
        feeRate: '7',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent).toEqual({
          catId: VALID_CAT_ID,
          recipient: 'bc1qaaa',
          feeRate: 7,
        });
      }
    });

    it('accepts high-vout cat ids', () => {
      const result = validateAndCoerceTransferForm({
        catId: `${'a'.repeat(64)}i42`,
        recipient: 'bc1qaaa',
        feeRate: '5',
      });
      expect(result.ok).toBe(true);
    });

    it('trims whitespace on both string fields', () => {
      const result = validateAndCoerceTransferForm({
        catId: `  ${VALID_CAT_ID}  `,
        recipient: '  bc1qaaa  ',
        feeRate: '5',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent.catId).toBe(VALID_CAT_ID);
        expect(result.intent.recipient).toBe('bc1qaaa');
      }
    });
  });

  describe('field errors', () => {
    it('rejects an empty catId', () => {
      const result = validateAndCoerceTransferForm({
        ...DEFAULT_TRANSFER_FORM_VALUES,
        recipient: 'bc1qaaa',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.catId).toMatch(/required/);
    });

    it('rejects a malformed catId (missing i<vout>)', () => {
      const result = validateAndCoerceTransferForm({
        catId: '0'.repeat(64),
        recipient: 'bc1qaaa',
        feeRate: '5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.catId).toMatch(/64-hex-txid/);
    });

    it('rejects a malformed catId (uppercase hex)', () => {
      const result = validateAndCoerceTransferForm({
        catId: `${'A'.repeat(64)}i0`,
        recipient: 'bc1qaaa',
        feeRate: '5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.catId).toMatch(/64-hex-txid/);
    });

    it('rejects an empty recipient', () => {
      const result = validateAndCoerceTransferForm({
        catId: VALID_CAT_ID,
        recipient: '',
        feeRate: '5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.recipient).toMatch(/required/);
    });

    it('rejects a non-integer fee rate', () => {
      const result = validateAndCoerceTransferForm({
        catId: VALID_CAT_ID,
        recipient: 'bc1qaaa',
        feeRate: '2.5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.feeRate).toMatch(/positive integer/);
    });
  });
});
