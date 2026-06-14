import type { RpcMethodNames } from '@leather.io/rpc';

interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  webUrl?: string;
  chromeWebStoreUrl?: string;
  mozillaAddOnsUrl?: string;
  googlePlayStoreUrl?: string;
  iOSAppStoreUrl?: string;
  methods?: string[];
}

const LEATHER_PROVIDER: WalletProvider = {
  id: 'LeatherProvider',
  name: 'Leather',
  icon: 'data:image/svg;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYuODM4NyIgZmlsbD0iIzEyMTAwRiIvPgo8cGF0aCBkPSJNNzQuOTE3MSA1Mi43MTE0QzgyLjQ3NjYgNTEuNTQwOCA5My40MDg3IDQzLjU4MDQgOTMuNDA4NyAzNy4zNzYxQzkzLjQwODcgMzUuNTAzMSA5MS44OTY4IDM0LjIxNTQgODkuNjg3MSAzNC4yMTU0Qzg1LjUwMDQgMzQuMjE1NCA3OC40MDYxIDQwLjUzNjggNzQuOTE3MSA1Mi43MTE0Wk0zOS45MTEgODMuNDk5MUMzMC4wMjU2IDgzLjQ5OTEgMjkuMjExNSA5My4zMzI0IDM5LjA5NjkgOTMuMzMyNEM0My41MTYzIDkzLjMzMjQgNDguODY2MSA5MS41NzY0IDUxLjY1NzMgODguNDE1N0M0Ny41ODY4IDg0LjkwMzggNDQuMjE0MSA4My40OTkxIDM5LjkxMSA4My40OTkxWk0xMDIuODI5IDc5LjI4NDhDMTAzLjQxIDk1Ljc5MDcgOTUuMDM2OSAxMDUuMDM5IDgwLjg0ODQgMTA1LjAzOUM3Mi40NzQ4IDEwNS4wMzkgNjguMjg4MSAxMDEuODc4IDU5LjMzMyA5Ni4wMjQ4QzU0LjY4MSAxMDEuMTc2IDQ1Ljg0MjMgMTA1LjAzOSAzOC41MTU0IDEwNS4wMzlDMTMuMjc4NSAxMDUuMDM5IDE0LjMyNTIgNzIuODQ2MyA0MC4wMjczIDcyLjg0NjNDNDUuMzc3MSA3Mi44NDYzIDQ5LjkxMjggNzQuMjUxMSA1NS43Mjc3IDc3Ljg4TDU5LjU2NTYgNjQuNDE3N0M0My43NDg5IDYwLjA4NjQgMzUuODQwNSA0Ny45MTE4IDQzLjYzMjYgMzAuNDY5M0g1Ni4xOTI5QzQ5LjIxNSA0Mi4wNTg2IDUzLjk4MzIgNTEuNjU3OCA2Mi44MjIgNTIuNzExNEM2Ny41OTAzIDM1LjczNzIgNzcuODI0NiAyMi41MDkgOTEuNDMxNiAyMi41MDlDOTkuMTA3NCAyMi41MDkgMTA1LjE1NSAyNy41NDI4IDEwNS4xNTUgMzYuNjczN0MxMDUuMTU1IDUxLjMwNjYgODYuMDgxOSA2My4yNDcxIDcxLjY2MDcgNjQuNDE3N0w2NS43Mjk1IDg1LjM3MjFDNzIuNDc0OCA5My4yMTUzIDkxLjE5OSAxMDAuODI0IDkxLjE5OSA3OS4yODQ4SDEwMi44MjlaIiBmaWxsPSIjRjdGNUYzIi8+Cjwvc3ZnPgo=',

  webUrl: 'https://leather.io',

  chromeWebStoreUrl:
    'https://chromewebstore.google.com/detail/leather/ldinpeekobnhjjdofggfgjlcehhmanlj',

  methods: [
    'open',
    'getInfo',
    'supportedMethods',
    'openSwap',
    'getAddresses',
    'stx_updateProfile',
    'stx_signMessage',
    'stx_transferStx',
    'stx_transferSip10Ft',
    'stx_transferSip9Nft',
    'stx_signTransaction',
    'stx_signStructuredMessage',
    'stx_getAddresses',
    'stx_deployContract',
    'stx_callContract',
    'signPsbt',
    'signMessage',
    'sendTransfer',
    // Better to import a type than a variable from @leather.io/rpc to save a lot of space in the injected provider script
  ] satisfies RpcMethodNames[],
};

/* HACK -- Cat21: dedicated Cat21Provider entry per WBIP004. Always added
 * to btc_providers regardless of whether Leather is present. methods list
 * is the Bitcoin-only subset Cat21 ships. */
