/**
 * Pure network/operation mappings used by `useCat21RpcDeps`, lifted out of the
 * hook so they are unit-testable without the React/Redux/inversify harness the
 * hook needs. The hook keeps the IO wiring; these keep the translation rules.
 */
import type { AgentActionKind } from 'ordpool-sdk/core';

/**
 * Map the wallet's bitcoin network mode to the coarse label the cat pipeline
 * uses. Production is 'mainnet'; the E2E chain-truth harness drives 'regtest'
 * against a local regtest chain. Any other mode is 'testnet'.
 */
export function toNetworkLabel(mode: string): 'mainnet' | 'testnet' | 'regtest' {
  if (mode === 'mainnet') return 'mainnet';
  if (mode === 'regtest') return 'regtest';
  return 'testnet';
}

/**
 * Map the wallet's network label to the Bazaar bid DTO's network enum.
 * Production is 'mainnet'; the E2E chain-truth suite drives 'regtest'. Any other
 * non-mainnet label collapses to 'testnet3'.
 */
export function toBidNetwork(net: string): 'mainnet' | 'testnet3' | 'regtest' {
  if (net === 'mainnet') return 'mainnet';
  if (net === 'regtest') return 'regtest';
  return 'testnet3';
}

type SdkGateOperationKind = 'mint' | 'transfer' | 'create_offer' | 'accept_offer';

/**
 * Translate the agent-policy's `cat21_*` operation kinds to the bare names the
 * SDK structural gate's `Cat21OperationGateConfig.allowedOperations` uses
 * (`'mint' | 'transfer' | 'create_offer' | 'accept_offer'`). The two layers of
 * the SDK chose different conventions; this is the single seam where the prefix
 * is stripped.
 *
 * Returns `undefined` (not an empty array) when the source field is missing OR
 * empty so `gateConfig` can spread-conditionally and omit the
 * `allowedOperations` key entirely (the SDK treats unset and empty array as
 * equivalently permissive, but omitting reads cleaner).
 */
export function stripCat21Prefix(
  source: readonly AgentActionKind[] | undefined
): readonly SdkGateOperationKind[] | undefined {
  if (!source || source.length === 0) return undefined;
  return source.map(k => k.slice('cat21_'.length) as SdkGateOperationKind);
}
