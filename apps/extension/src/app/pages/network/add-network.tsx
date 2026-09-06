import { Flex } from 'leather-styles/jsx';

import { Header } from '@app/components/layout/headers/header';
import { HeaderBackButton } from '@app/components/layout/headers/header-back-button';
import { HeaderGrid } from '@app/components/layout/headers/header-grid';

import { NetworkForm } from './components/network-form';

// HACK -- Cat21: removed `export` (upstream Stacks/Ledger/Network/Swap surface unrouted by ADR-1 BTC-L1-only scope). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
function AddNetwork() {
  return (
    <Flex height="100vh" direction="column">
      <Header px="space.04">
        <HeaderGrid leftCol={<HeaderBackButton />} rightCol={null} />
      </Header>

      <NetworkForm isEditNetworkMode={false} />
    </Flex>
  );
}
