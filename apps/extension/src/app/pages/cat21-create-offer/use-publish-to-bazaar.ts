/**
 * Path 2 glue: publish the just-confirmed sell intent to the Bazaar.
 *
 * Runs AFTER `Cat21RpcService.createOffer` succeeded — i.e. the
 * wallet's own gate already verified ownership via cat21-ord and the
 * user clicked through the sell form. This hook then:
 *
 *   1. `resolving`        — fetchCat21(catId) → satpoint → outpoint;
 *                           fetchOutput(outpoint) → bundle ids;
 *                           fetchCat21(each id) → cat numbers.
 *   2. `signing-session`  — getOrCreateCat21Session (BIP-322 via the
 *                           wallet's own taproot keychain; cached 24 h,
 *                           so usually a no-op after the first sale).
 *   3. `posting`          — publishCat21Listing; on 401 clears the
 *                           session and retries exactly once.
 *   4. `success | error`  — rendered by the confirm page.
 *
 * Path 3 (MCP agents) is untouched: `cat21_create_offer` keeps
 * returning the listing payload for the agent to forward — per the
 * SDK gate contract ("emits a structured listing the agent forwards
 * to a marketplace"). This hook is popup-UI only; the architecture
 * spec pins that no background / content-script code imports the
 * bazaar client.
 */
import { Cat21BazaarPublishState } from '@app/common/cat21-bazaar/cat21-bazaar.types';

export interface PublishToBazaarArgs {
  /** Inscription id of the headline cat (from the confirmed intent). */
  catId: string;
  askSats: number;
  paymentAddress: string;
  ordinalsAddress: string;
}

export interface UsePublishToBazaarResult {
  state: Cat21BazaarPublishState;
  /** Kick off the publish pipeline. No-op while already running. */
  publish(args: PublishToBazaarArgs): void;
}

export function usePublishToBazaar(): UsePublishToBazaarResult {
  throw new Error('not implemented — shapes-only commit');
}
