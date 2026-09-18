import { describe, expect, it } from 'vitest';

import addressWithCats from './__fixtures__/address-with-cats.json';
import cat0 from './__fixtures__/cat-0.json';
import outputWithCat from './__fixtures__/output-with-cat.json';
import outputWithoutCat from './__fixtures__/output-without-cat.json';
import status from './__fixtures__/status.json';
import {
  ordAddressCat21sSchema,
  ordCat21Schema,
  ordOutputSchema,
  ordStatusSchema,
} from './cat21-ord-api.schema';

/**
 * The fixture is a verbatim `GET /cat/0` response from ord.cat21.space, not a
 * hand-written object. That distinction is the whole point of this file: the
 * schema previously required `genesis_height`/`genesis_fee` (Best-in-Slot's
 * field names, inherited when the client was repointed at ord) and non-null
 * `content_type`/`content_length`. Every cat failed to parse, and because the
 * caller swallows rejections the wallet simply showed no cats. A hand-written
 * fixture would have been written to match the schema and proved nothing.
 *
 * Refresh with:
 *   curl -s -H 'Accept: application/json' https://ord.cat21.space/cat/0 \
 *     | python3 -m json.tool > __fixtures__/cat-0.json
 */
describe('ordCat21Schema', () => {
  it('parses a real ord response', () => {
    const parsed = ordCat21Schema.parse(cat0);

    expect(parsed.id).toBe('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892i0');
    expect(parsed.number).toBe(0);
    expect(parsed.height).toBe(824205);
    expect(parsed.fee).toBe(40834);
    expect(parsed.weight).toBe(705);
    expect(parsed.block_hash).toBe(
      '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7'
    );
    expect(parsed.satpoint).toBe(
      '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892:0:0'
    );
  });

  it('accepts the null content fields every cat carries', () => {
    const parsed = ordCat21Schema.parse(cat0);

    expect(parsed.content_type).toBeNull();
    expect(parsed.content_length).toBeNull();
  });

  it('keeps txid, block hash, fee and weight, the four fields a local render needs', () => {
    const parsed = ordCat21Schema.parse(cat0);
    const txid = parsed.id.replace(/i\d+$/, '');

    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.block_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof parsed.fee).toBe('number');
    expect(typeof parsed.weight).toBe('number');
  });

  it('rejects a response missing a field the renderer depends on', () => {
    const { block_hash: _omitted, ...withoutBlockHash } = cat0;

    expect(() => ordCat21Schema.parse(withoutBlockHash)).toThrow();
  });

  it('keeps unmodelled ord fields via passthrough', () => {
    const parsed = ordCat21Schema.parse(cat0);

    expect(parsed).toMatchObject({ minted_by: cat0.minted_by, sat: cat0.sat });
  });
});

/**
 * cat21-ord rewrites response bodies under `--index-cat21`, and the rewrite
 * applies to JSON as well as HTML: ord's `inscriptions` key arrives as `cats`.
 * Schemas written against upstream ord's field names parse nothing, and both
 * failures were silent — `/address` emptied the cat list, `/output` made the
 * fail-closed UTXO probe mark every UTXO cat-bearing, which blocks spending.
 */
describe('ordAddressCat21sSchema', () => {
  it('parses a real /address response', () => {
    const parsed = ordAddressCat21sSchema.parse(addressWithCats);

    expect(Array.isArray(parsed.cats)).toBe(true);
    expect(parsed.cats.length).toBeGreaterThan(0);
    expect(parsed.cats[0]).toMatch(/^[0-9a-f]{64}i\d+$/);
  });

  it('rejects a body carrying ord upstream name instead of the rewritten one', () => {
    const { cats, ...rest } = addressWithCats;

    expect(() => ordAddressCat21sSchema.parse({ ...rest, inscriptions: cats })).toThrow();
  });
});

describe('ordOutputSchema', () => {
  it('parses a real cat-bearing output', () => {
    const parsed = ordOutputSchema.parse(outputWithCat);

    expect(parsed.cats.length).toBeGreaterThan(0);
    expect(parsed.value).toBe(outputWithCat.value);
  });

  it('parses a real cat-free output as an empty list, not a failure', () => {
    const parsed = ordOutputSchema.parse(outputWithoutCat);

    expect(parsed.cats).toEqual([]);
  });

  it('survives a null sat_ranges, which the server sends as Option<Vec>', () => {
    // Not modelled, so it cannot fail the parse. Pinned because modelling it
    // as a required array is exactly what broke this endpoint before.
    expect(() => ordOutputSchema.parse({ ...outputWithoutCat, sat_ranges: null })).not.toThrow();
  });
});

describe('ordStatusSchema', () => {
  it('parses a real /status response', () => {
    const parsed = ordStatusSchema.parse(status);

    expect(parsed.height).toBeGreaterThan(0);
    expect(parsed.cats).toBeGreaterThan(0);
  });

  it('rejects an ord that is not indexing cats', () => {
    // The literals are assertions, not data: a misconfigured ord would answer
    // every query with plausible but wrong numbers.
    expect(() => ordStatusSchema.parse({ ...status, cat_index: false })).toThrow();
    expect(() => ordStatusSchema.parse({ ...status, sat_index: false })).toThrow();
    expect(() => ordStatusSchema.parse({ ...status, chain: 'testnet' })).toThrow();
  });
});
