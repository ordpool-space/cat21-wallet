import { Route, createHashRouter, createRoutesFromElements } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import * as Sentry from '@sentry/react';

import { RouteUrls } from '@shared/route-urls';

import { Content } from '@app/components/layout/layouts/content.layout';
import { SwitchAccountLayout } from '@app/components/layout/layouts/switch-account.layout';
import { LoadingSpinner } from '@app/components/loading-spinner';
import { Container } from '@app/features/container/container';
import { HomeHeader } from '@app/features/container/headers/home.header';
/* HACK -- Cat21: Stacks + Ledger imports hidden per ADR-1 + ADR-7.
 * Stacks routes are non-BTC-L1. Ledger routes are hidden because Cat21 Wallet is a
 * hot wallet by design — hardware wallet flows are incompatible with agent-mode
 * auto-confirm. Original imports preserved here for upstream-merge sanity:
 * import { CancelStacksTransactionSheet } from '@app/features/dialogs/transaction-action-dialog/cancel-stacks-transaction-sheet';
 * import { IncreaseStacksTransactionFeeSheet } from '@app/features/dialogs/transaction-action-dialog/increase-stacks-fee-sheet';
 * import { ledgerBitcoinTxSigningRoutes } from '@app/features/ledger/flows/bitcoin-tx-signing/ledger-bitcoin-sign-tx-container';
 * import { ledgerJwtSigningRoutes } from '@app/features/ledger/flows/jwt-signing/ledger-sign-jwt.routes';
 * import { requestBitcoinKeysRoutes } from '@app/features/ledger/flows/request-bitcoin-keys/ledger-request-bitcoin-keys';
 * import { requestStacksKeysRoutes } from '@app/features/ledger/flows/request-stacks-keys/ledger-request-stacks-keys';
 * import { ledgerStacksTxSigningRoutes } from '@app/features/ledger/flows/stacks-tx-signing/ledger-sign-stacks-tx-container';
 * import { UnsupportedBrowserLayout } from '@app/features/ledger/generic-steps';
 * import { ConnectLedgerStart } from '@app/features/ledger/generic-steps/connect-device/connect-ledger-start';
 */
import { IncreaseBtcFeeSheet } from '@app/features/dialogs/transaction-action-dialog/increase-btc-fee-dialog';
import { RouterErrorBoundary } from '@app/features/errors/app-error-boundary';
import { useFlags } from '@app/features/feature-flags';
import { TokenDetails } from '@app/features/token/token-details';
import { FundPage } from '@app/pages/fund/fund';
import { Home } from '@app/pages/home/home';
import { LegacyAccountAuth } from '@app/pages/legacy-account-auth/legacy-account-auth';
import { ManageTokensPage } from '@app/pages/manage-tokens/manage-tokens';
/* HACK -- Cat21: Network management imports hidden per ADR-7. Cat21 Wallet is
 * mainnet-only; users do not add or switch networks. Originals:
 * import { AddNetwork as CurrentAddNetwork } from '@app/pages/network/add-network';
 * import { EditNetwork as CurrentEditNetwork } from '@app/pages/network/edit-network';
 * import { SelectNetwork } from '@app/pages/network/select-network';
 */
import { NotFoundPage } from '@app/pages/not-found/not-found';
import { BackUpSecretKeyPage } from '@app/pages/onboarding/back-up-secret-key/back-up-secret-key';
import { SetPasswordPage } from '@app/pages/onboarding/set-password/set-password';
import { ForgotPassword } from '@app/pages/onboarding/sign-in/forgot-password';
import { SignIn } from '@app/pages/onboarding/sign-in/sign-in';
import { WelcomePage } from '@app/pages/onboarding/welcome/welcome';
import { RequestError } from '@app/pages/request-error/request-error';
import { SellPage } from '@app/pages/sell/sell';
/* HACK -- Cat21: BroadcastError import hidden — only consumer was the Stacks
 * increase-fee broadcast-error route, which is gone per ADR-1. Original:
 * import { BroadcastError } from '@app/pages/send/broadcast-error/broadcast-error';
 */
