import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { makeCat21ConfirmationCopy } from '@app/features/cat21-confirmation/cat21-confirmation-copy';
import { Cat21ConfirmationDialog } from '@app/features/cat21-confirmation/cat21-confirmation-dialog';
import { makeWiringPendingDeps } from '@background/cat21/cat21-dispatcher';
import { Cat21RpcService } from '@background/cat21/cat21-rpc.service';
import type { Cat21Intent, Cat21RpcResult } from '@background/cat21/types';

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

  if (!stateIntent) {
    return (
      <div data-testid="cat21-confirm-missing-intent">
        Missing intent. Re-open from the wallet UI.
      </div>
    );
  }

  const copy = makeCat21ConfirmationCopy(stateIntent);

  async function callService(intent: Cat21Intent): Promise<Cat21RpcResult> {
    // Wiring-pending deps for every slice today. Future iterations
    // replace each dep with a popup-side hook chain that touches the
    // keychain (sign*), redux-persist (active account + agent
    // policy), or wallet API client (pickFundingUtxo, broadcast).
    const service = new Cat21RpcService(makeWiringPendingDeps());
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
