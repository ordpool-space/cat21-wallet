import type { Cat21CreateOfferIntent } from '@background/cat21/types';

/**
 * Form-values shape for the Cat21 Create-Offer page. The SDK gate
 * enforces:
 *   - catId regex (`<64-hex>i<vout>`)
 *   - priceSats >= 546 (postage floor)
 *   - paymentAddress shape + network match + counterparty allowlist
 *
 * This helper catches the obvious user mistakes (empty field,
 * fractional price) so the form can surface field-level errors;
 * the SDK gate is the security boundary.
 */
export interface Cat21CreateOfferFormValues {
  catId: string;
  priceSats: string;
  paymentAddress: string;
}

export const DEFAULT_CREATE_OFFER_FORM_VALUES: Cat21CreateOfferFormValues = {
  catId: '',
  priceSats: '21000',
  paymentAddress: '',
};

type Cat21CreateOfferFormResult =
  | { ok: true; intent: Cat21CreateOfferIntent }
  | { ok: false; errors: Record<keyof Cat21CreateOfferFormValues, string | undefined> };

const CAT_ID_RE = /^[0-9a-f]{64}i\d+$/u;

/** Postage floor (sats). Matches the SDK gate's check. */
const CAT21_POSTAGE_SATS = 546;

export function validateAndCoerceCreateOfferForm(
  values: Cat21CreateOfferFormValues,
): Cat21CreateOfferFormResult {
  const errors: Cat21CreateOfferFormResult & { ok: false } = {
    ok: false,
    errors: {
      catId: undefined,
      priceSats: undefined,
      paymentAddress: undefined,
    },
  };

  const catId = values.catId.trim();
  if (catId.length === 0) {
    errors.errors.catId = 'Cat ID is required';
  } else if (!CAT_ID_RE.test(catId)) {
    errors.errors.catId = 'Cat ID must look like <64-hex-txid>i<vout>';
  }

  const priceSats = Number(values.priceSats);
  if (!Number.isFinite(priceSats) || !Number.isInteger(priceSats) || priceSats <= 0) {
    errors.errors.priceSats = 'Price must be a positive integer (sats)';
  } else if (priceSats < CAT21_POSTAGE_SATS) {
    errors.errors.priceSats = `Price must be at least ${CAT21_POSTAGE_SATS} sats (postage floor)`;
  }

  const paymentAddress = values.paymentAddress.trim();
  if (paymentAddress.length === 0) {
    errors.errors.paymentAddress = 'Payment address is required';
  }

  if (Object.values(errors.errors).some(v => v !== undefined)) {
    return errors;
  }

  return {
    ok: true,
    intent: { catId, priceSats, paymentAddress },
  };
}
