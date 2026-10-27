import type { MintStatus, UtxoAssetDetail } from 'ordpool-sdk/core';

/**
 * The funding preview state: the resolved `MintStatus`, plus `not-applicable`
 * (no preview wired), `loading` (simulate in flight), and `error` (scan failed).
 */
export type FundingPreviewState =
  | { status: 'not-applicable' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: MintStatus; assets: UtxoAssetDetail | null };

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
  | { kind: 'assets'; intro: string; rows: FundingAssetRow[] };

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
const ASSET_NOTICE_INTRO =
  'No plain Bitcoin coin covers this action, so it would spend the coin below to the miners along with everything on it. Continue only if you mean to.';

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
  if (state.status === 'expert-required')
    return { kind: 'unavailable', reason: SCAN_FAILED_REASON };

  const { assets } = state;
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
    rows.push({
      key: `cat-${id}`,
      label: 'Cat',
      name: truncateMiddle(id),
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
  return { kind: 'assets', intro: ASSET_NOTICE_INTRO, rows };
}

/**
 * Hold the CTA only when a click could spend a coin whose contents are unknown:
 * `checking` (scan in flight) and `unavailable` (scan failed). `insufficient`
 * stays live: no covering coin exists to lose, and the service blocks the click.
 */
export function isApproveBlocked(model: FundingNoticeModel): boolean {
  return model.kind === 'checking' || model.kind === 'unavailable';
}
