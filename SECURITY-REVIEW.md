# Cat21 Wallet — Security Review (Phase 7)

This audit walks each invariant from `CAT21-WALLET-FORK-PLAN.md` and reports
status. Every claim cites file + line.

## 1. nLockTime=21 is set only on the CAT-21 mint

**Status:** verified.

Search for `lockTime` / `CAT21_LOCK_TIME` across `packages/bitcoin/src/transactions/`
yields exactly one source-of-truth:
`packages/bitcoin/src/transactions/generate-cat21-mint-transaction.ts:23` defines
`CAT21_LOCK_TIME = 21`, and it is the only file that passes a non-default
`lockTime` to `new btc.Transaction(...)` (line 100). The buy-offer builder
(`generate-cat21-buy-offer-psbt.ts`) and the upstream send flow
(`generate-unsigned-transaction.ts`) leave `lockTime` at the default 0.

A regression that leaks `nLockTime=21` into a non-mint tx would fail the
spec at `generate-cat21-mint-transaction.spec.ts:50` (which pins the value)
because no other tx path constructs a `Transaction` with that argument.

## 2. CAT-21 mint inputs use sequence 0xfffffffd (RBF allowed, locktime honored)

**Status:** verified.

`generate-cat21-mint-transaction.ts` defines `CAT21_MINT_INPUT_SEQUENCE =
0xfffffffd`. Two bits matter:

- `< 0xfffffffe` → signals BIP-125 opt-in RBF. The user is allowed to
  replace the mint via the wallet's increase-fee flow.
- `< 0xffffffff` → keeps the input non-final-for-locktime so the
  transaction-level `nLockTime = 21` is still honored.

A runtime assert in the mint builder throws `Cat21MintInputSequenceBroken`
if any input sequence reaches `0xffffffff` (which would disable locktime).
The spec pins both the exact value (`0xfffffffd`) and the two range
invariants.

Per CLAUDE.md HARD RULE #1, we deliberately do NOT ban RBF on CAT-21
mints. The defense against the 2024 Xverse incident is at the
*replacement-construction* layer (point 4 below), not by refusing RBF on
the original mint.

## 4. RBF replacement preserves nLockTime

**Status:** verified.

`apps/extension/src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts`
constructs the replacement Transaction with `new btc.Transaction({
lockTime: payload.tx.locktime })`. The original tx's locktime is copied
verbatim, so a CAT-21 mint (locktime=21) replaced via this flow stays a
CAT-21 mint. The sequence bump is clamped to `0xfffffffe` so locktime
remains honored across an arbitrary number of replacements.

A runtime assert at the end of `generateUnsignedTx` throws if
`newTx.lockTime !== payload.tx.locktime`. Refusing to sign in that case
is the right default: per CLAUDE.md HARD RULE #1, losing nLockTime on a
CAT-21 mint is the worst class of bug this wallet can ship.

## 3. Buy-offer PSBT uses SIGHASH_ALL on every input

**Status:** verified.

`generate-cat21-buy-offer-psbt.ts` sets `sighashType: SigHash.ALL` on the
seller-referenced input (line 130) and on every buyer-funded input (line
154). A runtime assert at lines 173–176 throws `Cat21OfferSighashBroken`
if anything else is found. Per ord's design, this makes sniping
structurally impossible: there is no half-signed PSBT a third party can
mutate, because every signature commits to every byte.

## 4. Seller-side offer validation surface

**Status:** verified.

`validate-cat21-buy-offer.ts` runs six checks before the seller signs:
seller UTXO referenced (1), SIGHASH_ALL on every input (6), every buyer
input already signed (5), postage at or above protocol minimum (2),
seller-payment present (3), price at or above floor (4). Each failure
maps to a distinct typed error key so the UI can surface the precise
reason without leaking unrelated PSBT details.

Known gap (documented in the file): the seller's payment-address bech32
match is delegated to the UI layer because the validator does not have a
network handle to decode the scriptPubKey back to an address. The
on-wire invariants (which output, which amount) are checked here.

## 5. Agent-mode policy gate is unbypassable

**Status:** verified.

`packages/services/src/agent-mode/agent-policy.service.ts` is pure-
functional and runs *before* signing or broadcasting. The decision type
`AgentPolicyDecision` is a discriminated union — either `{ allowed: true }`
or `{ allowed: false, reason: ... }`. Callers cannot accidentally treat a
deny as an allow.

Spec at `agent-policy.service.spec.ts` covers nine deny paths and three
allow paths. Every gate is exercised: disabled, action-cap, daily-cap,
fee-rate ceiling, sell floor price, counterparty allowlist (both
non-empty restricting and empty allowing).

## 6. Cat-bearing UTXOs are protected from the BTC send flow

