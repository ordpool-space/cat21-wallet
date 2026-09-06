import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { HttpStatusCode, isAxiosError } from 'axios';
import { BigNumber } from 'bignumber.js';
import superjson from 'superjson';
import { ZodError } from 'zod';

import { PERSISTENCE_CACHE_TIME } from '@leather.io/constants';

import { IS_TEST_ENV } from '@shared/environment';
import { logger } from '@shared/logger';
import { analytics } from '@shared/utils/analytics';

const RETRY_LIMIT = 5;

superjson.registerCustom<BigNumber, string>(
  {
    isApplicable: (v): v is BigNumber => v instanceof BigNumber,
    serialize: v => v.toString(),
    deserialize: v => new BigNumber(v),
  },
  'BigNumber'
);

const storage = {
  getItem: async (key: string) => {
    const storageVal = await chrome.storage.local.get(key);
    return storageVal[key];
  },
  setItem: (key: string, value: string) => chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove([key]),
};

const chromeStorageLocalPersister = createAsyncStoragePersister({
  storage,
  serialize: superjson.stringify,
  deserialize: superjson.parse,
});

function isZodError(error: Error): error is ZodError {
  // `instanceof` check doesn't work when ZodError thrown from within a package
  return error instanceof ZodError || error.name === 'ZodError';
}

function isRetryableError(error: Error): boolean {
  if (!isAxiosError(error)) return false;
  if (!error.response) return true;
  const status = error.response.status;

  return (
    status >= 500 ||
    status === HttpStatusCode.RequestTimeout ||
    status === HttpStatusCode.TooManyRequests
  );
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      if (isAxiosError(error)) {
        const errorReport = {
          statusCode: error.response?.status,
          query: query.queryKey[0],
          hash: query.queryHash,
          error: error.toJSON(),
        };
        analytics.untypedTrack('api_error', errorReport);
      }

      if (isZodError(error)) {
        const zodErrorReport = {
          query: query.queryKey[0],
          hash: query.queryHash,
          error: JSON.stringify(error.issues),
        };
        logger.error('schema_fail', zodErrorReport);
        // Replace with `formatQueryZodErrors` from `@leather.io/query`
        // Example:
        // `void analytics.track(...formatQueryZodErrors(error, query))`
        analytics.track('schema_fail', zodErrorReport);
      }
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: PERSISTENCE_CACHE_TIME,
      // https://tanstack.com/query/v4/docs/guides/testing#turn-off-retries
      retry(failureCount, error) {
        if (IS_TEST_ENV) return false;
        return isRetryableError(error) && failureCount <= RETRY_LIMIT;
      },
    },
  },
});

// HACK -- Cat21 (audit H4): exclude cat21-ord and address-monitor
// queries from the persisted react-query cache. Without this filter
// the wallet writes a permanent on-disk log of which BTC addresses
// the user has viewed and which cats live there (cache key starts
// with the address). PRIVACY-POLICY.md claims "nothing identifies
// users by address" — `dehydrateOptions.shouldDehydrateQuery` is
// the single place that promise is enforced for the cache layer.
//
// Anything starting with `cat21-ord-` or `http-cat21-ord-` is the
// cat-ownership graph; `bitcoin-address-*` and `mempool-*` carry
// addresses too. Add a key here BEFORE introducing a new query that
// includes any address-shaped value.
const CAT21_PRIVACY_LEAK_KEY_PREFIXES = [
  'cat21-ord-',
  'http-cat21-ord-',
  'bitcoin-address-',
  'mempool-tx-',
  'mempool-address-',
];

function isPrivacyLeakingQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  if (typeof head !== 'string') return false;
  return CAT21_PRIVACY_LEAK_KEY_PREFIXES.some(prefix => head.startsWith(prefix));
}

export function persistAndRenderApp(renderApp: () => void) {
  if (!IS_TEST_ENV) {
    void persistQueryClient({
      queryClient,
      persister: chromeStorageLocalPersister,
      buster: VERSION,
      dehydrateOptions: {
        shouldDehydrateQuery: query => !isPrivacyLeakingQueryKey(query.queryKey),
      },
    });
  }
  renderApp();
}
