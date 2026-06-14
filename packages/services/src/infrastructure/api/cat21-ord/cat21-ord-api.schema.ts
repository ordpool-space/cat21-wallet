import { z } from 'zod';

/* Cat21-ord (a fork of `ord` running on happysrv with `--index-cat21 --index-sats
 * --index-addresses`) is the sole source of truth for cats per ADR-9. These
 * schemas mirror the JSON shapes documented in CAT21-WALLET-FORK-PLAN.md ADR-12.
 *
 * Every schema uses `.passthrough()` so future ord field additions never break
 * the parse — only the fields we name explicitly are guaranteed shape-checked.
 *
 * Wire-format JSON field names that ord controls (e.g. `inscriptions: [...]`
 * on the address + output endpoints) are kept verbatim. The TypeScript types
 * surfaced from these schemas use cat-flavoured names. */

/**
 * `GET /inscription/<id>` — per-cat metadata. The URL component `inscription`
 * is ord's path name and we do not rename ord's URL space.
 */
export const ordCat21Schema = z
  .object({
    id: z.string(),
    number: z.number(),
    sat: z.number(),
    satpoint: z.string(),
    address: z.string().optional(),
    content_type: z.string(),
    content_length: z.number(),
    genesis_height: z.number(),
    genesis_fee: z.number(),
    timestamp: z.number(),
  })
  .passthrough();

export type OrdCat21 = z.infer<typeof ordCat21Schema>;

/**
 * `GET /address/<addr>` — list of cat IDs at a bitcoin address. The wire-level
 * field name `inscriptions` is ord's JSON output; the parsed type uses
 * `inscriptions` to keep the parser straightforward and the schema's
 * `.passthrough()` honest.
 */
export const ordAddressCat21sSchema = z
  .object({
    inscriptions: z.array(z.string()),
  })
  .passthrough();

export type OrdAddressCat21s = z.infer<typeof ordAddressCat21sSchema>;

/**
 * `GET /output/<outpoint>` — UTXO classification. Cat-bearing outputs list the
 * cat IDs they carry; non-cat outputs list an empty array. Wire-level field
 * name `inscriptions` is ord's choice.
 */
export const ordOutputSchema = z
  .object({
    value: z.number(),
    inscriptions: z.array(z.string()),
    sat_ranges: z.array(z.tuple([z.number(), z.number()])).optional(),
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
    height: z.number(),
    chain: z.literal('mainnet'),
    cat_index: z.literal(true),
    address_index: z.literal(true),
    sat_index: z.literal(true),
    cats: z.number(),
    blessed_cats: z.number(),
    cursed_cats: z.number(),
    uptime: z.object({ secs: z.number(), nanos: z.number() }).optional(),
    started: z.string().optional(),
  })
  .passthrough();

export type OrdStatus = z.infer<typeof ordStatusSchema>;
