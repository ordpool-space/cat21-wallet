import { hex } from '@scure/base';
import {
  type AnnotatedFundingUtxo,
  type CoreFundingUtxo,
  type FundingRecommendation,
  KnownOrdinalWalletType,
  type MintStatus,
  expertRequiredCause,
  simulateCreateOffer,
  simulateMint,
  simulateTransfer,
} from 'ordpool-sdk/core';

import type { FundingPreviewState } from '@app/features/cat21-confirmation/cat21-funding-notice.model';
import {
  type Cat21RpcDeps,
  resolveManualFundingTopology,
  walletNetworkToSdkNetwork,
} from '@background/cat21/cat21-rpc.service';
import type {
  Cat21BuyIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

/**
 * The manual pre-approve funding preview for the three actions that spend a
 * funding coin: mint, transfer and buy. Each runs the SDK `simulate*` with the
 * same inputs its execute repeats (`executeMint` / `executeTransfer` /
 * `createOffer`), so the notice and the CTA gate describe exactly what Approve
 * funds. The resolved coin is returned for the confirm route to pin into that
 * execute. create-offer (a listing) and accept-offer (the buyer funded it) spend
 * no funding coin, so they have no preview.
 *
 * Intent kinds are told apart in the same order the confirm route dispatches
 * them: `bidSats` → buy, `priceSats` → create-offer, `offerPsbt` →
 * accept-offer, `catId` → transfer, else mint.
 */

type FundingPreviewIntent =
  | { kind: 'mint'; intent: Cat21MintIntent }
  | { kind: 'transfer'; intent: Cat21TransferIntent }
  | { kind: 'buy'; intent: Cat21BuyIntent };

function classifyFundingIntent(intent: Cat21Intent): FundingPreviewIntent | null {
  if ('bidSats' in intent) return { kind: 'buy', intent };
  if ('priceSats' in intent || 'offerPsbt' in intent) return null;
  if ('catId' in intent) return { kind: 'transfer', intent };
  return { kind: 'mint', intent };
}

/**
 * Whether the manual preview runs for this intent. The preview drives the human
 * dialog only; an autonomous intent auto-confirms without it, so previewing it
 * is a wasted simulate + scan.
 */
export function fundingPreviewApplies(intent: Cat21Intent | undefined): intent is Cat21Intent {
  return intent != null && intent.mode !== 'autonomous' && classifyFundingIntent(intent) != null;
}

/**
 * Notice data. On `asset-notice` it comes from the coin that will ACTUALLY be
 * spent (the simulate's resolved pick), not from the recommendation; the two
 * differ once an explicit pick exists. On `expert-required` nothing is spent,
 * so it comes from the recommended coin the block is about, together with the
 * SDK's cause for the block.
 */
function toPreviewState(sim: {
  status: MintStatus;
  pick: (CoreFundingUtxo & AnnotatedFundingUtxo) | null;
  recommendation: FundingRecommendation<CoreFundingUtxo & AnnotatedFundingUtxo>;
}): FundingPreviewState {
  const { status, pick, recommendation } = sim;
  if (status === 'expert-required') {
    return {
      status,
      assets: recommendation.recommended?.assets ?? null,
      fundingUtxo: pick,
      cause: expertRequiredCause(recommendation),
    };
  }
  return {
    status,
    assets: status === 'asset-notice' ? (pick?.assets ?? null) : null,
    fundingUtxo: pick,
    cause: null,
  };
}

/**
 * The transfer/buy cat, or `null` when it cannot be resolved (not owned, data
 * failed to load). The preview then has nothing to fund, and the service
 * resolves the same cat before any funding step and refuses with a typed
 * `cat-utxo-resolve-failed`, which the dialog renders as a refresh step. No coin
 * can be spent on that path, so the preview stays out of the way rather than
 * holding the CTA behind a misleading scan-failure message.
 */
function resolveCatOrNull(deps: Cat21RpcDeps, catId: string) {
  try {
    return deps.resolveCatUtxo(catId);
  } catch {
    return null;
  }
}

/** Run the preview for one intent. */
export async function simulateFundingPreview(
  intent: Cat21Intent,
  deps: Cat21RpcDeps
): Promise<FundingPreviewState> {
  const classified = intent.mode === 'autonomous' ? null : classifyFundingIntent(intent);
  if (classified == null) return { status: 'not-applicable' };
  const ctx = deps.getAccountContext();
  if (!ctx.paymentPublicKey) return { status: 'not-applicable' };
  const ports = {
    utxos: { spendableUtxos: deps.spendableUtxos },
    scan: { classify: deps.classifyOutpoint },
  };
  const common = {
    walletType: KnownOrdinalWalletType.cat21wallet,
    network: walletNetworkToSdkNetwork(ctx.network),
    paymentPublicKey: hex.decode(ctx.paymentPublicKey),
    paymentAddress: ctx.paymentAddress,
    fundingTopology: resolveManualFundingTopology(ctx.paymentAddress, ctx.ordinalsAddress),
  };

  if (classified.kind === 'buy') {
    const buy = classified.intent;
    // The cat lands at the buyer's ordinals address; execute denies without one.
    if (!ctx.ordinalsAddress) return { status: 'not-applicable' };
    const cat = resolveCatOrNull(deps, buy.catId);
    if (cat == null) return { status: 'not-applicable' };
    const sim = await simulateCreateOffer(
      {
        ...common,
        buyerReceiveAddress: ctx.ordinalsAddress,
        sellerPaymentAddress: buy.sellerPaymentAddress,
        targetCat: {
          txid: cat.txid,
          vout: cat.vout,
          value: cat.value,
          scriptPubKey: cat.scriptPubKey,
        },
        priceSats: buy.bidSats,
        feeRatePerVbyte: buy.feeRate,
      },
      ports
    );
    return toPreviewState({
      status: sim.status,
      pick: sim.buyerFundingUtxo,
      recommendation: sim.recommendation,
    });
  }

  if (classified.kind === 'transfer') {
    const transfer = classified.intent;
    // The cat rides input 0 at the ordinals address; execute denies without it.
    if (!ctx.ordinalsPublicKey || !ctx.ordinalsAddress) return { status: 'not-applicable' };
    const cat = resolveCatOrNull(deps, transfer.catId);
    if (cat == null) return { status: 'not-applicable' };
    const sim = await simulateTransfer(
      {
        ...common,
        ordinalsPublicKey: hex.decode(ctx.ordinalsPublicKey),
        ordinalsAddress: ctx.ordinalsAddress,
        catUtxo: { txid: cat.txid, vout: cat.vout, value: cat.value },
        recipientAddress: transfer.recipient,
        feeRatePerVbyte: transfer.feeRate,
      },
      ports
    );
    return toPreviewState({
      status: sim.status,
      pick: sim.fundingUtxo,
      recommendation: sim.recommendation,
    });
  }

  const mint = classified.intent;
  const sim = await simulateMint(
    {
      ...common,
      recipientAddress: mint.recipient,
      feeRatePerVbyte: mint.feeRate,
      // A tip changes the coverage target and coin pick; mirror execute.
      tip:
        mint.tip && mint.tip.value > 0
          ? { address: mint.tip.address, valueSats: mint.tip.value }
          : undefined,
    },
    ports
  );
  return toPreviewState({
    status: sim.status,
    pick: sim.fundingUtxo,
    recommendation: sim.recommendation,
  });
}
