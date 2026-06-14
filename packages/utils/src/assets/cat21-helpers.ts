import { ORD_IO_URL } from '@leather.io/constants';
import {
  Cat21Asset,
  Cat21MimeType,
  CryptoAssetCategories,
  CryptoAssetChains,
  CryptoAssetProtocols,
} from '@leather.io/models';

import { dateToUnixTimestamp } from '../time';

export function whenCat21MimeType<T>(
  mimeType: string,
  branches: { [k in Cat21MimeType]?: () => T }
) {
  if (mimeType.startsWith('audio/') && branches.audio) {
    return branches.audio();
  }
  if (mimeType.startsWith('text/html') && branches.html) {
    return branches.html();
  }
  if (mimeType.startsWith('image/svg') && branches.svg) {
    return branches.svg();
  }
  if (mimeType.startsWith('image/') && branches.image) {
    return branches.image();
  }
  if (mimeType.startsWith('text') && branches.text) {
    return branches.text();
  }
  if (mimeType.startsWith('video/') && branches.video) {
    return branches.video();
  }
  if (mimeType.startsWith('model/gltf') && branches.gltf) {
    return branches.gltf();
  }
  if (branches.other) return branches.other();

  throw new Error('Unhandled cat21 content type');
}

export interface CreateCat21Data {
  readonly id: string;
  readonly number: number;
  readonly contentSrc: string;
  readonly mimeType?: string;
  readonly ownerAddress: string;
  readonly satPoint: string;
  readonly genesisBlockHash: string;
  readonly genesisTimestamp: string | number;
  readonly genesisBlockHeight: number;
  readonly outputValue: string;
  readonly thumbnailSrc?: string;
}

export function createCat21Asset(data: CreateCat21Data): Cat21Asset {
  /* ordinals.com serves the bytes for any inscription id, including cat-bearing
   * ones, behind /preview and /content. These URLs are kept here for rendering;
   * ord's `inscription` URL component is its on-the-wire path name (we do not
   * rename ord's URL space). */
  const ordinalPreviewSrc = `https://ordinals.com/preview/${data.id}`;
  const ordIoSrc = `${ORD_IO_URL}/content/${data.id}`;
  const thumbnailSrc = data.thumbnailSrc ?? ordinalPreviewSrc;
  const primarySrc = data.contentSrc || ordinalPreviewSrc;
  const preview = `https://ordinals.hiro.so/inscription/${data.id}`;
  const title = `Cat #${data.number}`;
  const [txid, output, offset] = data.satPoint.split(':');

  const sharedInfo = {
    chain: CryptoAssetChains.bitcoin,
    category: CryptoAssetCategories.nft,
    protocol: CryptoAssetProtocols.cat21,
    id: data.id,
    number: data.number,
    output,
    txid,
    offset,
    address: data.ownerAddress,
    preview,
    title,
    genesisBlockHeight: data.genesisBlockHeight,
    genesisBlockHash: data.genesisBlockHash,
    genesisTimestamp: dateToUnixTimestamp(new Date(data.genesisTimestamp)),
    value: data.outputValue,
    thumbnailSrc,
  };

  if (!data.mimeType) {
    return {
      ...sharedInfo,
      mimeType: 'other',
      src: '',
    };
  }

  return whenCat21MimeType<Cat21Asset>(data.mimeType, {
    audio: () => ({
      ...sharedInfo,
      mimeType: 'audio',
      name: 'cat21',
      src: primarySrc,
    }),
    gltf: () => ({
      ...sharedInfo,
      mimeType: 'gltf',
      name: 'cat21',
      src: primarySrc,
    }),
    html: () => ({
      ...sharedInfo,
      mimeType: 'html',
      name: 'cat21',
      src: primarySrc,
    }),
    image: () => ({
      ...sharedInfo,
      mimeType: 'image',
      name: 'cat21',
      thumbnailSrc: ordIoSrc,
      src: primarySrc,
    }),
    svg: () => ({
      ...sharedInfo,
      mimeType: 'svg',
      name: 'cat21',
      src: primarySrc,
    }),
    text: () => ({
      ...sharedInfo,
      mimeType: 'text',
      name: 'cat21',
      src: data.contentSrc,
    }),
    video: () => ({
      ...sharedInfo,
      mimeType: 'video',
      name: 'cat21',
      src: primarySrc,
    }),
    other: () => ({
      ...sharedInfo,
      mimeType: 'other',
      name: 'cat21',
      src: data.contentSrc ?? '',
    }),
  });
}
