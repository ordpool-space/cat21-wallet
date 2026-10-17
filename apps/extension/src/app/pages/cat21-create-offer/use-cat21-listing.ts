/**
 * Read + retract a cat's existing Bazaar listing, from the sell form.
 *
 * The sell form deep-links with a `prefilledCatId`; before the user
 * re-lists, we show whether the cat is ALREADY listed (and for how
 * much) and offer a one-click Unlist. This closes the two obvious
 * trading gaps: double-listing confusion, and "how do I take it
 * down". Consumes `fetchCat21ListingForCat` (public read, no auth)
 * and `unlistCat21` (session-authed DELETE).
 *
 * Uses the shared `useCat21SessionSigner` so the unlist DELETE reuses
 * the same cached 24 h session token as publishing — no extra
 * signature prompt when the seller already listed in this window.
 */
import { useCallback, useEffect, useState } from 'react';

import { getCat21OrdApiClient } from '@leather.io/services';

import { fetchCat21ListingForCat, unlistCat21 } from '@app/common/cat21-bazaar/cat21-bazaar-client';
import { clearCat21Session, getOrCreateCat21Session } from '@app/common/cat21-bazaar/cat21-session';
import { useCat21SessionSigner } from '@app/common/cat21-bazaar/use-cat21-session-signer';

type Cat21ListingView =
  | { step: 'idle' }
  | { step: 'loading' }
  /** No active listing for this cat. */
  | { step: 'none' }
  /** Cat is listed; catNumber carried for the unlist call. */
  | { step: 'listed'; catNumber: number; askSats: number }
  | { step: 'unlisting'; catNumber: number }
  | { step: 'unlisted' }
  | { step: 'error'; detail: string };

interface UseCat21ListingResult {
  view: Cat21ListingView;
  /** Look up the current listing for `catId` (inscription id). */
  refresh(catId: string): void;
  /** Retract the listing shown in the `listed` state. No-op otherwise. */
  unlist(): void;
}

function useCat21Listing(): UseCat21ListingResult {
  const [view, setView] = useState<Cat21ListingView>({ step: 'idle' });
  const { ordinalsAddress, signBip322 } = useCat21SessionSigner();

  const refresh = useCallback((catId: string) => {
    if (!catId) {
      setView({ step: 'idle' });
      return;
    }
    setView({ step: 'loading' });
    void (async () => {
      try {
        const catNumber = (await getCat21OrdApiClient().fetchCat21(catId)).number;
        const res = await fetchCat21ListingForCat({ catNumber });
        if (!res.ok) {
          setView({ step: 'error', detail: res.error.code });
          return;
        }
        setView(
          res.value === null
            ? { step: 'none' }
            : { step: 'listed', catNumber, askSats: res.value.askSats }
        );
      } catch (err) {
        setView({ step: 'error', detail: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, []);

  const unlist = useCallback(() => {
    setView(prev => {
      if (prev.step !== 'listed') return prev;
      const { catNumber } = prev;
      void (async () => {
        try {
          let headers = await getOrCreateCat21Session({ address: ordinalsAddress, signBip322 });
          let res = await unlistCat21({ catNumber, headers });
          if (!res.ok && res.error.code === 'session-rejected') {
            clearCat21Session(ordinalsAddress);
            headers = await getOrCreateCat21Session({ address: ordinalsAddress, signBip322 });
            res = await unlistCat21({ catNumber, headers });
          }
          setView(res.ok ? { step: 'unlisted' } : { step: 'error', detail: res.error.code });
        } catch (err) {
          setView({ step: 'error', detail: err instanceof Error ? err.message : String(err) });
        }
      })();
      return { step: 'unlisting', catNumber };
    });
  }, [ordinalsAddress, signBip322]);

  return { view, refresh, unlist };
}

/** Auto-refresh helper: fire `refresh(catId)` whenever the id changes. */
export function useCat21ListingFor(catId: string): UseCat21ListingResult {
  const listing = useCat21Listing();
  const { refresh } = listing;
  useEffect(() => refresh(catId), [catId, refresh]);
  return listing;
}
