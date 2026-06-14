import type { Cat21Intent } from './types';

/**
 * Where the inbound Cat21 RPC call entered the background page.
 *
 *   - `popup`: from the wallet's own popup UI over Chrome's internal
 *     `chrome.runtime` channel (Path 2).
 *   - `mcp-nmh`: from the MCP NMH host process over Chrome Native
 *     Messaging (Path 3).
 *   - `unknown`: defensive default — any code path that hasn't proven
 *     its transport is treated as untrusted-for-autonomous. The
 *     resolver downgrades to manual mode.
 */
export type Cat21Transport = 'popup' | 'mcp-nmh' | 'unknown';

/**
 * Per-account user-configured agent-mode policy state. The full policy
 * struct (per-action cap, daily cap, etc.) lives in the SDK; this
 * resolver only consults the `enabled` flag here and delegates the
 * per-intent gate to ordpool-sdk's `evaluateAgentPolicy`. That keeps
 * the wallet from duplicating policy logic.
 */
export interface AgentModeFlag {
  enabled: boolean;
}

/**
 * Decides whether the caller's `mode: 'autonomous'` request is honored.
 *
 * Per CLAUDE.md HARD RULE #8 and decision #6 in the Cat21 RPC
 * architecture, `'autonomous'` is honored ONLY when all four conditions
 * hold:
 *
 *   1. The caller explicitly declared `mode: 'autonomous'` in the intent.
 *   2. Transport is `'mcp-nmh'` (not popup, not unknown).
 *   3. The user has agent-mode enabled in settings for the active
 *      account.
 *   4. The agent-policy gate (ordpool-sdk's `evaluateAgentPolicy`)
 *      allows the intent.
 *
 * If any condition fails, the resolver returns `'manual'` (popup
 * confirmation UI required). If the policy gate explicitly denies the
 * intent (vs. simply being disabled), the resolver throws —
 * downgrading to manual would silently bypass the user's stated cap.
 *
 * Implementation lands in the iteration-2 commit. The spec at
 * `mode-resolver.spec.ts` pins every branch.
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

/**
 * Thrown when the agent-policy gate explicitly denies the intent.
 * Resolved deliberately as an error rather than a downgrade so a
 * misbehaving caller cannot silently fall through to a user prompt
 * that the user might wave through.
 */
export class AgentPolicyDeniedError extends Error {
  constructor(
    public readonly policyReason: string,
    public readonly detail?: string
  ) {
    super(detail ? `${policyReason}: ${detail}` : policyReason);
    this.name = 'AgentPolicyDeniedError';
  }
}
