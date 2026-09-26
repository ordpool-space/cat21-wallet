import { useState } from 'react';

import { Stack } from 'leather-styles/jsx';

import type { CollectibleView } from '@leather.io/features';
import type { Sip9Asset } from '@leather.io/models';

import { Sip9Card } from '../collectibles/components/sip9-card';
import { CollectibleDetailsHeader } from './collectible-details-header';
import { CollectibleDetailsPageLayout } from './collectible-details-page.layout';
import { Sip9Details } from './sip9-details';

interface Sip9DetailsPageProps {
  view: CollectibleView;
  onBack(): void;
}

export function Sip9DetailsPage({ view, onBack }: Sip9DetailsPageProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  /* HACK -- Cat21: NonFungibleCryptoAsset widened to include InscriptionAsset per
   * ADR-12. This page only renders when the caller has routed by `view.protocol
   * === 'sip9'`; the runtime narrow below makes that contract typesafe. */
  if (view.asset.protocol !== 'sip9') return null;
  const asset: Sip9Asset = view.asset;
  const title = view.title || 'Stacks NFT';
  const subtitle = view.subtitle;

  return (
    <Stack width="100%" gap="space.04" data-testid="collectible-details-container">
      <CollectibleDetailsHeader title={title} subtitle={subtitle} onBack={onBack} />
      <CollectibleDetailsPageLayout protocol="sip9" media={<Sip9Card item={asset} />}>
        <Sip9Details
          asset={asset}
          isDescriptionExpanded={isDescriptionExpanded}
          onToggleDescription={() => setIsDescriptionExpanded(v => !v)}
        />
      </CollectibleDetailsPageLayout>
    </Stack>
  );
}
