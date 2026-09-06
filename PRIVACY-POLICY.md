# Cat21 Wallet — Privacy Policy

Effective: 2026-06-14

Cat21 Wallet is a Bitcoin-L1 browser-extension wallet for active CAT-21
cat trading. It is a fork of [Leather](https://github.com/leather-io/mono)
and follows the same minimum-data posture. This document is the canonical
statement of what data the extension touches, where it goes, and what it
does **not** do.

## Data Cat21 Wallet stores locally

All wallet data lives inside the Chrome extension's local storage on
your machine. It never leaves that storage except where you explicitly
sign and broadcast a transaction.

Stored locally:

- Your **encrypted seed phrase**. Encryption uses a password only you
  know. The unencrypted seed is never persisted.
- Your **derived addresses** (taproot, native segwit).
- Cached **cat21-ord query responses** (cat metadata, address inscription
  lists). Cached for performance; refreshed automatically.
- Your **agent-mode policy** (per-action cap, daily cap, fee-rate
  ceiling, floor price, counterparty allowlist).

## Data Cat21 Wallet sends to remote services

Cat21 Wallet connects to a small, fixed set of services. Each connection
is described below.

| Service | What we send | Why |
|---|---|---|
| **cat21-ord** (default `https://ord.cat21.space`) | Your bitcoin address(es) and UTXO outpoints, in plain GET requests | Look up which cats you own, classify UTXOs as cat-bearing |
| **Bitcoin mempool API** | Raw signed transactions for broadcast | Propagate your transactions to the network |
| **Marathon Slipstream** (`https://slipstream.mara.com`) | Raw signed transactions for direct-to-miner submission | Optional fallback for oversize/non-standard transactions |
| **Block explorers** (mempool.space, etc.) | Transaction IDs you request | Display confirmation status |

You can replace the default cat21-ord endpoint with your own
self-hosted instance in settings. No other service is contacted.

## What Cat21 Wallet does NOT do

- **No analytics.** No Mixpanel, no Segment, no Google Analytics. No
  click tracking, no error-reporting beacon. The audit of Xverse
  documented in the workspace headquarter informed this position.
- **No remote configuration.** The wallet never fetches feature flags
  from a server.
- **No third-party scripts.** The extension's CSP (Content-Security-
  Policy) is set to `script-src 'self' 'wasm-unsafe-eval'` so no remote
  JavaScript can execute inside the wallet.
- **No telemetry on agent-mode actions.** Autonomous trades are visible
  only to you and the on-chain network.
- **No marketing emails.** We have no way to reach you.

## Native Messaging Host / MCP integration

If you install the Cat21 Wallet MCP host
(`tools/src/mcp-host/`), the host runs as a local binary on your
machine. It bridges:

- the Chrome extension (over Chrome's Native Messaging stdio), and
- an MCP client like Claude Desktop or Cursor (over MCP JSON-RPC stdio).

The MCP host runs locally. It does not contact any remote service. It
is sandboxed at the Chrome layer by `allowed_origins` pinned to your
specific Cat21 Wallet extension ID. An MCP client connecting to the
host can only invoke the read-only tool surface in v1 (`list_cats`,
`wallet_status`, `cat21_ord_status`); the host cannot sign or
broadcast.

## Data sharing

We do not share any data with anyone. There is no operator-side data to
share — your wallet lives only on your machine.

## Open source

The Cat21 Wallet source is public at
`https://github.com/ordpool-space/cat21-wallet`. Every line of the
extension, the PSBT builders, the agent policy, and the MCP host is
inspectable. The security review at
[`SECURITY-REVIEW.md`](./SECURITY-REVIEW.md) walks the safety
invariants with file:line citations.

## Changes

If this policy materially changes, the change will be a commit in this
repository with a clearly-labeled commit message. Material changes
include: new remote services contacted, new data persisted, change to
the "no analytics" stance.

## Contact

Questions, concerns, security disclosures: open an issue at
`https://github.com/ordpool-space/cat21-wallet/issues`. For private
security disclosure, use GitHub's security advisory feature on that
repo so the issue is visible only to the maintainer.
