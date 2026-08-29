# Handover: cat21-wallet adopts the ordpool-sdk framework-agnostic core

**Goal:** `Cat21RpcService` delegates its coin-selection → fee → build → sign →
broadcast sequencing to the SDK's framework-agnostic **core**, so there is ONE
orchestration for all three paths — and Path 2/3 (wallet manual + bot) finally
get the **safe-auto, content-checked coin selection** the wallet's own
`pickFundingUtxo` never had (it only avoids cats, and only by the utxos.service
protection — it never checks the coin it picks for inscriptions/runes/rare-sats).

This is the "delete the duplicated orchestration layer" work the maintainer
approved. Do it in **reviewed slices per HARD RULE #8** (spec-first stub commit,
sign-off, implementation, independent review agent).

---

## Current state (already done, committed)

- **SDK pinned at `198d970`** (`apps/extension/package.json`) — this ships the
  core via `ordpool-sdk/core` (Angular-free) + `executeMint`/`executeTransfer`
  returning the realised fee. `pnpm install` already run; `dist-core/cat21-core/`
  present.
- **cat21 suite GREEN (633)** on that pin. One stale spec fixed: the SDK dropped
  the `price-below-postage-floor` gate (a below-dust *price* is legal — the seller
  nets price + sellerInput.value ≥ dust), so `createOffer` now accepts it.
  Commit `dfa0da80a`.
- **Design approved by the maintainer** (this handover encodes it). Option A
  chosen for the input-shape question; `cat21-fee-simulation.ts` to be deleted
  (verified byte-for-byte equivalent to the core's fee — same `twoPassFeeSimulation`
  + same builders, just one copy instead of two).

## The SDK core API you consume (`import … from 'ordpool-sdk/core'`)

| Function | Returns | Notes |
|---|---|---|
| `executeMint(params, ports)` | `{ txid, channel, feeSats }` | fresh 546 cat; funding covers postage+tip+fee |
| `executeTransfer(params, ports)` | `{ txid, channel, feeSats }` | preserves the cat UTXO size |
| `createOffer(params, ports)` | `CreateOfferArtifact { offerPsbt, buyerFundingUtxo, feeSats, changeSats }` | buyer-signed bid PSBT; **no broadcast** — this is `cat21_buy` |
| `acceptOffer(params, ports)` | `{ txid, channel }` | validate → sign input 0 → broadcast |
| `validateOffer(params)` | `Cat21OfferValidation` | pure, for the accept preview |
| `simulateMint/Transfer/CreateOffer/Inscribe(params, {utxos,scan})` | preview | select + fee, no signing |

**Ports** (all Promise-based; you build these from `Cat21RpcDeps`):
- `UtxosPort.spendableUtxos(addr) → CoreFundingUtxo[]` where `CoreFundingUtxo = { txid, vout, value, transactionHex? }`
- `ContentScanPort.classify(outpoint) → 'clean' | 'has-assets'`
- `SignPort.sign(psbt, 'all' | number[]) → { hex, weight }`
- `BroadcastPort.broadcast(hex) → { txid, channel }`
- `OfferCreateSignPort.signBuyerInputs(psbt, number[]) → Uint8Array` (for `cat21_buy`)

## The approved port mapping (`Cat21RpcDeps` → core ports)

| Core port | Built from |
|---|---|
| `UtxosPort` | **new dep** `spendableUtxos(addr)` — the spendable bucket as a list (replaces `pickFundingUtxo`) |
| `ContentScanPort` | **new dep** `classifyOutpoint(op)` — cat-only (reuse the cat21-ord query in `utxos.service`; **cat-only is intentional per the maintainer**) |
| `SignPort` | **mode-aware, built per call:** `mode==='manual' ? signWithConfirmation(psbt, intent, idx) : signSilently(psbt, idx)` (both already return `{hex, weight}`) |
| `BroadcastPort` | `deps.broadcast({ hex, weight })`; **re-derive `weight` from the hex** (`btc.Transaction.fromHex(hex).weight`) — the core's port passes hex only |
| `OfferCreateSignPort` | `deps.signBuyOfferInputs(psbt, idx)` |

## Option A (approved): add `paymentPublicKey` to `Cat21AccountContext`

