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
  type Cat21TransferFormValues,
  DEFAULT_TRANSFER_FORM_VALUES,
  validateAndCoerceTransferForm,
} from './cat21-transfer-form.helper';

/**
 * Manual Transfer form (iter 13d). Standalone form-only page;
 * routes through `Cat21TransferConfirm` with the intent in
 * `location.state.intent`. Reads an optional `catId` from
 * `location.state.prefilledCatId` so per-cat action buttons
 * (iter 13f) can deep-link with the inscription id already
 * populated.
 */
export function Cat21TransferPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledCatId =
    (location.state as { prefilledCatId?: string } | null)?.prefilledCatId ?? '';
  const [globalError, setGlobalError] = useState<string | null>(null);

  const initialValues: Cat21TransferFormValues = {
    ...DEFAULT_TRANSFER_FORM_VALUES,
    catId: prefilledCatId,
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={values => {
        const result = validateAndCoerceTransferForm(values);
        if (!result.ok) {
          setGlobalError('Please fix the highlighted fields.');
          return;
        }
        setGlobalError(null);
        void navigate(RouteUrls.Cat21TransferConfirm, { state: { intent: result.intent } });
      }}
    >
      {({ handleChange, handleSubmit, values, isSubmitting }) => {
        const validation = validateAndCoerceTransferForm(values);
        const fieldErrors = validation.ok ? null : validation.errors;

        return (
          <Content>
            <Flex direction="column" gap="space.05" px="space.05">
              <styled.h1 textStyle="heading.03">Transfer a CAT-21</styled.h1>
              <styled.p textStyle="body.02">
                Send the cat at the given inscription id to a new owner. The next screen shows the
                full cost (postage + fee) before you sign.
              </styled.p>
              <Form data-testid="cat21-transfer-form">
                <Flex direction="column" gap="space.04">
                  <Cat21FormField
                    label="Cat ID (inscription id)"
                    name="catId"
                    value={values.catId}
                    onChange={handleChange}
                    error={fieldErrors?.catId}
                  />
                  <Cat21FormField
                    label="Recipient address"
                    name="recipient"
                    value={values.recipient}
                    onChange={handleChange}
                    error={fieldErrors?.recipient}
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
                  data-testid="cat21-transfer-form-submit"
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
