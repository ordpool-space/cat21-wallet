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

/* HACK -- Cat21: branched form restored per ADR-12 (was a single-branch sip9
 * lookup after #2358). 'inscription' is how cat21-ord cats surface; subtitle
 * "Ordinal inscription" is intentionally generic so the existing collectibles
 * grid renders them without a cat-specific UI path. Cat-flavored title/subtitle
 * (e.g. "Cat #21" + rarity band) belongs to a later cat-specific phase. */
export function createCollectibleView(asset: NonFungibleCryptoAsset): CollectibleView {
  const key = serializeAssetId(getAssetId(asset));

  switch (asset.protocol) {
    case 'inscription':
      return {
        key,
        protocol: asset.protocol,
        title: `# ${asset.number}`,
        subtitle: 'Ordinal inscription',
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
