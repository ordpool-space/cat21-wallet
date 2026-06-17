import { Flex, styled } from 'leather-styles/jsx';

import { Button } from '@leather.io/ui';

import { Content } from '@app/components/layout';

import type { Cat21ConfirmationCopy } from './cat21-confirmation-copy';

interface Cat21ConfirmationDialogProps {
  /** Result of `makeCat21ConfirmationCopy(intent)`. */
  copy: Cat21ConfirmationCopy;
  /** Called when the user clicks the approve button. */
  onApprove(): void;
  /** Called when the user clicks the reject button. */
  onReject(): void;
  /** Disables both buttons while a sign/broadcast roundtrip is in flight. */
  isSubmitting?: boolean;
}

/**
 * Generic Cat21 confirmation popup body. Renders the copy produced by
 * `makeCat21ConfirmationCopy` — the four flavours (mint / transfer /
 * create-offer / accept-offer) share this presentational shell, only
 * the inbound `copy` struct differs.
 *
 * Composition responsibility:
 *   - Caller owns route + intent resolution. The dialog is a pure
 *     prop-driven shell, so it works equally well from the address-bar
 *     route + a future deep-linked sheet pattern.
 *   - Caller owns approve/reject side effects (dispatcher call,
 *     navigation, analytics).
 *   - Dialog renders title, paragraphs, definition-list rows, action
 *     buttons. That's it.
 */
// HACK -- Cat21: removed `export` (route consumers under
//   RouteUrls.Cat21MintConfirm / Cat21TransferConfirm / etc. land in
//   iter 11c). HARD RULE #5 — restore on wire-up.
// @ts-expect-error TS6133 -- HACK keeps declaration alive; remove with the `export` restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- HACK companion to the @ts-expect-error above.
function Cat21ConfirmationDialog(props: Cat21ConfirmationDialogProps) {
  const { copy, onApprove, onReject, isSubmitting } = props;
  return (
    <Content>
      <Flex direction="column" gap="space.05" px="space.05">
        <styled.h1 textStyle="heading.03" data-testid="cat21-confirmation-title">
          {copy.title}
        </styled.h1>
        <Flex direction="column" gap="space.03">
          {copy.paragraphs.map((paragraph, idx) => (
            <styled.p key={idx} textStyle="body.02">
              {paragraph}
            </styled.p>
          ))}
        </Flex>
        <Flex
          direction="column"
          gap="space.02"
          borderTopWidth="1px"
          borderTopColor="ink.border-default"
          pt="space.04"
          data-testid="cat21-confirmation-rows"
        >
          {copy.rows.map((row, idx) => (
            <Flex key={idx} justifyContent="space-between" gap="space.05">
              <styled.span textStyle="label.02" color="ink.text-subdued">
                {row.label}
              </styled.span>
              <styled.span
                textStyle="mono.02"
                fontFamily="monospace"
                textAlign="right"
                data-testid={`cat21-confirmation-row-${row.label.toLowerCase().replace(/\s+/u, '-')}`}
              >
                {row.value}
              </styled.span>
            </Flex>
          ))}
        </Flex>
        <Flex gap="space.03" pt="space.05">
          <Button
            variant="outline"
            fullWidth
            onClick={onReject}
            disabled={isSubmitting}
            type="button"
            data-testid="cat21-confirmation-reject"
          >
            {copy.rejectButtonLabel}
          </Button>
          <Button
            variant="solid"
            fullWidth
            onClick={onApprove}
            disabled={isSubmitting}
            type="button"
            data-testid="cat21-confirmation-approve"
          >
            {copy.approveButtonLabel}
          </Button>
        </Flex>
      </Flex>
    </Content>
  );
}
