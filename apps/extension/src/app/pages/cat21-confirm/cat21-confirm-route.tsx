import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { makeCat21ConfirmationCopy } from '@app/features/cat21-confirmation/cat21-confirmation-copy';
import { Cat21ConfirmationDialog } from '@app/features/cat21-confirmation/cat21-confirmation-dialog';
import { Cat21RpcService } from '@background/cat21/cat21-rpc.service';
import type { Cat21Intent, Cat21RpcResult } from '@background/cat21/types';

import { useCat21RpcDeps } from './use-cat21-rpc-deps';

function extractCatIdHint(intent: Cat21Intent | undefined): string | undefined {
  if (!intent) return undefined;
  if ('catId' in intent) return intent.catId;
  if ('expectedCatId' in intent) return intent.expectedCatId;
  return undefined;
}

/**
 * Generic container for the four Cat21 manual-flow confirmation popups
 * (mint / transfer / create-offer / accept-offer). The four routes
 * registered in `app-routes.tsx` all point at this single component —
 * the intent kind is detected from `location.state.intent` the same
 * way the dialog's copy helper detects it.
 *
 * Architecture (this follows Leather's signPsbt pattern):
 *
 *   - The dispatcher runs IN THE POPUP, not the background. This gives
 *     it full access to the React/Redux tree and (transitively) the
 *     keychain that signing requires.
 *   - The container constructs a `Cat21RpcService` with popup-side deps
 *     and calls `service.mint(intent, 'popup')` etc. directly. No
 *     chrome.runtime round-trip for Path 2 (manual cat-flow).
 *   - Path 3 (MCP host autonomous) reaches the same route via the
 *     background's NMH listener calling `triggerRequestPopupWindowOpen`
 *     with the intent encoded in URL params, and the popup runs the
 *     same service through the same dialog.
 *
 * Real deps wiring (pickFundingUtxo, signWithConfirmation, broadcast)
 * lands one slice at a time as we hook up each cat-flow operation to
 * the wallet's existing keychain / electrs / mempool layers. Today's
 * `makeWiringPendingDeps()` gives every method a typed `wiring-pending`
 * denial so the message-passing layer is exercised end-to-end and the
 * popup surfaces a clean "not yet wired" error.
 */

export function Cat21ConfirmRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateIntent = (location.state as { intent?: Cat21Intent } | null)?.intent;

  // catId for the deps' cat21-ord pre-fetch (used by `resolveCatUtxo`).
  // Transfer/createOffer carry it as `catId`; acceptOffer as `expectedCatId`;
  // mint has none. The hook treats `undefined` as "no cat to look up".
  const catIdHint = extractCatIdHint(stateIntent);
  const deps = useCat21RpcDeps(catIdHint);

  if (!stateIntent) {
    return (
      <div data-testid="cat21-confirm-missing-intent">
        Missing intent. Re-open from the wallet UI.
      </div>
    );
  }

  const copy = makeCat21ConfirmationCopy(stateIntent);

  async function callService(intent: Cat21Intent): Promise<Cat21RpcResult> {
    // `useCat21RpcDeps` wires the cheap slices (account context, agent
    // policy, recordSpend) and falls through to `makeWiringPendingDeps`
    // for the rest. Future iterations replace each pending dep with a
    // popup-side hook chain.
    const service = new Cat21RpcService(deps);
    if ('priceSats' in intent) return service.createOffer(intent, 'popup');
    if ('offerPsbt' in intent) return service.acceptOffer(intent, 'popup');
    if ('catId' in intent) return service.transfer(intent, 'popup');
    return service.mint(intent, 'popup');
  }

  return (
    <Cat21ConfirmationDialog
      copy={copy}
      isSubmitting={isSubmitting}
      submitError={error}
      onApprove={() => {
        setIsSubmitting(true);
        setError(null);
        void (async () => {
          const result = await callService(stateIntent);
          setIsSubmitting(false);
          if (result.ok) {
            void navigate(-1);
            return;
          }
          const { reason, detail } = result.value;
          setError(detail ? `${reason}: ${detail}` : reason);
        })();
      }}
      onReject={() => {
        void navigate(-1);
      }}
    />
  );
}
