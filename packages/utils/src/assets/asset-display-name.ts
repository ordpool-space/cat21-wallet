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
    /* HACK -- Cat21: cat protocol branch per ADR-12. Cats display by their
     * canonical title (e.g. "Cat #21"). */
    case 'cat21':
      return asset.title;
    default:
      assertUnreachable(protocol);
  }
}
