import {
  Cat21GateResources,
  Cat21OfferValidation,
  Cat21Operation,
  Cat21OperationGateConfig,
  Cat21TransferCatInput,
  KnownOrdinalWalletType,
  Network,
  buildCat21MintPsbt,
  buildCat21TransferPsbt,
  validateCat21Operation,
} from 'ordpool-sdk/core';

import { validateAcceptOffer } from './builders/accept-offer-validator';
import { buildListing } from './builders/listing-builder';
import { simulateMintFee, simulateTransferFee } from './cat21-fee-simulation';
import {
  AgentModeFlag,
  Cat21Transport,
  ModeResolverError,
  resolveSigningMode,
} from './mode-resolver';
import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21RpcDenyReason,
  Cat21RpcResult,
  Cat21TransferIntent,
} from './types';

/**
 * Alias for the SDK's cat-bearing-UTXO type. Kept under the wallet's
 * old name so callers / specs that referenced `TransferUtxo` continue
 * to type-check without churn. New code should use the SDK type
 * directly.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type TransferUtxo = Cat21TransferCatInput;

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
  /**
   * Operation-kind allowlist sourced from the per-account
   * `AgentPolicy.allowedOperations` (with the `cat21_` prefix
   * stripped to match the SDK gate's bare-name convention). When
   * set and non-empty, the SDK structural gate rejects any other
   * operation kind with `operation-kind-not-allowed`. Empty or
   * unset = permissive (default).
   */
  allowedOperations?: readonly ('mint' | 'transfer' | 'create_offer' | 'accept_offer')[];
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
  evaluateAgentPolicy(
    intent: Cat21Intent
  ): { allowed: true } | { allowed: false; reason: string; detail?: string };
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
 *   1. runGate — SDK validateCat21Operation; returns discriminated resources
 *   2. resolveModeOrFail — autonomous vs manual, gated by policy + transport
 *   3. Build PSBT via the SDK builder (wallet owns the bytes)
 *   4. Post-build assertions (already inside the builder)
 *   5. signAndBroadcast — sign (silent or popup-confirmed) then dispatch
 *
 * Every method takes a `transport` argument because the mode resolver
 * needs it. The dispatcher computes transport from the chrome.runtime
 * port object; the service does NOT trust the caller to declare it.
 */
export class Cat21RpcService {
  constructor(private readonly deps: Cat21RpcDeps) {}

  async mint(intent: Cat21MintIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    const opened = this.openPipeline({ kind: 'mint', intent }, transport);
    if ('result' in opened) return opened.result;
    const { mode, accountCtx } = opened;

    const tipValue = intent.tip && intent.tip.value > 0 ? intent.tip.value : 0;
    const sdkNetwork = walletNetworkToSdkNetwork(accountCtx.network);
    const destinations = {
      recipientAddress: intent.recipient,
      senderChangeAddress: accountCtx.paymentAddress,
      tip:
        intent.tip && intent.tip.value > 0
          ? { address: intent.tip.address, valueSats: intent.tip.value }
          : undefined,
    };

    // `pickLargestFundingUtxoThatCovers` (the wallet's deps default)
    // almost always returns a UTXO that still covers the final fee
    // after simulation; the re-pick branch is the rare-case backstop.
    const placeholderFee = 1_000;
    let fundingUtxo: Cat21FundingUtxo;
    try {
      fundingUtxo = this.deps.pickFundingUtxo(546 + tipValue + placeholderFee);
    } catch (err) {
      return denied('intent-invariant-violated', `funding-pick-failed: ${errorDetail(err)}`);
    }

    let estimatedFee: number;
    try {
      ({ finalFeeSats: estimatedFee } = simulateMintFee({
        network: sdkNetwork,
        fundingInput: { ...fundingUtxo },
        destinations,
        feeRatePerVbyte: intent.feeRate,
      }));
    } catch (err) {
      return denied('intent-invariant-violated', `fee-simulation-failed: ${errorDetail(err)}`);
    }

    if (fundingUtxo.value < 546 + tipValue + estimatedFee) {
      try {
        fundingUtxo = this.deps.pickFundingUtxo(546 + tipValue + estimatedFee);
      } catch (err) {
        return denied('intent-invariant-violated', `funding-pick-failed: ${errorDetail(err)}`);
      }
    }

    let built;
    try {
      built = buildCat21MintPsbt({
        walletType: KnownOrdinalWalletType.cat21wallet,
        network: sdkNetwork,
        fundingInput: { ...fundingUtxo },
        destinations,
        feeSats: estimatedFee,
      });
    } catch (err) {
      return denied('intent-invariant-violated', `build-failed: ${errorDetail(err)}`);
    }

    return this.signAndBroadcast({
      mode,
      psbt: built.psbt,
      intent,
      inputIndexes: 'all',
      spendSats: 546 + tipValue + estimatedFee,
    });
  }

