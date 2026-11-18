import { describe, expect, it } from 'vitest';

import { mayAutoConfirm } from './auto-confirm-gate';

/**
 * The guard that keeps the confirm route from signing an NMH request without a
 * click unless it explicitly declares `mode: 'autonomous'` (audit T1). Without
 * it the route would auto-sign every NMH request, agent mode on or off.
 */
describe('mayAutoConfirm', () => {
  it('confirms an NMH request that declares mode autonomous', () => {
    expect(mayAutoConfirm({ transport: 'mcp-nmh', intent: { mode: 'autonomous' } })).toBe(true);
  });

  it('waits for a click on an NMH request that declares mode manual', () => {
    expect(mayAutoConfirm({ transport: 'mcp-nmh', intent: { mode: 'manual' } })).toBe(false);
  });

  it('waits for a click on an NMH request that omits mode (the silent-sign bypass)', () => {
    expect(mayAutoConfirm({ transport: 'mcp-nmh', intent: {} })).toBe(false);
  });

  it('waits for a click on a popup request, even one that declares autonomous', () => {
    expect(mayAutoConfirm({ transport: 'popup', intent: { mode: 'autonomous' } })).toBe(false);
  });
});
