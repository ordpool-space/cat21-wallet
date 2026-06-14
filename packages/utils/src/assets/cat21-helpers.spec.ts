import { CryptoAssetCategories, CryptoAssetChains, CryptoAssetProtocols } from '@leather.io/models';

import { CreateCat21Data, createCat21Asset } from './cat21-helpers';

describe(createCat21Asset.name, () => {
  const mockCreateCat21Data: CreateCat21Data = {
    id: 'cat1',
    number: 1,
    contentSrc: 'https://exmaple.com/1',
    mimeType: 'image/svg',
    ownerAddress: 'bc1pabc',
    satPoint: 'abc:0:1',
    genesisBlockHash: 'hash1',
    genesisBlockHeight: 100,
    genesisTimestamp: '2025-01-01T12:00:00.000Z',
    outputValue: '1000',
    thumbnailSrc: 'https://example.com/thumb.png',
  };

  it('populates cat21 data on asset as expected', () => {
    const cat = createCat21Asset(mockCreateCat21Data);

    expect(cat.chain).toEqual(CryptoAssetChains.bitcoin);
    expect(cat.category).toEqual(CryptoAssetCategories.nft);
    expect(cat.protocol).toEqual(CryptoAssetProtocols.cat21);
    expect(cat.id).toEqual(mockCreateCat21Data.id);
    expect(cat.number).toEqual(mockCreateCat21Data.number);
    expect(cat.txid).toEqual('abc');
    expect(cat.output).toEqual('0');
    expect(cat.offset).toEqual('1');
    expect(cat.address).toEqual(mockCreateCat21Data.ownerAddress);
    expect(cat.preview.includes(mockCreateCat21Data.id)).toBe(true);
    expect(cat.title.includes(mockCreateCat21Data.number.toString())).toBe(true);
    expect(cat.genesisBlockHash).toEqual(mockCreateCat21Data.genesisBlockHash);
    expect(cat.genesisBlockHeight).toEqual(mockCreateCat21Data.genesisBlockHeight);
    expect(cat.genesisTimestamp).toEqual(1735732800);
    expect(cat.value).toEqual(mockCreateCat21Data.outputValue);
    expect(cat.mimeType).toEqual('svg');
    expect(cat.thumbnailSrc).toEqual(mockCreateCat21Data.thumbnailSrc);
  });

  it('falls back to ordinal preview when no content source is provided', () => {
    const cat = createCat21Asset({
      ...mockCreateCat21Data,
      contentSrc: '',
    });

    expect(cat.src).toContain('https://ordinals.com/preview/');
  });

  it.each([
    { mimeType: 'text/html', expectedMimeType: 'html' },
    { mimeType: 'model/gltf+json', expectedMimeType: 'gltf' },
  ])('uses contentSrc for %s cats', ({ mimeType, expectedMimeType }) => {
    const cat = createCat21Asset({
      ...mockCreateCat21Data,
      mimeType,
      contentSrc: 'https://content.bestinslot.xyz/example',
    });

    expect(cat.mimeType).toEqual(expectedMimeType);
    expect(cat.src).toEqual('https://content.bestinslot.xyz/example');
  });
});
