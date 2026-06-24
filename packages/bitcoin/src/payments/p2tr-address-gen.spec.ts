import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';

import { extractAddressIndexFromPath, extractChangeIndexFromPath } from '@leather.io/crypto';

import { deriveAddressIndexKeychainFromAccount } from '../utils/bitcoin.utils';
import {
  deriveTaprootAccount,
  getTaprootPaymentFromAddressIndex,
  makeTaprootAddressIndexDerivationPath,
} from './p2tr-address-gen';

// TODO: this is a SECRET_KEY from @tests/mocks folder.
// Temporary until we move @tests/mocks folder to monorepo.
export const SECRET_KEY =
  'invite helmet save lion indicate chuckle world pride afford hard broom draft';

// Source: derived locally from the secret key above with @scure/btc-
// signer, BIP-86 at m/86'/0'/0'/<change>/<addressIndex>, encoded under
// `btc.TEST_NETWORK` (tb1p HRP). The original Sparrow-generated
// fixtures were under BIP-44's testnet=1 path (`m/86'/1'/...`); after
// the Cat21 Wallet ADR-7 fix (coinTypeMap → coin-type=0 universal),
// testnet derives at m/86'/0' just like mainnet — different private
// keys, different addresses. Regenerated to match the new derivation.
const addresses = {
  "m/86'/0'/0'/0/0": 'tb1p6fg5h8a2kk5lpxmdasnrsps3df4jvjgyedclme0q3ans9rtncufqdsy9zy',
  "m/86'/0'/0'/1/0": 'tb1pqfkaqgjex98kjhx6rgjkrtg3lzdyzz5l7f7kpfgdw5l0dvhn2hwsezkjt3',
  "m/86'/0'/0'/0/1": 'tb1px9yh7ycs78ste8yfrnrr33zt30h37m8greqrvrjujuu6cr9jswrsrh6x3u',
  "m/86'/0'/0'/1/1": 'tb1pe53xumpmmu92zn0d69f7wvugzj2qpxsmqjhsvnhzmu2g7x80876q3c57vn',
  "m/86'/0'/0'/0/2": 'tb1pu4mlhy7swcjjc2e5t2vxlm2hmxdk6cecyc93ze0v6lar83sclvls3ktxn9',
  "m/86'/0'/0'/1/2": 'tb1p3ru0pau27vjf9cq3chfux36tc3hn2a8w0xmz50r7khx304dqvgjsa6tt48',
  "m/86'/0'/0'/0/3": 'tb1pe5daxqkwzq90feuvdz73e7qsduyfs2lyxw7gefp6mula2hxk78yscadulq',
  "m/86'/0'/0'/1/3": 'tb1pcfwtfdac3084rlzgur2nn58fz8yjlt35jrt9w2x8g0v52ncpwzhs38kzuu',
  "m/86'/0'/0'/0/4": 'tb1pw4feu6asm4f35vy7ly3ma26kgjmfn97s29arthegekcvhs8ktjeqj0p4y4',
  "m/86'/0'/0'/1/4": 'tb1p22cal3gzv6spyd7jhxd4ht2qgwpuh3r6qf3wp8lxnjp2ws2q3n4s7j4zca',
  "m/86'/0'/0'/0/5": 'tb1ptx9w9dap6ylwfyu52tqqd0tu3xl6mraey4dyx42y760q9mkryy2shwdyzg',
  "m/86'/0'/0'/1/5": 'tb1pet6xljuhxxp99xg309kudycf6537p0v85eg3ghcpw4msdqvjardqnds2nd',
};

describe('taproot address gen', () => {
  test.each(Object.entries(addresses))(
    'should generate taproot addresses',
    (derivationPath, address) => {
      const keychain = HDKey.fromMasterSeed(mnemonicToSeedSync(SECRET_KEY));
      const addressIndex = extractAddressIndexFromPath(derivationPath);
      const changeIndex = extractChangeIndexFromPath(derivationPath);
      const accountZero = deriveTaprootAccount(keychain, 'testnet')(0);

      const addressIndexDetails = getTaprootPaymentFromAddressIndex(
        deriveAddressIndexKeychainFromAccount(accountZero.keychain)({
          addressIndex,
          changeIndex,
        }),
        'testnet'
      );
      if (!accountZero.keychain.privateKey) throw new Error('No private key found');

      expect(addressIndexDetails.address).toEqual(address);
    }
  );
});

describe(makeTaprootAddressIndexDerivationPath.name, () => {
  it('creates mainnet receive path', () => {
    expect(
      makeTaprootAddressIndexDerivationPath({
        network: 'mainnet',
        accountIndex: 5,
        changeIndex: 0,
        addressIndex: 0,
      })
    ).toEqual("m/86'/0'/5'/0/0");
  });
  it('creates mainnet change path', () => {
    expect(
      makeTaprootAddressIndexDerivationPath({
        network: 'mainnet',
        accountIndex: 42,
        changeIndex: 1,
        addressIndex: 5,
      })
    ).toEqual("m/86'/0'/42'/1/5");
  });
  // HACK -- Cat21: ADR-7 pins coin-type=0 across every network (see
  // `coinTypeMap` in `../utils/bitcoin.utils.ts`). Testnet derives at
  // m/86'/0' just like mainnet; non-mainnet only affects the bech32 HRP
  // at the address encoding layer.
  it('creates testnet change path', () => {
    expect(
      makeTaprootAddressIndexDerivationPath({
        network: 'testnet',
        accountIndex: 0,
        changeIndex: 1,
        addressIndex: 1,
      })
    ).toEqual("m/86'/0'/0'/1/1");
  });
});
