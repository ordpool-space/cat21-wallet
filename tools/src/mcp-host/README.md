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

## Tool surface (v1)

Read-only:

- `list_cats` — cats held by the active Cat21 Wallet account.
- `wallet_status` — extension reachability.
- `cat21_ord_status` — forwarded `GET /status` from cat21-ord.

Mutating tools (mint / buy / sell-accept) wait until the agent-mode policy
gate (already in `@leather.io/services`) has a user-visible confirmation
path inside the extension. The transport here is ready for them; the UX
plumbing is not.
