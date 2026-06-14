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

Stacks RPCs are NOT registered (Phase 1.1 hide pass dropped them). Calls
to `stx_*` methods get a typed `METHOD_NOT_FOUND` response, not a hang.

## Cat21-specific tools (planned for SDK exposure)

These belong to the Cat21 Wallet's MCP host surface today
(`tools/src/mcp-host/`) and will be exposed to ordpool-sdk via the same
provider once the agent-mode confirmation path lands in the UI:

- `list_cats` → returns the cats held by the active account
- `cat21_ord_status` → forwards cat21-ord's `/status` response
- `wallet_status` → reachability probe

For mint and offer flows (Phase 3/4), the SDK should call standard
`signPsbt` with a Cat21-built PSBT (see
`packages/bitcoin/src/transactions/generate-cat21-mint-transaction.ts`
and `generate-cat21-buy-offer-psbt.ts`) — these are pure builders, no
provider call needed; the SDK can produce the PSBT and ask the wallet to
sign it.

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

The trusted-build workflow in `.github/workflows/cat21:trusted-build.yml`
produces the attestation. A pass means GitHub's OIDC identity signed a
provenance saying this exact byte sequence came out of this exact commit
in this exact repository on a GitHub-hosted runner.

## Workspace cross-reference

- ordpool-sdk integration code: `ordpool-sdk/` in the workspace
- Cat21 Wallet plan: `CAT21-WALLET-FORK-PLAN.md` in the workspace
- This file: lives in the wallet repo because the wallet owns the contract
