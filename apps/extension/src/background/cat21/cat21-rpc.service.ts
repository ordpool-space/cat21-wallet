import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import {
  type BroadcastOutcome,
  type BroadcastPort,
  CAT21_POSTAGE_SATS,
  Cat21GateResources,
  Cat21OfferValidation,
  Cat21OperationGateConfig,
  Cat21TransferCatInput,
  type ContentScanPort,
  type CoreFundingUtxo,
  type CreateOfferArtifact,
  KnownOrdinalWalletType,
  Network,
  type OfferCreateSignPort,
  type SignPort,
  type UtxoClassification,
  type UtxosPort,
  // Aliased: the SDK's createOffer is the BUYER-side buy-offer builder
  // (cat21_buy), distinct from this service's own createOffer (the SELL
  // listing, cat21_create_offer).
  createOffer as createBuyOffer,
  executeMint,
  executeTransfer,
  toScureNetwork,
  validateCat21Operation,
} from 'ordpool-sdk/core';

import { validateAcceptOffer } from './builders/accept-offer-validator';
import { buildListing } from './builders/listing-builder';
import {
  AgentModeFlag,
  Cat21Transport,
  ModeResolverError,
  resolveSigningMode,
} from './mode-resolver';
import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
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
 * Active-account context the service needs to build a signable PSBT.
 * The dispatcher (background page) resolves this at call time from the
 * wallet's Redux state and passes it in — keeps `Cat21RpcService`
 * pure-functional in its dependencies.
 */
export interface Cat21AccountContext {
  /** Sender's own payment address. Change (and buyer change) returns here. */
  paymentAddress: string;
  /**
   * The account's payment public key, hex (33-byte compressed). The SDK
   * core's input adapter derives the funding input's PSBT shape from
   * `paymentPublicKey + paymentAddress`. Optional so gate-only callers /
   * legacy specs stay valid; the core flows fail closed with a typed
   * reason when it's absent.
   */
  paymentPublicKey?: string;
  /**
   * The account's ordinals (taproot) address. On `cat21_buy` the cat
   * lands here (buy-offer output 0) per ordinal theory, and it's the
   * buyer identity the Bazaar keys the bid on. Optional because mint /
   * offer flows never need it; `buy`/`transfer` fail closed with a typed
   * reason when it's absent.
   */
  ordinalsAddress?: string;
  /**
   * The account's ordinals public key, hex (33-byte compressed; the SDK
   * x-only-normalises it for taproot). Needed for `transfer` (the cat
   * input 0 lives at the ordinals address) and `accept_offer` (the
   * seller signs input 0). Optional for the same reason as above.
   */
  ordinalsPublicKey?: string;
  /** Network the account is operating on. */
  network: 'mainnet' | 'testnet' | 'regtest';
  /**
   * Operation-kind allowlist sourced from the per-account
   * `AgentPolicy.allowedOperations` (with the `cat21_` prefix
   * stripped to match the SDK gate's bare-name convention). When
   * set and non-empty, the SDK structural gate rejects any other
   * operation kind with `operation-kind-not-allowed`. Empty or
   * unset = permissive (default).
   */
  allowedOperations?: readonly ('mint' | 'transfer' | 'create_offer' | 'accept_offer' | 'buy')[];
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
  /**
   * The per-account cap gate. `spendSatsOverride` supplies a
   * resolution-derived spend the intent doesn't carry (today only
   * `cat21_transfer`, which passes the resolved cat UTXO value) so the
   * amount caps bind the real outflow, not a placeholder.
   */
  evaluateAgentPolicy(
    intent: Cat21Intent,
    spendSatsOverride?: number
  ): { allowed: true } | { allowed: false; reason: string; detail?: string };
  /**
   * The account's spendable funding UTXOs (the `available` bucket, not
   * cat-bearing). The SDK core does its own content-checked selection +
   * fee over this list — so the wallet no longer size-heuristic-picks.
   * Backs the core's `UtxosPort`.
   */
  spendableUtxos(address: string): Promise<CoreFundingUtxo[]>;
  /**
   * Content-safety verdict for one outpoint (`<txid>:<vout>`). Cat-only
   * for cat21-wallet (reuses the cat21-ord `/output` query): `has-assets`
   * when the coin carries a cat, else `clean`. Rejects on a scan failure
   * — the core treats a failed scan as not-auto (expert-mode), never as
   * clean. Backs the core's `ContentScanPort`.
   */
  classifyOutpoint(outpoint: string): Promise<UtxoClassification>;
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
    network: 'mainnet' | 'testnet' | 'regtest';
  }): Cat21OfferValidation;
  /**
   * Autonomous-mode signer: signs without prompting.
   *
   * Same `inputIndexes` semantics as `signWithConfirmation` — `'all'`
   * for wallet-built CAT-21 mint txs (mint, transfer); `[0]` for
   * accept-offer where the PSBT was buyer-built.
   */
  signSilently(psbt: Uint8Array, inputIndexes: 'all' | number[]): Promise<SignedTx>;
  /**
   * Buy-offer signer. Signs ONLY the buyer's funding inputs
   * (`inputIndexes` = 1..N) with SIGHASH_ALL and returns the
   * HALF-signed PSBT bytes. Does NOT finalize — input 0 (the seller's
   * cat) stays unsigned for the seller to sign at accept time. Never
   * broadcasts; the artifact is a bid, not a chain tx.
   *
   * Distinct from `signWithConfirmation` / `signSilently`, which
   * finalize + return a broadcastable `{ hex, weight }`. A buy-offer
   * PSBT can't be finalized (input 0 is unsigned), so buy needs its
   * own no-finalize signer. Both Path 2 (popup consent) and Path 3
   * (autonomous) use this same dep; the mode gate already ran in the
   * pipeline.
   */
  signBuyOfferInputs(psbt: Uint8Array, inputIndexes: number[]): Promise<Uint8Array>;
  /**
   * Broadcast dispatcher — one-to-one with the core's `BroadcastPort`
   * (finalized-tx hex in, `{txid, channel}` out). The wiring re-derives
   * the weight from the hex for the mempool-vs-Slipstream channel choice.
   */
  broadcast(signedTxHex: string): Promise<BroadcastResult>;
  /**
   * Posts a buyer-signed buy-offer PSBT to the CAT-21 Bazaar as a bid.
   * Unauthenticated — the buyer's SIGHASH_ALL signatures on inputs
   * 1..N ARE the auth (no session token). Wired to the Bazaar client;
   * tests stub it. Throws on rejection (mapped Bazaar error).
   */
  postBid(args: Cat21PostBidArgs): Promise<void>;
  /** Per-account daily-spend tracker (updated on every accepted action). */
  recordSpend(sats: number): void;
}

