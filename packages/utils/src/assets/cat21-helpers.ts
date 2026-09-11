import { CAT21_LOCK_TIME, CAT21_SITE_URL } from '@leather.io/constants';
import {
  Cat21Asset,
  Cat21MimeType,
  CryptoAssetCategories,
  CryptoAssetChains,
  CryptoAssetProtocols,
} from '@leather.io/models';

import { dateToUnixTimestamp } from '../time';
import { Cat21ParserService } from './vendor/cat21-render.js';

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
  /** Mint fee in sats. With weight it gives the fee rate, which picks the palette. */
  readonly fee: number;
  /** Mint tx weight. Divided by 4 for vsize, then fee/vsize is the fee rate. */
  readonly weight: number;
}

/**
 * Draws the cat and returns it as a data URI, ready for an `<img src>`.
 *
 * The txid comes from `data.id` (the inscription id, `<mintTxid>i0`) and NOT
 * from `satPoint`. A satpoint tracks where the cat lives *now*, so after a
 * transfer it names a different transaction and would draw a different cat.
 *
 * Returns an empty string rather than throwing: a cat that cannot be drawn is
 * a missing picture, never a broken collectibles list.
 */
function renderCat21Svg(data: CreateCat21Data): string {
  // parse() catches its own errors and returns null, but getImage() runs
  // lazily and its SVG generation is outside that catch, so the whole render
  // is wrapped to honour the no-throw contract for any input.
  try {
    const parsed = Cat21ParserService.parse({
      txid: data.id.replace(/i\d+$/, ''),
      locktime: CAT21_LOCK_TIME,
      weight: data.weight,
      fee: data.fee,
      // Absent block hash is the unconfirmed case; the parser answers with the
      // sleeping-cat placeholder and null traits rather than failing.
      status: { block_hash: data.genesisBlockHash || undefined },
    });

    const svg = parsed?.getImage();
    if (!svg) return '';

    // encodeURIComponent, not base64: backgrounds embed non-ASCII text (the
    // Cyberpunk variant renders the manifesto) and btoa throws on those.
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return '';
  }
}

export function createCat21Asset(data: CreateCat21Data): Cat21Asset {
  /* HACK -- Cat21: cats render locally, they are not fetched. A CAT-21 mint
   * carries no inscription envelope and no content bytes: the image derives
   * from SHA256(mintTxid + blockHash), with the fee rate picking the palette.
   * External ord instances have nothing to serve at a cat's id and answer 404
   * for every one, so the vendored renderer draws it here instead. */
  const renderedSrc = renderCat21Svg(data);
  const thumbnailSrc = data.thumbnailSrc ?? renderedSrc;
  const primarySrc = data.contentSrc || renderedSrc;
  const preview = `${CAT21_SITE_URL}/cat/${data.number}`;
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
      thumbnailSrc,
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
