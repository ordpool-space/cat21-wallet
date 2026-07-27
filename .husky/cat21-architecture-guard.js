#!/usr/bin/env node
/**
 * Pre-commit guard: refuses commits that violate the Cat21 architecture
 * boundary documented in CLAUDE.md HARD RULE #6.
 *
 *   - Browser-side code (inpage, content-scripts, packages/provider/src)
 *     may NOT mention any cat21_* RPC method name.
 *   - Browser-side code may NOT import the internal Cat21RpcService.
 *
 * These checks duplicate apps/extension/src/__architecture__/architecture.spec.ts
 * intentionally. The spec catches violations in CI; this hook catches them
 * before they leave the developer's machine. Both are cheap, both are
 * worth running.
 *
 * Exit 1 if any check fails. Print the offending file:line so the
 * developer can fix it without grepping.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.cache', 'RESCUE', '.husky']);

const FORBIDDEN_NAMES = [
  /cat21_(mint|transfer|create_offer|accept_offer|buy)/,
  /Cat21RpcService/,
  /cat21-rpc\.service/,
];

const BROWSER_SURFACE_ROOTS = [
  'apps/extension/src/inpage',
  'apps/extension/src/content-scripts',
  'packages/provider/src',
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (SOURCE_EXTS.some(ext => name.endsWith(ext)) && !name.endsWith('.snap')) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const rel of BROWSER_SURFACE_ROOTS) {
  for (const file of walk(join(REPO_ROOT, rel))) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, idx) => {
      for (const pattern of FORBIDDEN_NAMES) {
        if (pattern.test(line)) {
          violations.push({
            file: file.slice(REPO_ROOT.length + 1),
            line: idx + 1,
            pattern: String(pattern),
            text: line.trim().slice(0, 140),
          });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('\nCat21 architecture guard: commit blocked.\n');
  console.error('Browser-side code may not reference cat21_* RPC names or');
  console.error('the internal Cat21RpcService. See CLAUDE.md HARD RULE #6.\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.pattern}`);
    console.error(`    ${v.text}`);
  }
  console.error('');
  process.exit(1);
}
