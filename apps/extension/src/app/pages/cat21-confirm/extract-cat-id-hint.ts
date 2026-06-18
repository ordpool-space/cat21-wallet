import type { Cat21Intent } from '@background/cat21/types';

/**
 * Pulls the cat id out of a `Cat21Intent` for the deps' cat21-ord
 * pre-fetch (`useCat21RpcDeps`'s `catIdHint`). The three intent
 * shapes that carry one each spell it differently:
 *
 *   - `Cat21TransferIntent` / `Cat21CreateOfferIntent` → `catId`
 *   - `Cat21AcceptOfferIntent`                        → `expectedCatId`
 *   - `Cat21MintIntent`                               → none (returns undefined)
 *
 * Returning `undefined` for mint is the contract `useCat21RpcDeps`
 * relies on to skip the cat21-ord query entirely (no cat to look
 * up means no `/cat/<id>` fetch fires).
 */
export function extractCatIdHint(intent: Cat21Intent | undefined): string | undefined {
  if (!intent) return undefined;
  if ('catId' in intent) return intent.catId;
  if ('expectedCatId' in intent) return intent.expectedCatId;
  return undefined;
}
