/**
 * Pure logic behind `usePublishToBazaar`, lifted out of the hook so the
 * shape-sensitive parts are unit-testable without a React/Redux/inversify
 * harness (the hook stays thin orchestration).
 *
 * The load-bearing piece is `resolveListingBundle`: it turns cat21-ord's
 * `/output/<outpoint>.cats` into the cat NUMBERS the Bazaar DTO expects.
 * cat21-ord emits those as inscription-id STRINGS (e.g. "<txid>i0"), never
 * numbers — treating them as numbers is the exact production bug the
 * cat21-indexer `getCatsAtOutput` regression documents. This helper only ever
 * compares them as strings and resolves each id to a number via `/cat/<id>`
 * (under `--index-cat21` the inscription number IS the cat number).
 */
/** The request options the cat21-ord client accepts (mirrors its ApiRequestOptions). */
interface OrdReadOptions {
  signal?: AbortSignal;
  skipCache?: boolean;
}

/** The two cat21-ord reads the bundle resolution needs, typed structurally. */
export interface BundleCatNumberResolver {
  fetchCat21(id: string, options?: OrdReadOptions): Promise<{ number: number }>;
  fetchOutput(outpoint: string, options?: OrdReadOptions): Promise<{ cats: string[] }>;
}

export type ListingNetwork = 'mainnet' | 'testnet3' | 'testnet4' | 'signet' | 'regtest';

/**
 * Map the wallet's active bitcoin network mode to the listing's network tag,
 * which the backend validates against its deployment. Production is 'mainnet'
 * (ADR-7); the E2E chain-truth suite drives 'regtest' against a real regtest
 * Bazaar backend. Any other mode collapses to 'testnet3'.
 */
export function toListingNetwork(mode: string): ListingNetwork {
  if (mode === 'mainnet') return 'mainnet';
  if (mode === 'regtest') return 'regtest';
  return 'testnet3';
}

export interface ResolvedListingBundle {
  headlineNumber: number;
  /** Every cat number on the UTXO, in the order ord returned the ids. */
  bundleCatNumbers: number[];
}

/**
 * Resolve the headline cat number and the full bundle-of-numbers riding on the
 * seller's UTXO.
 *
 * `fetchOutput` is called with `skipCache: true` on purpose: the bundle must be
 * the LIVE set at publish time, because the backend cross-checks it against
 * ord's live `/output` and rejects on `cats-bundle-drift`. The headline id is
 * resolved once and reused when it appears in the bundle, saving a redundant
 * `/cat/<id>` round-trip for the common single-cat UTXO.
 */
export async function resolveListingBundle(
  ord: BundleCatNumberResolver,
  args: { catId: string; sellerUtxo: { txid: string; vout: number } }
): Promise<ResolvedListingBundle> {
  const headline = await ord.fetchCat21(args.catId);
  const outpoint = `${args.sellerUtxo.txid}:${args.sellerUtxo.vout}`;
  const output = await ord.fetchOutput(outpoint, { skipCache: true });
  const bundleCatNumbers = await Promise.all(
    output.cats.map(async id =>
      id === args.catId ? headline.number : (await ord.fetchCat21(id)).number
    )
  );
  return { headlineNumber: headline.number, bundleCatNumbers };
}
