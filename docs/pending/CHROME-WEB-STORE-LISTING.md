# Chrome Web Store Listing — CAT-21 wallet

Reference copy + assets index for the eventual submission. Not all
fields below are required by the Chrome Web Store; included so future
maintainers can re-submit confidently.

## Title

CAT-21 wallet

## Short summary (132 chars max)

Hot wallet for active CAT-21 cat trading on Bitcoin L1. Open source.
Keys stay local. Mint, trade, agent-mode automation via MCP.

## Detailed description

CAT-21 wallet is a Bitcoin-L1-only browser-extension wallet built for
people who hold and trade CAT-21 cats. It is a fork of Leather Wallet,
hidden down to BTC + cats only, with three features Leather does not
have:

1. **ord-style buyer-initiated offers.** Sniping-proof by construction
   (every signature uses SIGHASH_ALL). Build an offer, paste it into
   whatever channel you use (Discord, Twitter DM, an ord-aware
   marketplace), accept incoming offers with a single click after a
   typed-error-key validator surfaces any structural problem.

2. **CAT-21 mint flow with the right invariants.** nLockTime=21 is
   runtime-asserted on every transaction the wallet builds, and the
   wallet's own fee bump keeps it, so a mint you speed up stays a cat. A
   wallet that "accelerates" a mint and drops nLockTime=21 loses the cat;
   that is what killed cats in the 2024 Xverse incident.

3. **MCP server via Chrome Native Messaging Host.** An agent (Claude
   Desktop, Cursor, custom) can list your cats and read wallet and
   indexer status, and mint, transfer, list, buy and accept offers.
   Each of those waits for your approval in the wallet, or runs without
   a prompt only when you enable agent mode, within a per-account
   policy you configure (max spend per action, daily cap, fee-rate
   ceiling, floor price, counterparty allowlist).

What it is not:

- Not a Stacks wallet. Not a Lightning wallet. Not a Runes wallet.
  Stacks-specific code in the Leather fork is hidden, not deleted, so
  upstream merges stay clean.
- Not a hardware-wallet companion. CAT-21 wallet is a hot wallet by
  design. Hardware-wallet flows are incompatible with the agent-mode
  auto-confirm path. Hold your valuable cats elsewhere; transfer in
  when you want to trade, transfer out when done.

What it touches on the network:

- cat21-ord at https://ord.cat21.space and ord at https://ord.ordpool.space
  (both run by the CAT-21 project) for your cats and for checking a
  funding coin for assets before it is spent
- The CAT-21 Bazaar at https://backend2.cat21.space when you list a cat
  or bid
- Leather's API at https://api.leather.io: on mainnet and testnet it
  receives your account's extended-public-key descriptor (all addresses
  of the account) for balances and transaction history, plus a random
  per-start client id
- Leather's mempool instance at https://leather.mempool.space for
  broadcast and transaction status
- Marathon Slipstream for CAT-21 transactions too large for standard
  relay (routed there by size)
- In production builds, Leather's public wallet configuration from
  GitHub (raw.githubusercontent.com/leather-io/extension), through which
  Leather controls settings such as bitcoin sending, banners and in-app
  messages
- No analytics. No third-party scripts.

Read the privacy policy in this repo (PRIVACY-POLICY.md) and the
security review (SECURITY-REVIEW.md) before using.

## Category

Productivity → Workflow & Planning (closest match — there is no
"Bitcoin wallet" category on the Chrome Web Store)

## Language

English

## Permissions justification

When the Chrome Web Store reviewer asks "why do you need each
permission?":

- `contextMenus` — wallet right-click menu (inherited from Leather)
- `storage` + `unlimitedStorage` — encrypted wallet state and cached
  cat21-ord query responses
- `notifications` — alert the user on cat-received events
- `nativeMessaging` — bridge to the optional MCP host binary for
  Claude Desktop / Cursor integration. Allowed_origins on the host
  manifest pins our extension ID; no other extension can reach the host.
- `host_permissions`: a fixed list (see
  `apps/extension/scripts/generate-manifest.js`): the CAT-21 project's
  cat21-ord, ord and Bazaar hosts, the Bitcoin mempool APIs, Marathon
  Slipstream, the Leather and Hiro APIs the fork still uses, and
  localhost for dapp development.

## Assets to upload

- Icon 128×128: `apps/extension/public/assets/icons/cat21-icon-128.png`
- Icon 256×256: same path with `-256`
- Icon 512×512: same path with `-512`
- Marquee promo 1400×560: TODO (Phase 8 polish)
- Screenshots 1280×800: TODO (cat asset view, mint page, offer page,
  agent-mode policy form)

## Support email

`johannes@haushoppe.art`

## Privacy policy URL

Will be `https://github.com/ordpool-space/cat21-wallet/blob/main/PRIVACY-POLICY.md`
once the repo is public-readable.

## Single purpose

"A hot wallet for trading CAT-21 cats on Bitcoin L1, with optional
agent-mode automation via a local Native Messaging Host."

## Account control

Single maintainer initially: hans-crypto. The plan grows the
maintainer set as needed.
