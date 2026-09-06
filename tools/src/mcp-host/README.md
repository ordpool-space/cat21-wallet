# Cat21 Wallet MCP Host

The Native Messaging Host (NMH) binary that bridges:

- the Cat21 Wallet Chrome extension (over Chrome's NMH stdio framing), and
- MCP clients (Claude Desktop, Cursor, custom) over MCP JSON-RPC.

## Install (macOS / Linux)

1. Build the binary:

   ```sh
   pnpm --filter @leather.io/tools build
   chmod +x dist/mcp-host/host.js
   ```

2. Copy the manifest template, fill it in:

   ```sh
   cp src/mcp-host/native-manifests/cat21-wallet.mac-linux.json.template \
     ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/space.cat21.wallet.json
   # Linux: ~/.config/google-chrome/NativeMessagingHosts/space.cat21.wallet.json
   ```

3. Edit the copied file:
   - `path`: absolute path to the built `dist/mcp-host/host.js` (must be
     executable; add a shebang or wrap in a shell script).
   - `allowed_origins`: replace `REPLACE_ME_EXTENSION_ID` with the
     deterministic Cat21 Wallet extension ID (`nbooeiaddbkoiekkahgekialhahgpboe`
     for the dev key pinned in `apps/extension/scripts/generate-manifest.js`).

## Install (Windows)

Windows uses a registry key per
[Chrome NMH docs](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-location).
Template manifest is the same JSON, just at a Windows path. Not packaged in
v1; pull-request welcome.

## Use as a pure MCP server (no extension)

For testing or when the wallet is not the data source you can run the host
in MCP-stdin-direct mode:

```sh
MCP_STDIN_DIRECT=1 node dist/mcp-host/host.js
```

Only `wallet_status` will report sensibly (says `extensionConnected: false`).
The cat-data tools degrade gracefully.

## Tool surface

**Read-only probes** — answered inline by the extension background, no
popup involvement, no keychain access:

- `list_cats` — cats held by the active Cat21 Wallet account.
- `wallet_status` — `{ network, accountId, agentMode.enabled }`.
- `cat21_ord_status` — forwarded `GET /status` from cat21-ord.

**Mutating actions** — route through the popup-side `Cat21RpcService`
via the iter-12 NMH ⇄ popup bridge in
`apps/extension/src/background/cat21/attach-native-host-to-popup-relay.ts`.
The agent never touches the keychain directly; the popup is the
trusted boundary that signs.

- `cat21_mint(recipient, feeRate, tip?, mode?)`
- `cat21_transfer(catId, recipient, feeRate, mode?)`
- `cat21_create_offer(catId, priceSats, paymentAddress, mode?)`
- `cat21_accept_offer(offerPsbt, expectedCatId, expectedPriceSats, expectedSellerUtxo, mode?)`

Each mutating call returns one of:

- `{ ok: true, value: { kind: 'broadcast', txid, channel } }`
  (`channel: 'mempool' | 'slipstream'`)
- `{ ok: true, value: { kind: 'listing', listing: { … } } }` — only
  for `cat21_create_offer`; no Bitcoin tx is broadcast, the listing is
  data the agent forwards to a marketplace.
- `{ ok: false, value: { reason, detail? } }` where `reason` is one of:
  `intent-shape-invalid`, `intent-invariant-violated`, `agent-disabled`,
  `policy-denied`, `transport-not-trusted-for-autonomous`,
  `inbound-offer-mismatch`, `broadcast-failed`.

`mode: 'autonomous'` is honored only when ALL three guards pass: (a)
the call arrived over NMH, (b) the active account has agent-mode
enabled, and (c) the SDK's agent-policy gate accepts the intent.
Any guard miss surfaces as a typed denial — never a silent downgrade
to manual.

## Per-call timeout

Mutating calls have a per-call ceiling of 60 s (manual mode may show
a confirmation dialog the user has to click). Override with
`CAT21_MCP_TIMEOUT_MS` if you're driving the wallet from automation
that needs a longer window.

## Connection lifecycle

The wallet-side NMH connection is managed by
`createNmhLifecycle` in
`apps/extension/src/background/cat21/nmh-connection-lifecycle.ts`:

- idempotent connect (re-installing the agent surface is a no-op
  when a port is alive)
- exponential backoff reconnect on disconnect (1 s, 2 s, 4 s, ...
  capped at 60 s); successful reconnect resets the budget
- install-detection heuristic: if the port disconnects within 250 ms
  of the connect call, the harness assumes the host binary isn't
  installed and stops reconnecting (the wallet's Settings UI offers
  a manual install walkthrough; explicit user re-triggers restart
  the lifecycle).
