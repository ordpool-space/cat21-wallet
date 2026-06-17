import * as btc from '@scure/btc-signer';

import type { Cat21MintIntent, Validated } from '../types';

/**
 * Maximum fee rate we accept on the wallet side as a sanity ceiling.
 * This is NOT the user's policy cap (that's in `AgentPolicy` and
 * applies to both modes); this is a "you typed something wrong"
 * backstop. Real Bitcoin mempool congestion peaks have been ~700
 * sat/vB; 1000 is comfortably above that.
 */
export const MINT_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE = 1000;

/**
 * Closed set of failure reasons the mint gate can raise. Each variant
 * maps 1:1 to one assertion in `mint-invariants.spec.ts`.
 */
// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type MintInvariantViolation =
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

/**
 * Hard, unbypassable safety checks on a raw `Cat21MintIntent`.
 *
 * Throws on the first violation with a typed `MintInvariantError`. On
 * success, returns the same intent branded as
 * `Validated<Cat21MintIntent>` — that brand is the only way for
 * `buildMintPsbt` and the signing pipeline to accept the value, so the
 * type system enforces "invariants ran first".
 *
 * Network awareness: address checks need to know whether to accept
 * mainnet- or testnet-shaped addresses. The caller passes the active
 * wallet network as a second argument; the resolver does NOT infer
 * network from the intent itself (the intent is what the caller wants
 * to do, the network is an environmental property of the wallet).
 */
export function enforceMintInvariants(
  intent: Cat21MintIntent,
  network: 'mainnet' | 'testnet'
): Validated<Cat21MintIntent> {
  const recipientNetwork = decodeAddressNetwork(intent.recipient);
  if (recipientNetwork === null) {
    throw new MintInvariantError('recipient-not-a-bitcoin-address', intent.recipient);
  }
  if (recipientNetwork !== network) {
    throw new MintInvariantError(
      'recipient-wrong-network',
      `expected ${network}, got ${recipientNetwork}`
    );
  }

  if (!Number.isFinite(intent.feeRate) || !(intent.feeRate > 0)) {
    throw new MintInvariantError('fee-rate-not-positive', String(intent.feeRate));
  }
  if (intent.feeRate > MINT_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE) {
    throw new MintInvariantError(
      'fee-rate-above-sanity-ceiling',
      `${intent.feeRate} > ${MINT_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE}`
    );
  }

  // `intent.tip != null` rejects both `undefined` (no tip) and `null` (which a
  // bug in upstream code path or a hand-crafted intent could produce). Without
  // the `!= null` form, the subsequent `intent.tip.value` would throw
  // `TypeError` on a null tip, which would surface as an opaque crash to the
  // caller rather than a typed MintInvariantError.
  if (intent.tip != null) {
    const tipShape = intent.tip;
    if (typeof tipShape.value !== 'number' || !Number.isFinite(tipShape.value)) {
      throw new MintInvariantError('tip-value-negative', String(tipShape.value));
    }
    if (tipShape.value < 0) {
      throw new MintInvariantError('tip-value-negative', String(tipShape.value));
    }
    if (tipShape.value > 0) {
      const tipNetwork = decodeAddressNetwork(tipShape.address);
      if (tipNetwork === null || tipNetwork !== network) {
        throw new MintInvariantError('tip-address-invalid', tipShape.address);
      }
    }
  }

  return intent as Validated<Cat21MintIntent>;
}

/**
 * Returns the network a Bitcoin address belongs to, or `null` if it
 * is not a valid Bitcoin address on either network.
 *
 * Decodes via `@scure/btc-signer`'s Address parser, which accepts
 * every relevant address type (P2PKH, P2SH, P2WPKH, P2WSH, P2TR).
 * Tries mainnet first, falls back to testnet, returns `null` on a
 * miss in both.
 */
function decodeAddressNetwork(address: string): 'mainnet' | 'testnet' | null {
  if (typeof address !== 'string' || address.length === 0) return null;
  try {
    btc.Address(btc.NETWORK).decode(address);
    return 'mainnet';
  } catch {
    try {
      btc.Address(btc.TEST_NETWORK).decode(address);
      return 'testnet';
    } catch {
      return null;
    }
  }
}
