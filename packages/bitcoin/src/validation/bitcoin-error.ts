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
  | 'InscribedUtxos'
  /* HACK -- Cat21: mint-guarantee errors per Phase 3.2 safety. These fire if a
   * future refactor breaks the nLockTime=21 or no-RBF sequence invariants. */
  | 'Cat21MintLockTimeBroken'
  | 'Cat21MintInputSequenceBroken';
