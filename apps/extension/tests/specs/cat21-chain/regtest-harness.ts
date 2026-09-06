import { execFileSync } from 'node:child_process';

import { type BrowserContext, type Page, expect } from '@playwright/test';

import { getTestSoftwareAccountDefaultWalletState } from '@tests/page-object-models/onboarding.page';

/**
 * Chain-truth harness for the cat21-wallet real-button E2E suite.
 *
 * The wallet is driven through its OWN popup UI (Path 2) against a live
 * regtest chain: bitcoind mines and funds, electrs serves the Esplora API
 * the wallet's Bitcoin client speaks, and cat21-ord (--index-cat21) is the
 * indexer we assert against. Nothing is mocked below the button click —
 * the wallet builds, signs, and broadcasts a real transaction.
 *
 * Stack (from ordpool-sdk/e2e/docker-compose.regtest.yml):
 *   ordpool-e2e-bitcoind  RPC :18443 (user/pass ordpool/ordpool)
 *   ordpool-e2e-electrs   Esplora HTTP :3000
 *   ordpool-e2e-cat21-ord ord HTTP :8080  (cat-only index)
 *
 * How the wallet reaches regtest:
 *   - We switch its `currentNetworkId` to the built-in `sbtcDevenv` config
 *     (mode='regtest', bitcoinUrl='http://localhost:3000/api/proxy'). That
 *     makes the keychain derive bcrt addresses AND makes the UTXO/broadcast
 *     clients resolve a real base URL. (The bare `regtest` built-in is NOT
 *     usable here: `getMempoolUrlFromUserSettings` returns its base URL only
 *     for custom networks / sbtcTestnet / sbtcDevenv, so `regtest` yields a
 *     `null` base and the UTXO fetch silently produces nothing.)
 *   - Every wallet Bitcoin request is `http://localhost:3000/api/proxy/...`;
 *     interception strips `/api/proxy` and forwards to electrs at :3000
 *     (identical Esplora path shapes: /address/:a/utxo, /tx, /tx/:id/hex,
 *     POST /tx).
 *   - cat21-ord is hardcoded to ord.cat21.space in the wallet; interception
 *     rewrites that host -> localhost:8080.
 */

const BITCOIND_CONTAINER = 'ordpool-e2e-bitcoind';
const MINER_WALLET = 'e2e-miner';
const ELECTRS_BASE = 'http://localhost:3000';
const CAT21_ORD_BASE = 'http://localhost:8080';

/**
 * Built-in sBTC-devenv network id (WalletDefaultNetworkConfigurationIds.sbtcDevenv).
 * mode='regtest' (⇒ bcrt address derivation) and its bitcoinUrl resolves via
 * `getMempoolUrlFromUserSettings`, unlike the bare `regtest` id.
 */
const REGTEST_NETWORK_ID = 'sbtcDevenv';
/** Host of every wallet Bitcoin request under sbtcDevenv (path-prefixed /api/proxy). */
const WALLET_BITCOIN_HOST = 'localhost:3000';
const WALLET_BITCOIN_PATH_PREFIX = '/api/proxy';

// ── bitcoind control (docker exec bitcoin-cli) ──────────────────────────────

function bitcoinCli(args: string[], wallet?: string): string {
  const base = [
    'exec',
    BITCOIND_CONTAINER,
    'bitcoin-cli',
    '-regtest',
    '-rpcuser=ordpool',
    '-rpcpassword=ordpool',
  ];
  const walletArg = wallet ? [`-rpcwallet=${wallet}`] : [];
  return execFileSync('docker', [...base, ...walletArg, ...args], {
    encoding: 'utf8',
  }).trim();
}

/** Idempotent: create (or load) the miner wallet used to mine + fund. */
export function ensureMinerWallet(): void {
  try {
    bitcoinCli(['createwallet', MINER_WALLET]);
  } catch {
    // Already exists on disk — load it (also idempotent-ish; ignore "already loaded").
    try {
      bitcoinCli(['loadwallet', MINER_WALLET]);
    } catch {
      /* already loaded */
    }
  }
}

export function minerNewAddress(): string {
  return bitcoinCli(['getnewaddress'], MINER_WALLET);
}

