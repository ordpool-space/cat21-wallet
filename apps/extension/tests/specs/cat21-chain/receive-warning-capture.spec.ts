import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '../../fixtures/fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR =
  process.env.CAT21_UX_CAPTURE_DIR ?? path.join(here, '../../../playwright-report/ux-capture');

/** WCAG relative luminance of an "r,g,b" triple. */
function luminance([r, g, b]: number[]): number {
  function lin(c: number) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two "r,g,b" triples, rounded to 2 dp. */
function contrastRatio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * Measure an element's text colour against its nearest painted background and
 * log the WCAG ratio. Same discipline as the SDK's published receive-note
 * number: measure against the GROUND the element sits on, not a sibling.
 */
async function logContrast(locator: import('@playwright/test').Locator, label: string) {
  const colours = await locator.first().evaluate(el => {
    function parse(c: string) {
      return (c.match(/[\d.]+/g) ?? []).map(Number);
    }
    const color = parse(getComputedStyle(el as Element).color).slice(0, 3);
    let node: Element | null = el as Element;
    let bg = [255, 255, 255];
    while (node) {
      const raw = getComputedStyle(node).backgroundColor;
      const parts = parse(raw);
      if (parts.length >= 3 && parts[3] !== 0) {
        bg = parts.slice(0, 3);
        break;
      }
      node = node.parentElement;
    }
    return { color, bg };
  });
  // eslint-disable-next-line no-console
  console.log(
    `[contrast] ${label}: color=rgb(${colours.color}) bg=rgb(${colours.bg}) ratio=${contrastRatio(colours.color, colours.bg)}`
  );
}

/**
 * UX-round-3 capture: the "only cats are safe here" safety disclosure on the
 * BTC receive screen, rendered in the real 390px action-popup host. This is
 * the round's highest-value placement: the one point where the loss (an
 * inscription/rune/rare-sat/stamp spent by accident) is preventable at zero
 * cost, before the asset is ever deposited.
 */
test.describe('Receive-screen cats-only safety disclosure (UX round 3)', () => {
  test('renders the "only cats are safe here" warning on BTC receive', async ({
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);

    await page.setViewportSize({ width: 420, height: 860 });
    await page.goto(`chrome-extension://${extensionId}/action-popup.html#/receive/btc-taproot`);

    // The disclosure text is the anchor: it must be on screen at the point of
    // deposit. Waiting on it IS the assertion.
    await page.getByText('This wallet only indexes cats').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(OUT_DIR, 'receive-cats-only-taproot-390.png') });

    // Note title == body colour (both ink text-primary on the info ground);
    // measuring the body is enough, the SDK published the title at the same value.
    await logContrast(page.getByText('So it can', { exact: false }), 'note body');
    await logContrast(page.getByText('a CAT-21 cat', { exact: false }), 'receive heading');

    // §13: the displayed receive address is grouped in fours. Its whole
    // purpose is to be copied and handed to a sender, so a drag-selection must
    // yield a PASTEABLE address. `textContent` can't see the defect (it reports
    // the raw address whether or not layout inserts newlines on copy), so we
    // select the rendered address and read what the copy serialiser produces.
    const rawAddress = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="address-displayer"]');
      if (!el) return { found: false, raw: '', selected: '' };
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return {
        found: true,
        raw: (el.textContent ?? '').trim(),
        selected: sel?.toString() ?? '',
      };
    });
    // eslint-disable-next-line no-console
    console.log(
      `[a11y] address textContent=${JSON.stringify(rawAddress.raw)} selection=${JSON.stringify(rawAddress.selected)}`
    );

    // Also the native-segwit receive, since a deposit can land on either type.
    await page.goto(`chrome-extension://${extensionId}/action-popup.html#/receive/btc`);
    await page.getByText('This wallet only indexes cats').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(OUT_DIR, 'receive-cats-only-segwit-390.png') });
  });

  test('shows the positioning line in the settings "about" area', async ({
    page,
    extensionId,
    onboardingPage,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await onboardingPage.signInWithTestAccount(extensionId);

    await page.setViewportSize({ width: 420, height: 860 });
    await page.goto(`chrome-extension://${extensionId}/action-popup.html#/settings`);
    const positioning = page.getByText('high frequency trading of CAT-21');
    await positioning.waitFor({ state: 'visible' });
    await positioning.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT_DIR, 'settings-positioning-390.png') });
    await logContrast(positioning, 'settings positioning line');
  });
});
