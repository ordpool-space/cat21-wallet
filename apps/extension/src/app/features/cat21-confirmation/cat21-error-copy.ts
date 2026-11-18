import type { ExpertRequiredCause } from 'ordpool-sdk/core';

/** One sentence per SDK funding-block cause. None is a lack of funds. */
const FUNDING_BLOCK_COPY: Record<ExpertRequiredCause, string> = {
  'unknown-content':
    'A funding coin could not be checked for assets right now. Try again in a moment.',
  'unnamed-assets':
    'The only coins that can pay for this carry assets that could not be identified, so none was spent. Send plain Bitcoin to your wallet, then try again.',
  'named-assets':
    'The only coins that can pay for this carry assets, so none was spent. Send plain Bitcoin to your wallet, then try again.',
};

/**
 * Turn a Cat21 rpc failure into ONE actionable, second-person sentence a
 * person can act on: "Add funds to your wallet, then try again." never
 * "funding-pick-failed: Insufficient funds".
 *
 * The rpc layer's `{ reason, detail }` is engineering data. This is the only
 * thing a user reads on a failed approval, so it must name a way forward and
 * never leak a raw code (§7.4 / §7.6 of `ordpool-sdk/docs/wallet-ux-round2.md`).
 * The real cause sometimes rides in `detail` (an `intent-invariant-violated`
 * carrying `funding-pick-failed` or `cat-not-found`), so both fields are
 * matched, most-specific first.
 */
export function humanizeCat21Error(
  reason: string,
  detail?: string,
  /**
   * The SDK's `expertRequiredCause` when a funding block stopped the flow (the
   * denial's structured `funding.cause`). The SDK documents branching on it, not
   * on its message wording. Omitted, the copy falls back to matching the SDK's
   * message text, which gives the same sentence.
   */
  fundingCause?: ExpertRequiredCause
): string {
  if (fundingCause) return FUNDING_BLOCK_COPY[fundingCause];

  const haystack = `${reason} ${detail ?? ''}`.toLowerCase();
  function has(...needles: string[]): boolean {
    return needles.some(n => haystack.includes(n));
  }

  // The coin that would pay carries assets and this path may not spend one
  // (an agent, or a click whose check named no coin): nothing was signed.
  if (has('asset-spend-not-permitted')) {
    return 'The only coin that can pay for this carries assets, so it was not spent. Send plain Bitcoin to your wallet, then try again.';
  }

  // The SDK's expert-required funding blocks (each text starts "Select a
  // funding UTXO"), for a denial without the structured cause. None of them is
  // a lack of funds, so none reads "Add funds"; they ride behind
  // `funding-pick-failed`, so they are matched before it.
  if (has('what the covering coins hold could not be checked')) {
    return FUNDING_BLOCK_COPY['unknown-content'];
  }
  if (has('carry assets the scan could not name')) {
    return FUNDING_BLOCK_COPY['unnamed-assets'];
  }
  if (has('the available coins carry assets')) {
    return FUNDING_BLOCK_COPY['named-assets'];
  }
  // Money first: the most common blocker.
  if (has('insufficient', 'funding-pick-failed', 'nothing covers', 'only asset coins')) {
    return 'Add funds to your wallet, then try again.';
  }
  // The funding coin shown in the preview is no longer the one that would be
  // spent, so nothing was signed: ask for a fresh look before approving.
  if (has('funding-selection-changed')) {
    return 'The funding coin changed since you reviewed it. Check the details and approve again.';
  }
  // Wallet not ready.
  if (has('wallet-locked')) return 'Unlock your wallet, then try again.';
  if (has('wiring-pending', 'wiring pending')) {
    return 'The wallet is still starting up. Try again in a moment.';
  }
  // The person cancelled: not really an error.
  if (has('user-rejected')) return 'You cancelled this. Start again when you are ready.';
  // Agent-policy limits.
  if (has('spend-above-action-cap')) {
    return 'This is over your per-action spending limit. Raise it in settings to continue.';
  }
  if (has('fee-rate-above-ceiling')) {
    return 'This fee is above your limit. Lower the fee, or raise the limit in settings.';
  }
  if (has('counterparty-not-allowlisted')) {
    return 'This address is not on your allowed list. Add it in settings to continue.';
  }
  if (has('floor-price-violation', 'price-below-floor')) {
    return 'This price is below your floor. Raise the price to continue.';
  }
  if (has('policy-denied', 'agent-disabled')) {
    return 'Your agent settings blocked this. Update them to allow it.';
  }
  // Offer and price mismatches.
  if (has('wrong-price')) return 'The price does not match the offer. Refresh and try again.';
  if (has('payment-output-wrong-address')) {
    return 'This offer pays the wrong address. Ask the seller for a fresh link.';
  }
  // Cat data could not load.
  if (has('cat-not-found', 'cat-utxo-resolve-failed', 'cat-data-not-loaded')) {
    return 'This cat could not be loaded. Refresh and try again.';
  }
  // Arrived on a channel that cannot approve on its own.
  if (has('transport-not-trusted-for-autonomous')) {
    return 'This needs your approval. Open it from the wallet to continue.';
  }
  // Network rejected the broadcast.
  if (has('broadcast-failed')) {
    return 'The network did not accept this. Wait a moment, then try again.';
  }
  // Validation or anything unmapped: still a plain sentence, never the code.
  return 'This could not be completed. Refresh and try again.';
}
