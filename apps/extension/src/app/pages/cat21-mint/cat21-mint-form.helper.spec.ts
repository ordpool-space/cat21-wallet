import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MINT_FORM_VALUES,
  validateAndCoerceMintForm,
} from './cat21-mint-form.helper';

describe('validateAndCoerceMintForm', () => {
  describe('happy path', () => {
    it('coerces the minimum-viable form into an intent (no tip)', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent).toEqual({
          recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          feeRate: 5,
        });
      }
    });

    it('attaches a tip when both address and value are present', () => {
      const result = validateAndCoerceMintForm({
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: '10',
        tipAddress: 'bc1qother',
        tipValueSats: '1000',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent.tip).toEqual({ address: 'bc1qother', value: 1000 });
      }
    });

    it('trims whitespace on the recipient + tip address', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: '  bc1qaaa  ',
        tipAddress: '  bc1qbbb  ',
        tipValueSats: '500',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent.recipient).toBe('bc1qaaa');
        expect(result.intent.tip?.address).toBe('bc1qbbb');
      }
    });
  });

  describe('field errors', () => {
    it('rejects an empty recipient', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.recipient).toMatch(/required/);
      }
    });

    it('rejects a whitespace-only recipient', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: '   ',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.recipient).toMatch(/required/);
      }
    });

    it('rejects a non-integer fee rate', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: 'bc1qaaa',
        feeRate: '1.5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.feeRate).toMatch(/positive integer/);
      }
    });

    it('rejects a non-positive fee rate', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: 'bc1qaaa',
        feeRate: '0',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.feeRate).toMatch(/positive integer/);
      }
    });

    it('rejects a partial tip (address only)', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: 'bc1qaaa',
        tipAddress: 'bc1qother',
        tipValueSats: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.tipAddress).toMatch(/both/);
        expect(result.errors.tipValueSats).toMatch(/both/);
      }
    });

    it('rejects a partial tip (value only)', () => {
      const result = validateAndCoerceMintForm({
        ...DEFAULT_MINT_FORM_VALUES,
        recipient: 'bc1qaaa',
        tipAddress: '',
        tipValueSats: '1000',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.tipAddress).toMatch(/both/);
      }
    });

    it('rejects a zero or non-integer tip value', () => {
      const zero = validateAndCoerceMintForm({
        recipient: 'bc1qaaa',
        feeRate: '5',
        tipAddress: 'bc1qother',
        tipValueSats: '0',
      });
      expect(zero.ok).toBe(false);
      if (!zero.ok) expect(zero.errors.tipValueSats).toMatch(/positive integer/);

      const frac = validateAndCoerceMintForm({
        recipient: 'bc1qaaa',
        feeRate: '5',
        tipAddress: 'bc1qother',
        tipValueSats: '1.5',
      });
      expect(frac.ok).toBe(false);
      if (!frac.ok) expect(frac.errors.tipValueSats).toMatch(/positive integer/);
    });
  });

  describe('default values', () => {
    it('default values produce an error (empty recipient) — user must type one', () => {
      const result = validateAndCoerceMintForm(DEFAULT_MINT_FORM_VALUES);
      expect(result.ok).toBe(false);
    });
  });
});
