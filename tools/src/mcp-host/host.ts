#!/usr/bin/env node
/**
 * Cat21 Wallet Native Messaging Host.
 *
 * Chrome spawns this binary when the extension calls
 * `chrome.runtime.connectNative('space.cat21.wallet')`. Chrome writes
 * length-prefixed JSON over our stdin and reads the same framing on stdout.
 *
 * MCP clients (Claude Desktop, Cursor, custom) connect to *this same binary*
 * over stdio using MCP JSON-RPC. We multiplex: one side is the extension
 * (NMH framing), the other side is the MCP client (JSON-RPC).
 *
 * v1 tool surface is read-only (see CAT21_MCP_TOOLS in protocol.ts).
 * Mutating tools wait until the agent-mode policy gate has a UX path.
 *
 * Auth: the NMH manifest pins our extension ID, so only Chrome processes
 * running the Cat21 Wallet extension can connect over NMH. Any other
 * spawned instance is treated as a pure MCP server (no extension peer)
 * and the cat-data tools return "extension not connected".
 */
/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import {
  CAT21_MCP_TOOLS,
  CAT21_MUTATING_TOOLS,
  Cat21MutatingTool,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  NmhMessageDecoder,
  encodeNmhMessage,
} from './protocol.js';

const decoder = new NmhMessageDecoder();
/** Most-recent payloads pushed by the extension, keyed by message type. */
const extensionState = new Map<string, unknown>();
let extensionConnected = false;

/**
 * Pending mutating-tool requests, keyed by correlation id. The host writes
 * an NMH message with `id` matching the MCP request id; the extension
 * replies with `{ type: '<tool>:result', id, payload: Cat21RpcResult }`
 * and we resolve the pending promise. Stale entries are cleared by the
 * timeout below.
 */
const pendingMutations = new Map<
  string,
  { resolve: (payload: unknown) => void; timer: NodeJS.Timeout }
>();

/**
 * Per-call ceiling for mutating-tool round-trips. The wallet may pop a
 * confirmation dialog before signing (manual mode), so the user has to
 * click in time. 60 s default; override with CAT21_MCP_TIMEOUT_MS.
 */
const MUTATION_TIMEOUT_MS = (() => {
  const raw = process.env.CAT21_MCP_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 60_000;
})();

/* ------------------------------ NMH side ------------------------------ */

process.stdin.on('data', (chunk: Buffer) => {
  try {
    const messages = decoder.feed(chunk);
    for (const msg of messages) {
      handleExtensionMessage(msg);
    }
  } catch (err) {
    log(`NMH decode error: ${String(err)}`);
  }
});

function sendToExtension(message: unknown) {
  process.stdout.write(encodeNmhMessage(message));
}

function handleExtensionMessage(msg: unknown) {
  if (typeof msg !== 'object' || msg === null) return;
  const m = msg as { type?: string; id?: string; payload?: unknown };
  if (!m.type) return;
  extensionConnected = true;
  if (m.type === 'hello') {
    sendToExtension({ type: 'ack', payload: { mcpReady: true } });
    return;
  }
  // Mutating-tool reply: '<tool>:result' with the same id we sent. Resolve
  // the pending promise so handleMutatingToolCall can return.
  if (typeof m.id === 'string' && m.type.endsWith(':result')) {
    const pending = pendingMutations.get(m.id);
    if (pending) {
      clearTimeout(pending.timer);
      pendingMutations.delete(m.id);
      pending.resolve(m.payload);
      return;
    }
  }
  extensionState.set(m.type, m.payload);
}

/* ------------------------------ MCP side ------------------------------ */

/**
 * MCP clients live on a separate fd in production setups. When stdin is
 * Chrome's NMH side, MCP clients connect over `chrome.runtime.sendMessage`-
 * proxied calls. For local dev (claude.desktop standalone), the same binary
 * can be run with `MCP_STDIN_DIRECT=1` to skip the NMH decoder and consume
 * stdin as MCP JSON-RPC directly.
 */
