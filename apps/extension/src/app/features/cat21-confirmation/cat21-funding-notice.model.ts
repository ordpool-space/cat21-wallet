import type {
  CoreFundingUtxo,
  ExpertRequiredCause,
  FundingPinContent,
  MintStatus,
  UtxoAssetDetail,
} from 'ordpool-sdk/core';

/**
 * The funding preview state: the resolved `MintStatus`, plus `not-applicable`
 * (no preview wired), `loading` (simulate in flight), and `error` (scan failed).
 *
 * `fundingUtxo` is the coin the preview resolved. `null` when the preview
 * produced no spendable pick (blocked / insufficient).
 *
 * `assets` is what the notice names: on `asset-notice` the coin that would be
 * spent, on `expert-required` the recommended coin that is blocked. `cause` is
 * the SDK's `expertRequiredCause` on `expert-required` (why the coin is
 * blocked), `null` on every other status.
 */
export type FundingPreviewState =
  | { status: 'not-applicable' }
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: MintStatus;
      assets: UtxoAssetDetail | null;
      fundingUtxo: (CoreFundingUtxo & FundingPinContent) | null;
      cause: ExpertRequiredCause | null;
    };

/**
 * The coin the confirm route pins into execution: only an `asset-notice` coin,
 * the one the human was shown WITH the assets it carries, because pinning is
 * what lets execution spend an asset coin (`'after-notice'`). Every other state
 * pins nothing, so execution runs under the `'refuse'` policy: a clean coin is
 * auto-selected and an asset coin is refused. A `ready` coin needs no pin: under
 * `'refuse'` no asset coin can be spent, and a clean coin chosen at click time
 * carries nothing a notice should have named.
 */
export function fundingPreviewCoin(
  state: FundingPreviewState
): (CoreFundingUtxo & FundingPinContent) | null {
  return state.status === 'asset-notice' ? state.fundingUtxo : null;
}

/**
 * What the notice renders, decided purely so it is unit-testable without a
 * render harness (vitest can't resolve `leather-styles/jsx`). The component adds
 * only the async rune etching link on top.
 */
export type FundingNoticeModel =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'insufficient'; reason: string }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'assets'; intro: string; rows: FundingAssetRow[] }
  /** Every covering coin carries NAMED assets and this wallet may not spend
   * them (one address for everything): the SDK's recommended coin is named
   * like `assets`, CTA held. */
  | { kind: 'assets-blocked'; intro: string; rows: FundingAssetRow[] };

/**
 * The render decisions of the two named-asset notices, kept here (not in the
 * component) so they are unit-testable: vitest can't resolve the component's
 * `leather-styles/jsx`. The testid is what makes the CTA gate observable in e2e.
 */
export function namedNoticeChrome(model: { kind: 'assets' | 'assets-blocked' }): {
  testId: string;
  heading: string;
} {
  return model.kind === 'assets-blocked'
    ? { testId: 'cat21-funding-notice-blocked', heading: 'The recommended coin carries assets' }
    : { testId: 'cat21-funding-notice', heading: 'This funding coin carries assets' };
}

/** Rune names whose etching links the component resolves: every named notice. */
export function noticeRuneNames(model: FundingNoticeModel): string[] {
  if (model.kind !== 'assets' && model.kind !== 'assets-blocked') return [];
  return model.rows.flatMap(row => (row.runeName ? [row.runeName] : []));
}

export interface FundingAssetRow {
  /** Stable React key. */
  key: string;
  label: 'Inscription' | 'Rune' | 'Cat' | 'Rare sat';
  /** Display text: a truncated id, a rune name, or a rare-sat description. */
  name: string;
  /** Sync tx link (inscription/cat ids embed a txid). `null` for a rare sat and
   * for a rune (etching tx resolved async by the component). */
  linkTxid: string | null;
  /** Set for a rune row so the component can resolve its etching-tx link. */
  runeName?: string;
}

const INSUFFICIENT_REASON =
  'Not enough spendable Bitcoin to cover this action’s postage and network fee. Add funds to the payment address and try again.';
const SCAN_FAILED_REASON =
  'A funding coin could not be content-checked (the ord index is unreachable), so it is not safe to spend automatically. Try again in a moment.';
const UNNAMED_ASSETS_REASON =
  'The only coins that cover this action carry assets the scan could not identify, so they are not spent automatically. Send plain Bitcoin to the payment address and try again.';
const ASSET_NOTICE_INTRO =
  'No plain Bitcoin coin covers this action, so it would spend the coin below to the miners along with everything on it. Continue only if you mean to.';
