import { Cat21MimeType } from '../cat21-mime-type.model';
import { Sip9Asset } from './sip9-asset.model';

export const CryptoAssetChains = {
  bitcoin: 'bitcoin',
  stacks: 'stacks',
} as const;
export const CryptoAssetCategories = {
  fungible: 'fungible',
  nft: 'nft',
} as const;
export const FungibleCryptoAssetProtocols = {
  nativeBtc: 'nativeBtc',
  nativeStx: 'nativeStx',
  sip10: 'sip10',
} as const;
export const NonFungibleCryptoAssetProtocols = {
  sip9: 'sip9',
  /* HACK -- Cat21: 'cat21' protocol per ADR-12. Cats surface as a dedicated
   * non-fungible protocol so the existing collectibles UI can render them
   * without a separate code path. */
  cat21: 'cat21',
} as const;
export const CryptoAssetProtocols = {
  ...FungibleCryptoAssetProtocols,
  ...NonFungibleCryptoAssetProtocols,
} as const;

export type CryptoAssetChain = keyof typeof CryptoAssetChains;
export type CryptoAssetCategory = keyof typeof CryptoAssetCategories;
export type FungibleCryptoAssetProtocol = keyof typeof FungibleCryptoAssetProtocols;
export type NonFungibleCryptoAssetProtocol = keyof typeof NonFungibleCryptoAssetProtocols;
export type CryptoAssetProtocol = FungibleCryptoAssetProtocol | NonFungibleCryptoAssetProtocol;

export interface BaseCryptoAsset {
  readonly chain: CryptoAssetChain;
  readonly category: CryptoAssetCategory;
  readonly protocol: CryptoAssetProtocol;
}

// Fungible asset types
interface BaseFungibleCryptoAsset extends BaseCryptoAsset {
  readonly category: 'fungible';
  readonly protocol: FungibleCryptoAssetProtocol;
  readonly symbol: string;
  readonly decimals: number;
  readonly hasMemo: boolean;
}
export interface BtcAsset extends BaseFungibleCryptoAsset {
  readonly chain: 'bitcoin';
  readonly protocol: 'nativeBtc';
  readonly name: 'Bitcoin';
  readonly symbol: 'BTC';
}
export interface StxAsset extends BaseFungibleCryptoAsset {
  readonly chain: 'stacks';
  readonly protocol: 'nativeStx';
  readonly name: 'Stacks';
  readonly symbol: 'STX';
}
export interface Sip10Asset extends BaseFungibleCryptoAsset {
  readonly chain: 'stacks';
  readonly protocol: 'sip10';
  readonly name: string;
  readonly canTransfer: boolean;
  readonly assetId: string;
  readonly contractId: string;
  readonly imageCanonicalUri: string;
  readonly symbol: string;
}
export type NativeCryptoAsset = BtcAsset | StxAsset;
export type FungibleCryptoAsset = NativeCryptoAsset | Sip10Asset;

// NFT asset types
export interface BaseNonFungibleCryptoAsset extends BaseCryptoAsset {
  readonly category: 'nft';
  readonly protocol: NonFungibleCryptoAssetProtocol;
}

/* HACK -- Cat21: Cat21Asset per ADR-12. cat21-ord serves cats as
 * inscription-shaped records on the wire; the parsed type surfaced to the
 * collectibles pipeline carries cat-flavoured field names. */
export interface Cat21Asset extends BaseNonFungibleCryptoAsset {
  readonly chain: 'bitcoin';
  readonly protocol: 'cat21';
  readonly id: string;
  readonly mimeType: Cat21MimeType;
  readonly number: number;
  readonly address: string;
  readonly title: string;
  readonly txid: string;
  readonly output: string;
  readonly offset: string;
  readonly preview: string;
  readonly src: string;
  readonly thumbnailSrc?: string;
  readonly value: string;
  readonly genesisBlockHash: string;
  readonly genesisTimestamp: number;
  readonly genesisBlockHeight: number;
}

export type NonFungibleCryptoAsset = Sip9Asset | Cat21Asset;

export type CryptoAsset = FungibleCryptoAsset | NonFungibleCryptoAsset;

export interface FungibleAssetId {
  protocol: FungibleCryptoAssetProtocol;
  id: string;
}
