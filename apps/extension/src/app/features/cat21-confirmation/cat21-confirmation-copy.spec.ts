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
        {
          label: 'Goes to',
          value: 'bc1q w508 d6qe jxtd g4y5 r3za rvar y0c5 xw7k v8f3 t4',
          verify: true,
        },
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
      expect(copy.rows[1]).toEqual({
        label: 'Goes to',
        value: 'bc1q w508 d6qe jxtd g4y5 r3za rvar y0c5 xw7k v8f3 t4',
        verify: true,
      });
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
      expect(copy.rows[1]).toEqual({ label: 'Price', value: '21 000 sats' });
      expect(copy.rows[2]).toEqual({
        label: 'Paid to',
        value: 'bc1q paym entt osel ler',
        verify: true,
      });
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
        { label: 'You get', value: '21 000 sats' },
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
        { label: 'You pay', value: '50 000 sats' },
        // Seller payout arrived from the offer: truncated by default, full
        // grouped form on demand (the person has nothing to compare it to).
        {
          label: "Seller's address",
          value: 'bc1qsell…mentaddr',
          reveal: 'bc1q sell erpa ymen tadd r',
        },
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
      expect(buy.rows.find(r => r.label === 'You pay')?.value).toBe('50 000 sats');
      expect(buy.rows.some(r => r.label === 'You get')).toBe(false);
      expect(buy.paragraphs.join(' ')).toMatch(/you pay/i);
    });

    it('sell/accept: the amount is "You get" (money arrives), never "You pay"', () => {
      expect(sell.rows.find(r => r.label === 'You get')?.value).toBe('21 000 sats');
      expect(sell.rows.some(r => r.label === 'You pay')).toBe(false);
      expect(sell.paragraphs.join(' ')).toMatch(/you are paid|you get/i);
    });
  });

  describe('sats amounts are locale-independent', () => {
    // A bare `.toLocaleString()` groups by the browser locale: "1,234,567"
    // in en-US, "1.234.567" in de-DE. On a spending prompt "21.000" reads as
    // twenty-one. Amounts must group with a plain space regardless of locale.
    // Reverting `formatSats` to `n.toLocaleString()` makes this red on any
    // runner: en-US emits commas, de-DE emits dots, neither is a space.
    it('groups thousands with a space, never a locale comma or dot', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        catNumber: 7,
        bidSats: 1_234_567,
        sellerPaymentAddress: 'bc1qseller',
        feeRate: 5,
        mode: 'manual',
      });
      const amount = copy.rows.find(r => r.label === 'You pay')?.value;
      expect(amount).toBe('1 234 567 sats');
      expect(amount).not.toContain(',');
      expect(amount).not.toContain('.');
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
          ...copy.rows.flatMap(r => [r.label, r.value, r.reveal ?? '']),
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

  describe('destination-address verification (§7.14)', () => {
    // The security property: a destination address the person commits value
    // to is rendered in FULL, never head…tail-truncated. Address poisoning
    // forges a lookalike that matches only the head and tail, so truncation
    // hides the swapped middle. Reverting `verifyAddressRow` to truncate
    // (the pre-§7.14 behaviour) makes the "no character is lost" assertions
    // below red on every verify row.
    const FULL = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

    it('marks the destination row as a verify row', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: FULL,
        feeRate: 5,
        mode: 'manual',
      });
      const dest = copy.rows.find(r => r.label === 'Goes to');
      expect(dest?.verify).toBe(true);
    });

    it('comparable destinations (mint / transfer / create-offer) render the FULL address as a verify row', () => {
      // These are addresses the person chose or that are their own, so the
      // full grouped form is on screen with no action needed. Reverting
      // `verifyAddressRow` to truncate makes the strip-restores assertion red.
      const intents: Cat21Intent[] = [
        { recipient: FULL, feeRate: 5, mode: 'manual' },
        { catId: 'aaai0', recipient: FULL, feeRate: 5, mode: 'manual' },
        { catId: 'aaai0', priceSats: 21_000, paymentAddress: FULL, mode: 'manual' },
      ];
      for (const intent of intents) {
        const copy = makeCat21ConfirmationCopy(intent);
        const verifyRows = copy.rows.filter(r => r.verify);
        expect(verifyRows.length).toBe(1);
        expect(verifyRows[0].reveal).toBeUndefined();
        // Full address present, byte-for-byte, once the display grouping is removed.
        expect(verifyRows[0].value.replace(/ /gu, '')).toBe(FULL);
      }
    });

    it("buy's seller address is a reveal row: truncated by default, FULL grouped form still byte-complete", () => {
      // The seller payout arrived from the offer; the person has nothing to
      // compare it against, so it is truncated by default. The full grouped
      // form must still be present and byte-complete in `reveal` — never a
      // second truncation. Dropping the full form (e.g. reveal === value)
      // makes the strip-restores assertion red.
      const copy = makeCat21ConfirmationCopy({
        catId: 'aaai0',
        catNumber: 42,
        bidSats: 50_000,
        sellerPaymentAddress: FULL,
        feeRate: 5,
        mode: 'manual',
      });
      const seller = copy.rows.find(r => r.label === "Seller's address");
      expect(seller?.verify).toBeUndefined();
      // Default display is truncated head…tail (that's the whole point of reveal).
      expect(seller?.value).toBe('bc1qw508…7kv8f3t4');
      // The revealed form is the full address, byte-for-byte, once grouping is stripped.
      expect(seller?.reveal?.replace(/ /gu, '')).toBe(FULL);
    });

    it('groups the address in four-character chunks so a mid-string swap is visible', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: FULL,
        feeRate: 5,
        mode: 'manual',
      });
      const dest = copy.rows.find(r => r.label === 'Goes to');
      const value = dest?.value ?? '';
      expect(value).toBe('bc1q w508 d6qe jxtd g4y5 r3za rvar y0c5 xw7k v8f3 t4');
      // No chunk longer than four characters.
      for (const chunk of value.split(' ')) {
        expect(chunk.length).toBeLessThanOrEqual(4);
      }
    });

    it('still truncates the optional tip address in the paragraph (not a value the flow commits to a destination row)', () => {
      const copy = makeCat21ConfirmationCopy({
        recipient: FULL,
        feeRate: 5,
        mode: 'manual',
        tip: { address: 'bc1qrecipientttippp', value: 21 },
      });
      expect(copy.paragraphs[1]).toMatch(/bc1qreci…ntttippp/);
    });

    it('formats catId as `<8 chars>…<i suffix>` (compact, not a verify row)', () => {
      const copy = makeCat21ConfirmationCopy({
        catId: 'abcdef0123456789xxxxi42',
        recipient: 'bc1qrcp',
        feeRate: 5,
        mode: 'manual',
      });
      expect(copy.rows[0].value).toBe('abcdef01…i42');
      expect(copy.rows[0].verify).toBeUndefined();
    });
  });
});
