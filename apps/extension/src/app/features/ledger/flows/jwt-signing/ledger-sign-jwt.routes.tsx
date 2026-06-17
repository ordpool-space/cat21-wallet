import { Route } from 'react-router';

import { RouteUrls } from '@shared/route-urls';

import {
  ConnectLedgerError,
  ConnectLedgerSuccess,
  DeviceBusy,
  LedgerDisconnected,
  OperationRejected,
} from '../../generic-steps';
import { LedgerSignJwtContainer } from './ledger-sign-jwt-container';
import { ConnectLedgerSignJwt } from './steps/connect-ledger-sign-jwt';
import { SignJwtHash } from './steps/sign-jwt-hash';

// HACK -- Cat21: removed `export` (upstream Stacks/Ledger/Network/Swap surface unrouted by ADR-1 BTC-L1-only scope). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
const ledgerJwtSigningRoutes = (
  <Route element={<LedgerSignJwtContainer />}>
    <Route path={RouteUrls.ConnectLedger} element={<ConnectLedgerSignJwt />} />
    <Route path={RouteUrls.ConnectLedgerError} element={<ConnectLedgerError />} />
    <Route path={RouteUrls.ConnectLedgerSuccess} element={<ConnectLedgerSuccess />} />
    <Route path={RouteUrls.LedgerOperationRejected} element={<OperationRejected />} />
    <Route path={RouteUrls.DeviceBusy} element={<DeviceBusy />} />
    <Route path={RouteUrls.AwaitingDeviceUserAction} element={<SignJwtHash />} />
    <Route path={RouteUrls.LedgerDisconnected} element={<LedgerDisconnected />} />
  </Route>
);
