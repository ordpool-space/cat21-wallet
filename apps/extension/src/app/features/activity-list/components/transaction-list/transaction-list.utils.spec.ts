import { AddressTransactionWithTransfers, Transaction } from '@stacks/stacks-blockchain-api-types';
import dayjs from 'dayjs';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import type { StacksBlock } from '@app/query/sbtc/get-stacks-block.query';
import type { SbtcDeposit } from '@app/query/sbtc/sbtc-deposits.query';

import type {
  TransactionListBitcoinTx,
  TransactionListSbtcDeposit,
  TransactionListStacksTx,
} from './transaction-list.model';
import { createTxDateFormatList } from './transaction-list.utils';

// Pin "now" to a safe-from-tz-boundaries instant (mid-morning UTC, which
// is the same calendar day in every IANA-named tz). Without this, the
// "Today"/"Yesterday" assertions flake whenever the host clock crosses
// UTC midnight while the system tz offset shifts the local calendar day —
// the test computes `today = new Date().toISOString()` (UTC) while the
// production code under test formats the same instant via local-tz
// dayjs.tz(), and the two day strings disagree.
const FROZEN_NOW = new Date('2026-06-15T12:00:00Z');

function createFakeTx(tx: Partial<Transaction>) {
  return {
    blockchain: 'stacks',
    transaction: {
      tx: {
        tx_id: '0x56c6381874c8f6b152c8815d950764b8759b97660fdc50091f3c1368d7f1c514',
        tx_status: 'success',
        ...tx,
      },
    } as Partial<AddressTransactionWithTransfers>,
  } as TransactionListStacksTx;
}

function createFakeDeposit(block: Partial<StacksBlock>) {
  return {
    blockchain: 'bitcoin-stacks',
    deposit: { block } as Partial<SbtcDeposit>,
  } as TransactionListSbtcDeposit;
}

describe(createTxDateFormatList.name, () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test('grouping by date', () => {
    const mockBitcoinTx = {
      blockchain: 'bitcoin',
      transaction: { status: { confirmed: true, block_time: 666020884 } },
    } as TransactionListBitcoinTx;
    const mockStacksTx = createFakeTx({
      burn_block_time_iso: '1991-02-08T13:48:04.699Z',
    });
    expect(createTxDateFormatList([mockBitcoinTx], [mockStacksTx], [])).toEqual([
      {
        date: '1991-02-08',
        displayDate: 'Feb 8th, 1991',
        txs: [mockStacksTx, mockBitcoinTx],
      },
    ]);
  });

  test('relative dates todays date', () => {
    const today = new Date().toISOString();
    const mockBitcoinTx = {
      blockchain: 'bitcoin',
      transaction: { status: { confirmed: true, block_time: dayjs().unix() } },
    } as TransactionListBitcoinTx;
    const mockStacksTx = createFakeTx({ burn_block_time_iso: today });
    const mockSbtcDeposit = createFakeDeposit({ burn_block_time_iso: today });
    const result = createTxDateFormatList([mockBitcoinTx], [mockStacksTx], [mockSbtcDeposit]);
    expect(result[0].date).toEqual(today.split('T')[0]);
    expect(result[0].displayDate).toEqual('Today');
  });

  test('relative dates yesterdays date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const mockBitcoinTx = {
      blockchain: 'bitcoin',
      transaction: { status: { confirmed: true, block_time: dayjs().subtract(1, 'day').unix() } },
    } as TransactionListBitcoinTx;
    const mockStacksTx = createFakeTx({ burn_block_time_iso: yesterday.toISOString() });
    const mockSbtcDeposit = createFakeDeposit({ burn_block_time_iso: yesterday.toISOString() });
    const result = createTxDateFormatList([mockBitcoinTx], [mockStacksTx], [mockSbtcDeposit]);
    expect(result[0].date).toEqual(yesterday.toISOString().split('T')[0]);
    expect(result[0].displayDate).toEqual('Yesterday');
  });

  test('dates from this year omit year', () => {
    const date = new Date();
    date.setFullYear(date.getFullYear());
    date.setMonth(6);
    const mockStacksTx = createFakeTx({ burn_block_time_iso: date.toISOString() });
    const mockSbtcDeposit = createFakeDeposit({ burn_block_time_iso: date.toISOString() });
    const result = createTxDateFormatList([], [mockStacksTx], [mockSbtcDeposit]);
    expect(result[0].date).toEqual(date.toISOString().split('T')[0]);
    expect(result[0].displayDate).not.toContain(new Date().getFullYear().toString());
  });
});
