import { describe, expect, it } from 'vitest';

import { validateAcceptOffer } from './accept-offer-validator';

describe('validateAcceptOffer', () => {

  it.todo('delegates to the SDK callback with the correct ValidateCat21BuyOfferArgs shape');
  it.todo('passes intent.expectedPriceSats as floorPriceSats (intent pins floor)');
  it.todo('passes expectedSellerPaymentAddress + network through to the SDK');
  it.todo('returns the SDK ok-success verbatim when SDK accepts AND pricePaidSats equals expected');
  it.todo('returns wrong-price ValidationFailure when SDK accepts but pricePaidSats > expected');
  it.todo('returns the SDK ValidationFailure verbatim when SDK rejects');

  it('module export is wired (smoke test)', () => {
    expect(validateAcceptOffer).toBeTypeOf('function');
  });
});
