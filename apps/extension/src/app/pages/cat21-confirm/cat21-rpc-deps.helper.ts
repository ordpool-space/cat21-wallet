/**
 * Pure network/operation mappings used by `useCat21RpcDeps`, lifted out of the
 * hook so they are unit-testable without the React/Redux/inversify harness the
 * hook needs. The hook keeps the IO wiring; these keep the translation rules.
 */
import type { AgentActionKind, UtxoAssetDetail, UtxoClassification } from 'ordpool-sdk/core';

/**
 * Map an ord `classifyOutpoint` result to the funding guard's verdict. This is
 * the decision that keeps an asset-bearing coin out of the auto-fundable pool,
 * lifted out of the hook so the reject branch is unit-testable without a chain:
 *
 *   - `indexed === false` -> THROW. ord answers 200 with empty fields both for
 *     an output it carries no assets on AND for one it has not indexed yet (a
 *     lagging / restarting / reorged ord), so an unindexed result is "no answer",
 *     not clean. Rejecting routes the coin to the core's not-auto-spendable
 *     bucket (fail-closed) instead of mislabelling it `has-assets`.
 *   - otherwise `clean` -> 'clean', else 'has-assets'.
 *
 * `clean` already implies `indexed` in the SDK, so an indexed-but-empty output
 * still classifies clean.
 *
 * Returns the OBJECT form of `UtxoClassification` (`{ verdict, assets }`), not a
 * bare string, so the named assets ride through the core onto the funding
 * recommendation and the confirmation notice can say WHICH inscription / rune /
 * cat / rare sat is on the coin, not merely that assets are present. `runeNames`
 * are the keys of ord's `runes` map (ord's spelling, spacers included).
 */
export function classifyOutpointVerdict(
  outpoint: string,
  classification: {
    indexed: boolean;
    clean: boolean;
    inscriptionIds: string[];
    runes: Record<string, unknown> | null;
    catIds: string[];
    rareSat: UtxoAssetDetail['rareSat'];
  }
): UtxoClassification {
  if (!classification.indexed) {
    throw new Error(`ord has not indexed ${outpoint}; cannot classify funding coin`);
  }
  const assets: UtxoAssetDetail = {
    inscriptionIds: classification.inscriptionIds,
    runeNames: Object.keys(classification.runes ?? {}),
    catIds: classification.catIds,
    rareSat: classification.rareSat,
  };
  return { verdict: classification.clean ? 'clean' : 'has-assets', assets };
}

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
