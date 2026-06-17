import { RouteUrls } from '@shared/route-urls';

import { StacksTransactionActionType } from '@app/common/transactions/stacks/transaction.utils';

import {
  StacksTransactionActionSheet,
  StacksTransactionActionSheetLoader,
} from './stacks-transaction-action-sheet';

// HACK -- Cat21: removed `export` (upstream Stacks/Ledger/Network/Swap surface unrouted by ADR-1 BTC-L1-only scope). HARD RULE #5 — restore on consumer wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
function CancelStacksTransactionSheet() {
  return (
    <StacksTransactionActionSheetLoader>
      {({ txid, rawTx, tx }) => (
        <StacksTransactionActionSheet
          txid={txid}
          rawTx={rawTx}
          tx={tx}
          title="Cancel transaction"
          description="Cancelling a transaction isn't guaranteed to work. To cancel the transaction we replace it with a minimal STX transfer."
          routeUrl={RouteUrls.CancelStacksTransaction}
          actionType={StacksTransactionActionType.Cancel}
        />
      )}
    </StacksTransactionActionSheetLoader>
  );
}
