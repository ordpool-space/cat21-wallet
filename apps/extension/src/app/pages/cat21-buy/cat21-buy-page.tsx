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
  type Cat21BuyFormValues,
  DEFAULT_BUY_FORM_VALUES,
  parseBuyTargetInput,
  validateAndCoerceBuyForm,
} from './cat21-buy-form.helper';
import { useCat21BuyTarget } from './use-cat21-buy-target';

/**
 * Manual Buy form — the BUYER side of the Bazaar. Discovery is
 * "permalink + by-number" (the chosen v1 UX): the buyer pastes a
 * shared ask link OR types a cat number, the page resolves the cat +
 * any listing, and the buyer sets a bid. Submitting lands on
 * `Cat21BuyConfirm` with a `Cat21BuyIntent` in `location.state.intent`;
 * the confirm route builds + buyer-signs the offer PSBT and POSTs it
 * to the Bazaar as a bid.
 *
 * Optional `location.state.prefilledTarget` deep-links the discovery
 * field (e.g. a "Buy" button on a cat detail elsewhere).
 */
export function Cat21BuyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { prefilledTarget?: string } | null) ?? {};

  const [targetInput, setTargetInput] = useState(state.prefilledTarget ?? '');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const target = useCat21BuyTarget();

  function lookUp() {
    setGlobalError(null);
    target.resolve(parseBuyTargetInput(targetInput));
  }

  const ready = target.view.step === 'ready' ? target.view : null;
  const sellerPaymentAddress = ready?.sellerPaymentAddress ?? null;
  const canBid = ready !== null && sellerPaymentAddress !== null;

  const initialValues: Cat21BuyFormValues = {
    ...DEFAULT_BUY_FORM_VALUES,
    bidSats: ready?.askSats != null ? String(ready.askSats) : '',
  };

  return (
    <Content>
      <Flex direction="column" gap="space.05" px="space.05">
        <styled.h1 textStyle="heading.03">Buy a CAT-21 cat</styled.h1>
        <styled.p textStyle="body.02">
          Paste a shared ask link, or enter a cat number to look it up on the Bazaar. Your bid is a
          signed buy-offer the seller can accept — you commit funds now, nothing moves until they
          do.
        </styled.p>

        <Flex direction="column" gap="space.03">
          <Cat21FormField
            label="Cat number or ask link"
            name="buyTarget"
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            error={undefined}
          />
          <Button
            variant="outline"
            fullWidth
            type="button"
            onClick={lookUp}
            data-testid="cat21-buy-lookup"
          >
            Find cat
          </Button>
        </Flex>

        {target.view.step === 'loading' ? (
          <styled.p textStyle="body.02" color="ink.text-subdued">
            Looking up the cat…
          </styled.p>
        ) : null}
        {target.view.step === 'not-found' ? (
          <ErrorLabel data-testid="cat21-buy-not-found">
            No cat with that number was found on cat21-ord.
          </ErrorLabel>
        ) : null}
        {target.view.step === 'error' ? (
          <ErrorLabel data-testid="cat21-buy-target-error">
            Could not look up the cat: {target.view.detail}
          </ErrorLabel>
        ) : null}

        {ready ? (
          <Flex
            direction="column"
            gap="space.02"
            p="space.04"
            bg="ink.background-secondary"
            borderRadius="sm"
            data-testid="cat21-buy-target-ready"
          >
            <styled.p textStyle="label.02">Cat #{ready.catNumber}</styled.p>
            {ready.askSats != null ? (
              <styled.p textStyle="body.02">Asking {ready.askSats.toLocaleString()} sats</styled.p>
            ) : (
              <styled.p textStyle="body.02" color="ink.text-subdued">
                No active listing — you can still bid.
              </styled.p>
            )}
            {sellerPaymentAddress === null ? (
              <styled.p textStyle="body.02" color="ink.text-subdued">
                No seller payment address on this cat. Paste the seller's full ask link to bid.
              </styled.p>
            ) : null}
          </Flex>
        ) : null}

        {canBid && ready && sellerPaymentAddress ? (
          <Formik
            initialValues={initialValues}
            enableReinitialize
            onSubmit={values => {
              const result = validateAndCoerceBuyForm({
                values,
                catId: ready.catId,
                catNumber: ready.catNumber,
                sellerPaymentAddress,
              });
              if (!result.ok) {
                setGlobalError('Please fix the highlighted fields.');
                return;
              }
              setGlobalError(null);
              void navigate(RouteUrls.Cat21BuyConfirm, { state: { intent: result.intent } });
            }}
          >
            {({ handleChange, handleSubmit, values }) => {
              const validation = validateAndCoerceBuyForm({
                values,
                catId: ready.catId,
                catNumber: ready.catNumber,
                sellerPaymentAddress,
              });
              const fieldErrors = validation.ok ? null : validation.errors;

              return (
                <Form data-testid="cat21-buy-form">
                  <Flex direction="column" gap="space.04">
                    <Cat21FormField
                      label="Your bid (sats)"
                      name="bidSats"
                      type="number"
                      value={values.bidSats}
                      onChange={handleChange}
                      error={fieldErrors?.bidSats}
                    />
                    <Cat21FormField
                      label="Fee rate (sat/vB)"
                      name="feeRate"
                      type="number"
                      value={values.feeRate}
                      onChange={handleChange}
                      error={fieldErrors?.feeRate}
                    />
                    {globalError ? <ErrorLabel>{globalError}</ErrorLabel> : null}
                    <Flex gap="space.03" pt="space.05">
                      <Button
                        variant="outline"
                        fullWidth
                        type="button"
                        onClick={() => {
                          void navigate(-1);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="solid"
                        fullWidth
                        type="button"
                        onClick={() => handleSubmit()}
                        data-testid="cat21-buy-form-submit"
                      >
                        Review bid
                      </Button>
                    </Flex>
                  </Flex>
                </Form>
              );
            }}
          </Formik>
        ) : null}
      </Flex>
    </Content>
  );
}
