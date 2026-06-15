/**
 * Architectural fitness specs.
 *
 * These tests pin the HARD RULES from `CLAUDE.md` as executable checks
 * against the source tree. They protect against architectural drift more
 * reliably than a human reviewer can — if a future commit violates the
 * boundary between Path 1 (Leather-compatible browser surface) and
 * Path 2/3 (internal `Cat21RpcService`), one of these specs goes red.
 *
 * The rules tested here mirror the wallet's `CLAUDE.md` numbered HARD
 * RULES. When a rule changes, the spec changes too — together, in the
 * same commit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '../../../../..');
const EXTENSION_ROOT = join(REPO_ROOT, 'apps/extension');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Zero-dependency recursive file walker. Reaches into all subdirectories
 * under `roots`, returns files matching one of the `extensions`, skips
 * common build/dep folders. Kept inline to avoid pulling fast-glob into
 * the extension's test runtime.
 */
function findFiles(roots: string[], extensions: string[]): string[] {
  const SKIP_DIRS = new Set(['node_modules', 'dist', '.cache', 'RESCUE']);
  const out: string[] = [];
  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(full);
      else if (extensions.some(ext => name.endsWith(ext)) && !name.endsWith('.snap')) {
        out.push(full);
      }
    }
  }
  for (const r of roots) walk(r);
  return out;
}

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];

describe('HARD RULE #6 — browser surface is Leather, cat21_* is internal-only', () => {

  it('browser RPC registry contains exactly the Leather-compatible methods', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/messaging/rpc-message-handler.ts'));

    // Each registered handler is one `registerRpcRequestHandler(...xxxHandler);` line.
    const registered = Array.from(
      src.matchAll(/^registerRpcRequestHandler\(\.\.\.(\w+)Handler\);$/gm),
      m => m[1]
    );

    expect(registered.sort()).toEqual([
      'getAddresses',
      'open',
      'openSwap',
      'sendTransfer',
      'signMessage',
      'signPsbt',
      'supportedMethods',
    ]);
  });

  it('browser RPC registry registers NO cat21_* method', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/messaging/rpc-message-handler.ts'));
    // Match active (non-comment) handler registrations.
    const activeLines = src
      .split('\n')
      .filter(l => /^registerRpcRequestHandler\(/.test(l));
    for (const line of activeLines) {
      expect(line).not.toMatch(/cat21_/i);
    }
  });

  const BROWSER_SURFACE_ROOTS = [
    join(EXTENSION_ROOT, 'src/inpage'),
    join(EXTENSION_ROOT, 'src/content-scripts'),
    join(REPO_ROOT, 'packages/provider/src'),
  ];

  it('browser-side code does not reference cat21_* method names', () => {
    const files = findFiles(BROWSER_SURFACE_ROOTS, SOURCE_EXTS);
    for (const file of files) {
      const src = read(file);
      const hits = src.match(/cat21_(mint|transfer|create_offer|accept_offer)/g);
      expect({ file: relative(REPO_ROOT, file), hits }).toEqual({
        file: relative(REPO_ROOT, file),
        hits: null,
      });
    }
  });

  it('browser-side code does not import the internal Cat21RpcService', () => {
    const files = findFiles(BROWSER_SURFACE_ROOTS, SOURCE_EXTS);
    for (const file of files) {
      const src = read(file);
      expect({ file: relative(REPO_ROOT, file), match: src.includes('Cat21RpcService') }).toEqual({
        file: relative(REPO_ROOT, file),
        match: false,
      });
      expect({ file: relative(REPO_ROOT, file), match: src.includes('cat21-rpc.service') }).toEqual({
        file: relative(REPO_ROOT, file),
        match: false,
      });
    }
  });
});

describe('HARD RULE #1 — nLockTime=21 cannot be silently dropped', () => {

  it('the increase-fee hook copies the original locktime onto the replacement tx', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts'
      )
    );
    // `new btc.Transaction({ lockTime: payload.tx.locktime })` is the hard invariant.
    expect(src).toMatch(/new btc\.Transaction\(\s*\{\s*lockTime:\s*payload\.tx\.locktime\s*\}/);
    // And the post-build assert refusing to sign on mismatch.
    expect(src).toMatch(/newTx\.lockTime\s*!==\s*payload\.tx\.locktime/);
  });

  it('the increase-fee hook clamps the bumped sequence so locktime stays enforced', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/app/features/dialogs/transaction-action-dialog/hooks/use-btc-increase-fee.ts'
      )
    );
    // Math.min(..., 0xfffffffe) — the value matters: 0xffffffff disables locktime.
    expect(src).toMatch(/Math\.min\([^,]+,\s*0xfffffffe\)/);
  });
});

