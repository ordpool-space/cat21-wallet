import type { ExpertRequiredCause, UtxoAssetDetail } from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

import {
  type FundingPreviewState,
  describeFundingNotice,
  fundingPreviewCoin,
  isApproveBlocked,
  namedNoticeChrome,
  noticeRuneNames,
  truncateMiddle,
  txidOfInscriptionId,
} from './cat21-funding-notice.model';

/**
 * `describeFundingNotice` + `isApproveBlocked` are the pure decision behind the
 * funding-safety notice AND the CTA gate — the single most safety-relevant
 * branch in the manual cat flow. Deriving both from ONE model is what stops the
 * notice and the button from disagreeing. Each case is mutation-checkable here
 * without a render harness:
 *
 *   - `ready` / `not-applicable` → `none`, CTA live. The byte-identity guarantee:
 *     a clean funding leaves the dialog exactly as the shipped safe screenshot.
 *   - `loading`  → `checking`, CTA HELD. Funding safety isn't known yet, so a
 *     click must not be able to outrun the answer and spend an asset coin.
 *   - `error`    → `blocked`, CTA HELD. Fail closed on a scan/simulate failure.
 *   - `asset-notice` → NAME each asset (not count it), CTA live (the human
 *     decides on a separate-payment-address wallet).
 *   - `insufficient` / `expert-required` → `blocked`, CTA HELD.
 */

const empty: UtxoAssetDetail = {
  inscriptionIds: [],
  runeNames: [],
  catIds: [],
  rareSat: null,
};

const INSCRIPTION_ID = `${'ab'.repeat(32)}i0`;
const CAT_ID = `${'cd'.repeat(32)}i0`;

function assetNotice(assets: Partial<UtxoAssetDetail>): FundingPreviewState {
  return {
    status: 'asset-notice',
    assets: { ...empty, ...assets },
    fundingUtxo: null,
    cause: null,
  };
}

