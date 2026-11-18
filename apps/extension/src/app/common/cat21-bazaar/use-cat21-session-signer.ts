/**
 * Shared taproot session-signer glue for Bazaar mutations.
 *
 * Both flows that authenticate to the Bazaar — publishing a listing
 * (use-publish-to-bazaar) and unlisting (use-cat21-listing) — need
 * the same two things: the account's ordinals (taproot) address, and
 * a BIP-322 signer bound to that key. This hook is the single place
 * that wires the wallet's taproot keychain into an
 * `(message) => Promise<base64 signature>` callback, so the two
 * consumers can't drift.
 *
 * This is NOT the dapp RPC popup path. It signs with the wallet's own
 * keychain inside the wallet's own UI; the user's consent is the
 * form action that triggers it (list / unlist button), not a
 * separate approval popup.
 */
import * as bitcoin from 'bitcoinjs-lib';

import { createBitcoinAddress, signBip322MessageSimple } from '@leather.io/bitcoin';

import { useSignBitcoinTx } from '@app/store/accounts/blockchain/bitcoin/bitcoin.hooks';
import { useCurrentAccountTaprootPayer } from '@app/store/accounts/blockchain/bitcoin/taproot-account.hooks';
import { useCurrentNetwork } from '@app/store/networks/networks.selectors';

interface Cat21SessionSigner {
  /** The account's ordinals (taproot, index 0) address. */
  ordinalsAddress: string;
  /** Sign `message` BIP-322 with the ordinals key; resolve base64 witness. */
  signBip322(message: string): Promise<string>;
}

export function useCat21SessionSigner(): Cat21SessionSigner {
  const network = useCurrentNetwork();
  const createTaprootPayer = useCurrentAccountTaprootPayer();
  const signTx = useSignBitcoinTx();

  // Render-safe: this hook runs unconditionally in the shared
  // Cat21ConfirmRoute (via usePublishToBazaar), which serves all four
  // cat21 actions — mint/transfer/accept never publish a listing and
  // must not crash if an account somehow lacks a taproot payer. So we
  // resolve the payer WITHOUT throwing here; the error (if any) is
  // deferred to the moment a listing action actually needs to sign,
  // where the publish/unlist pipeline's try/catch turns it into a
  // typed error state.
  const payer = createTaprootPayer ? createTaprootPayer({ addressIndex: 0, changeIndex: 0 }) : null;
  const ordinalsAddress = payer?.payment.address ?? '';

  async function signBip322(message: string): Promise<string> {
    if (!payer || !ordinalsAddress) {
      throw new Error('No taproot signer for the current account — cannot sign a Bazaar session');
    }
    // Destructure from the guarded payer so tapInternalKey keeps its
    // non-optional type inside the signPsbt closure (a narrowed
    // optional const does not survive into a nested function).
    const { tapInternalKey } = payer.payment;
    // Non-async + Promise.resolve: signTx may return Tx OR Promise<Tx>;
    // wrapping normalises to Promise<Tx> to satisfy
    // signBip322MessageSimple's `signPsbt: (psbt) => Promise<Tx>`,
    // without an `async` keyword that would trip
    // @typescript-eslint/require-await (there is nothing to await).
    function signPsbt(psbt: bitcoin.Psbt) {
      psbt.data.inputs.forEach(input => (input.tapInternalKey = Buffer.from(tapInternalKey)));
      return Promise.resolve(signTx(psbt.toBuffer()));
    }
    const { signature } = await signBip322MessageSimple({
      message,
      address: createBitcoinAddress(ordinalsAddress),
      signPsbt,
      network: network.chain.bitcoin.mode,
    });
    return signature;
  }

  return { ordinalsAddress, signBip322 };
}
