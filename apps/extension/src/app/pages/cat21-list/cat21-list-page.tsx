import { useNavigate } from 'react-router';

import { useQuery } from '@tanstack/react-query';
import { Flex, styled } from 'leather-styles/jsx';

import { getCat21OrdApiClient } from '@leather.io/services';
import { Button } from '@leather.io/ui';

import { RouteUrls } from '@shared/route-urls';

import { ErrorLabel } from '@app/components/error-label';
import { Content } from '@app/components/layout';
import { useCurrentAccountId } from '@app/store/accounts/account';
import { useNativeSegwitAccountIndexAddressIndexZero } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';

/**
 * "My CAT-21 cats" list page (iter 13f). Queries the active
 * account's cats from cat21-ord and surfaces Transfer / List-for-sale
 * action buttons per cat. Buttons deep-link the iter-13d/e form
 * pages with `prefilledCatId` (and `prefilledPaymentAddress` for
 * Create-Offer) in `location.state`.
 *
 * Read-only at this layer — all mutating flows still route through
 * the existing form → confirm → SDK-gate → sign → broadcast pipeline.
 *
 * The page deliberately does not try to render cat IMAGES (would
 * require recursive ord content fetching + sandboxing); a textual
 * row with the truncated cat id is enough to make the actions
 * reachable. A future iteration can plug in `mooncat-parser` from
 * `ordpool-parser` for the SVG render.
 */
export function Cat21ListPage() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccountId();
  const paymentAddress = useNativeSegwitAccountIndexAddressIndexZero(currentAccount);
  const cat21OrdClient = getCat21OrdApiClient();

  const {
    data: cats,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['cat21-ord-address-cat21s', paymentAddress],
    queryFn: () => cat21OrdClient.fetchAddressCat21s(paymentAddress as string),
    enabled: paymentAddress != null,
    staleTime: 30_000,
  });

  return (
    <Content>
      <Flex direction="column" gap="space.05" px="space.05">
        <styled.h1 textStyle="heading.03">My CAT-21 cats</styled.h1>
        <styled.p textStyle="body.02">
          Cats held by this account, sourced from cat21-ord. Pick an action per cat to start a
          manual transfer or listing.
        </styled.p>

        {paymentAddress == null ? (
          <styled.p textStyle="body.02" data-testid="cat21-list-no-address">
            No native-segwit address derived yet.
          </styled.p>
        ) : isPending ? (
          <styled.p textStyle="body.02" data-testid="cat21-list-loading">
            Loading cats…
          </styled.p>
        ) : isError ? (
          <Flex direction="column" gap="space.02" data-testid="cat21-list-error">
            <ErrorLabel>Could not reach cat21-ord. Try again.</ErrorLabel>
            <Button variant="outline" onClick={() => void refetch()} type="button">
              Retry
            </Button>
          </Flex>
        ) : cats.inscriptions.length === 0 ? (
          <styled.p textStyle="body.02" data-testid="cat21-list-empty">
            No cats at this address yet. Mint your first one from the home screen.
          </styled.p>
        ) : (
          <Flex direction="column" gap="space.03" data-testid="cat21-list-rows">
            {cats.inscriptions.map(catId => (
              <Flex
                key={catId}
                direction="column"
                gap="space.02"
                p="space.03"
                borderColor="ink.border-default"
                borderWidth="1px"
                borderRadius="xs"
              >
                <styled.code
                  textStyle="label.02"
                  wordBreak="break-all"
                  data-testid={`cat21-list-cat-id-${catId}`}
                >
                  {catId}
                </styled.code>
                <Flex gap="space.02">
                  <Button
                    variant="outline"
                    fullWidth
                    type="button"
                    data-testid={`cat21-list-transfer-${catId}`}
                    onClick={() =>
                      void navigate(RouteUrls.Cat21Transfer, {
                        state: { prefilledCatId: catId },
                      })
                    }
                  >
                    Transfer
                  </Button>
                  <Button
                    variant="outline"
                    fullWidth
                    type="button"
                    data-testid={`cat21-list-list-${catId}`}
                    onClick={() =>
                      void navigate(RouteUrls.Cat21CreateOffer, {
                        state: {
                          prefilledCatId: catId,
                          prefilledPaymentAddress: paymentAddress,
                        },
                      })
                    }
                  >
                    List for sale
                  </Button>
                </Flex>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
    </Content>
  );
}
