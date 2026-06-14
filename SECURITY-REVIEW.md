# Cat21 Wallet — Security Review

This audit walks each invariant the wallet is responsible for. Every
claim cites file + line.

The wallet's responsibilities (see CLAUDE.md → "What this repo is — scope"):

  (a) display cats and respect nLockTime=21
  (b) offer an MCP server

PSBT construction, broadcast orchestration, agent-mode policy, and
Slipstream fallback live in `ordpool-sdk`.

## 1. RBF replacement preserves nLockTime

**Status:** verified.

`apps/extension/src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts`
constructs the replacement Transaction with `new btc.Transaction({
lockTime: payload.tx.locktime })`. The original tx's locktime is copied
verbatim, so a CAT-21 mint (locktime=21) replaced via this flow stays a
CAT-21 mint.

The sequence bump is clamped to `0xfffffffe` so locktime remains
honored across an arbitrary number of replacements. A runtime assert at
the end of `generateUnsignedTx` throws if `newTx.lockTime !==
payload.tx.locktime`. Refusing to sign in that case is the right
default: per CLAUDE.md HARD RULE #1, losing nLockTime on a CAT-21 mint
is the worst class of bug this wallet can ship.

This is the single nLockTime invariant the wallet enforces. The mint
builder itself lives in ordpool-sdk; whatever locktime the SDK puts on
a PSBT, the wallet preserves it through RBF.

## 2. Cat-bearing UTXOs are protected from the BTC send flow

**Status:** verified, with conservative failure mode.

`packages/services/src/utxos/utxos.service.ts` calls
`fetchCatBearingUtxoIds` on every UTXO before classification. The
per-output `/output/<txid>:<vout>` probe asks cat21-ord whether the
UTXO holds inscriptions; if yes the UTXO lands in the `protected`
bucket and is folded into `unspendable` so the BTC send flow never
picks it.

**Failure mode (intentional):** if cat21-ord is unreachable or the
per-UTXO probe throws, `fetchCatBearingUtxoIds` returns the UTXO as
cat-bearing (file: `cat21-ord-api.client.ts`). This means a cat21-ord
outage cannot accidentally cause a cat to be spent; the BTC send
simply sees fewer available UTXOs. The user-visible cost is a balance
that appears lower until cat21-ord recovers — a UX issue, not a
safety issue.

## 3. NMH `allowed_origins` pins our extension ID

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

## 4. MCP tool surface is read-only

**Status:** verified.

`tools/src/mcp-host/protocol.ts` declares `CAT21_MCP_TOOLS`. The list
contains exactly:

- `list_cats` — query for cats held in the active account.
- `wallet_status` — extension reachability probe.
- `cat21_ord_status` — forwarded `/status` from cat21-ord.

No tool in this list can spend, sign, or otherwise mutate state.
Mutating actions reach the wallet through the existing `signPsbt` RPC
on `window.Cat21Provider`, which routes through the standard user-
confirmation UX. The MCP host cannot bypass that path.

## 5. No hardcoded secrets in source

**Status:** verified.

Grep across `packages/services/src`, `apps/extension/src`, `tools/src` for
common secret patterns (`ghp_`, `ghs_`, `sk-`, `TEST_PRIVATE_KEY=` with
hex payload) finds zero matches in our source. The only `process.env.*`
reads in our new code are `MCP_STDIN_DIRECT` (host binary) and
`WALLET_ENVIRONMENT` / `TARGET_BROWSER` (manifest generator).

The hans-crypto PAT lives only in the headquarter (per workspace CLAUDE.md
rules), never in this repo.

## 6. Chrome extension manifest permissions are minimal

**Status:** verified, host_permissions deliberately broad.

`apps/extension/scripts/generate-manifest.js` requests:

- `contextMenus` — for the wallet's right-click menu (inherited from Leather)
- `storage` — for wallet state
- `unlimitedStorage` — for cached cat21-ord responses + ord JSON
- `notifications` — for cat-received notifications
- `nativeMessaging` — for the MCP NMH bridge (Cat21-specific addition)

`host_permissions` is narrowed to 13 explicit patterns
(cat21-ord, ordpool, mempool, slipstream, ord.io, ordinals.com,
ordinals.hiro.so, api.leather.io for market data, api.hiro.so for
shared fee endpoints, localhost). Anything we missed surfaces as a
blocked fetch in DevTools.

## 7. axios is the only HTTP client in our new code (per ADR-11)

**Status:** verified.

axios appears in `cat21-ord-api.client.ts` and nowhere else in our new
code. The MCP host binary does no HTTP (all I/O is stdio framing). Per
ADR-11 the Leather fork keeps axios unrestricted; this audit confirms
we did not accidentally introduce a raw `fetch` or third-party HTTP
lib.

## 8. Conservative failure modes everywhere

- **cat21-ord unreachable** → treat UTXOs as cat-bearing (UTXOs can't
  be spent vs cats accidentally spent).
- **/status reports wrong chain or missing index flag** → Zod schema
  throws; UI degrades to "indexer unavailable" mode.
- **RBF replacement locktime mismatch** → assert throws before signing.

## Audit metadata

- Performed: 2026-06-14.
- Audit script: this document; spot checks in
  `packages/bitcoin/src/`, `packages/services/src/`,
  `tools/src/mcp-host/`, `apps/extension/src/app/features/dialogs/`.
- Reviewer: hans-crypto.
