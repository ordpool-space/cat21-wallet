import { type NonFungibleCryptoAsset } from '@leather.io/models';
import { getStacksContractAssetName } from '@leather.io/stacks';
import { assertUnreachable, getAssetId, serializeAssetId } from '@leather.io/utils';

export interface CollectibleView {
  key: string;
  protocol: NonFungibleCryptoAsset['protocol'];
  title: string;
  subtitle: string;
  asset: NonFungibleCryptoAsset;
  isBns?: boolean;
}

/* HACK -- Cat21: branched form per ADR-12. The cat protocol branch renders
 * cats with a "Cat #N" title and a "CAT-21" subtitle so the existing
 * collectibles grid surfaces them without a cat-specific UI path. */
export function createCollectibleView(asset: NonFungibleCryptoAsset): CollectibleView {
  const key = serializeAssetId(getAssetId(asset));

  switch (asset.protocol) {
    case 'cat21':
      return {
        key,
        protocol: asset.protocol,
        title: `Cat #${asset.number}`,
        subtitle: 'CAT-21',
        asset,
      };
    case 'sip9': {
      const assetName = getStacksContractAssetName(asset.assetId);
      const isBns =
        asset.assetId.toLowerCase().endsWith('.bns::names') ||
        assetName?.toUpperCase() === 'BNS-V2';
      return {
        key,
        protocol: asset.protocol,
        title: asset.name || assetName || 'Unknown collectible',
        subtitle: asset.collection?.name ?? 'Stacks collectible',
        asset,
        isBns,
      };
    }
    default:
      return assertUnreachable(asset);
  }
}

export function createCollectibleViews(assets: NonFungibleCryptoAsset[]) {
  return assets.map(createCollectibleView);
}
