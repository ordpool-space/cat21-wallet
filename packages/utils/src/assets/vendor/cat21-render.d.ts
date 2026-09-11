/**
 * Types for the vendored `cat21-render.js` bundle.
 *
 * Deliberately narrower than what the bundle exports: only the parse-and-draw
 * path the wallet uses is declared, so the vendored surface stays reviewable
 * and anything else would fail to typecheck rather than sneak in.
 */

/** Traits ord derives alongside the image. Null while a mint is unconfirmed. */
export interface CatTraits {
  readonly genesis: boolean;
  readonly catColors: readonly string[];
  readonly gender: string;
  readonly designIndex: number;
  readonly designPose: string;
  readonly designExpression: string;
  readonly designPattern: string;
  readonly designFacing: string;
  readonly laserEyes: string;
  readonly background: string | null;
  readonly crown: string;
  readonly glasses: string;
}

export interface ParsedCat21 {
  readonly transactionId: string;
  readonly blockId: string | null;
  readonly uniqueId: string;
  /** SVG markup. The sleeping-cat placeholder while unconfirmed. */
  getImage(): string;
  getTraits(): CatTraits | null;
}

/**
 * Minimal transaction shape the parser reads. Matches the Esplora response the
 * parser was written against; `block_hash` absent means unconfirmed.
 */
export interface Cat21ParseInput {
  readonly txid: string;
  readonly locktime: number;
  readonly weight: number;
  readonly fee: number;
  readonly status: { readonly block_hash?: string };
}

export declare class Cat21ParserService {
  /** Returns null when the transaction is not a CAT-21 mint. */
  static parse(transaction: Cat21ParseInput): ParsedCat21 | null;
}
