import type { InscriptionAsset } from '@leather.io/models';
import { createInscriptionAsset } from '@leather.io/utils';

import type { OrdInscription } from '../infrastructure/api/cat21-ord/cat21-ord-api.client';

export function sortByBlockHeight(a: { blockHeight: number }, b: { blockHeight: number }) {
  return b.blockHeight - a.blockHeight;
}

/* HACK -- Cat21: ord-shape → InscriptionAsset translator per ADR-12. Replaces
 * the BIS-shape mapper (`mapBisInscriptionToCreateInscriptionData`) that was
 * removed in #2358. cat21-ord's response field names differ from BIS's; the
 * mapping is otherwise structurally identical. */
export function mapOrdInscriptionToInscriptionAsset(
  inscription: OrdInscription
): InscriptionAsset {
  return createInscriptionAsset({
    id: inscription.id,
    number: inscription.number,
    contentSrc: '',
    mimeType: inscription.content_type,
    ownerAddress: inscription.address ?? '',
    satPoint: inscription.satpoint,
    genesisBlockHash: '',
    genesisTimestamp: inscription.timestamp,
    genesisBlockHeight: inscription.genesis_height,
    outputValue: '0',
  });
}

/* HACK -- Cat21: block-height sort per ADR-12, ord field name. */
export function sortOrdInscriptionByBlockHeight(a: OrdInscription, b: OrdInscription) {
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
