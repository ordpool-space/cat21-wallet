import type { UtxoAssetDetail } from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

import {
  describeFundingNotice,
  truncateMiddle,
  txidOfInscriptionId,
} from './cat21-funding-notice.model';

/**
 * `describeFundingNotice` is the pure decision behind the funding-safety notice
 * — the single most safety-relevant branch in the manual cat flow. Each case
 * carries a real obligation, and each is mutation-checkable here without a
 * render harness:
 *
 *   - `ready`  → `none`. The byte-identity guarantee: a clean funding leaves the
 *     dialog exactly as the shipped safe screenshot. Flipping this to render the
 *     panel would put a "carries assets" box under a perfectly safe mint.
 *   - `asset-notice` → NAME each asset (not count it), so the person reads WHICH
 *     inscription / rune / cat / rare sat sits on the coin they'd pay to miners.
 *   - `insufficient` / `expert-required` → the blocking reason.
 */

const empty: UtxoAssetDetail = {
  inscriptionIds: [],
  runeNames: [],
  catIds: [],
  rareSat: null,
};

const INSCRIPTION_ID = `${'ab'.repeat(32)}i0`;
const CAT_ID = `${'cd'.repeat(32)}i0`;

describe('describeFundingNotice', () => {
  it('shows NOTHING on a clean funding (ready) — the safe dialog stays byte-identical', () => {
    // Mutation: change this to anything but `none` and the safe screenshot grows
    // a scary asset box. Even with (impossibly) populated assets, ready is none.
    expect(describeFundingNotice('ready', empty)).toEqual({ kind: 'none' });
    expect(describeFundingNotice('ready', { ...empty, inscriptionIds: [INSCRIPTION_ID] })).toEqual({
      kind: 'none',
    });
  });

  it('blocks with an "add funds" reason on insufficient', () => {
    const model = describeFundingNotice('insufficient', null);
    expect(model.kind).toBe('blocked');
    if (model.kind === 'blocked') expect(model.reason).toMatch(/Add funds/u);
  });

  it('blocks with a "content-check failed" reason on expert-required (a scan miss)', () => {
    const model = describeFundingNotice('expert-required', null);
    expect(model.kind).toBe('blocked');
    if (model.kind === 'blocked') expect(model.reason).toMatch(/content-checked/u);
  });

  it('NAMES an inscription and links it to its tx', () => {
    const model = describeFundingNotice('asset-notice', {
      ...empty,
      inscriptionIds: [INSCRIPTION_ID],
    });
    expect(model.kind).toBe('assets');
    if (model.kind !== 'assets') return;
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      label: 'Inscription',
      name: truncateMiddle(INSCRIPTION_ID),
      linkTxid: txidOfInscriptionId(INSCRIPTION_ID),
    });
    // The link txid is the inscription id WITHOUT the `i0` suffix.
    expect(model.rows[0].linkTxid).toBe('ab'.repeat(32));
  });

  it('NAMES a rune by its ord spelling and defers its link to async resolution', () => {
    const model = describeFundingNotice('asset-notice', {
      ...empty,
      runeNames: ['UNCOMMON•GOODS'],
    });
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
    const model = describeFundingNotice('asset-notice', { ...empty, catIds: [CAT_ID] });
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows[0]).toMatchObject({
      label: 'Cat',
      name: truncateMiddle(CAT_ID),
      linkTxid: 'cd'.repeat(32),
    });
  });

  it('NAMES a rare sat by rarity + block, with no link', () => {
    const model = describeFundingNotice('asset-notice', {
      ...empty,
      rareSat: { sat: '123456', block: 840000, rarity: 'uncommon' },
    });
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows[0].label).toBe('Rare sat');
    expect(model.rows[0].name).toContain('uncommon');
    expect(model.rows[0].name).toContain('840000');
    expect(model.rows[0].linkTxid).toBeNull();
  });

  it('lists every asset class present on one coin, in inscription/rune/cat/rare-sat order', () => {
    const model = describeFundingNotice('asset-notice', {
      inscriptionIds: [INSCRIPTION_ID],
      runeNames: ['UNCOMMON•GOODS'],
      catIds: [CAT_ID],
      rareSat: { sat: '1', block: 5, rarity: 'epic' },
    });
    if (model.kind !== 'assets') throw new Error('expected assets');
    expect(model.rows.map(r => r.label)).toEqual(['Inscription', 'Rune', 'Cat', 'Rare sat']);
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
