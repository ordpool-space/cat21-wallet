import { useNavigate } from 'react-router';

import * as btc from '@scure/btc-signer';
import BigNumber from 'bignumber.js';
import * as yup from 'yup';

import { getSizeInfo, isTaprootPayer } from '@leather.io/bitcoin';
import { keyOriginToDerivationPath } from '@leather.io/crypto';
import type { BitcoinTx } from '@leather.io/models';
import { emptyUtxos } from '@leather.io/services';
import { createMoney, isError, sumMoney } from '@leather.io/utils';

import type { BitcoinInputSigningConfig } from '@shared/crypto/bitcoin/signer-config';
import { RouteUrls } from '@shared/route-urls';
import { analytics } from '@shared/utils/analytics';

import { queryClient } from '@app/common/persistence';
import { MAX_FEE_RATE_MULTIPLIER } from '@app/components/bitcoin-custom-fee/hooks/use-bitcoin-custom-fee';
import { useToast } from '@app/features/toasts/use-toast';
import { useCurrentBtcBalanceWithFallback } from '@app/query/bitcoin/balance/btc-balance.hooks';
import { useBitcoinFeeRates } from '@app/query/bitcoin/fees/bitcoin-fee-rates.hooks';
import { useBitcoinBroadcastTransaction } from '@app/query/bitcoin/transaction/use-bitcoin-broadcast-transaction';
import { useCurrentNativeSegwitUtxos } from '@app/query/bitcoin/utxos/utxos.hooks';
import { useBitcoinScureLibNetworkConfig } from '@app/store/accounts/blockchain/bitcoin/bitcoin-keychain';
import { useBitcoinPayerFromInput } from '@app/store/accounts/blockchain/bitcoin/bitcoin-payer';
import { useSignBitcoinTx } from '@app/store/accounts/blockchain/bitcoin/bitcoin.hooks';
import { useCurrentAccountNativeSegwitIndexZeroPayer } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';

