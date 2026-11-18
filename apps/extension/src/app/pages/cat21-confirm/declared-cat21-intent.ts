import type { Cat21ActionKind } from '@background/cat21/popup-bridge';
import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

/** An intent bound to the action its route declared. */
export type DeclaredCat21Intent =
  | { kind: 'mint'; intent: Cat21MintIntent }
  | { kind: 'transfer'; intent: Cat21TransferIntent }
  | { kind: 'create_offer'; intent: Cat21CreateOfferIntent }
  | { kind: 'accept_offer'; intent: Cat21AcceptOfferIntent }
  | { kind: 'buy'; intent: Cat21BuyIntent };

/**
 * Bind a payload to the action its confirmation route declared, or `null` when
 * the payload does not have that action's shape. The confirm route executes
 * the declared action only (HARD RULE #6: the action kind rides in the method
 * name, invariants are enforced on the declared intent); a payload shaped like
 * a different action is refused, never re-routed to the action it resembles.
 *
 * Each action is recognised by the fields only it carries and the absence of
 * the fields that mark the others, so a payload carrying a second action's
 * marker (a mint with a `catId`, a transfer with a `bidSats`) is refused too.
 * Field VALUES are not checked here; the SDK gate validates them.
 */
export function declaredCat21Intent(
  kind: Cat21ActionKind,
  intent: Cat21Intent
): DeclaredCat21Intent | null {
  switch (kind) {
    case 'mint':
      if (
        'recipient' in intent &&
        !('catId' in intent) &&
        !('priceSats' in intent) &&
        !('bidSats' in intent) &&
        !('offerPsbt' in intent)
      ) {
        return { kind, intent };
      }
      return null;
    case 'transfer':
      if (
        'catId' in intent &&
        'recipient' in intent &&
        !('priceSats' in intent) &&
        !('bidSats' in intent) &&
        !('offerPsbt' in intent)
      ) {
        return { kind, intent };
      }
      return null;
    case 'create_offer':
      if (
        'priceSats' in intent &&
        !('recipient' in intent) &&
        !('bidSats' in intent) &&
        !('offerPsbt' in intent)
      ) {
        return { kind, intent };
      }
      return null;
    case 'accept_offer':
      if (
        'offerPsbt' in intent &&
        !('catId' in intent) &&
        !('recipient' in intent) &&
        !('priceSats' in intent) &&
        !('bidSats' in intent)
      ) {
        return { kind, intent };
      }
      return null;
    case 'buy':
      if (
        'bidSats' in intent &&
        !('recipient' in intent) &&
        !('priceSats' in intent) &&
        !('offerPsbt' in intent)
      ) {
        return { kind, intent };
      }
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
