import { createRpcSuccessResponse, getInfo } from '@leather.io/rpc';

import { defineRpcRequestHandler } from '../rpc-message-handler';
import { getTabIdFromPort } from '../rpc-request-utils';

/**
 * `getInfo` — product info for a connecting dapp: the extension version (from
 * the manifest, the single source of truth) and the platform. Account-
 * independent, so it needs no connecting-app context.
 *
 * `supportedMethods` is left off (the schema makes it optional): the dedicated
 * `supportedMethods` RPC is the authority for the method list, so duplicating
 * it here would be a second list that drifts from the handler registry.
 *
 * Advertised in `CAT21_PROVIDER.methods` (and HARD RULE #6) but previously
 * unregistered, so a `request('getInfo')` returned METHOD_NOT_FOUND. This
 * handler closes that gap.
 */
export const getInfoHandler = defineRpcRequestHandler(getInfo.method, (request, port) => {
  void chrome.tabs.sendMessage(
    getTabIdFromPort(port),
    createRpcSuccessResponse(getInfo.method, {
      id: request.id,
      result: {
        version: chrome.runtime.getManifest().version,
        platform: 'extension',
      },
    })
  );
});
