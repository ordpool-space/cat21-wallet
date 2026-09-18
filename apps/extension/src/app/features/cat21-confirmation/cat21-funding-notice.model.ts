import type { MintStatus, UtxoAssetDetail } from 'ordpool-sdk/core';

/**
 * The funding preview's state, as the confirmation route sees it. It is the SDK
 * `simulate*` outcome, plus the states that exist BEFORE a resolved outcome:
 *
 *   - `not-applicable` — this action has no funding preview wired (only mint
 *     today). The dialog behaves exactly as before: no notice, CTA ungated.
 *   - `loading` — the simulate is in flight. Funding safety is not yet known, so
 *     the CTA must be held (the HARD RULE's "still scanning → DISABLED").
 *   - `error`  — the simulate / content scan failed. Fail closed: block, do not
 *     let a click proceed on an unknown funding picture.
 *   - the four `MintStatus` values once resolved.
 */
export type FundingPreviewState =
  | { status: 'not-applicable' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: MintStatus; assets: UtxoAssetDetail | null };

/**
 * The pure decision behind the funding-safety notice, split from the React
 * component so the branching — which is the safety-relevant part — is unit
 * testable without a render harness (the wallet's vitest setup can't resolve
 * `leather-styles/jsx`, and this logic has nothing to do with styling anyway).
 *
 * The component renders straight from this model and overlays only the ONE thing
 * that can't be decided synchronously: a rune's etching-transaction link, which
 * needs an ord lookup (`resolveRuneEtchingTxid`).
 */
export type FundingNoticeModel =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'assets'; intro: string; rows: FundingAssetRow[] };

export interface FundingAssetRow {
  /** Stable React key. */
  key: string;
  label: 'Inscription' | 'Rune' | 'Cat' | 'Rare sat';
  /** Display text: a truncated id, a rune name, or a rare-sat description. */
  name: string;
  /**
   * The txid this row links to, when it is known synchronously (an inscription
   * or cat id embeds its txid). `null` for a rare sat (nothing to link) and for
   * a rune (its etching tx is resolved asynchronously by the component; until
   * then the row is plain text — the reserved-rune guard renders as text too).
   */
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

/**
 * Map the funding preview state to what the notice shows:
 *   - `not-applicable` / `ready` → nothing (clean funding; dialog byte-identical).
 *   - `loading`                  → a "checking" line (CTA held while unknown).
 *   - `error`                    → blocked, "content-check failed" (fail closed).
 *   - `insufficient`             → blocked, "add funds".
 *   - `expert-required`          → blocked, "content-check failed" (a scan miss;
 *                                   a separate-payment-address wallet never
 *                                   reaches expert-required for the asset-only
 *                                   case — that becomes `asset-notice`).
 *   - `asset-notice`             → the named-asset rows.
 */
export function describeFundingNotice(state: FundingPreviewState): FundingNoticeModel {
  if (state.status === 'not-applicable') return { kind: 'none' };
  if (state.status === 'loading') return { kind: 'checking' };
  if (state.status === 'error') return { kind: 'blocked', reason: SCAN_FAILED_REASON };
  if (state.status === 'ready') return { kind: 'none' };
  if (state.status === 'insufficient') return { kind: 'blocked', reason: INSUFFICIENT_REASON };
  if (state.status === 'expert-required') return { kind: 'blocked', reason: SCAN_FAILED_REASON };

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
 * The CTA is held whenever funding safety is not established: while the preview
 * is loading, when it failed, and when it resolved to a blocking status
 * (insufficient / scan-pending). `ready` and `asset-notice` leave it live — a
 * separate-payment-address wallet lets the human proceed on an asset coin AFTER
 * seeing the notice. `none` (not-applicable / ready) never blocks.
 */
export function isApproveBlocked(model: FundingNoticeModel): boolean {
  return model.kind === 'checking' || model.kind === 'blocked';
}
