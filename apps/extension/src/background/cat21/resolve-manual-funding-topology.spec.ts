import { describe, expect, it } from 'vitest';

import { resolveManualFundingTopology } from './cat21-rpc.service';

/**
 * `resolveManualFundingTopology` decides the ONE thing that separates a
 * proceed-with-notice from a hard block on an asset-bearing funding coin: the
 * wallet's address layout. The SDK core reads it as `fundingTopology` and, on a
 * `separate-payment-address` wallet, downgrades an asset-only funding situation
 * to `asset-notice` (proceed, but name what the coin carries) instead of the
 * one-address `expert-required` block. cat21-wallet keeps a native-segwit
 * payment address apart from its taproot ordinals address, so the real answer is
 * always `separate-payment-address`; these pin that, plus the two edges.
 *
 * Uses the SDK's real `isOneAddressWallet` (not a stub), so a change in what the
 * SDK counts as one-address is caught here.
 */
describe('resolveManualFundingTopology', () => {
  it('is separate-payment-address when payment and ordinals addresses differ (the wallet’s real shape)', () => {
    expect(
      resolveManualFundingTopology(
        'bc1qpaymentnativesegwitaddressxxxxxxxxxxxxx',
        'bc1ptaprootordinalsaddressyyyyyyyyyyyyyyyyyyyyyyyyyy'
      )
    ).toBe('separate-payment-address');
  });

  it('is one-address-for-everything when both addresses are the same lane', () => {
    const same = 'bc1qsingleaddresswalletxxxxxxxxxxxxxxxxxxxx';
    expect(resolveManualFundingTopology(same, same)).toBe('one-address-for-everything');
  });

  it('falls back to separate-payment-address when there is no ordinals address to compare', () => {
    // No ordinals address in context: default to the wallet's real separate
    // shape rather than the blocking one-address branch.
    expect(resolveManualFundingTopology('bc1qpaymentonlyxxxxxxxxxxxxxxxxxxxxxxxx', undefined)).toBe(
      'separate-payment-address'
    );
  });
});
