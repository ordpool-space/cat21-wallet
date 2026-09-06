/**
 * Per ADR-7, Cat21 Wallet is mainnet-only. There is no testnet/signet/regtest
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
