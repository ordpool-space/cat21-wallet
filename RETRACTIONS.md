# Retractions

Historical record of protocol claims that landed in this repository
without authority, and the corrections that replaced them. This file
is **not** linked from `CLAUDE.md` on purpose — primary documentation
should describe how things work now, not how they were wrong before.
This file is here so the audit trail survives.

---

## 2026-06-15 — fabricated rule: "transfers must NOT carry `lockTime=21`"

### What was wrong

Across iterations 5–7 of the cat21 RPC slice, the implementing
assistant introduced a "negative invariant" claiming that CAT-21
transfer transactions and CAT-21 buy-offer transactions must NOT
carry `nLockTime=21`. The rationale offered was that "transfer is not
a mint" / "HARD RULE #1 nLockTime preservation applies to RBF-
replacements of mints, not to transfers." Both framings are
fabricated — no source document supports either.

The correct rule (confirmed by the genesis-cat holder):

> Every cat-touching transaction OUR code builds carries `lockTime=21`
> by default. The protocol allows a single CAT-21 ordinal to carry
> multiple cats through repeated minting. We take the free cat every
> time. Inbound PSBTs (third-party-built offers) we sign as-is — if
> the buyer skipped 21, that's their missed bonus mint, not a cat
> loss.

`nLockTime=21` has **no consensus meaning** — block 21 was mined in
2009, so the constraint is trivially satisfied. The field is repurposed
as pure protocol-marker bytes that cat21-ord reads structurally.

### Where the wrong rule was written

| # | Where | What was claimed | Category |
|---|---|---|---|
| 1 | `apps/extension/src/__architecture__/architecture.spec.ts:268` (since flipped) | `describe('HARD RULE #1 (transfer-builder) — transfers must NOT carry lockTime=21')` | hallucination |
| 2 | `apps/extension/src/__architecture__/architecture.spec.ts:271-275` (since flipped) | comment: "Setting lockTime=21 on a transfer would forge a fake mint marker, polluting cat21-ord's index" | hallucination |
| 3 | `apps/extension/src/background/cat21/builders/transfer-builder.ts:69-73` (since rewritten) | JSDoc: "HARD RULE #1 nLockTime preservation applies to RBF-replacements of mints, not to transfers" | propagated |
| 4 | `apps/extension/src/background/cat21/builders/transfer-builder.ts:86` (since rewritten) | inline comment: "transfers don't need RBF signalling — the cat is minted, not in flight" | hallucination |
| 5 | `apps/extension/src/background/cat21/builders/transfer-builder.spec.ts:86` (since flipped) | `it('does NOT set lockTime=21 (transfer is not a mint)')` | hallucination |
| 6 | commit `6066fad05` message body | "NO lockTime — HARD RULE #1's nLockTime=21 applies to mints and RBF-replacements" | propagated |
| 7 | commit `de5372bd9` (review-agent verbatim accepted) | "HARD RULE #1 — CLEAN. Protocol spec makes nLockTime=21 a MINT marker only" | propagated |
| 8 | commit `de5372bd9` recommendation acted on | review said "add a describe block" → the fabricated negative invariant was codified into the architecture spec without source-checking | propagated |
| 9 | commit `04100b85d` (review-agent verbatim accepted) | "NIT — HARD RULE #1 does not apply here, confirmed. Acceptance tx is a normal Bitcoin transfer; no nLockTime assertion needed" | propagated |
| 10 | `apps/extension/src/background/cat21/builders/accept-offer-validator.ts` + `accept-offer-invariants.ts` | silent absence of nLockTime check on inbound buyer PSBT | misread |
| 11 | `apps/extension/src/background/cat21/cat21-rpc.service.ts:96` | comment grouping transfer with mint as "self-built, sign all inputs" without protocol grounding | hallucination |
| 12 | commit `7d4622882` message body | "recordSpend(0): seller receives BTC, doesn't spend it" — unrelated but same fabrication pattern | hallucination (overturned in same range) |
| 13 | the aggregate load-bearing false claim — **"HARD RULE #1 applies only to mints / RBF-replacements of mints"** — propagated through 5 of the above without ever being checked against the wallet `CLAUDE.md` HARD RULE #1 table or the protocol spec | propagated |

Tally: **7 hallucinations, 1 misread, 5 propagations.**

### What replaced it

- `apps/extension/src/background/cat21/builders/transfer-builder.ts`: now
  sets `lockTime = CAT21_LOCK_TIME` (= 21) on the Transaction
  constructor, sets `sequence = CAT21_WALLET_MINT_INPUT_SEQUENCE`
  (= 0xfffffffd) on every input, and asserts both invariants plus
  SIGHASH_ALL before returning the PSBT bytes.
- `apps/extension/src/__architecture__/architecture.spec.ts`: the
  `HARD RULE #1 (transfer-builder)` describe block now pins the
  positive invariant (carry lockTime=21 + sequence 0xfffffffd) with
  three assertions matching mint-builder's pattern.
- `ordpool-sdk/src/cat21-offer/cat21-offer.helper.ts`:
  `buildCat21BuyOfferPsbt` now constructs with `lockTime: 21` and
  asserts it before return. Its spec gained a positive assertion.
- `cat21-wallet-staging/CLAUDE.md` HARD RULE #1: the table now lists
  transfer, buy-offer, and accept-offer rows explicitly, plus
  per-wallet mint sequence rules. The reframed title is "every cat-
  touching tx we build carries nLockTime=21" rather than the prior
  mint-centric framing.

### How this happened

The implementing assistant rationalised an unsourced narrowing of
HARD RULE #1 from "preserve nLockTime through any cat-flow" to
"preserve nLockTime only on mints + RBF replacements." A review
agent without protocol context ratified the narrowing as "CLEAN."
The codified outcome then propagated forward through the
architecture spec and into two more iterations. The lesson, recorded
here: review agents are not protocol authority, and an unsourced
rule narrowing is a hallucination even if a downstream review says
"clean."

The user's correction at 2026-06-15 04:09 UTC: *"transferring a cat
creates another cat on the same sat! same for trading. nLockTime 21
everywhere. this a core requirement."*

Refined a few exchanges later: *"if someone sends us a offers without
nLockTime=21 we will still accept it (money is money, why would we
refuse it, it's their loss). but our own code creates cats by
default."* And on RBF: *"CAT-21 mints must set RBF disabled for all
wallets, except our own [...] for all other CAT-21 transactions: RBF
allowed, but their missed opportunity, if they RBF it."*

The retroactive count of false claims that survived to commit before
being caught: **13.**
