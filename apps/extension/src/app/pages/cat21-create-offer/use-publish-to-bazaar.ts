/**
 * Path 2 glue: publish the just-confirmed sell intent to the Bazaar.
 *
 * Runs AFTER `Cat21RpcService.createOffer` succeeded — i.e. the
 * wallet's own gate already verified ownership via cat21-ord and the
 * user clicked through the sell form. This hook then:
 *
 *   1. `resolving`        — fetchCat21(catId) → cat number; the
 *                           outpoint comes from the RPC result's
 *                           `sellerUtxo` (already ownership-checked);
 *                           fetchOutput(outpoint) → bundle ids →
 *                           fetchCat21(each) → cat numbers.
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
import { useRef, useState } from 'react';

import { getCat21OrdApiClient } from '@leather.io/services';

import { buildCreateListingRequest } from '@app/common/cat21-bazaar/build-create-listing-request';
import { publishCat21Listing } from '@app/common/cat21-bazaar/cat21-bazaar-client';
import { Cat21BazaarPublishState } from '@app/common/cat21-bazaar/cat21-bazaar.types';
import { clearCat21Session, getOrCreateCat21Session } from '@app/common/cat21-bazaar/cat21-session';
import { useCat21SessionSigner } from '@app/common/cat21-bazaar/use-cat21-session-signer';
import { useCurrentNetwork } from '@app/store/networks/networks.selectors';

/**
 * Map the wallet's active bitcoin network mode to the listing's network tag,
 * which the backend validates against its deployment. Production is 'mainnet'
 * (ADR-7); the E2E chain-truth suite drives 'regtest' against a real regtest
 * Bazaar backend. Non-mainnet, non-regtest modes collapse to 'testnet3'.
 */
function toListingNetwork(
  mode: string
): 'mainnet' | 'testnet3' | 'testnet4' | 'signet' | 'regtest' {
  if (mode === 'mainnet') return 'mainnet';
  if (mode === 'regtest') return 'regtest';
  return 'testnet3';
}

interface PublishToBazaarArgs {
  /** Inscription id of the headline cat (from the confirmed intent). */
  catId: string;
  askSats: number;
  /** Seller's chosen payout address (from the confirmed intent). */
  paymentAddress: string;
  /** Cat UTXO — ownership-checked by the RPC gate that just ran. */
  sellerUtxo: { txid: string; vout: number };
}

interface UsePublishToBazaarResult {
  state: Cat21BazaarPublishState;
  /** Kick off the publish pipeline. No-op while already running. */
  publish(args: PublishToBazaarArgs): void;
}

export function usePublishToBazaar(): UsePublishToBazaarResult {
  const [state, setState] = useState<Cat21BazaarPublishState>({ step: 'idle' });
  const runningRef = useRef(false);

  const { ordinalsAddress, signBip322 } = useCat21SessionSigner();
  const network = useCurrentNetwork();

  function publish(args: PublishToBazaarArgs) {
    if (runningRef.current) return;
    runningRef.current = true;

    void (async () => {
      try {
        // ─── resolve: headline number + live bundle numbers ───
        setState({ step: 'resolving' });
        const ord = getCat21OrdApiClient();
        const headline = await ord.fetchCat21(args.catId);
        const outpoint = `${args.sellerUtxo.txid}:${args.sellerUtxo.vout}`;
        const output = await ord.fetchOutput(outpoint, { skipCache: true });
        const bundleCatNumbers = await Promise.all(
          output.cats.map(async id =>
            id === args.catId ? headline.number : (await ord.fetchCat21(id)).number
          )
        );

        const request = buildCreateListingRequest({
          catNumber: headline.number,
          bundleCatNumbers,
          askSats: args.askSats,
          paymentAddress: args.paymentAddress,
          ordinalsAddress,
          catTxid: args.sellerUtxo.txid,
          catVout: args.sellerUtxo.vout,
          network: toListingNetwork(network.chain.bitcoin.mode),
        });

        // ─── session token (cached 24 h; signs on first sale only) ───
        setState({ step: 'signing-session' });
        const address = request.ordinalsAddress;
        let headers = await getOrCreateCat21Session({ address, signBip322 });

        // ─── POST; on 401 re-sign once ───
        setState({ step: 'posting' });
        let result = await publishCat21Listing({ request, headers });
        if (!result.ok && result.error.code === 'session-rejected') {
          clearCat21Session(address);
          setState({ step: 'signing-session' });
          headers = await getOrCreateCat21Session({ address, signBip322 });
          setState({ step: 'posting' });
          result = await publishCat21Listing({ request, headers });
        }

        if (result.ok) {
          setState({ step: 'success', catNumber: request.catNumber });
        } else {
          setState({ step: 'error', error: result.error });
        }
      } catch (err) {
        setState({
          step: 'error',
          error: {
            code: 'network-error',
            detail: err instanceof Error ? err.message : String(err),
          },
        });
      } finally {
        runningRef.current = false;
      }
    })();
  }

  return { state, publish };
}