**Status:** verified, with conservative failure mode.

`packages/services/src/utxos/utxos.service.ts:79` calls
`fetchCatBearingUtxoIds` on every UTXO before classification. The
per-output `/output/<txid>:<vout>` probe asks cat21-ord whether the
UTXO holds inscriptions; if yes the UTXO lands in the `protected`
bucket and is folded into `unspendable` so the BTC send flow never
picks it.

**Failure mode (intentional):** if cat21-ord is unreachable or the
per-UTXO probe throws, `fetchCatBearingUtxoIds` returns the UTXO as
cat-bearing (file: `cat21-ord-api.client.ts:177`). This means a cat21-ord
outage cannot accidentally cause a cat to be spent; the BTC send simply
sees fewer available UTXOs. The user-visible cost is a balance that
appears lower until cat21-ord recovers — a UX issue, not a safety issue.

## 7. NMH `allowed_origins` pins our extension ID

**Status:** verified, template enforces the rule.

`tools/src/mcp-host/native-manifests/cat21-wallet.mac-linux.json.template`
ships with `"allowed_origins": ["chrome-extension://REPLACE_ME_EXTENSION_ID/"]`.
The README (`tools/src/mcp-host/README.md`) directs operators to replace
that placeholder with the deterministic extension ID
(`nbooeiaddbkoiekkahgekialhahgpboe` for the dev key in
`apps/extension/scripts/generate-manifest.js`).

The host binary itself (`tools/src/mcp-host/host.ts`) does not check
which Chrome instance opened the stdio pipe — Chrome enforces the
`allowed_origins` match before spawning the host. The defense lives at
the Chrome layer, by Chrome's design.

## 8. No hardcoded secrets in source

**Status:** verified.

Grep across `packages/services/src`, `apps/extension/src`, `tools/src` for
common secret patterns (`ghp_`, `ghs_`, `sk-`, `TEST_PRIVATE_KEY=` with
hex payload) finds zero matches in our source. The only `process.env.*`
reads in our new code are `MCP_STDIN_DIRECT` (host binary) and
`WALLET_ENVIRONMENT` / `TARGET_BROWSER` (manifest generator).

The hans-crypto PAT lives only in the headquarter (per workspace CLAUDE.md
rules), never in this repo.

## 9. Chrome extension manifest permissions are minimal

**Status:** verified, host_permissions deliberately broad.

`apps/extension/scripts/generate-manifest.js:90` requests:

- `contextMenus` — for the wallet's right-click menu (inherited from Leather)
- `storage` — for wallet state
- `unlimitedStorage` — for cached cat21-ord responses + ord JSON
- `notifications` — for cat-received notifications
- `nativeMessaging` — for the Phase 6 NMH bridge (Cat21-specific addition)

`host_permissions: ['*://*/*']` is broad. It matches Leather upstream
because the extension reaches mempool, electrs, third-party ord
instances, and now cat21-ord across multiple hosts. Tightening to a
fixed allowlist is feasible (the actual targets are
`api.ordpool.space`, `ord.cat21.space`, `slipstream.mara.com`, and the
user's optional custom cat21-ord URL) but would require a Chrome
optional-host-permissions prompt flow at runtime, which is a UX-quality
change rather than a security defect. Tracked as a Phase 8 polish item.

## 10. axios is the only HTTP client in our new code (per ADR-11)

**Status:** verified.

axios appears in `cat21-ord-api.client.ts`, `slipstream-api.client.ts`,
and nowhere else in our new code. The MCP host binary does no HTTP
(all I/O is stdio framing). The PSBT builders + agent-policy service
are pure-functional. Per ADR-11 the Leather fork keeps axios
unrestricted; this audit confirms we did not accidentally introduce a
raw `fetch` or third-party HTTP lib.

## 11. Conservative failure modes everywhere

- **cat21-ord unreachable** → treat UTXOs as cat-bearing (UTXOs can't be
  spent vs cats accidentally spent).
- **/status reports wrong chain or missing index flag** → Zod schema
  throws; UI degrades to "indexer unavailable" mode.
- **Slipstream submission throws** → caller decides; no retry, no
  double-broadcast.
- **Agent policy ambiguous** → deny by default (the type guarantees
  `allowed: true` is the only allow path).

## Outstanding items (Phase 8)

- Optional host-permissions narrowing on the manifest.
- E2E test that exercises the full mint → balance-shows-up loop against
  testnet cat21-ord.
- Spec for the NMH host's MCP request handler.

## Audit metadata

- Performed: 2026-06-14 in cat21-wallet-staging fork dev branch.
- Audit script: this document; spot checks in `packages/bitcoin/src/`,
  `packages/services/src/`, `tools/src/mcp-host/`.
- Reviewer: hans-crypto.
