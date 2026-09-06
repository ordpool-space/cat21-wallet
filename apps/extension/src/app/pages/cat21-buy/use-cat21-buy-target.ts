/**
 * Resolve a buy target from the discovery field on the Cat21 Buy page.
 *
 * Given a cat number (parsed from a bare number OR a shared ask link),
 * this fetches two things:
 *   - the cat's inscription id + current existence, from cat21-ord
 *     (`fetchCat21`) — the `catId` the SDK gate + buy builder need;
 *   - the cat's active Bazaar listing (`fetchCat21ListingForCat`) —
 *     the ask price + seller payment address, when the cat is listed.
 *
 * The seller payment address comes from the ask link's `payTo` (when
 * the buyer pasted a link) OR the listing's `payTo` (by-number path) —
 * NEVER from an on-chain owner lookup (payment-address-provenance
 * HARD RULE). If neither carries it, the target resolves `ready` with
 * `sellerPaymentAddress: null` and the page asks the buyer to paste a
 * full ask link.
 */
import { useCallback, useState } from 'react';

import { getCat21OrdApiClient } from '@leather.io/services';

import { fetchCat21ListingForCat } from '@app/common/cat21-bazaar/cat21-bazaar-client';

import type { ParsedBuyTarget } from './cat21-buy-form.helper';

type Cat21BuyTargetView =
  | { step: 'idle' }
  | { step: 'loading' }
  | {
      step: 'ready';
      /** Inscription id (`<txid>i<index>`) for the intent + gate. */
      catId: string;
      catNumber: number;
      /** Ask price from the link or listing; null when not listed and no link. */
      askSats: number | null;
      /** Seller payout address from the link/listing; null when unknown. */
      sellerPaymentAddress: string | null;
    }
  /** cat21-ord doesn't know this cat number (never minted / bad number). */
  | { step: 'not-found' }
  | { step: 'error'; detail: string };

interface UseCat21BuyTargetResult {
  view: Cat21BuyTargetView;
  /** Resolve the target for a parsed discovery input. */
  resolve(target: ParsedBuyTarget): void;
  reset(): void;
}

export function useCat21BuyTarget(): UseCat21BuyTargetResult {
  const [view, setView] = useState<Cat21BuyTargetView>({ step: 'idle' });

  const reset = useCallback(() => setView({ step: 'idle' }), []);

  const resolve = useCallback((target: ParsedBuyTarget) => {
    if (target.catNumber == null) {
      setView({ step: 'idle' });
      return;
    }
    const { catNumber, askSats: linkAskSats, sellerPaymentAddress: linkPayTo } = target;
    setView({ step: 'loading' });
    void (async () => {
      let catId: string;
      let resolvedNumber: number;
      try {
        const cat = await getCat21OrdApiClient().fetchCat21(String(catNumber));
        catId = cat.id;
        resolvedNumber = cat.number;
      } catch {
        // cat21-ord 404s (or fails to parse) on an unknown cat number.
        setView({ step: 'not-found' });
        return;
      }

      // The Bazaar listing is best-effort context (ask + payTo). A
      // missing listing is not an error — the buyer may be bidding off
      // a shared link, or bidding unsolicited.
      let listingAsk: number | null = null;
      let listingPayTo: string | null = null;
      const listing = await fetchCat21ListingForCat({ catNumber: resolvedNumber });
      if (listing.ok && listing.value) {
        listingAsk = listing.value.askSats;
        listingPayTo = listing.value.payTo;
      }

      setView({
        step: 'ready',
        catId,
        catNumber: resolvedNumber,
        askSats: linkAskSats ?? listingAsk,
        sellerPaymentAddress: linkPayTo ?? listingPayTo,
      });
    })();
  }, []);

  return { view, resolve, reset };
}
