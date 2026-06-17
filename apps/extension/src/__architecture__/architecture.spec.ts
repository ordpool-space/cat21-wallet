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
  it('acceptOffer body passes [0] (not "all") as the inputIndexes to both signers', () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
    const match = src.match(/async acceptOffer\([^)]*\)[^{]*\{([\s\S]*?)\n {2}\}\n/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/signWithConfirmation\([^)]*,\s*\[0\]\s*\)/);
    expect(body).toMatch(/signSilently\([^)]*\[0\]\s*\)/);
    // Strong negative: acceptOffer must NOT pass 'all' anywhere.
    const allOccurrences = body.match(/'all'/g) ?? [];
    expect(allOccurrences.length).toBe(0);
  });

  it("mint and transfer pass 'all' (self-built PSBTs; every input is wallet-owned)", () => {
    const src = read(join(EXTENSION_ROOT, 'src/background/cat21/cat21-rpc.service.ts'));
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
    // This is the second half of Round-2 audit Finding 6: the SDK's
    // policy gate `kind` union must be the identity-function of the
    // wallet's RPC method names. Round-1 closed this; the assertion
    // here pins it so a future SDK rename (e.g. back to 'mint' / 'buy'
    // / 'sell-accept') goes red on the wallet side.
    const src = read(join(REPO_ROOT, '../ordpool-sdk/src/agent-mode/agent-policy.types.ts'));
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
