import type { BrowserContext, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '../../fixtures/fixtures';

/**
 * UX-round-2 capture of the INHERITED Leather approval popups that the wallet
 * renders on its browser (window.Cat21Provider) surface: the connect /
 * permission request (getAddresses), the sign-message prompt, and the generic
 * sign-PSBT confirmation. These are upstream-Leather UI, NOT the Cat21 copy we
 * rewrote — captured only so a reviewer sees what a person meets on those
 * paths (per the round's scope note). We render, we do not approve.
 *
 * Runs under the DEFAULT playwright config (not the chain config), because it
 * needs the test-app dapp on :3000 to invoke the provider RPCs. electrs is on
 * :3010 in this stack, so :3000 is free for the dapp.
 *
 * Run:
 *   CAT21_UX_CAPTURE_DIR=/path/to/ux-round2/cat21-wallet \
 *   PW_CHROMIUM_EXE="~/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
 *     pnpm --filter @leather.io/extension exec playwright test \
 *       tests/specs/rpc-inherited-capture
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR =
  process.env.CAT21_UX_CAPTURE_DIR ?? path.join(here, '../../../playwright-report/ux-capture');

// A real unsigned PSBT with two inputs and one output, from the sign-psbt
// integration spec — enough for the generic signer to render inputs/outputs/fee.
const UNSIGNED_PSBT_HEX =
  '70736274ff01007b02000000025f9f604745537f28f9ea6a963c35355dd60696a52d909c528b0212a062dc65290100000000fffffffffe690823a3d0fec1513ac8f40e3a3672208a08919fff13763ae01a38ef368d2f0100000000ffffffff01e803000000000000160014a8113965cee4d5ffa2d9996a204866a58200131d000000000001011fc512000000000000160014a8113965cee4d5ffa2d9996a204866a58200131d0001011f7feff10000000000160014a8113965cee4d5ffa2d9996a204866a58200131d0000';

async function shootPopup(popup: Page, name: string) {
  await popup.waitForLoadState('domcontentloaded');
  await popup.setViewportSize({ width: 420, height: 860 });
  // Give the request UI a settle beat: wait for any button to be present so we
  // do not shoot a blank frame while the popup mounts.
  await popup.locator('button').first().waitFor({ state: 'visible' });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await popup.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
}

test.describe('Inherited Leather approval popups (UX round 2 capture)', () => {
  test.beforeEach(async ({ extensionId, globalPage, onboardingPage }) => {
    await globalPage.setupAndUseApiCalls(extensionId);
    await onboardingPage.signInWithTestAccount(extensionId);
  });

  /**
   * Fire a provider RPC and HOLD its promise. The dapp-side promise blocks
   * until the user acts; we settle it (via the popup close below) so it does
   * not reject at teardown as an unhandled "target page closed". Returns the
   * held promise so the caller can await it after closing the popup.
   */
  function fireRpc(page: Page, method: string, params?: unknown): Promise<unknown> {
    return page.evaluate(
      ([m, p]) => (window as any).LeatherProvider?.request(m, p).catch(() => undefined),
      [method, params] as const
    );
  }

  async function interceptPopup(context: BrowserContext): Promise<Page> {
    return context.waitForEvent('page');
  }

  test('connect / permission request (getAddresses)', async ({ page, context }) => {
    await page.goto('localhost:3000');
    const rpc = fireRpc(page, 'getAddresses');
    const popup = await interceptPopup(context);
    await popup.getByTestId('get-addresses-approve-button').waitFor({ state: 'visible' });
    await shootPopup(popup, 'inherited-connect-popup-390');
    await popup.close();
    await rpc.catch(() => undefined);
  });

  test('sign-message prompt', async ({ page, context }) => {
    await page.goto('localhost:3000');
    const rpc = fireRpc(page, 'signMessage', {
      message: 'Verify you own this address',
      paymentType: 'p2wpkh',
    });
    const popup = await interceptPopup(context);
    // The message-signing popup's approve action reads "Sign".
    await popup.getByRole('button', { name: 'Sign' }).waitFor({ state: 'visible' });
    await shootPopup(popup, 'inherited-sign-message-popup-390');
    await popup.close();
    await rpc.catch(() => undefined);
  });

  test('generic sign-PSBT confirmation (stock Leather)', async ({ page, context }) => {
    await page.goto('localhost:3000');
    const rpc = fireRpc(page, 'signPsbt', { hex: UNSIGNED_PSBT_HEX });
    const popup = await interceptPopup(context);
    // The waitFor on the Confirm button IS the assertion: it fails if the
    // stock signer popup does not render.
    await popup.getByRole('button', { name: 'Confirm' }).waitFor({ state: 'visible' });
    await shootPopup(popup, 'inherited-sign-psbt-popup-390');
    await popup.close();
    await rpc.catch(() => undefined);
  });
});
