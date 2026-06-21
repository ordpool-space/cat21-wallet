/*
 * HACK -- Cat21 (audit C1): LaunchDarkly is stripped. Cat21 Wallet
 * ships zero telemetry per PRIVACY-POLICY.md. The upstream Leather
 * surface shipped a clientId-derived identifier + app version to
 * LaunchDarkly on every popup open; the returned flags were
 * Leather-only (onramper buy/sell, swap revamp) and unused on the
 * cat21 paths.
 *
 * The exports stay so the upstream call sites still compile.
 * `createLaunchDarklyProvider` always returns the inert provider;
 * `useFlags` returns all-false defaults. The module deliberately
 * imports nothing from `launchdarkly-react-client-sdk`: zero bytes
 * ship in the production bundle.
 */

function NoopProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function createLaunchDarklyProvider() {
  return NoopProvider;
}

interface FeatureFlags {
  releaseOnramperBuy: boolean;
  releaseOnramperSell: boolean;
  assetsRevamp: boolean;
  activityRevamp: boolean;
  swapRevamp: boolean;
  releaseTrendingTokens: boolean;
}

const ALL_FLAGS_DISABLED: FeatureFlags = {
  releaseOnramperBuy: false,
  releaseOnramperSell: false,
  assetsRevamp: false,
  activityRevamp: false,
  swapRevamp: false,
  releaseTrendingTokens: false,
};

export function useFlags() {
  return ALL_FLAGS_DISABLED;
}