describe('HARD RULE #1 (extended) — mint-builder pins lockTime=21 + sequence 0xfffffffd', () => {

  it('mint-builder declares the CAT-21 lockTime constant as exactly 21', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/mint-builder.ts'
      )
    );
    expect(src).toMatch(/export const CAT21_LOCK_TIME\s*=\s*21\s*;/);
  });

  it('mint-builder declares the cat21wallet input sequence as exactly 0xfffffffd', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/mint-builder.ts'
      )
    );
    expect(src).toMatch(/export const CAT21_WALLET_MINT_INPUT_SEQUENCE\s*=\s*0xfffffffd\s*;/);
  });

  it('mint-builder constructs the transaction with lockTime=CAT21_LOCK_TIME', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/mint-builder.ts'
      )
    );
    expect(src).toMatch(/new btc\.Transaction\(\s*\{\s*lockTime:\s*CAT21_LOCK_TIME/);
  });

  it('mint-builder asserts both invariants before return', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/mint-builder.ts'
      )
    );
    expect(src).toMatch(/tx\.lockTime\s*!==\s*CAT21_LOCK_TIME/);
    expect(src).toMatch(/input\.sequence\s*!==\s*CAT21_WALLET_MINT_INPUT_SEQUENCE/);
  });
});

describe('HARD RULE — acceptOffer signs ONLY input 0 (the seller cat input)', () => {

  it('acceptOffer body passes [0] (not "all") as the inputIndexes to both signers', () => {
    const src = read(
      join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts')
    );
    const match = src.match(/async acceptOffer\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/signWithConfirmation\([^)]*,\s*\[0\]\s*\)/);
    expect(body).toMatch(/signSilently\([^)]*\[0\]\s*\)/);
    // Strong negative: acceptOffer must NOT pass 'all' anywhere.
    const allOccurrences = body.match(/'all'/g) ?? [];
    expect(allOccurrences.length).toBe(0);
  });

  it('mint and transfer pass \'all\' (self-built PSBTs; every input is wallet-owned)', () => {
    const src = read(
      join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts')
    );
    const mintMatch = src.match(/async mint\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    const transferMatch = src.match(/async transfer\([\s\S]*?\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(mintMatch).not.toBeNull();
    expect(transferMatch).not.toBeNull();
    expect(mintMatch![1]).toMatch(/signWithConfirmation\([^)]*,\s*'all'\s*\)/);
    expect(mintMatch![1]).toMatch(/signSilently\([^)]*'all'\s*\)/);
    expect(transferMatch![1]).toMatch(/signWithConfirmation\([^)]*,\s*'all'\s*\)/);
    expect(transferMatch![1]).toMatch(/signSilently\([^)]*'all'\s*\)/);
  });

  it('Cat21RpcDeps signWithConfirmation + signSilently carry an inputIndexes parameter', () => {
    const src = read(
      join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts')
    );
    expect(src).toMatch(/signWithConfirmation\s*\([\s\S]*?inputIndexes:\s*'all'\s*\|\s*number\[\]/);
    expect(src).toMatch(/signSilently\s*\([\s\S]*?inputIndexes:\s*'all'\s*\|\s*number\[\]/);
  });
});

