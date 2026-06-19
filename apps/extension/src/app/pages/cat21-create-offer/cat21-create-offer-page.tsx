import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Form, Formik } from 'formik';
import { Flex, styled } from 'leather-styles/jsx';

import { Button } from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';

import { ErrorLabel } from '@app/components/error-label';
import { Content } from '@app/components/layout';

import {
  type Cat21CreateOfferFormValues,
  DEFAULT_CREATE_OFFER_FORM_VALUES,
  validateAndCoerceCreateOfferForm,
} from './cat21-create-offer-form.helper';

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
  const state = (location.state as {
    prefilledCatId?: string;
    prefilledPaymentAddress?: string;
  } | null) ?? {};
  const [globalError, setGlobalError] = useState<string | null>(null);

  const initialValues: Cat21CreateOfferFormValues = {
    ...DEFAULT_CREATE_OFFER_FORM_VALUES,
    catId: state.prefilledCatId ?? '',
    paymentAddress:
      state.prefilledPaymentAddress ?? DEFAULT_CREATE_OFFER_FORM_VALUES.paymentAddress,
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={(values, { setSubmitting }) => {
        const result = validateAndCoerceCreateOfferForm(values);
        if (!result.ok) {
          setGlobalError('Please fix the highlighted fields.');
          setSubmitting(false);
          return;
        }
        setGlobalError(null);
        setSubmitting(false);
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
                Publish a structured listing for a cat you own. The next screen shows the listing
                bytes; you publish them to a marketplace yourself.
              </styled.p>
              <Form data-testid="cat21-create-offer-form">
                <Flex direction="column" gap="space.04">
                  <FormField
                    label="Cat ID (inscription id)"
                    name="catId"
                    value={values.catId}
                    onChange={handleChange}
                    error={fieldErrors?.catId}
                  />
                  <FormField
                    label="Asking price (sats)"
                    name="priceSats"
                    type="number"
                    value={values.priceSats}
                    onChange={handleChange}
                    error={fieldErrors?.priceSats}
                  />
                  <FormField
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

interface FormFieldProps {
  label: string;
  name: keyof Cat21CreateOfferFormValues;
  type?: 'text' | 'number';
  value: string;
  onChange(e: React.ChangeEvent<HTMLInputElement>): void;
  error?: string;
}

function FormField(props: FormFieldProps) {
  const { label, name, type, value, onChange, error } = props;
  return (
    <Flex direction="column" gap="space.01">
      <styled.label htmlFor={name} textStyle="label.02">
        {label}
      </styled.label>
      <styled.input
        id={name}
        name={name}
        type={type ?? 'text'}
        value={value}
        onChange={onChange}
        padding="space.02"
        borderColor="ink.border-default"
        borderWidth="1px"
        borderRadius="xs"
      />
      {error ? <ErrorLabel>{error}</ErrorLabel> : null}
    </Flex>
  );
}
