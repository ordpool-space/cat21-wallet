# Claude Code — cat21-wallet onboarding

This file is the single source of truth for working on the Cat21 Wallet
repo. Read it before touching anything. The rules at the top are not
suggestions; the rest is map + history.

---

## HARD RULE #1: every cat-touching tx we build carries nLockTime=21

The CAT-21 protocol marker is `nLockTime = 21`. cat21-ord reads the
field structurally (`tx.lock_time == 21` → mint a cat at the first sat
of the first output) and the spec at
[`cat21/README.md`](https://github.com/ordpool-space/cat21) allows a
single CAT-21 ordinal to carry multiple cats through repeated minting.

**Our wallet builds every cat-touching tx with `nLockTime=21` by default.**
Maximum cats per tx, on principle. The genesis-cat holder's intent is
that every transaction we control mints another cat onto the ordinal it
moves — sell, transfer, accept, mint, all of them.

`nLockTime=21` is **data, not a time-lock**: block 21 was mined in 2009,
so the field has no consensus meaning. It's pure protocol-marker bytes.

### What this means concretely

| Operation | Rule | Where enforced |
|---|---|---|
| Building a mint tx | `lockTime = 21`. Hard runtime assert. | `ordpool-sdk/src/cat21-mint/cat21-mint.helper.ts → buildCat21MintPsbt` |
| Building a transfer tx | `lockTime = 21`. Hard runtime assert. | `ordpool-sdk/src/cat21-transfer/cat21-transfer.helper.ts → buildCat21TransferPsbt` |
| Building a buy-offer PSBT (buyer-initiated, our SDK) | `lockTime = 21`. Hard runtime assert. | `ordpool-sdk/src/cat21-offer/cat21-offer.helper.ts → buildCat21BuyOfferPsbt` |
| Cat21wallet input sequence on any tx we build | `0xfffffffd` (RBF allowed; our own accelerate flow preserves `lockTime=21` through replacement). | `CAT21_WALLET_INPUT_SEQUENCE` in `ordpool-sdk/src/cat21-protocol/cat21-sequence.ts` |
| Other-wallet MINT input sequence | `0xfffffffe` (RBF disabled; locks third-party accelerate UIs out of touching the marker). MINT-ONLY: transfers + offers are RBF-on (`0xfffffffd`) for every wallet since SDK `703f90b` — the cat is already on chain, worst RBF outcome is a missed bonus mint. | `CAT21_OTHER_WALLET_MINT_INPUT_SEQUENCE` via `ordpool-sdk/src/cat21-protocol/cat21-sequence.ts → resolveCat21MintInputSequence` (mint-only resolver) |
| Replacing a CAT-21 tx via RBF (our accelerate path) | Replacement MUST keep `lockTime = 21`. Hard runtime assert. | `apps/extension/src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts` |
| Cat-bearing UTXO in plain BTC send | Refused; UTXO lives in `protected` bucket. | `packages/services/src/utxos/utxos.service.ts` |
| Accepting an inbound buy-offer PSBT (we sign, we don't build) | Sign as-is regardless of lockTime. Buyer's choice; missing `21` is their missed bonus mint, not a cat loss. The popup displays the inbound lockTime so a human seller sees what they're signing. | `apps/extension/src/background/cat21/builders/accept-offer-validator.ts` (wallet wrapper delegating to `ordpool-sdk/src/cat21-offer/cat21-offer.helper.ts → validateCat21BuyOfferPsbt`), `apps/extension/src/background/cat21/cat21-rpc.service.ts → acceptOffer` |
| RBF by other tooling on our broadcast txs | Out of our control. Their replacement is a new tx with new signatures; if they drop `lockTime=21`, missed mint, not lost cat. | n/a — by design |

### Why our code defaults to 21 everywhere

Cats are immutable. Once a sat is a CAT-21 ordinal, it stays one — ordinal
theory carries the existing cat through any future tx whether or not
that tx mints a fresh one. The cost of skipping `lockTime=21` on a
transfer or offer-acceptance is **a missed free cat on the same sat**,
not a destroyed cat. We default to taking the free cat every time.

### Mint protection: the 2024 Xverse incident is the lesson

A third-party wallet replaced a pending CAT-21 mint with a higher-fee
replacement that did not preserve `lockTime = 21`, and that mint was
lost. The protection that keeps this from happening on our infrastructure:

- Our own mints use `sequence = 0xfffffffd` (RBF on); our accelerate
  code path preserves `lockTime = 21` through any replacement.
- Mints we generate via the SDK for other wallets use
  `sequence = 0xfffffffe` (RBF off) so their accelerate UI can't fire
  at all.

This protection is **mint-only**. Transfers and offers don't need it:
the original cat is already on chain by the time those flows run, so a
third-party RBF that drops the marker just costs the user the bonus
mint, not the original cat.

### How to verify when touching cat-flow builder code

Builder code lives in **`ordpool-sdk/src/cat21-*`** (the SDK owns PSBT
construction; see HARD RULE #10). The wallet only orchestrates via
`Cat21RpcService.{mint,transfer,createOffer,acceptOffer}`. The
historic PSBT builders (`mint-builder.ts`, `transfer-builder.ts`)
under `apps/extension/src/background/cat21/builders/` were deleted
in iter 4–5; the architecture spec `HARD RULE — mint logic lives in
the SDK, not inline in the wallet` positively asserts those files
are gone. What REMAINS in `builders/` builds no PSBTs:
`accept-offer-validator.ts` (thin wrapper delegating to the SDK's
`validateCat21BuyOfferPsbt`) and `listing-builder.ts` (assembles
the `cat21_create_offer` listing payload — data, not bytes).

1. Modify the builder in the SDK (`ordpool-sdk/src/cat21-*-helper.ts`).
2. Rebuild the SDK from the wallet: `pnpm sdk:build` (the staleness
   guard at `apps/extension/scripts/check-sdk-fresh.cjs` fires
   otherwise).
3. Run the wallet's cat21 suite:
   `pnpm --filter @leather.io/extension test:unit -- src/background/cat21`.
4. `apps/extension/src/__architecture__/architecture.spec.ts` pins
   the structural invariants — that the rpc-service calls the SDK
   helper, passes `walletType=cat21wallet`, and signs the correct
   input indexes per method (`'all'` for mint+transfer,
   `[0]` for acceptOffer). Change the rpc-service shape → spec
   goes red.
5. Cat-flow builders in the SDK share one shape:
   `lockTime: CAT21_LOCK_TIME = 21` on the Transaction constructor,
   `sequence: CAT21_WALLET_INPUT_SEQUENCE = 0xfffffffd` on every
   input — except third-party-wallet MINT inputs, which get
   `CAT21_OTHER_WALLET_MINT_INPUT_SEQUENCE = 0xfffffffe` via the
   mint-only resolver `resolveCat21MintInputSequence` — plus
   post-build asserts on lockTime + sequence + SIGHASH_ALL.

---

## HARD RULE #2: Cat-bearing UTXOs are never spent by the BTC send flow

A UTXO holding a cat lives in the `protected` bucket; the BTC send
coin-selection only ever sees `available`.
The probe lives in `packages/services/src/utxos/utxos.service.ts` and
queries cat21-ord's `/output/<txid>:<vout>` per UTXO.

**Failure mode is conservative**: if cat21-ord is unreachable, we treat
the UTXO as cat-bearing and refuse to spend it. The BTC balance appears
lower until cat21-ord recovers. That is the right default.

---

## HARD RULE #3: We do not auto-update from upstream Leather

Cat21 Wallet is a non-fork clone of `leather-io/mono@a6460b4d`. Upstream
sync is **manual**, on a quarterly cadence, by the maintainer. Reasons:

- Dependabot is org-wide banned (see `/Work/ordpool/CLAUDE.md`).
- Auto-merging upstream is an open door for supply-chain attacks.
- Every sync re-checks that the inscription stack (which we revived
  from #2358's parent) hasn't been re-deleted.

The `upstream` remote points at `https://github.com/leather-io/mono`.
Pulling from it is allowed and recommended for review. Auto-applying
is not.

---

## HARD RULE #4: No `axios` ban inside this repo

ADR-11. Leather uses axios throughout, the cat21-wallet code we own
uses axios too. The "no axios in code we own" rule that applies to
`ordpool-parser` and `ordpool-sdk` does NOT apply here. axios stays.

Reason: every helper we revive from `a6460b4d` already imports axios
and rewriting them to native fetch creates merge conflicts with no
benefit. The supply-chain audit happens at the lockfile boundary
during quarterly upstream sync; not by line-by-line replacement.

---

## HARD RULE #5: Do not modify existing comments — except HACK markers

Inherited from upstream Leather. Existing comments stay as written —
punctuation, whitespace, line breaks, everything. The maintainer wrote
them at a moment of full context; touching them rots that context.

**Exception:** the HACK marker convention (`/* HACK -- Cat21: <reason> */`).
HACK markers are how we document our fork-specific edits over upstream
code. Adding, editing, or removing a HACK marker is allowed and expected
when the edit it describes changes.

How to apply:

| Comment kind | May I touch it? |
|---|---|
| Existing upstream comment (no HACK marker) | No — leave it exactly as written |
| Existing HACK marker we wrote | Yes — keep the marker honest about the current edit |
| New HACK marker I am adding | Yes — required when hiding/modifying upstream code |
| New comment in a brand-new file we own | Yes — write what you need |

If a refactor genuinely requires changing an existing non-HACK upstream
comment (rare), call it out in the commit message so the upstream-sync
review can flag it. Otherwise: leave it.

---

## HARD RULE #6: The browser surface is Leather. cat21_* is internal.

There are exactly **two surfaces** that can reach the wallet:

### Browser surface (`window.Cat21Provider`) — Leather-compatible RPCs only

In the browser the wallet looks like Leather. `window.Cat21Provider`
exposes the same JSON-RPC contract as the upstream Leather provider:
`signPsbt`, `sendTransfer`, `getAddresses`, `signMessage`, `getInfo`,
`supportedMethods`, `open`, `openSwap`. Nothing else. Dapps that want
to do CAT-21 things call `signPsbt` with PSBT bytes that cat21.space
(or any other SDK consumer) built and validated.

**The wallet does NOT expose `cat21_mint`, `cat21_transfer`,
`cat21_create_offer`, `cat21_accept_offer`, or `cat21_buy` to
dapps.** Exposing
typed cat-flow methods through the browser provider would create a
second mutating attack surface that we'd have to defend forever, for
no UX benefit — cat21.space already owns the in-browser Cat21 UI.

### Internal surface (Cat21RpcService) — typed cat21_* actions

Inside the wallet, a `Cat21RpcService` (background-side) exposes the
typed cat-flow actions:

- `cat21_mint`
- `cat21_transfer`
- `cat21_create_offer`
- `cat21_accept_offer`
- `cat21_buy` (the BUYER side of the Bazaar — build + buyer-sign a
  buy-offer PSBT, POST it as a bid; does NOT broadcast)

The caller passes the intent as structured parameters; the service
enforces unbypassable invariants, builds the PSBT via ordpool-sdk,
re-asserts the bytes match the intent, then signs (with or without a
prompt). **Two transports reach this internal surface, neither is the
browser provider:**

- **Path 2 — wallet popup UI.** The user clicks a Cat21 action button
  inside cat21-wallet's own popup, fills in the form, clicks Confirm.
  The popup messages the background extension page over Chrome's
  internal `chrome.runtime` channel; background dispatches to
  `Cat21RpcService`.
- **Path 3 — MCP via NMH.** An external MCP-aware agent (Claude
  Desktop, Cursor, custom bot) calls `tools/call name=cat21_mint
  arguments=…` against our NMH host process; the host forwards the
  call over Chrome's Native Messaging pipe to the same
  `Cat21RpcService` in the background page.

The MCP tool registry and the wallet's popup UI are different
transports for the same internal handler. **The browser is never one
of them.**

### PSBT-shape inference is forbidden

For the generic `signPsbt` RPC (browser surface), the wallet shows
Leather's standard inputs/outputs/fee confirmation and signs. It does
NOT try to figure out whether the inbound PSBT is a cat-mint vs an
offer vs something else, because that's a Sisyphean fight against
ever-more-creative crafting.

For the typed `cat21_*` actions (internal surface), the action kind
is encoded in the method name and the intent is fully declared by the
caller. The wallet enforces invariants on the declared intent, not on
the bytes it constructs from the intent.

What the wallet IS responsible for outside both surfaces (these are
NOT intent-guessing — they are conservative structural defaults):

- **Cat-bearing UTXO protection** (`utxos.service.ts`). The BTC send
  coin-selection never picks a UTXO that holds a cat.
- **nLockTime preservation through RBF** (`use-btc-increase-fee.ts`).
  Any replacement tx carries the original locktime through verbatim.

---

## HARD RULE #7: Identity separation (workspace-level)

Reproduced here for emphasis — full rule lives at
`/Users/johanneshoppe/Work/ordpool/CLAUDE.md`:

- **GitHub account**: `hans-crypto` (not the main professional account).
- **Git user**: `Hans Crypto` / `johannes@haushoppe.art`.
- **SSH alias**: `github-ord-dev`.
- `gh` commands MUST use the hans-crypto PAT:
  `GH_TOKEN=<token> gh <command>`. Never bare `gh`.

The local repo already has user.name + user.email set; verify with
`git config user.email` if unsure.

---

## HARD RULE #8: Process discipline — plan first, independent review

The maintainer watched Claude Code build ~1200 LOC in the wrong repo,
re-suggest the wrong architecture three times after correction, and
ship "wallet exposes cat21_* via window.Cat21Provider" multiple times
across one session. Promises do not prevent that drift; mechanisms do.

These mechanisms are mandatory for any non-trivial change to this
repo (more than a one-line bugfix):

1. **Spec before code.** Each iteration starts with a commit that
   contains only the test stubs + type signatures + interface
   sketches for the slice being built. The maintainer reviews the
   shapes and signs off. Only then does the next commit contain the
   implementation. If the implementation surfaces a problem the
   shapes can't model, raise it explicitly — do not silently
   redesign.

2. **Independent review of every implementation commit.** Spawn a
   review agent (`Agent` tool, `general-purpose` subagent) that has
   no context from the current session, hand it the diff
   (`git diff HEAD~1..HEAD`) plus this `CLAUDE.md`, ask it to list
   every architectural rule the diff violates. The review agent
   sees drifts the implementing assistant has already rationalised
   away. Review-agent output goes into the next commit message
   verbatim (so future sessions can see what was caught).

3. **`__architecture__/architecture.spec.ts` is law.** It encodes
   the rules in this file as executable Vitest checks. When a HARD
   RULE changes, the spec changes in the same commit. When a code
   change violates the spec, CI rejects the merge. The maintainer
   does not need to remember the rules; the spec does.

4. **`.husky/cat21-architecture-guard.js` is the second gate.**
   Same checks as the spec, but at pre-commit time on the dev
   machine. Bypasses (`--no-verify`) are disallowed without an
   explicit, written justification in the commit message.

Diff size is not capped. Larger slices land as one commit when
splitting would obscure the change — a single coherent feature is
easier to review than three artificial chunks. The independent-review
mechanism is what catches drift, not commit size.

Drift catches: if any of these mechanisms catches a violation, the
violation is fixed in the same commit. Do not "merge it and fix
later" — later doesn't come.

---

## HARD RULE #9: The architecture spec is the contract

`apps/extension/src/__architecture__/architecture.spec.ts` codifies
the HARD RULES above into Vitest assertions that run against the
source tree. Specifically:

- Browser RPC registry contents (must equal the eight Leather-
  compatible methods, no cat21_*).
- Browser-side code (inpage / content-scripts / packages/provider)
  must not mention any cat21_* method name or `Cat21RpcService`
  import.
- The increase-fee hook must copy the original locktime onto the
  replacement Transaction and assert equality before signing.
- BTC balances service must fold `utxos.protected` into the
  unspendable bucket.
- Every modified upstream file must carry a `HACK -- Cat21` marker.
- `CLAUDE.md` must still contain the seven HARD RULES and the four
  RPC method names by literal string.

When you change a HARD RULE in this file, change the corresponding
spec assertion in the same commit. The spec is the contract; this
prose is the explanation. They drift apart at your peril.

---

## HARD RULE #10: PSBT logic comes from ordpool-sdk, imported via `/core`

Every CAT-21 PSBT the wallet signs is built by `ordpool-sdk`. The wallet
does NOT keep its own copies.

**mint / transfer / buy delegate the whole select → fee → build → sign →
broadcast sequence to the SDK core's framework-agnostic orchestrators —
`executeMint`, `executeTransfer`, `createOffer` (the BUYER side, `cat21_buy`)
— via the injected ports (`UtxosPort` / `ContentScanPort` / `SignPort` /
`BroadcastPort` / `OfferCreateSignPort`). The core owns the sequencing and
runs CONTENT-CHECKED funding selection over whatever the wallet's
`ContentScanPort` reports. The wallet wires a CAT-ONLY scan
(`classifyOutpoint` → cat21-ord `/output`, the maintainer's chosen depth),
so in the wallet the core refuses cat-bearing funding coins; it does NOT
detect regular inscriptions / runes / rare sats, because cat21-ord only
indexes cats. (A broader scan is the port's job, not the core's — the core
would honour it if the wallet ever supplied one.) The wallet owns the ports.
`Cat21RpcService` no longer hand-rolls coin-selection or fee-simulation
(the old `pickFundingUtxo` + `cat21-fee-simulation.ts` are deleted). See
`CORE-ADOPTION-HANDOVER.md`.**

**`accept_offer` is the one exception: it stays keychain-based (validate
via the SDK's `validateCat21BuyOfferPsbt`, then the wallet signs input 0
with its own keychain + broadcasts). It is deliberately NOT migrated to
the core's `acceptOffer`, because the SDK's cat21wallet signer signs via
`window.Cat21Provider` — the dapp-injected provider, which is absent in
the extension background where `Cat21RpcService` runs. accept-offer has no
coin selection either, so it gains nothing from the core migration. Do not
"fix" it by routing it through the core.**

The lower-level builders (`buildCat21MintPsbt`, `buildCat21TransferPsbt`,
`buildCat21BuyOfferPsbt`), the validator (`validateCat21BuyOfferPsbt`),
`evaluateAgentPolicy`, and `submitToSlipstream` all still live in the SDK
and back those orchestrators.

**Imports come from `'ordpool-sdk/core'`, never bare `'ordpool-sdk'`.**

The SDK ships two entry points:

| Entry point | What's in it | For |
|---|---|---|
| `'ordpool-sdk'` | Everything, including Angular `@Injectable` services (`WalletService`, `Cat21Service`, `Cat21MintOrchestrator`, …) | cat21.space (Angular app) |
| `'ordpool-sdk/core'` | Pure-functional helpers + types + enums. Zero `@angular/*` imports. | cat21-wallet (React + Webpack), any plain Node consumer |

Importing from `'ordpool-sdk'` in the wallet would drag
`@angular/core` into the extension bundle (the fesm2022 bundle has
`import * as i0 from '@angular/core'` at the top, unavoidable since
five SDK services genuinely use Angular). The architecture spec at
`apps/extension/src/__architecture__/architecture.spec.ts` sweeps
every source file under `src/` and rejects any `import|export ...
from 'ordpool-sdk'`. CI is red the moment one slips in.

### How the wallet consumes the SDK

`apps/extension/package.json` pins a SDK git SHA, same as every
other ordpool consumer (`ordpool/frontend`,
`cat21-indexer/frontend`):

```json
"ordpool-sdk": "github:ordpool-space/ordpool-sdk#<sha>"
```

pnpm fetches the github tarball at that SHA. Since SDK 2026-07-17,
`dist-core/` (Angular-free CommonJS) is **no longer checked in** —
the SDK's `prepare` script generates it at install time via
`npm run build:core` (plain tsc; the ng-packagr-in-node_modules
bug only affects `build:angular`, which stays pre-built in git as
`dist/`). Install scripts must be enabled for this to work — they
are: `/Work/ordpool/.npmrc` sets `ignore-scripts=false`
workspace-wide (the old global `ignore-scripts=true` posture was
retired the same day). If `ordpool-sdk/core` imports fail to
resolve after an install, the prepare script didn't run — check
`npm config get ignore-scripts` from the wallet's directory.

Resolution lands on the `exports` map in
`ordpool-sdk/package.json`:

```json
"./core": {
  "types": "./dist-core/core.d.ts",
  "default": "./dist-core/core.js"
}
```

The wallet imports **compiled CommonJS bytes** from
`ordpool-sdk/dist-core/`. The SDK's tsconfig.core.json emits CJS
specifically so Node-direct consumers (vitest) accept directory
imports; bundler consumers (webpack/vite) handle either shape.

### Old `link:` pattern is RETIRED (2026-06-20)

Before commits `603ab78`+`f0a08bd` on the SDK, the wallet used
`"ordpool-sdk": "link:../../../ordpool-sdk"`. That pattern had two
problems the user surfaced:

1. **No reproducibility.** The wallet linked "whatever's on the
   maintainer's disk", not a specific commit. CI cloned SDK `main`
   into a sibling dir, so the SDK version was whatever main HEAD
   happened to be at install time. Different CI runs of the same
   wallet commit could consume different SDK code.
2. **Mismatch with other consumers.** `ordpool/frontend` and
   `cat21-indexer/frontend` pin SHAs; cat21-wallet didn't.

The fix: the SDK ships pre-built `dist/` in git and generates
`dist-core/` via its `prepare` hook at install time, so the wallet
can adopt the same SHA-pin pattern as everyone else. No more
`link:`. No more staleness guards. CI deterministic.

### Dev workflow

```bash
# Update the wallet to a new SDK SHA:
# 1. Edit apps/extension/package.json: bump the SHA.
# 2. Reinstall.
pnpm install
# 3. Verify.
pnpm --filter @leather.io/extension typecheck
pnpm --filter @leather.io/extension test:unit
# 4. Commit BOTH package.json AND pnpm-lock.yaml.
```

For live local SDK iteration without bumping SHAs, fall back to
`npm link`:

```bash
# In ordpool-sdk/
npm run build && cd dist-core && npm link

# In cat21-wallet/apps/extension/
npm link ordpool-sdk
```

Remember to `pnpm install` again when you want to revert to the
SHA-pinned production install.

### When you add a new pure helper to the SDK

1. Add the file under `ordpool-sdk/src/`.
2. Export from its own file as usual.
3. Re-export from `ordpool-sdk/src/core.ts` so it ships via the
   `/core` subpath.
4. Add the source file to the `include` list in
   `ordpool-sdk/tsconfig.core.json`.
5. `npm run build` in the SDK (`build:angular && build:core`).
6. `git add src/ dist/ dist-core/` + commit + push to SDK `main`.
7. In the wallet: bump `apps/extension/package.json` to the new
   SHA, `pnpm install`, commit both package.json + pnpm-lock.yaml.

If the new helper drags Angular (uses `@Injectable`, `InjectionToken`,
`HttpClient`, etc.), it CANNOT live in `core.ts` — it stays in
`ordpool-sdk/src/index.ts` only and the wallet can't consume it.
That's the rule the wallet's architecture spec is encoding for you.

---

## HARD RULE #11: Default branch is `main`; commit often, no PR ceremony

Wallet's default branch is **`main`** (renamed from Leather's `dev`
convention on 2026-06-17, to match every other ordpool-space repo —
`ordpool`, `ordpool-sdk`, `cat21-ord`, `cat21-indexer` all default
to `main`). Consistency across the org wins over Leather's local
custom.

**Commit pattern**: small commits land directly against `main`. No
feature branches, no PR ceremony. Independent code review happens
via the audit / review-agent mechanism in HARD RULE #8, not via
GitHub PR threads. hans-crypto is sole admin; review-by-PR would
just be self-talk.

**Production branch comes later.** When the wallet has shipped to
Chrome Web Store and we need a stable release line, a `production`
branch will be cut from a tagged `main` revision — same pattern as
ordpool (`main` ↔ `stage_prod`). Until then, `main` is both the
development line AND the implicit release candidate.

**Implications:**

- CI workflows trigger on `main` (and on PRs to `main` if any are
  ever opened). The `dev`-targeted CI logic was retired in the
  rename commit; workflow files using `branches: ['**']` already
  cover both cases.
- The wallet's `link:` dep to `ordpool-sdk` doesn't care about
  branch names; it resolves through `apps/extension/package.json`'s
  `link:../../../ordpool-sdk` and follows whatever branch the SDK
  checkout is on (the SDK is also `main`-default).
- `RELEASE_BRANCH` env vars / publish-extension workflows that
  hard-coded `dev` were updated in the rename commit.

If you ever need a long-lived feature branch (multi-week refactor
that's risky to land incrementally), create `feat/<topic>` from
`main`, work there, merge back with `--no-ff` to preserve the
exploration thread. Squashing into a single commit on merge is fine
when the intermediate steps don't carry independent value; do not
squash when each step was independently audited.

---

## What this repo is — scope

Bitcoin-L1-only browser-extension wallet that serves **three user
paths** for the CAT-21 cat-flow actions (mint, transfer, create offer,
accept offer, buy):

**Path 1 — third-party-wallet users (Xverse / Leather / Unisat / …).**

  They reach the wallet only as Path 1's signing endpoint via the
  generic `signPsbt` RPC. cat21.space (or another SDK consumer)
  built and validated the PSBT; the wallet shows Leather's standard
  confirmation UI and signs. The wallet's behaviour here is
  upstream-Leather behaviour.

**Path 2 — cat21-wallet users in manual mode (humans).**

  cat21-wallet exposes typed `cat21_*` RPC methods. The user invokes
  them either via the in-extension UI (popup-driven action buttons)
  or via a dapp that knows about Cat21 Wallet. Cat21-themed
  confirmation dialogs show the parsed intent — cat preview, price,
  counterparty — and ask for a click before signing. **The path the
  maintainer uses for any deal big enough to deserve human attention.**

**Path 3 — cat21-wallet users in YOLO / agent mode (the Bazaar).**

  An MCP bot connected over the Chrome Native Messaging Host bridge
  invokes the same typed `cat21_*` RPC methods. When all three
  mode-resolution guards pass (transport is NMH, user has agent-mode
  enabled, agent-policy gate allows the intent), the wallet signs
  silently without a prompt. Any guard failure surfaces as a typed
  rejection — never a silent downgrade to manual. Callers that want
  the popup-confirm path must explicitly call with `mode: 'manual'`.

**Also a permanent responsibility, across all three paths**: display
cats from cat21-ord, refuse to spend cat-bearing UTXOs from the BTC
send flow (UTXO protection), and set `nLockTime=21` on every cat-
touching tx the wallet builds — mint, transfer, offer, and any RBF
replacement (HARD RULE #1).

The MCP host (`tools/src/mcp-host/`) is the agent's interface for
Path 3: it exposes the mutating cat-flow actions
(`cat21_mint`, `cat21_transfer`, `cat21_create_offer`,
`cat21_accept_offer`, `cat21_buy`) plus three read-only probes
(`list_cats`, `wallet_status`, `cat21_ord_status`). The same
`Cat21RpcService` handler also serves Path 2 via Chrome's internal
`chrome.runtime` channel from the wallet popup UI. **Neither path
goes through `window.Cat21Provider`** — the browser surface stays
Leather-compatible (signPsbt, sendTransfer, etc.) by design.

### What stays in ordpool-sdk

The build / validate / policy / broadcast code lives in
`ordpool-sdk` because three consumers need the same logic (cat21.space,
cat21-wallet's manual flows, cat21-wallet's autonomous flows):

- Mint PSBT construction (cat21-shaped, nLockTime=21).
- Buy-offer / sell-accept PSBT construction (ord-style, SIGHASH_ALL).
- Offer validation.
- Broadcast orchestration (mempool / Slipstream dispatcher).
- Agent-mode policy gate (per-action caps, daily cap, floor price,
  counterparty allowlist).
- Marathon Slipstream client.

The wallet imports the SDK and calls those functions from its
`cat21_*` RPC handlers. **Duplicating SDK logic into the wallet is
rejected on sight** — three consumers need to stay in sync.

### What the wallet must therefore NOT contain

- No in-extension cat21 construction *forms* for third-party-wallet
  users. Path 1's UX lives on `cat21.space`.
- No PSBT-shape classifier that reverse-engineers what a generic
  `signPsbt` payload represents (HARD RULE #6).
- No duplicate PSBT builders. The wallet's `cat21_*` RPC handlers
  call ordpool-sdk to construct bytes; they don't re-implement what
  the SDK already exports.
- No duplicate agent-policy logic. The wallet's mode resolver
  delegates to `evaluateAgentPolicy` from ordpool-sdk; the same gate
  protects all three paths.

### Why this split

- The SDK is the shared logic across three consumers; duplicating
  any of it into the wallet creates drift the moment one consumer
  needs to evolve.
- Smaller wallet code = smaller attack surface for the part that
  holds keys = faster security review.
- ordpool-sdk already absorbs every other Bitcoin-data utility we
  own (parsers, signing helpers, marketplace adapters). The cat
  flows fit the same shape.

---

## Cat21 RPC architecture (Path 2 + Path 3)

These decisions are pinned. Any change requires a new HARD RULE
section justifying it.

### Methods (typed, intent-declared)

The same methods are exposed through two **internal** transports
— never the browser provider. Path 2 reaches them via the wallet's
popup UI sending an internal `chrome.runtime` message. Path 3 reaches
them via MCP tool calls from a bot, translated by the NMH host into
the same internal message shape. Same name, same Zod schema, same
handler.

| Method | Intent shape (summary) |
|---|---|
| `cat21_mint` | `{ recipient, feeRate, tip?, mode? }` |
| `cat21_transfer` | `{ catId, recipient, feeRate, mode? }` |
| `cat21_create_offer` | `{ catId, priceSats, paymentAddress, mode? }` |
| `cat21_accept_offer` | `{ offerPsbt, expectedCatId, expectedPriceSats, expectedSellerUtxo, mode? }` |
| `cat21_buy` | `{ catId, catNumber, bidSats, sellerPaymentAddress, feeRate, mode? }` |

`mode` defaults to `'manual'` when omitted. `'autonomous'` is honored
only when all four mode-resolution guards pass.

### Naming

Always `cat21_<verb>` prefix, snake_case throughout (matches MCP-tool
convention, reads identically in JS).

### Pipeline (same for every method)

```
1. Parse + validate intent params (Zod-style, throws on shape error)
2. Enforce hard invariants (pure functions, unbypassable, 100% test
   coverage — these are the safety core of the wallet)
3. Resolve signing mode:
     declared mode + transport + policy.enabled + policy.evaluate(intent)
4. Build PSBT via ordpool-sdk (wallet owns the bytes)
5. Post-build assertions (defence in depth: bytes must match intent)
6. Sign:
     mode == 'manual'     → show Cat21-themed confirmation → click → sign
     mode == 'autonomous' → silent sign
7. Broadcast via ordpool-sdk (mempool first, Slipstream on >400k weight)
8. Return { txid }
```

### Pinned decisions

1. **Agent-mode activation UX (Path 3)**: First-run wizard explaining
   what agent-mode does + policy walkthrough. **After the wizard,
   agent-mode is ON by default.** User can disable in Settings. The
   product stance: cat21-wallet is the Bazaar; bots are the headline.

2. **Policy storage**: per-account. Each account holds its own
   `AgentPolicy` struct (`maxSpendPerActionSats`, `dailyCapSats`,
   `maxFeeRateSatPerVbyte`, `floorPriceSatsPerCat`,
   `allowedCounterparties`, `enabled`). Stored in Redux state,
   serialised alongside other account-bound settings (encrypted with
   the seed password per existing Leather pattern).

3. **`cat21_acceptOffer` intent mismatch**: hard error in both modes.
   Never accept a PSBT whose decoded fields disagree with the
   declared `expectedCatId / expectedPriceSats / expectedSellerUtxo`
   — not in autonomous, not in manual. The user's intent is the
   protocol; bytes that don't match are presumed adversarial.

4. **Confirmation UI (Path 2)**: Cat21-themed. Cat preview SVG via
   ordpool-parser's mooncat-parser, rarity-band badge, counterparty
   address truncated with copy button, plain-language headline
   ("Sell **Cat #42** for **21 000 sats**"), small details drawer
   for byte-skeptics.

5. **NMH multi-tenancy**: single agent only. One NMH binary, one
   `allowed_origins` entry pinning our extension ID, one policy
   slot. Per-agent policies are punted to a future ADR.

6. **Caps apply to BOTH modes**. Policy gates Path 2 manual flows
   the same way it gates Path 3 autonomous flows. Mistakes happen
   fast; the cap is a backstop against a misclicked zero or a
   pasted-wrong address. Manual mode adds a user prompt; it does
   not skip the cap. (Override path TBD — likely password re-entry
   for breaking a per-action cap on purpose, never for the daily
   cap.)

7. **Network endpoints**: prefer our own infrastructure; Leather's
   public endpoints (`api.leather.io`, `api.hiro.so`) will not
   tolerate us long-term. Configurable in Settings for power users.

| Surface | Default | Rationale |
|---|---|---|
| Mempool API + tx broadcast | `https://api.ordpool.space` | Our cloudflared tunnel → ordpool-backend → electrs |
| cat21 indexer | `https://ord.cat21.space` | Our cat21-ord on happysrv |
| Slipstream fallback | `https://slipstream.mara.com` | Marathon-operated; only external default we keep |
| Market data | TBD — pull from `api.ordpool.space` or self-host | Replace `api.leather.io` before Leather notices |
| Fee estimates | TBD — pull from `api.ordpool.space` | Replace `api.hiro.so` for the same reason |

Any new outbound endpoint added to the wallet is a HARD RULE
question: does it live on infrastructure we control, or does the
operator depend on a third party's goodwill?

8. **MCP host exposes the mutating cat-flow actions plus three read-only probes**:

   - `cat21_mint`
   - `cat21_transfer`
   - `cat21_create_offer`
   - `cat21_accept_offer`
   - `cat21_buy`
   - `list_cats`, `wallet_status`, `cat21_ord_status`

   The agent speaks MCP because that's the protocol it's designed
   for. The MCP-host process translates `tools/call name=…` into a
   Native Messaging message → forwarded to the extension background
   → dispatched to `Cat21RpcService`. Path 2 (the wallet's popup UI)
   reaches the same `Cat21RpcService` via Chrome's internal
   `chrome.runtime` channel. **One internal handler, two internal
   transports. Browser dapps don't see these methods.**

   The security boundary is the pipeline (intent parse → invariants
   → mode → policy → build → assert → sign), not the transport.
   The mode-resolver uses transport (NMH vs popup) to decide whether
   `mode: 'autonomous'` may be honored — not to gate surface
   visibility (the surface is invisible from outside the wallet
   regardless).

### Layout

```
apps/extension/src/background/cat21/
  invariants/                     ← pure functions, 100% covered
    mint-invariants.ts
    transfer-invariants.ts
    create-offer-invariants.ts
    accept-offer-invariants.ts
  cat21-rpc.service.ts            ← orchestrates the pipeline; the
                                    SDK does the PSBT bytes
  mode-resolver.ts                ← the security boundary
  agent-policy-deps.ts            ← Redux slice → SDK policy gate
  cat21-dispatcher.ts             ← Cat21RpcService → port-message
                                    shape (iter-9 legacy; one of two
                                    NMH-attach paths)
  connect-native-host.ts          ← iter-9 attach: NMH → dispatcher.
                                    Wired only when a sign-in-bg path
                                    is acceptable. Not used today.

  ── Path 3 (NMH-driven, popup-mediated) ──
  popup-bridge.ts                 ← stash/fetch/clear intent in
                                    chrome.storage.session;
                                    routeForCat21IntentType
  nmh-popup-relay.ts              ← relayNmhMessageThroughPopup:
                                    stash → triggerPopupOpen →
                                    waitForPopupResult → postBack →
                                    clear (finally)
  cat21-result-bus.ts             ← postCat21Result (popup) +
                                    subscribeToCat21Result (bg)
                                    over chrome.runtime.sendMessage
                                    with `source: 'cat21-result-bus'`
                                    tag
  nmh-read-only-probes.ts         ← handleReadOnlyProbe for
                                    list_cats / wallet_status /
                                    cat21_ord_status (no popup,
                                    no keychain, inline reply)
  attach-native-host-to-popup-relay.ts
                                  ← production NMH attach: routes
                                    read-only probes inline, then
                                    relays mutating cat21_* through
                                    the popup-side Cat21RpcService

apps/extension/src/background/messaging/rpc-methods/
  cat21-mint.ts                   ← thin: parse params → call rpc.service
  cat21-transfer.ts
  cat21-create-offer.ts
  cat21-accept-offer.ts

apps/extension/src/app/pages/cat21-confirm/
  cat21-confirm-route.tsx         ← container for all four
                                    Cat21*Confirm routes; reads
                                    intent from URL (Path 3) OR
                                    location.state (Path 2);
                                    auto-confirms when
                                    transport === 'mcp-nmh'
  use-cat21-rpc-deps.ts           ← wires ALL 11 Cat21RpcDeps to
                                    real keychain + cat21-ord +
                                    mempool layers; no wiringPending
  use-cat21-request-from-url.ts   ← chrome.storage.session reader
                                    for the URL-stashed intent

apps/extension/src/app/store/agent-policy/
                                  ← per-account policy slice +
                                    first-run wizard
```

### Path 3 round-trip in one diagram (post iter 12)

```
agent ──MCP──> tools/src/mcp-host/host.ts
              │
              │ NMH stdio
              ▼
background    ←──── chrome.runtime.connectNative ──── extension binary
              │
              │ Port.onMessage: { id, type: 'cat21_*', payload }
              ▼
   attachNativeHostToPopupRelay (background/cat21/)
      │
      ├── isReadOnlyProbeRequest?  → handleReadOnlyProbe(req, probes)
      │     │                          ↓ no popup, no keychain
      │     └── port.postMessage({ type: '<x>:result', id, payload })
      │
      └── isNmhMutatingRequest?    → relayNmhMessageThroughPopup
            │
            ├── stashCat21Request(intent) → chrome.storage.session
            │   ↓ requestId
            ├── triggerRequestPopupWindowOpen(route,
            │     ?cat21RequestId=<id>)
            │   ↓
            │  ┌─ popup (popup.html) ───────────────────┐
            │  │ Cat21ConfirmRoute                       │
            │  │   useCat21RequestFromUrl reads stash   │
            │  │   useCat21RpcDeps wires 11 deps        │
            │  │   useEffect auto-confirm if mcp-nmh    │
            │  │   service.<method>(intent, 'mcp-nmh')  │
            │  │     ↓ keychain.sign + broadcast        │
            │  │   postCat21Result via                  │
            │  │     chrome.runtime.sendMessage         │
            │  └─────────────────────────────────────────┘
            │   ↓
            ├── subscribeToCat21Result resolves
            ├── port.postMessage({ type:'<x>:result', id, payload })
            └── clearCat21Request (finally)
```

Why every step is dependency-injected: the production callbacks
(`triggerRequestPopupWindowOpen`, `chrome.runtime.onMessage`,
`chrome.storage.session`, the cat21-ord client) all need a
Chrome-extension environment. Specs pass in-memory equivalents.

Plan and ADRs for the broader ecosystem live at
`/Users/johanneshoppe/Work/ordpool/CAT21-WALLET-FORK-PLAN.md` and
should be read as historical context. `SECURITY-REVIEW.md` here in
the repo walks the invariants the wallet enforces today.

---

## Repo layout

This is a Turborepo monorepo. Names are inherited from Leather; the
identifier is `@leather.io/*` so upstream sync keeps working.

```
apps/
  extension/        # the Chrome extension (this is what ships)
  mobile/           # bonus shipping target — would be cool to land
  web/              # NOT shipped by Cat21 Wallet
packages/
  bitcoin/          # PSBT builders incl. cat21-mint + buy-offer
  models/           # InscriptionAsset became Cat21Asset; CryptoAsset union
  utils/            # cat21-helpers, asset-id, asset-display-name
  features/         # collectible-view; the cat21 protocol branch lives here
  services/         # cat21-ord client + Cat21AssetService + AgentPolicyService
  provider/         # window.Cat21Provider injection + WBIP004 discovery
  ui/, rpc/, query/, state/, ...   # upstream Leather shared packages
tools/
  src/mcp-host/     # the NMH bridge binary (Phase 6)
```

Files to know:

| File | Purpose |
|---|---|
| `CLAUDE.md` | this file |
| `SECURITY-REVIEW.md` | Phase 7 audit walking the safety invariants with file:line citations |
| `PRIVACY-POLICY.md` | data the wallet stores and sends, no-analytics posture |
| `INTEGRATION-ORDPOOL-SDK.md` | the SDK ⇄ wallet contract (Cat21Provider discovery, RPC surface) |
| `CHROME-WEB-STORE-LISTING.md` | store listing copy + permissions justification |

---

## Development workflow

### Install

```sh
pnpm i
pnpm build  # builds all packages
```

Node 22+ via `.nvmrc`. pnpm version pinned via `packageManager` in
`package.json`.

### Run the extension in dev

```sh
pnpm dev   # turbo watches everything
# load apps/extension/dist as an unpacked extension in Chrome
```

The dev extension ID is deterministic via the public key pinned in
`apps/extension/scripts/generate-manifest.js` →
`nbooeiaddbkoiekkahgekialhahgpboe`. The matching private key lives in
`.keys/cat21-wallet-dev.pem` (gitignored).

### Verify before commit

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm knip
pnpm --filter @leather.io/extension lint:unused-exports
```

For a faster loop on a single package:

```sh
pnpm --filter @leather.io/{package} typecheck
pnpm --filter @leather.io/{package} test:unit
```

### Commits

Conventional Commits format. Imperative. No body unless explicitly asked.
Examples (real commits in this repo):

- `feat(bitcoin): cat21-mint PSBT builder with hard nLockTime + sequence asserts`
- `fix(extension): hide Increase-Fee button on CAT-21 mint txs`
- `refactor: rename inscription -> cat21 throughout our code`

The HACK marker convention is inherited from `ordpool/`:

- `/* HACK -- Cat21: <reason> */` for modifications to upstream files.
- `// HACK -- Cat21: ...` for one-liners.

Never delete upstream code; comment it out with a HACK marker so the
quarterly upstream sync is reviewable.

---

## CI and trusted builds

GitHub Actions are partitioned. See the README + the discussion in
`/Work/ordpool/PROTOCOL.md` for context.

Active on push/PR (safety net):

- `extension:code-checks.yml`, `extension:pr-build.yml`,
  `extension:integration-tests.yml`
- `repo:code-checks.yml`, `repo:all-checks-pass.yml`,
  `repo:workflow-checks.yml`
- `check-locktime-framing.yml` — greps tracked source/tests/docs for
  the banned phrases that falsely claim a non-mint tx loses its cat
  when it drops `nLockTime=21` (workspace HQ HARD RULE "nLockTime=21 is
  PROTOCOL for MINT, CONVENTION for everything else"). Sibling of the
  identical guards in cat21-indexer + ordpool-sdk. Runs
  `scripts/check-locktime-framing.sh`; the phrase list lives in that
  script.

Tag-gated trusted build (the deliverable):

- `.github/workflows/extension:trusted-build.yml` — runs only on
  GitHub-hosted runners, refuses self-hosted, pins every action by
  sha, uses `--frozen-lockfile`, emits a sigstore attestation via
  `actions/attest-build-provenance@v1.4.0`.

Verify a ZIP came from this trusted build:

```sh
gh attestation verify cat21-wallet-extension.zip \
  --repo ordpool-space/cat21-wallet
```

Disabled (`on: workflow_dispatch` only, never auto-fires):

- `extension:publish-extensions.yml` (Chrome Web Store push, dangerous)
- `web:deploy.yml`, `packages:sanity-studio.yml`

Fully HACK-disabled (web + release-please + claude-code-review):

- `web:check-security-headers`, `web:integration-tests`,
  `web:staging-build`, `packages:release-please`,
  `repo:claude-code-review`.

Mobile workflows (`mobile:*`) are a bonus shipping target — keep
them buildable when feasible. They are not gating CI today and may
still be HACK-disabled in some files; that's a "fix when you have
time" item, not a structural exclusion.

If you add a workflow, add it under one of these three buckets and
update this section.

---

## RPC surface + window providers

The provider package exposes:

- `window.Cat21Provider` — always present. `isCat21: true`, `isLeather:
  true`, `getProductInfo().name === 'Cat21 Wallet'`.
- `window.LeatherProvider` — only when real Leather is NOT installed.
- `window.btc_providers` — WBIP004 discovery array; always contains a
  Cat21 entry, contains a Leather entry only when no other Leather entry
  exists.

This politeness is by design. See `INTEGRATION-ORDPOOL-SDK.md` for the
contract dapps and the SDK should code against.

RPC methods the wallet handles (Bitcoin-only subset of Leather's RPC):

- `open`, `getInfo`, `supportedMethods`, `getAddresses`, `signPsbt`,
  `signMessage`, `sendTransfer`.

Stacks RPCs are silently absent — the handler imports were dropped in
Phase 1.1. A call to any `stx_*` method returns `METHOD_NOT_FOUND`.

---

## Network surfaces

Prefer our own infrastructure. Per the Cat21 RPC architecture
decision #7, Leather's public endpoints will not tolerate us long-
term; we migrate to `*.ordpool.space` as the default. The manifest's
`host_permissions` is narrowed to this exact list
(`generate-manifest.js`).

| Host | Why | Configurable |
|---|---|---|
| `https://ord.cat21.space` | cat21-ord; sole authority for cat data | yes, via settings |
| `https://api.ordpool.space` | ordpool backend; mempool API, tx broadcast, market data, fee estimates, inscription preview, recursive inscriptions | yes, via settings |
| `https://slipstream.mara.com` | direct-to-miner submission for oversize txs | yes, via settings |
| `https://ord.io`, `https://ordinals.com`, `https://ordinals.hiro.so` | cat content bytes + preview URLs (external by design) | no |
| `https://mempool.space`, `https://blockstream.info` | legacy upstream fallback during the migration off Leather endpoints; remove once `api.ordpool.space` is the only mempool default | no |
| `https://api.leather.io`, `https://api.hiro.so` | currently fires for market data + fee estimates; migration target is `api.ordpool.space`. Remove from `host_permissions` once the migration lands | no |

Anything we missed surfaces as a blocked fetch in DevTools — easier to
discover than an undetected outbound call.

---

## How to revive an upstream file we hid

Pattern when a Phase-1 hide turns out to be needed after all:

1. `git checkout a6460b4d -- <file>` to grab the parent-of-#2358 version.
2. Re-add the HACK markers describing why we hid + why we un-hid.
3. Rebuild affected packages: `pnpm --filter @leather.io/<pkg> build`.
4. Run the typecheck on the consumer side.

Pattern for the reverse — hiding a piece of upstream we now want gone:

1. **Never delete.** Comment out with `/* HACK -- Cat21: ... */`.
2. Update routes, exports, DI bindings to skip the hidden symbol.
3. Re-run the full verification pipeline.

---

## When in doubt

- Read `SECURITY-REVIEW.md` first; the invariants are claimed there.
- Then `CAT21-WALLET-FORK-PLAN.md` for the ADR that drove the decision.
- The workspace-level `/Work/ordpool/CLAUDE.md` carries the
  cross-repo rules (identity separation, axios policy, Dependabot
  ban, branding capitalization, the lore around 21 BTC / Genesis Cat).
  It supersedes this file where rules overlap.

If a rule conflicts between this file and the workspace `CLAUDE.md`,
**the more restrictive rule wins**. The reasoning behind both files
is: incidents are cheap to avoid, expensive to clean up.

---

## Code style (inherited from Leather)

These conventions came over with the fork. Apply unless a HARD RULE
above contradicts.

- Don't use enums.
- Default to `interface` for object shapes. Name component props `ComponentNameProps`.
- Use `function` declarations for top-level functions and React components. Arrow functions for callbacks only.
- Destructure props directly in the function signature.
- Prefer Remeda (`keys`, `entries`, `pipe`, `filter`, etc.) over `Object.keys`/`Object.entries` for typed utilities and non-trivial transforms. Use native methods for trivial cases.
- No `as` casts, `!` non-null assertions, or `any`. Use runtime checks, type guards, or `unknown` with narrowing.
- Prefer `const` over `let`. Prefer named constants over magic numbers or strings.
- No nested ternary expressions.
- Use object method shorthand syntax in objects and interfaces (`{ foo() {} }` not `{ foo: () => {} }`).
- camelCase for file-level constants; SCREAMING_SNAKE_CASE in the constants package or `constants.ts` files.

## Error handling

- `throw` is acceptable for genuinely invalid states (wrong keychain type, missing required config).
- For expected failure paths (user input, optional lookups), prefer returning `null`, `undefined`, or typed result objects.
- Never throw in React render paths, reducers, or selectors.
- In React render paths: use error boundaries for unexpected errors; return `null` or fallback UI for expected empty states.

## File naming

- Kebab-case file names (e.g., `alternate-header-layout.tsx`).
- Platform suffixes for cross-platform code: `.web.tsx`, `.native.tsx`, `.shared.ts`.
- Convention-named config files are exempt (e.g., `babel.config.cjs`, `tsconfig.json`).
- No `index.ts(x)` except barrel exports from library packages or file-based router requirements.
- Use `*.spec.ts(x)` for tests, co-located next to the file under test.

## Circular dependencies

- Never import from a barrel export (`index.ts`) within the same package's sub-modules.
- Place `initialState` in write/slice modules, not shared read modules.
- Concrete anti-pattern: slice → utils → store → slice. Break by keeping `initialState` in write/slice files and never importing from `store/index.ts` within slices.

## Security (general; cat-specific rules at the top of this file)

- Sanitize HTML from external sources (cat content, collectible descriptions) before rendering.
- Validate responses from cat21-ord and any other untrusted origin with Zod schemas. `.passthrough()` so future fields don't break the parse.
- Never expose private keys, seeds, or mnemonics in error messages or logs.

## Tooling

- Turborepo + `pnpm`.
- Vitest for unit/integration tests.
- Playwright for E2E tests (extension). Avoid `force: true` — it hides accessibility issues. Never nest interactive elements.
