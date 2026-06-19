import { useNavigate } from 'react-router';

import { HomePageSelectors } from '@tests/selectors/home.selectors';
import { Flex } from 'leather-styles/jsx';

import { RouteUrls } from '@shared/route-urls';
import { replaceRouteParams } from '@shared/utils/replace-route-params';

import { useConfigSwapsEnabled } from '@app/query/common/remote-config/remote-config.query';
import { useCurrentStacksAccount } from '@app/store/accounts/blockchain/stacks/stacks-account.hooks';
import { useCurrentNetworkState } from '@app/store/networks/networks.hooks';
import { BasicTooltip } from '@app/ui/components/tooltip/basic-tooltip';

import { SwapsDisabledTooltipLabel } from '../swaps-disabled-tooltip-label';
import { ActionButton } from './action-button';
import { FundButtons } from './fund-buttons';
import { TransferButtons } from './transfer-buttons';

export function AccountActions() {
  const navigate = useNavigate();
  const stacksAccount = useCurrentStacksAccount();
  const { isTestnet } = useCurrentNetworkState();

  const swapsEnabled = useConfigSwapsEnabled();
  const swapsBtnDisabled = !swapsEnabled || !stacksAccount || isTestnet;
  function navigateToDefaultSwapRoute() {
    return navigate(
      replaceRouteParams(RouteUrls.Swap, {
        base: 'STX',
        quote: '',
      }).replace('{chain}', 'stacks')
    );
  }

  return (
    <Flex gap={['space.01', 'space.04']} overflowX="scroll">
      <FundButtons />
      <TransferButtons />

      {/* HACK -- Cat21: Mint entry on the home action row. Lands on
          RouteUrls.Cat21Mint, a recipient + feeRate form that submits
          to Cat21MintConfirm (the existing SDK-gated confirm route).
          Sits before Swap so the cat-flow buttons cluster ahead of
          upstream Leather actions. */}
      <ActionButton
        data-testid="cat21-mint-home-button"
        onClick={() => void navigate(RouteUrls.Cat21Mint)}
        variant="outline"
      >
        Mint cat
      </ActionButton>

      <BasicTooltip label={swapsEnabled ? '' : <SwapsDisabledTooltipLabel />} side="left" asChild>
        <ActionButton
          data-testid={HomePageSelectors.SwapBtn}
          disabled={swapsBtnDisabled}
          onClick={navigateToDefaultSwapRoute}
          variant="outline"
        >
          Swap
        </ActionButton>
      </BasicTooltip>
    </Flex>
  );
}
