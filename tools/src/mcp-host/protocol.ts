/**
 * Wire format between the Cat21 Wallet NMH (this binary) and:
 *   - Chrome extension (over stdin/stdout, length-prefixed JSON)
 *   - MCP client (over stdin/stdout, MCP JSON-RPC framing)
 *
 * Per Phase 6, the NMH does two jobs at once:
 *   1. Speak NMH to Chrome: 4-byte little-endian length prefix + JSON body.
 *   2. Speak MCP JSON-RPC to clients: per the MCP spec.
 *
 * The MCP tool surface is split into read-only probes and mutating cat21_*
 * actions. The mutating actions translate into NMH messages that the
 * extension's background page dispatches to `Cat21RpcService`. The agent-
 * mode policy gate fires in the extension, not here — the host is just a
 * typed-tool front door.
 *
 *   - `list_cats`        : query the extension for cats held in the active wallet.
 *   - `wallet_status`    : reachability + which account is active.
 *   - `cat21_ord_status` : forward the /status response from cat21-ord.
 *   - `cat21_mint`         : mint a new cat with `nLockTime=21`.
 *   - `cat21_transfer`     : transfer an owned cat to a recipient address.
 *   - `cat21_create_offer` : publish a structured sell-listing.
 *   - `cat21_accept_offer` : sign + broadcast an inbound buy-offer PSBT.
 *   - `cat21_buy`          : bid on a listed cat (build + sign a buy-offer, post it).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// HACK -- Cat21: removed `export` keyword (MCP protocol type pre-wired
// for iter 10 wire-up; used internally so no @ts-expect-error needed).
// HARD RULE #5 — restore on wire-up.
interface NmhMessage<T = unknown> {
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
  {
    name: 'cat21_mint',
    description:
      'Mint a new cat. The wallet builds and signs a CAT-21 mint transaction ' +
      '(nLockTime=21). Returns { txid, channel } on success.',
    inputSchema: {
      type: 'object',
      required: ['recipient', 'feeRate'],
      properties: {
        recipient: { type: 'string', description: 'Address where the cat lands.' },
        feeRate: { type: 'number', description: 'Sat/vB.' },
        tip: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            value: { type: 'number' },
          },
        },
        mode: { type: 'string', enum: ['manual', 'autonomous'] },
      },
    },
  },
  {
    name: 'cat21_transfer',
    description:
      'Transfer an owned cat to a recipient. The wallet builds a transfer tx ' +
      'that preserves the cat on output 0. Returns { txid, channel } on success.',
    inputSchema: {
      type: 'object',
      required: ['catId', 'recipient', 'feeRate'],
      properties: {
        catId: { type: 'string', description: 'Cat id in <txid>i<index> form.' },
        recipient: { type: 'string' },
        feeRate: { type: 'number' },
        mode: { type: 'string', enum: ['manual', 'autonomous'] },
      },
    },
  },
  {
    name: 'cat21_create_offer',
    description:
      'Publish a structured sell-listing for an owned cat. Does NOT broadcast ' +
      'a tx; returns { catId, sellerUtxo, priceSats, paymentAddress } for the ' +
      'agent to forward to a marketplace.',
    inputSchema: {
      type: 'object',
      required: ['catId', 'priceSats', 'paymentAddress'],
      properties: {
        catId: { type: 'string' },
        priceSats: { type: 'number' },
        paymentAddress: { type: 'string' },
        mode: { type: 'string', enum: ['manual', 'autonomous'] },
      },
    },
  },
  {
    name: 'cat21_accept_offer',
    description:
      'Sign + broadcast an inbound buy-offer PSBT. The wallet validates the ' +
      'PSBT against expectedCatId / expectedPriceSats / expectedSellerUtxo, ' +
      'signs only input 0, and broadcasts. Returns { txid, channel } on success.',
    inputSchema: {
      type: 'object',
      required: ['offerPsbt', 'expectedCatId', 'expectedPriceSats', 'expectedSellerUtxo'],
      properties: {
        offerPsbt: { type: 'string', description: 'Hex or base64 PSBT bytes.' },
        expectedCatId: { type: 'string' },
        expectedPriceSats: { type: 'number' },
        expectedSellerUtxo: {
          type: 'object',
          required: ['txid', 'vout'],
          properties: {
            txid: { type: 'string' },
            vout: { type: 'number' },
          },
        },
        mode: { type: 'string', enum: ['manual', 'autonomous'] },
      },
    },
  },
  {
    name: 'cat21_buy',
    description:
      'Bid on a listed cat (BUYER side of the Bazaar). The wallet builds a ' +
      'buy-offer PSBT, funds it from the buyer wallet, signs only the buyer ' +
      'inputs (1..N), and POSTs the half-signed PSBT to the Bazaar as a bid. ' +
      'Does NOT broadcast — the seller accepts + broadcasts. Returns ' +
      '{ catNumber, bidSats, catTxid, catVout, psbtBase64 } on success.',
    inputSchema: {
      type: 'object',
      required: ['catId', 'catNumber', 'bidSats', 'sellerPaymentAddress', 'feeRate'],
      properties: {
        catId: { type: 'string', description: 'Cat id in <txid>i<index> form.' },
        catNumber: { type: 'number', description: 'Headline cat number.' },
        bidSats: { type: 'number', description: 'Net sats offered to the seller.' },
        sellerPaymentAddress: {
          type: 'string',
          description: "Seller's payout address, from the listing / ask link.",
        },
        feeRate: { type: 'number', description: 'Sat/vB.' },
        mode: { type: 'string', enum: ['manual', 'autonomous'] },
      },
    },
  },
] as const;

/**
 * Tool names the host dispatches to the extension's Cat21RpcService.
 * Read-only probes (list_cats, wallet_status, cat21_ord_status) stay
 * out of this list — they have local responses or query simpler state.
 */
export const CAT21_MUTATING_TOOLS = [
  'cat21_mint',
  'cat21_transfer',
  'cat21_create_offer',
  'cat21_accept_offer',
  'cat21_buy',
] as const;

export type Cat21MutatingTool = (typeof CAT21_MUTATING_TOOLS)[number];
