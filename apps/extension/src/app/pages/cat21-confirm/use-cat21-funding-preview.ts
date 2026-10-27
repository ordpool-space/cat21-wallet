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
 * Funding preview via the SDK's `simulateMint` (content-checked selection +
 * fee, no signing), same inputs as `executeMint` so the notice matches Approve.
 * Returns a `FundingPreviewState` for `describeFundingNotice` /
 * `isApproveBlocked`. Applies to manual mint only; non-mint and autonomous
 * intents are `not-applicable` (autonomous auto-confirms, never shows the
 * dialog).
 */

/** Mint is the only funding intent with a `recipient` and no `catId`. */
function isMintIntent(intent: Cat21Intent): intent is Cat21MintIntent {
  return 'recipient' in intent && !('catId' in intent);
}

/**
 * The preview drives the human dialog only. An autonomous intent auto-confirms
 * without the dialog, so previewing it is a wasted simulate + scan.
 */
function previewApplies(intent: Cat21Intent | undefined): intent is Cat21MintIntent {
  return intent != null && isMintIntent(intent) && intent.mode !== 'autonomous';
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
  const enabled = previewApplies(intent) && !fundingLoading;
  const query = useQuery({
    // Key varies on the intent; deps' ports are stable memoised. The enabled
    // gate holds the query until funding has loaded.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['cat21-funding-preview', intent],
    enabled,
    queryFn: async (): Promise<FundingPreviewState> => {
      if (!previewApplies(intent)) return { status: 'not-applicable' };
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

  if (!previewApplies(intent)) return { status: 'not-applicable' };
  if (fundingLoading) return { status: 'loading' };
  if (query.isError) return { status: 'error' };
  if (query.data) return query.data;
  return { status: 'loading' };
}
