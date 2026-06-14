import type { Cat21Asset } from '@leather.io/models';
import { createCat21Asset } from '@leather.io/utils';

import type { OrdCat21 } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';

export function sortByBlockHeight(a: { blockHeight: number }, b: { blockHeight: number }) {
  return b.blockHeight - a.blockHeight;
}

/* HACK -- Cat21: ord-shape → Cat21Asset translator per ADR-12. cat21-ord's
 * on-the-wire field names (snake_case `content_type`, `genesis_height`) map
 * into the camelCase Cat21Asset shape the collectibles UI consumes. */
export function mapOrdCat21ToCat21Asset(cat: OrdCat21): Cat21Asset {
  return createCat21Asset({
    id: cat.id,
    number: cat.number,
    contentSrc: '',
    mimeType: cat.content_type,
    ownerAddress: cat.address ?? '',
    satPoint: cat.satpoint,
    genesisBlockHash: '',
    genesisTimestamp: cat.timestamp,
    genesisBlockHeight: cat.genesis_height,
    outputValue: '0',
  });
}

/* HACK -- Cat21: block-height sort per ADR-12, ord field name. */
export function sortOrdCat21ByBlockHeight(a: OrdCat21, b: OrdCat21) {
  return b.genesis_height - a.genesis_height;
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