export function useBtcIncreaseFee(btcTx: BitcoinTx) {
  const toast = useToast();
  const navigate = useNavigate();
  const networkMode = useBitcoinScureLibNetworkConfig();

  const indexZeroPayer = useCurrentAccountNativeSegwitIndexZeroPayer();
  const currentBitcoinAddress = indexZeroPayer.address;
  const publicKey = indexZeroPayer.publicKey;
  const zeroIndexDerivationPath = keyOriginToDerivationPath(indexZeroPayer.keyOrigin);
  const { utxos, refetchUtxos } = useCurrentNativeSegwitUtxos();
  const signTransaction = useSignBitcoinTx();
  const { broadcastTx, isBroadcasting } = useBitcoinBroadcastTransaction();
  const getPayerForOwnedUtxo = useBitcoinPayerFromInput();

  const recipients = btcTx.vout.map(output => ({
    amount: createMoney(output.value, 'BTC'),
    address: output.scriptpubkey_address,
  }));

  const sizeInfo = getSizeInfo({
    utxos: btcTx.vin.map(vin => ({
      txid: vin.txid,
      address: vin.prevout.scriptpubkey_address,
      value: vin.prevout.value,
    })),
    recipients,
    isSendMax: false,
  });

  const { btc: balance } = useCurrentBtcBalanceWithFallback();
  const rbfAvailableBalance = sumMoney([balance.availableBalance, balance.outboundBalance]);

  const { data: feeRates } = useBitcoinFeeRates();

  function generateUnsignedTx(payload: { feeRate: string; tx: BitcoinTx }) {
    /* HACK -- Cat21: preserve nLockTime through RBF per CLAUDE.md HARD RULE #1.
     * If the original tx is a CAT-21 mint (or any locktime-bearing tx) the
     * replacement MUST carry the same locktime value, otherwise the protocol
     * marker is lost and the cat is killed. Default Bitcoin RBF flows construct
     * a new Transaction with lockTime=0; we copy the original's locktime
     * explicitly. */
    const newTx = new btc.Transaction({ lockTime: payload.tx.locktime });
    const { vin, vout, fee: prevFee } = payload.tx;
    const p2wpkh = btc.p2wpkh(publicKey, networkMode);
    const rbfAvailableUtxos = [
      ...(utxos ?? emptyUtxos).available,
      ...(utxos ?? emptyUtxos).outbound,
    ];
    const utxoMap = new Map(rbfAvailableUtxos.map(utxo => [`${utxo.txid}:${utxo.vout}`, utxo]));
    const signingConfig: BitcoinInputSigningConfig[] = [];

    vin.forEach(input => {
      const ownedUtxo = utxoMap.get(`${input.txid}:${input.vout}`);
      const payer = ownedUtxo ? getPayerForOwnedUtxo(ownedUtxo) : null;

      const tapInternalKey = isTaprootPayer(payer)
        ? { tapInternalKey: payer.payment.tapInternalKey }
        : {};

      /* HACK -- Cat21: clamp the bumped sequence so it never reaches
       * 0xffffffff (which would mark the input final-for-locktime and ignore
       * the transaction-level nLockTime). For non-locktime txs this clamp
       * is a no-op; for locktime-bearing txs (CAT-21 mints) it keeps the
       * locktime honored across an arbitrary number of replacements. */
      const bumpedSequence = Math.min(input.sequence + 1, 0xfffffffe);

      newTx.addInput({
        txid: input.txid,
        index: input.vout,
        sequence: bumpedSequence,
        witnessUtxo: {
          // script = 0014 + pubKeyHash
          script: payer ? payer.payment.script : p2wpkh.script,
          amount: ownedUtxo ? BigInt(ownedUtxo.value) : BigInt(input.prevout.value),
        },
        ...tapInternalKey,
      });

      signingConfig.push({
        index: newTx.inputsLength - 1,
        derivationPath: payer
          ? keyOriginToDerivationPath(payer.keyOrigin)
          : zeroIndexDerivationPath,
      });
    });

    const newFee = Math.ceil(sizeInfo.txVBytes * Number(payload.feeRate));
    const feeDiff = newFee - prevFee;

    vout.forEach(output => {
      if (output.scriptpubkey_address === currentBitcoinAddress) {
        const outputDiff = output.value - feeDiff;

        if (outputDiff < 0) {
          analytics.track('bitcoin_rbf_fee_increase_error', {
            outputDiff,
          });
          throw new Error('Previous tx inputs cannot cover new fee');
        }

        newTx.addOutputAddress(currentBitcoinAddress, BigInt(outputDiff), networkMode);
        return;
      }
      newTx.addOutputAddress(output.scriptpubkey_address, BigInt(output.value), networkMode);
    });

    /* HACK -- Cat21: hard assert that the replacement carries the original
     * locktime through. Per CLAUDE.md HARD RULE #1, losing nLockTime on a
     * CAT-21 mint is the worst class of bug this wallet can ship. If a
     * future refactor breaks the constructor argument above this fires
     * before we sign. */
    if (newTx.lockTime !== payload.tx.locktime) {
      throw new Error(
        `Replacement tx locktime ${newTx.lockTime} does not match original ` +
          `${payload.tx.locktime}. Refusing to sign — would silently kill ` +
          'any cat carried by the original.'
      );
    }

    return { tx: newTx, signingConfig };
  }

  async function initiateTransaction(
    unsignedTx: btc.Transaction,
    signingConfig: BitcoinInputSigningConfig[]
  ) {
    const tx = await signTransaction(unsignedTx.toPSBT(), signingConfig);
    tx.finalize();
    await broadcastTx({
      tx: tx.hex,
      async onSuccess(txid) {
        toast.success('Fee increased successfully');
        void navigate(RouteUrls.Activity);
        analytics.track('increase_fee_transaction', {
          symbol: 'btc',
          txid,
        });
        await refetchUtxos();
        void queryClient.invalidateQueries({ queryKey: ['btc-txs-by-address'] });
      },
      onError,
      delayTime: 5000,
    });
  }

  async function onSubmit(values: { feeRate: string }) {
    try {
      const { tx, signingConfig } = generateUnsignedTx({ feeRate: values.feeRate, tx: btcTx });
      await initiateTransaction(tx, signingConfig);
    } catch (e) {
      onError(e);
    }
  }

  function onError(error: unknown) {
    const message = isError(error) ? error.message : 'Unknown error';
    toast.error(message);
    void navigate(RouteUrls.Home);
  }

  const validationSchema = yup.object({
    feeRate: yup
      .number()
      .integer('Fee must be a whole number')
      .required('Fee is required')
      .test({
        message: 'Fee rate cannot be less or equal to previous',
        test(value) {
          const bnValue = new BigNumber(value);
          const prevFee = new BigNumber(btcTx.fee);

          return prevFee.isLessThan(bnValue.multipliedBy(sizeInfo.txVBytes));
        },
      })
      .test({
        message: 'Fee is too high',
        test(value) {
          const bnValue = new BigNumber(value);

          const highestFeeRate =
            (feeRates?.high.rate ?? 10) * sizeInfo.txVBytes * MAX_FEE_RATE_MULTIPLIER;

          // check if fee is higher than 50 times the highest fee
          if (feeRates && bnValue.isGreaterThan(highestFeeRate)) {
            return false;
          }

          // check if fee is higher than the available balance
          return bnValue.isLessThanOrEqualTo(rbfAvailableBalance.amount);
        },
      }),
  });

  return {
    generateTx: generateUnsignedTx,
    initiateTransaction,
    isBroadcasting,
    sizeInfo,
    onSubmit,
    validationSchema,
    recipients,
  };
}
