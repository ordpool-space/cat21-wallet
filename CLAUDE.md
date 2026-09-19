# CLAUDE.md - cat21-wallet

Single source of truth for the CAT-21 wallet (a non-fork clone of Leather `leather-io/mono@a6460b4d`). Read before touching anything. HQ `/Work/ordpool/CLAUDE.md` owns cross-repo rules; where they overlap, the more restrictive wins.

---

## HARD RULE #1: every cat-touching tx we build carries nLockTime=21
<!-- long-rule: per-operation enforcement table is the load-bearing part -->
- Protocol-vs-convention split lives in HQ `CLAUDE.md` "nLockTime=21 is PROTOCOL for MINT, CONVENTION for everything else". Do not restate it here.
- Local enforcement:

| Operation | Rule | Where |
|---|---|---|
| mint / transfer / buy-offer build | post-build assert: `lockTime=21` + sequence + `SIGHASH_ALL` on inputs | `ordpool-sdk/src/cat21-{mint,transfer,offer}/*.helper.ts` |
| input sequence, tx we build | `CAT21_WALLET_INPUT_SEQUENCE=0xfffffffd` (RBF on) | `ordpool-sdk/src/cat21-protocol/cat21-sequence.ts` |
| other-wallet MINT input | `CAT21_OTHER_WALLET_MINT_INPUT_SEQUENCE=0xfffffffe` (RBF off), mint-only via `resolveCat21MintInputSequence`. Transfers+offers RBF-on for all wallets since SDK `703f90b`. | same |
| RBF replace our tx | replacement keeps `lockTime=21`, assert | `apps/extension/src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts` |
| cat UTXO in BTC send | refused; `protected` bucket | `packages/services/src/utxos/utxos.service.ts` |
| inbound buy-offer accept | sign as-is, any lockTime; popup shows the inbound lockTime so the human seller sees what they sign | `apps/extension/src/background/cat21/builders/accept-offer-validator.ts`, `cat21-rpc.service.ts → acceptOffer` |

- Verify builder changes: edit the SDK helper, `pnpm sdk:build` (staleness guard `apps/extension/scripts/check-sdk-fresh.cjs`), `pnpm --filter @leather.io/extension test:unit -- src/background/cat21`, then `apps/extension/src/__architecture__/architecture.spec.ts`.
Why: skipping 21 on a non-mint costs a bonus mint, not the cat (ordinal theory); only a mempool mint RBF that drops 21 loses the mint.

## HARD RULE #2: Cat-bearing UTXOs are never spent by the BTC send flow
- A cat UTXO lives in the `protected` bucket; BTC coin-selection sees only `available`. Probe: `packages/services/src/utxos/utxos.service.ts`, cat21-ord `/output/<txid>:<vout>` per UTXO.
- Fail closed: cat21-ord unreachable → treat as cat-bearing, refuse to spend (balance shows lower until it recovers).

