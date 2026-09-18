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
 * The pre-approve funding picture the confirmation dialog renders BEFORE the
 * user clicks. It is the SDK's `simulate*` (content-checked selection + two-pass
 * fee, no signing), the same computation `execute*` repeats, so what the dialog
 * shows cannot disagree with what the click does — which is why the simulate
 * inputs mirror the execute inputs EXACTLY (recipient, fee rate, tip, topology).
 *
 * Returns a `FundingPreviewState` the route feeds to `describeFundingNotice` for
 * the notice and to `isApproveBlocked` for the CTA gate: `loading` and `error`
 * hold the CTA (funding safety not yet known / a scan that failed), a resolved
 * status names assets or blocks. A non-mint intent is `not-applicable` (no
 * funding preview wired yet), leaving the dialog exactly as before.
 *
 * `fundingTopology` is threaded on this MANUAL surface (a human sees the notice
 * and decides). The autonomous path passes none and keeps the blocking default;
 * the two are the same core, split only by what the caller passes.
 */

/**
 * True for the mint intent (funds postage + fee from the payment address, no
 * cat input). A proper type guard so the mint branch narrows `intent` to
 * `Cat21MintIntent` and its `recipient` / `feeRate` / `tip` are typed. Mint is
 * the only funding shape with a `recipient` and no `catId`; transfer carries
 * both, the offer/buy shapes carry `catId`, accept-offer carries neither.
 */
function isMintIntent(intent: Cat21Intent): intent is Cat21MintIntent {
  return 'recipient' in intent && !('catId' in intent);
}

export function useCat21FundingPreview(
  intent: Cat21Intent | undefined,
  deps: Cat21RpcDeps,
  /**
   * Whether the funding UTXO query is still loading. The preview must NOT run
   * until it settles: `deps.spendableUtxos` returns [] while the query loads, so
   * a preview that ran early would compute `insufficient` on an empty set and
   * cache it — leaving a FUNDED wallet's dialog stuck on "insufficient" for the
   * popup's life, since the key does not depend on the utxo data. While loading,
   * the hook holds at `loading` (CTA held); when it settles the query runs once
   * against the real spendable set.
   */
  fundingLoading: boolean
): FundingPreviewState {
  const enabled = intent != null && isMintIntent(intent) && !fundingLoading;
  const query = useQuery({
    // The key varies on the intent only. `deps` (its ports) is memoised by
    // `useCat21RpcDeps` and stable for a given account; putting function
    // identities in a serialised key would be wrong, not more correct. The
    // `enabled` gate below holds the query until funding has loaded, so the
    // queryFn always reads a settled spendable set.
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
          // Mirror the execute mapping (cat21-rpc.service mint) so the preview's
          // coverage target + coin pick match what Approve actually funds — a
          // tip changes both.
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
  // A mint intent whose funding is still loading (query held): hold the CTA.
  if (fundingLoading) return { status: 'loading' };
  if (query.isError) return { status: 'error' };
  if (query.data) return query.data;
  return { status: 'loading' };
}
