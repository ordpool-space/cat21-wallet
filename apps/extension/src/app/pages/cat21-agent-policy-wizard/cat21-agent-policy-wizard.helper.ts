import type { AgentActionKind, AgentPolicy } from 'ordpool-sdk/core';

/**
 * The operation kinds the wizard's allowlist UI offers. Order is fixed
 * so the rendered checkboxes match the mental model of the pipeline
 * (mint → transfer → list → accept → buy). Matches the SDK's
 * `AgentActionKind` union verbatim.
 */
export const AGENT_OPERATION_KINDS: readonly AgentActionKind[] = [
  'cat21_mint',
  'cat21_transfer',
  'cat21_create_offer',
  'cat21_accept_offer',
  'cat21_buy',
];

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
  /**
   * Per-operation allowlist. UI shape is `Record<kind, boolean>`
   * (one checkbox per kind); coerce time turns it into the
   * `AgentActionKind[]` the slice stores. All-true OR all-false
   * collapse to empty array (= permissive) so a wallet user who
   * doesn't care about per-kind gating doesn't need to learn what
   * the field does.
   */
  allowedOperations: Record<AgentActionKind, boolean>;
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
  // Default permissive: every kind checked. The coerce step
  // collapses "all checked" to the empty array, which the SDK
  // treats as "no allowlist; all kinds accepted".
  allowedOperations: {
    cat21_mint: true,
    cat21_transfer: true,
    cat21_create_offer: true,
    cat21_accept_offer: true,
    cat21_buy: true,
  },
};

type AgentPolicyValidationResult =
  | { ok: true; policy: AgentPolicy }
  | { ok: false; errors: Record<keyof AgentPolicyWizardValues, string | undefined> };

/**
 * Collapse the checkbox map into the SDK's allowlist shape. Returns
 * `undefined` (= field omitted on AgentPolicy) when ALL kinds are
 * checked OR none are checked — both are "no restriction". The
 * settings UI treats those two extremes as equivalent so a user
 * staring at four checked checkboxes doesn't have to learn that
 * "all four checked" and "all four unchecked" behave the same.
 *
 * Only the partial-selection case (one to three boxes checked)
 * produces a real allowlist.
 */
/** @knipignore -- HACK Cat21: spec-only export (spec files are knip-ignored;
 * the spec covers the all-checked / none-checked collapse rule). */
export function coerceAllowedOperations(
  selection: Record<AgentActionKind, boolean>
): AgentActionKind[] | undefined {
  const picked = AGENT_OPERATION_KINDS.filter(k => selection[k]);
  if (picked.length === 0 || picked.length === AGENT_OPERATION_KINDS.length) {
    return undefined;
  }
  return picked;
}

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
      allowedOperations: undefined,
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

  const allowedOperations = coerceAllowedOperations(values.allowedOperations);

  return {
    ok: true,
    policy: {
      enabled: values.enabled,
      maxSpendPerActionSats,
      dailyCapSats,
      maxFeeRateSatPerVbyte,
      floorPriceSatsPerCat,
      allowedCounterparties,
      ...(allowedOperations !== undefined ? { allowedOperations } : {}),
    },
  };
}
