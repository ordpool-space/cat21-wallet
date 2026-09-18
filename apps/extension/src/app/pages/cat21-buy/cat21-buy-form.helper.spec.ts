import { describe, expect, it } from 'vitest';

import { parseBuyTargetInput, validateAndCoerceBuyForm } from './cat21-buy-form.helper';

const VALID_CAT_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0';
const MAINNET_ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

describe('parseBuyTargetInput', () => {
  it('parses a bare cat number', () => {
    expect(parseBuyTargetInput('42')).toEqual({
      catNumber: 42,
      askSats: null,
      sellerPaymentAddress: null,
    });
  });

  it('parses a full ask link (query params)', () => {
    const link = `https://cat21.space/buy?catNumber=42&askPrice=21000&payTo=${MAINNET_ADDR}`;
    const parsed = parseBuyTargetInput(link);
    expect(parsed.catNumber).toBe(42);
    expect(parsed.askSats).toBe(21_000);
    expect(parsed.sellerPaymentAddress).toBe(MAINNET_ADDR);
  });

  it('parses a hash-fragment link', () => {
    const link = `https://cat21.space/buy#catNumber=7&askPrice=5000&payTo=${MAINNET_ADDR}`;
    const parsed = parseBuyTargetInput(link);
    expect(parsed.catNumber).toBe(7);
    expect(parsed.askSats).toBe(5_000);
    expect(parsed.sellerPaymentAddress).toBe(MAINNET_ADDR);
  });

  it('parses a bare query string', () => {
    const parsed = parseBuyTargetInput(`catNumber=100&askPrice=99000&payTo=${MAINNET_ADDR}`);
    expect(parsed.catNumber).toBe(100);
    expect(parsed.askSats).toBe(99_000);
    expect(parsed.sellerPaymentAddress).toBe(MAINNET_ADDR);
  });

  it('trims whitespace and treats an empty input as no target', () => {
    expect(parseBuyTargetInput('   ')).toEqual({
      catNumber: null,
      askSats: null,
      sellerPaymentAddress: null,
    });
  });

  it('returns nulls for an unparseable string', () => {
    expect(parseBuyTargetInput('nonsense')).toEqual({
      catNumber: null,
      askSats: null,
      sellerPaymentAddress: null,
    });
  });
});

describe('validateAndCoerceBuyForm', () => {
  function args(over: Partial<{ bidSats: string; feeRate: string }> = {}) {
    return {
      values: { bidSats: '21000', feeRate: '5', ...over },
      catId: VALID_CAT_ID,
      catNumber: 42,
      sellerPaymentAddress: MAINNET_ADDR,
    };
  }

  it('coerces a valid form into a Cat21BuyIntent', () => {
    const result = validateAndCoerceBuyForm(args());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.intent).toEqual({
      catId: VALID_CAT_ID,
      catNumber: 42,
      bidSats: 21_000,
      sellerPaymentAddress: MAINNET_ADDR,
      feeRate: 5,
    });
  });

  it('rejects a non-positive bid', () => {
    const result = validateAndCoerceBuyForm(args({ bidSats: '0' }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errors.bidSats).toBeDefined();
  });

  it('rejects a fractional bid', () => {
    const result = validateAndCoerceBuyForm(args({ bidSats: '21000.5' }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errors.bidSats).toBeDefined();
  });

  it('rejects a non-positive fee rate', () => {
    const result = validateAndCoerceBuyForm(args({ feeRate: '0' }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errors.feeRate).toBeDefined();
  });
});
