import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { makeCat21ConfirmationCopy } from '@app/features/cat21-confirmation/cat21-confirmation-copy';
import { Cat21ConfirmationDialog } from '@app/features/cat21-confirmation/cat21-confirmation-dialog';
import { useHasActiveInMemoryWalletSecretKey } from '@app/store/in-memory-key/in-memory-key.selectors';
import { postCat21Result } from '@background/cat21/cat21-result-bus';
import { Cat21RpcService } from '@background/cat21/cat21-rpc.service';
import type { Cat21Transport } from '@background/cat21/mode-resolver';
import { clearCat21Request } from '@background/cat21/popup-bridge';
import type { Cat21Intent, Cat21RpcResult } from '@background/cat21/types';

import { usePublishToBazaar } from '../cat21-create-offer/use-publish-to-bazaar';
import { Cat21BazaarPublishStatus } from './cat21-bazaar-publish-status';
import { extractCatIdHint } from './extract-cat-id-hint';
import { useCat21RequestFromUrl } from './use-cat21-request-from-url';
import { useCat21RpcDeps } from './use-cat21-rpc-deps';

/**
 * Generic container for the four Cat21 confirmation popups
 * (mint / transfer / create-offer / accept-offer). The four routes
 * registered in `app-routes.tsx` all point at this single component —
 * the intent kind is detected by structural narrowing on the intent's
 * fields (`priceSats` → createOffer, `offerPsbt` → acceptOffer,
 * `catId` → transfer, else mint).
 *
 * Two paths reach this route, distinguished by where the intent lives:
 *
 *   Path 2 (manual cat-flow)
 *     Intent rides on react-router's `location.state.intent`. The
 *     popup loads, the user sees the dialog, clicks Confirm, the
 *     service runs against the keychain and broadcasts. No
 *     chrome.runtime round-trip back to the background.
 *
 *   Path 3 (autonomous, NMH-driven)
 *     The background's NMH listener stashed the intent in
 *     chrome.storage.session and opened this popup with
 *     `?cat21RequestId=<id>`. `useCat21RequestFromUrl` reads the
 *     stash; if `transport === 'mcp-nmh'` we auto-confirm without a
 *     user click and post the result back to the background via
 *     `postCat21Result` so the NMH listener can write it over the
 *     port to the MCP agent. Storage is cleared on completion.
 *
 *     The popup may briefly flash visible for the user; that's by
 *     design — Chrome lets the user see (and intercept) any
 *     keychain-touching operation an agent triggers. The keychain
 *     itself requires the wallet to be unlocked, so a sleeping
 *     wallet rejects autonomous calls before any signature happens.
 */

