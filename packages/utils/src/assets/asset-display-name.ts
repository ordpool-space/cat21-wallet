import { CryptoAsset } from '@leather.io/models';

import { assertUnreachable } from '../index';

export function getAssetDisplayName(asset: CryptoAsset) {
  const { protocol } = asset;

  switch (protocol) {
    case 'nativeBtc':
      return 'bitcoin';
    case 'nativeStx':
      return 'stacks';
    case 'sip10':
      return asset.name;
    case 'sip9':
      return asset.name;
    /* HACK -- Cat21: 'inscription' branch re-added per ADR-12. cat21-ord cats
     * surface as inscription-shaped assets; their display name is the inscription
     * title (e.g. "Cat #21"). */
    case 'inscription':
      return asset.title;
    default:
      assertUnreachable(protocol);
  }
}
