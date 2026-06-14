import { describe, it } from 'vitest';

/**
 * Spec contract for `resolveSigningMode`. The truth table from CLAUDE.md
 * HARD RULE #8 is encoded as a partition of `(declared mode, transport,
 * agent-mode flag, policy verdict)` combinations.
 *
 * Decisive choice: when the caller declared `'autonomous'` but any
 * guard fails, the resolver THROWS a typed `ModeResolverError`. It
 * does NOT silently downgrade to manual. Downgrading would (a)
 * surprise a bot expecting a silent-sign result, or (b) push a popup
 * onto a user who did not request one. Either is worse than a typed
 * error the caller can act on.
 */
describe('resolveSigningMode', () => {

  describe('returns "manual" when caller did not request autonomous', () => {
    it.todo('declared=undefined → manual');

    it.todo('declared="manual" → manual');

    it.todo('does not consult agentMode.enabled when declared !== "autonomous"');

    it.todo('does not consult evaluateAgentPolicy when declared !== "autonomous"');
  });

  describe('returns "autonomous" only when all three guards pass', () => {
    it.todo('declared="autonomous" + transport="mcp-nmh" + agentMode.enabled=true + policy.allowed=true → autonomous');
  });

  describe('throws ModeResolverError when caller requested autonomous but a guard failed', () => {
    it.todo('declared="autonomous" + transport="popup" → throws ModeResolverError("transport-not-trusted-for-autonomous")');

    it.todo('declared="autonomous" + transport="mcp-nmh" + agentMode.enabled=false → throws ModeResolverError("agent-disabled")');

    it.todo('declared="autonomous" + transport="mcp-nmh" + agentMode.enabled=true + policy.allowed=false → throws ModeResolverError("policy-denied", detail)');

    it.todo('policy-denied error carries the SDK-supplied reason in detail verbatim');
  });

  describe('safety properties', () => {
    it.todo('never returns "autonomous" when caller did not explicitly declare it');

    it.todo('never silently returns "manual" when caller requested "autonomous" (always throws on mismatch)');

    it.todo('is a pure function (no side effects, no I/O, deterministic in its args)');
  });
});
