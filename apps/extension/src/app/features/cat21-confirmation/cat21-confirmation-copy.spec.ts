import { describe, expect, it } from 'vitest';

import { makeCat21ConfirmationCopy } from './cat21-confirmation-copy';

describe('makeCat21ConfirmationCopy', () => {
  describe('mint', () => {
    it('produces the celebratory mint title + recipient + fee-rate rows', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.title).toBe('Mint a CAT-21 cat');
      expect(copy.approveButtonLabel).toBe('Mint cat');
      expect(copy.rows).toEqual([
        { label: 'Recipient', value: 'bc1qw508…7kv8f3t4' },
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
      expect(copy.paragraphs[1]).toMatch(/developer tip of 21 sats/);
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
    it('emits the send-cat copy with cat id, recipient, fee-rate', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892i0',
        recipient: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.title).toBe('Send your CAT-21 cat');
      expect(copy.approveButtonLabel).toBe('Send cat');
      expect(copy.rows[0]).toEqual({ label: 'Cat', value: '98316dcb…i0' });
      expect(copy.rows[1]).toEqual({
        label: 'Recipient',
        value: 'bc1qw508…7kv8f3t4',
      });
      expect(copy.rows[2]).toEqual({ label: 'Fee rate', value: '5 sat/vB' });
    });

    it('mentions nLockTime=21 preservation (HARD RULE #1)', () => {
      // The user-facing copy MUST surface the "you get another cat on
      // the same sat" framing — that's the whole point of preserving
      // lockTime=21 on transfers.
      const copy = makeCat21ConfirmationCopy({
        catId: 'xxxxi0',
        recipient: 'bc1qaaa',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.paragraphs.join(' ')).toMatch(/nLockTime=21/);
    });
  });

  describe('create-offer', () => {
    it('emits the list-cat copy with cat id, price, payment-to', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        priceSats: 21_000,
        paymentAddress: 'bc1qpaymenttoseller',
        mode: 'manual',
      });
      expect(copy.title).toBe('List your CAT-21 cat for sale');
      expect(copy.approveButtonLabel).toBe('List cat');
      expect(copy.rows[1]).toEqual({ label: 'Asking price', value: '21,000 sats' });
      expect(copy.rows[2]).toEqual({
        label: 'Payment to',
        value: 'bc1qpaym…toseller',
      });
    });

    it('emphasises that no broadcast happens yet', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        priceSats: 21_000,
        paymentAddress: 'bc1qpayment',
        mode: 'manual',
      });
      expect(copy.paragraphs[0]).toMatch(/no transaction is broadcast yet/);
    });
  });

  describe('accept-offer', () => {
    it('emits the sell-cat copy with cat id + PSBT size', () => {
      const copy = makeCat21ConfirmationCopy({
        offerPsbt: 'abcdef'.repeat(50),
        expectedCatId: 'cat-being-soldi3',
        expectedPriceSats: 21_000,
        expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
        mode: 'manual',
      });
      expect(copy.title).toBe('Accept a buy offer for your CAT-21 cat');
      expect(copy.approveButtonLabel).toBe('Sell cat');
      expect(copy.rejectButtonLabel).toBe('Reject offer');
      // PSBT length is conveyed as a row, so the user can sanity-check
      // it doesn't look catastrophically large or small.
      const psbtRow = copy.rows.find(r => r.label === 'PSBT bytes');
      expect(psbtRow?.value).toBe(`${'abcdef'.repeat(50).length} chars`);
    });

    it('warns that broadcast happens immediately on approve', () => {
      const copy = makeCat21ConfirmationCopy({
        offerPsbt: 'aabbcc',
        expectedCatId: 'cat-being-soldi3',
        expectedPriceSats: 21_000,
        expectedSellerUtxo: { txid: 'a'.repeat(64), vout: 0 },
        mode: 'manual',
      });
      expect(copy.paragraphs.join(' ')).toMatch(/broadcasts immediately/);
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
