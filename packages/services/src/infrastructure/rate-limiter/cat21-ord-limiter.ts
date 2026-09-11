import PQueue from 'p-queue';

import { RateLimiterQueueOptions } from './rate-limiter.service';

/**
 * cat21-ord runs on happysrv (we control the box, see CLAUDE.md → happysrv.de)
 * so the public-API rate-limits the upstream BIS limiter targeted (10 req per
 * 1500ms) don't apply. We still queue requests because a flood of address
 * lookups during a multi-account refresh can drown ord while it's also serving
 * the explorer at ord.cat21.space.
 *
 * If this proves too generous (we see ord respond with 5xx or grow long-tailed
 * latency during multi-account refreshes), the right knob is `intervalCap`.
 */
// HACK -- Cat21: removed `export` keyword (cat21 limiter pre-wired; restore on consumer wire-up). HARD RULE #5 — restore on wire-up.
const cat21OrdApiLimiterSettings: RateLimiterQueueOptions = {
  interval: 1000,
  intervalCap: 30,
  timeout: 60000,
};

export const cat21OrdMainnetApiLimiter: PQueue = new PQueue({
  ...cat21OrdApiLimiterSettings,
});
