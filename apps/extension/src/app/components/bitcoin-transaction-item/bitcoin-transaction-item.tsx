import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { HStack } from 'leather-styles/jsx';

import type { BitcoinTx } from '@leather.io/models';
import { BtcAvatarIcon, BulletSeparator, Caption } from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';
import { analytics } from '@shared/utils/analytics';

import { useBitcoinExplorerLink } from '@app/common/hooks/use-bitcoin-explorer-link';
import {
  getBitcoinTxCaption,
  getBitcoinTxValue,
  isBitcoinTxInbound,
} from '@app/common/transactions/bitcoin/utils';
import { IncreaseFeeButton } from '@app/components/stacks-transaction-item/increase-fee-button';
import { TransactionTitle } from '@app/components/transaction/transaction-title';
import { useCurrentAccountNativeSegwitIndexZeroPayer } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';
import { useCurrentAccountTaprootIndexZeroPayer } from '@app/store/accounts/blockchain/bitcoin/taproot-account.hooks';
import { useIsPrivateMode } from '@app/store/settings/settings.selectors';

import { TransactionItemLayout } from '../transaction-item/transaction-item.layout';
import { BitcoinTransactionIcon } from './bitcoin-transaction-icon';
import { BitcoinTransactionStatus } from './bitcoin-transaction-status';

interface BitcoinTransactionItemProps {
  transaction: BitcoinTx;
}
export function BitcoinTransactionItem({ transaction }: BitcoinTransactionItemProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isPrivate = useIsPrivateMode();

  const nativeSegwitSigner = useCurrentAccountNativeSegwitIndexZeroPayer();
  const taprootSigner = useCurrentAccountTaprootIndexZeroPayer();
  const { handleOpenBitcoinTxLink: handleOpenTxLink } = useBitcoinExplorerLink();
  const caption = useMemo(() => getBitcoinTxCaption(transaction), [transaction]);

  const isCorrespondingAddressFn = useCallback(
    (address: string) => {
      return address === nativeSegwitSigner.address || address === taprootSigner.address;
    },
    [nativeSegwitSigner.address, taprootSigner.address]
  );
  const value = useMemo(
    () => getBitcoinTxValue(isCorrespondingAddressFn, transaction),
    [isCorrespondingAddressFn, transaction]
  );

  if (!transaction) return null;

  function onIncreaseFee() {
    void navigate(RouteUrls.IncreaseBtcFee, { state: { btcTx: transaction } });
  }

  function openTxLink() {
    analytics.track('view_bitcoin_transaction');
    handleOpenTxLink({ txid: transaction?.txid || '' });
  }

  const isTxInbound = isBitcoinTxInbound(isCorrespondingAddressFn, transaction);

  /* HACK -- Cat21: a tx with nLockTime === 21 is a CAT-21 mint. The mint
   * builder sets every input sequence to 0xfffffffe so the original tx does
   * not signal BIP-125 RBF; the mempool refuses any replacement. Showing
   * "Increase fee" on such a tx leads to a broadcast error at best and a
   * dead cat at worst (if a future Bitcoin policy change permits some other
   * acceleration path that strips locktime). Hide the button outright. */
  const isCat21MintTx = transaction.locktime === 21;
  const isFeeIncreaseEnabled =
    !isTxInbound && !transaction.status.confirmed && !isCat21MintTx;

  const txCaption = (
    <HStack gap="space.02">
      <BulletSeparator>
        <Caption>{caption}</Caption>
      </BulletSeparator>
    </HStack>
  );

  const title = 'Bitcoin';
  const increaseFeeButton = (
    <IncreaseFeeButton
      isEnabled={isFeeIncreaseEnabled}
      isSelected={pathname === RouteUrls.IncreaseBtcFee}
      onIncreaseFee={onIncreaseFee}
    />
  );

  return (
    <TransactionItemLayout
      openTxLink={openTxLink}
      rightElement={isFeeIncreaseEnabled ? increaseFeeButton : undefined}
      txCaption={txCaption}
      txIcon={
        <BitcoinTransactionIcon
          icon={<BtcAvatarIcon />}
          isTxConfirmed={transaction.status.confirmed}
          isTxInbound={isTxInbound}
        />
      }
      txStatus={<BitcoinTransactionStatus transaction={transaction} />}
      txTitle={<TransactionTitle title={title} />}
      txValue={value}
      isPrivate={isPrivate}
    />
  );
}
