import type { StacksProvider } from '@stacks/connect';

import {
  type LeatherRpcMethodMap,
  type RpcMethodNames,
  type RpcParameter,
  RpcRequests,
  type RpcResponses,
} from '@leather.io/rpc';

import { addLeatherToProviders } from './add-leather-to-providers';

import './crypto-random-uuid-polyfill';

import { getLegacyRequests } from './legacy-requests';
import { Platform } from './types';

interface initInpageProviderArgs {
  onDispatch(rpcRequest: RpcRequests): void;
  env: { branch: string; commitSha: string; version: string; platform: Platform };
}

export function initInpageProvider({ onDispatch, env }: initInpageProviderArgs) {
  addLeatherToProviders();

  interface LeatherProviderOverrides extends Omit<StacksProvider, 'profileUpdateRequest'> {
    isLeather: true;
  }

  const provider: LeatherProviderOverrides = {
    isLeather: true,

    ...getLegacyRequests(env.platform),

    getProductInfo() {
      return {
        version: env.version,
        name: 'Leather',
        meta: {
          tag: env.branch,
          commit: env.commitSha,
        },
      };
    },

    request(
      method: RpcMethodNames,
      params?: RpcParameter
    ): Promise<LeatherRpcMethodMap[RpcMethodNames]['response']> {
      const id: string = crypto.randomUUID();
      const rpcRequest: RpcRequests = {
        jsonrpc: '2.0',
        id,
        method,
        params: (params ?? {}) as any,
      };

      onDispatch(rpcRequest);

      return new Promise((resolve, reject) => {
        function handleMessage(event: MessageEvent<RpcResponses>) {
          const response =
            typeof event.data === 'object' ? event.data : JSON.parse(event.data as any);
          if (response.id !== id) return;
          window.removeEventListener('message', handleMessage);
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          if ('error' in response) return reject(response);
          return resolve(response);
        }
        window.addEventListener('message', handleMessage);
      });
    },
  };

  function consoleDeprecationNotice(text: string) {
    // eslint-disable-next-line no-console
    console.warn(`Deprecation warning: ${text}`);
  }

  function warnAboutDeprecatedProvider(legacyProvider: object) {
    return Object.fromEntries(
      Object.entries(legacyProvider).map(([key, value]) => {
        if (typeof value === 'function') {
          return [
            key,
            (...args: any[]) => {
              switch (key) {
                case 'authenticationRequest':
                  consoleDeprecationNotice(
                    `Use LeatherProvider.request('getAddresses') instead, see docs https://leather.gitbook.io/developers/bitcoin/connect-users/get-addresses`
                  );
                  break;
                case 'psbtRequest':
                  consoleDeprecationNotice(
                    `Use LeatherProvider.request('signPsbt') instead, see docs https://leather.gitbook.io/developers/bitcoin/sign-transactions/partially-signed-bitcoin-transactions-psbts`
                  );
                  break;
                case 'structuredDataSignatureRequest':
                case 'signatureRequest':
                  consoleDeprecationNotice(
                    `Use LeatherProvider.request('stx_signMessage') instead`
                  );
                  break;
                default:
                  consoleDeprecationNotice(
                    'The provider object is deprecated. Use `LeatherProvider` instead'
                  );
              }

              return value(...args);
            },
          ];
        }
        return [key, value];
      })
    );
  }

  /* HACK -- Cat21: politeness extends to the deprecated Stacks + Hiro
   * legacy slots. Cat21 is a Bitcoin-L1 wallet and has no Stacks surface,
   * but the @leather.io/provider package still injects these because
   * upstream Leather supports Stacks. We never claim either if real
   * Leather (or any other StacksProvider-aware extension) is already
   * present on the page. */
  if (typeof (window as any).StacksProvider === 'undefined') {
    try {
      Object.defineProperty(window, 'StacksProvider', {
        get: () => warnAboutDeprecatedProvider(provider),
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        set: () => {},
      });
    } catch {
      // eslint-disable-next-line no-console
      console.log('Unable to set StacksProvider');
    }
  }

  if (typeof (window as any).HiroWalletProvider === 'undefined') {
    try {
      Object.defineProperty(window, 'HiroWalletProvider', {
        get: () => warnAboutDeprecatedProvider(provider),
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        set: () => {},
      });
    } catch {
      // eslint-disable-next-line no-console
      console.log('Unable to set HiroWalletProvider');
    }
  }

  /* HACK -- Cat21: politeness namespace strategy.
   *
   *   - `window.Cat21Provider` is ALWAYS defined (our own slot, nobody else
   *     owns this name).
   *   - `window.LeatherProvider` is ONLY defined if no other extension has
   *     already taken it. If real Leather is co-installed, we defer to it
   *     and dapps that look up `LeatherProvider` reach the actual Leather
   *     binary, not us. This is the same coexistence model real wallets
   *     use among each other (see Xverse, Unisat, OKX) and respects the
   *     fact that this codebase is a Leather fork — we owe upstream the
   *     courtesy of not squatting on their identity. */
  const win = window as unknown as Window & {
    LeatherProvider?: unknown;
    Cat21Provider?: unknown;
  };

  try {
    Object.defineProperty(win, 'Cat21Provider', {
      get: () => provider,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      set: () => {},
    });
  } catch {
    // eslint-disable-next-line no-console
    console.warn('Unable to set Cat21Provider');
  }

  if (typeof win.LeatherProvider === 'undefined') {
    try {
      Object.defineProperty(win, 'LeatherProvider', {
        get: () => provider,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        set: () => {},
      });
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Unable to set LeatherProvider');
    }
  }

  // Legacy product provider objects
  if (typeof (window as any).btc === 'undefined') {
    (window as any).btc = warnAboutDeprecatedProvider(provider);
  }
}