/**
 * Arguments the service hands `postBid`. Field-for-field the Bazaar
 * bid DTO minus the network-string ↔ enum translation the client does.
 * Internal to the `Cat21RpcDeps.postBid` signature — the popup wiring
 * infers the shape from the interface, so it isn't exported.
 */
interface Cat21PostBidArgs {
  network: 'mainnet' | 'testnet' | 'regtest';
  catTxid: string;
  catVout: number;
  /** Cat numbers on the UTXO (buyer-observed, from cat21-ord's index — not a size heuristic). */
  cats: number[];
  headlineCatNumber: number;
  bidSats: number;
  /** Where the cat lands (buy-offer output 0) — the buyer's ordinals address. */
  buyerOrdinalsAddress: string;
  /** Where buyer change lands (output 2) — the buyer's payment address. */
  buyerPaymentAddress: string;
  /** Where the sale proceeds land (output 1) — from the listing/permalink. */
  sellerPaymentAddress: string;
  /** The buyer-signed buy-offer PSBT, base64. */
  psbtBase64: string;
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

  /* ── SDK-core port adapters ─────────────────────────────────────────
   * Each maps one `Cat21RpcDeps` callback onto the framework-agnostic
   * core's injected port. The core owns the shared select → fee → build
   * → sign → broadcast sequencing; these adapters own the wiring. */

  /** Spendable-funding source for the core's content-checked selection. */
  private utxosPort(): UtxosPort {
    return { spendableUtxos: address => this.deps.spendableUtxos(address) };
  }

  /** Cat-only content scan (cat21-wallet's chosen scan depth). */
  private contentScanPort(): ContentScanPort {
    return { classify: outpoint => this.deps.classifyOutpoint(outpoint) };
  }