## HARD RULE #3: We do not auto-update from upstream Leather
- Upstream sync is manual, quarterly, maintainer-only. `upstream` remote = `https://github.com/leather-io/mono`; pull to review, never auto-apply.
- Every sync re-checks the inscription stack (revived from #2358's parent) was not re-deleted.
Why: Dependabot is org-banned (HQ); auto-merging upstream is a supply-chain door.

## HARD RULE #4: axios is allowed in this repo (ADR-11)
- The HQ "no axios in code we own" rule does NOT apply here. Leather and our revived helpers use axios; keep it.
Why: rewriting `a6460b4d` helpers to fetch creates merge conflicts with no gain. Supply-chain audit happens at the lockfile during quarterly sync.

## HARD RULE #5: Do not modify existing comments - except HACK markers
- Existing upstream comments (no HACK marker): leave exactly as written, punctuation and whitespace included.
- HACK markers (`/* HACK -- Cat21: <reason> */`): add / edit / remove freely; keep them honest about the current edit.
- New comment in a new file we own: write what you need.
- If a refactor forces changing a non-HACK upstream comment (rare), call it out in the commit message.

## HARD RULE #6: The browser surface is Leather; cat21_* is internal
- Browser (`window.Cat21Provider`): Leather-compatible RPCs only - `open, getInfo, supportedMethods, getAddresses, signPsbt, signMessage, sendTransfer, openSwap`. Dapps do CAT-21 via `signPsbt` with PSBTs cat21.space built + validated. Stacks `stx_*` → `METHOD_NOT_FOUND`.
- The wallet does NOT expose `cat21_mint/transfer/create_offer/accept_offer/buy` to dapps.
- Internal `Cat21RpcService` (background) exposes the typed `cat21_*` actions, reached by two transports, never the browser:
  - Path 2 - popup UI over `chrome.runtime`.
  - Path 3 - MCP agent over the NMH Native-Messaging bridge.
- No PSBT-shape inference on `signPsbt` (Leather standard confirm + sign). Typed `cat21_*` carry the action kind in the method name; enforce invariants on the declared intent, not on constructed bytes.
- Not intent-guessing (conservative defaults): cat-UTXO protection (`utxos.service.ts`), nLockTime preservation through RBF (`use-btc-increase-fee.ts`).
Why: a second mutating browser surface is a Sisyphean defense for no UX gain; cat21.space owns the in-browser Cat21 UI.

## HARD RULE #7: Identity separation
- Full rule at HQ `/Work/ordpool/CLAUDE.md`. Local: git user `Hans Crypto` / `johannes@haushoppe.art`, SSH alias `github-ord-dev`, `gh` needs `GH_TOKEN=<hans-crypto PAT>` (never bare `gh`). Verify: `git config user.email`.

## HARD RULE #8: Process discipline - plan first, independent review
- Non-trivial change (> one-line fix):
  1. Spec commit first (test stubs + type signatures + interface sketches), maintainer signs off, then the implementation commit. If shapes can't model a problem, raise it; do not silently redesign.
  2. Independent review of every implementation commit: spawn a `general-purpose` agent with no session context, hand it `git diff HEAD~1..HEAD` + this file, ask which rules the diff violates; paste its output into the next commit message.
  3. `__architecture__/architecture.spec.ts` is executable law; change it in the same commit as the rule it encodes.
  4. `.husky/cat21-architecture-guard.js` is the pre-commit gate; `--no-verify` needs written justification in the commit.
- Diff size is uncapped; a coherent feature lands as one reviewed commit. Fix a caught violation in the same commit, never "later".

## HARD RULE #9: The architecture spec is the contract
- `apps/extension/src/__architecture__/architecture.spec.ts` encodes these rules as Vitest checks: browser RPC registry = the eight Leather methods (no cat21_*); browser code must not name any cat21_* or import `Cat21RpcService`; increase-fee hook copies + asserts locktime; BTC balances fold `utxos.protected` into unspendable; every modified upstream file carries a `HACK -- Cat21` marker; this file keeps the HARD RULES + four RPC method names by literal string.
- Change a HARD RULE here → change its spec assertion in the same commit.

## HARD RULE #10: PSBT logic comes from ordpool-sdk, imported via `/core`
<!-- long-rule: SDK core API + port mapping contract -->
- Every CAT-21 PSBT is built by `ordpool-sdk`; the wallet keeps no copies. Import from `'ordpool-sdk/core'`, never bare `'ordpool-sdk'` (the architecture spec rejects bare imports; bare drags the stateful RxJS service classes + `rxjs` into the bundle).
- mint / transfer / buy delegate select→fee→build→sign→broadcast to the core orchestrators (`executeMint`, `executeTransfer`, `createOffer`) via injected ports. `accept_offer` stays keychain-based (validate via `validateCat21BuyOfferPsbt`, sign input 0, broadcast); do NOT route it through the core (the SDK's cat21wallet signer needs `window.Cat21Provider`, absent in the background).
- The core runs content-checked funding selection over whatever `ContentScanPort` reports; the wallet wires the four-class scan (`classifyOutpoint` → full ord + cat21-ord).
- The input adapter derives the input shape from `paymentPublicKey + paymentAddress` (legacy P2PKH via `nonWitnessUtxo`); `Cat21AccountContext` carries `paymentPublicKey` (hex).
- Buy-offer / sell-accept PSBTs sign every input `SIGHASH_ALL`: once the seller signs, every byte is committed, so a public offer cannot be spliced (sniping-proof). See HQ "Offers can be shared in the wild".

| Core fn (`ordpool-sdk/core`) | Returns |
|---|---|
| `executeMint / executeTransfer` | `{ txid, channel, feeSats }` |
| `createOffer` (= `cat21_buy`) | `CreateOfferArtifact`, no broadcast |
| `acceptOffer` | `{ txid, channel }` |
| `simulateMint/Transfer/CreateOffer/Inscribe(params,{utxos,scan})` | preview, no signing |

| Core port | Built from `Cat21RpcDeps` |
|---|---|
| `UtxosPort.spendableUtxos` | `spendableUtxos(addr)` (the `available` bucket) |
| `ContentScanPort.classify` | `classifyOutpoint(op)` (four-class: full ord + cat21-ord) |
| `SignPort.sign` | mode-aware: `signWithConfirmation` (manual) / `signSilently` (autonomous) |
| `BroadcastPort.broadcast` | `deps.broadcast({hex,weight})`, re-derive weight from hex |
| `OfferCreateSignPort.signBuyerInputs` | `deps.signBuyOfferInputs` |

- SDK is SHA-pinned in `apps/extension/package.json` (`github:ordpool-space/ordpool-sdk#<sha>`), same as other consumers; `dist/` is not checked in (generated by the SDK `prepare` hook at install; needs `ignore-scripts=false`, set workspace-wide). `dist` is ESM (`dist/package.json` `{"type":"module"}`), Webpack consumes it via the `exports` map. Bump: edit sha → `pnpm install` → `typecheck` + `test:unit` → commit both `package.json` + `pnpm-lock.yaml`. Live iteration: `npm link` a pre-built SDK.
- Pin `@scure/btc-signer` to `1.6.0` EXACTLY, never a range: it is a peer of the SDK, so a range lets npm dedup it DOWN to a wrong version (a bump that broke three sibling repos left cat21-wallet correct only because of the exact pin). Must match `@leather.io/bitcoin`; no override needed. See HQ "Pinning a sha pins neither what it runs against nor, sometimes, itself".
- New pure helper: add under `ordpool-sdk/src/`, re-export from `core.ts`, `npm run build`, bump the wallet sha. Stateful (`rxjs`) classes (`Cat21Service`, `Cat21MintOrchestrator`, `Cat21ApiService`, `UtxoContentScannerService`) stay out of `core.ts`.

## HARD RULE #11: Default branch is `main`; commit often, no PR ceremony
- Default branch `main`. Small commits land directly; no feature branches, no PRs. Review via the RULE #8 agent, not GitHub threads.
- CI triggers on `main`. A `production` branch is cut from a tagged `main` when we ship to the Chrome Web Store.
- Long-lived risky refactor only: `feat/<topic>` from `main`, merge back `--no-ff`; squash when intermediate steps carry no independent audit value.

## HARD RULE #12: Caps apply to BOTH modes, no override
- The per-account agent-policy caps gate (`evaluateAgentPolicyCaps`, run in `resolveSigningMode` before the manual/autonomous split) binds Path 2 and Path 3. To raise a cap, change the policy value; there is no bypass.
- `enabled: false` gates only silent-sign, never the caps; a configured cap is absolute. No policy = no caps configured (autonomous still blocked by `agentMode.enabled`).
- `cat21_accept_offer` intent mismatch (decoded fields disagree with `expectedCatId/expectedPriceSats/expectedSellerUtxo`) is a hard error in both modes.

---

## What this repo is - scope

Bitcoin-L1-only browser-extension wallet serving three paths for mint / transfer / create-offer / accept-offer / buy:

- **Path 1** - third-party-wallet users reach the wallet only as `signPsbt`; cat21.space built + validated the PSBT. Upstream-Leather behaviour.
- **Path 2** - cat21-wallet manual mode: typed `cat21_*` via popup UI, cat21-themed confirm dialog, click before signing. The path the maintainer uses for deals worth human attention.
- **Path 3** - cat21-wallet YOLO / agent mode (the Bazaar): an MCP bot over the NMH bridge invokes the same `cat21_*`; when transport is NMH + agent-mode enabled + policy allows, sign silently. Any guard failure = typed rejection, never a silent downgrade. `mode:'autonomous'` must be explicit.

Across all paths: display cats from cat21-ord, refuse to spend cat UTXOs (RULE #2), set `nLockTime=21` (RULE #1).

The MCP host (`tools/src/mcp-host/`) exposes the five mutating actions plus read-only probes `list_cats`, `wallet_status`, `cat21_ord_status`. One `Cat21RpcService` handler, two internal transports; the browser is never one.

### What stays in ordpool-sdk vs the wallet
- SDK: mint / buy-offer / sell-accept PSBT construction, offer validation, broadcast dispatcher (mempool / Slipstream), agent-policy gate, Slipstream client. Three consumers share it (cat21.space, wallet manual, wallet autonomous); duplication is rejected on sight.
- Wallet must NOT contain: in-extension cat21 forms for third-party users (Path 1 UX is cat21.space), a `signPsbt`-shape classifier (RULE #6), duplicate PSBT builders, duplicate agent-policy logic.

---

## Cat21 RPC architecture (Path 2 + Path 3)

Pinned; any change needs a new HARD RULE.

| Method | Intent |
|---|---|
| `cat21_mint` | `{ recipient, feeRate, tip?, mode? }` |
| `cat21_transfer` | `{ catId, recipient, feeRate, mode? }` |
| `cat21_create_offer` | `{ catId, priceSats, paymentAddress, mode? }` |
| `cat21_accept_offer` | `{ offerPsbt, expectedCatId, expectedPriceSats, expectedSellerUtxo, mode? }` |
| `cat21_buy` | `{ catId, catNumber, bidSats, sellerPaymentAddress, feeRate, mode? }` |

- Naming: `cat21_<verb>`, snake_case. `mode` defaults `'manual'`; `'autonomous'` honoured only when all mode-resolution guards pass.
- Pipeline (every method): parse+validate intent → enforce invariants → resolve mode (declared + transport + `policy.enabled` + `policy.evaluate`) → build via SDK → post-build assert → sign (manual = confirm dialog; autonomous = silent) → broadcast (mempool, Slipstream on >400k weight) → `{ txid }`.
- Pinned decisions: agent-mode ON by default after a first-run wizard; policy stored per-account (Redux, seed-encrypted) with fields `maxSpendPerActionSats`, `dailyCapSats`, `maxFeeRateSatPerVbyte`, `floorPriceSatsPerCat`, `allowedCounterparties`, `enabled`; NMH single-tenant (one binary, one `allowed_origins` = our extension id); manual confirm is cat21-themed (cat SVG via mooncat-parser, rarity badge, truncated counterparty + copy, plain headline).
- Endpoints (prefer our infra): mempool + broadcast `https://api.ordpool.space`; indexer `https://ord.cat21.space`; Slipstream fallback `https://slipstream.mara.com`. Market data + fee estimates migrate off `api.leather.io` / `api.hiro.so` to `api.ordpool.space`. Any new outbound endpoint is a HARD-RULE question.

### Layout
```
apps/extension/src/background/cat21/
  invariants/{mint,transfer,create-offer,accept-offer}-invariants.ts  ← pure, 100% covered
  cat21-rpc.service.ts        ← orchestrates the pipeline
  mode-resolver.ts            ← the security boundary
  agent-policy-deps.ts        ← Redux slice → SDK caps gate
  popup-bridge.ts / nmh-popup-relay.ts / cat21-result-bus.ts
  nmh-read-only-probes.ts / attach-native-host-to-popup-relay.ts
apps/extension/src/background/messaging/rpc-methods/cat21-*.ts        ← thin: parse → rpc.service
apps/extension/src/app/pages/cat21-confirm/
  cat21-confirm-route.tsx     ← container; intent from URL (Path 3) or location.state (Path 2)
  use-cat21-rpc-deps.ts       ← wires all Cat21RpcDeps to keychain + cat21-ord + mempool
apps/extension/src/app/store/agent-policy/                           ← per-account policy + wizard
```

Path-3 round trip: agent → MCP `tools/src/mcp-host/host.ts` → NMH stdio → background `attachNativeHostToPopupRelay` → read-only probes reply inline; mutating cat21_* stash intent → open popup `?cat21RequestId=<id>` → `Cat21ConfirmRoute` auto-confirms if `mcp-nmh` → sign + broadcast → `postCat21Result` → port reply → clear storage.

---

## Repo layout (Turborepo, `@leather.io/*`)
```
apps/extension/   ← ships     apps/mobile/ ← bonus target     apps/web/ ← NOT shipped
packages/bitcoin (PSBT builders incl cat21) · models (Cat21Asset) · utils · features · services (cat21-ord client + AgentPolicyService) · provider (window.Cat21Provider + WBIP004) · ui/rpc/query/state
tools/src/mcp-host/   ← the NMH bridge binary
```
Files to know: `SECURITY-REVIEW.md` (invariants with file:line), `PRIVACY-POLICY.md`, `INTEGRATION-ORDPOOL-SDK.md`, `docs/pending/CHROME-WEB-STORE-LISTING.md`, `/Work/ordpool/CAT21-WALLET-FORK-PLAN.md` (ADR history).

## Development workflow
```sh
pnpm i && pnpm build       # Node 22+ (.nvmrc), pnpm pinned via packageManager
pnpm dev                   # load apps/extension/dist as unpacked; dev id nbooeiaddbkoiekkahgekialhahgpboe, key .keys/cat21-wallet-dev.pem (gitignored)
```
Verify before commit: `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `pnpm --filter @leather.io/extension lint:unused-exports`. Per-package: `pnpm --filter @leather.io/{pkg} {typecheck|test:unit}`.
- `@tanstack/query/exhaustive-deps` and `no-duplicate-imports` fire only in the turbo `repo:code-checks` lint, not the filtered `pnpm --filter … lint`. Clear `.eslintcache` before trusting a local lint pass.
- Commits: Conventional Commits, imperative, no body unless asked. HACK markers `/* HACK -- Cat21: <reason> */`; never delete upstream code, comment it out with a marker.

## CI and trusted builds
- Active safety net: `extension:code-checks`, `extension:pr-build`, `extension:cat21-e2e` (mocked), `extension:cat21-chain-e2e` (real regtest + backend), `repo:code-checks`, `repo:all-checks-pass`, `repo:workflow-checks`, `check-locktime-framing` (greps banned nLockTime framing, sibling of cat21-indexer + ordpool-sdk).
- Tag-gated trusted build: `.github/workflows/extension:trusted-build.yml` (GitHub-hosted only, sha-pinned actions, `--frozen-lockfile`, sigstore attestation via `actions/attest-build-provenance@v1.4.0`). Verify a zip: `gh attestation verify cat21-wallet-extension.zip --repo ordpool-space/cat21-wallet`.
- Disabled (`workflow_dispatch` / `disabled_manually`): `extension:publish-extensions.yml`, `web:deploy.yml`, `extension:integration-tests.yml` (needs `EXTENSION_INTEGRATION_TEST_MNEMONIC`). Add any new workflow to one of these buckets and update this section.

## RPC surface + window providers
- `window.Cat21Provider` always present (`isCat21:true`, `isLeather:true`, `getProductInfo().name==='CAT-21 wallet'`). `window.LeatherProvider` only when real Leather is absent. `window.btc_providers` (WBIP004) always has a Cat21 entry. Contract: `INTEGRATION-ORDPOOL-SDK.md`.
- Handled RPCs: `open, getInfo, supportedMethods, getAddresses, signPsbt, signMessage, sendTransfer`. `stx_*` → `METHOD_NOT_FOUND`.

## Network surfaces
Prefer our infra; Leather public endpoints will not tolerate us long-term. `host_permissions` narrowed by `generate-manifest.js`. The mempool.space carve-out (API free-riding stays, user-facing links go to ordpool.space) lives in HQ `CLAUDE.md`.

| Host | Why | Configurable |
|---|---|---|
| `https://ord.cat21.space` | cat21-ord; sole cat authority | yes |
| `https://api.ordpool.space` | mempool API, broadcast, market data, fees, inscription preview | yes |
| `https://slipstream.mara.com` | oversize direct-to-miner | yes |
| `ord.io`, `ordinals.com`, `ordinals.hiro.so` | cat content bytes + preview (external by design) | no |
| `mempool.space`, `blockstream.info` | legacy fallback during migration off Leather endpoints | no |
| `api.leather.io`, `api.hiro.so` | market data + fees; migration target `api.ordpool.space` | no |

Anything missed surfaces as a blocked fetch in DevTools.

## Reviving / hiding an upstream file
- Revive: `git checkout a6460b4d -- <file>`, re-add HACK markers (why hid + why un-hid), `pnpm --filter @leather.io/<pkg> build`, typecheck the consumer.
- Hide: never delete; `/* HACK -- Cat21: ... */`, update routes/exports/DI to skip the symbol, re-run verification.

## Code style (inherited from Leather; HQ workspace rules also apply)
- No enums. `interface` for object shapes; props named `ComponentNameProps`, destructured in the signature.
- `function` declarations for top-level fns + components; arrow only for callbacks.
- No `as` casts, no `!` non-null assertions, no `any` (HQ "No Non-Null-`!`-Cheat"): use guards, type guards, or `unknown` + narrowing. Discriminated unions over `?:`-fields callers must `!`-through.
- Prefer Remeda for typed/non-trivial transforms; native for trivial. Prefer `const`; named constants over magic values. No nested ternaries. Object method shorthand.
- camelCase file-level constants; SCREAMING_SNAKE_CASE in `constants` packages. Kebab-case filenames (convention-named configs exempt, e.g. `babel.config.cjs`, `tsconfig.json`); platform suffixes `.web.tsx/.native.tsx/.shared.ts`; `*.spec.ts(x)` co-located; no `index.ts(x)` except barrels / router.

## Error handling
- `throw` only for genuinely invalid states (wrong keychain type, missing config). Expected failures return `null` / `undefined` / typed results.
- Never throw in render / reducers / selectors; use error boundaries or fallback UI.

## Circular dependencies
- Never import a package's own barrel (`index.ts`) from its sub-modules. Keep `initialState` in write/slice files; never import `store/index.ts` inside a slice. Anti-pattern: slice → utils → store → slice.

## Security (cat-specific rules at top)
- Sanitize external HTML (cat content, collectible descriptions) before render. Validate cat21-ord + untrusted responses with Zod `.passthrough()`. Never expose keys/seeds/mnemonics in errors or logs.

## Tooling
Turborepo + pnpm. Vitest (unit/integration). Playwright (extension E2E); avoid `force:true`; never nest interactive elements.
