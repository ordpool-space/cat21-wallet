import { createCallable } from 'react-call';

import { SendCryptoAssetSelectors } from '@tests/selectors/send.selectors';
import { css } from 'leather-styles/css';
import { Stack, styled } from 'leather-styles/jsx';

import { Button, Sheet } from '@leather.io/ui';

import { analytics } from '@shared/utils/analytics';

import { useOnMount } from '@app/common/hooks/use-on-mount';
import { ButtonRow } from '@app/components/layout';

interface TaprootUtxoWarningResponse {
  userAcceptedRisk: boolean;
}

export const TaprootUtxoWarningDialog = createCallable<void, TaprootUtxoWarningResponse>(
  ({ call }) => {
    useOnMount(() => analytics.track('taproot_utxo_warning_dialog_displayed'));
    return (
      <Sheet
        isShowing={!call.ended}
        onClose={() => call.end({ userAcceptedRisk: false })}
        footer={
          <ButtonRow flexDirection="row">
            <Button
              onClick={() => call.end({ userAcceptedRisk: false })}
              variant="outline"
              flexGrow={1}
            >
              Cancel
            </Button>
            <Button onClick={() => call.end({ userAcceptedRisk: true })} type="submit" flexGrow={1}>
              I understand, continue
            </Button>
          </ButtonRow>
        }
      >
        <Stack
          px="space.05"
          gap="space.05"
          py="space.06"
          data-testid={SendCryptoAssetSelectors.TaprootUtxoWarningDialog}
        >
          {/* HACK -- Cat21: rewritten from Leather's generic "these UTXOs may
              contain inscriptions/runes/BRC-20" copy, which contradicted our
              "only cats" posture by implying we check for three things we can't
              see. The wallet indexes cats and nothing else (cat21-ord), so the
              honest statement is that it is BLIND to other assets, not that it
              checks for them. Leather's support mailto removed (another
              company's inbox); points to our own public repo issues instead. */}
          <styled.h3 textStyle="heading.05">This wallet only indexes cats</styled.h3>

          <styled.p textStyle="body.02" color="ink.text-subdued">
            You're spending taproot coins. This wallet indexes cats and nothing else, so it can't
            see inscriptions, runes, rare sats or stamps: if one of these coins holds one, this
            transaction could spend it by accident.
          </styled.p>
          <styled.p textStyle="body.02" color="ink.text-subdued">
            If you're not sure what's on these coins, cancel and move them to a wallet built for
            those assets first.
          </styled.p>
          <styled.p textStyle="body.02" color="ink.text-subdued">
            Questions? Open an issue on our{' '}
            <a
              className={css({ textDecorationLine: 'underline' })}
              href="https://github.com/ordpool-space/cat21-wallet/issues"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            .
          </styled.p>
        </Stack>
      </Sheet>
    );
  }
);