/** A fresh regtest address controlled by the miner wallet (transfer recipient). */
export function newRegtestAddress(kind: 'bech32' | 'bech32m' = 'bech32m'): string {
  return bitcoinCli(['getnewaddress', '', kind], MINER_WALLET);
}

/**
 * Create a CAT-21 cat at `address` by broadcasting a real `nLockTime=21`
 * transaction (output 0 = the cat; change forced to position 1). This mints a
 * cat OWNED by an address the wallet controls, so transfer/offer flows have a
 * cat to act on without first driving the mint UI. Mirrors how an external
 * minter (or ord) would create a cat. Returns the mint txid; the cat's
 * inscription id is `<txid>i0`.
 */
export function mintCatViaRawTx(address: string, amountBtc = 0.00005): string {
  ensureSpendableMinerFunds();
  const raw = bitcoinCli(
    ['createrawtransaction', '[]', JSON.stringify([{ [address]: amountBtc }]), '21'],
    MINER_WALLET
  );
  const funded = JSON.parse(
    bitcoinCli(
      ['-named', 'fundrawtransaction', `hexstring=${raw}`, 'options={"changePosition":1}'],
      MINER_WALLET
    )
  ).hex as string;
  const signed = JSON.parse(bitcoinCli(['signrawtransactionwithwallet', funded], MINER_WALLET))
    .hex as string;
  const txid = bitcoinCli(['sendrawtransaction', signed]);
  mine(1);
  return txid;
}

/** Wait for cat21-ord to index the output, then return its cat inscription id. */
export async function getCatIdAtOutput(txid: string, vout: number): Promise<string> {
  const out = await waitForCatAtOutput(txid, vout);
  return out.cats[0];
}

export function blockHeight(): number {
  return Number(bitcoinCli(['getblockcount']));
}

/** Mine `n` blocks to a fresh miner address, returning the new height. */
export function mine(n: number): number {
  const addr = minerNewAddress();
  bitcoinCli(['generatetoaddress', String(n), addr]);
  return blockHeight();
}

/**
 * Ensure the miner wallet has mature spendable coins. Coinbase matures
 * after 100 confirmations, so on a fresh chain we mine 101 blocks once.
 * Idempotent: re-mines only enough to keep a spendable balance.
 */
export function ensureSpendableMinerFunds(): void {
  ensureMinerWallet();
  const balance = Number(bitcoinCli(['getbalance'], MINER_WALLET));
  if (balance <= 0) {
    const addr = minerNewAddress();
    bitcoinCli(['generatetoaddress', '101', addr]);
  }
}

/**
 * Send `amountBtc` to `address` from the miner wallet and confirm it in a
 * block. Returns the funding txid.
 */
export function fundAddress(address: string, amountBtc: number): string {
  ensureSpendableMinerFunds();
  const txid = bitcoinCli(['sendtoaddress', address, amountBtc.toFixed(8)], MINER_WALLET);
  mine(1);
  return txid;
}

// ── electrs / cat21-ord polling (node-side fetch, not through the wallet) ───

async function fetchText(url: string): Promise<string> {
  // `Accept: application/json` is load-bearing for cat21-ord: without it ord
  // serves HTML. electrs ignores the header and returns JSON regardless.
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`GET ${url} -> HTTP ${resp.status}`);
  return await resp.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

/** Poll until electrs has indexed up to bitcoind's current tip height. */
export async function waitElectrsSynced(timeoutMs = 60_000): Promise<void> {
  const target = blockHeight();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const tip = Number(await fetchText(`${ELECTRS_BASE}/blocks/tip/height`));
      if (tip >= target) return;
    } catch {
      /* electrs still starting / mid-reorg; retry */
    }
    if (Date.now() > deadline) {
      throw new Error(`electrs did not reach height ${target} within ${timeoutMs}ms`);
    }
    await sleep(500);
  }
}

export interface EsploraTx {
  txid: string;
  locktime: number;
  vin: { txid: string; vout: number }[];
  vout: { scriptpubkey?: string; scriptpubkey_address?: string; value: number }[];
  status: { confirmed: boolean; block_height?: number };
}

