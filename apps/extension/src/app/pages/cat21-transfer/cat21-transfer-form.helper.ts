import type { Cat21TransferIntent } from '@background/cat21/types';

/**
 * Form-values shape for the Cat21 Transfer page. Mirrors the Mint
 * form's helper (iter 13c). The catId field is pre-filled by the
 * per-cat action button (iter 13f) via location.state; users
 * arriving without that pre-fill can type the inscription id
 * directly.
 */
export interface Cat21TransferFormValues {
  catId: string;
  recipient: string;
  feeRate: string;
}

export const DEFAULT_TRANSFER_FORM_VALUES: Cat21TransferFormValues = {
  catId: '',
  recipient: '',
  feeRate: '5',
};

type Cat21TransferFormResult =
  | { ok: true; intent: Cat21TransferIntent }
  | { ok: false; errors: Record<keyof Cat21TransferFormValues, string | undefined> };

const CAT_ID_RE = /^[0-9a-f]{64}i\d+$/u;

/**
 * Coerce + validate the Transfer form. Form-level only — the SDK
 * gate re-validates everything (address shape, network match,
 * fee-rate caps) at the confirm step. The catId regex matches the
 * SDK gate's `<64-hex>i<vout>` pattern so the user gets a clean
 * field-level error rather than a generic gate denial when the
 * inscription id is malformed.
 */
export function validateAndCoerceTransferForm(
  values: Cat21TransferFormValues,
): Cat21TransferFormResult {
  const errors: Cat21TransferFormResult & { ok: false } = {
    ok: false,
    errors: {
      catId: undefined,
      recipient: undefined,
      feeRate: undefined,
    },
  };

  const catId = values.catId.trim();
  if (catId.length === 0) {
    errors.errors.catId = 'Cat ID is required';
  } else if (!CAT_ID_RE.test(catId)) {
    errors.errors.catId = 'Cat ID must look like <64-hex-txid>i<vout>';
  }

  const recipient = values.recipient.trim();
  if (recipient.length === 0) {
    errors.errors.recipient = 'Recipient address is required';
  }

  const feeRate = Number(values.feeRate);
  if (!Number.isFinite(feeRate) || !Number.isInteger(feeRate) || feeRate <= 0) {
    errors.errors.feeRate = 'Fee rate must be a positive integer (sat/vB)';
  }

  if (Object.values(errors.errors).some(v => v !== undefined)) {
    return errors;
  }

  return {
    ok: true,
    intent: { catId, recipient, feeRate },
  };
}
