import { Box } from 'leather-styles/jsx';

import { Callout } from '@leather.io/ui';

import { analytics } from '@shared/utils/analytics';

import { copyToClipboard } from '@app/common/utils/copy-to-clipboard';
import { useToast } from '@app/features/toasts/use-toast';
import { useBackgroundLocationRedirect } from '@app/routes/hooks/use-background-location-redirect';
import { useCurrentAccountId } from '@app/store/accounts/account';
import { useZeroIndexTaprootAddress } from '@app/store/accounts/blockchain/bitcoin/bitcoin.hooks';
import { useNativeSegwitAccountIndexAddressIndexZero } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';

import { ReceiveTokensLayout } from './components/receive-tokens.layout';

/**
 * Cats-only disclosure at the one point where the loss is preventable at zero
 * cost: before an asset is ever deposited. The wallet only indexes cats
 * (cat21-ord), so it keeps cats safe but is blind to inscriptions, runes, rare
 * sats and stamps: a coin holding one looks like ordinary spendable Bitcoin and
 * can be spent as fee or change. INFO register: calm, reassurance before risk,
 * names the action. It is NOT a hazard warning (no triangle, no amber, no
 * acknowledgement) — the per-coin taproot dialog is the sharp one; this
 * standing note stays quiet so the two read as different things.
 */
const catsOnlyReceiveNote = (
  <Box px="space.05" pt="space.05">
    <Callout variant="info" title="This wallet only indexes cats">
      So it can't see inscriptions, runes, rare sats or stamps. Send one of those to this address
      and it could be spent by accident, so keep them in a wallet built for them.
    </Callout>
  </Box>
);

interface ReceiveBtcModalProps {
  type?: 'btc' | 'btc-taproot';
}

export function ReceiveBtcModal({ type = 'btc' }: ReceiveBtcModalProps) {
  useBackgroundLocationRedirect();

  const toast = useToast();

  const currentAccount = useCurrentAccountId();
  const nativeSegwitAddress = useNativeSegwitAccountIndexAddressIndexZero(currentAccount);
  const taprootAddress = useZeroIndexTaprootAddress(currentAccount);

  const address = type === 'btc-taproot' ? taprootAddress : nativeSegwitAddress;
  // HACK -- Cat21: the taproot address is where cats (and ordinals) are
  // received, so it's headed "Receive a CAT-21 cat" rather than the address
  // type. "Taproot" reads as jargon: an expert already knows the bc1p prefix,
  // and everyone else is just confused by it. The layout prepends "Receive".
  const title = type === 'btc-taproot' ? 'a CAT-21 cat' : 'BTC';

  return (
    <ReceiveTokensLayout
      address={address}
      warning={catsOnlyReceiveNote}
      onCopyAddressToClipboard={async () => {
        analytics.track('copy_btc_address_to_clipboard', { type });
        await copyToClipboard(address);
        toast.success('Copied to clipboard!');
      }}
      title={title}
    />
  );
}
