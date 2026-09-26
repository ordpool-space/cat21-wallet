/**
 * Bridges the wallet's redux-persist'd state shape to the
 * `BackgroundProbeState` the read-only NMH probes consume.
 *
 * `makeBackgroundProbeStateCache` calls this on every chrome.storage
 * change event for the redux-persist root key. The input is whatever
 * the wallet wrote there — typically a JSON string mapping slice
 * names → JSON-encoded slices (redux-persist v6 default). This module
 * pulls out the four fields we surface to agents:
 *
 *   - `network`            → 'mainnet' | 'testnet'
 *   - `accountId`          → `<fingerprint>:<accountIndex>`
 *   - `activeAccountAddress` → native-segwit address at index 0
 *   - `agentModeEnabled`   → `policies[accountId].enabled` flag
 *
 * **Fails closed.** Every step is defensive: any missing slice,
 * malformed JSON, unexpected shape, etc. returns `DEFAULT_STATE`
 * rather than throwing. The probes catch their own errors too —
 * but pushing the failure mode into "return defaults" here means
 * a slice-shape drift surfaces as "agent thinks the wallet is
 * empty / agent-disabled" instead of "probes silently throw and
 * the agent sees a typed error". Empty-but-defined is the safer
 * failure mode.
 *
 * **Schema source of truth.**
 *   - `network`: `WalletDefaultNetworkConfigurationIds.mainnet` etc.
 *     from `packages/models/src/network/network.model.ts`. Only
 *     'mainnet' maps to 'mainnet'; every other id (testnet,
 *     testnet4, signet, sbtcTestnet, sbtcDevenv, devnet, regtest)
 *     normalises to 'testnet' for the agent-facing label.
 *   - `accountId`: format `<fingerprint>:<accountIndex>` matches
 *     `accountIdToSliceKey` in
 *     `apps/extension/src/app/store/agent-policy/agent-policy.hooks.ts`.
 *     Same string the agent-policy slice keys policies on.
 *   - `agentModeEnabled`: `agentPolicy.policies[accountId].enabled`
 *     from
 *     `apps/extension/src/app/store/agent-policy/agent-policy.slice.ts`.
 *   - `activeAccountAddress`: native-segwit address at index 0 for
 *     the active account. Currently NOT picked from the slice — the
 *     wallet's native-segwit address derivation runs in popup-tied
 *     React hooks (`useNativeSegwitAccountIndexAddressIndexZero`),
 *     not in persisted state. The cutover commit either:
 *       (a) caches the address into a new persisted slice the
 *           popup updates on account switch, or
 *       (b) leaves this `undefined` so `list_cats` returns the
 *           empty array until the popup pushes the address.
 *     For now: return undefined. The probe's boot-race-friendly
 *     contract handles this without surfacing an error to the
 *     agent.
 *
 * **Why a defensive decoder instead of a strict one.** The whole
 * chrome.storage envelope is JSON the wallet wrote. A schema
 * regression in any of the picked slices would otherwise cascade
 * into the agent surface. Returning DEFAULT_STATE on any mismatch
 * keeps the agent's view of the wallet honest: "I can't see your
 * cats right now" rather than "your wallet broke in a way that
 * looks like 'you have no cats'".
 */

interface BackgroundProbeState {
  network: 'mainnet' | 'testnet';
  accountId: string;
  activeAccountAddress: string | undefined;
  agentModeEnabled: boolean;
}

const DEFAULT_STATE: BackgroundProbeState = {
  network: 'mainnet',
  accountId: '',
  activeAccountAddress: undefined,
  agentModeEnabled: false,
};

/**
 * Decode the redux-persist root payload. `raw` is whatever
 * `chrome.storage.local.get('persist:root')` returned — usually a
 * JSON string with one entry per slice, each entry itself a JSON
 * string. Both layers can be missing / malformed; the decoder
 * falls back to defaults at every step.
 */
export function decodeWalletProbeState(raw: unknown): BackgroundProbeState {
  if (typeof raw !== 'string') return DEFAULT_STATE;
  let outer: unknown;
  try {
    outer = JSON.parse(raw);
  } catch {
    return DEFAULT_STATE;
  }
  if (!isRecord(outer)) return DEFAULT_STATE;

  const network = decodeNetwork(outer.networks);
  const { accountId, agentModeEnabled } = decodeAccountAndAgentMode(outer);

  return {
    network,
    accountId,
    activeAccountAddress: undefined,
    agentModeEnabled,
  };
}

/**
 * `outer.networks` is a JSON string (per redux-persist's
 * default per-slice serialisation). Its inner shape is an
 * EntityAdapter state plus `currentNetworkId`. We only need
 * `currentNetworkId`; the inverse 'mainnet' check is enough to
 * collapse the eight-network enum into our binary label.
 */
function decodeNetwork(value: unknown): 'mainnet' | 'testnet' {
  const slice = parseInnerJson(value);
  if (!isRecord(slice)) return DEFAULT_STATE.network;
  const id = slice.currentNetworkId;
  // currentNetworkId missing / undefined → default to mainnet (the
  // wallet's install-time default). Only a present-and-non-mainnet
  // id collapses to 'testnet'.
  if (id == null) return DEFAULT_STATE.network;
  return id === 'mainnet' ? 'mainnet' : 'testnet';
}

/**
 * Read the active fingerprint + accountIndex from the persisted
 * `active` slice and look up `agentPolicy.policies[<accountId>].enabled`.
 * The accountId format is `${fingerprint}:${accountIndex}` —
 * matches `accountIdToSliceKey` so the popup-side selectors and
 * the background-side probes share one identity.
 *
 * Every step fails closed: missing slice / malformed JSON /
 * shape drift returns the boot-race-friendly defaults.
 */
function decodeAccountAndAgentMode(outer: Record<string, unknown>): {
  accountId: string;
  agentModeEnabled: boolean;
} {
  const accountId = decodeActiveAccountId(outer.active);
  if (accountId === DEFAULT_STATE.accountId) {
    return { accountId, agentModeEnabled: false };
  }

  const agentPolicySlice = parseInnerJson(outer.agentPolicy);
  if (!isRecord(agentPolicySlice)) {
    return { accountId, agentModeEnabled: false };
  }
  const policies = agentPolicySlice.policies;
  if (!isRecord(policies)) {
    return { accountId, agentModeEnabled: false };
  }
  const policy = policies[accountId];
  if (!isRecord(policy)) {
    return { accountId, agentModeEnabled: false };
  }
  return { accountId, agentModeEnabled: policy.enabled === true };
}

/**
 * `outer.active` is the JSON-serialised `active` slice. Its shape
 * is `{ account: { fingerprint, accountIndex } | null }`. Returns
 * the default sentinel for a missing slice / null account / malformed
 * fingerprint, so downstream lookups miss safely instead of crashing.
 */
function decodeActiveAccountId(value: unknown): string {
  const slice = parseInnerJson(value);
  if (!isRecord(slice)) return DEFAULT_STATE.accountId;
  const account = slice.account;
  if (!isRecord(account)) return DEFAULT_STATE.accountId;
  const { fingerprint, accountIndex } = account;
  if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
    return DEFAULT_STATE.accountId;
  }
  if (typeof accountIndex !== 'number' || !Number.isInteger(accountIndex) || accountIndex < 0) {
    return DEFAULT_STATE.accountId;
  }
  return `${fingerprint}:${accountIndex}`;
}

function parseInnerJson(value: unknown): unknown {
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
