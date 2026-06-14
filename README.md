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

## License

[MIT](LICENSE). Original Leather code is © Leather Wallet LLC; CAT-21 specific additions are © ordpool-space contributors. All under MIT.
