import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { toPaymentAddress, validateCat21BuyOfferPsbt } from 'ordpool-sdk/core';
import { describe, expect, it } from 'vitest';

import { walletNetworkToSdkNetwork } from '../cat21-rpc.service';
import type { Cat21AcceptOfferIntent } from '../types';
import { validateAcceptOffer } from './accept-offer-validator';

/**
 * SEAM test (audit T6, load-bearing: do not delete as redundant with the
 * stubbed validator specs): an inbound buy offer is accepted whatever its
 * nLockTime, through the wallet's `validateAcceptOffer` wired to the REAL SDK
 * `validateCat21BuyOfferPsbt`.
 *
 * WAL HARD RULE #1 and HQ: `nLockTime=21` is CONVENTION outside a mint. A buyer
 * on cat21-wallet or the SDK builds lockTime 21 (a bonus mint); a buyer on stock
 * ord builds lockTime 0. Both are legitimate sales: the cat still moves by sat
 * tracking and the seller is paid either way, so the seller-side check must
 * accept both and assert nothing about the locktime. Rejecting lockTime 0 would
 * lose the seller a sale for the buyer's missed bonus mint.
 *
 * The other specs stub the SDK delegate, so only this one proves the seam.
 */

const SELLER_PAYMENT = btc.p2wpkh(
  hex.decode('030000000000000000000000000000000000000000000000000000000000000003'),
  btc.NETWORK
);
const BUYER = btc.p2wpkh(
  hex.decode('020000000000000000000000000000000000000000000000000000000000000002'),
  btc.NETWORK
);
const SELLER_CAT = { txid: 'fe'.repeat(32), vout: 0 };
const CAT_POSTAGE = 546n;
const PRICE_SATS = 100_000;

function addressOf(payment: { address?: string }): string {
  if (!payment.address) throw new Error('btc-signer returned no address');
  return payment.address;
}

/**
 * An ord-style buy offer: input 0 the seller's (unsigned) cat, input 1 the
 * buyer's funding coin, finalised under SIGHASH_ALL; output 0 the cat to the
 * buyer, output 1 the price plus the cat's value to the seller. Only the
 * locktime differs between the two variants.
 */
function buyOffer(lockTime: number): Uint8Array {
  const tx = new btc.Transaction({ lockTime, allowUnknownInputs: true });
  tx.addInput({
    txid: SELLER_CAT.txid,
    index: SELLER_CAT.vout,
    witnessUtxo: { script: SELLER_PAYMENT.script, amount: CAT_POSTAGE },
  });
  tx.addInput({
    txid: 'ab'.repeat(32),
    index: 1,
    witnessUtxo: { script: BUYER.script, amount: 200_000n },
  });
  tx.addOutputAddress(addressOf(BUYER), CAT_POSTAGE, btc.NETWORK);
  tx.addOutputAddress(addressOf(SELLER_PAYMENT), BigInt(PRICE_SATS) + CAT_POSTAGE, btc.NETWORK);
  // The buyer's finalised input: a DER signature ending in the SIGHASH_ALL
  // byte, plus the pubkey. Set last, because a finalised input freezes the
  // outputs.
  tx.updateInput(1, {
    finalScriptWitness: [new Uint8Array([0x30, 0x01]), new Uint8Array(33)],
  });
  return tx.toPSBT();
}

function accept(lockTime: number) {
  const intent: Cat21AcceptOfferIntent = {
    offerPsbt: hex.encode(buyOffer(lockTime)),
    expectedCatId: `${'fe'.repeat(32)}i0`,
    expectedPriceSats: PRICE_SATS,
    expectedSellerUtxo: SELLER_CAT,
  };
  return validateAcceptOffer(
    {
      intent,
      psbtBytes: buyOffer(lockTime),
      expectedSellerPaymentAddress: addressOf(SELLER_PAYMENT),
      network: 'mainnet',
    },
    // The production adapter (use-cat21-rpc-deps.ts), so the seam is the real one.
    args =>
      validateCat21BuyOfferPsbt({
        psbt: args.psbt,
        expectedSellerUtxo: args.expectedSellerUtxo,
        floorPriceSats: args.floorPriceSats,
        expectedSellerPaymentAddress: toPaymentAddress(args.expectedSellerPaymentAddress),
        network: walletNetworkToSdkNetwork(args.network),
      })
  );
}

describe('accept-offer seam: inbound nLockTime (real SDK validator)', () => {
  it('accepts an offer built with lockTime 21 (cat21-wallet / SDK buyer)', () => {
    expect(accept(21)).toMatchObject({ ok: true });
  });

  it('accepts the same offer built with lockTime 0 (stock-ord buyer) with the same price', () => {
    const at21 = accept(21);
    const at0 = accept(0);
    expect(at0).toMatchObject({ ok: true });
    if (!at0.ok || !at21.ok) throw new Error('expected both to be accepted');
    expect(at0.pricePaidSats).toBe(at21.pricePaidSats);
  });
});
