import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Form, Formik } from 'formik';
import { Flex, styled } from 'leather-styles/jsx';
import type { AgentActionKind } from 'ordpool-sdk/core';

import { Button } from '@leather.io/ui';

import { ErrorLabel } from '@app/components/error-label';
import { Content } from '@app/components/layout';
import {
  useAgentPolicyForCurrentAccount,
  useSetAgentPolicyForCurrentAccount,
} from '@app/store/agent-policy/agent-policy.hooks';

import { Cat21FormField } from '../cat21-shared/cat21-form-field';
import {
  AGENT_OPERATION_KINDS,
  type AgentPolicyWizardValues,
  DEFAULT_WIZARD_VALUES,
  validateAndCoerceWizardValues,
} from './cat21-agent-policy-wizard.helper';

/**
 * Human-readable label per operation kind. Kept colocated with the
 * wizard because no other consumer needs this mapping.
 */
const OPERATION_LABELS: Record<AgentActionKind, string> = {
  cat21_mint: 'Mint',
  cat21_transfer: 'Transfer',
  cat21_create_offer: 'List for sale',
  cat21_accept_offer: 'Accept offers',
  cat21_buy: 'Buy (bid)',
};

/**
 * Cat21 agent-policy wizard (iter 10c).
 *
 * Lets the user configure or re-configure the per-account `AgentPolicy`
 * that gates Path 3 (YOLO / agent mode — see CLAUDE.md). The wizard
 * lands at `RouteUrls.Cat21AgentPolicy` (registered in routes.tsx in a
 * later slice); for now the component is mountable from
 * the settings page once the route entry lands.
 *
 * Conservative design choices:
 *
 *   - Single-page form (not multi-step). Easier to scan and re-edit.
 *   - All caps default to "small dosage" so a user clicking through
 *     without thinking gets a low-blast-radius policy.
 *   - "Save off" supported: a user can pre-set caps with `enabled:
 *     false` and flip on later from the settings page.
 *   - Validation surfaces ALL field errors at once rather than the
 *     first one, so the user can fix the whole form in one pass.
 *
 * The component reads any existing policy via
 * `useAgentPolicyForCurrentAccount` and pre-fills the form with it.
 * New accounts get the default values.
 */
export function Cat21AgentPolicyWizard() {
  const navigate = useNavigate();
  const existingPolicy = useAgentPolicyForCurrentAccount();
  const setPolicy = useSetAgentPolicyForCurrentAccount();
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Formik treats `initialValues` as stable: a fresh object reference
  // on every render makes it think the user-entered values should be
  // reset. Memoize against the upstream policy so editing a field
  // doesn't blow the form away.
  const initialValues = useMemo<AgentPolicyWizardValues>(
    () =>
      existingPolicy
        ? {
            enabled: existingPolicy.enabled,
            maxSpendPerActionSats: String(existingPolicy.maxSpendPerActionSats),
            dailyCapSats: String(existingPolicy.dailyCapSats),
            maxFeeRateSatPerVbyte: String(existingPolicy.maxFeeRateSatPerVbyte),
            floorPriceSatsPerCat: String(existingPolicy.floorPriceSatsPerCat),
            allowedCounterpartiesRaw: existingPolicy.allowedCounterparties.join('\n'),
            // An existing policy without `allowedOperations` means "no
            // restriction"; render every kind checked. An explicit
            // non-empty list checks only the listed kinds. The coerce
            // step on save collapses all-checked back to omitted.
            allowedOperations: AGENT_OPERATION_KINDS.reduce(
              (acc, k) => {
                acc[k] = existingPolicy.allowedOperations?.includes(k) ?? true;
                return acc;
              },
              {} as Record<AgentActionKind, boolean>
            ),
          }
        : DEFAULT_WIZARD_VALUES,
    [existingPolicy]
  );

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={values => {
        const result = validateAndCoerceWizardValues(values);
        if (!result.ok) {
          setGlobalError('Please fix the highlighted fields.');
          return;
        }
        setPolicy(result.policy);
        setGlobalError(null);
        void navigate(-1);
      }}
    >
      {({ handleChange, handleSubmit, values, isSubmitting, setFieldValue }) => {
        const validation = validateAndCoerceWizardValues(values);
        const fieldErrors = validation.ok ? null : validation.errors;

        return (
          <Content>
            <Flex direction="column" gap="space.05" px="space.05">
              <styled.h1 textStyle="heading.03">CAT-21 agent mode</styled.h1>
              <styled.p textStyle="body.02">
                Configure the caps an MCP-host agent must obey to mint, transfer, list, or accept
                CAT-21 cats from this account without prompting you. Conservative defaults are
                pre-filled; tighten or loosen as needed. You can turn agent mode off without losing
                the caps.
              </styled.p>
              <Form data-testid="cat21-agent-policy-form">
                <Flex direction="column" gap="space.04">
                  <Cat21FormField
                    label="Agent mode enabled"
                    name="enabled"
                    type="checkbox"
                    checked={values.enabled}
                    onChange={handleChange}
                  />
                  <Cat21FormField
                    label="Per-action cap (sats)"
                    name="maxSpendPerActionSats"
                    type="number"
                    value={values.maxSpendPerActionSats}
                    onChange={handleChange}
                    error={fieldErrors?.maxSpendPerActionSats}
                  />
                  <Cat21FormField
                    label="Daily cap (sats)"
                    name="dailyCapSats"
                    type="number"
                    value={values.dailyCapSats}
                    onChange={handleChange}
                    error={fieldErrors?.dailyCapSats}
                  />
                  <Cat21FormField
                    label="Max fee-rate (sat/vB)"
                    name="maxFeeRateSatPerVbyte"
                    type="number"
                    value={values.maxFeeRateSatPerVbyte}
                    onChange={handleChange}
                    error={fieldErrors?.maxFeeRateSatPerVbyte}
                  />
                  <Cat21FormField
                    label="Floor price per cat (sats)"
                    name="floorPriceSatsPerCat"
                    type="number"
                    value={values.floorPriceSatsPerCat}
                    onChange={handleChange}
                    error={fieldErrors?.floorPriceSatsPerCat}
                  />
                  <Cat21FormField
                    label="Allowed counterparties (one address per line, leave blank to allow any)"
                    name="allowedCounterpartiesRaw"
                    as="textarea"
                    value={values.allowedCounterpartiesRaw}
                    onChange={handleChange}
                  />
                  <Flex direction="column" gap="space.01">
                    <styled.label textStyle="label.02">
                      Allowed operations (check at least one; all-checked = no restriction)
                    </styled.label>
                    {AGENT_OPERATION_KINDS.map(kind => (
                      <Flex
                        key={kind}
                        as="label"
                        alignItems="center"
                        gap="space.02"
                        textStyle="body.02"
                      >
                        <styled.input
                          type="checkbox"
                          name={`allowedOperations.${kind}`}
                          data-testid={`cat21-agent-policy-op-${kind}`}
                          checked={values.allowedOperations[kind]}
                          onChange={e =>
                            void setFieldValue(`allowedOperations.${kind}`, e.target.checked)
                          }
                        />
                        {OPERATION_LABELS[kind]}
                      </Flex>
                    ))}
                  </Flex>
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
                  data-testid="cat21-agent-policy-save"
                >
                  Save policy
                </Button>
              </Flex>
            </Flex>
          </Content>
        );
      }}
    </Formik>
  );
}
