import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Form, Formik } from 'formik';
import { Flex, styled } from 'leather-styles/jsx';

import { Button } from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';

import { ErrorLabel } from '@app/components/error-label';
import { Content } from '@app/components/layout';

import { Cat21FormField } from '../cat21-shared/cat21-form-field';
import { DEFAULT_MINT_FORM_VALUES, validateAndCoerceMintForm } from './cat21-mint-form.helper';

/**
 * Manual Mint form (iter 13c). Lets a wallet user start a CAT-21
 * mint without going through cat21.space or an MCP agent. Submit
 * navigates to `RouteUrls.Cat21MintConfirm` with the parsed intent
 * in `location.state.intent` — the confirm route runs the SDK gate,
 * builds the PSBT, opens the Cat21-themed confirm dialog, and on
 * approval signs + broadcasts.
 *
 * This page does NOT run the gate itself; that's downstream's job.
 * Form-level validation only catches "user typed nonsense"; the
 * SDK gate is the security boundary.
 */
export function Cat21MintPage() {
  const navigate = useNavigate();
  const [globalError, setGlobalError] = useState<string | null>(null);

  return (
    <Formik
      initialValues={DEFAULT_MINT_FORM_VALUES}
      onSubmit={values => {
        const result = validateAndCoerceMintForm(values);
        if (!result.ok) {
          setGlobalError('Please fix the highlighted fields.');
          return;
        }
        setGlobalError(null);
        void navigate(RouteUrls.Cat21MintConfirm, { state: { intent: result.intent } });
      }}
    >
      {({ handleChange, handleSubmit, values, isSubmitting }) => {
        const validation = validateAndCoerceMintForm(values);
        const fieldErrors = validation.ok ? null : validation.errors;

        return (
          <Content>
            <Flex direction="column" gap="space.05" px="space.05">
              <styled.h1 textStyle="heading.03">Mint a CAT-21</styled.h1>
              <styled.p textStyle="body.02">
                Set the recipient address and your fee-rate budget. The next screen shows the full
                cost (postage + fee + optional tip) before you sign.
              </styled.p>
              <Form data-testid="cat21-mint-form">
                <Flex direction="column" gap="space.04">
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
                  <Cat21FormField
                    label="Tip address (optional)"
                    name="tipAddress"
                    value={values.tipAddress}
                    onChange={handleChange}
                    error={fieldErrors?.tipAddress}
                  />
                  <Cat21FormField
                    label="Tip value in sats (optional)"
                    name="tipValueSats"
                    type="number"
                    value={values.tipValueSats}
                    onChange={handleChange}
                    error={fieldErrors?.tipValueSats}
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
                  data-testid="cat21-mint-form-submit"
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
