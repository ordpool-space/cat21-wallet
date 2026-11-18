# CAT-21 wallet — Privacy Policy

Effective: 2026-11-18

CAT-21 wallet is a Bitcoin-L1 browser-extension wallet for active CAT-21
cat trading. It is a fork of [Leather](https://github.com/leather-io/mono)
and follows the same minimum-data posture. This document is the canonical
statement of what data the extension touches, where it goes, and what it
does **not** do.

## Data CAT-21 wallet stores locally

All wallet data lives inside the Chrome extension's local storage on
your machine. Your seed phrase and private keys never leave it. Your
addresses, your account's extended-public-key descriptor and the
transactions you sign are sent to the services listed in the next
section, for the purposes given there.

Stored locally:

- Your **encrypted seed phrase**. Encryption uses a password only you
  know. The unencrypted seed is never persisted.
- Your **derived addresses** (taproot, native segwit).
- Cached **cat21-ord query responses** (cat metadata, address inscription
  lists). Cached for performance; refreshed automatically.
- Your **agent-mode policy** (per-action cap, daily cap, fee-rate
  ceiling, floor price, counterparty allowlist).

## Data CAT-21 wallet sends to remote services

CAT-21 wallet is a fork of Leather and still uses part of Leather's
infrastructure. In normal use it contacts the services below. Every
request also reveals your IP address and the time of the request to the
service that receives it.

| Service                                                                                       | What it receives                                                                                                                                                                                                                                                | Why                                                                                                                   |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **cat21-ord** (`https://ord.cat21.space`, run by the CAT-21 project)                          | Your bitcoin addresses, UTXO outpoints and cat ids, in plain GET requests                                                                                                                                                                                       | Look up which cats you own and which of your coins carry a cat                                                        |
| **ord** (`https://ord.ordpool.space`, run by the CAT-21 project)                              | The outpoints of the coins that would pay for an action, and the names of runes shown in a funding notice                                                                                                                                                       | Check a funding coin for inscriptions, runes and rare sats before it is spent; link a rune to its etching transaction |
| **CAT-21 Bazaar** (`https://backend2.cat21.space`, run by the CAT-21 project)                 | When you list a cat or place a bid: the cat's outpoint, the price, your payment and ordinals addresses, the signed offer, and a sign-in token that proves you control your ordinals address                                                                     | Publish your listings and bids                                                                                        |
| **Leather API** (`https://api.leather.io`, run by Leather)                                    | On mainnet and testnet: your account's extended-public-key descriptor, from which every address of the account can be derived, plus an `X-Client-ID` header carrying a random identifier that is created anew each time the wallet's background or popup starts | Balances, UTXOs and transaction history; fee rates and prices                                                         |
| **Leather's mempool instance** (`https://leather.mempool.space`, run by Leather)              | Signed transactions you broadcast, transaction lookups, and price requests                                                                                                                                                                                      | Broadcast your transactions; show transaction status and the BTC price                                                |
| **Marathon Slipstream** (`https://slipstream.mara.com`)                                       | Signed CAT-21 transactions too large for standard relay; the wallet routes them here by size                                                                                                                                                                    | Submit oversize transactions directly to a miner                                                                      |
| **GitHub** (`https://raw.githubusercontent.com/leather-io/extension`, production builds only) | A request for Leather's public wallet configuration                                                                                                                                                                                                             | Leather controls settings of the wallet through this file, see below                                                  |

Features inherited from Leather that CAT-21 wallet does not change (for
example Stacks, swaps, sBTC and buying bitcoin through Onramper) contact
their own providers, such as `https://api.hiro.so`, when they run.

The service endpoints are fixed in the wallet; there is no setting to
point the wallet at your own instance of any of them.

## What CAT-21 wallet does NOT do

- **No analytics.** No Mixpanel, no Segment, no Google Analytics. No
  click tracking, no error-reporting beacon. The audit of Xverse
  documented in the workspace headquarter informed this position.
- **No third-party scripts.** The extension's CSP (Content-Security-
  Policy) is set to `script-src 'self' 'wasm-unsafe-eval'` so no remote
  JavaScript can execute inside the wallet.
- **No telemetry on agent-mode actions.** Autonomous trades are visible
  only to you, the on-chain network and, for listings and bids, the
  CAT-21 Bazaar.
- **No marketing emails.** We have no way to reach you.

## Remote configuration from Leather

Production builds fetch Leather's public wallet configuration from
GitHub (`config/wallet-config.json` in the `leather-io/extension`
repository) and refresh it at most every ten minutes. GitHub sees your
IP address and the time of each request. Through this file Leather
controls settings of the wallet, among them whether bitcoin sending is
enabled (`bitcoinSendEnabled`), the sBTC settings, promotional banners
and in-app messages. The file carries no data about you; it is the same
for every user.

## Native Messaging Host / MCP integration

If you install the CAT-21 wallet MCP host
(`tools/src/mcp-host/`), the host runs as a local binary on your
machine. It bridges:

- the Chrome extension (over Chrome's Native Messaging stdio), and
- an MCP client like Claude Desktop or Cursor (over MCP JSON-RPC stdio).

The MCP host runs locally. It does not contact any remote service. It
is sandboxed at the Chrome layer by `allowed_origins` pinned to your
specific CAT-21 wallet extension ID. An MCP client connecting to the
host can invoke both the read-only probes (`list_cats`, `wallet_status`,
`cat21_ord_status`) and the mutating cat actions (`cat21_mint`,
`cat21_transfer`, `cat21_create_offer`, `cat21_accept_offer`,
`cat21_buy`). A mutating action signs and broadcasts only after you
approve it in the wallet's confirmation popup, or silently within the
per-account policy limits you configure when autonomous agent mode is
enabled; it can never act while the wallet is locked.

## Data sharing

Apart from what the services listed above receive, no data leaves your
machine. Your wallet itself lives only on your machine.

## Open source

The CAT-21 wallet source is public at
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
