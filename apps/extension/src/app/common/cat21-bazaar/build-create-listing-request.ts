/**
 * Pure assembly of the Bazaar POST body from wallet-side facts.
 *
 * Kept free of hooks/HTTP so the whole DTO shape is pinned by unit
 * specs (the React hook that calls this is thin glue — see
 * use-publish-to-bazaar.ts).
 *
 * Bundle semantics: a UTXO can carry multiple cats (consolidation).
 * The caller resolves the live bundle from cat21-ord's
 * `/output/<outpoint>` (inscription-id strings) and maps each id to
 * its cat number via `/cat/<id>` — under `--index-cat21` the
 * inscription number IS the cat number. This function only
 * validates + orders what it is handed.
 */
import { Cat21BazaarCreateListingRequest } from './cat21-bazaar.types';

export interface BuildCreateListingRequestArgs {
  /** Headline cat (the one the user clicked "sell" on). */
  catNumber: number;
  /** Every cat number on the UTXO — any order; deduped + sorted here. */
  bundleCatNumbers: number[];
  askSats: number;
  /** Wallet's native-segwit payment address (proceeds). */
  paymentAddress: string;
  /** Wallet's taproot ordinals address (session identity + cat owner). */
  ordinalsAddress: string;
  /** Cat UTXO outpoint parts (from the headline cat's satpoint). */
  catTxid: string;
  catVout: number;
}

/**
 * Throws on structurally invalid input (headline not in bundle,
 * non-positive ask, malformed txid) — these are programmer errors
 * at the call site, not user-input errors (the form validates ask
 * before this runs). Network is pinned 'mainnet' per ADR-7.
 */
export function buildCreateListingRequest(
  args: BuildCreateListingRequestArgs
): Cat21BazaarCreateListingRequest {
  throw new Error('not implemented — shapes-only commit');
}

/**
 * Parse a cat21-ord satpoint (`<txid>:<vout>:<offset>`) into the
 * outpoint parts the listing pins. Throws on malformed input.
 */
export function satpointToOutpoint(satpoint: string): { txid: string; vout: number } {
  throw new Error('not implemented — shapes-only commit');
}
