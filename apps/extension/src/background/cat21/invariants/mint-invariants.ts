import type { Cat21MintIntent, Validated } from '../types';

/**
 * Hard, unbypassable safety checks on a raw `Cat21MintIntent`.
 *
 * Throws on the first violation with a typed error code (see
 * `MintInvariantViolation` below). On success, returns the same intent
 * branded as `Validated<Cat21MintIntent>` — that brand is the only way
 * for `buildMintPsbt` and the signing pipeline to accept the value, so
 * the type system enforces "invariants ran first".
 *
 * Implementation lands in the iteration-2 commit. The spec at
 * `mint-invariants.spec.ts` pins every check enumerated below.
 */
export function enforceMintInvariants(
  intent: Cat21MintIntent
): Validated<Cat21MintIntent> {
  void intent;
  throw new Error('Not implemented — see iteration-2 commit');
}

/**
 * Closed set of failure reasons the mint gate can raise. Each variant
 * maps 1:1 to one assertion in `mint-invariants.spec.ts`.
 */
export type MintInvariantViolation =
  | 'recipient-not-a-bitcoin-address'
  | 'recipient-wrong-network'
  | 'fee-rate-not-positive'
  | 'fee-rate-above-sanity-ceiling'
  | 'tip-address-invalid'
  | 'tip-value-negative';

export class MintInvariantError extends Error {
  constructor(public readonly reason: MintInvariantViolation, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'MintInvariantError';
  }
}
