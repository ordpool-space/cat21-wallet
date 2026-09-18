import { hex } from '@scure/base';
import { useQuery } from '@tanstack/react-query';
import {
  KnownOrdinalWalletType,
  type MintStatus,
  type UtxoAssetDetail,
  simulateMint,
} from 'ordpool-sdk/core';

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
 * shows cannot disagree with what the click does.
 *
 * `status` drives the CTA; `assets` (present only on `asset-notice`) names WHAT
 * sits on the coin the flow would spend, so the notice says which inscription /
 * rune / cat / rare sat rather than "this coin carries assets".
 *
 * `fundingTopology` is threaded on this MANUAL surface (a human sees the notice
 * and decides). The autonomous path passes none and keeps the blocking default;
 * the two are the same core, split only by what the caller passes.
 */
export interface Cat21FundingPreview {
  status: MintStatus;
  /** Named assets on the auto-selected coin; set only when status is asset-notice. */
  assets: UtxoAssetDetail | null;
  feeSats: number | null;
}

/**
 * True for the mint intent (funds postage + fee from the payment address, no
 * cat input). A proper type guard so the mint branch narrows `intent` to
 * `Cat21MintIntent` and its `recipient` / `feeRate` are typed. Mint is the only
 * funding shape with a `recipient` and no `catId`; transfer carries both, the
 * offer/buy shapes carry `catId`, accept-offer carries neither.
 */
function isMintIntent(intent: Cat21Intent): intent is Cat21MintIntent {
  return 'recipient' in intent && !('catId' in intent);
}

/**
 * Run `simulate*` for the intent and return the funding picture. Uses the SAME
 * ports the deps already build (`spendableUtxos`, `classifyOutpoint`), so the
 * preview scans exactly what the execute path scans. Mint is wired first; the
 * other funding operations extend the dispatch below with their own `simulate*`
 * (accept-offer funds nothing, so it never gets a preview).
 */
export function useCat21FundingPreview(
  intent: Cat21Intent | undefined,
  deps: Cat21RpcDeps
): { preview: Cat21FundingPreview | undefined; isLoading: boolean } {
  const enabled = intent != null && isMintIntent(intent);
  const query = useQuery({
    queryKey: ['cat21-funding-preview', intent],
    enabled,
    queryFn: async (): Promise<Cat21FundingPreview | null> => {
      if (intent == null || !isMintIntent(intent)) return null;
      const ctx = deps.getAccountContext();
      if (!ctx.paymentPublicKey) return null;
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
          fundingTopology: resolveManualFundingTopology(ctx.paymentAddress, ctx.ordinalsAddress),
        },
        ports
      );
      return {
        status: sim.status,
        assets:
          sim.status === 'asset-notice' ? (sim.recommendation.recommended?.assets ?? null) : null,
        feeSats: sim.feeSats,
      };
    },
  });

  return { preview: query.data ?? undefined, isLoading: enabled && query.isLoading };
}
