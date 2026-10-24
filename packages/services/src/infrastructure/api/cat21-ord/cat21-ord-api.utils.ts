/**
 * Per ADR-7, CAT-21 wallet is mainnet-only. There is no testnet/signet/regtest
 * cat21-ord. This function intentionally collapses the network-selection logic
 * that the upstream BIS helper had into a single constant.
 *
 * A future user-override (env var, settings field for self-hosted cat21-ord)
 * would replace the constant here.
 */
export const CAT21_ORD_DEFAULT_BASE_URL = 'https://ord.cat21.space';

export function getCat21OrdBasePath(): string {
  return CAT21_ORD_DEFAULT_BASE_URL;
}

/**
 * Our full ord instance (inscriptions + runes + rare sats). cat21-ord runs
 * `--index-cat21`, so it only sees cats; the four-class funding-safety scan
 * needs this second endpoint for the other three asset classes. Paired with
 * `getCat21OrdBasePath` as the two `/output` sources the SDK's `classifyOutpoint`
 * merges. Covered by the `https://*.ordpool.space/*` host permission.
 *
 * A future user-override (self-hosted ord) replaces the constant here.
 */
export const ORDPOOL_ORD_DEFAULT_BASE_URL = 'https://ord.ordpool.space';

export function getOrdpoolOrdBasePath(): string {
  return ORDPOOL_ORD_DEFAULT_BASE_URL;
}
