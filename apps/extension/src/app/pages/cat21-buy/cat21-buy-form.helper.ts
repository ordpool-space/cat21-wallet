import { parseBuyOfferQueryParams } from 'ordpool-sdk/core';

import type { Cat21BuyIntent } from '@background/cat21/types';

/**
 * Pure helpers for the Cat21 Buy page. Two jobs:
 *
 *   1. `parseBuyTargetInput` — turn the single discovery field (a bare
 *      cat number OR a shared ask link / query string) into the
 *      target's cat number + any ask price + seller payment address
 *      the link carried.
 *   2. `validateAndCoerceBuyForm` — turn the resolved target + the bid
 *      / fee inputs into a `Cat21BuyIntent`, catching obvious mistakes.
 *
 * The SDK gate (`validateBuy`) is the security boundary; this helper
 * only produces field-level errors so the form is pleasant to use.
 *
 * The seller payment address ALWAYS comes from the link's `payTo` or
 * the Bazaar listing — NEVER from an on-chain owner lookup (payment-
 * address-provenance HARD RULE). This helper only parses what the
 * link carried; it never derives an address.
 */

export interface Cat21BuyFormValues {
  bidSats: string;
  feeRate: string;
}

export const DEFAULT_BUY_FORM_VALUES: Cat21BuyFormValues = {
  bidSats: '',
  feeRate: '5',
};

export interface ParsedBuyTarget {
  catNumber: number | null;
  askSats: number | null;
  sellerPaymentAddress: string | null;
}

/**
 * Parse the discovery input. Accepts:
 *   - a bare cat number (`"42"`) → `{ catNumber: 42 }`, nothing else;
 *     the by-number path then looks the listing up on the Bazaar.
 *   - a shared buy-offer link or query string (the format cat21.space
 *     produces for sharing to a buyer:
 *     `"https://…?catNumber=42&askPrice=21000&payTo=bc1…"` or the bare
 *     query string) → the SDK's `parseBuyOfferQueryParams` extracts
 *     every field the seller pinned.
 */
export function parseBuyTargetInput(input: string): ParsedBuyTarget {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { catNumber: null, askSats: null, sellerPaymentAddress: null };
  }
  if (/^\d+$/u.test(trimmed)) {
    return { catNumber: Number(trimmed), askSats: null, sellerPaymentAddress: null };
  }
  const parsed = parseBuyOfferQueryParams(extractQueryParams(trimmed));
  return {
    catNumber: parsed.catNumber,
    askSats: parsed.askSats,
    // `sellerPaymentAddress` is a branded PaymentAddress | null; it is
    // string-assignable and travels as-is into the intent.
    sellerPaymentAddress: parsed.sellerPaymentAddress,
  };
}

/**
 * Pull the query part out of whatever the buyer pasted: a full URL
 * (`…?a=b`), a hash-fragment link (`…#a=b`), or a bare query string
 * (`a=b&c=d`). Everything else parses to an empty param set.
 */
function extractQueryParams(input: string): URLSearchParams {
  const qIdx = input.indexOf('?');
  if (qIdx >= 0) return new URLSearchParams(input.slice(qIdx + 1));
  const hashIdx = input.indexOf('#');
  if (hashIdx >= 0) return new URLSearchParams(input.slice(hashIdx + 1));
  if (input.includes('=')) return new URLSearchParams(input);
  return new URLSearchParams();
}

type Cat21BuyFormResult =
  | { ok: true; intent: Cat21BuyIntent }
  | { ok: false; errors: Record<keyof Cat21BuyFormValues, string | undefined> };

/**
 * Coerce the resolved target + bid/fee inputs into a `Cat21BuyIntent`.
 * `catId` (inscription id), `catNumber`, and `sellerPaymentAddress`
 * are resolved upstream (cat21-ord + the link/listing); this validates
 * only the buyer-typed bid + fee.
 */
export function validateAndCoerceBuyForm(args: {
  values: Cat21BuyFormValues;
  catId: string;
  catNumber: number;
  sellerPaymentAddress: string;
}): Cat21BuyFormResult {
  const errors: Cat21BuyFormResult & { ok: false } = {
    ok: false,
    errors: { bidSats: undefined, feeRate: undefined },
  };

  const bidSats = Number(args.values.bidSats);
  if (!Number.isFinite(bidSats) || !Number.isInteger(bidSats) || bidSats <= 0) {
    errors.errors.bidSats = 'Bid must be a positive integer (sats)';
  }

  const feeRate = Number(args.values.feeRate);
  if (!Number.isFinite(feeRate) || !Number.isInteger(feeRate) || feeRate <= 0) {
    errors.errors.feeRate = 'Fee rate must be a positive integer (sat/vB)';
  }

  if (Object.values(errors.errors).some(v => v !== undefined)) {
    return errors;
  }

  return {
    ok: true,
    intent: {
      catId: args.catId,
      catNumber: args.catNumber,
      bidSats,
      sellerPaymentAddress: args.sellerPaymentAddress,
      feeRate,
    },
  };
}
