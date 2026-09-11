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
export function humanizeCat21Error(reason: string, detail?: string): string {
  const haystack = `${reason} ${detail ?? ''}`.toLowerCase();
  function has(...needles: string[]): boolean {
    return needles.some(n => haystack.includes(n));
  }

  // Money first: the most common blocker.
  if (has('insufficient', 'funding-pick-failed', 'nothing covers', 'only asset coins')) {
    return 'Add funds to your wallet, then try again.';
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
