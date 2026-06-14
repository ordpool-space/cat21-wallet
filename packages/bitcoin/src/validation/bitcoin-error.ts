import { TransactionErrorKey } from '@leather.io/models';

export class BitcoinError extends Error {
  public message: BitcoinErrorKey;
  constructor(message: BitcoinErrorKey) {
    super(message);
    this.name = 'BitcoinError';
    this.message = message;

    // Fix the prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type BitcoinErrorKey =
  | TransactionErrorKey
  | 'InsufficientAmount'
  | 'NoInputsToSign'
  | 'NoOutputsToSign'
  | 'InscribedUtxos';
/* HACK -- Cat21: cat-specific error keys lived here for the mint/offer
 * builders (Cat21Mint*, Cat21Offer*). Builders moved to ordpool-sdk per
 * CLAUDE.md scope cut (2026-06-14); errors moved with them. */
