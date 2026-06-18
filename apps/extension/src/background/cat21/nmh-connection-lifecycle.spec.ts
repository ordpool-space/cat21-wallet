import { describe, expect, it, vi } from 'vitest';

import { createNmhLifecycle } from './nmh-connection-lifecycle';

/**
 * In-memory port + connectNative + setTimeout/clearTimeout fakes.
 * Each test instantiates a fresh `Env` so state never leaks
 * between assertions. Time is virtual — `tick(ms)` fires timers
 * whose deadline falls within the elapsed window.
 */
function makeEnv() {
  const ports: {
    onDisconnect: { addListener(cb: () => void): void };
    onMessage: { addListener(cb: (msg: unknown) => void): void };
    postMessage(msg: unknown): void;
    disconnect(): void;
  }[] = [];
  let virtualNow = 0;
  const timers: { id: number; fireAt: number; cb: () => void }[] = [];
  let timerSeq = 1;

  const connectNative = vi.fn((_app: string) => {
    const dcListeners: (() => void)[] = [];
    const port = {
      onDisconnect: { addListener: (cb: () => void) => dcListeners.push(cb) },
      onMessage: { addListener: () => {} },
      postMessage: () => {},
      disconnect: () => {
        for (const cb of dcListeners) cb();
      },
    };
    ports.push(port);
    return port;
  });

  const attach = vi.fn();
  const onHostNotInstalled = vi.fn();

  function setTimeoutFn(cb: () => void, ms: number) {
    const id = timerSeq++;
    timers.push({ id, fireAt: virtualNow + ms, cb });
    // ReturnType<typeof setTimeout> in Node is NodeJS.Timeout;
    // the harness only uses it as an opaque handle for clear, so
    // a plain number is fine.
    return id as unknown as ReturnType<typeof setTimeout>;
  }
  function clearTimeoutFn(handle: ReturnType<typeof setTimeout>) {
    const id = handle as unknown as number;
    const idx = timers.findIndex(t => t.id === id);
    if (idx !== -1) timers.splice(idx, 1);
  }

  function tick(ms: number) {
    virtualNow += ms;
    const due = timers.filter(t => t.fireAt <= virtualNow);
    for (const t of due) timers.splice(timers.indexOf(t), 1);
    for (const t of due) t.cb();
  }

  function setNow(value: number) {
    virtualNow = value;
  }

  return {
    ports,
    connectNative,
    attach,
    onHostNotInstalled,
    setTimeoutFn,
    clearTimeoutFn,
    tick,
    now: () => virtualNow,
    setNow,
  };
}

describe('createNmhLifecycle.ensureConnected', () => {
  it('connects once and attaches the port on first call', () => {
    const env = makeEnv();
    const lc = createNmhLifecycle({
      applicationName: 'space.cat21.wallet',
      connectNative: env.connectNative,
      attach: env.attach,
      setTimeoutFn: env.setTimeoutFn,
      clearTimeoutFn: env.clearTimeoutFn,
      now: env.now,
    });
    lc.ensureConnected();
    expect(env.connectNative).toHaveBeenCalledTimes(1);
    expect(env.connectNative).toHaveBeenCalledWith('space.cat21.wallet');
    expect(env.attach).toHaveBeenCalledTimes(1);
    expect(lc.state()).toBe('connected');
  });

  it('is idempotent — a second call while connected does NOT connectNative again', () => {
    const env = makeEnv();
    const lc = createNmhLifecycle({
      applicationName: 'space.cat21.wallet',
      connectNative: env.connectNative,
      attach: env.attach,
      setTimeoutFn: env.setTimeoutFn,
      clearTimeoutFn: env.clearTimeoutFn,
      now: env.now,
    });
    lc.ensureConnected();
    lc.ensureConnected();
    lc.ensureConnected();
    expect(env.connectNative).toHaveBeenCalledTimes(1);
  });
});

