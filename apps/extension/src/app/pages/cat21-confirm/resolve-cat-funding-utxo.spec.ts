import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';

import type { OrdCat21 } from '@leather.io/services';

import { resolveCatFundingUtxo } from './resolve-cat-funding-utxo';

// A real curve point (secp256k1 generator G, x-only) → a valid mainnet
// taproot address + its scriptPubKey, derived by a code path (btc.p2tr)
// independent of the helper's (Address().decode → OutScript.encode).
const gXOnly = hex.decode('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
const p2tr = btc.p2tr(gXOnly, undefined, btc.NETWORK);
const ORDINALS_ADDRESS = p2tr.address as string;
const TXID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function makeCat(overrides: Partial<OrdCat21> = {}): OrdCat21 {
  return {
    id: 'cat-tx0i0',
    number: 42,
    satpoint: `${TXID}:0:0`,
    address: ORDINALS_ADDRESS,
    content_type: null,
    height: 824205,
    fee: 1000,
    weight: 400,
    value: 546,
    block_hash: '0'.repeat(64),
    timestamp: 1_700_000_000,
    ...overrides,
  };
}

describe('resolveCatFundingUtxo', () => {
  // The core signs `value` as the input-0 witnessUtxo amount, so a cat
  // on a non-546 UTXO (external nLockTime=21 mint, grown cat, or an
  // inscription-that-is-also-a-cat) MUST carry its real size through, or
  // the signature is invalid. Stress non-546 sizes per the SDK rule.
  it.each([546, 9000, 20000, 30000, 2_100_000_000])(
    'PRESERVES the cat UTXO value %i (never rewrites to 546)',
    value => {
      const utxo = resolveCatFundingUtxo(makeCat({ value }), 'mainnet');
      expect(utxo.value).toBe(value);
    }
  );

  it('parses txid + vout from the three-part satpoint', () => {
    const utxo = resolveCatFundingUtxo(makeCat({ satpoint: `${TXID}:3:17` }), 'mainnet');
    expect(utxo.txid).toBe(TXID);
    expect(utxo.vout).toBe(3);
  });

  it('encodes the scriptPubKey from the cat address (taproot, independent derivation)', () => {
    const utxo = resolveCatFundingUtxo(makeCat(), 'mainnet');
    expect(hex.encode(utxo.scriptPubKey)).toBe(hex.encode(p2tr.script));
  });

  it('encodes a native-segwit address to its BIP173 scriptPubKey', () => {
    const utxo = resolveCatFundingUtxo(
      makeCat({ address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' }),
      'mainnet'
    );
    // BIP173 P2WPKH test vector — a published known-answer, not the
    // helper's own output fed back in.
    expect(hex.encode(utxo.scriptPubKey)).toBe('0014751e76e8199196d454941c45d1b3a323f1433bd6');
  });

  it('decodes the address against the testnet network when asked', () => {
    const tnet = btc.p2tr(gXOnly, undefined, btc.TEST_NETWORK);
    const utxo = resolveCatFundingUtxo(makeCat({ address: tnet.address as string }), 'testnet');
    expect(hex.encode(utxo.scriptPubKey)).toBe(hex.encode(tnet.script));
  });

  it('throws when the cat has no address (unconfirmed / already-spent)', () => {
    expect(() => resolveCatFundingUtxo(makeCat({ address: null }), 'mainnet')).toThrow(
      'cat21-ord returned cat without address'
    );
  });

  it.each([null, undefined])('throws when the cat has no value (%s)', value => {
    expect(() => resolveCatFundingUtxo(makeCat({ value }), 'mainnet')).toThrow(
      'cat21-ord returned cat without a UTXO value'
    );
  });

  it('throws on a satpoint whose vout is not a number', () => {
    expect(() => resolveCatFundingUtxo(makeCat({ satpoint: `${TXID}:x:0` }), 'mainnet')).toThrow(
      'malformed satpoint'
    );
  });

  it('throws on a satpoint with an empty txid', () => {
    expect(() => resolveCatFundingUtxo(makeCat({ satpoint: ':0:0' }), 'mainnet')).toThrow(
      'malformed satpoint'
    );
  });
});
