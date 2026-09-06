# Integration contract: ordpool-sdk ⇄ Cat21 Wallet

This file describes the surface Cat21 Wallet exposes for `ordpool-sdk` (and
any other consumer) to discover and talk to the extension. It is the source
of truth ordpool-sdk should code against. Changes here are coordinated with
the SDK side via the workspace's `PROTOCOL.md`.

## Discovery

Two namespaces live on `window` when Cat21 Wallet is installed:

| Slot | When | Purpose |
|---|---|---|
| `window.Cat21Provider` | Always | Canonical Cat21 Wallet provider. Use this. |
| `window.LeatherProvider` | Only when real Leather is NOT installed | Backwards-compat shim. We do not claim this slot if real Leather is on the page. See "Politeness model" below. |
| `window.btc_providers[]` | Always | WBIP004 array. Cat21 Wallet pushes a `{ id: 'Cat21Provider', name: 'Cat21 Wallet', ... }` entry. Leather entry only pushed if no other Leather entry exists. |

### Recommended SDK detection (read this carefully)

```ts
function getCat21Wallet(): Provider | undefined {
  if (typeof window === 'undefined') return undefined;
  // 1. Direct slot. Always present when Cat21 Wallet is installed.
  const direct = (window as any).Cat21Provider;
  if (direct?.isCat21) return direct;
  // 2. WBIP004 lookup. Survives Cat21 Wallet sharing a page with other
  //    Bitcoin extensions.
  const list = (window as any).btc_providers as { id: string }[] | undefined;
  return list?.find(p => p.id === 'Cat21Provider') as any;
}
```

Do NOT assume `window.LeatherProvider === Cat21 Wallet`. If real Leather is
co-installed, `LeatherProvider` is real Leather. Cat21 Wallet always lives
at `window.Cat21Provider` and identifies itself with `isCat21: true`.

## Politeness model

We are forked from Leather; we owe upstream the courtesy of not squatting
on the `LeatherProvider` global if the real binary is on the page. The
extension implements this in two places:

- `packages/provider/src/index.ts` only calls `Object.defineProperty(
  window, 'LeatherProvider', ...)` if `typeof window.LeatherProvider ===
  'undefined'`.
- `packages/provider/src/add-leather-to-providers.ts` only pushes the
  Leather WBIP004 entry if no entry with `id === 'LeatherProvider'`
  exists in `window.btc_providers`.

The same logic guards `window.StacksProvider` and `window.HiroWalletProvider`
since Cat21 Wallet doesn't ship a Stacks surface anyway.

## API surface

Cat21 Wallet's provider implements the same JSON-RPC contract as Leather
for the Bitcoin subset, minus Stacks methods. The relevant `RpcMethodNames`
that the wallet handles (see `packages/services/src/index.ts` and
`add-leather-to-providers.ts`):

- `open`
- `getInfo`
- `supportedMethods`
- `getAddresses`
- `signPsbt`
- `signMessage`
- `sendTransfer`

Stacks RPCs are NOT registered. Calls to `stx_*` methods get a typed
`METHOD_NOT_FOUND` response, not a hang.

## MCP host tools

The Cat21 Wallet's MCP host at `tools/src/mcp-host/` exposes seven
tools to local MCP clients (Claude Desktop, Cursor): three read-only
probes plus the four cat-flow mutating actions.

**Read-only probes** — answered inline by the wallet's background,
no popup involvement, no keychain access:

- `list_cats` → cat ids the active account holds
- `wallet_status` → `{ network, accountId, agentMode.enabled }`
- `cat21_ord_status` → cat21-ord's `/status` snapshot

**Mutating actions** — route through the popup-side
`Cat21RpcService` via the iter-12 NMH⇄popup bridge
(`apps/extension/src/background/cat21/attach-native-host-to-popup-relay.ts`).
The agent never reaches the keychain directly; the popup is the
trusted boundary that signs.

- `cat21_mint(recipient, feeRate, tip?, mode?)`
- `cat21_transfer(catId, recipient, feeRate, mode?)`
- `cat21_create_offer(catId, priceSats, paymentAddress, mode?)`
- `cat21_accept_offer(offerPsbt, expectedCatId, expectedPriceSats,
  expectedSellerUtxo, mode?)`

Each mutating call returns one of:

- `{ ok: true, value: { kind: 'broadcast', txid, channel } }`
  (`channel: 'mempool' | 'slipstream'`)
- `{ ok: true, value: { kind: 'listing', listing: { ... } } }` —
  `cat21_create_offer` only, no broadcast
- `{ ok: false, value: { reason, detail? } }` where `reason` is
  one of: `intent-shape-invalid`, `intent-invariant-violated`,
  `agent-disabled`, `policy-denied`,
  `transport-not-trusted-for-autonomous`, `inbound-offer-mismatch`,
  `broadcast-failed`