const ASSETS_BLOCKED_INTRO =
  'No plain Bitcoin coin covers this action. Every coin that does carries assets (the recommended one is below), and this wallet keeps assets and payments on one address, so none is spent. Send plain Bitcoin to the address and try again.';

/** Head…tail so a 64-hex id fits one popup line while staying recognisable. */
export function truncateMiddle(value: string, head = 8, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** An inscription id is `<txid>i<index>`; strip the index to get the txid. */
export function txidOfInscriptionId(inscriptionId: string): string {
  return inscriptionId.replace(/i\d+$/u, '');
}

/** Map preview state to notice content. CTA gating is `isApproveBlocked`. */
export function describeFundingNotice(state: FundingPreviewState): FundingNoticeModel {
  if (state.status === 'not-applicable') return { kind: 'none' };
  if (state.status === 'loading') return { kind: 'checking' };
  if (state.status === 'error') return { kind: 'unavailable', reason: SCAN_FAILED_REASON };
  if (state.status === 'ready') return { kind: 'none' };
  if (state.status === 'insufficient') return { kind: 'insufficient', reason: INSUFFICIENT_REASON };
  if (state.status === 'expert-required') {
    // The SDK's cause, not a guess from the bucket: a named-asset block names
    // each asset; unnamed assets get their own reason; a failed scan (or no
    // cause at all) fails closed to the scan-failure reason.
    if (state.cause === 'named-assets') {
      return { kind: 'assets-blocked', intro: ASSETS_BLOCKED_INTRO, rows: assetRows(state.assets) };
    }
    if (state.cause === 'unnamed-assets') {
      return { kind: 'unavailable', reason: UNNAMED_ASSETS_REASON };
    }
    return { kind: 'unavailable', reason: SCAN_FAILED_REASON };
  }
  if (state.status === 'scanning') return { kind: 'checking' };
  if (state.status === 'asset-notice') {
    return { kind: 'assets', intro: ASSET_NOTICE_INTRO, rows: assetRows(state.assets) };
  }
  return failClosedOnUnknownStatus(state.status);
}

/**
 * A status this model does not know (a later SDK may add one) fails closed: the
 * CTA is held. The `never` parameter makes an unhandled status a compile error
 * at the call site first; the runtime answer covers a value that bypassed types.
 */
function failClosedOnUnknownStatus(_status: never): FundingNoticeModel {
  return { kind: 'unavailable', reason: SCAN_FAILED_REASON };
}

/** One row per named asset, in inscription / rune / cat / rare-sat order. */
function assetRows(assets: UtxoAssetDetail | null): FundingAssetRow[] {
  const rows: FundingAssetRow[] = [];
  for (const id of assets?.inscriptionIds ?? []) {
    rows.push({
      key: `insc-${id}`,
      label: 'Inscription',
      name: truncateMiddle(id),
      linkTxid: txidOfInscriptionId(id),
    });
  }
  for (const name of assets?.runeNames ?? []) {
    rows.push({ key: `rune-${name}`, label: 'Rune', name, linkTxid: null, runeName: name });
  }
  for (const id of assets?.catIds ?? []) {
    // "Cat #1234" when the scan looked the cat number up; the inscription id
    // otherwise (no number, or a lookup that failed). `catIds` stays the source
    // of truth for which cats are on the coin.
    const number = assets?.cats?.find(cat => cat.id === id)?.number ?? null;
    rows.push({
      key: `cat-${id}`,
      label: 'Cat',
      name: number != null ? `Cat #${number}` : truncateMiddle(id),
      linkTxid: txidOfInscriptionId(id),
    });
  }
  const rareSat = assets?.rareSat ?? null;
  if (rareSat) {
    rows.push({
      key: 'raresat',
      label: 'Rare sat',
      name: `${rareSat.rarity} · block ${rareSat.block}`,
      linkTxid: null,
    });
  }
  return rows;
}

/**
 * Hold the CTA whenever a click could spend a coin the human may not spend:
 * `checking` (scan in flight), `unavailable` (scan failed, or assets the scan
 * could not name) and `assets-blocked` (named assets on a one-address wallet).
 * `insufficient` stays live: no covering coin exists to lose, and the service
 * blocks the click.
 */
export function isApproveBlocked(model: FundingNoticeModel): boolean {
  return (
    model.kind === 'checking' || model.kind === 'unavailable' || model.kind === 'assets-blocked'
  );
}
