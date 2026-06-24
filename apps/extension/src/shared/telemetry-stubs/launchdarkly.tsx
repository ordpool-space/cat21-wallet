/**
 * HACK -- Cat21 (audit C1): no-op replacement for
 * `launchdarkly-react-client-sdk`. Cat21 Wallet ships zero telemetry
 * per PRIVACY-POLICY.md.
 *
 * Wired via webpack's `resolve.alias`. Zero bytes from the real
 * `launchdarkly-react-client-sdk` package ship in the production
 * bundle.
 */
import type { ReactNode } from 'react';

function NoopProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function asyncWithLDProvider(_config: unknown): Promise<typeof NoopProvider> {
  return Promise.resolve(NoopProvider);
}

export function withLDProvider(_config: unknown) {
  return function wrap<P>(Component: React.ComponentType<P>): React.ComponentType<P> {
    return Component;
  };
}

export function useFlags<T extends Record<string, unknown> = Record<string, never>>(): T {
  return {} as T;
}

export function useLDClient(): {
  identify(): Promise<void>;
  track(): void;
  variation<T>(_key: string, def: T): T;
  on(): void;
  off(): void;
  flush(): Promise<void>;
} {
  return {
    identify: () => Promise.resolve(),
    track: () => undefined,
    variation: (_k, def) => def,
    on: () => undefined,
    off: () => undefined,
    flush: () => Promise.resolve(),
  };
}

const noopExport = {
  asyncWithLDProvider,
  withLDProvider,
  useFlags,
  useLDClient,
};
export default noopExport;
