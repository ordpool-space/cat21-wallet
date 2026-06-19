import type { Cat21MintIntent } from '@background/cat21/types';

/**
 * Form-values shape used by the Cat21 mint page. Numeric fields are
 * typed as `string` because HTML form inputs always emit strings;
 * coercion to numbers happens at submit time inside
 * `validateAndCoerceMintForm`. The tip is optional; an empty
 * `tipValueSats` means "no tip output" (consistent with how the SDK
 * mint builder skips output 1 when tip value is 0).
 */
export interface Cat21MintFormValues {
  recipient: string;
  feeRate: string;
  tipAddress: string;
  tipValueSats: string;
}

/**
 * Conservative defaults: empty recipient (the user MUST type one),
 * 5 sat/vB (above current mainnet floor, well below congestion
 * peaks), no tip.
 */
export const DEFAULT_MINT_FORM_VALUES: Cat21MintFormValues = {
  recipient: '',
  feeRate: '5',
  tipAddress: '',
  tipValueSats: '',
};

type Cat21MintFormResult =
  | { ok: true; intent: Cat21MintIntent }
  | { ok: false; errors: Record<keyof Cat21MintFormValues, string | undefined> };

/**
 * Coerce + validate the form into a `Cat21MintIntent` ready for
 * `Cat21MintConfirm`. Strict at this layer is fine: the SDK gate
 * will re-validate everything downstream, but the user wants
 * field-level errors in the form rather than a single denial reason
 * on the confirm screen.
 *
 * Rules:
 *   - recipient: non-empty after trim; address-shape validation
 *     lives in the SDK gate.
 *   - feeRate: positive integer (decimals reject — the SDK gate
 *     wouldn't accept a fractional rate anyway).
 *   - tip: BOTH address and value are required if EITHER is present.
 *     Empty value AND empty address = no tip. Value 0 with a
 *     non-empty address rejects (use empty value instead).
 */
export function validateAndCoerceMintForm(values: Cat21MintFormValues): Cat21MintFormResult {
  const errors: Cat21MintFormResult & { ok: false } = {
    ok: false,
    errors: {
      recipient: undefined,
      feeRate: undefined,
      tipAddress: undefined,
      tipValueSats: undefined,
    },
  };

  const recipient = values.recipient.trim();
  if (recipient.length === 0) {
    errors.errors.recipient = 'Recipient address is required';
  }

  const feeRate = Number(values.feeRate);
  let feeRateValid = true;
  if (!Number.isFinite(feeRate) || !Number.isInteger(feeRate) || feeRate <= 0) {
    errors.errors.feeRate = 'Fee rate must be a positive integer (sat/vB)';
    feeRateValid = false;
  }

  const tipAddress = values.tipAddress.trim();
  const tipValueRaw = values.tipValueSats.trim();
  const tipPartial =
    (tipAddress.length > 0 && tipValueRaw.length === 0) ||
    (tipAddress.length === 0 && tipValueRaw.length > 0);
  if (tipPartial) {
    errors.errors.tipAddress = 'Tip needs both an address and a value (or leave both blank)';
    errors.errors.tipValueSats = 'Tip needs both an address and a value (or leave both blank)';
  }

  let tip: { address: string; value: number } | undefined;
  if (!tipPartial && tipAddress.length > 0 && tipValueRaw.length > 0) {
    const tipValue = Number(tipValueRaw);
    if (!Number.isFinite(tipValue) || !Number.isInteger(tipValue) || tipValue <= 0) {
      errors.errors.tipValueSats = 'Tip value must be a positive integer (sats)';
    } else {
      tip = { address: tipAddress, value: tipValue };
    }
  }

  const anyError = Object.values(errors.errors).some(v => v !== undefined);
  if (anyError || !feeRateValid) {
    return errors;
  }

  return {
    ok: true,
    intent: {
      recipient,
      feeRate,
      ...(tip !== undefined ? { tip } : {}),
    },
  };
}
