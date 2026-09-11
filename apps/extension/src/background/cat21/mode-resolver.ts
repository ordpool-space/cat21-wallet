import type { Cat21Intent } from './types';

/**
 * Where the inbound Cat21 RPC call entered the background page.
 *
 *   - `popup`: from the wallet's own popup UI over Chrome's internal
 *     `chrome.runtime` channel (Path 2).
 *   - `mcp-nmh`: from the MCP NMH host process over Chrome Native
 *     Messaging (Path 3).
 *
 * Closed union by design. The background dispatcher must determine
 * transport at message-receive time from the port object; if it
 * cannot, that's a programming bug and the dispatcher throws — the
 * resolver never sees an unrecognised value.
 */
export type Cat21Transport = 'popup' | 'mcp-nmh';

/**
 * Per-account user-configured agent-mode policy state. The full policy
 * struct (per-action cap, daily cap, etc.) lives in the SDK; this
 * resolver only consults the `enabled` flag here and delegates the
 * per-intent gate to ordpool-sdk's `evaluateAgentPolicy`.
 */
export interface AgentModeFlag {
  enabled: boolean;
}

/**
 * Reasons the resolver can reject a request.
 *
 *   - `policy-denied`: a per-account CAP was exceeded. Fires in BOTH
 *     modes; caps bind a manual (human-confirmed) action exactly as an
 *     autonomous one, with no override.
 *   - `transport-not-trusted-for-autonomous` / `agent-disabled`: only an
 *     `'autonomous'` request can hit these; they gate silent-sign, not the
 *     caps.
 *
 * Note the absence of a "downgrade to manual" branch. If the caller
 * said `'autonomous'`, the caller meant it; silently returning
 * `'manual'` would either (a) surprise a bot expecting silent-sign,
 * or (b) push a popup at a user who already pressed something else.
 * Either way the caller learns about the rejection via a typed error
 * and decides for itself whether to retry with `mode: 'manual'`.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type ModeResolverRejection =
  | 'transport-not-trusted-for-autonomous'
  | 'agent-disabled'
  | 'policy-denied';

export class ModeResolverError extends Error {
  constructor(
    public readonly rejection: ModeResolverRejection,
    public readonly detail?: string
  ) {
    super(detail ? `${rejection}: ${detail}` : rejection);
    this.name = 'ModeResolverError';
  }
}

/**
 * Decides what signing mode applies to a Cat21 RPC call AND enforces the
 * per-account policy CAPS on the way (per CLAUDE.md HARD RULE #8 + Cat21
 * RPC architecture decision #6). The truth table:
 *
 *   ALWAYS, both modes:
 *     0. evaluateAgentPolicy(intent) → allowed   (the per-account caps)
 *        A configured cap binds every action, manual or autonomous. There
 *        is NO override: to raise a cap you change the policy value, you
 *        never bypass it. A cap failure throws policy-denied.
 *
 *   declared = undefined     →  return 'manual'
 *   declared = 'manual'      →  return 'manual'
 *   declared = 'autonomous'  →  additionally require:
 *     1. transport === 'mcp-nmh'
 *     2. agentMode.enabled === true
 *     If both pass          →  return 'autonomous'
 *     If either fails       →  throw ModeResolverError(typed rejection)
 *
 * `agentMode.enabled` gates only silent-sign, so it is NOT consulted for a
 * manual call. The caps (step 0) ARE. There is no downgrade path: a caller
 * that requested `'autonomous'` but failed guard 1 or 2 gets a typed error
 * and must explicitly re-call with `mode: 'manual'` to take the popup-
 * confirm path (where the same caps still apply).
 *
 * The spec at `mode-resolver.spec.ts` pins every branch of the truth table.
 */
export function resolveSigningMode(args: {
  intent: Cat21Intent;
  transport: Cat21Transport;
  agentMode: AgentModeFlag;
  /**
   * Resolution-derived spend for the cap gate, when the intent alone
   * doesn't carry it. Today only `cat21_transfer` supplies it (the whole
   * cat UTXO value, resolved from cat21-ord); the cap gate uses it as the
   * action's `spendSats` so the amount caps see the real outflow instead of
   * a placeholder. Omitted for every other kind (their spend is
   * intent-derived).
   */
  spendSatsOverride?: number;
  /**
   * Callback into the per-account cap gate (the wallet wires it to the
   * SDK's `evaluateAgentPolicyCaps` over the stored policy). Passed in
   * (rather than imported here) so the resolver stays SDK-version-agnostic
   * and the spec can stub the policy without spinning up a real SDK. It
   * enforces the CAPS only; the `enabled` flag is handled by `agentMode`
   * above, so this callback binds both manual and autonomous flows.
   */
  evaluateAgentPolicy(
    intent: Cat21Intent,
    spendSatsOverride?: number
  ): { allowed: true } | { allowed: false; reason: string; detail?: string };
}): 'autonomous' | 'manual' {
  // Caps bind BOTH modes. Enforce before the manual/autonomous split so a
  // misclicked amount or a pasted-wrong counterparty is caught even on a
  // human-confirmed manual action. No override: changing a cap means
  // changing the policy value, never a bypass here.
  const decision = args.evaluateAgentPolicy(args.intent, args.spendSatsOverride);
  if (!decision.allowed) {
    throw new ModeResolverError('policy-denied', describePolicyDenial(decision));
  }

  if (args.intent.mode !== 'autonomous') {
    return 'manual';
  }

  if (args.transport !== 'mcp-nmh') {
    throw new ModeResolverError(
      'transport-not-trusted-for-autonomous',
      `transport=${args.transport}`
    );
  }

  if (!args.agentMode.enabled) {
    throw new ModeResolverError('agent-disabled');
  }

  return 'autonomous';
}

function describePolicyDenial(decision: {
  allowed: false;
  reason: string;
  detail?: string;
}): string {
  return decision.detail ? `${decision.reason}: ${decision.detail}` : decision.reason;
}
