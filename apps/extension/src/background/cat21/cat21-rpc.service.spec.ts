import { describe, it } from 'vitest';

/**
 * Spec contract for `Cat21RpcService.mint`. The other three methods
 * (transfer / createOffer / acceptOffer) get their own spec files in
 * subsequent iterations because their pipelines diverge meaningfully
 * (acceptOffer in particular takes inbound PSBT bytes and must
 * cross-validate them against the declared intent).
 *
 * The cases below describe the end-to-end behaviour we want for mint.
 * Iteration 2 turns each `it.todo` into a passing assertion by writing
 * the implementation of `enforceMintInvariants`, `buildMintPsbt`, the
 * sign step, and the broadcast step.
 */
describe('Cat21RpcService.mint', () => {

  describe('pipeline ordering', () => {
    it.todo('parses + validates intent shape BEFORE running invariants');

    it.todo('runs invariants BEFORE resolving mode');

    it.todo('resolves mode BEFORE building the PSBT');

    it.todo('builds the PSBT BEFORE post-build assertions');

    it.todo('runs post-build assertions BEFORE signing');

    it.todo('signs BEFORE broadcasting');

    it.todo('refuses to sign if any earlier step threw');
  });

  describe('manual mode (Path 2)', () => {
    it.todo('opens the wallet popup with a Cat21-themed confirmation when mode resolves to manual');

    it.todo('waits for user confirmation before signing');

    it.todo('returns { ok: false, reason: "intent-shape-invalid" } when the user cancels');
  });

  describe('autonomous mode (Path 3)', () => {
    it.todo('signs silently when mode resolves to autonomous (no popup opened)');

    it.todo('records the action in the per-account daily-spend counter so the next call sees it');

    it.todo('returns { ok: false, reason: "policy-denied", detail } when the policy gate denies');

    it.todo('returns { ok: false, reason: "transport-not-trusted-for-autonomous" } when the caller declared autonomous from popup');
  });

  describe('broadcast', () => {
    it.todo('uses mempool dispatch when tx weight is under the standard ceiling');

    it.todo('falls through to Slipstream when tx weight exceeds the standard ceiling');

    it.todo('returns { ok: false, reason: "broadcast-failed", detail } when both channels reject');

    it.todo('returns the SDK-reported channel in the success result');
  });

  describe('integration with the Validated brand', () => {
    it.todo('cannot be invoked with a raw intent that did not pass enforceMintInvariants — TypeScript rejects it at compile time');

    it.todo('a hand-crafted "as Validated<Cat21MintIntent>" cast is caught by a lint rule (planned)');
  });
});
