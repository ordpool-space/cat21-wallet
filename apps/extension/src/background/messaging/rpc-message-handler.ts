import {
  RpcEndpointMap,
  RpcErrorCode,
  type RpcRequests,
  createRpcErrorResponse,
} from '@leather.io/rpc';

import { logger } from '@shared/logger';

import { getAddressesHandler } from './rpc-methods/get-addresses';
/* HACK -- Cat21: stxGetAddressesHandler import dropped per ADR-1 + ADR-7 hide non-BTC-L1.
 * Original: `import { getAddressesHandler, stxGetAddressesHandler } from './rpc-methods/get-addresses';` */
import { openHandler } from './rpc-methods/open';
import { openSwapHandler } from './rpc-methods/open-swap';
import { sendTransferHandler } from './rpc-methods/send-transfer';
import { signMessageHandler } from './rpc-methods/sign-message';
import { signPsbtHandler } from './rpc-methods/sign-psbt';
/* HACK -- Cat21: Stacks RPC handler imports dropped per ADR-1 + ADR-7. Source files
 * remain in ./rpc-methods/ for upstream-merge sanity; only the imports + registrations
 * are removed. Methods reaching the message handler will return METHOD_NOT_FOUND.
 * import { stxSignMessageHandler, stxSignStructuredMessageHandler } from './rpc-methods/sign-stacks-message';
 * import { stxCallContractHandler } from './rpc-methods/stx-call-contract';
 * import { stxDeployContractHandler } from './rpc-methods/stx-deploy-contract';
 * import { stxSignTransactionHandler } from './rpc-methods/stx-sign-transaction';
 * import { stxTransferSip9NftHandler } from './rpc-methods/stx-transfer-sip9-nft';
 * import { stxTransferSip10FtHandler } from './rpc-methods/stx-transfer-sip10-ft';
 * import { stxTransferStxHandler } from './rpc-methods/stx-transfer-stx'; */
import { supportedMethodsHandler } from './rpc-methods/supported-methods';
import { getTabIdFromPort, listenForOriginTabClose } from './rpc-request-utils';

type RpcHandler<T> = (request: T, port: chrome.runtime.Port) => Promise<void> | void;

type RpcHandlers = {
  [Method in keyof RpcEndpointMap]: RpcHandler<RpcEndpointMap[Method]['request']>;
};

const rpcHandlers: Partial<RpcHandlers> = {};

function registerRpcRequestHandler<M extends RpcRequests['method']>(
  method: M,
  handler: RpcHandler<RpcEndpointMap[M]['request']>
) {
  rpcHandlers[method] = handler;
}

export function defineRpcRequestHandler<M extends RpcRequests['method']>(
  method: M,
  handler: RpcHandler<RpcEndpointMap[M]['request']>
) {
  return [method, handler] as const;
}

export async function rpcMessageHandler(request: RpcRequests, port: chrome.runtime.Port) {
  listenForOriginTabClose({ tabId: port.sender?.tab?.id });

  // HACK -- Cat21: log only the method name, not the full request payload.
  // Audit H3: the original `logger.info(..., request)` shipped PSBT bytes,
  // recipient addresses, and sign-message payloads into the
  // chrome.storage.local logger ring buffer (2000 entries) and out via
  // `copyLogsToClipboard()`. Method name alone is enough for debugging
  // dispatcher routing; payload-level inspection happens in the handler.
  logger.info(`Received RPC request ${request.method}`);

  // This typecast safely bypasses the compiler since it cannot infer or narrow
  // the type to know the `request` being passed to `handler` is the correct
  // one. Type safety is guaranteed by `registerRpcRequestHandler`
  const handler = rpcHandlers[request.method] as RpcHandler<any>;

  if (handler) return await handler(request, port);

  void chrome.tabs.sendMessage(
    getTabIdFromPort(port),
    createRpcErrorResponse(request.method, {
      id: request.id,
      error: {
        code: RpcErrorCode.METHOD_NOT_FOUND,
        message: `"${request.method}" is not supported. Try running \`.request('supportedMethods')\` to see what Cat21 Wallet can do.`,
      },
    })
  );
}

registerRpcRequestHandler(...getAddressesHandler);
registerRpcRequestHandler(...openHandler);
registerRpcRequestHandler(...openSwapHandler);
registerRpcRequestHandler(...sendTransferHandler);
registerRpcRequestHandler(...signMessageHandler);
registerRpcRequestHandler(...signPsbtHandler);
/* HACK -- Cat21: Stacks RPC handler registrations dropped per ADR-1 + ADR-7. The
 * imports above are also commented out; both must move together. If upstream adds a
 * new stx* method, this block conflicts on merge — that's intentional, the resolver
 * leaves the new handler unregistered.
 * registerRpcRequestHandler(...stxCallContractHandler);
 * registerRpcRequestHandler(...stxDeployContractHandler);
 * registerRpcRequestHandler(...stxGetAddressesHandler);
 * registerRpcRequestHandler(...stxSignMessageHandler);
 * registerRpcRequestHandler(...stxSignStructuredMessageHandler);
 * registerRpcRequestHandler(...stxSignTransactionHandler);
 * registerRpcRequestHandler(...stxTransferSip9NftHandler);
 * registerRpcRequestHandler(...stxTransferSip10FtHandler);
 * registerRpcRequestHandler(...stxTransferStxHandler); */
registerRpcRequestHandler(...supportedMethodsHandler);
