import { describe, it } from 'vitest';

/**
 * Spec contract for `enforceMintInvariants`. Each `it.todo` here will
 * be turned into a passing assertion in the implementation commit. The
 * names ARE the contract — they enumerate every violation reason in
 * `MintInvariantViolation` (closed set) plus the happy path.
 */
describe('enforceMintInvariants', () => {
  it.todo('returns a Validated<Cat21MintIntent> for a well-formed mainnet mint');

  it.todo('returns a Validated<Cat21MintIntent> for a well-formed testnet mint');

  it.todo('throws MintInvariantError(recipient-not-a-bitcoin-address) on empty recipient');

  it.todo('throws MintInvariantError(recipient-not-a-bitcoin-address) on non-bech32 garbage');

  it.todo('throws MintInvariantError(recipient-wrong-network) when active network is mainnet but recipient is testnet');

  it.todo('throws MintInvariantError(fee-rate-not-positive) on feeRate === 0');

  it.todo('throws MintInvariantError(fee-rate-not-positive) on negative feeRate');

  it.todo('throws MintInvariantError(fee-rate-above-sanity-ceiling) when feeRate is implausibly high (>1000 sat/vB)');

  it.todo('throws MintInvariantError(tip-address-invalid) when tip exists with garbage address');

  it.todo('throws MintInvariantError(tip-value-negative) when tip.value < 0');

  it.todo('accepts tip with value === 0 (caller convention: 0 means no output)');

  it.todo('returns a value that the TypeScript compiler accepts where Validated<Cat21MintIntent> is required');
});