describe('createNmhLifecycle disconnect handling', () => {
  it('reconnects with initial backoff after a delayed disconnect (host crashed after working)', () => {
    const env = makeEnv();
    const lc = createNmhLifecycle({
      applicationName: 'space.cat21.wallet',
      connectNative: env.connectNative,
      attach: env.attach,
      initialBackoffMs: 1_000,
      installDetectionMs: 250,
      setTimeoutFn: env.setTimeoutFn,
      clearTimeoutFn: env.clearTimeoutFn,
      now: env.now,
      onHostNotInstalled: env.onHostNotInstalled,
    });
    lc.ensureConnected();
    // The "host worked for a while" signal: advance virtual time past
    // the install-detection window, then trigger the disconnect.
    env.tick(5_000);
    env.ports[0].disconnect();
    expect(lc.state()).toBe('backoff');
    expect(env.onHostNotInstalled).not.toHaveBeenCalled();

    // Backoff hasn't expired yet → no new connect.
    env.tick(500);
    expect(env.connectNative).toHaveBeenCalledTimes(1);

    // Backoff fires → reconnect happens.
    env.tick(500);
    expect(env.connectNative).toHaveBeenCalledTimes(2);
    expect(lc.state()).toBe('connected');
  });

  it('resets backoff to initial after a successful reconnect (long-lived port heals the budget)', () => {
    const env = makeEnv();
    const lc = createNmhLifecycle({
      applicationName: 'space.cat21.wallet',
      connectNative: env.connectNative,
      attach: env.attach,
      initialBackoffMs: 100,
      installDetectionMs: 50,
      setTimeoutFn: env.setTimeoutFn,
      clearTimeoutFn: env.clearTimeoutFn,
      now: env.now,
      onHostNotInstalled: env.onHostNotInstalled,
    });
    lc.ensureConnected();
    env.tick(500);
    env.ports[0].disconnect();
    // First reconnect uses initial 100ms backoff.
    env.tick(100);
    expect(env.connectNative).toHaveBeenCalledTimes(2);
    expect(lc.state()).toBe('connected');
    // Port 2 lives a long time, then disconnects → backoff RESETS
    // to initial (the long-lived working connection healed the
    // budget; a fresh disconnect starts fresh).
    env.tick(500);
    env.ports[1].disconnect();
    env.tick(100);
    expect(env.connectNative).toHaveBeenCalledTimes(3);
  });

  it('stops reconnecting when the host disconnects immediately (host not installed)', () => {
    const env = makeEnv();
    const lc = createNmhLifecycle({
      applicationName: 'space.cat21.wallet',
      connectNative: env.connectNative,
      attach: env.attach,
      initialBackoffMs: 100,
      installDetectionMs: 250,
      setTimeoutFn: env.setTimeoutFn,
      clearTimeoutFn: env.clearTimeoutFn,
      now: env.now,
      onHostNotInstalled: env.onHostNotInstalled,
    });
    lc.ensureConnected();
    // Disconnect fires within the install-detection window — heuristic
    // says "host isn't installed", harness gives up.
    env.tick(10);
    env.ports[0].disconnect();
    expect(lc.state()).toBe('gave-up');
    expect(env.onHostNotInstalled).toHaveBeenCalledTimes(1);

    // No reconnect timer should fire; advancing time changes nothing.
    env.tick(10_000);
    expect(env.connectNative).toHaveBeenCalledTimes(1);
  });
});

describe('createNmhLifecycle.disconnect()', () => {
  it('cancels a pending reconnect timer and prevents further connect attempts', () => {
    const env = makeEnv();
    const lc = createNmhLifecycle({
      applicationName: 'space.cat21.wallet',
      connectNative: env.connectNative,
      attach: env.attach,
      initialBackoffMs: 1_000,
      installDetectionMs: 250,
      setTimeoutFn: env.setTimeoutFn,
      clearTimeoutFn: env.clearTimeoutFn,
      now: env.now,
    });
    lc.ensureConnected();
    env.tick(5_000);
    env.ports[0].disconnect();
    expect(lc.state()).toBe('backoff');

    lc.disconnect();
    env.tick(10_000);
    expect(env.connectNative).toHaveBeenCalledTimes(1);
    expect(lc.state()).toBe('idle');
  });
});