describe('describeFundingNotice', () => {
  it('shows NOTHING and leaves the CTA live on a clean funding (ready)', () => {
    // Mutation: change this to anything but `none` and the safe screenshot grows
    // a scary asset box under a perfectly safe mint.
    const model = describeFundingNotice({
      status: 'ready',
      assets: null,
      fundingUtxo: null,
      cause: null,
    });
    expect(model).toEqual({ kind: 'none' });
    expect(isApproveBlocked(model)).toBe(false);
  });

  it('shows NOTHING and leaves the CTA live when no preview is wired (not-applicable)', () => {
    const model = describeFundingNotice({ status: 'not-applicable' });
    expect(model).toEqual({ kind: 'none' });
    expect(isApproveBlocked(model)).toBe(false);
  });

  it('HOLDS the CTA with a checking line while the preview is loading', () => {
    // The safety-critical gate: until funding safety is known, a click must not
    // proceed. Flipping this to `none` would let a click in the async window
    // spend an asset coin before the notice ever renders.
    const model = describeFundingNotice({ status: 'loading' });
    expect(model.kind).toBe('checking');
    expect(isApproveBlocked(model)).toBe(true);
  });

  it('HOLDS the CTA and fails closed when the preview errors (contents unknown)', () => {
    // A failed scan means we do not know what the coin carries, so a click could
    // spend an asset without the notice ever showing. Hold the CTA.
    const model = describeFundingNotice({ status: 'error' });
    expect(model.kind).toBe('unavailable');
    expect(isApproveBlocked(model)).toBe(true);
  });

  it('HOLDS the CTA on expert-required (a scan miss — contents unknown)', () => {
    const model = describeFundingNotice({
      status: 'expert-required',
      assets: null,
      fundingUtxo: null,
      cause: null,
    });
    expect(model.kind).toBe('unavailable');
    if (model.kind === 'unavailable') expect(model.reason).toMatch(/content-checked/u);
    expect(isApproveBlocked(model)).toBe(true);
  });

  // `expert-required` carries the SDK's `expertRequiredCause`, and the notice
  // reads it instead of assuming a scan miss. Per cause, the GATE (CTA held) and
  // the JUSTIFICATION (what the notice says) are separate tests: a gate-only test
  // stays green while the warning beside it disappears.
  function expertRequired(
    cause: ExpertRequiredCause | null,
    assets: UtxoAssetDetail | null = null
  ): FundingPreviewState {
    return { status: 'expert-required', assets, fundingUtxo: null, cause };
  }

  it('expert-required, cause unknown-content: CTA HELD', () => {
    expect(isApproveBlocked(describeFundingNotice(expertRequired('unknown-content')))).toBe(true);
  });

  it('expert-required, cause unknown-content: unavailable with the scan-failed reason', () => {
    const model = describeFundingNotice(expertRequired('unknown-content'));
    expect(model.kind).toBe('unavailable');
    if (model.kind === 'unavailable') expect(model.reason).toMatch(/could not be content-checked/u);
  });

  it('expert-required, cause unnamed-assets: CTA HELD', () => {
    expect(isApproveBlocked(describeFundingNotice(expertRequired('unnamed-assets')))).toBe(true);
  });

  it('expert-required, cause unnamed-assets: unavailable with its own reason (assets found, none named)', () => {
    const model = describeFundingNotice(expertRequired('unnamed-assets'));
    expect(model.kind).toBe('unavailable');
    if (model.kind !== 'unavailable') return;
    // Not the scan-failure text: the scan worked and found assets it could not
    // identify, so "the index is unreachable" would be false.
    expect(model.reason).toMatch(/could not identify/u);
    expect(model.reason).not.toMatch(/unreachable/u);
  });

  it('expert-required, cause named-assets (one-address account): CTA HELD', () => {
    const model = describeFundingNotice(
      expertRequired('named-assets', { ...empty, inscriptionIds: [INSCRIPTION_ID] })
    );
    expect(isApproveBlocked(model)).toBe(true);
  });

  it('expert-required, cause named-assets (one-address account): a held notice that NAMES each asset with the same rows as asset-notice', () => {
    const assets: UtxoAssetDetail = {
      inscriptionIds: [INSCRIPTION_ID],
      runeNames: ['UNCOMMON•GOODS'],
      catIds: [CAT_ID],
      rareSat: { sat: '1', block: 5, rarity: 'epic' },
    };
    const blocked = describeFundingNotice(expertRequired('named-assets', assets));
    const notice = describeFundingNotice(assetNotice(assets));
    if (blocked.kind !== 'assets-blocked' || notice.kind !== 'assets') {
      throw new Error(`expected assets-blocked + assets, got ${blocked.kind} + ${notice.kind}`);
    }
    expect(blocked.rows).toEqual(notice.rows);
    expect(blocked.rows.map(r => r.label)).toEqual(['Inscription', 'Rune', 'Cat', 'Rare sat']);
    // It says why nothing is spent, not "continue only if you mean to".
    expect(blocked.intro).toMatch(/none is spent/u);
    expect(blocked.intro).not.toBe(notice.intro);
  });

  it('expert-required, cause null: CTA HELD', () => {
    expect(isApproveBlocked(describeFundingNotice(expertRequired(null)))).toBe(true);
  });

  it('expert-required, cause null: fails closed to the scan-failed reason', () => {
    const model = describeFundingNotice(expertRequired(null));
    expect(model.kind).toBe('unavailable');
    if (model.kind === 'unavailable') expect(model.reason).toMatch(/could not be content-checked/u);
  });

  it('scanning: shows the checking line and HOLDS the CTA (never an empty asset notice)', () => {
    const model = describeFundingNotice({
      status: 'scanning',
      assets: null,
      fundingUtxo: null,
      cause: null,
    });
    expect(model).toEqual({ kind: 'checking' });
    expect(isApproveBlocked(model)).toBe(true);
  });

  it('shows "add funds" on insufficient but LEAVES the CTA live (no coin to lose)', () => {
    // There is provably no covering coin, so a click cannot lose an asset — the
    // service blocks it, and a cap violation (checked before funding) surfaces
    // first. Disabling here would hide that more-actionable message AND break the
    // real-extension caps-manual-rejection proof, which clicks Approve on an
    // unfunded wallet. Flipping isApproveBlocked to true here is the regression.
    const model = describeFundingNotice({
      status: 'insufficient',
      assets: null,
      fundingUtxo: null,
      cause: null,
    });
    expect(model.kind).toBe('insufficient');
    if (model.kind === 'insufficient') expect(model.reason).toMatch(/Add funds/u);
    expect(isApproveBlocked(model)).toBe(false);
  });

  it('NAMES an inscription, links it to its tx, and leaves the CTA live', () => {
    const model = describeFundingNotice(assetNotice({ inscriptionIds: [INSCRIPTION_ID] }));
    expect(model.kind).toBe('assets');
    if (model.kind !== 'assets') return;
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      label: 'Inscription',
      name: truncateMiddle(INSCRIPTION_ID),
      linkTxid: txidOfInscriptionId(INSCRIPTION_ID),
    });
    expect(model.rows[0].linkTxid).toBe('ab'.repeat(32));
    // Named, not blocked: the human may proceed after seeing it.
    expect(isApproveBlocked(model)).toBe(false);
  });

  it('NAMES a rune by its ord spelling and defers its link to async resolution', () => {
    const model = describeFundingNotice(assetNotice({ runeNames: ['UNCOMMON•GOODS'] }));
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows[0]).toMatchObject({
      label: 'Rune',
      name: 'UNCOMMON•GOODS',
      // No synchronous link: the etching tx is resolved by the component. A
      // reserved rune resolves to null there, so the row stays plain text.
      linkTxid: null,
      runeName: 'UNCOMMON•GOODS',
    });
  });

  it('NAMES a cat and links it to its tx', () => {
    const model = describeFundingNotice(assetNotice({ catIds: [CAT_ID] }));
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows[0]).toMatchObject({
      label: 'Cat',
      name: truncateMiddle(CAT_ID),
      linkTxid: 'cd'.repeat(32),
    });
  });

  it('NAMES a rare sat by rarity + block, with no link', () => {
    const model = describeFundingNotice(
      assetNotice({ rareSat: { sat: '123456', block: 840000, rarity: 'uncommon' } })
    );
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows[0].label).toBe('Rare sat');
    expect(model.rows[0].name).toContain('uncommon');
    expect(model.rows[0].name).toContain('840000');
    expect(model.rows[0].linkTxid).toBeNull();
  });

  it('lists every asset class present on one coin, in inscription/rune/cat/rare-sat order', () => {
    const model = describeFundingNotice({
      status: 'asset-notice',
      assets: {
        inscriptionIds: [INSCRIPTION_ID],
        runeNames: ['UNCOMMON•GOODS'],
        catIds: [CAT_ID],
        rareSat: { sat: '1', block: 5, rarity: 'epic' },
      },
      fundingUtxo: null,
      cause: null,
    });
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows.map(r => r.label)).toEqual(['Inscription', 'Rune', 'Cat', 'Rare sat']);
  });
});