describe('HARD RULE — createOffer never builds a tx, never broadcasts, never signs', () => {

  it('Cat21RpcService.createOffer body does NOT call broadcast, signSilently, or signWithConfirmation', () => {
    const src = read(
      join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts')
    );
    const match = src.match(/async createOffer\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).not.toMatch(/this\.deps\.broadcast\s*\(/);
    expect(body).not.toMatch(/this\.deps\.signSilently\s*\(/);
    expect(body).not.toMatch(/this\.deps\.signWithConfirmation\s*\(/);
    expect(body).not.toMatch(/this\.deps\.recordSpend\s*\(/);
  });

  it('listing-builder source contains no PSBT construction primitives', () => {
    const src = read(
      join(EXTENSION_ROOT, 'src/background/cat21/builders/listing-builder.ts')
    );
    expect(src).not.toMatch(/btc\./); // No @scure/btc-signer use.
    expect(src).not.toMatch(/Transaction/);
    expect(src).not.toMatch(/toPSBT/);
    expect(src).not.toMatch(/addInput|addOutput/);
  });
});

describe('HARD RULE #1 (transfer-builder) — transfers carry lockTime=21 + sequence 0xfffffffd', () => {

  it('transfer-builder constructs the Transaction with lockTime=CAT21_LOCK_TIME', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/transfer-builder.ts'
      )
    );
    expect(src).toMatch(/new btc\.Transaction\(\s*\{\s*lockTime:\s*CAT21_LOCK_TIME/);
  });

  it('transfer-builder uses the cat21wallet input sequence on every input', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/transfer-builder.ts'
      )
    );
    expect(src).toMatch(/sequence:\s*CAT21_WALLET_MINT_INPUT_SEQUENCE/);
  });

  it('transfer-builder asserts lockTime + sequence + SIGHASH_ALL before return', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/background/cat21/builders/transfer-builder.ts'
      )
    );
    expect(src).toMatch(/tx\.lockTime\s*!==\s*CAT21_LOCK_TIME/);
    expect(src).toMatch(/input\.sequence\s*!==\s*CAT21_WALLET_MINT_INPUT_SEQUENCE/);
    expect(src).toMatch(/input\.sighashType\s*!==\s*btc\.SigHash\.ALL/);
  });
});

describe('HARD RULE #2 — cat-bearing UTXOs are never picked by BTC coin selection', () => {

  it('utxos.service folds the protected bucket into unspendable downstream', () => {
    // The protected bucket exists in UtxoTotals and gets populated when
    // cat-bearing UTXOs are detected. Downstream balance code adds it
    // to `unspendable` so coin selection never sees those UTXOs.
    const utxosService = read(
      join(REPO_ROOT, 'packages/services/src/utxos/utxos.service.ts')
    );
    expect(utxosService).toMatch(/protected/);
    expect(utxosService).toMatch(/fetchCatBearingUtxoIds/);

    const balances = read(
      join(REPO_ROOT, 'packages/services/src/balances/btc-balances.service.ts')
    );
    expect(balances).toMatch(
      /sumUtxoValues\(\s*\[\s*\.\.\.utxos\.unspendable\s*,\s*\.\.\.utxos\.protected\s*\]/
    );
  });
});

describe('HARD RULE #5 — comments in upstream files stay; HACK markers carve out our edits', () => {

  it('every modification to upstream files is annotated with a HACK -- Cat21 marker', () => {
    // Sample of files we touched: the comment marker must appear.
    const touchedFiles = [
      'apps/extension/src/background/messaging/rpc-message-handler.ts',
      'apps/extension/src/app/routes/app-routes.tsx',
      'apps/extension/scripts/generate-manifest.js',
      'packages/provider/src/index.ts',
      'packages/services/src/utxos/utxos.service.ts',
    ];
    for (const rel of touchedFiles) {
      const src = read(join(REPO_ROOT, rel));
      expect({ file: rel, hasHackMarker: /HACK\s*--\s*Cat21/i.test(src) }).toEqual({
        file: rel,
        hasHackMarker: true,
      });
    }
  });
});

describe('CLAUDE.md still pins the rules these specs encode', () => {

  it('lists every HARD RULE referenced by these specs', () => {
    const claude = read(join(REPO_ROOT, 'CLAUDE.md'));
    for (let i = 1; i <= 9; i++) {
      expect(claude).toMatch(new RegExp(`HARD RULE #${i}:`));
    }
  });

  it('records the Cat21 RPC method names verbatim', () => {
    const claude = read(join(REPO_ROOT, 'CLAUDE.md'));
    expect(claude).toMatch(/cat21_mint/);
    expect(claude).toMatch(/cat21_transfer/);
    expect(claude).toMatch(/cat21_create_offer/);
    expect(claude).toMatch(/cat21_accept_offer/);
  });
});
