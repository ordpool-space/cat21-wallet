import { useState } from 'react';

import { Flex, styled } from 'leather-styles/jsx';

import { Button } from '@leather.io/ui';

import { ErrorLabel } from '@app/components/error-label';
import { ButtonRow, Content } from '@app/components/layout';

import type { Cat21ConfirmationCopy } from './cat21-confirmation-copy';

/**
 * A counterparty address (buy's seller payout) that arrived from an offer.
 * The person has nothing to compare it against, so it shows truncated by
 * default; "Show full" reveals the full grouped form, wrapping, still
 * byte-complete. Local state only — never touches the signed intent.
 */
function RevealAddressRow(props: {
  label: string;
  truncated: string;
  full: string;
  testId: string;
}) {
  const { label, truncated, full, testId } = props;
  const [shown, setShown] = useState(false);
  return (
    <Flex direction="column" gap="space.01">
      <styled.span textStyle="label.02" color="ink.text-subdued">
        {label}
      </styled.span>
      {shown ? (
        <styled.span
          textStyle="mono.02"
          fontFamily="monospace"
          wordBreak="break-word"
          data-testid={testId}
        >
          {full}
        </styled.span>
      ) : (
        <Flex justifyContent="space-between" gap="space.04" alignItems="baseline">
          <styled.span textStyle="mono.02" fontFamily="monospace" data-testid={testId}>
            {truncated}
          </styled.span>
          <styled.button
            type="button"
            onClick={() => setShown(true)}
            textStyle="label.02"
            textDecoration="underline"
            cursor="pointer"
            flexShrink={0}
            data-testid={`${testId}-reveal`}
          >
            Show full
          </styled.button>
        </Flex>
      )}
    </Flex>
  );
}

interface Cat21ConfirmationDialogProps {
  /** Result of `makeCat21ConfirmationCopy(intent)`. */
  copy: Cat21ConfirmationCopy;
  /** Called when the user clicks the approve button. */
  onApprove(): void;
  /** Called when the user clicks the reject button. */
  onReject(): void;
  /** Disables both buttons while a sign/broadcast roundtrip is in flight. */
  isSubmitting?: boolean;
  /**
   * Error message to surface above the buttons. Set this from the
   * container when the dispatcher rejects (typed denial, broadcast
   * failure, etc.). The dialog stays open so the user can cancel or
   * retry by clicking approve again.
   */
  submitError?: string | null;
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
export function Cat21ConfirmationDialog(props: Cat21ConfirmationDialogProps) {
  const { copy, onApprove, onReject, isSubmitting, submitError } = props;
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
          {copy.rows.map((row, idx) => {
            const testId = `cat21-confirmation-row-${row.label.toLowerCase().replace(/\s+/u, '-')}`;
            // A `verify` row is a destination address the person commits
            // value to. It renders on its own line, full and left-aligned,
            // wrapping at the 4-char group boundaries so every character is
            // on screen: address poisoning forges only the head and tail,
            // and a truncated head…tail rendering hides the swapped middle.
            if (row.verify) {
              return (
                <Flex key={idx} direction="column" gap="space.01">
                  <styled.span textStyle="label.02" color="ink.text-subdued">
                    {row.label}
                  </styled.span>
                  <styled.span
                    textStyle="mono.02"
                    fontFamily="monospace"
                    wordBreak="break-word"
                    data-testid={testId}
                  >
                    {row.value}
                  </styled.span>
                </Flex>
              );
            }
            // A `reveal` row is a counterparty address from an offer: truncated
            // by default (nothing to compare it against), full form on demand.
            if (row.reveal) {
              return (
                <RevealAddressRow
                  key={idx}
                  label={row.label}
                  truncated={row.value}
                  full={row.reveal}
                  testId={testId}
                />
              );
            }
            return (
              <Flex key={idx} justifyContent="space-between" gap="space.05">
                <styled.span textStyle="label.02" color="ink.text-subdued">
                  {row.label}
                </styled.span>
                <styled.span
                  textStyle="mono.02"
                  fontFamily="monospace"
                  textAlign="right"
                  data-testid={testId}
                >
                  {row.value}
                </styled.span>
              </Flex>
            );
          })}
        </Flex>
        {submitError ? (
          <ErrorLabel data-testid="cat21-confirmation-error">{submitError}</ErrorLabel>
        ) : null}
        <ButtonRow flexDirection="row" pt="space.05">
          <Button
            variant="outline"
            flexGrow={1}
            onClick={onReject}
            disabled={isSubmitting}
            type="button"
            data-testid="cat21-confirmation-reject"
          >
            {copy.rejectButtonLabel}
          </Button>
          <Button
            // De-emphasise the primary action once an error is showing. It
            // stays LIVE on purpose (a policy block can clear if the user
            // raises the cap in another window, then this retry succeeds —
            // the caps gate re-reads current policy), but a solid button under
            // a red "you can't continue" message reads as a confident "go" it
            // is not. Outline signals "not the confident action" while keeping
            // the retry path open.
            variant={submitError ? 'outline' : 'solid'}
            flexGrow={1}
            onClick={onApprove}
            disabled={isSubmitting}
            type="button"
            data-testid="cat21-confirmation-approve"
          >
            {copy.approveButtonLabel}
          </Button>
        </ButtonRow>
      </Flex>
    </Content>
  );
}