describe('fundingPreviewCoin', () => {
  const coin = { txid: 'a'.repeat(64), vout: 0, value: 50_000 };

  it('pins the asset-notice coin, the one the human was shown with its assets', () => {
    expect(
      fundingPreviewCoin({ status: 'asset-notice', assets: null, fundingUtxo: coin, cause: null })
    ).toBe(coin);
  });

  it('does NOT pin a ready coin, so a later asset finding on it is refused, not spent', () => {
    // A pin lets execution spend the coin whatever a click-time scan says; a
    // clean preview named nothing, so the blocking default must decide.
    const state: FundingPreviewState = {
      status: 'ready',
      assets: null,
      fundingUtxo: coin,
      cause: null,
    };
    expect(fundingPreviewCoin(state)).toBeNull();
  });

  it('returns null when the preview has no pick (blocked) or is not a preview state', () => {
    // Blocked / insufficient previews resolved no coin.
    expect(
      fundingPreviewCoin({
        status: 'expert-required',
        assets: null,
        fundingUtxo: null,
        cause: null,
      })
    ).toBeNull();
    // The non-MintStatus states carry no coin, so a caller pins nothing.
    expect(fundingPreviewCoin({ status: 'not-applicable' })).toBeNull();
    expect(fundingPreviewCoin({ status: 'loading' })).toBeNull();
    expect(fundingPreviewCoin({ status: 'error' })).toBeNull();
  });
});

describe('fail closed on a status the model does not know', () => {
  it('holds the CTA with the scan-failure reason for a status a later SDK might add', () => {
    // JSON.parse yields an untyped value, so a future status reaches the model
    // the way an SDK bump would: past the types, at runtime.
    const future: FundingPreviewState = JSON.parse(
      '{"status":"some-future-status","assets":null,"fundingUtxo":null,"cause":null}'
    );
    const model = describeFundingNotice(future);
    expect(model.kind).toBe('unavailable');
    expect(isApproveBlocked(model)).toBe(true);
  });
});

describe('named-notice render decisions', () => {
  const assets: UtxoAssetDetail = { ...empty, runeNames: ['UNCOMMON•GOODS'] };

  it('the held notice carries its own testid and heading, so the CTA gate is observable', () => {
    const blocked = describeFundingNotice({
      status: 'expert-required',
      assets,
      fundingUtxo: null,
      cause: 'named-assets',
    });
    if (blocked.kind !== 'assets-blocked')
      throw new Error(`expected assets-blocked, got ${blocked.kind}`);
    expect(namedNoticeChrome(blocked)).toEqual({
      testId: 'cat21-funding-notice-blocked',
      heading: 'The recommended coin carries assets',
    });
    const notice = describeFundingNotice(assetNotice(assets));
    if (notice.kind !== 'assets') throw new Error(`expected assets, got ${notice.kind}`);
    expect(namedNoticeChrome(notice)).toEqual({
      testId: 'cat21-funding-notice',
      heading: 'This funding coin carries assets',
    });
  });

  it('resolves rune etching links for the held notice as for the proceed-able one', () => {
    const blocked = describeFundingNotice({
      status: 'expert-required',
      assets,
      fundingUtxo: null,
      cause: 'named-assets',
    });
    expect(noticeRuneNames(blocked)).toEqual(['UNCOMMON•GOODS']);
    expect(noticeRuneNames(describeFundingNotice(assetNotice(assets)))).toEqual(['UNCOMMON•GOODS']);
    expect(noticeRuneNames({ kind: 'checking' })).toEqual([]);
  });
});

describe('truncateMiddle', () => {
  it('keeps short values whole', () => {
    expect(truncateMiddle('short')).toBe('short');
  });

  it('collapses a long id to head…tail', () => {
    expect(truncateMiddle('0123456789abcdef0123456789abcdef')).toBe('01234567…89abcdef');
  });
});

describe('txidOfInscriptionId', () => {
  it('strips the iN suffix', () => {
    expect(txidOfInscriptionId(`${'ff'.repeat(32)}i12`)).toBe('ff'.repeat(32));
  });
});