async function handleMcpRequest(req: McpJsonRpcRequest): Promise<McpJsonRpcResponse> {
  if (req.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: { tools: CAT21_MCP_TOOLS },
    };
  }
  if (req.method === 'tools/call') {
    const name = req.params?.name as string | undefined;
    if (!name) {
      return jsonRpcError(req.id, -32602, 'tools/call missing name');
    }
    return handleToolCall(req.id, name, (req.params?.arguments ?? {}) as Record<string, unknown>);
  }
  return jsonRpcError(req.id, -32601, `unknown method ${req.method}`);
}

async function handleToolCall(
  id: number | string,
  name: string,
  _args: Record<string, unknown>
): Promise<McpJsonRpcResponse> {
  if (name === 'wallet_status') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ extensionConnected }),
          },
        ],
      },
    };
  }
  if (name === 'list_cats') {
    if (!extensionConnected) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: '[]' }],
          isError: false,
        },
      };
    }
    sendToExtension({ id, type: 'list_cats' });
    const cats = extensionState.get('list_cats:result') ?? [];
    return {
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: JSON.stringify(cats) }] },
    };
  }
  if (name === 'cat21_ord_status') {
    if (!extensionConnected) {
      return jsonRpcError(id, -32603, 'extension not connected');
    }
    sendToExtension({ id, type: 'cat21_ord_status' });
    const status = extensionState.get('cat21_ord_status:result');
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          { type: 'text', text: JSON.stringify(status ?? { reachable: false }) },
        ],
      },
    };
  }
  if ((CAT21_MUTATING_TOOLS as readonly string[]).includes(name)) {
    return handleMutatingToolCall(id, name as Cat21MutatingTool, _args);
  }
  return jsonRpcError(id, -32601, `unknown tool ${name}`);
}

/**
 * Translate a cat21_* MCP tool call into an NMH message for the extension,
 * await the typed Cat21RpcResult, and surface it back to the MCP client.
 *
 * The extension's background dispatcher (iter 9) takes the NMH message,
 * routes the typed intent through Cat21RpcService (Path 3 — mcp-nmh
 * transport, autonomous mode honored), and replies with `{ type:
 * '<tool>:result', id, payload: Cat21RpcResult }`.
 */
async function handleMutatingToolCall(
  id: number | string,
  name: Cat21MutatingTool,
  args: Record<string, unknown>
): Promise<McpJsonRpcResponse> {
  if (!extensionConnected) {
    return jsonRpcError(id, -32603, 'extension not connected');
  }

  // Correlation id is always a string on the wire (NMH JSON.parse round-
  // trips numbers as numbers, but the pendingMutations key uses string).
  const corrId = String(id);

  const rpcResult = await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingMutations.delete(corrId);
      reject(new Error(`${name} timed out after ${MUTATION_TIMEOUT_MS}ms`));
    }, MUTATION_TIMEOUT_MS);
    pendingMutations.set(corrId, { resolve, timer });
    sendToExtension({ id: corrId, type: name, payload: args });
  }).catch(err => ({ ok: false, value: { reason: 'broadcast-failed', detail: String(err) } }));

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: JSON.stringify(rpcResult) }],
    },
  };
}

function jsonRpcError(id: number | string, code: number, message: string): McpJsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function log(line: string) {
  // stderr because stdout is reserved for NMH/MCP wire traffic.
  process.stderr.write(`[cat21-wallet-mcp-host] ${line}\n`);
}

/* ------------------------------ Entrypoint ------------------------------ */

if (process.env.MCP_STDIN_DIRECT === '1') {
  let buffer = '';
  process.stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line) as McpJsonRpcRequest;
        void handleMcpRequest(req).then(
          res => process.stdout.write(`${JSON.stringify(res)}\n`),
          err => log(`MCP handler error: ${String(err)}`)
        );
      } catch (err) {
        log(`MCP parse error: ${String(err)}`);
      }
    }
  });
  log('MCP stdin-direct mode active');
} else {
  log('NMH mode active, awaiting Chrome extension connection');
}

export { handleMcpRequest, handleExtensionMessage };
