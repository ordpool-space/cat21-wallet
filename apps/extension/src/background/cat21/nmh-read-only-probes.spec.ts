import { describe, expect, it } from 'vitest';

import { handleReadOnlyProbe, isReadOnlyProbeRequest } from './nmh-read-only-probes';

describe('isReadOnlyProbeRequest', () => {
  it.each([
    [{ type: 'list_cats', id: 'a' }, true],
    [{ type: 'wallet_status', id: 'b' }, true],
    [{ type: 'cat21_ord_status', id: 'c' }, true],
    [{ type: 'list_cats' }, false], // missing id
    [{ type: 'cat21_mint', id: 'd' }, false], // mutating type
    [{ id: 'e' }, false], // missing type
    [null, false],
    ['not-an-object', false],
  ])('classifies %j as %s', (input, expected) => {
    expect(isReadOnlyProbeRequest(input)).toBe(expected);
  });
});

describe('handleReadOnlyProbe', () => {
  it('list_cats happy path returns the cats array as the payload', async () => {
    const reply = await handleReadOnlyProbe(
      { type: 'list_cats', id: 'r1' },
      {
        listCatsAtActiveAccount: () => Promise.resolve(['abc123…i0', 'def456…i0']),
        readWalletStatus: () => {
          throw new Error('not called');
        },
        readCat21OrdStatus: () => Promise.reject(new Error('not called')),
      }
    );
    expect(reply).toEqual({
      type: 'list_cats:result',
      payload: ['abc123…i0', 'def456…i0'],
    });
  });

  it('list_cats encodes a thrown error inline so the agent learns the probe failed (not silent empty)', async () => {
    const reply = await handleReadOnlyProbe(
      { type: 'list_cats', id: 'r1' },
      {
        listCatsAtActiveAccount: () => Promise.reject(new Error('cat21-ord offline')),
        readWalletStatus: () => {
          throw new Error('not called');
        },
        readCat21OrdStatus: () => Promise.reject(new Error('not called')),
      }
    );
    expect(reply).toEqual({
      type: 'list_cats:result',
      payload: { error: 'cat21-ord offline' },
    });
  });

  it('wallet_status returns the snapshot the deps produce verbatim', async () => {
    const reply = await handleReadOnlyProbe(
      { type: 'wallet_status', id: 'r1' },
      {
        listCatsAtActiveAccount: () => Promise.reject(new Error('not called')),
        readWalletStatus: () => ({
          network: 'mainnet',
          accountId: 'fp:0',
          agentMode: { enabled: true },
        }),
        readCat21OrdStatus: () => Promise.reject(new Error('not called')),
      }
    );
    expect(reply).toEqual({
      type: 'wallet_status:result',
      payload: { network: 'mainnet', accountId: 'fp:0', agentMode: { enabled: true } },
    });
  });

  it('cat21_ord_status reachable: false includes the error message so reachability and reason are paired', async () => {
    const reply = await handleReadOnlyProbe(
      { type: 'cat21_ord_status', id: 'r1' },
      {
        listCatsAtActiveAccount: () => Promise.reject(new Error('not called')),
        readWalletStatus: () => {
          throw new Error('not called');
        },
        readCat21OrdStatus: () => Promise.reject(new Error('ECONNREFUSED')),
      }
    );
    expect(reply).toEqual({
      type: 'cat21_ord_status:result',
      payload: { reachable: false, error: 'ECONNREFUSED' },
    });
  });

  it('cat21_ord_status happy path passes the snapshot through', async () => {
    const reply = await handleReadOnlyProbe(
      { type: 'cat21_ord_status', id: 'r1' },
      {
        listCatsAtActiveAccount: () => Promise.reject(new Error('not called')),
        readWalletStatus: () => {
          throw new Error('not called');
        },
        readCat21OrdStatus: () => Promise.resolve({ reachable: true, height: 921234, cats: 75432 }),
      }
    );
    expect(reply).toEqual({
      type: 'cat21_ord_status:result',
      payload: { reachable: true, height: 921234, cats: 75432 },
    });
  });
});
