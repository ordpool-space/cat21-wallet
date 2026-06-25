import { tokens } from '@leather.io/tokens';

import { pxStringToNumber } from '@shared/utils/px-string-to-number';

interface PopupOptions {
  url?: string;
  title?: string;
  skipPopupFallback?: boolean;
}

export function popup(options: PopupOptions): Promise<any> {
  const { url } = options;

  const popupWidth = pxStringToNumber(tokens.sizes.popupWidth.value);
  const popupHeight = pxStringToNumber(tokens.sizes.popupHeight.value);

  // HACK -- Cat21 (debug-connect): probe — fan out to every dapp tab
  // so the debug surfaces regardless of which one triggered this.
  function dbg(text: string) {
    chrome.tabs.query({}, tabs => {
      for (const t of tabs) {
        if (t.id !== undefined) {
          void chrome.tabs.sendMessage(t.id, { source: 'CAT21-DEBUG', text: `popup: ${text}` });
        }
      }
    });
  }

  dbg(`popup() called url=${url}`);
  return new Promise(resolve => {
    // @see https://developer.chrome.com/docs/extensions/reference/windows/#method-getCurrent
    chrome.windows.getCurrent(async win => {
      dbg(`getCurrent callback fired; win.id=${win?.id ?? 'undef'} left=${win?.left ?? 'undef'} top=${win?.top ?? 'undef'} width=${win?.width ?? 'undef'} height=${win?.height ?? 'undef'}`);
      // these units take into account the distance from
      // the farthest left/top sides of all displays
      const dualScreenLeft = win.left ?? 0;
      const dualScreenTop = win.top ?? 0;

      // dimensions of the window that originated the action
      const width = win.width ?? 0;
      const height = win.height ?? 0;

      const left = Math.floor(width / 2 - popupWidth / 2 + dualScreenLeft);
      const top = Math.floor(height / 2 - popupHeight / 2 + dualScreenTop);

      dbg(`about to call chrome.windows.create type=popup width=${popupWidth} height=${popupHeight} left=${left} top=${top}`);
      try {
        const popup = await chrome.windows.create({
          url,
          width: popupWidth,
          height: popupHeight,
          top,
          left,
          focused: true,
          type: 'popup',
        });
        dbg(`chrome.windows.create resolved; popup.id=${popup?.id ?? 'undef'}`);
        resolve(popup);
      } catch (e) {
        dbg(`chrome.windows.create THREW: ${(e as Error)?.message ?? String(e)}`);
        throw e;
      }
    });
  });
}
