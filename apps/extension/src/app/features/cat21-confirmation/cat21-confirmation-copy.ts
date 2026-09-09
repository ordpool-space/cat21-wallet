import type {
  Cat21AcceptOfferIntent,
  Cat21BuyIntent,
  Cat21CreateOfferIntent,
  Cat21Intent,
  Cat21MintIntent,
  Cat21TransferIntent,
} from '@background/cat21/types';

/**
 * The human-readable copy a Cat21 confirmation dialog shows the user.
 *
 * Every approval answers three things and nothing else: what happens,
 * what it costs, and who gets what. No protocol vocabulary (no
 * "nLockTime", no "PSBT", no "first sat of the first output") and no
 * engineering-confidence claims reach the user. Binding rule: §7.6 of
 * `ordpool-sdk/docs/wallet-ux-round2.md`.
 *
 * Why split this out from the React component:
 *   - the logic is the testable risk surface (wrong title, wrong cap
 *     number, wrong recipient address) — easy to unit-test without
 *     mounting a tree
 *   - the five dialog variants (mint / transfer / create-offer /
 *     accept-offer / buy) collapse to a single switch over the intent's
 *     shape (the union has no discriminator field; structural detection
 *     mirrors `cat21IntentToAgentContext`)
 *   - the React layer becomes a thin presentational shell that just
 *     renders the title / paragraphs / rows / buttons from this struct
 */
export interface Cat21ConfirmationCopy {
  /** Dialog title shown at the top, e.g. "Mint a cat". */
  title: string;
  /**
   * One paragraph each, displayed in order. Each is short so the dialog
   * stays scannable without scrolling on the extension's narrow popup
   * width.
   */
  paragraphs: string[];
  /**
   * Up to four `{ label, value }` summary rows ("Goes to: bc1q…",
   * "Fee rate: 5 sat/vB"). Renders as a definition list, monospaced
   * value. A `verify` row is a destination address the person is
   * committing value to: it renders in FULL (never truncated) and
   * space-grouped, so an address-poisoning forgery — which matches only
   * the head and tail — is actually visible (§7.14). Compact rows
   * (amounts, fee, cat id) stay on one line.
   */
  rows: { label: string; value: string; verify?: boolean }[];
  /** Label on the "yes, do it" button. */
  approveButtonLabel: string;
  /** Label on the "no, cancel" button. */
  rejectButtonLabel: string;
}

/**
 * Produce the confirmation copy for a Cat21 intent. The intent's
 * variant is detected structurally (same pattern as
 * `cat21IntentToAgentContext`): `bidSats` → buy, `priceSats` →
 * create-offer, `offerPsbt` → accept-offer, `catId` → transfer,
 * else mint. `bidSats` is checked first because the buy intent also
 * carries `catId`.
 *
 * The five variants say, in the user's words:
 *   - mint: you get a brand-new cat
 *   - transfer: you send a cat to an address
 *   - create-offer: you list a cat for sale; nothing moves yet
 *   - accept-offer: a buyer offered; you sell and get paid
 *   - buy: you bid on a cat; the seller must accept
 */
export function makeCat21ConfirmationCopy(intent: Cat21Intent): Cat21ConfirmationCopy {
  if ('bidSats' in intent) return buyCopy(intent);
  if ('priceSats' in intent) return createOfferCopy(intent);
  if ('offerPsbt' in intent) return acceptOfferCopy(intent);
  if ('catId' in intent) return transferCopy(intent);
  return mintCopy(intent);
}

function mintCopy(intent: Cat21MintIntent): Cat21ConfirmationCopy {
  const { tip } = intent;
  const paragraphs = [
    'You create a brand-new cat. It goes to the address below and is yours as soon as the transaction confirms.',
  ];
  if (tip && tip.value > 0) {
    paragraphs.push(
      `This also sends a ${tip.value.toLocaleString()} sats tip to ${formatAddress(tip.address)}.`
    );
  }
  return {
    title: 'Mint a cat',
    paragraphs,
    rows: [
      verifyAddressRow('Goes to', intent.recipient),
      { label: 'Fee rate', value: `${intent.feeRate} sat/vB` },
    ],
    approveButtonLabel: 'Mint cat',
    rejectButtonLabel: 'Cancel',
  };
}

