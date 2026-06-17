import * as btc from '@scure/btc-signer';

import type { Cat21TransferIntent, Validated } from '../types';

/**
 * Maximum fee rate we accept on the wallet side as a sanity ceiling.
 * Same constant + same justification as the mint slice.
 */
export const TRANSFER_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE = 1000;

/**
 * Shape of an inscription / cat id we accept. cat21-ord emits ids as
 * `<txid>i<index>` (e.g. `abcd…ef00i0`). The check is structural — full
 * existence-of-cat lookup belongs to a cat21-ord query before signing,
 * not here.
 */
const CAT_ID_PATTERN = /^[0-9a-fA-F]{64}i\d+$/;

// HACK -- Cat21: removed `export` (pre-wired for iter 10/11 consumers (popup pages + agent-policy store); restore on wire-up). HARD RULE #5 — restore on consumer wire-up.
type TransferInvariantViolation =
  | 'cat-id-malformed'
  | 'recipient-not-a-bitcoin-address'
  | 'recipient-wrong-network'
  | 'fee-rate-not-positive'
  | 'fee-rate-above-sanity-ceiling';

export class TransferInvariantError extends Error {
  constructor(public readonly reason: TransferInvariantViolation, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'TransferInvariantError';
  }
}

/**
 * Hard, unbypassable safety checks on a raw `Cat21TransferIntent`.
 *
 * Same shape as `enforceMintInvariants`: throws on first violation
 * with a typed `TransferInvariantError`, returns the `Validated<>`
 * brand on success. The cat existence check (does this catId really
 * correspond to a cat the user owns?) is the caller's responsibility
 * — happens via cat21-ord lookup in the RPC orchestrator.
 */
export function enforceTransferInvariants(
  intent: Cat21TransferIntent,
  network: 'mainnet' | 'testnet'
): Validated<Cat21TransferIntent> {
  if (typeof intent.catId !== 'string' || !CAT_ID_PATTERN.test(intent.catId)) {
    throw new TransferInvariantError('cat-id-malformed', String(intent.catId));
  }

  const recipientNetwork = decodeAddressNetwork(intent.recipient);
  if (recipientNetwork === null) {
    throw new TransferInvariantError('recipient-not-a-bitcoin-address', intent.recipient);
  }
  if (recipientNetwork !== network) {
    throw new TransferInvariantError(
      'recipient-wrong-network',
      `expected ${network}, got ${recipientNetwork}`
    );
  }

  if (!Number.isFinite(intent.feeRate) || !(intent.feeRate > 0)) {
    throw new TransferInvariantError('fee-rate-not-positive', String(intent.feeRate));
  }
  if (intent.feeRate > TRANSFER_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE) {
    throw new TransferInvariantError(
      'fee-rate-above-sanity-ceiling',
      `${intent.feeRate} > ${TRANSFER_FEE_RATE_SANITY_CEILING_SAT_PER_VBYTE}`
    );
  }

  return intent as Validated<Cat21TransferIntent>;
}

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
