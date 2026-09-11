import { useNavigate } from 'react-router';

import { Sheet, SheetHeader } from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';
import { closeWindow } from '@shared/utils';

import { doesBrowserSupportWebUsbApi, whenPageMode } from '@app/common/utils';
import { openIndexPageInNewTab } from '@app/common/utils/open-in-new-tab';

import { immediatelyAttemptLedgerConnection } from '../../hooks/use-when-reattempt-ledger-connection';
import { ConnectLedger } from './connect-ledger';

// HACK -- Cat21: removed `export` (upstream Stacks/Ledger/Network/Swap surface unrouted by ADR-1 BTC-L1-only scope). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
function ConnectLedgerStart() {
  const navigate = useNavigate();

  function pageModeRoutingAction(url: string) {
    return whenPageMode({
      full() {
        void navigate(url, {
          replace: true,
          state: {
            [immediatelyAttemptLedgerConnection]: true,
            fromLocation: { pathname: RouteUrls.Onboarding },
          },
        });
      },
      popup() {
        void openIndexPageInNewTab(url);
        closeWindow();
      },
    });
  }

  function connectChain(chain: string) {
    const supportsWebUsbAction = pageModeRoutingAction(
      RouteUrls.Onboarding + `/${chain}/` + RouteUrls.ConnectLedger
    );
    const doesNotSupportWebUsbAction = pageModeRoutingAction(
      RouteUrls.Onboarding + '/' + RouteUrls.LedgerUnsupportedBrowser
    );

    return doesBrowserSupportWebUsbApi() ? supportsWebUsbAction() : doesNotSupportWebUsbAction();
  }

  return (
    <Sheet isShowing header={<SheetHeader />} onClose={() => navigate('../')}>
      <ConnectLedger
        connectBitcoin={() => connectChain('bitcoin')}
        connectStacks={() => connectChain('stacks')}
        showInstructions
      />
    </Sheet>
  );
}