  async transfer(intent: Cat21TransferIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    const opened = this.openPipeline({ kind: 'transfer', intent }, transport);
    if ('result' in opened) return opened.result;
    const { mode, accountCtx } = opened;

    let catUtxo: TransferUtxo;
    try {
      catUtxo = this.deps.resolveCatUtxo(intent.catId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }

    // SDK HARD RULE: every cat UTXO is exactly 546 sats (protocol
    // postage). The fee always comes from a separate funding input —
    // 546 < 546 + fee for any positive fee — so no surplus-self-fund
    // branch exists by design.
    const sdkNetwork = walletNetworkToSdkNetwork(accountCtx.network);
    const transferDestinations = {
      recipientAddress: intent.recipient,
      senderChangeAddress: accountCtx.paymentAddress,
    };
    const placeholderFee = 1_000;
    const fundingInputs: Cat21TransferCatInput[] = [];
    let pickedFundingUtxo: Cat21FundingUtxo;
    try {
      pickedFundingUtxo = this.deps.pickFundingUtxo(placeholderFee);
      fundingInputs.push({ ...pickedFundingUtxo });
    } catch (err) {
      return denied('intent-invariant-violated', `funding-pick-failed: ${errorDetail(err)}`);
    }

    let estimatedFee: number;
    try {
      ({ finalFeeSats: estimatedFee } = simulateTransferFee({
        network: sdkNetwork,
        catUtxo,
        fundingInputs,
        destinations: transferDestinations,
        feeRatePerVbyte: intent.feeRate,
      }));
    } catch (err) {
      return denied('intent-invariant-violated', `fee-simulation-failed: ${errorDetail(err)}`);
    }

    if (pickedFundingUtxo.value < estimatedFee) {
      try {
        pickedFundingUtxo = this.deps.pickFundingUtxo(estimatedFee);
        fundingInputs.length = 0;
        fundingInputs.push({ ...pickedFundingUtxo });
      } catch (err) {
        return denied('intent-invariant-violated', `funding-pick-failed: ${errorDetail(err)}`);
      }
    }

    let built;
    try {
      built = buildCat21TransferPsbt({
        walletType: KnownOrdinalWalletType.cat21wallet,
        network: sdkNetwork,
        catUtxo,
        fundingInputs,
        destinations: transferDestinations,
        feeSats: estimatedFee,
      });
    } catch (err) {
      return denied('intent-invariant-violated', `build-failed: ${errorDetail(err)}`);
    }

    return this.signAndBroadcast({
      mode,
      psbt: built.psbt,
      intent,
      inputIndexes: 'all',
      spendSats: 546 + estimatedFee,
    });
  }

  /**
   * `cat21_create_offer` — publishes a structured listing for an owned
   * cat. Does NOT broadcast a Bitcoin transaction. Pipeline:
   *
   *   1. validateCat21Operation({ kind: 'create_offer', intent })
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
    const opened = this.openPipeline({ kind: 'create_offer', intent }, transport);
    if ('result' in opened) return opened.result;
    const { mode } = opened;

    let catUtxo: TransferUtxo;
    try {
      catUtxo = this.deps.resolveCatUtxo(intent.catId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }

    if (mode === 'manual') {
      try {
        await this.deps.confirmListingPublication(intent);
      } catch (err) {
        return denied('broadcast-failed', `listing-cancelled: ${errorDetail(err)}`);
      }
    }

    const listing = buildListing({
      intent,
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
    const opened = this.openPipeline({ kind: 'accept_offer', intent }, transport);
    if ('result' in opened) return opened.result;
    const { mode, accountCtx, resources } = opened;
    const psbtBytes = resources.offerPsbtBytes;

    // Re-confirm wallet ownership of the cat. Catches three attacks
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
      catUtxo = this.deps.resolveCatUtxo(intent.expectedCatId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }
    if (
      catUtxo.txid !== intent.expectedSellerUtxo.txid ||
      catUtxo.vout !== intent.expectedSellerUtxo.vout
    ) {
      return denied(
        'inbound-offer-mismatch',
        `expectedSellerUtxo ${intent.expectedSellerUtxo.txid}:${intent.expectedSellerUtxo.vout} disagrees with on-chain cat location ${catUtxo.txid}:${catUtxo.vout}`
      );
    }

    const validation = validateAcceptOffer(
      {
        intent,
        psbtBytes,
        expectedSellerPaymentAddress: accountCtx.paymentAddress,
        network: accountCtx.network,
      },
      this.deps.validateBuyOfferPsbt
    );
    if (!validation.ok) {
      return denied('inbound-offer-mismatch', `${validation.reason}: ${validation.detail ?? ''}`);
    }

    // The seller doesn't spend BTC, but the policy daily cap exists to
    // backstop autonomous agents from accepting an unbounded number of
    // offers per day; using pricePaidSats as the deal-size proxy lets
    // the cap fire on activity volume, not just on outflow.
    return this.signAndBroadcast({
      mode,
      psbt: psbtBytes,
      intent,
      inputIndexes: [0],
      spendSats: validation.pricePaidSats,
    });
  }

  /**
   * Pipeline preamble: run the SDK gate, then resolve the signing
   * mode. Returns either the early-return result (rejection) or the
   * resolved `{ mode, accountCtx, resources }` for the per-method body
   * to consume. The `resources` field is narrowed to the kind passed
   * in so consumers don't cast.
   */
  private openPipeline<K extends Cat21OperationKind>(
    operation: Cat21OperationOfKind<K>,
    transport: Cat21Transport
  ):
    | { result: Cat21RpcResult }
    | {
        mode: 'autonomous' | 'manual';
        accountCtx: Cat21AccountContext;
        resources: Cat21GateResourcesOfKind<K>;
      } {
    const accountCtx = this.deps.getAccountContext();

    const gateResult = runGate(operation, gateConfig(accountCtx));
    if ('result' in gateResult) return gateResult;

    let mode: 'autonomous' | 'manual';
    try {
      mode = resolveSigningMode({
        intent: operation.intent,
        transport,
        agentMode: this.deps.agentMode,
        evaluateAgentPolicy: this.deps.evaluateAgentPolicy,
      });
    } catch (err) {
      if (err instanceof ModeResolverError) {
        return { result: denied(modeResolverReasonToRpcReason(err.rejection), err.detail) };
      }
      return { result: denied('intent-invariant-violated', errorDetail(err)) };
    }

    return { mode, accountCtx, resources: gateResult.resources };
  }

  /**
   * Pipeline tail: sign (silent or popup-confirmed) then dispatch to
   * the broadcaster. Always records `spendSats` against the daily cap
   * on success.
   */
  private async signAndBroadcast(args: {
    mode: 'autonomous' | 'manual';
    psbt: Uint8Array;
    intent: Cat21Intent;
    inputIndexes: 'all' | number[];
    spendSats: number;
  }): Promise<Cat21RpcResult> {
    let signed: SignedTx;
    try {
      signed =
        args.mode === 'manual'
          ? await this.deps.signWithConfirmation(args.psbt, args.intent, args.inputIndexes)
          : await this.deps.signSilently(args.psbt, args.inputIndexes);
    } catch (err) {
      return denied('broadcast-failed', `sign-failed: ${errorDetail(err)}`);
    }

    let result: BroadcastResult;
    try {
      result = await this.deps.broadcast(signed);
    } catch (err) {
      return denied('broadcast-failed', errorDetail(err));
    }

    this.deps.recordSpend(args.spendSats);
    return { ok: true, value: { kind: 'broadcast', txid: result.txid, channel: result.channel } };
  }
}

/**
 * Map the wallet's coarse network label to the SDK's `Network` enum.
 * Wallet currently exposes only `'mainnet' | 'testnet'`; testnet maps
 * to Testnet3 (the chain ordpool defaults to in tests).
 */
export function walletNetworkToSdkNetwork(net: 'mainnet' | 'testnet'): Network {
  return net === 'mainnet' ? Network.Mainnet : Network.Testnet3;
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
  if (err instanceof Error) return err.message;
  return String(err);
}

type Cat21OperationKind = Cat21Operation['kind'];
type Cat21OperationOfKind<K extends Cat21OperationKind> = Extract<Cat21Operation, { kind: K }>;
type Cat21GateResourcesOfKind<K extends Cat21OperationKind> = Extract<
  Cat21GateResources,
  { kind: K }
>;

/**
 * SDK gate runner. Generic over the operation kind so the returned
 * `resources` field is narrowed to the matching `Cat21GateResources`
 * variant (no consumer-side cast). The SDK reason string is surfaced
 * verbatim as the denial's `detail`; the wallet's wider
 * `Cat21RpcDenyReason` stays at `intent-invariant-violated` for any
 * gate rejection.
 */
function runGate<K extends Cat21OperationKind>(
  operation: Cat21OperationOfKind<K>,
  config: Cat21OperationGateConfig
): { ok: true; resources: Cat21GateResourcesOfKind<K> } | { result: Cat21RpcResult } {
  const gate = validateCat21Operation({ config, operation });
  if (!gate.ok) {
    const detail = gate.detail ? `${gate.reason}: ${gate.detail}` : gate.reason;
    return { result: denied('intent-invariant-violated', detail) };
  }
  // SDK's `Cat21GateResources` is discriminated on `kind` and the gate
  // always returns the variant matching the input kind; TS can't prove
  // that correlation across the SDK boundary, so one localised cast.
  return { ok: true, resources: gate.resources as Cat21GateResourcesOfKind<K> };
}

/**
 * Wallet-policy caps + own-address for the SDK gate. Builds the
 * config from the active account context. Centralising it here keeps
 * the four rpc methods one line of gate-config each.
 */
const WALLET_GATE_CAPS = {
  /** Real congestion has peaked ~700 sat/vB. 1000 is "you typed it wrong". */
  maxFeeRatePerVbyte: 1000,
  /** 21 BTC × 10 — fat-finger backstop. */
  maxPriceSats: 21_000_000_000,
} as const;

function gateConfig(accountCtx: Cat21AccountContext): Cat21OperationGateConfig {
  return {
    network: walletNetworkToSdkNetwork(accountCtx.network),
    ownPaymentAddress: accountCtx.paymentAddress,
    ...(accountCtx.allowedOperations && accountCtx.allowedOperations.length > 0
      ? { allowedOperations: accountCtx.allowedOperations }
      : {}),
    ...WALLET_GATE_CAPS,
  };
}
