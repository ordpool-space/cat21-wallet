import { useNavigate } from 'react-router';

import { SettingsSelectors } from '@tests/selectors/settings.selectors';
import { Flex, styled } from 'leather-styles/jsx';

import { LEATHER_GITBOOK_DEVS, LEATHER_GUIDES_URL } from '@leather.io/constants';
/* HACK -- Cat21: GlobeTiltedIcon import dropped — only consumer was the Network
 * settings button hidden below per ADR-7 (mainnet only). */
import {
  BellAlarmIcon,
  BellIcon,
  CodeIcon,
  KeyIcon,
  MegaphoneIcon,
  // HACK -- Cat21: PulseIcon for the Cat21 Agent Mode settings entry
  // (autonomous-mode policy, "agent's heartbeat").
  PulseIcon,
  SunInCloudIcon,
  SupportIcon,
} from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';
import { analytics, openFeedbackSheet } from '@shared/utils/analytics';

import { useHasKeys } from '@app/common/hooks/auth/use-has-keys';
import { useWalletType } from '@app/common/use-wallet-type';
import { openInNewTab } from '@app/common/utils/open-in-new-tab';
import { AppVersion } from '@app/components/app-version';
import { useToast } from '@app/features/toasts/use-toast';
import { useToggleNotificationsEnabled } from '@app/store/settings/settings.actions';
import { useIsNotificationsEnabled } from '@app/store/settings/settings.selectors';

import { SettingsButton } from './components/settings-button';

export function MenuButtons() {
  const navigate = useNavigate();
  const { hasKeys } = useHasKeys();
  const { walletType } = useWalletType();
  const isNotificationsEnabled = useIsNotificationsEnabled();
  const toggleNotificationsEnabled = useToggleNotificationsEnabled();
  const toast = useToast();

  return (
    <Flex direction="column" gap="space.01" data-testid={SettingsSelectors.SettingsPage}>
      {hasKeys && walletType === 'software' && (
        <SettingsButton
          variant="chevron"
          title="Secret Key"
          data-testid={SettingsSelectors.ViewSecretKeyListItem}
          onClick={() => navigate(RouteUrls.ViewSecretKey)}
          icon={<KeyIcon />}
        />
      )}

      <SettingsButton
        data-testid={SettingsSelectors.ToggleTheme}
        variant="chevron"
        title="Theme"
        onClick={() => {
          analytics.track('click_change_theme_menu_item');
          void navigate(RouteUrls.SelectTheme);
        }}
        icon={<SunInCloudIcon />}
      />

      {/* HACK -- Cat21: Network settings button hidden per ADR-7. Cat21 Wallet
          is mainnet only; users do not switch networks. Original:
          <SettingsButton
            data-testid={SettingsSelectors.ChangeNetworkAction}
            variant="chevron"
            title="Network"
            onClick={() => {
              analytics.track('click_change_network_menu_item');
              void navigate(RouteUrls.SelectNetwork);
            }}
            icon={<GlobeTiltedIcon />}
          /> */}

      {/* HACK -- Cat21: Settings entry for the Cat21 Agent Mode wizard.
          Surfaces the iter-10 agent-policy slice (per-account caps, fee
          ceiling, counterparty + operation allowlists) without forcing
          the user to type the route URL. Wizard component lives at
          `cat21-agent-policy-wizard/cat21-agent-policy-wizard.tsx`. */}
      <SettingsButton
        data-testid="cat21-agent-mode-settings-button"
        variant="chevron"
        title="Cat21 Agent Mode"
        onClick={() => navigate(RouteUrls.Cat21AgentPolicy)}
        icon={<PulseIcon />}
      />

      <SettingsButton
        data-testid={SettingsSelectors.ToggleNotifications}
        variant="switch"
        title="Notification"
        tooltipText="Available for Bitcoin sends and receives"
        isEnabled={isNotificationsEnabled}
        onClick={() => {
          toggleNotificationsEnabled();
          toast.info(isNotificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
        }}
        icon={isNotificationsEnabled ? <BellAlarmIcon /> : <BellIcon />}
      />

      <SettingsButton
        data-testid={SettingsSelectors.GetSupportMenuItem}
        variant="external"
        title="Help"
        onClick={() => {
          openInNewTab(LEATHER_GUIDES_URL);
        }}
        icon={<SupportIcon />}
      />

      <SettingsButton
        variant="external"
        title="Dev docs"
        onClick={() => {
          openInNewTab(LEATHER_GITBOOK_DEVS);
        }}
        icon={<CodeIcon />}
      />

      <SettingsButton
        data-testid={SettingsSelectors.FeedbackMenuItem}
        variant="external"
        title="Feedback"
        onClick={() => openFeedbackSheet()}
        icon={<MegaphoneIcon />}
      />

      <Flex pt="space.03" pb="space.05" direction="column" gap="space.01">
        <styled.p textStyle="label.02">Version</styled.p>
        <AppVersion />
      </Flex>
    </Flex>
  );
}
