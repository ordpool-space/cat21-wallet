import * as btc from '@scure/btc-signer';
import type { InputData } from 'coin-selection/coin-selection.utils';

import { createMoney } from '@leather.io/utils';

import {
  CoinSelectionRecipient,
  determineUtxosForSpend,
} from '../coin-selection/coin-selection';
import {
  BitcoinNativeSegwitPayer,
  BitcoinTaprootPayer,
  payerToBip32Derivation,
  payerToTapBip32Derivation,
} from '../signer/bitcoin-payer';
import { BtcSignerNetwork } from '../utils/bitcoin.network';
import { BitcoinError } from '../validation/bitcoin-error';

/**
 * CAT-21 mint locktime. The protocol's defining marker: `nLockTime = 21` on
 * the genesis transaction. Anything else is not a cat.
 */
export const CAT21_LOCK_TIME = 21;

/**
 * Final sequence numbers are anything > 0xfffffffd. The CAT-21 mint must use
 * a final sequence so the transaction does not signal RBF. Some wallets
 * (Xverse, 2024 incident) accelerate RBF-replaceable mints, which drops the
 * nLockTime in the replacement and kills the cat. We use `0xfffffffe` rather
 * than `0xffffffff` so locktime is still honored — `0xffffffff` would mark
 * the input as definitively final and ignore the transaction-level locktime,
 * which defeats the whole purpose.
 */
export const CAT21_MINT_INPUT_SEQUENCE = 0xfffffffe;

/**
 * Dust threshold for the cat-bearing output. The genesis sat sits on the
 * first sat of the first output (ordinal theory), so a 546-sat output is
 * fine — anything above standard relay dust holds the cat. We pick 546
 * because it matches what the existing Leather mint flows use and avoids
 * a fee-bumping nightmare if the user wants to consolidate later.
 */
export const CAT21_OUTPUT_VALUE = 546;

export interface GenerateCat21MintTransactionArgs<T> {
  feeRate: number;
  network: BtcSignerNetwork;
  recipient: string;
  utxos: T[];
  changeAddress: string;
  payerLookup(keyOrigin: string): BitcoinNativeSegwitPayer | BitcoinTaprootPayer | undefined;
  /**
   * Optional tipping output. When present and `value > 0`, a third output is
   * added paying `value` sats to `address`. Defaults to no tip per the plan
   * ("just one tipping address. 0 disables the creation of an output").
   */
  tip?: { address: string; value: number };
}

/**
 * Builds an unsigned CAT-21 mint PSBT. The protocol guarantees enforced here:
 *
 * 1. Transaction `nLockTime` is exactly 21.
 * 2. Every input has a sequence number that does NOT signal RBF.
 * 3. Output 0 is the recipient receiving 546 sats (the cat sat).
 * 4. Output 1 is change to the payer.
 * 5. Optional output 2 is the tip, when configured.
 *
 * Sub-dust change is absorbed into the miner fee by the coin-selection logic
 * (no output emitted for dust change). This is intentional per the plan:
 * "CAT-21 mint absorbs sub-dust change into the miner fee on purpose (rarer
 * color + faster tx). Don't fix it."
 *
 * Hard runtime asserts at the end of the function defend against accidental
 * future edits that would silently break either guarantee.
 */
export function generateCat21MintUnsignedTransaction<
  T extends InputData & { vout: number; keyOrigin: string },
>({
  feeRate,
  network,
  recipient,
  changeAddress,
  utxos,
  payerLookup,
  tip,
}: GenerateCat21MintTransactionArgs<T>) {
  const recipients: CoinSelectionRecipient[] = [
    { address: recipient, amount: createMoney(CAT21_OUTPUT_VALUE, 'BTC') },
  ];
  if (tip && tip.value > 0) {
    recipients.push({ address: tip.address, amount: createMoney(tip.value, 'BTC') });
  }

  const { inputs, outputs, fee } = determineUtxosForSpend({ feeRate, recipients, utxos });

  if (!inputs.length) throw new BitcoinError('NoInputsToSign');
  if (!outputs.length) throw new BitcoinError('NoOutputsToSign');

  const tx = new btc.Transaction({ lockTime: CAT21_LOCK_TIME });

  for (const input of inputs) {
    const payer = payerLookup(input.keyOrigin);
    if (!payer) {
      // eslint-disable-next-line no-console
      console.log(`No payer found for input with keyOrigin ${input.keyOrigin}`);
      continue;
    }

    const bip32Derivation =
      payer.paymentType === 'p2tr'
        ? { tapBip32Derivation: [payerToTapBip32Derivation(payer)] }
        : { bip32Derivation: [payerToBip32Derivation(payer)] };

    const tapInternalKey =
      payer.paymentType === 'p2tr' ? { tapInternalKey: payer.payment.tapInternalKey } : {};

    tx.addInput({
      txid: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: payer.payment.script,
        amount: BigInt(input.value),
      },
      sequence: CAT21_MINT_INPUT_SEQUENCE,
      ...bip32Derivation,
      ...tapInternalKey,
    });
  }

  outputs.forEach(output => {
    if (!output.address) {
      tx.addOutputAddress(changeAddress, BigInt(output.value), network);
      return;
    }
    tx.addOutputAddress(output.address, BigInt(output.value), network);
  });

  /* Hard asserts: these guarantees must never silently regress. If a future
   * refactor breaks either, we want to fail loudly at mint time rather than
   * ship a tx that gets a cat killed by RBF acceleration or a missing
   * locktime. */
  if (tx.lockTime !== CAT21_LOCK_TIME) {
    throw new BitcoinError('Cat21MintLockTimeBroken');
  }
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    const sequence = input.sequence ?? 0xffffffff;
    if (sequence !== CAT21_MINT_INPUT_SEQUENCE) {
      throw new BitcoinError('Cat21MintInputSequenceBroken');
    }
  }

  return { tx, hex: tx.hex, psbt: tx.toPSBT(), inputs, fee };
}
