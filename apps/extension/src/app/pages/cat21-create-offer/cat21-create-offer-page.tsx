import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Form, Formik } from 'formik';
import { Flex, styled } from 'leather-styles/jsx';

import { Button } from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';

import { ErrorLabel } from '@app/components/error-label';
import { Content } from '@app/components/layout';

import { Cat21FormField } from '../cat21-shared/cat21-form-field';
import {
  type Cat21CreateOfferFormValues,
  DEFAULT_CREATE_OFFER_FORM_VALUES,
  validateAndCoerceCreateOfferForm,
} from './cat21-create-offer-form.helper';
import { useCat21ListingFor } from './use-cat21-listing';

/**
 * Manual Create-Offer form (iter 13e). Standalone form-only page;
 * routes through `Cat21CreateOfferConfirm` with the intent in
 * `location.state.intent`. Reads optional pre-fills from
 * `location.state.prefilledCatId` / `prefilledPaymentAddress` so
 * per-cat action buttons (iter 13f) can deep-link with both fields
 * already populated.
 *
 * Note: this flow does NOT broadcast a Bitcoin tx — it emits a
 * structured listing the user / agent publishes off-chain. The
 * SDK's `createOffer` RPC returns `{ kind: 'listing', listing }`
 * and the confirm route shows the listing details.
 */
export function Cat21CreateOfferPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state =
    (location.state as {
      prefilledCatId?: string;
      prefilledPaymentAddress?: string;
    } | null) ?? {};
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Deep-linked from the cat list ("List for sale" on a specific cat)
  // → prefilledCatId. Look up any existing Bazaar listing for it so we
  // can show "already listed for X" + an Unlist button, driven off the
  // stable prefill (not the live form field, which would re-query per
  // keystroke and pull a hook into Formik's render prop).
  const listing = useCat21ListingFor(state.prefilledCatId ?? '');

  const initialValues: Cat21CreateOfferFormValues = {
    ...DEFAULT_CREATE_OFFER_FORM_VALUES,
    catId: state.prefilledCatId ?? '',
    paymentAddress:
      state.prefilledPaymentAddress ?? DEFAULT_CREATE_OFFER_FORM_VALUES.paymentAddress,
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={values => {
        const result = validateAndCoerceCreateOfferForm(values);
        if (!result.ok) {
          setGlobalError('Please fix the highlighted fields.');
          return;
        }
        setGlobalError(null);
        void navigate(RouteUrls.Cat21CreateOfferConfirm, { state: { intent: result.intent } });
      }}
    >
      {({ handleChange, handleSubmit, values, isSubmitting }) => {
        const validation = validateAndCoerceCreateOfferForm(values);
        const fieldErrors = validation.ok ? null : validation.errors;

        return (
          <Content>
            <Flex direction="column" gap="space.05" px="space.05">
              <styled.h1 textStyle="heading.03">List a CAT-21 for sale</styled.h1>
              <styled.p textStyle="body.02">
                Set an asking price and publish this cat to the CAT-21 Bazaar. Buyers browse the
                orderbook and can purchase it at your price. You can change the price by listing
                again, or take it down any time.
              </styled.p>
              {listing.view.step === 'listed' ? (
                <Flex
                  direction="column"
                  gap="space.02"
                  p="space.04"
                  bg="ink.background-secondary"
                  borderRadius="sm"
                  data-testid="cat21-already-listed"
                >
                  <styled.p textStyle="label.02">
                    Currently listed for {listing.view.askSats.toLocaleString()} sats
                  </styled.p>
                  <Button
                    variant="outline"
                    fullWidth
                    type="button"
                    onClick={() => listing.unlist()}
                    data-testid="cat21-unlist"
                  >
                    Unlist
                  </Button>
                </Flex>
              ) : null}
              {listing.view.step === 'unlisting' ? (
                <styled.p textStyle="body.02" color="ink.text-subdued">
                  Taking the listing down…
                </styled.p>
              ) : null}
              {listing.view.step === 'unlisted' ? (
                <styled.p textStyle="body.02" data-testid="cat21-unlisted">
                  Listing removed.
                </styled.p>
              ) : null}
              <Form data-testid="cat21-create-offer-form">
                <Flex direction="column" gap="space.04">
                  <Cat21FormField
                    label="Cat ID (inscription id)"
                    name="catId"
                    value={values.catId}
                    onChange={handleChange}
                    error={fieldErrors?.catId}
                  />
                  <Cat21FormField
                    label="Asking price (sats)"
                    name="priceSats"
                    type="number"
                    value={values.priceSats}
                    onChange={handleChange}
                    error={fieldErrors?.priceSats}
                  />
                  <Cat21FormField
                    label="Payment address (where the BTC lands)"
                    name="paymentAddress"
                    value={values.paymentAddress}
                    onChange={handleChange}
                    error={fieldErrors?.paymentAddress}
                  />
                  {globalError ? <ErrorLabel>{globalError}</ErrorLabel> : null}
                </Flex>
              </Form>
              <Flex gap="space.03" pt="space.05">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    void navigate(-1);
                  }}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  fullWidth
                  disabled={isSubmitting}
                  onClick={() => handleSubmit()}
                  type="button"
                  data-testid="cat21-create-offer-form-submit"
                >
                  Review
                </Button>
              </Flex>
            </Flex>
          </Content>
        );
      }}
    </Formik>
  );
}
