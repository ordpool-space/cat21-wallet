import type { Cat21Asset } from '@leather.io/models';
import { createCat21Asset } from '@leather.io/utils';

import type { OrdCat21 } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';

export function sortByBlockHeight(a: { blockHeight: number }, b: { blockHeight: number }) {
  return b.blockHeight - a.blockHeight;
}

/* HACK -- Cat21: ord-shape → Cat21Asset translator per ADR-12. cat21-ord's
 * on-the-wire field names (snake_case `content_type`, `height`) map into the
 * camelCase Cat21Asset shape the collectibles UI consumes. `content_type` is
 * null for every cat (no envelope, no content bytes), and blockHash + fee +
 * weight are carried through because they are what renders the cat locally. */
export function mapOrdCat21ToCat21Asset(cat: OrdCat21): Cat21Asset {
  return createCat21Asset({
    id: cat.id,
    number: cat.number,
    contentSrc: '',
    /* ord reports content_type: null for every cat, because nothing was ever
     * inscribed. The asset still has content — the SVG drawn from the mint
     * txid — so it is declared as what it actually is. Left undefined, the
     * upstream `!mimeType` guard fires for every cat and returns src: ''. */
    mimeType: cat.content_type ?? 'image/svg+xml',
    ownerAddress: cat.address ?? '',
    satPoint: cat.satpoint,
    genesisBlockHash: cat.block_hash ?? '',
    genesisTimestamp: cat.timestamp,
    genesisBlockHeight: cat.height,
    fee: cat.fee,
    weight: cat.weight,
    outputValue: cat.value?.toString() ?? '0',
  });
}

/* HACK -- Cat21: block-height sort per ADR-12, ord field name. Newest first,
 * matching the order upstream presented inscriptions in.
 *
 * Upstream's version returned `b.last_transfer ?? (b.genesis - (a.last_transfer
 * ?? a.genesis))`, so whenever `b.last_transfer` was set it returned a raw
 * block height as the comparator instead of a difference. ord gives one height
 * per cat, so the subtraction is all this needs. */
export function sortOrdCat21ByBlockHeight(a: OrdCat21, b: OrdCat21) {
  return b.height - a.height;
}

const lpTokenPatterns = [
  '::pool-token-id',
  '::lp-token',
  '::liquidity-token',
  '.dlmm-pool-',
  '.amm-pool-',
];

export function isLpToken(assetIdentifier: string): boolean {
  const lowerIdentifier = assetIdentifier.toLowerCase();
  return lpTokenPatterns.some(pattern => lowerIdentifier.includes(pattern));
}
