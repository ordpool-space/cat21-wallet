import { useEffect } from 'react';

import { useAccountTotalBalance } from '@/queries/balance/account-balance.query';
import { useBtcAccountBalance } from '@/queries/balance/btc-balance.query';
import { useStxAccountBalance } from '@/queries/balance/stx-balance.query';
import { analytics } from '@/utils/analytics';
import { countBy, filter, identity, map, pipe } from 'remeda';

import { makeAccountIdentifer } from '@leather.io/crypto';
import { AccountId, Money, NonFungibleCryptoAsset } from '@leather.io/models';
import { convertAmountToBaseUnit, isDefined, scaleValue } from '@leather.io/utils';

function getScaledValueFromMoney(money: Money | undefined) {
  return money ? scaleValue(Number(convertAmountToBaseUnit(money))) : undefined;
}

export function useAccountScaledBalanceAnalytics({
  currentAccount,
}: {
  currentAccount: AccountId;
}) {
  const { fingerprint, accountIndex } = currentAccount;
  const accountId = makeAccountIdentifer(fingerprint, accountIndex);
  const btcBalance = useBtcAccountBalance(fingerprint, accountIndex);
  const stxBalance = useStxAccountBalance(fingerprint, accountIndex);

  // Always pull the data in usd here
  const totalBalance = useAccountTotalBalance(
    {
      fingerprint: currentAccount.fingerprint,
      accountIndex: currentAccount.accountIndex,
    },
    'USD'
  );
  const scaledStxAvailableBalance = getScaledValueFromMoney(
    stxBalance.value?.stx.availableUnlockedBalance
  );
  const scaledStxLockedBalance = getScaledValueFromMoney(stxBalance.value?.stx.lockedBalance);
  const scaledBtcAvailableBalance = getScaledValueFromMoney(btcBalance.value?.btc.availableBalance);
  const scaledUsdBalance = getScaledValueFromMoney(totalBalance.value);

  useEffect(() => {
    if (
      isDefined(scaledStxAvailableBalance) &&
      isDefined(scaledStxLockedBalance) &&
      isDefined(scaledUsdBalance) &&
      isDefined(scaledBtcAvailableBalance)
    ) {
      analytics.track('balance_updated', {
        platform: 'mobile',
        walletAccountId: accountId,
        stxAvailableBalance: scaledStxAvailableBalance,
        stxLockedBalance: scaledStxLockedBalance,
        usdBalance: scaledUsdBalance,
        btcBalance: scaledBtcAvailableBalance,
      });
    }
  }, [
    accountId,
    scaledBtcAvailableBalance,
    scaledStxAvailableBalance,
    scaledStxLockedBalance,
    scaledUsdBalance,
  ]);
}

export function useCollectiblesAnalytics({
  currentAccount,
  collectibles,
}: {
  currentAccount: AccountId;
  collectibles: NonFungibleCryptoAsset[];
}) {
  const { fingerprint, accountIndex } = currentAccount;
  const accountId = makeAccountIdentifer(fingerprint, accountIndex);

  useEffect(() => {
    if (!collectibles.length) return;

    // HACK -- Cat21: upstream Leather Remeda 2.21.2 + TS 5.9.3 inference
    // dead-end on `countBy(identity())` — verified pristine in
    // leather-io/mono@dev 2026-06-17. The added `(collectibles as any)`
    // and outer cast unblock the inference without changing behaviour.
    // Bonus: NonFungibleCryptoAsset's Cat21 branch lacks `.content`, so
    // we widen to `any` for the contentType pluck. HARD RULE #5 — file
    // is upstream; revert on next upstream sync if Remeda fixes the
    // inference and we drop the Cat21 union widening.
    const byContentType = pipe(
      collectibles as any[],
      map((collectible: any) => collectible.content?.contentType),
      filter(isDefined),
      countBy(identity())
    ) as Record<string, number>;

    analytics.track('collectibles_summary', {
      platform: 'mobile',
      walletAccountId: accountId,
      totalCollectibles: collectibles.length,
      byProtocol: {
        sip9: {
          total: collectibles.length,
          ...(Object.keys(byContentType).length ? { byContentType } : {}),
        },
      },
    });
  }, [accountId, collectibles]);
}