export function Cat21ConfirmRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard against `useEffect` firing the auto-confirm twice in
  // React strict mode (dev) and against re-mounts during the async
  // service call. A ref is stable across renders and survives the
  // strict-mode double-invoke.
  const autoConfirmedRef = useRef(false);

  const stateIntent = (location.state as { intent?: Cat21Intent } | null)?.intent;
  const urlRequest = useCat21RequestFromUrl();
  // Audit H1: gate Path 3 autoconfirm on the wallet being unlocked.
  // Otherwise an AFK user (or a sleeping wallet) sees no popup
  // interaction but the keychain access can still proceed if it's
  // ever cached. Hard-fail-closed: if locked, send a typed denial
  // back to the agent instead of triggering keychain decryption.
  const isWalletUnlocked = useHasActiveInMemoryWalletSecretKey();

  // The popup may be reached two ways: Path 2 (intent on react-router
  // `location.state`) or Path 3 (the background's NMH listener stashed
  // it under `?cat21RequestId=<id>` via popup-bridge). URL wins when
  // present so a stray location.state from a previous navigation
  // can't override a fresh agent-driven request.
  const intent: Cat21Intent | undefined =
    urlRequest.status === 'ready' ? urlRequest.intent : stateIntent;
  const transport: Cat21Transport = urlRequest.status === 'ready' ? urlRequest.transport : 'popup';

  // catId for the deps' cat21-ord pre-fetch (used by `resolveCatUtxo`).
  // Transfer/createOffer carry it as `catId`; acceptOffer as `expectedCatId`;
  // mint has none. The hook treats `undefined` as "no cat to look up".
  const catIdHint = extractCatIdHint(intent);
  const deps = useCat21RpcDeps(catIdHint);
  const bazaar = usePublishToBazaar();

  async function runService(actionIntent: Cat21Intent): Promise<Cat21RpcResult> {
    const service = new Cat21RpcService(deps);
    if ('priceSats' in actionIntent) return service.createOffer(actionIntent, transport);
    if ('offerPsbt' in actionIntent) return service.acceptOffer(actionIntent, transport);
    if ('catId' in actionIntent) return service.transfer(actionIntent, transport);
    return service.mint(actionIntent, transport);
  }

  // Path 3 finalisation: post the rpc result onto the result bus so
  // the NMH listener's `subscribeToCat21Result` resolves; then clear
  // the storage entry (defence in depth — the relay's `finally` also
  // clears, but if the popup was killed mid-flight we still clean up).
  async function finalisePath3(requestId: string, result: Cat21RpcResult): Promise<void> {
    await postCat21Result(msg => chrome.runtime.sendMessage(msg), requestId, result);
    await clearCat21Request(
      {
        set(items) {
          return chrome.storage.session.set(items);
        },
        get(keys) {
          return chrome.storage.session.get(keys);
        },
        remove(keys) {
          return chrome.storage.session.remove(keys);
        },
      },
      requestId
    );
  }

  // Confirm shared between user-click and Path-3-auto. Idempotent
  // via the `isSubmitting` setter: a second click while submitting
  // is a noop. For Path 3 the `useEffect` below calls this exactly
  // once via `autoConfirmedRef`.
  //
  // Path 2 createOffer success does NOT navigate away: instead the
  // just-validated listing is published to the Bazaar and the popup
  // renders the publish state machine (resolving → signing-session →
  // posting → success | error). Path 3 keeps the return-the-payload
  // contract — the agent forwards the listing itself.
  function confirm(actionIntent: Cat21Intent) {
    setIsSubmitting(true);
    setError(null);
    void (async () => {
      const result = await runService(actionIntent);
      setIsSubmitting(false);
      if (urlRequest.status === 'ready') {
        await finalisePath3(urlRequest.requestId, result);
      }
      if (result.ok) {
        if (transport === 'popup' && result.value.kind === 'listing' && 'priceSats' in actionIntent) {
          const { listing } = result.value;
          bazaar.publish({
            catId: listing.catId,
            askSats: listing.priceSats,
            paymentAddress: listing.paymentAddress,
            sellerUtxo: listing.sellerUtxo,
          });
          return;
        }
        void navigate(-1);
        return;
      }
      const { reason, detail } = result.value;
      setError(detail ? `${reason}: ${detail}` : reason);
    })();
  }

  // Path 3 autoconfirm: when an NMH-driven request lands `ready`
  // and policy/transport allow autonomous, fire `confirm` without
  // waiting for a click. The mode-resolver then either signs
  // silently (autonomous granted) or surfaces a typed denial
  // (policy refused / agent-mode off), and either outcome is what
  // gets posted back to the agent.
  //
  // The dep array reads `urlRequest.status` only — the `transport`
  // field exists only on the `'ready'` variant of the union, so we
  // narrow inside the body and use `transport` (already narrowed
  // above) which TypeScript can index safely.
  useEffect(() => {
    if (urlRequest.status !== 'ready') return;
    if (urlRequest.transport !== 'mcp-nmh') return;
    if (autoConfirmedRef.current) return;
    // Audit H1 — locked-wallet gate. Refuse the autoconfirm before
    // any service call (and therefore before any keychain access)
    // when the wallet is locked. Post a typed denial back so the
    // agent learns explicitly rather than hanging.
    if (!isWalletUnlocked) {
      autoConfirmedRef.current = true;
      const { requestId } = urlRequest;
      void finalisePath3(requestId, {
        ok: false,
        value: { reason: 'agent-disabled', detail: 'wallet-locked' },
      });
      return;
    }
    autoConfirmedRef.current = true;
    confirm(urlRequest.intent);
    // `deps` and `confirm` close over many things that re-render-thrash
    // (the React-Query cache snapshot, the redux store reference,
    // etc.). The `autoConfirmedRef` guard keeps this at-most-once;
    // intentionally not listing the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRequest.status, isWalletUnlocked]);

  if (urlRequest.status === 'loading') {
    return <div data-testid="cat21-confirm-loading">Loading request…</div>;
  }

  if (urlRequest.status === 'expired') {
    return (
      <div data-testid="cat21-confirm-expired">
        Request expired. Re-issue from the agent or open from the wallet UI.
      </div>
    );
  }

  if (urlRequest.status === 'error') {
    return (
      <div data-testid="cat21-confirm-storage-error">
        Could not read request from storage: {urlRequest.message}
      </div>
    );
  }

  if (!intent) {
    return (
      <div data-testid="cat21-confirm-missing-intent">
        Missing intent. Re-open from the wallet UI.
      </div>
    );
  }

  // Bazaar publish in flight or settled — replaces the confirmation
  // dialog once the createOffer gate has succeeded (Path 2 only).
  if (bazaar.state.step !== 'idle') {
    return <Cat21BazaarPublishStatus state={bazaar.state} onClose={() => void navigate(-1)} />;
  }

  const copy = makeCat21ConfirmationCopy(intent);

  return (
    <Cat21ConfirmationDialog
      copy={copy}
      isSubmitting={isSubmitting}
      submitError={error}
      onApprove={() => confirm(intent)}
      onReject={() => {
        if (urlRequest.status === 'ready') {
          void finalisePath3(urlRequest.requestId, {
            ok: false,
            value: { reason: 'transport-not-trusted-for-autonomous', detail: 'user-rejected' },
          });
        }
        void navigate(-1);
      }}
    />
  );
}