`mode: 'autonomous'` is honored only when (a) the call arrived
over NMH, (b) the user has agent-mode enabled for the active
account, and (c) the agent-policy gate accepts the intent. Any
guard miss surfaces as a typed denial — never a silent downgrade
to manual.

Mutating actions can ALSO reach the wallet through the standard
`signPsbt` RPC on `window.Cat21Provider` — that's Path 1 (third-
party-wallet users go through `cat21.space`, which builds the PSBT
via ordpool-sdk and asks the wallet to sign it). The wallet itself
does not infer cat-shape from a generic signPsbt payload (HARD
RULE #6); cat21.space owns Path 1's UX.

## SDK-side surface that consumers build with

PSBT construction, broadcast orchestration, offer validation, and the
agent-mode policy gate all live in ordpool-sdk. The wallet signs what
the SDK delivers; dapps and bots integrate against the SDK directly.

| SDK module | Exports | Purpose |
|---|---|---|
| `src/cat21-mint/cat21.service.helper.ts` | `createInput`, `createTransaction` | Per-wallet sequence (Cat21 Wallet → 0xfffffffd RBF-signaling, others → 0xfffffffe non-RBF), lockTime=21 |
| `src/cat21-offer/cat21-offer.helper.ts` | `buildCat21BuyOfferPsbt`, `validateCat21BuyOfferPsbt`, `CAT21_OFFER_POSTAGE_SATS` | ord-style buyer-initiated offer + seller-side validator (defence in depth) |
| `src/cat21-broadcast/broadcast.helper.ts` | `broadcastCat21`, `decideBroadcastChannel`, `STANDARD_TX_WEIGHT_LIMIT` | Weight-based mempool/Slipstream dispatcher |
| `src/cat21-broadcast/slipstream.helper.ts` | `submitToSlipstream`, `SLIPSTREAM_DEFAULT_BASE_URL` | Marathon direct-to-miner submission with `fetch + AbortController` |
| `src/agent-mode/agent-policy.helper.ts` | `evaluateAgentPolicy`, types | Pure-functional autonomous-action gate (per-action cap, daily cap, fee ceiling, floor price, counterparty allowlist) |

See [ordpool-sdk README](https://github.com/ordpool-space/ordpool-sdk#readme)
for the per-module API examples and the layered security model that
governs which validation step belongs where.

## Layered security: the wallet is the last dumb step

CAT-21 safety is enforced **upstream** of the wallet. The five-step chain:

1. Agent / dapp DECLARES intent (e.g. `AgentActionContext { kind: 'buy', spendSats, counterparty }`)
2. `evaluateAgentPolicy(policy, action)` gates the declared intent
3. SDK builds the PSBT from the validated intent (`buildCat21BuyOfferPsbt`)
4. SDK consumer optionally re-validates the PSBT matches intent (`validateCat21BuyOfferPsbt`) before handing bytes to the wallet
5. Wallet shows Leather's standard signPsbt confirmation UI, user clicks, wallet signs

The wallet does NOT inspect PSBT bytes to figure out intent. By the time
bytes reach the wallet, the security gate is already closed upstream.
See `cat21-wallet/CLAUDE.md` HARD RULE #6 for the wallet-side framing.

What the wallet IS responsible for (NOT intent inference):

- Cat-bearing UTXO protection (BTC send never picks a UTXO holding a cat)
- nLockTime preservation through RBF (replacement carries original locktime verbatim, hard-assert)

## Versioning

`window.Cat21Provider.getProductInfo()` returns:

```ts
{
  version: string;
  name: 'Cat21 Wallet';
  meta: { tag: string; commit: string };
}
```

The provider object carries `isCat21: true` and (because Cat21 Wallet is
forked from Leather and reuses the Leather RPC contract for the Bitcoin
methods) also `isLeather: true`. SDKs should key off `isCat21` for
positive identification, not `isLeather` — `isLeather: true` would also
match real Leather, while `isCat21: true` would not.

## Verifying a Cat21 Wallet build

When ordpool-sdk wants to confirm a Cat21 Wallet build is the trusted CI
output rather than a side-loaded development copy:

```sh
gh attestation verify cat21-wallet-extension.zip \
  --repo ordpool-space/cat21-wallet
```

The trusted-build workflow in `.github/workflows/extension:trusted-build.yml`
produces the attestation. A pass means GitHub's OIDC identity signed a
provenance saying this exact byte sequence came out of this exact commit
in this exact repository on a GitHub-hosted runner.

## Workspace cross-reference

- ordpool-sdk integration code: `ordpool-sdk/` in the workspace
- Cat21 Wallet plan: `CAT21-WALLET-FORK-PLAN.md` in the workspace
- This file: lives in the wallet repo because the wallet owns the contract
