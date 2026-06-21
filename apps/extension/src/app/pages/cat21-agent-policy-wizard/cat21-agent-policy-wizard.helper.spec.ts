import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WIZARD_VALUES,
  coerceAllowedOperations,
  validateAndCoerceWizardValues,
} from './cat21-agent-policy-wizard.helper';

describe('validateAndCoerceWizardValues', () => {
  describe('happy path', () => {
    it('coerces sat fields to numbers and trims allowed-counterparties', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        allowedCounterpartiesRaw: ' bc1qaaa , \n bc1qbbb \n ',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy).toEqual({
          enabled: true,
          maxSpendPerActionSats: 10_000,
          dailyCapSats: 100_000,
          maxFeeRateSatPerVbyte: 50,
          floorPriceSatsPerCat: 21_000,
          allowedCounterparties: ['bc1qaaa', 'bc1qbbb'],
        });
      }
    });

    it('passes the default values to a real AgentPolicy with no errors', () => {
      const result = validateAndCoerceWizardValues(DEFAULT_WIZARD_VALUES);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.allowedCounterparties).toEqual([]);
      }
    });

    it('accepts enabled === false (lets users pre-save a policy off)', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        enabled: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.enabled).toBe(false);
      }
    });
  });

  describe('field errors', () => {
    it('rejects non-positive per-action cap', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        maxSpendPerActionSats: '0',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.maxSpendPerActionSats).toMatch(/Per-action cap/);
      }
    });

    it('rejects decimal sats (must be integer)', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        dailyCapSats: '100.5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.dailyCapSats).toMatch(/Daily cap/);
      }
    });

    it('rejects non-numeric strings', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        maxFeeRateSatPerVbyte: 'fifty',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.maxFeeRateSatPerVbyte).toMatch(/Max fee-rate/);
      }
    });

    it('rejects daily cap below per-action cap', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        maxSpendPerActionSats: '50000',
        dailyCapSats: '10000',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.dailyCapSats).toMatch(/Daily cap must be at least/);
      }
    });

    it('returns ALL field errors at once (not just the first)', () => {
      // Wizard UX preference: show every error simultaneously so the
      // user can fix the whole form in one pass.
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        maxSpendPerActionSats: 'abc',
        dailyCapSats: '-1',
        maxFeeRateSatPerVbyte: '0',
        floorPriceSatsPerCat: '0.5',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.maxSpendPerActionSats).toBeDefined();
        expect(result.errors.dailyCapSats).toBeDefined();
        expect(result.errors.maxFeeRateSatPerVbyte).toBeDefined();
        expect(result.errors.floorPriceSatsPerCat).toBeDefined();
      }
    });
  });

  describe('allowed-counterparties parsing', () => {
    it('handles a single comma-separated line', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        allowedCounterpartiesRaw: 'a,b,c',
      });
      if (result.ok) {
        expect(result.policy.allowedCounterparties).toEqual(['a', 'b', 'c']);
      }
    });

    it('handles newline-separated entries', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        allowedCounterpartiesRaw: 'a\nb\nc',
      });
      if (result.ok) {
        expect(result.policy.allowedCounterparties).toEqual(['a', 'b', 'c']);
      }
    });

    it('treats whitespace-only as "allow any" (empty list)', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        allowedCounterpartiesRaw: '   \n  \n  ',
      });
      if (result.ok) {
        expect(result.policy.allowedCounterparties).toEqual([]);
      }
    });

    it('drops duplicate-trim entries silently (caller can refuse blanks)', () => {
      const result = validateAndCoerceWizardValues({
        ...DEFAULT_WIZARD_VALUES,
        allowedCounterpartiesRaw: 'a,,b,\n,c',
      });
      if (result.ok) {
        expect(result.policy.allowedCounterparties).toEqual(['a', 'b', 'c']);
      }
    });
  });
});

describe('coerceAllowedOperations', () => {
  it('returns undefined when ALL four kinds are checked (= permissive)', () => {
    expect(
      coerceAllowedOperations({
        cat21_mint: true,
        cat21_transfer: true,
        cat21_create_offer: true,
        cat21_accept_offer: true,
      })
    ).toBeUndefined();
  });

  it('returns undefined when NO kinds are checked (UI no-op; treated as permissive)', () => {
    expect(
      coerceAllowedOperations({
        cat21_mint: false,
        cat21_transfer: false,
        cat21_create_offer: false,
        cat21_accept_offer: false,
      })
    ).toBeUndefined();
  });

  it('returns just the picked kinds on a partial selection (mint only)', () => {
    expect(
      coerceAllowedOperations({
        cat21_mint: true,
        cat21_transfer: false,
        cat21_create_offer: false,
        cat21_accept_offer: false,
      })
    ).toEqual(['cat21_mint']);
  });

  it('preserves the AGENT_OPERATION_KINDS order regardless of selection order', () => {
    expect(
      coerceAllowedOperations({
        cat21_accept_offer: true,
        cat21_mint: true,
        cat21_create_offer: false,
        cat21_transfer: true,
      })
    ).toEqual(['cat21_mint', 'cat21_transfer', 'cat21_accept_offer']);
  });
});

describe('validateAndCoerceWizardValues — allowedOperations', () => {
  it('default wizard values (all four checked) produce a policy without allowedOperations field', () => {
    const result = validateAndCoerceWizardValues(DEFAULT_WIZARD_VALUES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.policy.allowedOperations).toBeUndefined();
    }
  });

  it('partial selection lands on the policy as a strict allowlist', () => {
    const result = validateAndCoerceWizardValues({
      ...DEFAULT_WIZARD_VALUES,
      allowedOperations: {
        cat21_mint: true,
        cat21_transfer: true,
        cat21_create_offer: false,
        cat21_accept_offer: false,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.policy.allowedOperations).toEqual(['cat21_mint', 'cat21_transfer']);
    }
  });
});
