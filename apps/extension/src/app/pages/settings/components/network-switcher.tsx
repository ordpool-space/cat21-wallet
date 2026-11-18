/* HACK -- Cat21: NetworkSwitcherBadge is a no-op per ADR-7 (mainnet only).
 * The component stays exported so call sites compile, but renders null. Upstream
 * imports/hooks/JSX are commented out to keep the diff against leather-io/mono
 * legible on quarterly upstream sync. Originals:
 *
 * import { useNavigate } from 'react-router';
 * import { HomePageSelectors } from '@tests/selectors/home.selectors';
 * import { styled } from 'leather-styles/jsx';
 * import { ChainId } from '@leather.io/models';
 * import { NetworkModeBadge } from '@leather.io/ui';
 * import { RouteUrls } from '@shared/route-urls';
 * import { useCurrentNetworkState } from '@app/store/networks/networks.hooks';
 * import { useNetworkBadgeAlwaysOn } from '@app/store/settings/settings.selectors';
 *
 * export function NetworkSwitcherBadge() {
 *   const { chain, name: chainName } = useCurrentNetworkState();
 *   const navigate = useNavigate();
 *   const networkBadgeAlwaysOn = useNetworkBadgeAlwaysOn();
 *   return (
 *     <styled.button onClick={() => { void navigate(RouteUrls.SelectNetwork); }}>
 *       <NetworkModeBadge
 *         data-testid={HomePageSelectors.NetworkSwitcher}
 *         isVisible={networkBadgeAlwaysOn || chain.stacks.chainId !== ChainId.Mainnet}
 *         name={chainName}
 *       />
 *     </styled.button>
 *   );
 * }
 */
export function NetworkSwitcherBadge() {
  return null;
}
