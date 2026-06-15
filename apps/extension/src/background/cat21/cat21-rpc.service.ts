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
import { enforceTransferInvariants } from './invariants/transfer-invariants';
import { enforceCreateOfferInvariants } from './invariants/create-offer-invariants';
import { buildMintPsbt } from './builders/mint-builder';
import { TransferUtxo, buildTransferPsbt } from './builders/transfer-builder';
import { buildListing } from './builders/listing-builder';
import { Cat21OfferValidation, validateAcceptOffer } from './builders/accept-offer-validator';
import { enforceAcceptOfferInvariants, ValidatedAcceptOffer } from './invariants/accept-offer-invariants';

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
  /**
   * Looks up the wallet's UTXO that carries the given cat. Throws if the
   * active account does not own this cat (cat21-ord lookup mismatch).
   */
  resolveCatUtxo(catId: string): TransferUtxo;
  /**
   * Manual-mode signer: opens the cat21-themed popup, awaits user click.
   *
   * `inputIndexes` constrains the wallet to sign ONLY those input
   * positions. This is the security boundary against an inbound PSBT
   * that interleaves buyer-funded UTXOs the seller's key could
   * coincidentally sign.
   *
   * Pass `'all'` for mint and transfer: those PSBTs are wallet-built,
   * every input is one of ours, every input is meant to be signed.
   * (Both flows are CAT-21 mints — `lockTime=21` set by their builder
   * — so SIGHASH_ALL on every input also locks the marker in.)
   *
   * Pass `[0]` for accept-offer: the PSBT comes from a buyer, the
   * seller's key must touch ONLY the cat-bearing input at index 0.
   * Whatever lockTime the buyer set is committed to by the seller's
   * signature too — that's by design; per the policy in HARD RULE #1,
   * we accept inbound as-is.
   */
  signWithConfirmation(
    psbt: Uint8Array,
    intent: Cat21Intent,
    inputIndexes: 'all' | number[]
  ): Promise<SignedTx>;
  /**
   * Manual-mode listing publish: opens a "Publish listing for cat X?"
   * popup, awaits the user click. Resolves on confirm, rejects on cancel.
   * Autonomous mode skips this callback entirely.
   */
  confirmListingPublication(intent: Cat21CreateOfferIntent): Promise<void>;
  /**
   * Delegate into the SDK's `validateCat21BuyOfferPsbt`. Wired by the
   * dispatcher at startup; tests stub it. Returning a typed validation
   * result keeps the service untyped against ordpool-sdk's exports.
   * Per HARD RULE #1 we accept any inbound lockTime; the validator only
   * checks the price + payment-address + sighash invariants, never
   * locktime.
   */
  validateBuyOfferPsbt(args: {
    psbt: Uint8Array;
    expectedSellerUtxo: { txid: string; vout: number };
    floorPriceSats: number;
    expectedSellerPaymentAddress: string;
    network: 'mainnet' | 'testnet';
  }): Cat21OfferValidation;
  /**
   * Autonomous-mode signer: signs without prompting.
   *
   * Same `inputIndexes` semantics as `signWithConfirmation` — `'all'`
   * for wallet-built CAT-21 mint txs (mint, transfer); `[0]` for
   * accept-offer where the PSBT was buyer-built.
   */
  signSilently(psbt: Uint8Array, inputIndexes: 'all' | number[]): Promise<SignedTx>;
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
        ? await this.deps.signWithConfirmation(built.psbt, validated, 'all')
        : await this.deps.signSilently(built.psbt, 'all');
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
    return { ok: true, value: { kind: 'broadcast', txid: result.txid, channel: result.channel } };
  }

  async transfer(
    intent: Cat21TransferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    const accountCtx = this.deps.getAccountContext();

    let validated: Validated<Cat21TransferIntent>;
    try {
      validated = enforceTransferInvariants(intent, accountCtx.network);
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

    let catUtxo: TransferUtxo;
    try {
      catUtxo = this.deps.resolveCatUtxo(validated.catId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }

    const estimatedFee = Math.ceil(validated.feeRate * 220);
    const requiredSats = 546 + estimatedFee;
    let fundingUtxo: Cat21FundingUtxo | TransferUtxo;
    if (catUtxo.value >= requiredSats) {
      fundingUtxo = catUtxo;
    } else {
      try {
        fundingUtxo = this.deps.pickFundingUtxo(requiredSats - catUtxo.value);
      } catch (err) {
        return denied('intent-invariant-violated', `funding-pick-failed: ${errorDetail(err)}`);
      }
    }

    let built;
    try {
      built = buildTransferPsbt({
        intent: validated,
        catUtxo,
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
        ? await this.deps.signWithConfirmation(built.psbt, validated, 'all')
        : await this.deps.signSilently(built.psbt, 'all');
    } catch (err) {
      return denied('broadcast-failed', `sign-failed: ${errorDetail(err)}`);
    }

    let result: BroadcastResult;
    try {
      result = await this.deps.broadcast(signed);
    } catch (err) {
      return denied('broadcast-failed', errorDetail(err));
    }

    this.deps.recordSpend(546 + built.fee);
    return { ok: true, value: { kind: 'broadcast', txid: result.txid, channel: result.channel } };
  }

  /**
   * `cat21_create_offer` — publishes a structured listing for an owned
   * cat. Does NOT broadcast a Bitcoin transaction. Pipeline:
   *
   *   1. enforceCreateOfferInvariants(intent, network)
   *   2. resolveSigningMode(...)
   *   3. resolveCatUtxo(catId) — proves wallet owns the cat
   *   4. confirmListingPublication(intent) — manual mode only
   *   5. buildListing({ intent, sellerUtxo })
   *   6. Return `{ ok: true, value: { kind: 'listing', listing: { ... } } }`.
   *
   * No signature, no PSBT, no broadcast. The listing is data the agent
   * publishes to a marketplace; buyers later construct a buy-offer PSBT
   * the seller signs+broadcasts via cat21_accept_offer (iter 7).
   */
  async createOffer(
    intent: Cat21CreateOfferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    const accountCtx = this.deps.getAccountContext();

    let validated: Validated<Cat21CreateOfferIntent>;
    try {
      validated = enforceCreateOfferInvariants(intent, accountCtx.network);
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

    let catUtxo: TransferUtxo;
    try {
      catUtxo = this.deps.resolveCatUtxo(validated.catId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }

    if (mode === 'manual') {
      try {
        await this.deps.confirmListingPublication(validated);
      } catch (err) {
        return denied('broadcast-failed', `listing-cancelled: ${errorDetail(err)}`);
      }
    }

    const listing = buildListing({
      intent: validated,
      sellerUtxo: { txid: catUtxo.txid, vout: catUtxo.vout },
    });

    return { ok: true, value: { kind: 'listing', listing } };
  }

  /**
   * `cat21_accept_offer` — wallet receives a buy-offer PSBT from a buyer,
   * validates it against the seller's expected deal (`expectedCatId`,
   * `expectedPriceSats`, `expectedSellerUtxo`), signs input 0 (the
   * seller's cat input) with SIGHASH_ALL, and broadcasts.
   */
  async acceptOffer(
    intent: Cat21AcceptOfferIntent,
    transport: Cat21Transport
  ): Promise<Cat21RpcResult> {
    const accountCtx = this.deps.getAccountContext();

    let validated: ValidatedAcceptOffer;
    try {
      validated = enforceAcceptOfferInvariants(intent, accountCtx.network);
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

    // Re-confirm wallet ownership of the cat. This catches three attacks
    // the SDK validator (input 0 == expectedSellerUtxo) cannot:
    //   1. Stale listings — seller transferred the cat between publishing
    //      the listing and signing acceptance; UTXO is now somewhere else.
    //   2. Wrong-cat listings — seller named cat #42 in the intent but
    //      the UTXO at expectedSellerUtxo actually holds cat #7.
    //   3. cat21-ord disagreeing with the seller's expectation.
    // The SDK validator pins INBOUND ↔ INTENT; this check pins
    // INTENT ↔ CHAIN-NOW.
    let catUtxo;
    try {
      catUtxo = this.deps.resolveCatUtxo(validated.expectedCatId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }
    if (
      catUtxo.txid !== validated.expectedSellerUtxo.txid ||
      catUtxo.vout !== validated.expectedSellerUtxo.vout
    ) {
      return denied(
        'inbound-offer-mismatch',
        `expectedSellerUtxo ${validated.expectedSellerUtxo.txid}:${validated.expectedSellerUtxo.vout} disagrees with on-chain cat location ${catUtxo.txid}:${catUtxo.vout}`
      );
    }

    const validation = validateAcceptOffer(
      {
        intent: validated,
        psbtBytes: validated.psbtBytes,
        expectedSellerPaymentAddress: accountCtx.paymentAddress,
        network: accountCtx.network,
      },
      this.deps.validateBuyOfferPsbt
    );
    if (!validation.ok) {
      return denied('inbound-offer-mismatch', `${validation.reason}: ${validation.detail ?? ''}`);
    }

    let signed: SignedTx;
    try {
      signed = mode === 'manual'
        ? await this.deps.signWithConfirmation(validated.psbtBytes, validated, [0])
        : await this.deps.signSilently(validated.psbtBytes, [0]);
    } catch (err) {
      return denied('broadcast-failed', `sign-failed: ${errorDetail(err)}`);
    }

    let result: BroadcastResult;
    try {
      result = await this.deps.broadcast(signed);
    } catch (err) {
      return denied('broadcast-failed', errorDetail(err));
    }

    // Record the deal size against the daily cap. The seller doesn't
    // spend BTC, but the policy daily cap exists to backstop autonomous
    // agents from accepting an unbounded number of offers per day; using
    // pricePaidSats as the deal-size proxy lets the cap fire on activity
    // volume, not just on outflow.
    this.deps.recordSpend(validation.pricePaidSats);
    return { ok: true, value: { kind: 'broadcast', txid: result.txid, channel: result.channel } };
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
