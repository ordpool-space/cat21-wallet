import { describe, expect, it } from 'vitest';

import type { Cat21ActionKind } from '@background/cat21/popup-bridge';
import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

import { declaredCat21Intent } from './declared-cat21-intent';

/**
 * The confirm route executes the action its route DECLARES (HARD RULE #6: the
 * action kind rides in the method name). The payload must have that action's
 * shape; any other shape is refused, never re-routed to the action it happens
 * to look like. Field values are validated later by the SDK gate; this pins
 * only that declaration and payload agree.
 */

const CAT_ID = `${'01'.repeat(32)}i0`;
const ADDR = 'bc1qtest';

const mint: Cat21MintIntent = { recipient: ADDR, feeRate: 5 };
const transfer: Cat21TransferIntent = { catId: CAT_ID, recipient: ADDR, feeRate: 5 };
const createOffer: Cat21CreateOfferIntent = {
  catId: CAT_ID,
  priceSats: 10_000,
  paymentAddress: ADDR,
};
const acceptOffer: Cat21AcceptOfferIntent = {
  offerPsbt: 'cHNidP8=',
  expectedCatId: CAT_ID,
  expectedPriceSats: 10_000,
  expectedSellerUtxo: { txid: 'fe'.repeat(32), vout: 0 },
};
const buy: Cat21BuyIntent = {
  catId: CAT_ID,
  catNumber: 42,
  bidSats: 21_000,
  sellerPaymentAddress: ADDR,
  feeRate: 5,
};

const SHAPES: [Cat21ActionKind, Cat21Intent][] = [
  ['mint', mint],
  ['transfer', transfer],
  ['create_offer', createOffer],
  ['accept_offer', acceptOffer],
  ['buy', buy],
];

describe('declaredCat21Intent', () => {
  it.each(SHAPES)('a %s declaration with its own payload yields that action', (kind, intent) => {
    expect(declaredCat21Intent(kind, intent)).toEqual({ kind, intent });
  });

  // Every off-diagonal pair: the declared action and the payload disagree.
  const mismatches = SHAPES.flatMap(([declared]) =>
    SHAPES.filter(([payloadKind]) => payloadKind !== declared).map(
      ([payloadKind, intent]) => [declared, payloadKind, intent] as const
    )
  );

  it.each(mismatches)(
    'a %s declaration with a %s payload is refused',
    (declared, _payloadKind, intent) => {
      expect(declaredCat21Intent(declared, intent)).toBeNull();
    }
  );

  // A payload of the declared action that ALSO carries a field marking another
  // action (a mint with a `catId`, a transfer with a `bidSats`) is a second
  // action in disguise: refused. Each action's own fields are excluded.
  const MARKERS = {
    catId: CAT_ID,
    recipient: ADDR,
    priceSats: 10_000,
    bidSats: 21_000,
    offerPsbt: 'cHNidP8=',
  } as const;
  const OWN_FIELDS: Record<Cat21ActionKind, readonly (keyof typeof MARKERS)[]> = {
    mint: ['recipient'],
    transfer: ['catId', 'recipient'],
    create_offer: ['catId', 'priceSats'],
    accept_offer: ['offerPsbt'],
    buy: ['catId', 'bidSats'],
  };
  const disguises = SHAPES.flatMap(([kind, intent]) =>
    (Object.keys(MARKERS) as (keyof typeof MARKERS)[])
      .filter(marker => !OWN_FIELDS[kind].includes(marker))
      .map(marker => [kind, marker, { ...intent, [marker]: MARKERS[marker] }] as const)
  );

  it.each(disguises)('refuses a %s payload that also carries %s', (kind, _marker, disguised) => {
    expect(declaredCat21Intent(kind, disguised)).toBeNull();
  });
});