export async function getEsploraTx(txid: string): Promise<EsploraTx> {
  return fetchJson<EsploraTx>(`${ELECTRS_BASE}/tx/${txid}`);
}

export interface EsploraUtxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

export async function getAddressUtxos(address: string): Promise<EsploraUtxo[]> {
  return fetchJson<EsploraUtxo[]>(`${ELECTRS_BASE}/address/${address}/utxo`);
}

/** Poll electrs until a confirmed UTXO of at least `minValue` sats exists at `address`. */
export async function waitForUtxoAt(
  address: string,
  minValue = 1,
  timeoutMs = 60_000
): Promise<EsploraUtxo> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const utxos = await getAddressUtxos(address);
      const hit = utxos.find(u => u.status.confirmed && u.value >= minValue);
      if (hit) return hit;
    } catch {
      /* retry */
    }
    if (Date.now() > deadline) {
      throw new Error(`no confirmed UTXO >= ${minValue} at ${address} within ${timeoutMs}ms`);
    }
    await sleep(500);
  }
}

export interface Cat21OrdOutput {
  // cat21-ord re-emits ord's `inscriptions` array as `cats`; each entry is
  // an inscription-id string (`<64hex>i<n>`). Non-empty ⇒ the output carries
  // at least one cat.
  cats: string[];
  indexed: boolean;
  // The address currently holding the output (the cat's owner after a move).
  address?: string;
}

/**
 * Poll cat21-ord until it has indexed a given output at all (`indexed:true`),
 * regardless of whether it carries a cat. The mint's `classifyOutpoint`
 * content-scan queries cat21-ord for each funding UTXO, so the funding
 * output must be indexed before the wallet can select it.
 */
export async function waitOutputIndexed(
  txid: string,
  vout: number,
  timeoutMs = 60_000
): Promise<void> {
  const url = `${CAT21_ORD_BASE}/output/${txid}:${vout}`;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const out = await fetchJson<Cat21OrdOutput>(url);
      if (out.indexed) return;
    } catch {
      /* not indexed yet; retry */
    }
    if (Date.now() > deadline) {
      throw new Error(`cat21-ord did not index ${txid}:${vout} within ${timeoutMs}ms`);
    }
    await sleep(1000);
  }
}

/**
 * Poll cat21-ord's `/output/<txid>:<vout>` until it reports at least one
 * cat (i.e. the indexer has processed the block and recognized the mint).
 * This is the indexer-truth half of every proof.
 */
export async function waitForCatAtOutput(
  txid: string,
  vout: number,
  timeoutMs = 90_000
): Promise<Cat21OrdOutput> {
  const url = `${CAT21_ORD_BASE}/output/${txid}:${vout}`;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const out = await fetchJson<Cat21OrdOutput>(url);
      if (out.cats && out.cats.length > 0) return out;
    } catch {
      /* not indexed yet; retry */
    }
    if (Date.now() > deadline) {
      throw new Error(`cat21-ord reported no cat at ${txid}:${vout} within ${timeoutMs}ms`);
    }
    await sleep(1000);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Click the Cat21 confirmation dialog's Approve button until the wallet
 * broadcasts (a new txid lands in `capture.txids`), then return that txid.
 *
 * The confirm route fetches the account's UTXOs asynchronously, so the
 * pipeline's funding selection can lose a race with that fetch on the first
 * click (surfacing as the transient `funding-pick-failed`). We re-click while
 * that is the only error — each render re-binds the approve handler to
 * freshly-loaded state — until broadcast. Any other error fails loudly. The
 * service guards against double-submit, so repeated clicks are safe.
 *
 * For broadcasting flows only (mint, transfer, accept-offer). create-offer
 * does not broadcast; its success is a Bazaar-publish UI state.
 */
