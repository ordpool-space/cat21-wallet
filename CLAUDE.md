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

Per ADR-9 + Phase 3.0 safety. A UTXO holding a cat lives in the
`protected` bucket; the BTC send coin-selection only ever sees `available`.
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

## HARD RULE #6: Identity separation (workspace-level)

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

## What this repo is

A Bitcoin-L1-only browser-extension wallet for active CAT-21 cat
trading. Fork of [Leather](https://github.com/leather-io/mono), hidden
down to BTC + cats only, with three features Leather does not have:

1. **ord-style buyer-initiated offers** (sniping-proof; SIGHASH_ALL
   everywhere).
2. **CAT-21 mint flow** with hard nLockTime=21 + RBF-signaling sequence
   asserts.
3. **MCP server via Chrome Native Messaging Host** for agent-mode
   trading under user-configured policy.

Plan and ADRs (1–14) live at the workspace level in
`/Users/johanneshoppe/Work/ordpool/CAT21-WALLET-FORK-PLAN.md`. The
audit walks the safety invariants in `SECURITY-REVIEW.md` here in the
repo.

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

| Host | Why | Configurable |
|---|---|---|
| `https://ord.cat21.space` | cat21-ord; sole authority for cat data | yes, via settings |
| `https://api.ordpool.space` | ordpool backend; inscription preview, recursive inscriptions | no |
| `https://mempool.space`, `https://blockstream.info` | BTC mempool + tx broadcast | upstream-managed |
| `https://slipstream.mara.com` | direct-to-miner submission for oversize txs (ADR-6) | no |
| `https://ord.io`, `https://ordinals.com`, `https://ordinals.hiro.so` | cat content bytes + preview URLs | no |
| `https://api.leather.io` | upstream market data, fee rates, native-token prices | upstream-managed |
| `https://api.hiro.so` | shared Bitcoin fee endpoints | upstream-managed |

The manifest's `host_permissions` is narrowed to this exact list
(generate-manifest.js). Anything we missed surfaces as a blocked fetch
in DevTools.

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
