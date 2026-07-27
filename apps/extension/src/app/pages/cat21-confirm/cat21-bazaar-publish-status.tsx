import { Flex, styled } from 'leather-styles/jsx';

import { Button } from '@leather.io/ui';

import {
  Cat21BazaarError,
  Cat21BazaarPublishState,
} from '@app/common/cat21-bazaar/cat21-bazaar.types';
import { ErrorLabel } from '@app/components/error-label';
import { Content } from '@app/components/layout';

interface Cat21BazaarPublishStatusProps {
  state: Exclude<Cat21BazaarPublishState, { step: 'idle' }>;
  /** Dismiss the popup (both success and error offer this). */
  onClose(): void;
}

const PROGRESS_COPY: Record<'resolving' | 'signing-session' | 'posting', string> = {
  resolving: 'Reading your cat from the chain…',
  'signing-session': 'Approve the signature to prove you own this cat.',
  posting: 'Listing on the Bazaar…',
};

/** Human-readable line per Bazaar error code — never the raw code. */
function errorCopy(error: Cat21BazaarError): string {
  switch (error.code) {
    case 'session-rejected':
      return 'The marketplace could not verify your signature. Please try again.';
    case 'not-current-owner':
      return 'This cat is no longer at your address, so it cannot be listed.';
    case 'cats-bundle-drift':
      return 'The cats on this UTXO changed since you opened this screen. Reopen and try again.';
    case 'outpoint-mismatch':
      return 'This cat has moved. Reopen the cat and list it again.';
    case 'cat-not-found':
      return 'The marketplace could not find this cat. It may not be indexed yet.';
    case 'network-mismatch':
      return 'Network mismatch between the wallet and the marketplace.';
    case 'rate-limited':
      return 'Too many listings in a short time. Wait a minute and try again.';
    case 'network-error':
      return 'Could not reach the Bazaar. Check your connection and try again.';
    case 'rejected':
    default:
      return 'The marketplace rejected this listing.';
  }
}

/**
 * Renders the in-wallet Bazaar publish flow after the createOffer
 * gate has succeeded: a progress line while resolving / signing /
 * posting, then a terminal success or error card. Presentational —
 * the container (`Cat21ConfirmRoute`) owns the state machine and the
 * close navigation.
 */
export function Cat21BazaarPublishStatus({ state, onClose }: Cat21BazaarPublishStatusProps) {
  if (state.step === 'success') {
    return (
      <Content>
        <Flex flexDirection="column" gap="space.04" p="space.05">
          <styled.h1 textStyle="heading.03">Listed on the Bazaar</styled.h1>
          <styled.p textStyle="body.02" color="ink.text-subdued">
            Cat #{state.catNumber} is now for sale. Anyone can find it on the orderbook and buy it
            at your asking price.
          </styled.p>
          <Button fullWidth onClick={onClose} data-testid="bazaar-publish-done">
            Done
          </Button>
        </Flex>
      </Content>
    );
  }

  if (state.step === 'error') {
    return (
      <Content>
        <Flex flexDirection="column" gap="space.04" p="space.05">
          <styled.h1 textStyle="heading.03">Couldn't list this cat</styled.h1>
          <ErrorLabel>{errorCopy(state.error)}</ErrorLabel>
          <Button fullWidth onClick={onClose} data-testid="bazaar-publish-error-close">
            Close
          </Button>
        </Flex>
      </Content>
    );
  }

  return (
    <Content>
      <Flex
        flexDirection="column"
        gap="space.04"
        p="space.05"
        data-testid="bazaar-publish-progress"
      >
        <styled.h1 textStyle="heading.03">Listing on the Bazaar</styled.h1>
        <styled.p textStyle="body.02" color="ink.text-subdued">
          {PROGRESS_COPY[state.step]}
        </styled.p>
      </Flex>
    </Content>
  );
}
