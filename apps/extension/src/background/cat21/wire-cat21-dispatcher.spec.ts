import type { AgentPolicy } from 'ordpool-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import type { RootState } from '@app/store';
import { agentPolicySlice } from '@app/store/agent-policy/agent-policy.slice';

import { wireCat21Dispatcher } from './wire-cat21-dispatcher';

function policy(overrides: Partial<AgentPolicy> = {}): AgentPolicy {
  return {
    enabled: true,
    maxSpendPerActionSats: 10_000,
    dailyCapSats: 100_000,
    maxFeeRateSatPerVbyte: 50,
    floorPriceSatsPerCat: 21_000,
    allowedCounterparties: [],
    ...overrides,
  };
}

function rootWith(state: ReturnType<typeof agentPolicySlice.reducer>): RootState {
  return { agentPolicy: state } as unknown as RootState;
}

/**
 * The minimum-viable shape that satisfies enforceMintInvariants for an
 * autonomous mint test. The exact field set lives in
 * `Cat21MintIntent` (apps/extension/src/background/cat21/types.ts) but
 * we keep this helper in-spec to avoid coupling to the implementation
 * file location during the dispatcher refactor.
 */
function autonomousMintMessage(feeRate = 5) {
  return {
    type: 'cat21_mint' as const,
    requestId: 'req-test',
    intent: {
      recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      feeRate,
      mode: 'autonomous' as const,
    },
  };
}

describe('wireCat21Dispatcher', () => {
  it('denies an autonomous call with agent-disabled when the account has no policy', async () => {
    const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
    const dispatcher = wireCat21Dispatcher({
      getState: () => rootWith(state),
      dispatch: vi.fn(),
      accountId: 'acct-fresh',
      dayKeyFn: () => '2026-06-17',
    });

    const reply = await dispatcher.handle(autonomousMintMessage(), 'mcp-nmh');
    expect(reply.result.ok).toBe(false);
    if (!reply.result.ok) {
      expect(reply.result.value.reason).toBe('agent-disabled');
    }
  });

  it('allows the autonomous path past the policy gate when the policy permits the action', async () => {
    // Policy that allows a 5 sat/vB mint (under the 50 sat/vB ceiling).
    // The dispatcher will pass the gate and then fall through to the
    // wiring-pending sign/broadcast stubs, surfacing a typed denial
    // there. We only assert that the gate was NOT the denial source.
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.setPolicyForAccount({
        accountId: 'acct-a',
        policy: policy({
          enabled: true,
          maxSpendPerActionSats: 100_000,
          dailyCapSats: 1_000_000,
          maxFeeRateSatPerVbyte: 50,
        }),
      })
    );
    const dispatcher = wireCat21Dispatcher({
      getState: () => rootWith(state),
      dispatch: vi.fn(),
      accountId: 'acct-a',
      dayKeyFn: () => '2026-06-17',
    });

    const reply = await dispatcher.handle(autonomousMintMessage(5), 'mcp-nmh');
    expect(reply.result.ok).toBe(false);
    if (!reply.result.ok) {
      // Not the policy gate — must be a downstream wiring-pending failure.
      expect(reply.result.value.reason).not.toBe('agent-disabled');
      expect(reply.result.value.reason).not.toBe('policy-denied');
    }
  });

  it('denies via policy-denied when fee-rate exceeds the policy ceiling', async () => {
    // Policy allows mint, but caps fee-rate at 4 sat/vB. The test
    // calls with feeRate=10 → policy denies with 'fee-rate-above-ceiling'
    // which the dispatcher folds into rpc-reason 'policy-denied'.
    const state = agentPolicySlice.reducer(
      undefined,
      agentPolicySlice.actions.setPolicyForAccount({
        accountId: 'acct-a',
        policy: policy({
          enabled: true,
          maxFeeRateSatPerVbyte: 4,
        }),
      })
    );
    const dispatcher = wireCat21Dispatcher({
      getState: () => rootWith(state),
      dispatch: vi.fn(),
      accountId: 'acct-a',
      dayKeyFn: () => '2026-06-17',
    });

    const reply = await dispatcher.handle(autonomousMintMessage(10), 'mcp-nmh');
    expect(reply.result.ok).toBe(false);
    if (!reply.result.ok) {
      expect(reply.result.value.reason).toBe('policy-denied');
      expect(reply.result.value.detail).toMatch(/fee-rate-above-ceiling/);
    }
  });

  it('constructs without a dayKeyFn (defaults to UTC YYYY-MM-DD)', () => {
    const state = agentPolicySlice.reducer(undefined, { type: 'noop' });
    const dispatcher = wireCat21Dispatcher({
      getState: () => rootWith(state),
      dispatch: vi.fn(),
      accountId: 'acct-a',
    });
    expect(dispatcher).toBeDefined();
  });
});
