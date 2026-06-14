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

## HARD RULE #6: Intent is always declared, never inferred from PSBT bytes

Two RPC surfaces, two distinct paths into the wallet — both share the
"intent is declared" rule but they declare it differently:

### Path 1 — generic `signPsbt` (third-party-wallet dapps via cat21.space)

The wallet behaves exactly like upstream Leather: standard signPsbt
confirmation UI showing inputs / outputs / fee, user clicks, wallet
signs. The intent was declared upstream by cat21.space when it built
the PSBT; the wallet is a dumb signer here.

### Path 2 + 3 — typed `cat21_*` RPC methods (cat21-wallet's own surface)

The wallet exposes typed methods (`cat21_mint`, `cat21_transfer`,
`cat21_createOffer`, `cat21_acceptOffer`) where the **caller passes
the intent as structured parameters**, not as opaque PSBT bytes. The
wallet then:

1. enforces unbypassable invariants on the intent itself (pure
   functions, easy to audit, 100% test coverage required),
2. builds the PSBT from the intent using ordpool-sdk (wallet owns
   the bytes it will sign),
3. post-build, re-asserts that the bytes match the intent (defence
   in depth against SDK drift),
4. either prompts the user (Path 2 manual mode) or signs silently
   (Path 3 autonomous mode, when all four mode-resolution guards pass
   — see "Cat21 RPC architecture" below).

The wallet NEVER:

- Inspects PSBT bytes to *figure out* what kind of action they
  represent. The action kind is encoded in the RPC method name.
- Carries a classifier (`isCat21OfferShape`, `classifyCat21Psbt`)
  that reverse-engineers caller intent from raw bytes.
- Runs cat21-shape detection on generic `signPsbt` input. If the
  dapp wants the wallet to use cat21-specific UX or safe-guards,
  it must call a `cat21_*` method. Else: dumb signer.

PSBT-shape detection is a Sisyphean fight against ever-more-creative
crafting. Every heuristic eventually gets bypassed. The fix is
typed-RPC: the caller declares the action, the wallet enforces.

What the wallet IS responsible for outside the RPC surface (these are
NOT intent-guessing — they are conservative structural defaults):

- **Cat-bearing UTXO protection** (`utxos.service.ts`). The BTC send
  coin-selection never picks a UTXO that holds a cat. No intent is
  inferred; we simply refuse to consider those UTXOs as available.
- **nLockTime preservation through RBF** (`use-btc-increase-fee.ts`).
  Any replacement tx carries the original locktime through verbatim.
  No intent is inferred; we preserve a structural property.

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

The MCP host (`tools/src/mcp-host/`) exposes a read-only tool surface
(`list_cats`, `wallet_status`, `cat21_ord_status`) to local MCP
clients. The mutating Cat21 actions go through the typed `cat21_*`
RPC methods on `window.Cat21Provider`, not the MCP tool surface.

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

| Method | Intent shape (summary) |
|---|---|
| `cat21_mint` | `{ recipient, feeRate, tip?, mode? }` |
| `cat21_transfer` | `{ catId, recipient, feeRate, mode? }` |
| `cat21_createOffer` | `{ catId, priceSats, paymentAddress, mode? }` |
| `cat21_acceptOffer` | `{ offerPsbt, expectedCatId, expectedPriceSats, expectedSellerUtxo, mode? }` |

`mode` defaults to `'manual'` when omitted. `'autonomous'` is honored
only when all four mode-resolution guards pass.

### Naming

Always `cat21_<verb>` prefix. No `cat_*`, no `mintCat21`, no `:` or
`.` separators. Methods get camelCase verbs (`createOffer`, not
`create_offer`).

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

8. **MCP host scope (unchanged)**: read-only tools only
   (`list_cats`, `wallet_status`, `cat21_ord_status`). Mutating
   actions for Path 3 go through the typed `cat21_*` RPC methods
   over the NMH bridge, not as MCP tools. Reason: the wallet's
   typed-RPC signing flow is the security boundary; piping a
   second mutating surface through the MCP tool schema duplicates
   work and creates an alternate attack surface to defend.

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