function transferCopy(intent: Cat21TransferIntent): Cat21ConfirmationCopy {
  return {
    title: 'Send your cat',
    paragraphs: [
      'You send this cat to the address below. You pay a network fee; the cat itself travels intact.',
    ],
    rows: [
      { label: 'Cat', value: formatCatId(intent.catId) },
      verifyAddressRow('Goes to', intent.recipient),
      { label: 'Fee rate', value: `${intent.feeRate} sat/vB` },
    ],
    approveButtonLabel: 'Send cat',
    rejectButtonLabel: 'Cancel',
  };
}

function createOfferCopy(intent: Cat21CreateOfferIntent): Cat21ConfirmationCopy {
  return {
    title: 'List your cat for sale',
    paragraphs: [
      'You list this cat for sale at the price below. Nothing moves on-chain yet: a buyer has to accept your price before the cat changes hands.',
      'You sign once to prove the cat is yours, then it appears on the marketplace. You can re-list at a new price or take it down any time.',
    ],
    rows: [
      { label: 'Cat', value: formatCatId(intent.catId) },
      { label: 'Price', value: `${intent.priceSats.toLocaleString()} sats` },
      verifyAddressRow('Paid to', intent.paymentAddress),
    ],
    approveButtonLabel: 'List cat',
    rejectButtonLabel: 'Cancel',
  };
}

function acceptOfferCopy(intent: Cat21AcceptOfferIntent): Cat21ConfirmationCopy {
  return {
    title: 'Sell your cat',
    paragraphs: [
      'A buyer offered to buy this cat. When you approve, the cat goes to them and you are paid the amount below.',
      'Check the cat and the amount, then approve. It goes through right away.',
    ],
    rows: [
      { label: 'Cat', value: formatCatId(intent.expectedCatId) },
      { label: 'You get', value: `${intent.expectedPriceSats.toLocaleString()} sats` },
    ],
    approveButtonLabel: 'Sell cat',
    rejectButtonLabel: 'Reject offer',
  };
}

function buyCopy(intent: Cat21BuyIntent): Cat21ConfirmationCopy {
  return {
    title: `Bid on Cat #${intent.catNumber}`,
    paragraphs: [
      `You offer to buy Cat #${intent.catNumber} for the amount below. If the seller accepts, you pay them and the cat lands in your wallet.`,
      'Your funds are committed to this bid now. Nothing moves until the seller accepts, and another buyer could outbid you first.',
    ],
    rows: [
      { label: 'Cat', value: `#${intent.catNumber}` },
      { label: 'You pay', value: `${intent.bidSats.toLocaleString()} sats` },
      verifyAddressRow("Seller's address", intent.sellerPaymentAddress),
      { label: 'Fee rate', value: `${intent.feeRate} sat/vB` },
    ],
    approveButtonLabel: 'Place bid',
    rejectButtonLabel: 'Cancel',
  };
}

/**
 * A destination-address row the person must be able to VERIFY: the full
 * address (never truncated), space-grouped in fours. Address poisoning
 * forges a lookalike whose head and tail match the real one, so a
 * head…tail rendering hides the attack; the full grouped string is what
 * makes a middle mismatch visible. §7.14.
 */
function verifyAddressRow(label: string, address: string): {
  label: string;
  value: string;
  verify: true;
} {
  return { label, value: groupAddress(address), verify: true };
}

/** Space-group a string in fours: "bc1qw508…" -> "bc1q w508 …". */
function groupAddress(addr: string): string {
  return addr.replace(/(.{4})/gu, '$1 ').trim();
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