export async function approveUntilBroadcast(
  page: Page,
  capture: BroadcastCapture,
  { timeoutMs = 90_000 }: { timeoutMs?: number } = {}
): Promise<string> {
  const approve = page.getByTestId('cat21-confirmation-approve');
  const errorLabel = page.getByTestId('cat21-confirmation-error');
  await approve.waitFor({ state: 'visible' });
  const before = capture.txids.length;
  await expect
    .poll(
      async () => {
        if (capture.txids.length > before) return true;
        if (await errorLabel.isVisible()) {
          const detail = (await errorLabel.textContent()) ?? '';
          // Transient races only: funding UTXOs / cat metadata not yet loaded
          // when the first click landed. Anything else is a real rejection.
          if (
            !/funding-pick-failed|Insufficient funds|cat-utxo-resolve-failed|cat-data-not-loaded/.test(
              detail
            )
          ) {
            throw new Error(`cat21 action rejected: ${detail}`);
          }
        }
        if (await approve.isEnabled().catch(() => false)) {
          await approve.click().catch(() => undefined);
        }
        return false;
      },
      { timeout: timeoutMs, intervals: [1500], message: 'wallet never broadcast a tx' }
    )
    .toBe(true);
  return capture.txids[capture.txids.length - 1];
}

// ── wallet regtest wiring ───────────────────────────────────────────────────

/**
 * Broadcast capture: the route interceptor records the txid returned by
 * electrs for the wallet's `POST /tx`, so the spec can assert the exact
 * transaction the wallet built — no guessing which mempool entry is ours.
 */
export interface BroadcastCapture {
  txids: string[];
  lastRawHex: string | null;
  /**
   * Count of electrs `/address/<a>/utxo` responses served to the wallet — a
   * signal that the account's UTXOs have been fetched at least once.
   */
  utxoResponses: number;
  /**
   * Bodies POSTed to the CAT-21 Bazaar (backend2.cat21.space), captured so a
   * create-offer test can assert the published listing. The Bazaar backend is
   * not part of the regtest stack, so its endpoints are stubbed to succeed.
   */
  bazaarPosts: { path: string; body: string }[];
}

export function newCapture(): BroadcastCapture {
  return { txids: [], lastRawHex: null, utxoResponses: 0, bazaarPosts: [] };
}

/**
 * Install the regtest route rewrites on the browser context:
 *   - localhost:18443  -> localhost:3000  (wallet Bitcoin client -> electrs)
 *   - ord.cat21.space  -> localhost:8080  (wallet cat21-ord client)
 *   - mempool.space fee endpoint -> a static regtest fee (avoids a hang if
 *     the wallet prefetches recommended fees; the mint uses the form's rate)
 *
 * The interceptor proxies via `route.fetch` (server-side) and fulfils with
 * the fetched response, capturing the broadcast txid on the `POST /tx` path.
 */
export async function installRegtestRoutes(
  context: BrowserContext,
  capture: BroadcastCapture
): Promise<void> {
  const log = (...a: unknown[]) => {
    if (process.env.CHAIN_DEBUG) console.error('[route]', ...a);
  };

  // Wallet Bitcoin client (electrs Esplora): strip the /api/proxy prefix the
  // sbtcDevenv bitcoinUrl carries and forward to electrs at the same host.
  await context.route(
    url => url.host === WALLET_BITCOIN_HOST && url.pathname.startsWith(WALLET_BITCOIN_PATH_PREFIX),
    async route => {
      const original = new URL(route.request().url());
      const strippedPath = original.pathname.slice(WALLET_BITCOIN_PATH_PREFIX.length);
      const target = `${ELECTRS_BASE}${strippedPath}${original.search}`;
      const isBroadcast = route.request().method() === 'POST' && strippedPath === '/tx';
      if (isBroadcast) {
        capture.lastRawHex = route.request().postData();
      }
      const resp = await route.fetch({ url: target });
      const bodyText = await resp.text();
      if (isBroadcast && resp.ok()) capture.txids.push(bodyText.trim());
      if (route.request().method() === 'GET' && /\/address\/[^/]+\/utxo$/.test(strippedPath)) {
        capture.utxoResponses += 1;
      }
      log('electrs', route.request().method(), strippedPath, '->', resp.status());
      await route.fulfill({ response: resp, body: bodyText });
    }
  );

  // cat21-ord client host rewrite.
  await context.route(
    url => url.hostname === 'ord.cat21.space',
    async route => {
      const target = route
        .request()
        .url()
        .replace('https://ord.cat21.space', CAT21_ORD_BASE)
        .replace('http://ord.cat21.space', CAT21_ORD_BASE);
      const resp = await route.fetch({ url: target });
      const bodyText = await resp.text();
      log('cat21-ord', new URL(target).pathname, '->', resp.status());
      await route.fulfill({ response: resp, body: bodyText });
    }
  );

  // CAT-21 Bazaar stub (backend2.cat21.space): the marketplace backend is not
  // part of the regtest stack. Capture listing/bid POST bodies so a test can
  // assert what the wallet published, and answer 200 so the publish UI reaches
  // its success state. The BIP-322 auth the wallet signs first is real.
  await context.route(
    url => url.hostname === 'backend2.cat21.space',
    async route => {
      const req = route.request();
      if (req.method() === 'POST') {
        capture.bazaarPosts.push({
          path: new URL(req.url()).pathname,
          body: req.postData() ?? '',
        });
        log('bazaar POST', new URL(req.url()).pathname);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  );

  // Static fee estimate: keep the popup responsive if it prefetches fees.
  await context.route(
    url => url.pathname.includes('/fees/recommended'),
    async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fastestFee: 5,
          halfHourFee: 5,
          hourFee: 4,
          economyFee: 2,
          minimumFee: 1,
        }),
      });
    }
  );
}

