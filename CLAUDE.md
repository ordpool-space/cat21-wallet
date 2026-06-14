# Claude Code — cat21-wallet onboarding

This file is the single source of truth for working on the Cat21 Wallet
repo. Read it before touching anything. The rules at the top are not
suggestions; the rest is map + history.

---

## HARD RULE #1: WE DO NOT BREAK nLockTime=21 — EVER

The CAT-21 protocol marker is `nLockTime = 21` on the mint transaction.
A cat exists if and only if that field landed on chain with that value.
**Any operation that drops or alters nLockTime on a cat-bearing or
cat-minting transaction kills the cat.**

The 2024 Xverse incident is the lesson: a third-party wallet replaced a
pending CAT-21 mint with a higher-fee replacement that did not carry
the locktime through, and the cat was lost. We do not repeat this.

### What this means concretely

| Operation | Rule | Where enforced |
|---|---|---|
| Building a mint tx | `nLockTime = 21`. Hard runtime assert. | `packages/bitcoin/src/transactions/generate-cat21-mint-transaction.ts` |
| Mint input sequences | `< 0xfffffffe` (signals BIP-125 RBF) AND `< 0xffffffff` (so locktime is still honored). Default we ship: `0xfffffffd`. | `CAT21_MINT_INPUT_SEQUENCE` |
| Replacing a CAT-21 tx via RBF | Replacement MUST keep `nLockTime = 21`. Hard runtime assert. | `apps/extension/src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts` |
| Spending a cat-bearing UTXO | Either deliberately (sell/transfer flow) with the cat preserved on output 0, OR refused because the UTXO is `protected`. | `packages/services/src/utxos/utxos.service.ts`, `packages/bitcoin/src/transactions/generate-cat21-buy-offer-psbt.ts` |
| Allowing RBF | Yes, allowed. The protection is in the cat21-wallet code path that builds the replacement; ordpool-sdk has its own enforcement layer. | n/a — by policy |

### What this does NOT mean

- We do **not** ban RBF on CAT-21 mints. RBF is a legitimate Bitcoin
  user feature and the wallet must support it. The protection is at
  the *replacement-construction* layer: any replacement tx we build for
  a CAT-21 mint pins `nLockTime = 21` and asserts it before broadcast.
- The ordpool-sdk maintains its own RBF policy independently. The
  wallet does not duplicate that policy; we just guarantee that any
  tx we sign on behalf of a CAT-21 flow carries the correct locktime.

### How to verify when touching tx-builder code

1. Add or modify a builder under `packages/bitcoin/src/transactions/`.
2. Re-run `pnpm --filter @leather.io/bitcoin test:unit`.
3. The spec `generate-cat21-mint-transaction.spec.ts` pins
   `tx.lockTime === 21` and the sequence range. If you change either
   without changing the spec to match, you are about to ship a bug.
4. Any new tx flow that touches cat-bearing UTXOs gets a corresponding
   "locktime preserved" assert + spec.

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
`cat21_create_offer`, or `cat21_accept_offer` to dapps.** Exposing
typed cat-flow methods through the browser provider would create a
second mutating attack surface that we'd have to defend forever, for
no UX benefit — cat21.space already owns the in-browser Cat21 UI.

### Internal surface (Cat21RpcService) — typed cat21_* actions

Inside the wallet, a `Cat21RpcService` (background-side) exposes the
four typed actions:

- `cat21_mint`
- `cat21_transfer`
- `cat21_create_offer`
- `cat21_accept_offer`

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

## HARD RULE #8: Process discipline — plan first, small diffs, independent review

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

2. **Tiny diffs.** Hard ceiling: 200 lines changed per implementation
   commit (excluding the spec-stub commit and any generated lockfile
   churn). If the change is genuinely larger, split it into multiple
   reviewable commits, each behind its own stub-commit.

3. **Independent review of every implementation commit.** Spawn a
   review agent (`Agent` tool, `general-purpose` subagent) that has
   no context from the current session, hand it the diff
   (`git diff HEAD~1..HEAD`) plus this `CLAUDE.md`, ask it to list
   every architectural rule the diff violates. The review agent
   sees drifts the implementing assistant has already rationalised
   away. Review-agent output goes into the next commit message
   verbatim (so future sessions can see what was caught).

4. **`__architecture__/architecture.spec.ts` is law.** It encodes
   the rules in this file as executable Vitest checks. When a HARD
   RULE changes, the spec changes in the same commit. When a code
   change violates the spec, CI rejects the merge. The maintainer
   does not need to remember the rules; the spec does.

5. **`.husky/cat21-architecture-guard.js` is the second gate.**
   Same checks as the spec, but at pre-commit time on the dev
   machine. Bypasses (`--no-verify`) are disallowed without an
   explicit, written justification in the commit message.

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

## What this repo is — scope

Bitcoin-L1-only browser-extension wallet that serves **three user
paths** for the four CAT-21 actions (mint, transfer, create offer,
accept offer):

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
  invokes the same typed `cat21_*` RPC methods. When all four
  mode-resolution guards pass (caller declared autonomous, transport
  is NMH, user has agent-mode enabled, agent-policy gate allows the
  intent), the wallet signs silently without a prompt. Any guard
  failure downgrades to Path 2 (or hard-fails if the policy denies).

**Also a permanent responsibility, across all three paths**: display
cats from cat21-ord, refuse to spend cat-bearing UTXOs from the BTC
send flow (UTXO protection), preserve `nLockTime` through any tx the
wallet builds — most notably RBF replacement (HARD RULE #1).

The MCP host (`tools/src/mcp-host/`) is the agent's interface for
Path 3: it exposes the four mutating actions
(`cat21_mint`, `cat21_transfer`, `cat21_create_offer`,
`cat21_accept_offer`) plus three read-only probes
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

The same four methods are exposed through two **internal** transports
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

8. **MCP host exposes the four mutating actions plus three read-only probes**:

   - `cat21_mint`
   - `cat21_transfer`
   - `cat21_create_offer`
   - `cat21_accept_offer`
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
  invariants/
    mint-invariants.ts            ← pure functions, 100% covered
    transfer-invariants.ts
    create-offer-invariants.ts
    accept-offer-invariants.ts
  builders/
    mint-builder.ts               ← thin wrappers around ordpool-sdk
    transfer-builder.ts
    create-offer-builder.ts
    accept-offer-validator.ts     ← wraps validateCat21BuyOfferPsbt
  cat21-rpc.service.ts            ← orchestrates pipeline above
  mode-resolver.ts                ← the security boundary

apps/extension/src/background/messaging/rpc-methods/
  cat21-mint.ts                   ← thin: parse params → call rpc.service
  cat21-transfer.ts
  cat21-create-offer.ts
  cat21-accept-offer.ts

apps/extension/src/app/pages/rpc-cat21-mint/        ← Path 2 confirmation UI
apps/extension/src/app/pages/rpc-cat21-transfer/
apps/extension/src/app/pages/rpc-cat21-create-offer/
apps/extension/src/app/pages/rpc-cat21-accept-offer/

apps/extension/src/app/store/agent-policy/          ← per-account policy slice + wizard UI
```

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
  mobile/           # NOT shipped by Cat21 Wallet
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

Tag-gated trusted build (the deliverable):

- `.github/workflows/cat21:trusted-build.yml` — runs only on
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

Fully HACK-disabled (mobile + web + release-please + claude-code-review):

- all `mobile:*`, `web:check-security-headers`, `web:integration-tests`,
  `web:staging-build`, `packages:release-please`,
  `repo:claude-code-review`.

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
