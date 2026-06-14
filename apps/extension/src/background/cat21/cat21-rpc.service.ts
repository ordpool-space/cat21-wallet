import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21RpcDenyReason,
  Cat21RpcResult,
  Cat21TransferIntent,
  Validated,
} from './types';
import {
  AgentModeFlag,
  Cat21Transport,
  ModeResolverError,
  resolveSigningMode,
} from './mode-resolver';
import {
  MintInvariantError,
  enforceMintInvariants,
} from './invariants/mint-invariants';
import { buildMintPsbt } from './builders/mint-builder';

/**
 * Funding UTXO shape accepted by every cat21 builder. The wallet's
 * UTXO service produces these via coin selection over the active
 * account's spendable bucket (cat-bearing UTXOs are filtered out
 * upstream — see HARD RULE #2 in `CLAUDE.md`).
 */
export interface Cat21FundingUtxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: Uint8Array;
  tapInternalKey?: Uint8Array;
}

/**
 * Active-account context the service needs to build a signable PSBT.
 * The dispatcher (background page) resolves this at call time from the
 * wallet's Redux state and passes it in — keeps `Cat21RpcService`
 * pure-functional in its dependencies.
 */
export interface Cat21AccountContext {
  /** Sender's own address. Change returns here. */
  paymentAddress: string;
  /** Network the account is operating on. */
  network: 'mainnet' | 'testnet';
}

/**
 * Signed-tx bundle the broadcaster expects. The signer (popup-confirm
 * or silent) takes a PSBT and produces this; the orchestrator hands it
 * to the broadcast callback.
 */
export interface SignedTx {
  hex: string;
  weight: number;
}

export interface BroadcastResult {
  txid: string;
  channel: 'mempool' | 'slipstream';
}

/**
 * Constructor-injected dependencies. All wallet-side state lives behind
 * callbacks so the service stays pure and the spec can stub each
 * dependency cleanly. The background-page dispatcher wires the real
 * implementations at startup.
 */
export interface Cat21RpcDeps {
  getAccountContext(): Cat21AccountContext;
  agentMode: AgentModeFlag;
  evaluateAgentPolicy(intent: Cat21Intent):
    | { allowed: true }
    | { allowed: false; reason: string; detail?: string };
  /** Picks one funding UTXO sufficient for `requiredSats`. Throws if none. */
  pickFundingUtxo(requiredSats: number): Cat21FundingUtxo;
  /** Manual-mode signer: opens the cat21-themed popup, awaits user click. */
  signWithConfirmation(psbt: Uint8Array, intent: Cat21Intent): Promise<SignedTx>;
  /** Autonomous-mode signer: signs without prompting. */
  signSilently(psbt: Uint8Array): Promise<SignedTx>;
  /** Broadcast dispatcher (mempool / Slipstream per weight). */
  broadcast(signedTx: SignedTx): Promise<BroadcastResult>;
  /** Per-account daily-spend tracker (updated on every accepted action). */
  recordSpend(sats: number): void;
}

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
 *   1. Run hard invariants → returns Validated<I> brand
 *   2. Resolve signing mode (autonomous vs manual)
 *   3. Build PSBT (wallet owns the bytes)
 *   4. Post-build assertions (already inside the builder)
 *   5. Sign (silent in autonomous, popup-confirmed in manual)
 *   6. Broadcast (mempool first, Slipstream on >400k weight)
 *   7. Return { ok, value }
 *
 * Every method takes a `transport` argument because the mode resolver
 * needs it. The dispatcher computes transport from the chrome.runtime
 * port object; the service does NOT trust the caller to declare it.
 */
export class Cat21RpcService {
  constructor(private readonly deps: Cat21RpcDeps) {}

  async mint(intent: Cat21MintIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    const accountCtx = this.deps.getAccountContext();

    let validated: Validated<Cat21MintIntent>;
    try {
      validated = enforceMintInvariants(intent, accountCtx.network);
    } catch (err) {
      return denied('intent-invariant-violated', errorDetail(err));
    }

    let mode: 'autonomous' | 'manual';
    try {
      mode = resolveSigningMode({
        intent: validated,
        transport,
        agentMode: this.deps.agentMode,
        evaluateAgentPolicy: this.deps.evaluateAgentPolicy,
      });
    } catch (err) {
      if (err instanceof ModeResolverError) {
        return denied(modeResolverReasonToRpcReason(err.rejection), err.detail);
      }
      return denied('intent-invariant-violated', errorDetail(err));
    }

    // Estimate the required funding so the UTXO picker can find a sufficient
    // input. Builder will throw `Funding UTXO insufficient` otherwise.
    const tipValue = validated.tip && validated.tip.value > 0 ? validated.tip.value : 0;
    const estimatedVsize = 150 + (tipValue > 0 ? 31 : 0);
    const estimatedFee = Math.ceil(validated.feeRate * estimatedVsize);
    const requiredSats = 546 + tipValue + estimatedFee;

    let fundingUtxo: Cat21FundingUtxo;
    try {
      fundingUtxo = this.deps.pickFundingUtxo(requiredSats);
    } catch (err) {
      return denied('intent-invariant-violated', `funding-pick-failed: ${errorDetail(err)}`);
    }

    let built;
    try {
      built = buildMintPsbt({
        intent: validated,
        fundingUtxo,
        paymentAddress: accountCtx.paymentAddress,
        network: accountCtx.network,
      });
    } catch (err) {
      return denied('intent-invariant-violated', `build-failed: ${errorDetail(err)}`);
    }

    let signed: SignedTx;
    try {
      signed = mode === 'manual'
        ? await this.deps.signWithConfirmation(built.psbt, validated)
        : await this.deps.signSilently(built.psbt);
    } catch (err) {
      return denied('broadcast-failed', `sign-failed: ${errorDetail(err)}`);
    }

    let result: BroadcastResult;
    try {
      result = await this.deps.broadcast(signed);
    } catch (err) {
      return denied('broadcast-failed', errorDetail(err));
    }

    this.deps.recordSpend(546 + tipValue + built.fee);
    return { ok: true, value: { txid: result.txid, channel: result.channel } };
  }

  transfer(
    intent: Cat21TransferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 5'));
  }

  createOffer(
    intent: Cat21CreateOfferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 6'));
  }

  acceptOffer(
    intent: Cat21AcceptOfferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    void intent;
    void transport;
    return Promise.reject(new Error('Not implemented — iteration 7'));
  }
}

function denied(reason: Cat21RpcDenyReason, detail?: string): Cat21RpcResult {
  return { ok: false, value: { reason, detail } };
}

function modeResolverReasonToRpcReason(
  rejection: 'transport-not-trusted-for-autonomous' | 'agent-disabled' | 'policy-denied'
): Cat21RpcDenyReason {
  return rejection;
}

function errorDetail(err: unknown): string {
  if (err instanceof MintInvariantError) return `${err.reason}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
