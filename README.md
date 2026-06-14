# Cat21 Wallet

> Hot wallet for active CAT-21 cat trading. Bitcoin L1 mainnet only.

Cat21 Wallet is a fork of [Leather](https://github.com/leather-io/mono) that has been hidden-down to BTC L1 only and rebranded around the CAT-21 protocol. It mints cats, accepts ord-style buyer-initiated offers in both directions, and exposes an MCP server so AI agents can autonomously trade cats within user-configured policy.

This is a hot wallet, not a vault. Valuable cats stay in your existing wallet (Xverse, hardware wallet, multisig). Transfer cats into Cat21 Wallet when you want to trade them; transfer them back to cold storage when you are done.

## Lineage

Cat21 Wallet is a non-fork clone of [`leather-io/mono`](https://github.com/leather-io/mono) at `a6460b4d` (the parent of [PR #2358](https://github.com/leather-io/mono/pull/2358), the last upstream commit where the inscription stack was alive). Upstream sync is via the `upstream` remote on a quarterly cadence. Original Leather commits retain their original authors; the rebranding and CAT-21 additions are authored under hans-crypto.

The plan that drives this fork lives in the workspace at [`CAT21-WALLET-FORK-PLAN.md`](https://github.com/ordpool-space/headquarter). See ADR-14 for the repo setup that keeps this repo independent of upstream Leather on GitHub's fork graph.

## Installation

1. `pnpm i` at the `mono` root
2. Run `pnpm build`

See `CLAUDE.md` for the upstream Leather developer guide; the workflow conventions (Conventional Commits, verification pipeline, Code style) apply to this fork as well per ADR-11.

## Safety surface

- [`SECURITY-REVIEW.md`](./SECURITY-REVIEW.md) — Phase 7 audit walking each
  invariant (nLockTime=21 scope, sequence guards, SIGHASH_ALL coverage,
  agent-policy unbypassability, NMH origin pinning) with file:line citations.
- [`PRIVACY-POLICY.md`](./PRIVACY-POLICY.md) — what data the wallet stores,
  what it sends, and what it does not do.
- [`CHROME-WEB-STORE-LISTING.md`](./CHROME-WEB-STORE-LISTING.md) — store
  listing copy + permissions justification.

## Components and where they live

| Component | Path | What it does |
|---|---|---|
| Cat asset display | `packages/services/src/collectibles/cat21-asset.service.ts` | Pulls cats held by the active account from cat21-ord, surfaces them in the collectibles UI |
| cat21-ord client | `packages/services/src/infrastructure/api/cat21-ord/` | Zod-validated HTTP client for /cat, /address, /output, /status |
| Cat-bearing UTXO protection | `packages/services/src/utxos/utxos.service.ts` | Per-output cat21-ord probe routes cat-holding UTXOs into the `protected` bucket so the BTC send flow cannot pick them |
| nLockTime preservation through RBF | `apps/extension/src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts` | When the user replaces a tx via increase-fee, the original locktime is copied verbatim; hard assert refuses to sign if it diverges |
| Polite window providers | `packages/provider/src/index.ts` + `add-leather-to-providers.ts` | `window.Cat21Provider` always; `window.LeatherProvider` only when real Leather is not installed |
| MCP host (NMH bridge) | `tools/src/mcp-host/` | Read-only tool surface (list_cats, wallet_status, cat21_ord_status) over Chrome NMH |

Code that used to live here and moved to `ordpool-sdk` per the
2026-06-14 scope cut:

| What | Now in ordpool-sdk |
|---|---|
| Cat21 mint PSBT builder | `src/cat21-mint/cat21.service.helper.ts` (`createInput`, `createTransaction`) |
| Buy-offer PSBT builder | `src/cat21-offer/cat21-offer.helper.ts` (`buildCat21BuyOfferPsbt`) |
| Offer validator (seller-side) | `src/cat21-offer/cat21-offer.helper.ts` (`validateCat21BuyOfferPsbt`) |
| Agent-mode policy gate | `src/agent-mode/agent-policy.helper.ts` (`evaluateAgentPolicy`) |
| Broadcast dispatcher | `src/cat21-broadcast/broadcast.helper.ts` (`broadcastCat21`, `decideBroadcastChannel`) |
| Slipstream client | `src/cat21-broadcast/slipstream.helper.ts` (`submitToSlipstream`) |

See `INTEGRATION-ORDPOOL-SDK.md` for the contract dapps and the SDK
should code against, including the layered-security model that defines
which validation step belongs where.

## License

[MIT](LICENSE). Original Leather code is © Leather Wallet LLC; CAT-21 specific additions are © ordpool-space contributors. All under MIT.
