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
    const activeLines = src.split('\n').filter(l => /^registerRpcRequestHandler\(/.test(l));
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
      expect({ file: relative(REPO_ROOT, file), match: src.includes('cat21-rpc.service') }).toEqual(
        {
          file: relative(REPO_ROOT, file),
          match: false,
        }
      );
    }
  });

  // The in-wallet Bazaar client (Path 2 sell-from-UI) is popup-only.
  // Neither the background service worker, the content scripts, the
  // inpage provider, nor the provider package may import it: publishing
  // a listing is a user-facing UI action gated by the sell form, not a
  // background/dapp capability. Path 3 (MCP agents) forwards the listing
  // payload itself via cat21_create_offer — it never touches this client.
  const NON_UI_ROOTS = [
    join(EXTENSION_ROOT, 'src/background'),
    join(EXTENSION_ROOT, 'src/inpage'),
    join(EXTENSION_ROOT, 'src/content-scripts'),
    join(REPO_ROOT, 'packages/provider/src'),
  ];

  it('non-UI code does not import the Bazaar client or session helpers', () => {
    const files = findFiles(NON_UI_ROOTS, SOURCE_EXTS);
    for (const file of files) {
      const src = read(file);
      const hit = src.includes('cat21-bazaar') || src.includes('cat21-session');
      expect({ file: relative(REPO_ROOT, file), importsBazaar: hit }).toEqual({
        file: relative(REPO_ROOT, file),
        importsBazaar: false,
      });
    }
  });

  it('the Bazaar POST targets backend2.cat21.space and that host is in the manifest', () => {
    const client = read(join(EXTENSION_ROOT, 'src/app/common/cat21-bazaar/cat21-bazaar.types.ts'));
    expect(client).toContain("'https://backend2.cat21.space'");
    const manifest = read(join(EXTENSION_ROOT, 'scripts/generate-manifest.js'));
    expect(manifest).toContain("'https://backend2.cat21.space/*'");
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

describe('HARD RULE — mint logic lives in the SDK, not inline in the wallet', () => {
  it('the wallet has NO inline mint-builder file (deleted; SDK is authority)', () => {
    expect(() =>
      read(join(EXTENSION_ROOT, 'src/background/cat21/builders/mint-builder.ts'))
    ).toThrow();
  });

  it('Cat21RpcService imports buildCat21MintPsbt from ordpool-sdk/core', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/buildCat21MintPsbt[\s\S]{0,300}from\s+['"]ordpool-sdk\/core['"]/);
  });

  it('Cat21RpcService.mint body calls the SDK helper (not a local function)', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    const match = src.match(/async mint\([\s\S]*?\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/buildCat21MintPsbt\(/);
  });

  it('Cat21RpcService.mint passes walletType=KnownOrdinalWalletType.cat21wallet', () => {
    // The cat21wallet path uses 0xfffffffd sequence in the SDK helper. If
    // a future refactor accidentally drops the walletType arg, the SDK
    // defaults to the non-cat21wallet path (0xfffffffe) and the 2024
    // Xverse-style breakage returns. Pin it positively here.
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    // At least two occurrences: mint + transfer.
    const matches = src.match(/walletType:\s*KnownOrdinalWalletType\.cat21wallet/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('HARD RULE — acceptOffer signs ONLY input 0 (the seller cat input)', () => {
  // Each rpc method declares its `inputIndexes` choice in its call to
  // the shared `signAndBroadcast` helper; the helper threads that
  // verbatim into `signWithConfirmation` / `signSilently`. The pins
  // below check BOTH layers — the per-method declaration AND the
  // helper's pass-through — so a refactor cannot accidentally
  // decouple them.

  it('acceptOffer body declares inputIndexes: [0] (not "all")', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    const match = src.match(/async acceptOffer\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/inputIndexes:\s*\[0\]/);
    // Strong negative: acceptOffer must NOT pass 'all' anywhere.
    const allOccurrences = body.match(/'all'/g) ?? [];
    expect(allOccurrences.length).toBe(0);
  });

  it("mint and transfer declare inputIndexes: 'all' (self-built PSBTs; every input is wallet-owned)", () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    const mintMatch = src.match(/async mint\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    const transferMatch = src.match(/async transfer\([\s\S]*?\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(mintMatch).not.toBeNull();
    expect(transferMatch).not.toBeNull();
    expect(mintMatch![1]).toMatch(/inputIndexes:\s*'all'/);
    expect(transferMatch![1]).toMatch(/inputIndexes:\s*'all'/);
  });

  it('signAndBroadcast threads inputIndexes verbatim into both signers', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/signWithConfirmation\([^)]*,\s*args\.inputIndexes\s*\)/);
    expect(src).toMatch(/signSilently\([^)]*args\.inputIndexes\s*\)/);
  });

  it('Cat21RpcDeps signWithConfirmation + signSilently carry an inputIndexes parameter', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/signWithConfirmation\s*\([\s\S]*?inputIndexes:\s*'all'\s*\|\s*number\[\]/);
    expect(src).toMatch(/signSilently\s*\([\s\S]*?inputIndexes:\s*'all'\s*\|\s*number\[\]/);
  });
});

describe('HARD RULE — createOffer never builds a tx, never broadcasts, never signs', () => {
  it('Cat21RpcService.createOffer body does NOT call broadcast, signSilently, or signWithConfirmation', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    const match = src.match(/async createOffer\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).not.toMatch(/this\.deps\.broadcast\s*\(/);
    expect(body).not.toMatch(/this\.deps\.signSilently\s*\(/);
    expect(body).not.toMatch(/this\.deps\.signWithConfirmation\s*\(/);
    expect(body).not.toMatch(/this\.deps\.recordSpend\s*\(/);
  });

  it('listing-builder source contains no PSBT construction primitives', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/builders/listing-builder.ts'));
    expect(src).not.toMatch(/btc\./); // No @scure/btc-signer use.
    expect(src).not.toMatch(/Transaction/);
    expect(src).not.toMatch(/toPSBT/);
    expect(src).not.toMatch(/addInput|addOutput/);
  });
});

describe('HARD RULE — transfer logic lives in the SDK, not inline in the wallet', () => {
  it('the wallet has NO inline transfer-builder file (deleted; SDK is authority)', () => {
    expect(() =>
      read(join(EXTENSION_ROOT, 'src/background/cat21/builders/transfer-builder.ts'))
    ).toThrow();
  });

  it('Cat21RpcService imports buildCat21TransferPsbt from ordpool-sdk/core', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/buildCat21TransferPsbt[\s\S]{0,200}from\s+['"]ordpool-sdk\/core['"]/);
  });

  it('Cat21RpcService.transfer body calls the SDK helper (not a local function)', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    const match = src.match(/async transfer\([\s\S]*?\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/buildCat21TransferPsbt\(/);
  });

  it('Cat21RpcService.transfer passes walletType=KnownOrdinalWalletType.cat21wallet', () => {
    // The cat21wallet path uses 0xfffffffd sequence in the SDK helper. If
    // a future refactor accidentally drops the walletType arg, the SDK
    // defaults to the non-cat21wallet path (0xfffffffe), breaking our
    // own RBF flow. Pin it positively here.
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/walletType:\s*KnownOrdinalWalletType\.cat21wallet/);
  });
});

describe('HARD RULE — every wallet SDK import comes from ordpool-sdk/core, not bare ordpool-sdk', () => {
  it('no source file imports from bare "ordpool-sdk" (must use /core to avoid Angular pull-in)', () => {
    const files = findFiles([join(EXTENSION_ROOT, 'src')], SOURCE_EXTS);
    const offenders: string[] = [];
    for (const file of files) {
      const src = read(file);
      // Match real ES import/export forms only:
      //   import ... from 'ordpool-sdk'
      //   import 'ordpool-sdk'
      //   export ... from 'ordpool-sdk'
      // Each pattern requires the literal string at start-of-line (with
      // optional whitespace) so that the rule's own description text
      // inside this spec doesn't self-trip.
      const hasBareImport =
        /^\s*import[^'"]*['"]ordpool-sdk['"]/m.test(src) ||
        /^\s*export[^'"]*from\s+['"]ordpool-sdk['"]/m.test(src);
      if (hasBareImport) {
        offenders.push(relative(EXTENSION_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('HARD RULE — every cat21_* RPC method has a documented SDK / wallet handler binding', () => {
  // Round-2 audit Finding 6 asked the wallet-side architecture spec to
  // require that every name in KnownCat21RpcMethod has a matching SDK
  // module-level export. Concretely: when someone adds a fifth cat21_*
  // action, this spec goes red until they wire it through to either an
  // SDK helper or a documented wallet-local builder.
  //
  // The contract is hardcoded here as a table — the spec is the
  // source of truth for "what RPC methods exist + what each one is
  // bound to". A new method without a row fails the iteration; an old
  // method whose binding drifts (the imported SDK symbol disappears,
  // the wallet-local file is deleted) fails the per-row assertions.

  interface Cat21RpcMethodBinding {
    /** Wire-level method name (matches MCP tool name + chrome.runtime message type). */
    methodName: 'cat21_mint' | 'cat21_transfer' | 'cat21_create_offer' | 'cat21_accept_offer';
    /** Cat21RpcService method that handles it. */
    serviceMethod: 'mint' | 'transfer' | 'createOffer' | 'acceptOffer';
    /**
     * Either an SDK symbol the service imports from `ordpool-sdk/core`,
     * OR a path to a wallet-local builder file. SDK is preferred per the
     * "concentrate logic in the SDK" workspace rule; wallet-local is
     * acceptable when the SDK has no equivalent yet (currently:
     * listing-builder for create_offer, accept-offer-validator wrapper
     * for accept_offer which delegates to the SDK validator via the
     * Cat21RpcDeps.validateBuyOfferPsbt callback).
     */
    handlerBinding:
      | { kind: 'sdk-symbol'; symbol: string }
      | { kind: 'wallet-local-file'; relativePath: string }
      | { kind: 'dep-callback'; depName: string };
  }

  const KNOWN_CAT21_RPC_METHODS: Cat21RpcMethodBinding[] = [
    {
      methodName: 'cat21_mint',
      serviceMethod: 'mint',
      handlerBinding: { kind: 'sdk-symbol', symbol: 'buildCat21MintPsbt' },
    },
    {
      methodName: 'cat21_transfer',
      serviceMethod: 'transfer',
      handlerBinding: { kind: 'sdk-symbol', symbol: 'buildCat21TransferPsbt' },
    },
    {
      methodName: 'cat21_create_offer',
      serviceMethod: 'createOffer',
      // create_offer publishes a structured listing, NOT a PSBT. The
      // SDK's buildCat21BuyOfferPsbt is the BUYER-side builder (used
      // by cat21.space or any non-wallet buyer), not the seller-side
      // listing publisher we run here.
      handlerBinding: {
        kind: 'wallet-local-file',
        relativePath: 'src/background/cat21/builders/listing-builder.ts',
      },
    },
    {
      methodName: 'cat21_accept_offer',
      serviceMethod: 'acceptOffer',
      // accept-offer signs an inbound buyer-built PSBT. The validation
      // delegates to the SDK's validateCat21BuyOfferPsbt via the
      // Cat21RpcDeps.validateBuyOfferPsbt callback (so the wallet
      // stays untyped against ordpool-sdk's exports here). The
      // wallet-local accept-offer-validator file wraps the call.
      handlerBinding: {
        kind: 'dep-callback',
        depName: 'validateBuyOfferPsbt',
      },
    },
  ];

  it('the table covers all four wallet RPC methods (no more, no less)', () => {
    const names = KNOWN_CAT21_RPC_METHODS.map(m => m.methodName).sort();
    expect(names).toEqual([
      'cat21_accept_offer',
      'cat21_create_offer',
      'cat21_mint',
      'cat21_transfer',
    ]);
  });

  it.each(KNOWN_CAT21_RPC_METHODS)(
    'Cat21RpcService implements the $serviceMethod method for $methodName',
    binding => {
      const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
      // Allow the method to be async (which it is for all four today)
      // OR sync (so a future contributor doesn't break the spec on a
      // stylistic refactor).
      const methodRegex = new RegExp(`\\b(async\\s+)?${binding.serviceMethod}\\s*\\(`);
      expect(src).toMatch(methodRegex);
    }
  );

  it.each(KNOWN_CAT21_RPC_METHODS)(
    '$methodName binding is wired ($handlerBinding.kind)',
    binding => {
      if (binding.handlerBinding.kind === 'sdk-symbol') {
        // SDK-symbol bindings: the service imports the symbol from
        // 'ordpool-sdk/core' AND the corresponding service method body
        // references it.
        const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
        const sym = binding.handlerBinding.symbol;
        // Import statement contains the symbol and resolves through
        // 'ordpool-sdk/core'.
        expect(src).toMatch(new RegExp(`${sym}[\\s\\S]{0,400}from\\s+['"]ordpool-sdk/core['"]`));
        // The corresponding method body actually calls it.
        const methodMatch = src.match(
          new RegExp(
            `\\b(?:async\\s+)?${binding.serviceMethod}\\([\\s\\S]*?\\)[^{]*\\{([\\s\\S]*?)\\n {2}\\}\\n`
          )
        );
        expect(methodMatch).not.toBeNull();
        expect(methodMatch![1]).toMatch(new RegExp(`${sym}\\(`));
      } else if (binding.handlerBinding.kind === 'wallet-local-file') {
        // Wallet-local-file bindings: the named file must exist.
        const path = join(EXTENSION_ROOT, binding.handlerBinding.relativePath);
        expect(() => read(path)).not.toThrow();
      } else {
        // Dep-callback bindings: the Cat21RpcDeps interface MUST declare
        // the callback, and the service method body MUST call it through
        // `this.deps.<depName>(`.
        const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
        const dep = binding.handlerBinding.depName;
        // Interface declaration.
        expect(src).toMatch(new RegExp(`${dep}\\s*\\(`));
        // Method body call site.
        const methodMatch = src.match(
          new RegExp(
            `\\b(?:async\\s+)?${binding.serviceMethod}\\([\\s\\S]*?\\)[^{]*\\{([\\s\\S]*?)\\n {2}\\}\\n`
          )
        );
        expect(methodMatch).not.toBeNull();
        // Allow either direct dep usage or wrapper helper that uses it.
        const accessesDep =
          new RegExp(`this\\.deps\\.${dep}\\b`).test(methodMatch![1]) ||
          new RegExp(`${dep}\\b`).test(methodMatch![1]);
        expect(accessesDep).toBe(true);
      }
    }
  );

  it('AgentActionKind on the SDK side uses the literal four wallet RPC names', () => {
    // Pins that the SDK's policy gate `kind` union is the identity
    // function of the wallet's RPC method names. A future SDK rename
    // (e.g. back to 'mint' / 'sell-accept') turns this red.
    //
    // Reads the SHA-pinned SDK from `node_modules/ordpool-sdk/dist-core/`
    // (.d.ts is shipped in the tarball; safe to read at test time).
    // The pre-SHA-pin path `../ordpool-sdk/src/agent-mode/agent-policy.types.ts`
    // would only work on a maintainer's disk; CI doesn't have the
    // sibling-repo clone.
    const src = read(
      join(EXTENSION_ROOT, 'node_modules/ordpool-sdk/dist-core/agent-mode/agent-policy.types.d.ts')
    );
    expect(src).toMatch(/'cat21_mint'/);
    expect(src).toMatch(/'cat21_transfer'/);
    expect(src).toMatch(/'cat21_create_offer'/);
    expect(src).toMatch(/'cat21_accept_offer'/);
    // Negative: the old names are gone.
    expect(src).not.toMatch(/['"]sell-accept['"]/);
  });
});

describe('HARD RULE #2 — cat-bearing UTXOs are never picked by BTC coin selection', () => {
  it('utxos.service folds the protected bucket into unspendable downstream', () => {
    // The protected bucket exists in UtxoTotals and gets populated when
    // cat-bearing UTXOs are detected. Downstream balance code adds it
    // to `unspendable` so coin selection never sees those UTXOs.
    const utxosService = read(join(REPO_ROOT, 'packages/services/src/utxos/utxos.service.ts'));
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

describe('iter 10 — per-account agent-policy slice + dispatcher deps', () => {
  it('the agent-policy slice wires four reducers and the expected state shape', () => {
    // Pins the iter 10a contract: changing the slice shape — adding a
    // policy field, dropping a reducer, renaming a key — must visibly
    // touch this spec. The wizard / settings UI reads through the
    // slice; the dispatcher reads through the slice; downstream
    // refactors that desync the slice from its readers are caught
    // here before they hit users.
    const src = read(
      join(REPO_ROOT, 'apps/extension/src/app/store/agent-policy/agent-policy.slice.ts')
    );
    // The two state buckets keyed by accountId.
    expect(src).toMatch(/policies:\s*Record<string,\s*AgentPolicy>/);
    expect(src).toMatch(
      /spentToday:\s*Record<string,\s*\{\s*sats:\s*number;\s*dayKey:\s*string\s*\}>/
    );
    // The four reducers iter 10b + future settings UI rely on.
    expect(src).toMatch(/setPolicyForAccount/);
    expect(src).toMatch(/clearPolicyForAccount/);
    expect(src).toMatch(/incrementSpentToday/);
    expect(src).toMatch(/resetSpentTodayForAccount/);
  });

  it('the slice is registered in the root reducer under `agentPolicy`', () => {
    // The wallet's `RootState` shape carries `agentPolicy`. Without
    // this wire-up, `selectAgentPolicyForAccount` reads `undefined`
    // and the dispatcher refuses every autonomous call as
    // 'agent-disabled' — silent failure mode that this spec catches.
    const src = read(join(REPO_ROOT, 'apps/extension/src/app/store/index.ts'));
    expect(src).toMatch(/import\s+\{\s*agentPolicySlice\s*\}/);
    expect(src).toMatch(/agentPolicy:\s*ReturnType<typeof agentPolicySlice\.reducer>/);
    expect(src).toMatch(/agentPolicy:\s*agentPolicySlice\.reducer/);
  });

  it('the makeAgentPolicyDeps factory translates Cat21Intent → AgentActionContext', () => {
    // The mode resolver passes `Cat21Intent` to `evaluateAgentPolicy`.
    // The SDK's `evaluateAgentPolicy` consumes `AgentActionContext`.
    // The wallet's agent-policy-deps factory owns that translation —
    // any future change to either union shape must update the
    // translation OR this spec catches the desync.
    const src = read(join(REPO_ROOT, 'apps/extension/src/background/cat21/agent-policy-deps.ts'));
    // The four intent-kind branches in the translator.
    expect(src).toMatch(/case\s+'cat21_mint':/);
    expect(src).toMatch(/case\s+'cat21_transfer':/);
    expect(src).toMatch(/case\s+'cat21_create_offer':/);
    expect(src).toMatch(/case\s+'cat21_accept_offer':/);
    // The factory's three exposed deps (matches Cat21RpcDeps shape).
    expect(src).toMatch(/agentMode:\s*\{/);
    expect(src).toMatch(/evaluateAgentPolicy\(/);
    expect(src).toMatch(/recordSpend\(/);
  });

  it('accountIdToSliceKey formats with `<fingerprint>:<accountIndex>` (slice key contract)', () => {
    // The slice keys policies by string; the wallet's `useCurrentAccountId`
    // returns `{ fingerprint, accountIndex }`. `accountIdToSliceKey` is
    // the bridge — changing the format would silently invalidate every
    // stored policy at runtime (rehydrated keys no longer match newly-
    // computed ones). Pin the format here.
    const src = read(
      join(REPO_ROOT, 'apps/extension/src/app/store/agent-policy/agent-policy.hooks.ts')
    );
    expect(src).toMatch(/`\$\{accountId\.fingerprint\}:\$\{accountId\.accountIndex\}`/);
  });

  it('wireCat21Dispatcher composes the real agent-policy deps with wiring-pending sign/broadcast stubs', () => {
    // The dispatcher entrypoint factory. Until iter 11+ lands real
    // sign/broadcast, this is the structural pin: the agent-policy
    // half is wired through `makeAgentPolicyDeps` and only the
    // sign/broadcast deps fall through to `makeWiringPendingDeps`.
    // The moment a real `signWithConfirmation` lands, the
    // wiring-pending reference here disappears too — and we update
    // this assertion in the same commit.
    const src = read(
      join(REPO_ROOT, 'apps/extension/src/background/cat21/wire-cat21-dispatcher.ts')
    );
    expect(src).toMatch(/makeAgentPolicyDeps\s*\(/);
    expect(src).toMatch(/makeWiringPendingDeps\s*\(/);
    // Real deps: the three agent-policy keys come from agentPolicyDeps.
    expect(src).toMatch(/agentMode:\s*agentPolicyDeps\.agentMode/);
    expect(src).toMatch(/evaluateAgentPolicy:\s*agentPolicyDeps\.evaluateAgentPolicy/);
    expect(src).toMatch(/recordSpend:\s*agentPolicyDeps\.recordSpend/);
  });
});

describe('iter 11 — popup-side deps wire all 11 Cat21RpcDeps', () => {
  // The popup-side `useCat21RpcDeps` hook is the load-bearing wiring
  // for Path 2 (manual cat-flow in the wallet popup). Every dep on
  // the `Cat21RpcDeps` interface MUST be wired here to a real
  // hook / SDK call / Leather signer — never a `wiringPending` stub.
  //
  // The background-side `wireCat21Dispatcher` (Path 3 / NMH) still
  // has stubs for the keychain-dependent deps because the MV3
  // service worker can't reach the unlocked keychain directly;
  // Path 3's real wiring goes via `triggerRequestPopupWindowOpen`
  // which lands the autonomous call back in the popup — and the
  // popup runs THIS hook. So the structural pin is "the hook wires
  // everything," not "every entrypoint wires everything."

  const HOOK_PATH = 'apps/extension/src/app/pages/cat21-confirm/use-cat21-rpc-deps.ts';

  it('the hook does not import makeWiringPendingDeps', () => {
    const src = read(join(REPO_ROOT, HOOK_PATH));
    expect(src).not.toMatch(/makeWiringPendingDeps/);
  });

  it('every Cat21RpcDeps field has a wired implementation in the hook', () => {
    const src = read(join(REPO_ROOT, HOOK_PATH));
    const fields = [
      'getAccountContext',
      'agentMode',
      'evaluateAgentPolicy',
      'recordSpend',
      'validateBuyOfferPsbt',
      'broadcast',
      'pickFundingUtxo',
      'resolveCatUtxo',
      'confirmListingPublication',
      'signWithConfirmation',
      'signSilently',
    ];
    for (const f of fields) {
      // Each dep name appears as an object-literal key in the hook's
      // returned deps object. Pattern accepts `<f>:` (object key with
      // colon) and `<f>(` (method shorthand) — both forms are valid TS
      // for the deps interface.
      expect(src).toMatch(new RegExp(`(^|\\s)${f}\\s*[(:]`, 'm'));
    }
  });

  it('the hook routes signers through Leather`s useSignBitcoinTx', () => {
    // The keychain integration: both signWithConfirmation and
    // signSilently MUST go through Leather's existing
    // `useSignBitcoinTx()` (which dispatches Ledger vs software).
    // Bypassing this — for example by stuffing a raw private key in
    // — would break HARD RULE #10 (SDK does heavy lifting) AND
    // introduce a parallel signing path the extension team would
    // have to maintain forever.
    const src = read(join(REPO_ROOT, HOOK_PATH));
    expect(src).toMatch(/import\s+\{\s*useSignBitcoinTx\s*\}/);
    expect(src).toMatch(/const\s+signBitcoinTx\s*=\s*useSignBitcoinTx\(\)/);
  });

  it('the hook resolves cat UTXOs through cat21-ord (HARD RULE: cat21-ord is the sole authority)', () => {
    const src = read(join(REPO_ROOT, HOOK_PATH));
    expect(src).toMatch(/getCat21OrdApiClient/);
    expect(src).toMatch(/fetchCat21\(/);
    expect(src).toMatch(/CAT21_POSTAGE_SATS/);
  });

  it('the popup route only constructs Cat21RpcService — not Cat21Dispatcher (no double-dispatch)', () => {
    // Path 2's pipeline is `popup → useCat21RpcDeps → new
    // Cat21RpcService(deps).method(intent, 'popup')`. Re-introducing
    // `Cat21Dispatcher` here would route the message through the
    // background's NMH-shaped channel for no benefit and a worse
    // failure mode (round-trip latency, MV3 eviction, lost
    // chrome.runtime port).
    const src = read(
      join(REPO_ROOT, 'apps/extension/src/app/pages/cat21-confirm/cat21-confirm-route.tsx')
    );
    expect(src).toMatch(/new\s+Cat21RpcService\(/);
    expect(src).not.toMatch(/Cat21Dispatcher/);
  });
});

describe('iter 12 — Path 3 NMH bridge plumbing (popup-mediated MCP autonomous)', () => {
  // The architectural pivot iter 11 made was: the dispatcher runs IN
  // THE POPUP, not the background. Path 3 (NMH-driven) reaches the
  // popup via `triggerRequestPopupWindowOpen` with the intent stashed
  // in chrome.storage.session. These specs pin the structural pieces
  // so a future refactor can't accidentally route Path 3 back through
  // a background-resident keychain (which doesn't exist).

  const POPUP_BRIDGE = 'apps/extension/src/background/cat21/popup-bridge.ts';
  const NMH_RELAY = 'apps/extension/src/background/cat21/nmh-popup-relay.ts';
  const RESULT_BUS = 'apps/extension/src/background/cat21/cat21-result-bus.ts';
  const RELAY_ATTACH = 'apps/extension/src/background/cat21/attach-native-host-to-popup-relay.ts';

  it('popup-bridge uses chrome.storage.session (NOT chrome.storage.local) — PSBT bytes never persist to disk', () => {
    // The bridge stashes intents that can carry unsigned PSBT bytes.
    // Persisting those to disk via chrome.storage.local would leak
    // them across sessions; session storage is cleared at session
    // end. The pin: the module must only mention .session in its
    // JSDoc and the helper's body must take a `SessionStorageLike`
    // (the field-name carries the constraint).
    const src = read(join(REPO_ROOT, POPUP_BRIDGE));
    expect(src).toMatch(/SessionStorageLike/);
    expect(src).toMatch(/chrome\.storage\.session/);
    expect(src).not.toMatch(/chrome\.storage\.local/);
  });

  it('cat21RequestStorageKey is namespaced (`cat21-request-<id>`) — collision-safe with other wallet keys', () => {
    const src = read(join(REPO_ROOT, POPUP_BRIDGE));
    expect(src).toMatch(/`cat21-request-\$\{requestId\}`/);
  });

  it('relayNmhMessageThroughPopup clears storage in a finally — popup crash cannot leak intents', () => {
    const src = read(join(REPO_ROOT, NMH_RELAY));
    // Match `} finally {` (formatter-stable) followed by clear.
    expect(src).toMatch(/\}\s*finally\s*\{[\s\S]*?clearCat21Request/);
  });

  it('cat21-result-bus envelopes carry a `source: cat21-result-bus` tag', () => {
    // Without the source tag, any other chrome.runtime.sendMessage
    // traffic (Leather's finalize-psbt, etc.) with a matching
    // requestId could resolve the wrong promise. Pin the tag.
    const src = read(join(REPO_ROOT, RESULT_BUS));
    expect(src).toMatch(/CAT21_RESULT_BUS_SOURCE\s*=\s*'cat21-result-bus'/);
  });

  it('subscribeToCat21Result removes its listener after the matching envelope (no leak)', () => {
    const src = read(join(REPO_ROOT, RESULT_BUS));
    expect(src).toMatch(/onMessage\.removeListener\(listener\)/);
  });

  it('subscribeToCat21Result requires a sender-verifier and consults it before resolving (audit C2)', () => {
    // Without this check, any extension page or co-resident extension
    // that learns the requestId can inject a forged broadcast result.
    // The verifier closure (production wires `sender.id ===
    // chrome.runtime.id && sender.tab === undefined`) is the
    // load-bearing integrity check.
    const src = read(join(REPO_ROOT, RESULT_BUS));
    expect(src).toMatch(/verifySender:\s*\(sender:[^)]*\)\s*=>\s*boolean/);
    expect(src).toMatch(/if\s*\(!verifySender\(sender\)\)\s*return/);
  });

  it('background.ts wires the production sender verifier with chrome.runtime.id (audit C2)', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/background.ts'));
    expect(src).toMatch(
      /verifyResultBusSender:\s*sender\s*=>[\s\S]{0,200}chrome\.runtime\.id[\s\S]{0,200}sender\?\.tab\s*===\s*undefined/
    );
  });

  it('attachNativeHostToPopupRelay translates relay errors into typed broadcast-failed denials', () => {
    // The pin: the attach catches any throw and posts a denial with
    // `reason: 'broadcast-failed'` + `detail: 'relay-error: ...'`.
    // Without this the agent would hang on a popup-open failure
    // instead of learning the call failed.
    const src = read(join(REPO_ROOT, RELAY_ATTACH));
    expect(src).toMatch(/reason:\s*'broadcast-failed'/);
    expect(src).toMatch(/relay-error/);
  });

  it('Cat21ConfirmRoute reads the intent from URL (Path 3) AND location.state (Path 2)', () => {
    // Both reads exist; URL wins when present. This is the protocol
    // contract: Path 3's stash-and-open dance only works if the URL
    // path is honored over a stale location.state.
    const src = read(
      join(REPO_ROOT, 'apps/extension/src/app/pages/cat21-confirm/cat21-confirm-route.tsx')
    );
    expect(src).toMatch(/useCat21RequestFromUrl/);
    expect(src).toMatch(/location\.state/);
    // URL-wins comment OR direct ternary that picks the URL branch.
    expect(src).toMatch(/urlRequest\.status === 'ready'/);
  });

  it('Cat21ConfirmRoute posts result back via postCat21Result for Path 3 (no result-leak)', () => {
    const src = read(
      join(REPO_ROOT, 'apps/extension/src/app/pages/cat21-confirm/cat21-confirm-route.tsx')
    );
    expect(src).toMatch(/postCat21Result/);
  });
});

describe('iter 14 — NMH read-only probes route inline (no popup for orientation queries)', () => {
  // The three read-only probes (list_cats, wallet_status,
  // cat21_ord_status) carry no secret and change no chain state. They
  // must be answered inline by the background so an agent can orient
  // itself without bothering the user. The pin: the attach handler
  // checks `isReadOnlyProbeRequest` BEFORE `isNmhMutatingRequest`, so
  // a probe never lands in the popup-relay path.

  const RELAY_ATTACH = 'apps/extension/src/background/cat21/attach-native-host-to-popup-relay.ts';
  const PROBE_HANDLER = 'apps/extension/src/background/cat21/nmh-read-only-probes.ts';

  it('the attach routes read-only probes BEFORE the mutating predicate (probes never reach popup)', () => {
    const src = read(join(REPO_ROOT, RELAY_ATTACH));
    const roIdx = src.indexOf('isReadOnlyProbeRequest');
    const mutIdx = src.indexOf('isNmhMutatingRequest');
    expect(roIdx).toBeGreaterThan(0);
    expect(mutIdx).toBeGreaterThan(roIdx);
  });

  it('handleReadOnlyProbe has exhaustive switch (a new probe type without an arm trips TS, not runtime)', () => {
    const src = read(join(REPO_ROOT, PROBE_HANDLER));
    expect(src).toMatch(/const\s+exhaustive:\s*never\s*=\s*req\.type/);
  });

  it('the three probe branches each catch and encode errors inline on the payload', () => {
    // Pinned because "silent empty array" is a confusing failure
    // signal for an agent — an empty cats array could mean "no cats"
    // OR "cat21-ord offline". Encoding the error inline removes the
    // ambiguity.
    const src = read(join(REPO_ROOT, PROBE_HANDLER));
    // Three try/catch blocks (one per branch), each encoding `error`
    // on the payload.
    const tryCount = (src.match(/try\s*\{/g) ?? []).length;
    expect(tryCount).toBe(3);
    expect(src).toMatch(/payload:\s*\{\s*error:\s*errorMessage\(err\)\s*\}/);
    expect(src).toMatch(/reachable:\s*false,\s*error:\s*errorMessage\(err\)/);
  });
});

describe('iter 14e — NMH connection lifecycle (idempotent connect, backoff reconnect, install detection)', () => {
  // The connection harness is the foundation of Path 3 boot-time
  // wiring. Three structural pins prevent regressions:
  //
  //   - install-detection heuristic must STAY (without it, a
  //     missing host binary causes a tight-loop reconnect on
  //     every wallet boot)
  //   - successful-reconnect-resets-backoff must STAY (without it,
  //     a long-lived port that briefly disconnects punishes the
  //     user with growing reconnect delays for the rest of the
  //     wallet session)
  //   - the disconnect listener fires the FSM transition (the
  //     port's onDisconnect is what schedules reconnect, not a
  //     polling loop)

  const LIFECYCLE = 'apps/extension/src/background/cat21/nmh-connection-lifecycle.ts';

  it('install-detection heuristic gives up when port closes within installDetectionMs', () => {
    const src = read(join(REPO_ROOT, LIFECYCLE));
    expect(src).toMatch(/elapsed\s*<\s*installWindow/);
    expect(src).toMatch(/fsm\s*=\s*'gave-up'/);
    expect(src).toMatch(/onHostNotInstalled\?\.\(\)/);
  });

  it('successful connect resets backoffMs to initial (long-lived port heals the budget)', () => {
    const src = read(join(REPO_ROOT, LIFECYCLE));
    // After fsm flips to 'connected' the next line resets backoff.
    expect(src).toMatch(/fsm\s*=\s*'connected'[\s\S]{0,200}backoffMs\s*=\s*initial/);
  });

  it('reconnect scheduling uses setTimeoutFn (injectable) not setTimeout directly', () => {
    const src = read(join(REPO_ROOT, LIFECYCLE));
    // Pin the injectable test seam: the reconnect schedule reads
    // setTimeoutFn, not the global setTimeout — without this, specs
    // can't drive virtual time.
    expect(src).toMatch(/pendingReconnect\s*=\s*setTimeoutFn\(/);
  });
});

describe('iter 12g-prep — background-side wiring glue + state cache', () => {
  // Three modules round out everything iter 12g needs from
  // /background/cat21/. The pins below prevent silent drift:
  //
  //   - install-cat21-nmh-agent.ts must continue to call BOTH
  //     createNmhLifecycle AND attachNativeHostToPopupRelay (it's
  //     the glue that joins them; deleting either reference would
  //     mean a different glue function is being used somewhere)
  //   - background-probe-state.ts must filter chrome.storage
  //     events to areaName === 'local' (defence against
  //     accidentally consuming session-storage writes the popup
  //     does for cat21-request stashing)
  //   - the cache's DEFAULT_STATE must keep activeAccountAddress
  //     as undefined (boot-race contract with the probes)

  const INSTALL_AGENT = 'apps/extension/src/background/cat21/install-cat21-nmh-agent.ts';
  const PROBE_STATE = 'apps/extension/src/background/cat21/background-probe-state.ts';

  it('installCat21NmhAgent wires createNmhLifecycle + attachNativeHostToPopupRelay (joins iter 14e + iter 12c)', () => {
    const src = read(join(REPO_ROOT, INSTALL_AGENT));
    expect(src).toMatch(/createNmhLifecycle\s*\(/);
    expect(src).toMatch(/attachNativeHostToPopupRelay\s*\(/);
  });

  it('installCat21NmhAgent uses the pinned application name `space.cat21.wallet` (matches the NMH manifest)', () => {
    const src = read(join(REPO_ROOT, INSTALL_AGENT));
    expect(src).toMatch(/'space\.cat21\.wallet'/);
  });

  it('installCat21NmhAgent calls lifecycle.ensureConnected() at boot (not a passive factory)', () => {
    // Without the boot-time ensureConnected, the entrypoint could
    // call installCat21NmhAgent and silently have NO connectNative
    // port open — the agent surface would be live in source but
    // dead at runtime. Pin the boot call here.
    const src = read(join(REPO_ROOT, INSTALL_AGENT));
    expect(src).toMatch(/lifecycle\.ensureConnected\(\)/);
  });

  it('background-probe-state.ts filters chrome.storage events to local area (ignores session/sync)', () => {
    const src = read(join(REPO_ROOT, PROBE_STATE));
    expect(src).toMatch(/areaName\s*!==\s*'local'/);
  });

  it("DEFAULT_STATE keeps activeAccountAddress: undefined (boot-race contract with list_cats' empty fallback)", () => {
    const src = read(join(REPO_ROOT, PROBE_STATE));
    expect(src).toMatch(/DEFAULT_STATE[\s\S]{0,300}activeAccountAddress:\s*undefined/);
  });
});

describe('iter 13c — Mint page + home action wire', () => {
  // Without these pins a future refactor that drops the action
  // button or unregisters the route silently strands Path 2's
  // mint flow — the SDK gate + sign-and-broadcast pipeline stays
  // alive in source but unreachable from the wallet UI.

  it('RouteUrls registers Cat21Mint', () => {
    const src = read(join(EXTENSION_ROOT, 'src/shared/route-urls.ts'));
    expect(src).toMatch(/Cat21Mint\s*=\s*'\/cat21-mint'/);
  });

  it('app-routes.tsx registers the Cat21Mint route under AccountGate', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/routes/app-routes.tsx'));
    expect(src).toMatch(/path=\{RouteUrls\.Cat21Mint\}[\s\S]{0,200}Cat21MintPage/);
  });

  it('account-actions surfaces the Mint cat button (Path 2 entry)', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/app/pages/home/components/account-actions-current/account-actions.tsx'
      )
    );
    expect(src).toMatch(/data-testid="cat21-mint-home-button"/);
    expect(src).toMatch(/navigate\(RouteUrls\.Cat21Mint\)/);
  });

  it('mint page submit navigates to Cat21MintConfirm with intent in location.state', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/pages/cat21-mint/cat21-mint-page.tsx'));
    expect(src).toMatch(
      /navigate\(RouteUrls\.Cat21MintConfirm,\s*\{\s*state:\s*\{\s*intent:\s*result\.intent\s*\}\s*\}\)/
    );
  });
});

describe('iter 13de — Transfer + Create-Offer form pages', () => {
  // Mirror of iter-13c's wiring pins for the other two manual flows.

  it('RouteUrls registers Cat21Transfer and Cat21CreateOffer', () => {
    const src = read(join(EXTENSION_ROOT, 'src/shared/route-urls.ts'));
    expect(src).toMatch(/Cat21Transfer\s*=\s*'\/cat21-transfer'/);
    expect(src).toMatch(/Cat21CreateOffer\s*=\s*'\/cat21-create-offer'/);
  });

  it('app-routes.tsx mounts both pages under AccountGate', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/routes/app-routes.tsx'));
    expect(src).toMatch(/path=\{RouteUrls\.Cat21Transfer\}[\s\S]{0,200}Cat21TransferPage/);
    expect(src).toMatch(/path=\{RouteUrls\.Cat21CreateOffer\}[\s\S]{0,200}Cat21CreateOfferPage/);
  });

  it('Transfer page submit navigates to Cat21TransferConfirm with intent in location.state', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/pages/cat21-transfer/cat21-transfer-page.tsx'));
    expect(src).toMatch(
      /navigate\(RouteUrls\.Cat21TransferConfirm,\s*\{\s*state:\s*\{\s*intent:\s*result\.intent\s*\}\s*\}\)/
    );
  });

  it('Create-Offer page submit navigates to Cat21CreateOfferConfirm with intent in location.state', () => {
    const src = read(
      join(EXTENSION_ROOT, 'src/app/pages/cat21-create-offer/cat21-create-offer-page.tsx')
    );
    expect(src).toMatch(
      /navigate\(RouteUrls\.Cat21CreateOfferConfirm,\s*\{\s*state:\s*\{\s*intent:\s*result\.intent\s*\}\s*\}\)/
    );
  });

  it('Both pages read prefilledCatId from location.state for iter-13f deep-linking', () => {
    const transferSrc = read(
      join(EXTENSION_ROOT, 'src/app/pages/cat21-transfer/cat21-transfer-page.tsx')
    );
    const offerSrc = read(
      join(EXTENSION_ROOT, 'src/app/pages/cat21-create-offer/cat21-create-offer-page.tsx')
    );
    expect(transferSrc).toMatch(/prefilledCatId\??/);
    expect(offerSrc).toMatch(/prefilledCatId\??/);
  });
});

describe('iter 13f — My cats list page + per-cat action wire', () => {
  // Without this pin a future refactor that drops the per-cat
  // navigation calls leaves Transfer/Sell reachable only by direct
  // URL — the natural per-cat entry point disappears.

  const LIST = 'apps/extension/src/app/pages/cat21-list/cat21-list-page.tsx';

  it('RouteUrls registers Cat21List', () => {
    const src = read(join(EXTENSION_ROOT, 'src/shared/route-urls.ts'));
    expect(src).toMatch(/Cat21List\s*=\s*'\/cat21-list'/);
  });

  it('app-routes.tsx mounts the Cat21List page under AccountGate', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/routes/app-routes.tsx'));
    expect(src).toMatch(/path=\{RouteUrls\.Cat21List\}[\s\S]{0,200}Cat21ListPage/);
  });

  it('account-actions surfaces the My cats button', () => {
    const src = read(
      join(
        EXTENSION_ROOT,
        'src/app/pages/home/components/account-actions-current/account-actions.tsx'
      )
    );
    expect(src).toMatch(/data-testid="cat21-list-home-button"/);
    expect(src).toMatch(/navigate\(RouteUrls\.Cat21List\)/);
  });

  it('list page deep-links Transfer with prefilledCatId in location.state', () => {
    const src = read(join(REPO_ROOT, LIST));
    expect(src).toMatch(/navigate\(RouteUrls\.Cat21Transfer,[\s\S]{0,200}prefilledCatId:\s*catId/);
  });

  it('list page deep-links Create-Offer with prefilledCatId + prefilledPaymentAddress', () => {
    const src = read(join(REPO_ROOT, LIST));
    expect(src).toMatch(
      /navigate\(RouteUrls\.Cat21CreateOffer,[\s\S]{0,400}prefilledCatId:\s*catId/
    );
    expect(src).toMatch(/prefilledPaymentAddress:\s*paymentAddress/);
  });

  it('list page queries cat21-ord with the active account address', () => {
    const src = read(join(REPO_ROOT, LIST));
    expect(src).toMatch(/fetchAddressCat21s\(paymentAddress/);
    expect(src).toMatch(/enabled:\s*paymentAddress\s*!=\s*null/);
  });
});

describe('iter 13b — wizard form surfaces allowedOperations', () => {
  // Without this pin, a future refactor that drops the checkbox group
  // from the wizard form would leave allowedOperations settable only
  // via direct Redux mutation — the iter-16b end-to-end wire becomes
  // unreachable for non-engineer users.

  const WIZARD =
    'apps/extension/src/app/pages/cat21-agent-policy-wizard/cat21-agent-policy-wizard.tsx';
  const HELPER =
    'apps/extension/src/app/pages/cat21-agent-policy-wizard/cat21-agent-policy-wizard.helper.ts';

  it('wizard renders a checkbox per AGENT_OPERATION_KINDS entry', () => {
    const src = read(join(REPO_ROOT, WIZARD));
    expect(src).toMatch(/AGENT_OPERATION_KINDS\.map\(kind =>/);
    expect(src).toMatch(/name=\{`allowedOperations\.\$\{kind\}`\}/);
  });

  it('helper exposes AGENT_OPERATION_KINDS as the canonical four-kind list', () => {
    const src = read(join(REPO_ROOT, HELPER));
    // Accept either historical syntax: ReadonlyArray<AgentActionKind> or
    // the eslint-canonical `readonly AgentActionKind[]` (typescript-eslint's
    // array-type rule rejects the generic form).
    expect(src).toMatch(
      /AGENT_OPERATION_KINDS:\s*(?:ReadonlyArray<AgentActionKind>|readonly AgentActionKind\[\])/
    );
    expect(src).toMatch(/'cat21_mint'/);
    expect(src).toMatch(/'cat21_transfer'/);
    expect(src).toMatch(/'cat21_create_offer'/);
    expect(src).toMatch(/'cat21_accept_offer'/);
  });

  it('coerceAllowedOperations collapses all-checked / none-checked to undefined', () => {
    const src = read(join(REPO_ROOT, HELPER));
    // The collapse rule is the load-bearing UX: a settings page that
    // can leak "all four checked != permissive" creates confusing
    // behaviour where the gate rejects ops the UI shows as allowed.
    expect(src).toMatch(/length === 0 \|\| picked\.length === AGENT_OPERATION_KINDS\.length/);
  });
});

describe('audit C1 — telemetry stack is stubbed out (zero bytes ship)', () => {
  // PRIVACY-POLICY.md commits the wallet to zero telemetry. The
  // upstream Leather stack (Sentry + Mixpanel + LaunchDarkly) was
  // shipping balances + xpub-derived identifier + route history when
  // env vars were populated. The stubs replace every vendor SDK at
  // bundle time via webpack `resolve.alias` — the real packages
  // never reach the production bundle.

  it('webpack aliases @sentry/react and @sentry/browser to the local stub', () => {
    const src = read(join(EXTENSION_ROOT, 'webpack/webpack.config.base.js'));
    expect(src).toMatch(
      /'@sentry\/react\$':\s*path\.resolve\(['"]\.\/src\/shared\/telemetry-stubs\/sentry\.ts/
    );
    expect(src).toMatch(
      /'@sentry\/browser\$':\s*path\.resolve\(['"]\.\/src\/shared\/telemetry-stubs\/sentry\.ts/
    );
  });

  it('webpack aliases mixpanel-browser to the local stub', () => {
    const src = read(join(EXTENSION_ROOT, 'webpack/webpack.config.base.js'));
    expect(src).toMatch(
      /'mixpanel-browser\$':\s*path\.resolve\(['"]\.\/src\/shared\/telemetry-stubs\/mixpanel\.ts/
    );
  });

  it('webpack aliases launchdarkly-react-client-sdk to the local stub', () => {
    const src = read(join(EXTENSION_ROOT, 'webpack/webpack.config.base.js'));
    expect(src).toMatch(/'launchdarkly-react-client-sdk\$'/);
    expect(src).toMatch(/telemetry-stubs\/launchdarkly\.tsx/);
  });

  it('analytics.ts is a no-op shim (no real @sentry/* or mixpanel imports)', () => {
    const src = read(join(EXTENSION_ROOT, 'src/shared/utils/analytics.ts'));
    expect(src).not.toMatch(/from\s+['"]@sentry\//);
    expect(src).not.toMatch(/from\s+['"]mixpanel-browser['"]/);
  });

  it('feature-flags is a no-op shim (no real launchdarkly import)', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/features/feature-flags/index.tsx'));
    expect(src).not.toMatch(/from\s+['"]launchdarkly-react-client-sdk['"]/);
  });

  it('webpack.config.prod.js does NOT import @sentry/webpack-plugin (no source-map upload)', () => {
    const src = read(join(EXTENSION_ROOT, 'webpack/webpack.config.prod.js'));
    // The IMPORT must be gone; an explanatory HACK comment about the
    // historical block stays as a marker for the upstream sync.
    expect(src).not.toMatch(/^import\s.*sentryWebpackPlugin/m);
    expect(src).not.toMatch(/from\s+['"]@sentry\/webpack-plugin['"]/);
  });
});

describe('audit H1 — Path 3 autoconfirm gated on wallet-unlocked state', () => {
  // Without this gate, an AFK user (wallet unlocked earlier in
  // session, then walked away) could be silent-signed by an MCP
  // agent: the keychain still holds keys in memory, signBitcoinTx
  // proceeds. The lock guard refuses the autoconfirm before any
  // service call (and therefore before any keychain access).
  const ROUTE = 'apps/extension/src/app/pages/cat21-confirm/cat21-confirm-route.tsx';

  it('Cat21ConfirmRoute reads useHasActiveInMemoryWalletSecretKey', () => {
    const src = read(join(REPO_ROOT, ROUTE));
    expect(src).toMatch(/useHasActiveInMemoryWalletSecretKey\(\)/);
  });

  it('autoconfirm useEffect fail-closes with reason agent-disabled detail wallet-locked when locked', () => {
    const src = read(join(REPO_ROOT, ROUTE));
    expect(src).toMatch(
      /if\s*\(!isWalletUnlocked\)\s*\{[\s\S]{0,400}reason:\s*'agent-disabled'[\s\S]{0,100}detail:\s*'wallet-locked'/
    );
  });
});

describe('audit H4 — cat21-ord query cache keys are NOT persisted to disk', () => {
  // Without this filter the wallet writes a permanent on-disk log of
  // which BTC addresses the user has viewed and which cats live
  // there (cache key starts with the address). PRIVACY-POLICY claims
  // "nothing identifies users by address" — the
  // shouldDehydrateQuery predicate is where that promise lives.
  const PERSISTENCE = 'apps/extension/src/app/common/persistence.ts';

  it('persistQueryClient passes dehydrateOptions.shouldDehydrateQuery', () => {
    const src = read(join(REPO_ROOT, PERSISTENCE));
    expect(src).toMatch(/dehydrateOptions:\s*\{[\s\S]{0,200}shouldDehydrateQuery:/);
  });

  it('CAT21_PRIVACY_LEAK_KEY_PREFIXES lists cat21-ord-* (the primary address-shaped key)', () => {
    const src = read(join(REPO_ROOT, PERSISTENCE));
    expect(src).toMatch(/CAT21_PRIVACY_LEAK_KEY_PREFIXES[\s\S]{0,400}'cat21-ord-'/);
    expect(src).toMatch(/CAT21_PRIVACY_LEAK_KEY_PREFIXES[\s\S]{0,400}'http-cat21-ord-'/);
  });
});

describe('audit H2 — agentPolicy slice is persisted across MV3 suspend', () => {
  // Without this, `spentToday` resets to `{}` on every service-worker
  // wake; an agent could blow through the daily cap by triggering
  // worker idle. The persist whitelist is the single point that
  // determines what survives suspend.
  it('redux-persist whitelist includes agentPolicy', () => {
    const src = read(join(EXTENSION_ROOT, 'src/shared/storage/redux-persist.ts'));
    expect(src).toMatch(/whitelist:[\s\S]{0,800}'agentPolicy'/);
  });
});

describe('iter 13a — Settings menu surfaces the Cat21 Agent Mode entry', () => {
  // Without this pin, a future refactor that drops the settings link
  // would leave the wizard reachable only by typing the route URL —
  // the per-account policy (spend caps, fee ceiling, counterparty
  // allowlist, operation allowlist) becomes invisible to users.

  const MENU = 'apps/extension/src/app/pages/settings/menu-buttons.tsx';

  it('settings menu links to RouteUrls.Cat21AgentPolicy', () => {
    const src = read(join(REPO_ROOT, MENU));
    expect(src).toMatch(/navigate\(RouteUrls\.Cat21AgentPolicy\)/);
  });

  it('settings entry carries a stable data-testid for E2E hooks', () => {
    const src = read(join(REPO_ROOT, MENU));
    expect(src).toMatch(/data-testid="cat21-agent-mode-settings-button"/);
  });
});

describe('iter 12g — background.ts wires installCat21NmhAgent at boot', () => {
  // Without these pins, a future refactor that strips the boot call
  // from background.ts leaves Path 3 silently dead — the surface
  // exists in source but no connectNative port ever opens.

  const BACKGROUND = 'apps/extension/src/background/background.ts';

  it('background.ts calls installCat21NmhAgent (Path 3 boot wire)', () => {
    const src = read(join(REPO_ROOT, BACKGROUND));
    expect(src).toMatch(/installCat21NmhAgent\s*\(/);
  });

  it('background.ts bootstraps the probe-state cache before the install (cache.read returns DEFAULT_STATE until then)', () => {
    const src = read(join(REPO_ROOT, BACKGROUND));
    expect(src).toMatch(/makeBackgroundProbeStateCache\s*\(/);
    expect(src).toMatch(/cat21ProbeStateCache\.bootstrap\(\)/);
  });

  it('background.ts hands cat21OrdClient + cache into makeReadOnlyProbeWires', () => {
    const src = read(join(REPO_ROOT, BACKGROUND));
    expect(src).toMatch(/makeReadOnlyProbeWires\s*\(/);
    expect(src).toMatch(/cat21OrdClient:\s*getCat21OrdApiClient\(\)/);
  });

  it('background.ts uses triggerRequestPopupWindowOpen as the popup-open mechanism', () => {
    const src = read(join(REPO_ROOT, BACKGROUND));
    expect(src).toMatch(/triggerPopupOpen:\s*triggerRequestPopupWindowOpen/);
  });
});

describe('iter 16 — SDK validateCat21Operation is the single gate (no consumer-side invariants)', () => {
  // The wallet used to have an `invariants/` folder with four
  // per-flow gates and a `Validated<I>` brand. Both were deleted
  // when validateCat21Operation landed in ordpool-sdk. These pins
  // prevent a future commit from quietly bringing them back.

  it('the wallet has NO invariants/ folder (deleted; SDK gate is authority)', () => {
    expect(() =>
      read(join(EXTENSION_ROOT, 'src/background/cat21/invariants/mint-invariants.ts'))
    ).toThrow();
    expect(() =>
      read(join(EXTENSION_ROOT, 'src/background/cat21/invariants/transfer-invariants.ts'))
    ).toThrow();
    expect(() =>
      read(join(EXTENSION_ROOT, 'src/background/cat21/invariants/create-offer-invariants.ts'))
    ).toThrow();
    expect(() =>
      read(join(EXTENSION_ROOT, 'src/background/cat21/invariants/accept-offer-invariants.ts'))
    ).toThrow();
  });

  it('the wallet does not export a Validated<I> brand from types.ts', () => {
    // The phantom Validated<I> brand is gone; the discriminated-union
    // return type from validateCat21Operation IS the runtime witness
    // that the gate ran. A regression that re-adds the brand also
    // re-introduces the layer the gate replaced.
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/types.ts'));
    expect(src).not.toMatch(/export type Validated/);
    expect(src).not.toMatch(/ValidatedBrand/);
  });

  it('cat21-rpc.service.ts imports validateCat21Operation from ordpool-sdk/core', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/validateCat21Operation[\s\S]{0,400}from\s+['"]ordpool-sdk\/core['"]/);
  });

  it('all four Cat21RpcService methods invoke openPipeline before any other work', () => {
    // The contract pin: the SDK gate runs FIRST in every rpc method
    // body, via the shared `openPipeline` helper (which calls runGate
    // before resolving signing mode). A refactor that inlines or
    // skips validation breaks this regex.
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    for (const kind of ['mint', 'transfer', 'create_offer', 'accept_offer']) {
      expect(src).toMatch(new RegExp(`openPipeline\\(\\s*\\{\\s*kind:\\s*'${kind}'`));
    }
    // openPipeline itself must call runGate (no slip-around path).
    expect(src).toMatch(/runGate\(operation,/);
  });

  it('cat21-rpc.service.ts has no `enforce*Invariants` references (no fallback path)', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).not.toMatch(/enforce[A-Z]\w+Invariants/);
  });

  it('gateConfig wires ownPaymentAddress + cap defaults (no self-send + fee/price ceilings)', () => {
    // Pin the three pieces of wallet policy the gate config encodes.
    // Without these, an agent could silently mint to the wallet's own
    // change address, run the fee rate above congestion peaks, or
    // create an offer with a fat-finger 21000000000 sats price.
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/ownPaymentAddress:\s*accountCtx\.paymentAddress/);
    expect(src).toMatch(/maxFeeRatePerVbyte:\s*1000/);
    expect(src).toMatch(/maxPriceSats:\s*21_000_000_000/);
  });

  it('gateConfig forwards accountCtx.allowedOperations to the SDK gate when set', () => {
    // Pin the iter-16b wire: the per-account agent-policy's
    // operation-kind allowlist must reach the SDK structural gate.
    // Without this, a "mint only" agent policy would be silently
    // ineffective at the structural gate (the agent-policy
    // evaluator might also enforce, but the structural gate runs
    // first and gives the cleanest deny reason).
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    expect(src).toMatch(/allowedOperations:\s*accountCtx\.allowedOperations/);
  });

  it('use-cat21-rpc-deps reads allowedOperations from selectAgentPolicyForAccount and strips the cat21_ prefix', () => {
    const src = read(join(EXTENSION_ROOT, 'src/app/pages/cat21-confirm/use-cat21-rpc-deps.ts'));
    expect(src).toMatch(/selectAgentPolicyForAccount/);
    expect(src).toMatch(/stripCat21Prefix\(/);
    expect(src).toMatch(/'cat21_'\.length/);
  });
});

describe('iter 12g-prep3 — decodeWalletProbeState fail-closed contract', () => {
  // The decoder's whole purpose is to fail closed at every step:
  // missing slice, malformed JSON, wrong shape → return DEFAULT_STATE.
  // A future "make it strict" refactor would silently break the
  // agent's graceful-degradation contract. These specs pin the
  // structural shape that keeps the decoder defensive.

  const DECODER = 'apps/extension/src/background/cat21/decode-wallet-probe-state.ts';

  it('isRecord guard rejects arrays and null before dereferencing slice fields', () => {
    // Without `!Array.isArray(value)` the decoder would happily treat
    // a top-level array as an object; without `value !== null` it
    // would crash on `outer.networks` for a JSON `null` envelope.
    const src = read(join(REPO_ROOT, DECODER));
    expect(src).toMatch(/value\s*!==\s*null/);
    expect(src).toMatch(/!Array\.isArray\(value\)/);
  });

  it('parseInnerJson catches throws so a malformed slice cannot crash the whole decode', () => {
    // The slice payloads are JSON-in-JSON. Without the catch, one
    // bad slice (e.g. networks: 'malformed{') would propagate and
    // the agent would see "could not read request from storage"
    // instead of DEFAULT_STATE.
    const src = read(join(REPO_ROOT, DECODER));
    expect(src).toMatch(
      /function\s+parseInnerJson\([\s\S]{0,300}try\s*\{[\s\S]{0,200}\}\s*catch\s*\{/
    );
  });

  it('activeAccountAddress is unconditionally returned as undefined (popup-tied derivation)', () => {
    // Pinning this prevents a well-meaning future commit from
    // accidentally returning '' or a default address — the probe
    // contract relies on undefined to skip the cat21-ord query.
    const src = read(join(REPO_ROOT, DECODER));
    expect(src).toMatch(/activeAccountAddress:\s*undefined/);
  });

  it('network normalisation is binary mainnet-vs-everything-else (regtest, signet, etc. fold to testnet)', () => {
    const src = read(join(REPO_ROOT, DECODER));
    expect(src).toMatch(/id\s*===\s*'mainnet'\s*\?\s*'mainnet'\s*:\s*'testnet'/);
  });
});

describe('CLAUDE.md still pins the rules these specs encode', () => {
  it('lists every HARD RULE referenced by these specs', () => {
    const claude = read(join(REPO_ROOT, 'CLAUDE.md'));
    for (let i = 1; i <= 10; i++) {
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