  /**
   * Mode-aware signer. Built from the mode the pipeline already
   * resolved (never re-resolved): manual → popup-confirm signer,
   * autonomous → silent signer. Both finalize and return `{hex, weight}`.
   * A signer failure is wrapped as `SignError` so `mapCoreError` maps it
   * to `broadcast-failed` (not `funding-pick-failed`).
   */
  private signPort(mode: 'autonomous' | 'manual', intent: Cat21Intent): SignPort {
    return {
      sign: async (psbt, inputIndexes) => {
        try {
          return mode === 'manual'
            ? await this.deps.signWithConfirmation(psbt, intent, inputIndexes)
            : await this.deps.signSilently(psbt, inputIndexes);
        } catch (err) {
          throw new SignError(errorDetail(err));
        }
      },
    };
  }

  /**
   * Broadcast adapter — one-to-one with the core's `BroadcastPort`
   * (hex in, `{txid, channel}` out). The mempool-vs-Slipstream weight
   * re-derivation lives in the production `deps.broadcast` wiring, not
   * here. A broadcast failure is wrapped as `BroadcastError`.
   */
  private broadcastPort(): BroadcastPort {
    return {
      broadcast: async signedTxHex => {
        try {
          return await this.deps.broadcast(signedTxHex);
        } catch (err) {
          throw new BroadcastError(errorDetail(err));
        }
      },
    };
  }

  /**
   * Buy-offer signer: signs ONLY the buyer's funding inputs (1..N)
   * without finalizing — input 0 (the seller's cat) stays unsigned for
   * the seller. Used by the core's `createOffer` (the `cat21_buy` path).
   */
  private offerCreateSignPort(): OfferCreateSignPort {
    return {
      signBuyerInputs: async (psbt, buyerInputIndexes) => {
        try {
          return await this.deps.signBuyOfferInputs(psbt, buyerInputIndexes);
        } catch (err) {
          throw new SignError(errorDetail(err));
        }
      },
    };
  }

  /**
   * `cat21_mint` — delegates the full select → fee → build → sign →
   * broadcast sequence to the SDK core's `executeMint`. The core runs
   * content-checked funding selection over whatever the wallet's
   * `ContentScanPort` reports; the wallet wires a CAT-ONLY scan
   * (`classifyOutpoint` → cat21-ord `/output`, the maintainer's chosen
   * depth), so in the wallet the core refuses cat-bearing funding coins.
   * It does NOT detect regular inscriptions / runes / rare sats — cat21-
   * ord only indexes cats. `executeMint` returns the realised fee for
   * the daily-cap accounting.
   */
  async mint(intent: Cat21MintIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    const opened = this.openPipeline({ kind: 'mint', intent }, transport);
    if ('result' in opened) return opened.result;
    const { mode, accountCtx } = opened;

    const paymentPublicKey = accountCtx.paymentPublicKey;
    if (!paymentPublicKey) {
      return denied('intent-invariant-violated', 'no-payment-public-key');
    }

    const tipValue = intent.tip && intent.tip.value > 0 ? intent.tip.value : 0;
    let out: BroadcastOutcome & { feeSats: number };
    try {
      out = await executeMint(
        {
          walletType: KnownOrdinalWalletType.cat21wallet,
          network: walletNetworkToSdkNetwork(accountCtx.network),
          paymentPublicKey: hex.decode(paymentPublicKey),
          paymentAddress: accountCtx.paymentAddress,
          recipientAddress: intent.recipient,
          feeRatePerVbyte: intent.feeRate,
          tip:
            intent.tip && intent.tip.value > 0
              ? { address: intent.tip.address, valueSats: intent.tip.value }
              : undefined,
        },
        {
          utxos: this.utxosPort(),
          scan: this.contentScanPort(),
          sign: this.signPort(mode, intent),
          broadcast: this.broadcastPort(),
        }
      );
    } catch (err) {
      return mapCoreError(err);
    }

    this.deps.recordSpend(CAT21_POSTAGE_SATS + tipValue + out.feeSats);
    return { ok: true, value: { kind: 'broadcast', txid: out.txid, channel: out.channel } };
  }

