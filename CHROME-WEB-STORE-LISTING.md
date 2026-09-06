# Chrome Web Store Listing — Cat21 Wallet

Reference copy + assets index for the eventual submission. Not all
fields below are required by the Chrome Web Store; included so future
maintainers can re-submit confidently.

## Title

Cat21 Wallet

## Short summary (132 chars max)

Hot wallet for active CAT-21 cat trading on Bitcoin L1. Open source.
Local-only. Mint, trade, agent-mode automation via MCP.

## Detailed description

Cat21 Wallet is a Bitcoin-L1-only browser-extension wallet built for
people who hold and trade CAT-21 cats. It is a fork of Leather Wallet,
hidden down to BTC + cats only, with three features Leather does not
have:

1. **ord-style buyer-initiated offers.** Sniping-proof by construction
   (every signature uses SIGHASH_ALL). Build an offer, paste it into
   whatever channel you use (Discord, Twitter DM, an ord-aware
   marketplace), accept incoming offers with a single click after a
   typed-error-key validator surfaces any structural problem.

2. **CAT-21 mint flow with the right invariants.** nLockTime=21 and
   sequence 0xfffffffe are runtime-asserted on every mint — a future
   refactor cannot accidentally ship a mint that gets accelerated and
   loses its nLockTime marker (the bug that killed cats in the 2024
   Xverse incident).

3. **MCP server via Chrome Native Messaging Host.** An agent (Claude
   Desktop, Cursor, custom) can list your cats and read indexer
   status today, and — once you opt in — mint, buy, and accept sell
   offers under a per-action policy you configure (max spend per tx,
   daily cap, fee-rate ceiling, floor price, counterparty allowlist).

What it is not:

- Not a Stacks wallet. Not a Lightning wallet. Not a Runes wallet.
  Stacks-specific code in the Leather fork is hidden, not deleted, so
  upstream merges stay clean.
- Not a hardware-wallet companion. Cat21 Wallet is a hot wallet by
  design. Hardware-wallet flows are incompatible with the agent-mode
  auto-confirm path. Hold your valuable cats elsewhere; transfer in
  when you want to trade, transfer out when done.

What it touches on the network:

- cat21-ord at https://ord.cat21.space (or your self-hosted instance)
- The Bitcoin mempool for tx broadcast
- Marathon Slipstream for oversize/non-standard txs (opt-in)
- That's it. No analytics. No remote config. No third-party scripts.

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
- `host_permissions: *://*/*` — the extension calls cat21-ord, the
  Bitcoin mempool, Marathon Slipstream, and third-party block
  explorers; the fork inherits the broad Leather scope. A future
  release narrows this to a fixed allowlist.

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
