import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { makeCat21ConfirmationCopy } from '@app/features/cat21-confirmation/cat21-confirmation-copy';
import { Cat21ConfirmationDialog } from '@app/features/cat21-confirmation/cat21-confirmation-dialog';
import type { Cat21Intent } from '@background/cat21/types';

/**
 * Generic container for the four Cat21 manual-flow confirmation
 * popups (mint / transfer / create-offer / accept-offer). The four
 * routes registered in `app-routes.tsx` all point at this single
 * component — the intent kind is detected from `location.state.intent`
 * the same way the dialog's copy helper detects it. One shell, no
 * per-flow duplication.
 *
 * Contract with the caller (the wallet UI button that opens this
 * popup):
 *
 *   navigate(RouteUrls.Cat21MintConfirm, {
 *     state: { intent: { recipient, feeRate, mode: 'manual' } }
 *   });
 *
 * `intent.mode` must be `'manual'`. Approve / reject behaviour:
 *
 *   - approve: navigates back (caller's `onBack` handler dispatches
 *     the actual Cat21Dispatcher call via chrome.runtime.sendMessage
 *     in iter 11d). Until 11d lands, approve sets a placeholder
 *     "pending" state — the popup stays open so the user can cancel.
 *   - reject:  navigates back immediately, no side effects.
 *
 * If `location.state.intent` is missing or malformed, the popup
 * renders a typed "missing intent" error rather than crashing.
 * That's the failure mode for a developer mis-wiring the navigate
 * call; it's noisy but recoverable.
 */
export function Cat21ConfirmRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateIntent = (location.state as { intent?: Cat21Intent } | null)?.intent;

  if (!stateIntent) {
    // Defensive: the caller forgot to pass `state.intent`. Surface a
    // typed error rather than crashing on the makeCopy call.
    return (
      <div data-testid="cat21-confirm-missing-intent">
        Missing intent. Re-open from the wallet UI.
      </div>
    );
  }

  const copy = makeCat21ConfirmationCopy(stateIntent);

  return (
    <Cat21ConfirmationDialog
      copy={copy}
      isSubmitting={isSubmitting}
      onApprove={() => {
        // Iter 11d will dispatch via chrome.runtime.sendMessage to the
        // background-side Cat21Dispatcher and await the reply before
        // navigating back. Until then, set the submitting state so the
        // user sees something happen + surface a placeholder error so
        // the popup stays open and the user can cancel.
        setIsSubmitting(true);
        setError('Manual cat-flow signing not yet wired (iter 11d).');
        setIsSubmitting(false);
      }}
      onReject={() => {
        void navigate(-1);
      }}
      // Pass through the iter-11d error so the dialog can surface it
      // once a real dispatcher call exists; for now `error` is only set
      // by the placeholder branch above.
      submitError={error}
    />
  );
}