/**
 * Switch the signed-in wallet to the built-in regtest network by patching
 * `currentNetworkId` in the persisted redux root, then reloading so
 * redux-persist rehydrates. The networks selector merges
 * `defaultNetworksKeyedById`, so `regtest` resolves to the built-in config
 * without adding a custom entity.
 */
export async function switchToRegtestNetwork(page: Page, extensionId: string): Promise<void> {
  await page.evaluate(async networkId => {
    const stored = await chrome.storage.local.get('persist:root');
    const root = stored['persist:root'];
    root.networks = { ...root.networks, currentNetworkId: networkId };
    await chrome.storage.local.set({ 'persist:root': root });
  }, REGTEST_NETWORK_ID);
  await page.goto(`chrome-extension://${extensionId}/index.html`);
}

/**
 * Seed the signed-in wallet state ALREADY on regtest. Used when a test wants
 * the wallet to boot straight onto regtest (avoids a mainnet render pass).
 */
export function regtestWalletState(): object {
  const state = getTestSoftwareAccountDefaultWalletState() as {
    networks: { ids: string[]; entities: object; currentNetworkId: string };
  };
  return {
    ...state,
    networks: { ...state.networks, currentNetworkId: REGTEST_NETWORK_ID },
  };
}

/**
 * Stash a Cat21 request in `chrome.storage.session` under the key the confirm
 * route reads (`cat21-request-<id>`), the same way the NMH popup relay does
 * for Path 3. The route is then reached with `?cat21RequestId=<id>`. With an
 * intent `mode` other than `'autonomous'` the route does NOT auto-confirm, so
 * the test clicks the real Approve button (a manual confirmation reached via
 * the MCP transport). Requires an extension page to be loaded (chrome.* APIs).
 */
export async function stashCat21Request(
  page: Page,
  requestId: string,
  intent: unknown,
  transport = 'mcp-nmh'
): Promise<void> {
  await page.evaluate(
    async ({ key, value }) => {
      await chrome.storage.session.set({ [key]: value });
    },
    { key: `cat21-request-${requestId}`, value: { intent, transport } }
  );
}

/**
 * Read the wallet's own regtest address from the Receive UI (ground truth —
 * whatever the keychain actually derives on regtest, no assumptions about
 * coin type). `kind` selects the native-segwit funding address (`btc`) or
 * the taproot ordinals address (`btc-taproot`) where minted cats land.
 */
export async function readReceiveAddress(
  page: Page,
  extensionId: string,
  kind: 'btc' | 'btc-taproot'
): Promise<string> {
  await page.goto(`chrome-extension://${extensionId}/index.html#/receive/${kind}`);
  const displayer = page.getByTestId('address-displayer');
  await displayer.waitFor({ state: 'visible' });
  // AddressDisplayer renders the address as 4-char <span> groups with a CSS
  // column gap (no literal spaces), so textContent is the raw address.
  const text = (await displayer.textContent()) ?? '';
  const address = text.trim();
  if (!address) throw new Error(`empty ${kind} address in Receive UI`);
  return address;
}
