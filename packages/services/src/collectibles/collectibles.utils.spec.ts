import cat0 from '../infrastructure/api/cat21-ord/__fixtures__/cat-0.json';
import {
  isLpToken,
  mapOrdCat21ToCat21Asset,
  sortOrdCat21ByBlockHeight,
} from './collectibles.utils';

describe(isLpToken.name, () => {
  it('returns true for pool-token-id pattern', () => {
    expect(isLpToken('SP123.velar-v1::pool-token-id')).toBe(true);
    expect(isLpToken('SP456.alex-amm::Pool-Token-Id')).toBe(true);
  });

  it('returns true for lp-token pattern', () => {
    expect(isLpToken('SP123.pool::lp-token')).toBe(true);
    expect(isLpToken('SP456.swap::LP-TOKEN')).toBe(true);
  });

  it('returns true for liquidity-token pattern', () => {
    expect(isLpToken('SP123.dex::liquidity-token')).toBe(true);
    expect(isLpToken('SP456.amm::Liquidity-Token')).toBe(true);
  });

  it('returns true for dlmm-pool- pattern', () => {
    expect(isLpToken('SP123.dlmm-pool-stx-usda::token')).toBe(true);
    expect(isLpToken('SP456.DLMM-POOL-BTC-STX::nft')).toBe(true);
  });

  it('returns true for amm-pool- pattern', () => {
    expect(isLpToken('SP123.amm-pool-v2::share')).toBe(true);
    expect(isLpToken('SP456.AMM-POOL-STX::token')).toBe(true);
  });

  it('returns false for regular NFT identifiers', () => {
    expect(isLpToken('SP123.megapont-ape-club::megapont-ape-club')).toBe(false);
    expect(isLpToken('SP456.bitcoin-monkeys::bitcoin-monkeys')).toBe(false);
    expect(isLpToken('SP789.stacks-punks::stacks-punks')).toBe(false);
  });

  it('returns false for BNS names', () => {
    expect(isLpToken('SP000.bns::names')).toBe(false);
    expect(isLpToken('SP123.bns-v2::bns-names')).toBe(false);
  });

  it('handles case insensitivity', () => {
    expect(isLpToken('SP123.VELAR::POOL-TOKEN-ID')).toBe(true);
    expect(isLpToken('sp123.velar::pool-token-id')).toBe(true);
    expect(isLpToken('Sp123.Velar::Pool-Token-Id')).toBe(true);
  });
});

describe(mapOrdCat21ToCat21Asset.name, () => {
  it('gives the asset a populated src, not an empty string', () => {
    // ord sends content_type: null for every cat. Passed straight through it
    // trips upstream's `!mimeType` guard, which returns src: '' — so the
    // locally drawn cat never reaches anything reading `.src`.
    const asset = mapOrdCat21ToCat21Asset(cat0 as never);

    expect(asset.mimeType).toBe('svg');
    expect(asset.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(asset.thumbnailSrc?.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('maps the real output value rather than a hardcoded zero', () => {
    const asset = mapOrdCat21ToCat21Asset(cat0 as never);

    expect(asset.value).toBe(String(cat0.value));
  });
});

describe(sortOrdCat21ByBlockHeight.name, () => {
  it('orders newest first', () => {
    const cats = [{ height: 100 }, { height: 300 }, { height: 200 }] as never[];

    expect(cats.sort(sortOrdCat21ByBlockHeight).map(c => (c as { height: number }).height)).toEqual(
      [300, 200, 100]
    );
  });
});
