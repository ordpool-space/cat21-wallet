import { hex } from '@scure/base';
import { useQuery } from '@tanstack/react-query';
import { KnownOrdinalWalletType, simulateMint } from 'ordpool-sdk/core';

import type { FundingPreviewState } from '@app/features/cat21-confirmation/cat21-funding-notice.model';
import {
  type Cat21RpcDeps,
  resolveManualFundingTopology,
  walletNetworkToSdkNetwork,
} from '@background/cat21/cat21-rpc.service';
import type { Cat21Intent, Cat21MintIntent } from '@background/cat21/types';

/**
 * Pre-approve funding preview via the SDK's `simulateMint` (content-checked
 * selection + fee, no signing), with the same inputs `executeMint` uses so the
 * notice matches what Approve does. Returns a `FundingPreviewState` for
 * `describeFundingNotice` and `isApproveBlocked`. Non-mint intents are
 * `not-applicable`.
 */

/** Mint is the only funding intent with a `recipient` and no `catId`. */
function isMintIntent(intent: Cat21Intent): intent is Cat21MintIntent {
  return 'recipient' in intent && !('catId' in intent);
}

export function useCat21FundingPreview(
  intent: Cat21Intent | undefined,
  deps: Cat21RpcDeps,
  /**
   * Whether the funding UTXO query is still loading. Must gate the preview:
   * while loading `deps.spendableUtxos` returns [], and simulate reads that as
   * `insufficient` and caches it (the query key ignores utxo data).
   */
  fundingLoading: boolean
): FundingPreviewState {
  const enabled = intent != null && isMintIntent(intent) && !fundingLoading;
  const query = useQuery({
    // Key varies on the intent; deps' ports are stable memoised. The enabled
    // gate holds the query until funding has loaded.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['cat21-funding-preview', intent],
    enabled,
    queryFn: async (): Promise<FundingPreviewState> => {
      if (intent == null || !isMintIntent(intent)) return { status: 'not-applicable' };
      const ctx = deps.getAccountContext();
      if (!ctx.paymentPublicKey) return { status: 'not-applicable' };
      const ports = {
        utxos: { spendableUtxos: deps.spendableUtxos },
        scan: { classify: deps.classifyOutpoint },
      };
      const sim = await simulateMint(
        {
          walletType: KnownOrdinalWalletType.cat21wallet,
          network: walletNetworkToSdkNetwork(ctx.network),
          paymentPublicKey: hex.decode(ctx.paymentPublicKey),
          paymentAddress: ctx.paymentAddress,
          recipientAddress: intent.recipient,
          feeRatePerVbyte: intent.feeRate,
          // A tip changes the coverage target and coin pick; mirror execute.
          tip:
            intent.tip && intent.tip.value > 0
              ? { address: intent.tip.address, valueSats: intent.tip.value }
              : undefined,
          fundingTopology: resolveManualFundingTopology(ctx.paymentAddress, ctx.ordinalsAddress),
        },
        ports
      );
      return {
        status: sim.status,
        assets:
          sim.status === 'asset-notice' ? (sim.recommendation.recommended?.assets ?? null) : null,
      };
    },
  });

  if (intent == null || !isMintIntent(intent)) return { status: 'not-applicable' };
  if (fundingLoading) return { status: 'loading' };
  if (query.isError) return { status: 'error' };
  if (query.data) return query.data;
  return { status: 'loading' };
}
