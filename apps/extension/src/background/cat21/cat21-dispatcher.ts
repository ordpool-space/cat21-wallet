/**
 * Bridges chrome.runtime + chrome.runtime.connectNative messages into
 * `Cat21RpcService` method calls. Two transports, one handler:
 *
 *   Path 2 — wallet popup UI sends an internal chrome.runtime.sendMessage
 *            of shape `{ type: 'cat21:<method>', intent, requestId }`.
 *            Transport is forced to `'popup'`; `mode: 'autonomous'` from
 *            the popup will be rejected by the mode resolver, surfacing
 *            as `'transport-not-trusted-for-autonomous'` denial.
 *
 *   Path 3 — MCP NMH host (tools/src/mcp-host) opens a Native Messaging
 *            port; we attach the listener at startup. Messages come in
 *            as `{ id, type: '<cat21_method>', payload: <intent> }`.
 *            Transport is forced to `'mcp-nmh'`. Replies go back as
 *            `{ id, type: '<cat21_method>:result', payload: Cat21RpcResult }`.
 *
 * Per CLAUDE.md HARD RULE #6, the dispatcher is the ONLY place that
 * surfaces `Cat21RpcService` outside the cat21/ directory. The browser
 * `window.Cat21Provider` provider never sees it. The architecture spec
 * enforces this by grepping for `Cat21RpcService` references in
 * `inpage/`, `content-scripts/`, and `packages/provider/`.
 */

import { Cat21Transport } from './mode-resolver';
import { Cat21RpcDeps, Cat21RpcService } from './cat21-rpc.service';
import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21RpcResult,
  Cat21TransferIntent,
} from './types';

/**
 * Native Messaging host name. Matches the manifest entry in
 * `tools/cat21-wallet-mcp-host.<platform>.json` and the
 * `chrome.runtime.connectNative` argument the wallet opens at startup.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
const CAT21_NMH_HOST_NAME = 'space.cat21.wallet';

/**
 * Shape of an inbound message from either transport. The internal
 * popup channel uses `requestId` (string); the NMH channel uses `id`
 * (string). The dispatcher normalises to `requestId`.
 */
export interface Cat21DispatcherMessage {
  type:
    | 'cat21_mint'
    | 'cat21_transfer'
    | 'cat21_create_offer'
    | 'cat21_accept_offer';
  requestId: string;
  intent: Cat21Intent;
}

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
interface Cat21DispatcherReply {
  type:
    | 'cat21_mint:result'
    | 'cat21_transfer:result'
    | 'cat21_create_offer:result'
    | 'cat21_accept_offer:result';
  requestId: string;
  result: Cat21RpcResult;
}

/**
 * Bridges inbound messages to `Cat21RpcService`. The dispatcher itself
 * stays transport-agnostic; the factory in `wire-cat21-dispatcher.ts`
 * (iter 10) attaches the chrome.runtime / connectNative listeners and
 * supplies the real `Cat21RpcDeps` from the wallet's Redux + keychain
 * + cat21-ord + ordpool-sdk wiring.
 */
export class Cat21Dispatcher {
  constructor(private readonly service: Cat21RpcService) {}

  /**
   * Routes a typed message to the right service method. Returns the
   * structured reply; the caller writes it back over the channel that
   * sent the message.
   */
  async handle(
    msg: Cat21DispatcherMessage,
    transport: Cat21Transport
  ): Promise<Cat21DispatcherReply> {
    let result: Cat21RpcResult;
    switch (msg.type) {
      case 'cat21_mint':
        result = await this.service.mint(msg.intent as Cat21MintIntent, transport);
        break;
      case 'cat21_transfer':
        result = await this.service.transfer(msg.intent as Cat21TransferIntent, transport);
        break;
      case 'cat21_create_offer':
        result = await this.service.createOffer(
          msg.intent as Cat21CreateOfferIntent,
          transport
        );
        break;
      case 'cat21_accept_offer':
        result = await this.service.acceptOffer(
          msg.intent as Cat21AcceptOfferIntent,
          transport
        );
        break;
      default: {
        const exhaustive: never = msg.type;
        throw new Error(`Cat21Dispatcher: unknown message type ${String(exhaustive)}`);
      }
    }
    return {
      type: `${msg.type}:result`,
      requestId: msg.requestId,
      result,
    };
  }
}

/**
 * Factory used by the background script entrypoint. The wallet's full
 * Redux + keychain + ordpool-sdk wiring (iter 10) supplies the `deps`
 * argument; until that lands, callers can construct the dispatcher with
 * a stubbed `Cat21RpcDeps` that returns denials for every call so the
 * surface exists (MCP `tools/list` succeeds) without enabling any
 * destructive path.
 */
export function createCat21Dispatcher(deps: Cat21RpcDeps): Cat21Dispatcher {
  return new Cat21Dispatcher(new Cat21RpcService(deps));
}

/**
 * Stub deps that reject every action with a "wiring-pending" denial.
 * The dispatcher is constructable AND callable even before iter 10
 * wires the real Redux/keychain backends — the MCP host's `tools/list`
 * works, but `tools/call` on any cat21_* method returns a typed denial.
 */
export function makeWiringPendingDeps(): Cat21RpcDeps {
  function rejectFn(label: string): never {
    throw new Error(`cat21-dispatcher: ${label} not yet wired (iter 10)`);
  }
  return {
    getAccountContext() {
      // Returns a placeholder so downstream invariants run; the actual
      // failure surfaces at pickFundingUtxo / resolveCatUtxo / sign,
      // bubbled up as a typed denial rather than an unhandled throw at
      // method entry.
      return {
        paymentAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        network: 'mainnet' as const,
      };
    },
    agentMode: { enabled: false },
    evaluateAgentPolicy() {
      return { allowed: false, reason: 'wiring-pending' };
    },
    pickFundingUtxo() {
      return rejectFn('pickFundingUtxo');
    },
    resolveCatUtxo() {
      return rejectFn('resolveCatUtxo');
    },
    confirmListingPublication() {
      return Promise.reject(new Error('confirmListingPublication: wiring pending'));
    },
    validateBuyOfferPsbt() {
      return { ok: false, reason: 'sighash-not-all', detail: 'wiring pending' };
    },
    signWithConfirmation() {
      return Promise.reject(new Error('signWithConfirmation: wiring pending'));
    },
    signSilently() {
      return Promise.reject(new Error('signSilently: wiring pending'));
    },
    broadcast() {
      return Promise.reject(new Error('broadcast: wiring pending'));
    },
    recordSpend() {
      // No-op until iter 10's Redux slice exists.
    },
  };
}
