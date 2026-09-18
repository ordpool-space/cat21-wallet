import { CryptoAssetCategories, CryptoAssetChains, CryptoAssetProtocols } from '@leather.io/models';

import { CreateCat21Data, createCat21Asset } from './cat21-helpers';

/**
 * Real genesis-cat values, not placeholders. The renderer hashes
 * mintTxid + blockHash and `createCatHash` validates the txid length, so a
 * stand-in like 'cat1' silently produces no image and the render assertions
 * below would pass against an empty string without testing anything.
 */
const GENESIS_TXID = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
const GENESIS_BLOCK_HASH = '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';

describe(createCat21Asset.name, () => {
  const mockCreateCat21Data: CreateCat21Data = {
    id: `${GENESIS_TXID}i0`,
    number: 0,
    contentSrc: 'https://exmaple.com/1',
    mimeType: 'image/svg',
    ownerAddress: 'bc1pabc',
    satPoint: 'abc:0:1',
    genesisBlockHash: GENESIS_BLOCK_HASH,
    genesisBlockHeight: 824205,
    genesisTimestamp: '2025-01-01T12:00:00.000Z',
    outputValue: '1000',
    thumbnailSrc: 'https://example.com/thumb.png',
    fee: 40834,
    weight: 705,
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
    expect(cat.preview).toEqual('https://cat21.space/cat/0');
    expect(cat.title.includes(mockCreateCat21Data.number.toString())).toBe(true);
    expect(cat.genesisBlockHash).toEqual(mockCreateCat21Data.genesisBlockHash);
    expect(cat.genesisBlockHeight).toEqual(mockCreateCat21Data.genesisBlockHeight);
    expect(cat.genesisTimestamp).toEqual(1735732800);
    expect(cat.value).toEqual(mockCreateCat21Data.outputValue);
    expect(cat.mimeType).toEqual('svg');
    expect(cat.thumbnailSrc).toEqual(mockCreateCat21Data.thumbnailSrc);
  });

  it('draws the cat locally when no content source is provided', () => {
    const cat = createCat21Asset({
      ...mockCreateCat21Data,
      contentSrc: '',
    });

    expect(cat.src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(cat.src)).toContain('<svg');
  });

  it('renders from the mint txid, not the current satpoint', () => {
    const atMint = createCat21Asset({ ...mockCreateCat21Data, contentSrc: '' });
    // Same cat, moved to a different output. A satpoint-derived render would
    // change the picture; the cat must look identical after a transfer.
    const afterTransfer = createCat21Asset({
      ...mockCreateCat21Data,
      contentSrc: '',
      satPoint: 'f'.repeat(64) + ':3:7',
    });

    expect(afterTransfer.src).toEqual(atMint.src);
  });

  it('gives two different cats two different pictures', () => {
    const genesis = createCat21Asset({ ...mockCreateCat21Data, contentSrc: '' });
    const other = createCat21Asset({
      ...mockCreateCat21Data,
      contentSrc: '',
      id: `${'a'.repeat(64)}i0`,
    });

    expect(other.src).not.toEqual(genesis.src);
    expect(other.src.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('falls back to the sleeping-cat placeholder while unconfirmed', () => {
    const unconfirmed = createCat21Asset({
      ...mockCreateCat21Data,
      contentSrc: '',
      genesisBlockHash: '',
    });
    const confirmed = createCat21Asset({ ...mockCreateCat21Data, contentSrc: '' });

    expect(unconfirmed.src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(unconfirmed.src)).toContain('<svg');
    expect(unconfirmed.src).not.toEqual(confirmed.src);
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
