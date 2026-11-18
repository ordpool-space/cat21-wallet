import { useQuery } from '@tanstack/react-query';

import type { FundingPreviewState } from '@app/features/cat21-confirmation/cat21-funding-notice.model';
import type { Cat21RpcDeps } from '@background/cat21/cat21-rpc.service';
import type { Cat21Intent } from '@background/cat21/types';

import { fundingPreviewApplies, simulateFundingPreview } from './simulate-funding-preview';

/**
 * Funding preview for the manual confirm dialog (mint, transfer, buy) via the
 * SDK's `simulate*` (content-checked selection + fee, no signing), same inputs
 * as the execute so the notice matches Approve. Returns a `FundingPreviewState`
 * for `describeFundingNotice` / `isApproveBlocked`. create-offer, accept-offer
 * and autonomous intents are `not-applicable`.
 */
export function useCat21FundingPreview(
  intent: Cat21Intent | undefined,
  deps: Cat21RpcDeps,
  /**
   * Whether the funding UTXO query is still loading. Must gate the preview:
   * while loading `deps.spendableUtxos` returns [], and simulate reads that as
   * `insufficient` and caches it (the query key ignores utxo data).
   */
  fundingLoading: boolean,
  /**
   * Whether the cat-metadata query behind `deps.resolveCatUtxo` is still
   * loading. Transfer and buy resolve their cat inside the preview, and
   * `resolveCatUtxo` fails until that data lands, which would cache
   * `not-applicable` for a cat that is merely still loading, so the notice for
   * an asset coin would never appear. False for mint (no cat).
   */
  catLoading: boolean
): FundingPreviewState {
  const applies = fundingPreviewApplies(intent);
  const query = useQuery({
    // Key varies on the intent; deps' ports are stable memoised. The enabled
    // gate holds the query until funding and the cat have loaded.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['cat21-funding-preview', intent],
    enabled: applies && !fundingLoading && !catLoading,
    queryFn: (): Promise<FundingPreviewState> =>
      intent ? simulateFundingPreview(intent, deps) : Promise.resolve({ status: 'not-applicable' }),
  });

  if (!applies) return { status: 'not-applicable' };
  if (fundingLoading || catLoading) return { status: 'loading' };
  if (query.isError) return { status: 'error' };
  if (query.data) return query.data;
  return { status: 'loading' };
}
