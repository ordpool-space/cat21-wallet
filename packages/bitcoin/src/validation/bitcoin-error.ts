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
  | 'Cat21MintInputSequenceBroken'
  /* HACK -- Cat21: buy-offer SIGHASH_ALL guarantee broken (Phase 4.1). Sniping
   * resistance requires every input to use SIGHASH_ALL. */
  | 'Cat21OfferSighashBroken'
  /* HACK -- Cat21: sell-side offer validation failures (Phase 4.2). */
  | 'Cat21OfferMissingSellerInput'
  | 'Cat21OfferWrongPostage'
  | 'Cat21OfferWrongPrice'
  | 'Cat21OfferBuyerInputUnsigned';
