/**
 * Wire format between the Cat21 Wallet NMH (this binary) and:
 *   - Chrome extension (over stdin/stdout, length-prefixed JSON)
 *   - MCP client (over stdin/stdout, MCP JSON-RPC framing)
 *
 * Per Phase 6, the NMH does two jobs at once:
 *   1. Speak NMH to Chrome: 4-byte little-endian length prefix + JSON body.
 *   2. Speak MCP JSON-RPC to clients: per the MCP spec.
 *
 * The MCP tool surface is read-only in v1:
 *   - `list_cats`        : query the extension for cats held in the active wallet.
 *   - `wallet_status`    : reachability + which account is active.
 *   - `cat21_ord_status` : forward the /status response from cat21-ord.
 *
 * Mutating tools (mint, buy, sell-accept) are deferred. They require the
 * agent-mode policy gate and a user-visible confirmation path inside the
 * extension, both of which sit on top of this transport layer.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface NmhMessage<T = unknown> {
  id: string;
  type: string;
  payload?: T;
}

/**
 * NMH framing: 4-byte little-endian length prefix, then UTF-8 JSON body.
 * Chrome enforces a 1 MB message ceiling host-side.
 */
export const NMH_MAX_MESSAGE_BYTES = 1_000_000;

export function encodeNmhMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  if (body.byteLength > NMH_MAX_MESSAGE_BYTES) {
    throw new Error(
      `NMH message exceeds Chrome limit: ${body.byteLength} > ${NMH_MAX_MESSAGE_BYTES}`
    );
  }
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.byteLength, 0);
  return Buffer.concat([header, body]);
}

/**
 * Streaming decoder. Call `feed(chunk)` repeatedly; it returns zero or more
 * complete messages. State carries between calls so partial frames don't
 * drop data.
 */
export class NmhMessageDecoder {
  private buffer = Buffer.alloc(0);

  public feed(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];
    while (this.buffer.byteLength >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length > NMH_MAX_MESSAGE_BYTES) {
        throw new Error(`NMH frame size ${length} exceeds limit`);
      }
      if (this.buffer.byteLength < 4 + length) break;
      const body = this.buffer.subarray(4, 4 + length);
      messages.push(JSON.parse(body.toString('utf8')));
      this.buffer = this.buffer.subarray(4 + length);
    }
    return messages;
  }
}

/**
 * MCP JSON-RPC subset we support. Full MCP transport spec is broader; this
 * is enough for `tools/list` and `tools/call`.
 */
export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: { code: number; message: string };
}

export const CAT21_MCP_TOOLS = [
  {
    name: 'list_cats',
    description: 'List cats held by the active Cat21 Wallet account.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'wallet_status',
    description: 'Report whether the Cat21 Wallet extension is reachable.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'cat21_ord_status',
    description:
      'Forward the GET /status response from the configured cat21-ord instance ' +
      '(default https://ord.cat21.space).',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;