  /**
   * `cat21_transfer` — delegates the full select → fee → build → sign →
   * broadcast sequence to the SDK core's `executeTransfer`. The cat UTXO
   * rides input 0 (at the ordinals address) and is preserved whole; the
   * fee comes from a content-checked funding coin at inputs 1..N. The
   * core signs `'all'` (every input is wallet-owned).
   */
  async transfer(intent: Cat21TransferIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    // Resolve the cat UTXO up front (synchronous, cached): its value is the
    // transfer's real outflow (the whole UTXO moves to the recipient), and
    // the cap gate inside openPipeline must see it. The intent alone doesn't
    // carry it, so we feed it as the spend override; without it the amount
    // caps would undercount a large-value cat.
    let catUtxo: TransferUtxo;
    try {
      catUtxo = this.deps.resolveCatUtxo(intent.catId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }

    const opened = this.openPipeline({ kind: 'transfer', intent }, transport, catUtxo.value);
    if ('result' in opened) return opened.result;
    const { mode, accountCtx } = opened;

    const paymentPublicKey = accountCtx.paymentPublicKey;
    const ordinalsPublicKey = accountCtx.ordinalsPublicKey;
    const ordinalsAddress = accountCtx.ordinalsAddress;
    if (!paymentPublicKey) {
      return denied('intent-invariant-violated', 'no-payment-public-key');
    }
    if (!ordinalsPublicKey || !ordinalsAddress) {
      return denied('intent-invariant-violated', 'no-ordinals-key');
    }

    // The SDK core derives the cat's input-0 script from ordinalsAddress
    // + ordinalsPublicKey (its API doesn't take the cat's real
    // scriptPubKey). So transfer only works when the cat actually lives
    // at THIS account's ordinals address. A cat received at a different
    // address would otherwise build an input that doesn't match the UTXO
    // and fail at broadcast; deny early with a clear reason instead.
    const scureNet = toScureNetwork(walletNetworkToSdkNetwork(accountCtx.network));
    const ordinalsScript = btc.OutScript.encode(btc.Address(scureNet).decode(ordinalsAddress));
    if (hex.encode(catUtxo.scriptPubKey) !== hex.encode(ordinalsScript)) {
      return denied(
        'intent-invariant-violated',
        'cat-not-at-ordinals-address: the SDK transfer path requires the cat to live at this account’s ordinals address'
      );
    }

    let out: BroadcastOutcome & { feeSats: number };
    try {
      out = await executeTransfer(
        {
          walletType: KnownOrdinalWalletType.cat21wallet,
          network: walletNetworkToSdkNetwork(accountCtx.network),
          ordinalsPublicKey: hex.decode(ordinalsPublicKey),
          ordinalsAddress,
          paymentPublicKey: hex.decode(paymentPublicKey),
          paymentAddress: accountCtx.paymentAddress,
          catUtxo: { txid: catUtxo.txid, vout: catUtxo.vout, value: catUtxo.value },
          recipientAddress: intent.recipient,
          feeRatePerVbyte: intent.feeRate,
        },
        {
          utxos: this.utxosPort(),
          scan: this.contentScanPort(),
          sign: this.signPort(mode, intent),
          broadcast: this.broadcastPort(),
        }
      );
    } catch (err) {
      return mapCoreError(err);
    }

    // The cat UTXO (typically 546) moves to the recipient; the wallet's
    // outflow is that postage plus the realised miner fee.
    this.deps.recordSpend(catUtxo.value + out.feeSats);
    return { ok: true, value: { kind: 'broadcast', txid: out.txid, channel: out.channel } };
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
   *
   * DELIBERATELY NOT migrated to the SDK core's `acceptOffer` (unlike
   * mint / transfer / buy). The core's `acceptOffer` signs via the SDK's
   * cat21wallet signer, which calls `window.Cat21Provider` — the
   * dapp-injected provider, absent in the extension background where this
   * service runs. accept-offer also has NO coin selection (the buyer
   * already funded the offer), so it gains nothing from the core's
   * content-checked selection. It keeps keychain signing here on purpose;
   * see CLAUDE.md HARD RULE #10.
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
   * `cat21_buy` — the BUYER side of the Bazaar. The wallet builds a
   * buy-offer PSBT for a listed cat, funds it from the buyer's own
   * UTXOs, signs ONLY the buyer inputs (1..N — input 0 is the seller's
   * cat, left unsigned), and POSTs the half-signed PSBT to the Bazaar
   * as a bid. It does NOT broadcast; the seller accepts + broadcasts.
   *
   *   1. validateCat21Operation({ kind: 'buy', intent })
   *   2. resolveSigningMode(...)
   *   3. resolveCatUtxo(catId) — the seller's cat UTXO on-chain (value
   *      PRESERVED from cat21-ord + scriptPubKey)
   *   4. createBuyOffer(...) via the SDK core — content-checked buyer
   *      funding selection, two-pass fee, buy-offer PSBT, and buyer-input
   *      signing (SIGHASH_ALL on inputs 1..N; input 0 stays for the
   *      seller). No broadcast — the artifact is a bid.
   *   5. postBid(...) — unauthenticated; the SIGHASH_ALL sigs are the auth
   *   6. Return `{ kind: 'bid', ... }`.
   */
  async buy(intent: Cat21BuyIntent, transport: Cat21Transport): Promise<Cat21RpcResult> {
    const opened = this.openPipeline({ kind: 'buy', intent }, transport);
    if ('result' in opened) return opened.result;
    // `resources` (parsed catId → mint txid) is unused: a moved cat's
    // current UTXO differs from its inscription-id txid, so the seller
    // input comes from the on-chain resolver, not the parsed catId.
    const { accountCtx } = opened;

    const paymentPublicKey = accountCtx.paymentPublicKey;
    // The cat lands at the buyer's ordinals (taproot) address. Fail
    // closed if the account has none — never route a cat to a payment
    // address (would contaminate ordinal-safety accounting).
    const buyerReceiveAddress = accountCtx.ordinalsAddress;
    if (!paymentPublicKey) {
      return denied('intent-invariant-violated', 'no-payment-public-key');
    }
    if (!buyerReceiveAddress) {
      return denied(
        'intent-invariant-violated',
        'no-ordinals-address: active account has no taproot receive address for the cat'
      );
    }

    // The seller's cat UTXO, resolved on-chain by cat21-ord (current
    // location + the seller's scriptPubKey — this is NOT our own cat).
    // That resolver is authoritative for where the cat lives right now,
    // so there's no separate "expected outpoint" to cross-check against
    // (unlike acceptOffer, where the seller declares expectedSellerUtxo).
    let sellerCatUtxo: TransferUtxo;
    try {
      sellerCatUtxo = this.deps.resolveCatUtxo(intent.catId);
    } catch (err) {
      return denied('intent-invariant-violated', `cat-utxo-resolve-failed: ${errorDetail(err)}`);
    }

    // The SDK core builds + buyer-signs the offer: content-checked buyer
    // funding selection, two-pass fee, buy-offer PSBT, and buyer-input
    // signing (SIGHASH_ALL on inputs 1..N; input 0 stays for the seller).
    // No broadcast — the artifact is a bid.
    let artifact: CreateOfferArtifact;
    try {
      artifact = await createBuyOffer(
        {
          walletType: KnownOrdinalWalletType.cat21wallet,
          network: walletNetworkToSdkNetwork(accountCtx.network),
          paymentPublicKey: hex.decode(paymentPublicKey),
          paymentAddress: accountCtx.paymentAddress,
          buyerReceiveAddress,
          sellerPaymentAddress: intent.sellerPaymentAddress,
          targetCat: {
            txid: sellerCatUtxo.txid,
            vout: sellerCatUtxo.vout,
            value: sellerCatUtxo.value,
            scriptPubKey: sellerCatUtxo.scriptPubKey,
          },
          priceSats: intent.bidSats,
          feeRatePerVbyte: intent.feeRate,
        },
        {
          utxos: this.utxosPort(),
          scan: this.contentScanPort(),
          signOffer: this.offerCreateSignPort(),
        }
      );
    } catch (err) {
      return mapCoreError(err);
    }

    const psbtBase64 = Buffer.from(artifact.offerPsbt).toString('base64');

    try {
      await this.deps.postBid({
        network: accountCtx.network,
        catTxid: sellerCatUtxo.txid,
        catVout: sellerCatUtxo.vout,
        cats: [intent.catNumber],
        headlineCatNumber: intent.catNumber,
        bidSats: intent.bidSats,
        buyerOrdinalsAddress: buyerReceiveAddress,
        buyerPaymentAddress: accountCtx.paymentAddress,
        sellerPaymentAddress: intent.sellerPaymentAddress,
        psbtBase64,
      });
    } catch (err) {
      return denied('broadcast-failed', `bid-post-failed: ${errorDetail(err)}`);
    }

    // Daily-cap accounting: the buyer commits bidSats + realised fee.
    this.deps.recordSpend(intent.bidSats + artifact.feeSats);
    return {
      ok: true,
      value: {
        kind: 'bid',
        catNumber: intent.catNumber,
        bidSats: intent.bidSats,
        catTxid: sellerCatUtxo.txid,
        catVout: sellerCatUtxo.vout,
        psbtBase64,
      },
    };
  }