const CAT21_PROVIDER: WalletProvider = {
  id: 'Cat21Provider',
  name: 'Cat21 Wallet',
  // Cat #0 (Genesis Cat) — the 128 px PNG from apps/extension/public/assets/icons.
  // Encoded inline so the WBIP004 entry is self-contained for dapp wallet
  // selectors. ~5.8 kB; comparable to Leather's own SVG data URI.
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAABmJLR0QA/wD/AP+gvaeTAAAQ6UlEQVR4nO1deYxd1Xn/zt3fNm/em4UZ2zP2MOMxHmJsMMQQh9BCsCOMW0RTN4SQUjU0qapKFVKadEmJEoVmbRUEJIgmUFFLDYuStlQ1Ek4IxBiwjfE2xmN7PB57Fs/2Zvy2++5yTv+o8D3fuSM/7A4+Lj2/v3x/Pvc7973fm3u++y3nEvYEKEiEJvsC/r9DCSAZSgDJUAJIhhJAMpQAkqEEkAwlgGQoASRDCSAZSgDJUAJIhhJAMpQAkqEEkAwlgGQoASRDCSAZSgDJUAJIhhJAMpQAkmHUHfH8ib5dE4t5pi838Ye9+xb8Uv55YHV/oZVnbmgd+XRX/4JPdFmhvgDVwDxRbOSZrobZD+JSqqElTPSR/MQHMdFlBXULkgwlgGQoASRDXANCRjyKSEacRCKBBul2NTR5wtJCndALmjhkmkd1NJFm2bbNMxTiEwU6YRc00WUOIhTnvnS6+1+Pr+KZL9z/uRtv/iTPfPdbfzcwOMwzmzuP3N11+IImfuHEyheHV/DMp+/atLTnIzzzzFM/mpg+yzP3dB/YsOT4BU10mSPuBZGyj350GgS6k+UZS6fCGCAXPDEBEIzoEIKZRhenMWEMYxc+0+UNtQZIhhJAMpQAkiGuAZVAc/SAZ4pnCnD8EM/0dvQYmXaemZuZ2zM5d+6QMeKDbpHIjscMg4QaRA5MQeu8ZmU3byRvphonT/OMBZajl3imGn7YfjGiAAmduSEiMyeOQgV97Ds33EKWreGZL//Z4f86up5nHD3g7ThG6AbI6dx820fvWv8pnll26DfpoxWeYdWicDGOfmHO7uUP8QdF5vGyxc9MWCAwWt3fJRPNxicisYn4v5j3xnzY8GH7i/4/ByWAZCgBJMN4brCPj668O9ucs11+xEzLIrj2SnRS9gooj/LE3b9/79z0+LlDpummnQyqxWgaJxN4VaDR4tF55YpW9HwN5pp1cLbAM85we65ygmfenm4vB9GzccjIps6jScOv+zn/l5isJl8dX8qvQCXfSpseP6bsWynMLM/OrMqfOb9l47nBq/njjOUXPfT0n+/uhBtQLAiKQ5Dq4Il11wMkkUsDfhnMFHdYEsIMUB6F1CLR7Iq1POE+97NCzeGZgOb3TrXxzMfbhi+BAMOlxp8dR3GqnO0K19aaqExUkzyzeelAXQHULUgylACSoQSQDCWAZBh5u2JwKly5YvXtv30TPyLd2Dry7g6eyT21NTk0gMw89DB0cA4AMcBwwJ3k5kmDN8t7QbDtV/D8VmTkc38Ev4WI+7/wpbnpMZ55euvzieLUucOAgndJokM1pjU7FY1zgzq7r75mJXIO9+w/DMPHeKboWXUtGzM1tHB/oqNj1U138sz4sbemXOQw5l9/BX6D819/b0JmGWL8MjjN3GEJzGY0YO9ueHY7Yu65RzDSSXToRX5R7adbBU/DuiTRIZvQKRfNe2Nb85KVKPx16NBB4drWtSKvdF6oW5BkKAEkQwkgGUoAyTBydlXjYkGVchlKp/gRLVua8/wvnkVnHMTFOww0M/u+UWoOSAAj4nB0KUiBaCnTMxIqzo3RBjMpIYRsbWxeTBoCgAfQYrISvE4QcOEgBzz5OISJgUqYIaEFqdR0xXcRTRyfRb5HMSO5y1AAUDk7sMUyD3+Gx2WMfTsCWUEYP3FzvBnvLkSEgT8DNCXLLD4j7xcaaSDpXMggxFiTpKWxnjVPnyLpcaZS6sZ6CFTOPN8O5+/dPyqRdaIZL5RAfYR2C2Ymnsg+8RvxN6CamHKHAEUFICk2hbJjPYIyPrQ4xByJ5MOkmEEkAylACSoQSQjP8GnTLEx0eDTEUAAAAASUVORK5CYII=',
  webUrl: 'https://ordpool.space',
  methods: [
    'open',
    'getInfo',
    'supportedMethods',
    'getAddresses',
    'signPsbt',
    'signMessage',
    'sendTransfer',
  ] satisfies RpcMethodNames[],
};

/**
 * Registers Cat21 (and Leather, if no other Leather is present) in the
 * `window.btc_providers` discovery array per WBIP004.
 *
 * Politeness rules:
 *
 *   - Cat21 entry is always pushed (no other extension uses this id).
 *   - Leather entry is pushed ONLY if no other entry with `id ===
 *     'LeatherProvider'` is already in the array. If real Leather already
 *     advertised itself, we defer to it.
 *
 * https://wbips.netlify.app/wbips/WBIP004
 */
export function addLeatherToProviders() {
  const win = window as unknown as Window & { btc_providers?: WalletProvider[] };

  if (!win.btc_providers) win.btc_providers = [];

  const hasLeather = win.btc_providers.some(p => p.id === 'LeatherProvider');
  const hasCat21 = win.btc_providers.some(p => p.id === 'Cat21Provider');

  if (!hasCat21) win.btc_providers.push(CAT21_PROVIDER);
  if (!hasLeather) win.btc_providers.push(LEATHER_PROVIDER);
}
