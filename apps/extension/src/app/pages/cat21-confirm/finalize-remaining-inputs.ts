import * as btc from '@scure/btc-signer';

/**
 * Finalise every input that is not already finalised.
 *
 * An ord-acceptable buy-offer arrives with its buyer inputs (1..N) already
 * finalised (final scriptSig/witness present, per-input partialSig cleared);
 * the seller only signs input 0 at accept time. scure's `Transaction.finalize()`
 * finalises ALL inputs and throws "Not enough partial sign" on the buyer inputs
 * because their partialSig is gone. Finalising only the not-yet-final inputs
 * leaves the buyer inputs intact and finalises the seller's input 0.
 *
 * Mint and transfer PSBTs carry no pre-finalised inputs, so every input is
 * finalised there, identical to finalising the whole transaction.
 */
export function finalizeRemainingInputs(tx: btc.Transaction): void {
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    const alreadyFinal =
      (input.finalScriptWitness?.length ?? 0) > 0 || (input.finalScriptSig?.length ?? 0) > 0;
    if (!alreadyFinal) tx.finalizeIdx(i);
  }
}
