import { describe, expect, it } from 'vitest';

/**
 * The dialog component (`cat21-confirmation-dialog.tsx`) is a thin
 * presentational shell over `Cat21ConfirmationCopy`. We don't mount it
 * here — react-testing-library + jsdom adds 5-10s of test cost for
 * each render, and the dialog has no business logic to test (the copy
 * derivation is already covered by `cat21-confirmation-copy.spec.ts`).
 *
 * Instead, the spec below pins the structural contract: the dialog
 * file imports the right symbols and renders the expected data-testid
 * hooks. A future regression-pinning spec can mount via testing
 * library if a real bug requires it.
 */
describe('cat21-confirmation-dialog (structural contract)', () => {
  it('imports Cat21ConfirmationCopy from its sibling helper', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('./cat21-confirmation-dialog.tsx', import.meta.url), 'utf8')
    );
    expect(src).toMatch(/from '\.\/cat21-confirmation-copy'/);
    expect(src).toMatch(/Cat21ConfirmationCopy/);
  });

  it('exposes data-testid hooks for title / rows / both buttons', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('./cat21-confirmation-dialog.tsx', import.meta.url), 'utf8')
    );
    // The e2e tests in cat21-wallet/e2e (and future Playwright cases)
    // rely on these data-testids to drive the dialog. Pin them.
    expect(src).toMatch(/data-testid="cat21-confirmation-title"/);
    expect(src).toMatch(/data-testid="cat21-confirmation-rows"/);
    expect(src).toMatch(/data-testid="cat21-confirmation-approve"/);
    expect(src).toMatch(/data-testid="cat21-confirmation-reject"/);
  });

  it('renders rows from copy.rows (the iter-11a struct shape)', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('./cat21-confirmation-dialog.tsx', import.meta.url), 'utf8')
    );
    // The dialog must iterate `copy.rows`. A future refactor that
    // changes the data shape (e.g. moves rows into a nested object)
    // must update both the helper and the dialog in the same commit.
    expect(src).toMatch(/copy\.rows\.map/);
    expect(src).toMatch(/copy\.paragraphs\.map/);
    expect(src).toMatch(/copy\.title/);
    expect(src).toMatch(/copy\.approveButtonLabel/);
    expect(src).toMatch(/copy\.rejectButtonLabel/);
  });

  it('renders a verify (destination-address) row full-width and wrapping, not right-aligned (§7.14)', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('./cat21-confirmation-dialog.tsx', import.meta.url), 'utf8')
    );
    // A destination address the person commits value to must render in
    // full and wrap, so address poisoning (which forges only the head and
    // tail) can't hide the swapped middle behind a right-aligned truncation.
    // The dialog branches on `row.verify` and renders that value with word
    // wrapping. Removing the branch — folding verify rows back into the
    // `textAlign="right"` path — makes this red.
    expect(src).toMatch(/row\.verify/);
    expect(src).toMatch(/wordBreak/);
  });

  it('renders a reveal (counterparty-address) row truncated with a "Show full" affordance', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('./cat21-confirmation-dialog.tsx', import.meta.url), 'utf8')
    );
    // A counterparty address from an offer (buy's seller payout) shows
    // truncated by default with a control to reveal the full grouped form.
    // The dialog branches on `row.reveal` into RevealAddressRow, whose reveal
    // control carries a `-reveal` testid. Dropping the branch or the control
    // makes this red.
    expect(src).toMatch(/row\.reveal/);
    expect(src).toMatch(/RevealAddressRow/);
    expect(src).toMatch(/-reveal/);
    expect(src).toMatch(/Show full/);
  });

  it('disables both buttons when isSubmitting=true', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('./cat21-confirmation-dialog.tsx', import.meta.url), 'utf8')
    );
    // Both buttons MUST honour the `isSubmitting` prop so a
    // double-click during sign/broadcast can't fire two requests.
    // Walk backwards from each testid to find the enclosing <Button ...>
    // tag (200 chars before the testid is enough to cover the prop list).
    const approveBlock =
      src.match(/[\s\S]{0,300}data-testid="cat21-confirmation-approve"/u)?.[0] ?? '';
    const rejectBlock =
      src.match(/[\s\S]{0,300}data-testid="cat21-confirmation-reject"/u)?.[0] ?? '';
    expect(approveBlock).toMatch(/disabled=\{isSubmitting\}/);
    expect(rejectBlock).toMatch(/disabled=\{isSubmitting\}/);
  });
});
