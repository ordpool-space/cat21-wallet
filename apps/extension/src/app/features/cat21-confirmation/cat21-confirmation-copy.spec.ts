import { describe, expect, it } from 'vitest';

import type { Cat21Intent } from '@background/cat21/types';

import { makeCat21ConfirmationCopy } from './cat21-confirmation-copy';

describe('makeCat21ConfirmationCopy', () => {
  describe('mint', () => {
    it('produces the mint title + goes-to + fee-rate rows', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.title).toBe('Mint a cat');
      expect(copy.approveButtonLabel).toBe('Mint cat');
      expect(copy.rows).toEqual([
        { label: 'Goes to', value: 'bc1qw508…7kv8f3t4' },
        { label: 'Fee rate', value: '5 sat/vB' },
      ]);
    });

    it('appends a tip-mention paragraph when intent carries a positive tip', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
        tip: { address: 'bc1qrecipientttippp', value: 21 },
      });
      expect(copy.paragraphs.length).toBe(2);
      expect(copy.paragraphs[1]).toMatch(/21 sats tip/);
      expect(copy.paragraphs[1]).toMatch(/bc1qreci…ntttippp/);
    });

    it('omits the tip paragraph when tip.value is zero', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
        tip: { address: 'bc1qabc', value: 0 },
      });
      expect(copy.paragraphs.length).toBe(1);
      expect(copy.paragraphs[0]).not.toMatch(/tip/);
    });
  });

  describe('transfer', () => {
    it('emits the send-cat copy with cat id, goes-to, fee-rate', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892i0',
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.title).toBe('Send your cat');
      expect(copy.approveButtonLabel).toBe('Send cat');
      expect(copy.rows[0]).toEqual({ label: 'Cat', value: '98316dcb…i0' });
      expect(copy.rows[1]).toEqual({ label: 'Goes to', value: 'bc1qw508…7kv8f3t4' });
      expect(copy.rows[2]).toEqual({ label: 'Fee rate', value: '5 sat/vB' });
    });
  });

  describe('create-offer', () => {
    it('emits the list-cat copy with cat id, price, paid-to', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        priceSats: 21_000,
        paymentAddress: 'bc1qpaymenttoseller',
        mode: 'manual',
      });
      expect(copy.title).toBe('List your cat for sale');
      expect(copy.approveButtonLabel).toBe('List cat');
      expect(copy.rows[1]).toEqual({ label: 'Price', value: '21,000 sats' });
      expect(copy.rows[2]).toEqual({ label: 'Paid to', value: 'bc1qpaym…toseller' });
    });

    it('emphasises that nothing moves on-chain yet', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        priceSats: 21_000,
        paymentAddress: 'bc1qpayment',
        mode: 'manual',
      });
      expect(copy.paragraphs[0]).toMatch(/[Nn]othing moves on-chain yet/);
    });
  });

  describe('accept-offer', () => {
    it('emits the sell-cat copy with cat id + the amount the seller gets', () => {
      const copy = makeCat21ConfirmationCopy({
        offerPsbt: 'abcdef'.repeat(50),
        expectedCatId: 'cat-being-soldi3',
        expectedPriceSats: 21_000,
        expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
        mode: 'manual',
      });
      expect(copy.title).toBe('Sell your cat');
      expect(copy.approveButtonLabel).toBe('Sell cat');
      expect(copy.rejectButtonLabel).toBe('Reject offer');
      // The user's decision input is the money they receive, not a byte count.
      expect(copy.rows).toEqual([
        { label: 'Cat', value: 'cat-bein…i3' },
        { label: 'You get', value: '21,000 sats' },
      ]);
    });
  });

  describe('buy', () => {
    it('emits the bid copy with cat number, amount paid, seller address, fee-rate', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        catNumber: 42,
        bidSats: 50_000,
        sellerPaymentAddress: 'bc1qsellerpaymentaddr',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.title).toBe('Bid on Cat #42');
      expect(copy.approveButtonLabel).toBe('Place bid');
      expect(copy.rows).toEqual([
        { label: 'Cat', value: '#42' },
        { label: 'You pay', value: '50,000 sats' },
        { label: "Seller's address", value: 'bc1qsell…mentaddr' },
        { label: 'Fee rate', value: '5 sat/vB' },
      ]);
    });
  });

  describe('money direction is correct where money moves', () => {
    // The one class of copy bug that costs a user money rather than merely
    // confusing them: telling a buyer "You get: 50,000" (income) when they are
    // in fact paying, or a seller "You pay" when they are being paid. Pin the
    // direction on both money-moving dialogs.
    const buy = makeCat21ConfirmationCopy({
      catId: 'aaai0',
      catNumber: 7,
      bidSats: 50_000,
      sellerPaymentAddress: 'bc1qsellerpaymentaddr',
      feeRate: 5,
      mode: 'manual',
    });
    const sell = makeCat21ConfirmationCopy({
      offerPsbt: 'aabbcc',
      expectedCatId: 'soldi3',
      expectedPriceSats: 21_000,
      expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
      mode: 'manual',
    });

    it('buy: the amount is "You pay" (money leaves), never "You get"', () => {
      expect(buy.rows.find(r => r.label === 'You pay')?.value).toBe('50,000 sats');
      expect(buy.rows.some(r => r.label === 'You get')).toBe(false);
      expect(buy.paragraphs.join(' ')).toMatch(/you pay/i);
    });

    it('sell/accept: the amount is "You get" (money arrives), never "You pay"', () => {
      expect(sell.rows.find(r => r.label === 'You get')?.value).toBe('21,000 sats');
      expect(sell.rows.some(r => r.label === 'You pay')).toBe(false);
      expect(sell.paragraphs.join(' ')).toMatch(/you are paid|you get/i);
    });
  });

  describe('no protocol or engineering vocabulary reaches the user (§7.6)', () => {
    // Every string a user reads on an approval dialog. A banned word here
    // is a real regression: mutating any copy string back to the old
    // jargon ("nLockTime=21", "PSBT bytes", "first sat of the first
    // output") turns exactly this test red.
    const banned = [
      'nlocktime',
      'psbt',
      'first sat of the first output',
      'regtest',
      'verified',
      'coverage',
      'e2e',
      'leather fork',
      'sighash',
    ];
    const samples: Cat21Intent[] = [
      { recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', feeRate: 5, mode: 'manual' },
      {
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
        tip: { address: 'bc1qtipaddress', value: 21 },
      },
      { catId: 'aaai0', recipient: 'bc1qrcp', feeRate: 5, mode: 'manual' },
      { catId: 'aaai0', priceSats: 21_000, paymentAddress: 'bc1qpay', mode: 'manual' },
      {
        offerPsbt: 'aabbcc',
        expectedCatId: 'soldi3',
        expectedPriceSats: 21_000,
        expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
        mode: 'manual',
      },
      {
        catId: 'aaai0',
        catNumber: 42,
        bidSats: 50_000,
        sellerPaymentAddress: 'bc1qseller',
        feeRate: 5,
        mode: 'manual',
      },
    ];

    it('no banned word appears in any title, paragraph, row, or button', () => {
      for (const intent of samples) {
        const copy = makeCat21ConfirmationCopy(intent);
        const surface = [
          copy.title,
          ...copy.paragraphs,
          ...copy.rows.flatMap(r => [r.label, r.value]),
          copy.approveButtonLabel,
          copy.rejectButtonLabel,
        ]
          .join(' ')
          .toLowerCase();
        for (const word of banned) {
          expect(surface).not.toContain(word);
        }
      }
    });
  });

  describe('address formatting', () => {
    it('truncates long bitcoin addresses to head…tail', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.rows[0].value).toBe('bc1qw508…7kv8f3t4');
    });

    it('passes through short addresses untouched', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: 'bc1qabc',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.rows[0].value).toBe('bc1qabc');
    });

    it('formats catId as `<8 chars>…<i suffix>`', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'abcdef0123456789xxxxi42',
        recipient: 'bc1qrcp',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.rows[0].value).toBe('abcdef01…i42');
    });
  });
});
