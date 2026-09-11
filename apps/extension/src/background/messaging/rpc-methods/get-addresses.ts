import { type RpcRequest, encodeBase64Json, getAddresses, stxGetAddresses } from '@leather.io/rpc';

import { RouteUrls } from '@shared/route-urls';

import { trackRpcRequestSuccess } from '../rpc-helpers';
import { defineRpcRequestHandler } from '../rpc-message-handler';
import {
  createConnectingAppMetadataSearchParams,
  sendErrorResponseOnUserPopupClose,
  triggerRequestPopupWindowOpen,
} from '../rpc-request-utils';

async function sharedGetAddressesHandler(
  request: RpcRequest<typeof getAddresses> | RpcRequest<typeof stxGetAddresses>,
  port: chrome.runtime.Port
) {
  const { urlParams, tabId } = createConnectingAppMetadataSearchParams(port, [
    ['requestId', request.id],
    ['rpcRequest', encodeBase64Json(request)],
  ]);

  if (request.params && request.params.network) {
    urlParams.append('network', request.params.network);
  }

  const { id } = await triggerRequestPopupWindowOpen(RouteUrls.RpcGetAddresses, urlParams);
  void trackRpcRequestSuccess({ endpoint: request.method });

  sendErrorResponseOnUserPopupClose({ tabId, id, request });
}

export const getAddressesHandler = defineRpcRequestHandler(
  getAddresses.method,
  sharedGetAddressesHandler
);

// HACK -- Cat21: removed `export` (upstream Stacks/Ledger/Network/Swap surface unrouted by ADR-1 BTC-L1-only scope). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
const stxGetAddressesHandler = defineRpcRequestHandler(
  stxGetAddresses.method,
  sharedGetAddressesHandler
);
