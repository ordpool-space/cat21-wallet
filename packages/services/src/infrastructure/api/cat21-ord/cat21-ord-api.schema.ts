import { z } from 'zod';

/* Cat21-ord (a fork of `ord` running on happysrv with `--index-cat21 --index-sats
 * --index-addresses`) is the sole source of truth for cats per ADR-9. These
 * schemas mirror the JSON shapes documented in CAT21-WALLET-FORK-PLAN.md ADR-12.
 *
 * Every schema uses `.passthrough()` so future ord field additions never break
 * the parse — only the fields we name explicitly are guaranteed shape-checked.
 *
 * Field names are taken from what cat21-ord actually puts on the wire, which is
 * not upstream ord's vocabulary: its `cat21_text_layer` middleware rewrites
 * response bodies under `--index-cat21`, and the rewrite covers JSON, so
 * `inscriptions` arrives as `cats`. Schemas written from upstream ord's docs
 * parse nothing.
 *
 * Every schema is checked against a captured response in `__fixtures__/`, so a
 * rename on either side fails a test instead of silently emptying a list. */

/**
 * `GET /inscription/<id>` — per-cat metadata. The URL component `inscription`
 * is ord's path name and we do not rename ord's URL space.
 *
 * Field names follow ord's `api::Inscription` struct, NOT Best-in-Slot's.
 * The two differ (`height`/`fee` vs BIS's `genesis_height`/`genesis_fee`), and
 * this client speaks to ord. `__fixtures__/cat-0.json` is a real response and
 * the schema spec parses it, so the two cannot drift apart silently.
 *
 * `content_type` is null for every cat: a CAT-21 mint carries no inscription
 * envelope and no content bytes, the image being generated from
 * SHA256(txid + blockHash). It stays modelled, and nullable, because the
 * mapper reads it.
 */
export const ordCat21Schema = z
  .object({
    id: z.string(),
    number: z.number(),
    satpoint: z.string(),
    address: z.string().nullable().optional(),
    content_type: z.string().nullable(),
    height: z.number(),
    fee: z.number(),
    /** Needed with txid + fee to render the cat locally; see cat21-helpers. */
    weight: z.number(),
    /** Sats held by the cat's current output. */
    value: z.number().nullable().optional(),
    block_hash: z.string().nullable(),
    timestamp: z.number(),
  })
  .passthrough();

export type OrdCat21 = z.infer<typeof ordCat21Schema>;

/**
 * `GET /address/<addr>` — cat IDs held at a bitcoin address.
 *
 * The wire field is `cats`, NOT `inscriptions`. cat21-ord's `cat21_text_layer`
 * middleware rewrites response bodies under `--index-cat21`, and it applies to
 * JSON as well as HTML, so ord's own `inscriptions` key never reaches us.
 * `__fixtures__/address-with-cats.json` is a real response.
 */
export const ordAddressCat21sSchema = z
  .object({
    cats: z.array(z.string()),
  })
  .passthrough();

export type OrdAddressCat21s = z.infer<typeof ordAddressCat21sSchema>;

/**
 * `GET /output/<outpoint>` — UTXO classification. Cat-bearing outputs list the
 * cat IDs they carry; cat-free outputs list an empty array.
 *
 * `cats` for the same middleware reason as above. Only the two fields the
 * send-flow reads are modelled; `sat_ranges` and the rest arrive untouched via
 * `.passthrough()`. An unmodelled field cannot fail a parse, which is the
 * cheapest fix for `Option<Vec>` fields that serialise to null.
 */
export const ordOutputSchema = z
  .object({
    value: z.number(),
    cats: z.array(z.string()),
  })
  .passthrough();

export type OrdOutput = z.infer<typeof ordOutputSchema>;

/**
 * `GET /status` — operational state of the indexer. Used as a startup probe and
 * fail-fast check: if `cat_index`, `address_index`, or `sat_index` is false,
 * cat21-ord cannot answer the queries the wallet needs to make.
 *
 * Per ADR-7, `chain` must be `'mainnet'`. The schema rejects anything else.
 */
export const ordStatusSchema = z
  .object({
    // Read by the read-only probe.
    height: z.number(),
    cats: z.number(),
    // Not read anywhere. These are assertions: they reject a misconfigured or
    // wrong-network ord before it can serve plausible-looking wrong answers.
    chain: z.literal('mainnet'),
    cat_index: z.literal(true),
    address_index: z.literal(true),
    sat_index: z.literal(true),
  })
  .passthrough();

export type OrdStatus = z.infer<typeof ordStatusSchema>;
