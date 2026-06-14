import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21MintIntent,
  Cat21RpcResult,
  Cat21TransferIntent,
} from './types';
import type { Cat21Transport } from './mode-resolver';

/**
 * The internal handler that serves Cat21's typed RPC surface for
 * Path 2 (wallet popup UI) and Path 3 (MCP NMH bridge).
 *
 * Per CLAUDE.md HARD RULE #6 this service is NEVER reachable from
 * the browser provider. It is only constructed in the extension
 * background page and dispatched to via `chrome.runtime` (Path 2) or
 * the NMH message bridge (Path 3). The architecture fitness spec at
 * `apps/extension/src/__architecture__/architecture.spec.ts` enforces
 * this invariant at the source-tree level.
 *
 * Every method follows the same pipeline (CLAUDE.md "Cat21 RPC
 * architecture"):
 *
 *   1. Parse + validate intent shape (Zod-style, throws on shape error)
 *   2. Run hard invariants → returns Validated<I> brand
 *   3. Resolve signing mode (autonomous vs manual)
 *   4. Build PSBT via ordpool-sdk (wallet owns the bytes)
 *   5. Post-build assertions (defence in depth)
 *   6. Sign (silent in autonomous, popup-confirmed in manual)
 *   7. Broadcast (mempool first, Slipstream on >400k weight)
 *   8. Return { ok, value }
 *
 * Every method takes a `transport` argument because the mode resolver
 * needs it. The caller (background dispatcher) sets transport based
 * on which port the message arrived on; the service does NOT trust the
 * caller to declare its own transport — it is computed at dispatch
 * time.
 *
 * Implementation lands in subsequent iterations, one method at a time.
 * Iteration 2 implements `mint` end-to-end (invariants + builder +
 * sign + broadcast); transfer / create_offer / accept_offer get their
 * own stub-then-impl pairs.
 */
export class Cat21RpcService {
  mint(intent: Cat21MintIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 2'));
  }

  transfer(
    intent: Cat21TransferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 3'));
  }

  createOffer(
    intent: Cat21CreateOfferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 4'));
  }

  acceptOffer(
    intent: Cat21AcceptOfferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 5'));
  }
}
