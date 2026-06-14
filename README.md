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

| Component | Path | Phase |
|---|---|---|
| Cat-bearing UTXO protection | `packages/services/src/utxos/utxos.service.ts` + `infrastructure/api/cat21-ord/` | 3.0 |
| CAT-21 mint PSBT builder | `packages/bitcoin/src/transactions/generate-cat21-mint-transaction.ts` | 3.2 |
| Mint broadcast dispatcher (mempool + Slipstream) | `packages/services/src/mint/cat21-broadcast.service.ts` | 3.3 |
| Buy-offer PSBT builder (ord-style) | `packages/bitcoin/src/transactions/generate-cat21-buy-offer-psbt.ts` | 4.1 |
| Offer validator (seller side) | `packages/bitcoin/src/transactions/validate-cat21-buy-offer.ts` | 4.2 |
| Agent-mode policy gate | `packages/services/src/agent-mode/agent-policy.service.ts` | 5 |
| MCP host (NMH bridge) | `tools/src/mcp-host/` | 6 |
| Mint + offer UI scaffolds | `apps/extension/src/app/pages/cat21-mint/`, `cat21-offer/` | 3.1 + 4 |

## License

[MIT](LICENSE). Original Leather code is © Leather Wallet LLC; CAT-21 specific additions are © ordpool-space contributors. All under MIT.