import { sendCryptoAssetFormRoutes } from '@app/pages/send/send-crypto-asset-form/send-crypto-asset-form.routes';
import { SettingsPage } from '@app/pages/settings/settings';
/* HACK -- Cat21: stacksSwapLegacyRoutes import hidden per ADR-1 (non-BTC-L1). */
import { bitcoinSwapLegacyRoutes } from '@app/pages/swap-legacy/swap.routes';
import { swapRoutes } from '@app/pages/swap/swap.routes';
import { SelectTheme } from '@app/pages/theme/select-theme';
import { UnauthorizedRequest } from '@app/pages/unauthorized-request/unauthorized-request';
import { Unlock } from '@app/pages/unlock';
import { ViewSecretKey } from '@app/pages/view-secret-key/view-secret-key';
import { AccountGate } from '@app/routes/account-gate';
import { ReceiveModalWrapper } from '@app/routes/components/receive-modal-wrapper';
import { receiveRoutes } from '@app/routes/receive-routes';
import { legacyRequestRoutes } from '@app/routes/request-routes';
import { rpcRequestRoutes } from '@app/routes/rpc-routes';

import { OnboardingGate } from './onboarding-gate';

export function SuspenseLoadingSpinner() {
  return <LoadingSpinner height="600px" />;
}

export function AppRoutes() {
  const routes = useAppRoutes();
  return <RouterProvider router={routes} />;
}

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(createHashRouter);

export const homePageModalRoutes = (
  <>
    {/* HACK -- Cat21: ledger + stacks modal routes hidden per ADR-7. Originals:
        {ledgerStacksTxSigningRoutes}
        {ledgerBitcoinTxSigningRoutes}
        {requestBitcoinKeysRoutes}
        {requestStacksKeysRoutes} */}
  </>
);

