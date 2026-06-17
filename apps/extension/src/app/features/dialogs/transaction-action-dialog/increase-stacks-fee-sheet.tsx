import { RouteUrls } from '@shared/route-urls';

import { StacksTransactionActionType } from '@app/common/transactions/stacks/transaction.utils';

import {
  StacksTransactionActionSheet,
  StacksTransactionActionSheetLoader,
} from './stacks-transaction-action-sheet';

// HACK -- Cat21: removed `export` (upstream Stacks/Ledger/Network/Swap surface unrouted by ADR-1 BTC-L1-only scope). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
function IncreaseStacksTransactionFeeSheet() {
  return (
    <StacksTransactionActionSheetLoader>
      {({ txid, rawTx, tx }) => (
        <StacksTransactionActionSheet
          tx={tx}
          txid={txid}
          title="Increase fee"
          description="If your transaction is pending for a long time, its fee might not be high enough to be included in a block. Update the fee for a higher value and try again."
          routeUrl={RouteUrls.IncreaseStacksFee}
          actionType={StacksTransactionActionType.IncreaseFee}
          rawTx={rawTx}
        />
      )}
    </StacksTransactionActionSheetLoader>
  );
}
