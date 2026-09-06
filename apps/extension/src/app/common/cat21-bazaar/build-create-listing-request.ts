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

interface BuildCreateListingRequestArgs {
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
  /**
   * Network tag the backend validates against its own deployment
   * (`network-mismatch` otherwise). 'mainnet' in production (the wallet is
   * mainnet-only, ADR-7); the E2E chain-truth suite drives 'regtest' against
   * a real regtest Bazaar backend.
   */
  network: 'mainnet' | 'testnet3' | 'testnet4' | 'signet' | 'regtest';
}

/**
 * Throws on structurally invalid input (headline not in bundle,
 * non-positive ask, malformed txid) — these are programmer errors
 * at the call site, not user-input errors (the form validates ask
 * before this runs). The network tag comes from the caller (the wallet's
 * active network); production is always 'mainnet' per ADR-7.
 *
 * catNumber 0 is valid — the Genesis Cat is a real, owned UTXO and
 * per the workspace HARD RULE its one canonical listing must be
 * signable.
 */
export function buildCreateListingRequest(
  args: BuildCreateListingRequestArgs
): Cat21BazaarCreateListingRequest {
  if (!Number.isInteger(args.catNumber) || args.catNumber < 0) {
    throw new Error(`catNumber must be a non-negative integer; got ${args.catNumber}`);
  }
  if (!Number.isInteger(args.askSats) || args.askSats <= 0) {
    throw new Error(`askSats must be a positive integer; got ${args.askSats}`);
  }
  if (!/^[0-9a-f]{64}$/.test(args.catTxid)) {
    throw new Error(`catTxid must be 64-char lowercase hex; got ${JSON.stringify(args.catTxid)}`);
  }
  if (!Number.isInteger(args.catVout) || args.catVout < 0) {
    throw new Error(`catVout must be a non-negative integer; got ${args.catVout}`);
  }
  if (!args.paymentAddress) throw new Error('paymentAddress must be a non-empty string');
  if (!args.ordinalsAddress) throw new Error('ordinalsAddress must be a non-empty string');

  const cats = Array.from(new Set(args.bundleCatNumbers)).sort((a, b) => a - b);
  if (cats.length === 0) throw new Error('bundleCatNumbers must not be empty');
  if (cats.some(n => !Number.isInteger(n) || n < 0)) {
    throw new Error(`bundleCatNumbers must be non-negative integers; got ${JSON.stringify(cats)}`);
  }
  if (!cats.includes(args.catNumber)) {
    throw new Error(
      `headline catNumber ${args.catNumber} is not in the bundle ${JSON.stringify(cats)}`
    );
  }

  return {
    catNumber: args.catNumber,
    cats,
    network: args.network,
    askSats: args.askSats,
    payTo: args.paymentAddress,
    catTxid: args.catTxid,
    catVout: args.catVout,
    ordinalsAddress: args.ordinalsAddress,
  };
}
