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
 * Reasons the resolver can reject an `'autonomous'` request.
 *
 * Note the absence of a "downgrade to manual" branch. If the caller
 * said `'autonomous'`, the caller meant it; silently returning
 * `'manual'` would either (a) surprise a bot expecting silent-sign,
 * or (b) push a popup at a user who already pressed something else.
 * Either way the caller learns about the rejection via a typed error
 * and decides for itself whether to retry with `mode: 'manual'`.
 */
export type ModeResolverRejection =
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
 * Decides what signing mode applies to a Cat21 RPC call. The truth
 * table (per CLAUDE.md HARD RULE #8 + Cat21 RPC architecture decision #6):
 *
 *   declared = undefined     →  return 'manual'
 *   declared = 'manual'      →  return 'manual'
 *   declared = 'autonomous'  →  check four conditions:
 *     1. transport === 'mcp-nmh'
 *     2. agentMode.enabled === true
 *     3. evaluateAgentPolicy(intent) → allowed
 *     If all three pass     →  return 'autonomous'
 *     If any one fails      →  throw ModeResolverError(typed rejection)
 *
 * There is no downgrade path. A caller that requested `'autonomous'`
 * but failed a guard gets a typed error and must explicitly re-call
 * with `mode: 'manual'` to take the popup-confirm path. This makes
 * mode resolution observable and prevents two distinct failure
 * modes from being silently equivalenced.
 *
 * Implementation lands in the iteration-2 commit. The spec at
 * `mode-resolver.spec.ts` pins every branch of the truth table.
 */
export function resolveSigningMode(args: {
  intent: Cat21Intent;
  transport: Cat21Transport;
  agentMode: AgentModeFlag;
  /**
   * Callback into the SDK's `evaluateAgentPolicy`. Passed in (rather
   * than imported here) so the resolver stays SDK-version-agnostic
   * and the spec can stub the policy without spinning up a real SDK.
   */
  evaluateAgentPolicy(
    intent: Cat21Intent
  ):
    | { allowed: true }
    | { allowed: false; reason: string; detail?: string };
}): 'autonomous' | 'manual' {
  void args;
  throw new Error('Not implemented — see iteration-2 commit');
}
