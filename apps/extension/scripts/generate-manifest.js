import deepMerge from 'deepmerge';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* HACK -- Cat21: dev extension public key pinned for stable chrome-extension://<id>/
 * The matching private key lives in .keys/cat21-wallet-dev.pem (gitignored).
 * Stable ID lets ADR-5 Native Messaging Host manifests hardcode allowed_origins.
 * If .keys/ is absent (clean checkouts, CI), we fall back to Chrome's per-install
 * random ID — NMH will not work in that case but builds still succeed. */
function loadDevExtensionKey() {
  try {
    const path = resolve(import.meta.dirname, '../../../.keys/cat21-wallet-dev.pub.b64');
    return readFileSync(path, 'utf8').trim();
  } catch {
    return undefined;
  }
}
const DEV_EXTENSION_KEY = loadDevExtensionKey();

// Manifest can only be prod or dev
const WALLET_ENVIRONMENT =
  process.env.WALLET_ENVIRONMENT === 'production' ? 'production' : 'development';

const IS_DEV = WALLET_ENVIRONMENT === 'development';

const PREVIEW_RELEASE = process.env.PREVIEW_RELEASE;

const TARGET_BROWSER = process.env.TARGET_BROWSER ?? 'chromium';

function generateImageAssetUrlsWithSuffix(suffix = '') {
  return {
    128: `assets/icons/cat21-icon-128${suffix}.png`,
    256: `assets/icons/cat21-icon-256${suffix}.png`,
    512: `assets/icons/cat21-icon-512${suffix}.png`,
  };
}

const environmentIcons = {
  development: {
    icons: generateImageAssetUrlsWithSuffix('-dev'),
  },
  production: {
    icons: generateImageAssetUrlsWithSuffix(PREVIEW_RELEASE ? '-preview' : ''),
  },
};

const devCsp =
  "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; frame-src https://*.onramper.com https://*.onramper.dev; frame-ancestors 'none';";

const prodCsp = `default-src 'none'; connect-src *; style-src 'unsafe-inline'; img-src 'self' data: https:; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; frame-src https://*.onramper.com; frame-ancestors 'none';`;

const contentSecurityPolicyEnvironment = {
  testing: prodCsp,
  development: devCsp,
  production: prodCsp,
};

const defaultIconEnvironment = {
  development: 'assets/icons/cat21-icon-128-dev.png',
  production: 'assets/icons/cat21-icon-128.png',
};

const browserSpecificConfig = {
  firefox: {
    background: {
      scripts: ['background.js'],
    },
    browser_specific_settings: {
      gecko: {
        id: '{e22ae397-03d7-4622-bd8f-ecaca8c9b277}',
      },
    },
  },
  chromium: {
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
  },
};

/* HACK -- Cat21: all brand strings + identity in this manifest are Cat21 Wallet.
 * Do not merge from upstream blindly. Conflicts on author/description/name/action.default_title/commands._execute_browser_action.description are expected and intentional.
 * `nativeMessaging` permission is required by ADR-5 (MCP server bridge via Chrome NMH). */
const manifest = {
  manifest_version: 3,
  author: 'ordpool-space',
  description: 'Cat21 Wallet — hot wallet for active CAT-21 cat trading. BTC L1 mainnet only.',
  permissions: ['contextMenus', 'storage', 'unlimitedStorage', 'notifications', 'nativeMessaging'],
  commands: {
    _execute_browser_action: {
      suggested_key: {
        default: 'Ctrl+Shift+B',
        mac: 'MacCtrl+Shift+B',
      },
      description: 'Opens Cat21 Wallet',
    },
  },
  host_permissions: ['*://*/*'],
  content_security_policy: {
    extension_pages: contentSecurityPolicyEnvironment[WALLET_ENVIRONMENT],
  },
  web_accessible_resources: [{ resources: ['inpage.js'], matches: ['*://*/*'] }],
  action: {
    default_title: 'Cat21 Wallet',
    default_popup: 'action-popup.html',
    default_icon: defaultIconEnvironment[WALLET_ENVIRONMENT],
  },
  options_ui: {
    page: 'index.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      run_at: 'document_start',
      js: ['content-script.js'],
      matches: ['*://*/*'],
      all_frames: true,
    },
  ],
};

const devManifest = {
  name: 'Cat21 Wallet Dev',
  ...(DEV_EXTENSION_KEY ? { key: DEV_EXTENSION_KEY } : {}),
};

const name = PREVIEW_RELEASE ? 'Cat21 Wallet Preview' : 'Cat21 Wallet';

const prodManifest = {
  name,
  icons: generateImageAssetUrlsWithSuffix(PREVIEW_RELEASE ? '-preview' : ''),
  action: {
    default_icon: `assets/icons/cat21-icon-128${PREVIEW_RELEASE ? '-preview' : ''}.png`,
  },
};

export default function generateManifest(packageVersion) {
  if (!packageVersion)
    throw new Error('Version number must be passed to `generateManifest` function');

  const version = packageVersion.includes('-') ? packageVersion.split('-')[0] : packageVersion;

  const releaseEnvironmentConfig = IS_DEV ? devManifest : prodManifest;

  const browserConfig = browserSpecificConfig[TARGET_BROWSER];

  return deepMerge.all([
    { version },
    manifest,
    releaseEnvironmentConfig,
    browserConfig,
    environmentIcons[WALLET_ENVIRONMENT],
  ]);
}
