/**
 * Spec stubs — shapes-only commit. axios mocked at the module
 * boundary (the client is the SUT; HTTP is its collaborator).
 */
import { describe, it } from 'vitest';

describe('publishCat21Listing', () => {
  it.todo('POSTs to <base>/api/v1/listings with the request as JSON body and all three X-Cat21-Session-* headers (pinned values)');
  it.todo('201 → { ok: true }');
  it.todo('401 → { ok: false, code: session-rejected }');
  it.todo('422 with backend code not-current-owner → mapped verbatim');
  it.todo('422 with backend code cats-bundle-drift → mapped verbatim');
  it.todo('422 with an unknown backend code → { code: rejected, detail: <the code> }');
  it.todo('429 → { code: rate-limited }');
  it.todo('network failure (no response) → { code: network-error }');
});

describe('unlistCat21', () => {
  it.todo('DELETEs <base>/api/v1/listings/cat/<catNumber> with the session headers');
  it.todo('204 → { ok: true }');
  it.todo('401 → { ok: false, code: session-rejected }');
});

describe('fetchCat21ListingForCat', () => {
  it.todo('GET without auth headers; 200 → { ok: true, value: { askSats, payTo } }');
  it.todo('404 → { ok: true, value: null } (no listing is not an error)');
});

describe('buildCreateListingRequest', () => {
  it.todo('assembles the full DTO with network pinned to mainnet');
  it.todo('dedupes + ascending-sorts bundleCatNumbers');
  it.todo('throws when catNumber is not in the bundle');
  it.todo('throws on non-positive askSats');
  it.todo('accepts catNumber 0 (Genesis Cat is listable — workspace HARD RULE)');
});

describe('satpointToOutpoint', () => {
  it.todo('parses <txid>:<vout>:<offset> into { txid, vout }');
  it.todo('throws on malformed satpoint');
});