The core's builders use the input adapter (derives the input shape from
`paymentPublicKey + paymentAddress`, and handles legacy P2PKH via
`nonWitnessUtxo`). The wallet currently feeds `buildCat21MintPsbt` a *raw*
prepared input (`scriptPubKey`/`tapInternalKey` from `utxos.service`). So:
- Add `paymentPublicKey: string` (hex) to `Cat21AccountContext`.
- Wire it from the keychain in `use-cat21-rpc-deps.ts` (it's the key that signs).
- Keep the SDK core single-path (the adapter path — the one proven on-chain).

## The slices (do in order; each is one reviewed HARD RULE #8 commit)

1. **Foundations:** `Cat21AccountContext += paymentPublicKey`; `Cat21RpcDeps +=
   spendableUtxos, classifyOutpoint` (keep `pickFundingUtxo` for now so
   transfer/buy still build); add the 4 port-adapter helpers to `Cat21RpcService`
   (+ typed `SignError`/`BroadcastError` wrappers so error mapping stays precise).
2. **`mint`** → `executeMint`. Shape: `openPipeline → {mode, accountCtx}`; call
   `executeMint({walletType: cat21wallet, network, paymentPublicKey, paymentAddress,
   recipientAddress: intent.recipient, feeRatePerVbyte: intent.feeRate, tip}, ports)`;
   on success `recordSpend(546 + tipValue + out.feeSats)` and return
   `{ok:true, value:{kind:'broadcast', txid: out.txid, channel: out.channel}}`;
   map core errors (`/Select a funding UTXO|Insufficient funds/` → `denied('intent-invariant-violated','funding-pick-failed: …')`; SignError/BroadcastError → `denied('broadcast-failed', …)`).
   Update the mint specs (mock the new deps + `accountCtx.paymentPublicKey`; the
   `pickFundingUtxo`-throws tests become `spendableUtxos`-empty / classify tests).
3. **`transfer`** → `executeTransfer` (same shape; `catUtxo` from `resolveCatUtxo`).
4. **`buy`** → `createOffer` core + `deps.postBid(...)` (buy builds the buyer bid).
5. **`acceptOffer`** → `acceptOffer` core (`validateOffer` inside it; no selection).
   **`createOffer` (SELL / `cat21_create_offer`) stays unchanged** — it emits a
   *listing* (data via `buildListing`), no funding, no PSBT, no core flow.
6. **Delete duplication:** remove `pickFundingUtxo` from `Cat21RpcDeps` + its
   wiring; **delete `cat21-fee-simulation.ts`** (all callers now use the core).
7. **`architecture.spec.ts`:** it currently pins "rpc-service calls
   `buildCat21MintPsbt`"; repin to "calls `executeMint`/`executeTransfer`/…",
   "passes the mode-aware SignPort", "signs `'all'` for mint/transfer, `[0]` for
   accept". Update in the SAME commit (HARD RULE #9). Also update the
   `CLAUDE.md` HARD RULE #10 prose if it names the builders directly.
8. **Independent review** (HARD RULE #8): spawn a review agent with the diff +
   `CLAUDE.md`; fold its output into the commit message.

## Gotchas

- The mode is resolved in `openPipeline`; build the SignPort from that resolved
  mode (don't re-resolve).
- The core's `executeMint`/`executeTransfer` **throw** on `expert-required`
  (only asset coins) / `insufficient`. For autonomous mode that's the correct
  safe refusal (never auto-spend an asset coin). For manual mode there's no
  coin-picker in the intent today, so `denied` is fine; a future expert-mode
  picker would pass `selectedFundingUtxo`.
- `recordSpend` needs the fee — that's why `executeMint`/`executeTransfer` return
  `feeSats`. `acceptOffer` has no wallet spend (buyer paid the fee).
- SDK state you're building on: **core is Angular-free; transfer/mint/offer flows
  are RxJS-free; inscribe/accept-offer carry RxJS transitively** (they wrap the
  existing engines). The wallet doesn't inscribe, so that's moot here.

## Verify each slice

```
pnpm --filter @leather.io/extension typecheck
pnpm --filter @leather.io/extension test:unit -- src/background/cat21
```

Reference: the SDK design doc is `ordpool-sdk/CORE-MIGRATION.md`; the on-chain
proof of the core flows is `ordpool-sdk/e2e/regtest/core-flows-roundtrip.spec.ts`.
