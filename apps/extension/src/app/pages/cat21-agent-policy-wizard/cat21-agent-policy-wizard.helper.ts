import type { AgentPolicy } from 'ordpool-sdk/core';

/**
 * Form-values shape used by the wizard. Numeric fields are typed as
 * `string` because HTML form inputs always emit strings; we coerce
 * to numbers via `validateAndCoerceWizardValues` at submit time.
 *
 * The "free-form" field `allowedCounterpartiesRaw` is split on `,` and
 * `\n` at submit. Empty (whitespace only) means "allow any".
 */
export interface AgentPolicyWizardValues {
  enabled: boolean;
  maxSpendPerActionSats: string;
  dailyCapSats: string;
  maxFeeRateSatPerVbyte: string;
  floorPriceSatsPerCat: string;
  allowedCounterpartiesRaw: string;
}

/**
 * Sane defaults the wizard pre-fills. Bias toward conservative caps so
 * a user who clicks-through-without-thinking gets a "small dosage" of
 * autonomy rather than a wide-open agent.
 *
 *   - per-action cap 10 000 sats — about a single mint at 5 sat/vB
 *   - daily cap     100 000 sats — ten mints / day
 *   - fee-rate       50 sat/vB    — well above current mainnet floors
 *                                   without being a runaway-bid surface
 *   - floor price   21 000 sats   — anchored to CAT-21 lore
 */
export const DEFAULT_WIZARD_VALUES: AgentPolicyWizardValues = {
  enabled: true,
  maxSpendPerActionSats: '10000',
  dailyCapSats: '100000',
  maxFeeRateSatPerVbyte: '50',
  floorPriceSatsPerCat: '21000',
  allowedCounterpartiesRaw: '',
};

type AgentPolicyValidationResult =
  | { ok: true; policy: AgentPolicy }
  | { ok: false; errors: Record<keyof AgentPolicyWizardValues, string | undefined> };

/**
 * Coerce + validate the wizard's form values into a real `AgentPolicy`.
 * Returns either the coerced policy (on success) OR per-field error
 * strings the wizard can drop next to each input.
 *
 * Rules:
 *   - all four sat fields: positive integer (parseable as a Number AND
 *     `Number.isInteger` AND > 0)
 *   - `allowedCounterpartiesRaw`: split on `,` and `\n`, trim, drop
 *     empties. Non-empty entries pass through verbatim — address-shape
 *     validation lives elsewhere (the SDK's offer validator checks
 *     `seller === buyer` and similar at sign time).
 *   - `enabled === false` is allowed (lets the user "save off" a policy
 *     with caps pre-set, ready to flip on later).
 */
export function validateAndCoerceWizardValues(
  values: AgentPolicyWizardValues
): AgentPolicyValidationResult {
  const errors: AgentPolicyValidationResult & { ok: false } = {
    ok: false,
    errors: {
      enabled: undefined,
      maxSpendPerActionSats: undefined,
      dailyCapSats: undefined,
      maxFeeRateSatPerVbyte: undefined,
      floorPriceSatsPerCat: undefined,
      allowedCounterpartiesRaw: undefined,
    },
  };

  function coercePositiveInt(
    raw: string,
    field: keyof AgentPolicyWizardValues,
    label: string
  ): number | null {
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      errors.errors[field] = `${label} must be a positive integer (sats)`;
      return null;
    }
    return n;
  }

  const maxSpendPerActionSats = coercePositiveInt(
    values.maxSpendPerActionSats,
    'maxSpendPerActionSats',
    'Per-action cap'
  );
  const dailyCapSats = coercePositiveInt(values.dailyCapSats, 'dailyCapSats', 'Daily cap');
  const maxFeeRateSatPerVbyte = coercePositiveInt(
    values.maxFeeRateSatPerVbyte,
    'maxFeeRateSatPerVbyte',
    'Max fee-rate'
  );
  const floorPriceSatsPerCat = coercePositiveInt(
    values.floorPriceSatsPerCat,
    'floorPriceSatsPerCat',
    'Floor price per cat'
  );

  const allowedCounterparties = values.allowedCounterpartiesRaw
    .split(/[,\n]+/u)
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);

  if (
    maxSpendPerActionSats === null ||
    dailyCapSats === null ||
    maxFeeRateSatPerVbyte === null ||
    floorPriceSatsPerCat === null
  ) {
    return errors;
  }

  // dailyCap must be at least per-action cap, otherwise a single action
  // can violate the daily limit on first use. Defensive sanity, not a
  // protocol invariant.
  if (dailyCapSats < maxSpendPerActionSats) {
    return {
      ok: false,
      errors: {
        ...errors.errors,
        dailyCapSats: 'Daily cap must be at least the per-action cap',
      },
    };
  }

  return {
    ok: true,
    policy: {
      enabled: values.enabled,
      maxSpendPerActionSats,
      dailyCapSats,
      maxFeeRateSatPerVbyte,
      floorPriceSatsPerCat,
      allowedCounterparties,
    },
  };
}
