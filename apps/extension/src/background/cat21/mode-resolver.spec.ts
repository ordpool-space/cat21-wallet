import { describe, expect, it, vi } from 'vitest';

import { ModeResolverError, resolveSigningMode } from './mode-resolver';
import type { Cat21MintIntent } from './types';

function mintIntent(overrides: Partial<Cat21MintIntent> = {}): Cat21MintIntent {
  return {
    recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    feeRate: 5,
    ...overrides,
  };
}

function policyAllow() {
  return { allowed: true as const };
}

function policyDeny(reason = 'spend-above-action-cap', detail?: string) {
  return { allowed: false as const, reason, detail };
}

describe('resolveSigningMode', () => {
  describe('returns "manual" when caller did not request autonomous', () => {
    it('declared=undefined → manual', () => {
      const mode = resolveSigningMode({
        intent: mintIntent(),
        transport: 'mcp-nmh',
        agentMode: { enabled: true },
        evaluateAgentPolicy: policyAllow,
      });
      expect(mode).toBe('manual');
    });

    it('declared="manual" → manual', () => {
      const mode = resolveSigningMode({
        intent: mintIntent({ mode: 'manual' }),
        transport: 'mcp-nmh',
        agentMode: { enabled: true },
        evaluateAgentPolicy: policyAllow,
      });
      expect(mode).toBe('manual');
    });

    it('does not consult agentMode.enabled when declared !== "autonomous"', () => {
      // The resolver short-circuits when the caller didn't request autonomous.
      // If a future refactor consults agentMode for non-autonomous, this stub
      // throws and the test surfaces it loudly.
      const mode = resolveSigningMode({
        intent: mintIntent({ mode: 'manual' }),
        transport: 'mcp-nmh',
        agentMode: { enabled: true },
        evaluateAgentPolicy: () => {
          throw new Error('evaluateAgentPolicy must NOT be called for non-autonomous');
        },
      });
      expect(mode).toBe('manual');
    });

    it('does not consult evaluateAgentPolicy when declared !== "autonomous"', () => {
      const spy = vi.fn(policyAllow);
      resolveSigningMode({
        intent: mintIntent(),
        transport: 'mcp-nmh',
        agentMode: { enabled: true },
        evaluateAgentPolicy: spy,
      });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('returns "autonomous" only when all three guards pass', () => {
    it('declared="autonomous" + transport="mcp-nmh" + agentMode.enabled=true + policy.allowed=true → autonomous', () => {
      const mode = resolveSigningMode({
        intent: mintIntent({ mode: 'autonomous' }),
        transport: 'mcp-nmh',
        agentMode: { enabled: true },
        evaluateAgentPolicy: policyAllow,
      });
      expect(mode).toBe('autonomous');
    });
  });

  describe('throws ModeResolverError when caller requested autonomous but a guard failed', () => {
    it('declared="autonomous" + transport="popup" → throws ModeResolverError("transport-not-trusted-for-autonomous")', () => {
      try {
        resolveSigningMode({
          intent: mintIntent({ mode: 'autonomous' }),
          transport: 'popup',
          agentMode: { enabled: true },
          evaluateAgentPolicy: policyAllow,
        });
        throw new Error('did not throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ModeResolverError);
        expect((err as ModeResolverError).rejection).toBe('transport-not-trusted-for-autonomous');
      }
    });

    it('declared="autonomous" + transport="mcp-nmh" + agentMode.enabled=false → throws ModeResolverError("agent-disabled")', () => {
      try {
        resolveSigningMode({
          intent: mintIntent({ mode: 'autonomous' }),
          transport: 'mcp-nmh',
          agentMode: { enabled: false },
          evaluateAgentPolicy: policyAllow,
        });
        throw new Error('did not throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ModeResolverError);
        expect((err as ModeResolverError).rejection).toBe('agent-disabled');
      }
    });

    it('declared="autonomous" + transport="mcp-nmh" + agentMode.enabled=true + policy.allowed=false → throws ModeResolverError("policy-denied", detail)', () => {
      try {
        resolveSigningMode({
          intent: mintIntent({ mode: 'autonomous' }),
          transport: 'mcp-nmh',
          agentMode: { enabled: true },
          evaluateAgentPolicy: () => policyDeny('spend-above-action-cap', '21000 > 10000'),
        });
        throw new Error('did not throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ModeResolverError);
        expect((err as ModeResolverError).rejection).toBe('policy-denied');
      }
    });

    it('policy-denied error carries the SDK-supplied reason in detail verbatim', () => {
      try {
        resolveSigningMode({
          intent: mintIntent({ mode: 'autonomous' }),
          transport: 'mcp-nmh',
          agentMode: { enabled: true },
          evaluateAgentPolicy: () => policyDeny('fee-rate-above-ceiling', '900 > 50'),
        });
        throw new Error('did not throw');
      } catch (err) {
        expect((err as ModeResolverError).detail).toBe('fee-rate-above-ceiling: 900 > 50');
      }
    });

    it('policy-denied error works without a detail string on the SDK side', () => {
      try {
        resolveSigningMode({
          intent: mintIntent({ mode: 'autonomous' }),
          transport: 'mcp-nmh',
          agentMode: { enabled: true },
          evaluateAgentPolicy: () => policyDeny('agent-disabled'),
        });
        throw new Error('did not throw');
      } catch (err) {
        expect((err as ModeResolverError).detail).toBe('agent-disabled');
      }
    });
  });

  describe('safety properties', () => {
    it('never returns "autonomous" when caller did not explicitly declare it', () => {
      const cases: Cat21MintIntent[] = [
        mintIntent(),
        mintIntent({ mode: undefined }),
        mintIntent({ mode: 'manual' }),
      ];
      for (const intent of cases) {
        const mode = resolveSigningMode({
          intent,
          transport: 'mcp-nmh',
          agentMode: { enabled: true },
          evaluateAgentPolicy: policyAllow,
        });
        expect(mode).toBe('manual');
      }
    });

    it('never silently returns "manual" when caller requested "autonomous" (always throws on mismatch)', () => {
      const failingCombos = [
        { transport: 'popup' as const, enabled: true, policy: policyAllow },
        { transport: 'mcp-nmh' as const, enabled: false, policy: policyAllow },
        { transport: 'mcp-nmh' as const, enabled: true, policy: () => policyDeny() },
      ];
      for (const combo of failingCombos) {
        let caught: unknown;
        try {
          resolveSigningMode({
            intent: mintIntent({ mode: 'autonomous' }),
            transport: combo.transport,
            agentMode: { enabled: combo.enabled },
            evaluateAgentPolicy: combo.policy,
          });
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(ModeResolverError);
      }
    });

    it('is a pure function (no side effects, no I/O, deterministic in its args)', () => {
      const args = {
        intent: mintIntent({ mode: 'autonomous' as const }),
        transport: 'mcp-nmh' as const,
        agentMode: { enabled: true },
        evaluateAgentPolicy: policyAllow,
      };
      const first = resolveSigningMode(args);
      const second = resolveSigningMode(args);
      expect(first).toBe(second);
    });
  });
});
