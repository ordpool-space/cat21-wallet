/**
 * Read-only NMH probe handler. The MCP host sends three read-only
 * messages whose replies don't require the keychain or popup
 * confirmation — `list_cats`, `wallet_status`, `cat21_ord_status` —
 * and expects a `{type, payload}` reply over the NMH port. This
 * module is the wallet-side handler.
 *
 * Protocol (matches `tools/src/mcp-host/host.ts`):
 *
 *   in : { type: 'list_cats',         id: string }
 *   out: { type: 'list_cats:result',  payload: string[] (cat ids) }
 *
 *   in : { type: 'wallet_status',     id: string }
 *   out: { type: 'wallet_status:result',
 *          payload: { network, accountId, agentMode: { enabled } } }
 *
 *   in : { type: 'cat21_ord_status',  id: string }
 *   out: { type: 'cat21_ord_status:result',
 *          payload: { reachable: boolean, ... } }
 *
 * Everything is dependency-injected so the spec can drive the
 * handler without a real `chrome.runtime.connectNative` port or a
 * live cat21-ord. Production wires:
 *
 *   - `listCatsAtActiveAccount` → calls cat21-ord
 *     /address/{addr} via getCat21OrdApiClient
 *   - `readWalletStatus`        → reads Redux store via getState
 *   - `readCat21OrdStatus`      → calls cat21-ord /status
 *
 * Why no popup involvement: these probes change no chain state and
 * surface no secret. cat21-ord already serves cats publicly at our
 * own domain, and the agent already knows which extension it
 * connected to. The point of cat-21 mode is that the agent can
 * orient itself without bothering the user.
 */
/** Reply envelope shape — the host parses `type.endsWith(':result')`. */
// HACK -- Cat21: removed `export` (post-message envelope shape; consumers construct inline). HARD RULE #5.
interface ReadOnlyProbeReply {
  type:
    | 'list_cats:result'
    | 'wallet_status:result'
    | 'cat21_ord_status:result'
    | 'unknown_probe:result';
  payload: unknown;
}

/** Inbound read-only request, before validation. */
// HACK -- Cat21: removed `export` (typed shape internal to the dispatcher). HARD RULE #5.
interface ReadOnlyProbeRequest {
  type: 'list_cats' | 'wallet_status' | 'cat21_ord_status';
  id: string;
}

export function isReadOnlyProbeRequest(msg: unknown): msg is ReadOnlyProbeRequest {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.id !== 'string') return false;
  return m.type === 'list_cats' || m.type === 'wallet_status' || m.type === 'cat21_ord_status';
}

/**
 * Public wallet-status snapshot. Deliberately tiny — the agent needs
 * to know what account it's operating on and whether autonomous mode
 * is enabled before it bothers posting a mutating call. Nothing else
 * is the agent's business. `accountId` is the
 * `<fingerprint>:<accountIndex>` slice key used everywhere internally
 * (per `accountIdToSliceKey`).
 */
// HACK -- Cat21: removed `export` (consumer reads via the readWalletStatus signature). HARD RULE #5.
interface WalletStatusSnapshot {
  network: 'mainnet' | 'testnet';
  accountId: string;
  agentMode: { enabled: boolean };
}

/**
 * cat21-ord status — what the indexer reports about itself.
 * Production reads cat21-ord's `/status` endpoint. The probe surfaces
 * the four fields an agent might care about; everything else stays
 * private to the wallet.
 */
// HACK -- Cat21: removed `export` (consumer reads via the readCat21OrdStatus signature). HARD RULE #5.
interface Cat21OrdStatusSnapshot {
  reachable: boolean;
  height?: number;
  cats?: number;
}

interface HandleReadOnlyProbeDeps {
  /** Returns the cat ids the active account currently holds. */
  listCatsAtActiveAccount(): Promise<string[]>;
  /** Returns the wallet's status snapshot. */
  readWalletStatus(): WalletStatusSnapshot;
  /** Returns the cat21-ord status snapshot, or `{reachable:false}` on error. */
  readCat21OrdStatus(): Promise<Cat21OrdStatusSnapshot>;
}

/**
 * Run one probe end-to-end and return the reply the NMH attach
 * should post back over the port. The caller is responsible for the
 * actual `port.postMessage(reply)` — keeps this module testable
 * without a fake port and lets the attach add the response id
 * verbatim.
 *
 * If any of the deps throws, the reply payload encodes the error
 * inline so the agent learns the probe failed (rather than
 * silently empty data, which it might confuse with "no cats").
 */
export async function handleReadOnlyProbe(
  req: ReadOnlyProbeRequest,
  deps: HandleReadOnlyProbeDeps
): Promise<ReadOnlyProbeReply> {
  switch (req.type) {
    case 'list_cats': {
      try {
        const cats = await deps.listCatsAtActiveAccount();
        return { type: 'list_cats:result', payload: cats };
      } catch (err) {
        return {
          type: 'list_cats:result',
          payload: { error: errorMessage(err) },
        };
      }
    }
    case 'wallet_status': {
      try {
        return { type: 'wallet_status:result', payload: deps.readWalletStatus() };
      } catch (err) {
        return {
          type: 'wallet_status:result',
          payload: { error: errorMessage(err) },
        };
      }
    }
    case 'cat21_ord_status': {
      try {
        const status = await deps.readCat21OrdStatus();
        return { type: 'cat21_ord_status:result', payload: status };
      } catch (err) {
        return {
          type: 'cat21_ord_status:result',
          payload: { reachable: false, error: errorMessage(err) },
        };
      }
    }
    default: {
      const exhaustive: never = req.type;
      throw new Error(`handleReadOnlyProbe: unknown type ${String(exhaustive)}`);
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
