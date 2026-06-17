import type {
  Cat21AcceptOfferIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

/**
 * The human-readable copy a Cat21 confirmation dialog shows the user.
 *
 * Why split this out from the React component:
 *   - the logic is the testable risk surface (wrong title, wrong cap
 *     number, wrong recipient address) — easy to unit-test without
 *     mounting a tree
 *   - the four dialog variants (mint / transfer / create-offer /
 *     accept-offer) collapse to a single switch over `intent.type` (the
 *     existing union has no discriminator field; structural detection
 *     mirrors `cat21IntentToAgentContext`)
 *   - the React layer becomes a thin presentational shell that just
 *     renders the title / paragraphs / buttons from this struct
 */
export interface Cat21ConfirmationCopy {
  /** Dialog title shown at the top, e.g. "Mint a CAT-21 cat?". */
  title: string;
  /**
   * One paragraph each, displayed in order. Each is short (under ~120
   * chars) so the dialog stays scannable without scrolling on the
   * extension's narrow popup width.
   */
  paragraphs: string[];
  /**
   * Up to four `{ label, value }` summary rows ("Recipient: bc1q…",
   * "Fee rate: 5 sat/vB"). Renders as a definition list, monospaced
   * value, address-trimmed where the value looks like an address.
   */
  rows: { label: string; value: string }[];
  /** Label on the "yes, do it" button. */
  approveButtonLabel: string;
  /** Label on the "no, cancel" button. */
  rejectButtonLabel: string;
}

/**
 * Produce the confirmation copy for a Cat21 intent. The intent's
 * variant is detected structurally (same pattern as
 * `cat21IntentToAgentContext`): `priceSats` → create-offer,
 * `offerPsbt` → accept-offer, `catId` → transfer, else mint.
 *
 * The four variants below are intentionally distinct in voice:
 *   - mint: celebratory ("Mint a CAT-21 cat!") — minting is the most
 *     common cat-flow and the one users tend to do impulsively
 *   - transfer: neutral ("Send your cat to ...") — most likely a
 *     gift / sale-settlement, no need to dramatise
 *   - create-offer: market-ish ("List Cat for sale") — emphasises that
 *     this just emits a listing; nothing on-chain happens yet
 *   - accept-offer: careful ("Sell Cat #N to a buyer") — buyer-supplied
 *     PSBT bytes need to be reviewed; voice should make the user pause
 */
export function makeCat21ConfirmationCopy(intent: Cat21Intent): Cat21ConfirmationCopy {
  if ('priceSats' in intent) return createOfferCopy(intent);
  if ('offerPsbt' in intent) return acceptOfferCopy(intent);
  if ('catId' in intent) return transferCopy(intent);
  return mintCopy(intent);
}

function mintCopy(intent: Cat21MintIntent): Cat21ConfirmationCopy {
  const tipValue = intent.tip?.value ?? 0;
  const paragraphs = [
    'Sign this transaction to mint a fresh CAT-21 cat onto the first sat of the first output. The cat lands at the recipient address and is yours immediately on confirmation.',
  ];
  if (tipValue > 0) {
    paragraphs.push(
      `Includes a developer tip of ${tipValue} sats to ${formatAddress(intent.tip!.address)}.`
    );
  }
  return {
    title: 'Mint a CAT-21 cat',
    paragraphs,
    rows: [
      { label: 'Recipient', value: formatAddress(intent.recipient) },
      { label: 'Fee rate', value: `${intent.feeRate} sat/vB` },
    ],
    approveButtonLabel: 'Mint cat',
    rejectButtonLabel: 'Cancel',
  };
}

function transferCopy(intent: Cat21TransferIntent): Cat21ConfirmationCopy {
  return {
    title: 'Send your CAT-21 cat',
    paragraphs: [
      'Sign this transaction to send your cat to a new address. nLockTime=21 is preserved, so the same sat receives a fresh cat in the process.',
    ],
    rows: [
      { label: 'Cat', value: formatCatId(intent.catId) },
      { label: 'Recipient', value: formatAddress(intent.recipient) },
      { label: 'Fee rate', value: `${intent.feeRate} sat/vB` },
    ],
    approveButtonLabel: 'Send cat',
    rejectButtonLabel: 'Cancel',
  };
}

function createOfferCopy(intent: Cat21CreateOfferIntent): Cat21ConfirmationCopy {
  return {
    title: 'List your CAT-21 cat for sale',
    paragraphs: [
      'This publishes a listing — no transaction is broadcast yet. A buyer must submit a buy-offer PSBT before anything moves on-chain.',
      'Until a buyer fills the listing, you can still use, transfer, or unlist the cat.',
    ],
    rows: [
      { label: 'Cat', value: formatCatId(intent.catId) },
      { label: 'Asking price', value: `${intent.priceSats.toLocaleString()} sats` },
      { label: 'Payment to', value: formatAddress(intent.paymentAddress) },
    ],
    approveButtonLabel: 'List cat',
    rejectButtonLabel: 'Cancel',
  };
}

function acceptOfferCopy(intent: Cat21AcceptOfferIntent): Cat21ConfirmationCopy {
  return {
    title: 'Accept a buy offer for your CAT-21 cat',
    paragraphs: [
      `A buyer submitted a PSBT that — when you sign — sends ${formatCatId(intent.expectedCatId)} to them and pays you the listed sats.`,
      'Review the cat id below carefully. Once you approve, the transaction broadcasts immediately.',
    ],
    rows: [
      { label: 'Cat', value: formatCatId(intent.expectedCatId) },
      { label: 'PSBT bytes', value: `${intent.offerPsbt.length} chars` },
    ],
    approveButtonLabel: 'Sell cat',
    rejectButtonLabel: 'Reject offer',
  };
}

function formatAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-8)}`;
}

function formatCatId(catId: string): string {
  // `{txid}i{index}` — show first 8 chars of txid + index suffix.
  const iIdx = catId.lastIndexOf('i');
  if (iIdx <= 0 || iIdx === catId.length - 1) return formatAddress(catId);
  const txid = catId.slice(0, iIdx);
  const suffix = catId.slice(iIdx);
  return `${txid.slice(0, 8)}…${suffix}`;
}