  /**
   * Pipeline preamble: run the SDK gate, then resolve the signing
   * mode (which also enforces the per-account caps, both modes).
   * Returns either the early-return result (rejection) or the resolved
   * `{ mode, accountCtx, resources }` for the per-method body to consume.
   * The `resources` field is narrowed to the kind passed in so consumers
   * don't cast. `spendSatsOverride` is forwarded to the cap gate for kinds
   * whose spend isn't intent-derived (transfer passes the resolved cat
   * UTXO value so the amount caps see the real outflow).
   */
  private openPipeline<K extends Cat21OperationKind>(
    operation: Cat21OperationOfKind<K>,
    transport: Cat21Transport,
    spendSatsOverride?: number
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
        spendSatsOverride,
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
      result = await this.deps.broadcast(signed.hex);
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
export function walletNetworkToSdkNetwork(net: 'mainnet' | 'testnet' | 'regtest'): Network {
  if (net === 'mainnet') return Network.Mainnet;
  if (net === 'regtest') return Network.Regtest;
  return Network.Testnet3;
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

/**
 * Signer-port failure (user cancelled, keychain locked, …). Distinct
 * class so `mapCoreError` routes it to `broadcast-failed`, never to a
 * funding/selection reason.
 */
class SignError extends Error {}
/** Broadcast-port failure (electrs / Slipstream rejected the tx). */
class BroadcastError extends Error {}

/**
 * Map a thrown SDK-core error to a typed `Cat21RpcResult` denial.
 *
 *   - `SignError`      → `broadcast-failed: sign-failed`
 *   - `BroadcastError` → `broadcast-failed`
 *   - funding/selection throws (only asset coins cover, nothing covers,
 *     insufficient funds, `Select a funding UTXO`) →
 *     `intent-invariant-violated: funding-pick-failed`
 *   - anything else → `intent-invariant-violated: build-failed`
 */
function mapCoreError(err: unknown): Cat21RpcResult {
  if (err instanceof SignError) return denied('broadcast-failed', `sign-failed: ${err.message}`);
  if (err instanceof BroadcastError) return denied('broadcast-failed', err.message);
  const msg = errorDetail(err);
  if (/Select a funding UTXO|Insufficient funds|only asset coins cover|nothing covers/.test(msg)) {
    return denied('intent-invariant-violated', `funding-pick-failed: ${msg}`);
  }
  return denied('intent-invariant-violated', `build-failed: ${msg}`);
}

/**
 * Wallet-side operation union. Same discriminants as the SDK's
 * `Cat21Operation`, but each `intent` is the WALLET type (SDK intent +
 * the `mode` tag, and — for buy — the wallet-only `catNumber`). The
 * pipeline is typed on this so `operation.intent` narrows to the wallet
 * intent (which `resolveSigningMode` consumes). Every wallet intent is
 * a structural superset of its SDK counterpart, so a wallet operation
 * is assignable to the SDK `Cat21Operation` that `validateCat21Operation`
 * expects.
 */
type WalletCat21Operation =
  | { kind: 'mint'; intent: Cat21MintIntent }
  | { kind: 'transfer'; intent: Cat21TransferIntent }
  | { kind: 'create_offer'; intent: Cat21CreateOfferIntent }
  | { kind: 'accept_offer'; intent: Cat21AcceptOfferIntent }
  | { kind: 'buy'; intent: Cat21BuyIntent };

type Cat21OperationKind = WalletCat21Operation['kind'];
type Cat21OperationOfKind<K extends Cat21OperationKind> = Extract<
  WalletCat21Operation,
  { kind: K }
>;
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