function useAppRoutes() {
  const { releaseOnramperBuy, releaseOnramperSell, swapRevamp } = useFlags();

  return sentryCreateBrowserRouter(
    createRoutesFromElements(
      <Route element={<Container />}>
        <Route key="error" errorElement={<RouterErrorBoundary />}>
          <Route element={<ReceiveModalWrapper />}>{receiveRoutes}</Route>
          <Route
            element={
              <>
                <HomeHeader />
                <Content>
                  <SwitchAccountLayout />
                </Content>
              </>
            }
          >
            <Route
              path="/*"
              element={
                <AccountGate>
                  <Home />
                </AccountGate>
              }
            >
              {homePageModalRoutes}
            </Route>

            {/* HACK -- Cat21: Stacks fee/cancel routes + ledger inner routes hidden per ADR-1 + ADR-7. Originals:
                <Route path={RouteUrls.IncreaseStacksFee} element={<IncreaseStacksTransactionFeeSheet />}>
                  {ledgerStacksTxSigningRoutes}
                </Route>
                <Route path={RouteUrls.CancelStacksTransaction} element={<CancelStacksTransactionSheet />}>
                  {ledgerStacksTxSigningRoutes}
                </Route>
                <Route path={`${RouteUrls.IncreaseStacksFee}/${RouteUrls.BroadcastError}`} element={<BroadcastError />} />
            */}
            <Route path={RouteUrls.IncreaseBtcFee} element={<IncreaseBtcFeeSheet />}>
              {/* HACK -- Cat21: ledger-tx-signing child routes hidden per ADR-7. Originals: {ledgerBitcoinTxSigningRoutes} */}
            </Route>

            {/* HACK -- Cat21: trailing ledgerStacksTxSigningRoutes hidden per ADR-7. */}
          </Route>
          {/* Page Routes */}

          {/* HACK -- Cat21: duplicate IncreaseStacksFee/BroadcastError + ledger pages hidden per ADR-1 + ADR-7. Originals:
              <Route path={`${RouteUrls.IncreaseStacksFee}/${RouteUrls.BroadcastError}`} element={<BroadcastError />} />
              <Route path={RouteUrls.IncreaseBtcFee} element={<IncreaseBtcFeeSheet />}>{ledgerBitcoinTxSigningRoutes}</Route>
              {ledgerStacksTxSigningRoutes}
          */}

          {/* HACK -- Cat21: AddNetwork + EditNetwork hidden per ADR-7 (mainnet only). Originals:
              <Route path={RouteUrls.AddNetwork} element={<AccountGate><CurrentAddNetwork /></AccountGate>} />
              <Route path={RouteUrls.EditNetwork} element={<AccountGate><CurrentEditNetwork /></AccountGate>} />
          */}

          {releaseOnramperBuy && (
            <Route
              path={RouteUrls.Fund}
              element={
                <AccountGate>
                  <FundPage />
                </AccountGate>
              }
            />
          )}

          {releaseOnramperSell && (
            <Route
              path={RouteUrls.Sell}
              element={
                <AccountGate>
                  <SellPage />
                </AccountGate>
              }
            />
          )}

          {sendCryptoAssetFormRoutes}

          <Route
            path={RouteUrls.TokenDetails}
            element={
              <AccountGate>
                <TokenDetails />
              </AccountGate>
            }
          />

          <Route path={RouteUrls.Unlock} element={<Unlock />} />
          <Route path={RouteUrls.UnauthorizedRequest} element={<UnauthorizedRequest />} />
          <Route
            path={RouteUrls.RequestError}
            element={
              <AccountGate>
                <RequestError />
              </AccountGate>
            }
          />

          {swapRevamp ? swapRoutes : bitcoinSwapLegacyRoutes}
          {/* HACK -- Cat21: stacksSwapLegacyRoutes hidden per ADR-1 (non-BTC-L1). */}

          {/* OnBoarding Routes */}
          <Route
            path={RouteUrls.Onboarding}
            element={
              <OnboardingGate>
                <WelcomePage />
              </OnboardingGate>
            }
          >
            {/* HACK -- Cat21: Onboarding ledger child routes hidden per ADR-7. Originals:
                <Route path={RouteUrls.ConnectLedgerStart} element={<ConnectLedgerStart />} />
                <Route path={RouteUrls.LedgerUnsupportedBrowser} element={<UnsupportedBrowserLayout />} />
                {requestBitcoinKeysRoutes}
                {requestStacksKeysRoutes}
            */}
          </Route>

          <Route
            path={RouteUrls.BackUpSecretKey}
            element={
              <OnboardingGate>
                <BackUpSecretKeyPage />
              </OnboardingGate>
            }
          />
          <Route
            path={RouteUrls.SetPassword}
            element={
              <OnboardingGate>
                <SetPasswordPage />
              </OnboardingGate>
            }
          />

          <Route
            path={RouteUrls.SignIn}
            element={
              <OnboardingGate>
                <SignIn />
              </OnboardingGate>
            }
          />
          <Route path={RouteUrls.ForgotPassword} element={<ForgotPassword />} />

          <Route
            path={RouteUrls.ViewSecretKey}
            element={
              <AccountGate>
                <ViewSecretKey />
              </AccountGate>
            }
          />

          <Route
            path={RouteUrls.Settings}
            element={
              <AccountGate>
                <SettingsPage />
              </AccountGate>
            }
          />

          <Route
            path={RouteUrls.ManageTokens}
            element={
              <AccountGate>
                <ManageTokensPage />
              </AccountGate>
            }
          />

          {/* HACK -- Cat21: SelectNetwork route hidden per ADR-7 (mainnet only). Original:
              <Route path={RouteUrls.SelectNetwork} element={<AccountGate><SelectNetwork /></AccountGate>} />
          */}
          <Route
            path={RouteUrls.SelectTheme}
            element={
              <AccountGate>
                <SelectTheme />
              </AccountGate>
            }
          />

          {/* Popup Routes */}
          {/* ChooseAccount is a popup as shown only in popup when decodedAuthRequest in set-password  */}
          <Route
            path={RouteUrls.ChooseAccount}
            element={
              <AccountGate>
                <LegacyAccountAuth />
              </AccountGate>
            }
          >
            {/* HACK -- Cat21: ledgerJwtSigningRoutes hidden per ADR-7. */}
          </Route>
          {legacyRequestRoutes}
          {rpcRequestRoutes}
        </Route>

        <Route
          path="*"
          element={
            <AccountGate>
              <NotFoundPage />
            </AccountGate>
          }
        />
      </Route>
    ),
    {
      future: {
        v7_relativeSplatPath: true,
        v7_startTransition: true,
        v7_fetcherPersist: true,
        v7_normalizeFormMethod: true,
        v7_partialHydration: true,
      },
    }
  );
}
