#!/usr/bin/env node
/**
 * Guard: refuse to run wallet builds/tests when ordpool-sdk/dist-core
 * is stale relative to ordpool-sdk/src.
 *
 * The wallet imports SDK helpers from the compiled `dist-core/` output
 * (resolved via the `./core` entry in ordpool-sdk's package.json
 * exports map). If a developer edits SDK source and forgets to rebuild,
 * the wallet runs against the OLD compiled bytes — silent staleness,
 * the source-of-confusion the user explicitly called out.
 *
 * This script compares the newest source-file mtime under
 * ordpool-sdk/src/ (excluding *.spec.ts / *.test.ts — those don't go
 * into dist-core) against the newest output-file mtime under
 * ordpool-sdk/dist-core/. If src is newer, we fail loudly with the
 * exact rebuild command. Wired into `pretest:unit` and `prebuild` in
 * the wallet's package.json so it fires every time.
 *
 * If dist-core/ doesn't exist (fresh clone before a build), same
 * failure mode with a different message.
 *
 * The check is read-only and fast (a recursive stat walk). Typical
 * runtime: 5-15ms.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WALLET_EXT_ROOT = path.resolve(__dirname, '..');
const SDK_ROOT = path.resolve(WALLET_EXT_ROOT, '../../../ordpool-sdk');
const SDK_SRC = path.join(SDK_ROOT, 'src');
const SDK_DIST_CORE = path.join(SDK_ROOT, 'dist-core');

const RED = '[31m';
const YELLOW = '[33m';
const RESET = '[0m';
const BOLD = '[1m';

function exitWith(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

function latestMtime(dir, skipExts) {
  let latest = 0;
  function walk(d) {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (skipExts && skipExts.some(ext => entry.name.endsWith(ext))) continue;
        try {
          const m = fs.statSync(full).mtimeMs;
          if (m > latest) latest = m;
        } catch {
          // ignore unreadable file
        }
      }
    }
  }
  walk(dir);
  return latest;
}

function relTime(ms) {
  if (!ms) return '(never)';
  return new Date(ms).toISOString();
}

if (!fs.existsSync(SDK_ROOT)) {
  exitWith(
    `${RED}${BOLD}✗ ordpool-sdk not found at ${SDK_ROOT}${RESET}\n` +
      '  The wallet expects the SDK alongside cat21-wallet-staging.\n' +
      '  Clone it: git clone git@github-ord-dev:ordpool-space/ordpool-sdk.git ' +
      path.resolve(WALLET_EXT_ROOT, '../../../') + '/ordpool-sdk'
  );
}

if (!fs.existsSync(SDK_DIST_CORE)) {
  exitWith(
    `${RED}${BOLD}✗ ordpool-sdk/dist-core/ does not exist — SDK has not been built.${RESET}\n` +
      `  Run from the wallet: ${BOLD}pnpm sdk:build${RESET}\n` +
      `  Or directly: (cd ${SDK_ROOT} && npm run build:core)`
  );
}

// *.spec.ts and *.test.ts don't ship into dist-core (tsconfig.core.json
// excludes them). Also skip *.d.ts files inside src — they're inputs to
// the build, not outputs, but they should still trigger a rebuild if
// touched, so we DO include them here. *.tsbuildinfo lives in dist
// directories only; not relevant for src.
const srcMtime = latestMtime(SDK_SRC, ['.spec.ts', '.test.ts']);
const distMtime = latestMtime(SDK_DIST_CORE);

if (srcMtime > distMtime) {
  const lagSeconds = Math.floor((srcMtime - distMtime) / 1000);
  exitWith(
    `${RED}${BOLD}✗ ordpool-sdk/dist-core/ is STALE compared to src/${RESET}\n` +
      `  ${YELLOW}SDK src/ newest file:       ${relTime(srcMtime)}${RESET}\n` +
      `  ${YELLOW}SDK dist-core/ newest file: ${relTime(distMtime)}${RESET}\n` +
      `  ${YELLOW}lag: ${lagSeconds}s${RESET}\n\n` +
      `  The wallet imports compiled bytes from dist-core/; an unbuilt edit\n` +
      `  in SDK src/ will silently NOT show up in wallet tests / builds.\n\n` +
      `  Rebuild from the wallet:  ${BOLD}pnpm sdk:build${RESET}\n` +
      `  Or watch SDK in a side terminal: ${BOLD}pnpm sdk:watch${RESET}`
  );
}

// All good — silent.
