import { describe, expect, it, vi } from 'vitest';

import { handleExtensionMessage, handleMcpRequest } from './host.js';
import { CAT21_MCP_TOOLS, CAT21_MUTATING_TOOLS } from './protocol.js';

describe('MCP host request handler', () => {
  it('lists the v1 tool surface', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.id).toBe(1);
    expect(res.result?.tools).toEqual(CAT21_MCP_TOOLS);
    expect(res.error).toBeUndefined();
  });

  it('returns METHOD_NOT_FOUND for unknown methods', async () => {
    const res = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 'a',
      method: 'tools/destroy_universe',
    });
    expect(res.error?.code).toBe(-32601);
  });

  it('tools/call refuses calls without a name', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call' });
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.message).toContain('missing name');
  });

  it('wallet_status reports extensionConnected: false in fresh host', async () => {
    const res = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'wallet_status' },
    });
    const text = res.result?.content?.[0]?.text;
    expect(typeof text).toBe('string');
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty('extensionConnected');
  });

  it('list_cats returns an empty list when extension is not connected', async () => {
    const res = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'list_cats' },
    });
    expect(res.result?.content?.[0]?.text).toBe('[]');
  });

  it('cat21_ord_status errors when extension is not connected', async () => {
    const res = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'cat21_ord_status' },
    });
    expect(res.error?.code).toBe(-32603);
    expect(res.error?.message).toContain('extension not connected');
  });

  it('rejects an unknown tool name', async () => {
    const res = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'nuke' },
    });
    expect(res.error?.code).toBe(-32601);
    expect(res.error?.message).toContain('unknown tool');
  });

  it('lists all 4 cat21_* mutating tools in the v1 surface', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 100, method: 'tools/list' });
    const names = (res.result?.tools as { name: string }[]).map(t => t.name);
    for (const tool of CAT21_MUTATING_TOOLS) {
      expect(names).toContain(tool);
    }
  });

  it.each(CAT21_MUTATING_TOOLS)(
    '%s rejects with "extension not connected" when no peer is connected',
    async tool => {
      const res = await handleMcpRequest({
        jsonrpc: '2.0',
        id: `pre-${tool}`,
        method: 'tools/call',
        params: { name: tool, arguments: {} },
      });
      expect(res.error?.code).toBe(-32603);
      expect(res.error?.message).toContain('extension not connected');
    }
  );

  it.each(CAT21_MUTATING_TOOLS)(
    '%s dispatches to the extension and surfaces the Cat21RpcResult when peer responds',
    async tool => {
      handleExtensionMessage({ type: 'hello' });
      // Issue the call, then simulate the extension's reply.
      const corrId = `dispatch-${tool}`;
      const callPromise = handleMcpRequest({
        jsonrpc: '2.0',
        id: corrId,
        method: 'tools/call',
        params: { name: tool, arguments: {} },
      });
      // Microtask boundary: let the host enqueue the pending promise before
      // we reply.
      await Promise.resolve();
      handleExtensionMessage({
        type: `${tool}:result`,
        id: corrId,
        payload: { ok: true, value: { kind: 'broadcast', txid: 'tx-test', channel: 'mempool' } },
      });
      const res = await callPromise;
      const text = res.result?.content?.[0]?.text;
      expect(typeof text).toBe('string');
      const parsed = JSON.parse(text);
      expect(parsed).toEqual({
        ok: true,
        value: { kind: 'broadcast', txid: 'tx-test', channel: 'mempool' },
      });
    }
  );

  it('mutating call surfaces a denial payload verbatim', async () => {
    handleExtensionMessage({ type: 'hello' });
    const corrId = 'denial-mint';
    const callPromise = handleMcpRequest({
      jsonrpc: '2.0',
      id: corrId,
      method: 'tools/call',
      params: { name: 'cat21_mint', arguments: { mode: 'autonomous' } },
    });
    await Promise.resolve();
    handleExtensionMessage({
      type: 'cat21_mint:result',
      id: corrId,
      payload: { ok: false, value: { reason: 'policy-denied', detail: 'spend-cap exceeded' } },
    });
    const res = await callPromise;
    const text = res.result?.content?.[0]?.text;
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({
      ok: false,
      value: { reason: 'policy-denied', detail: 'spend-cap exceeded' },
    });
  });

  it('mutating call times out and surfaces a broadcast-failed denial', async () => {
    // Drive the real timeout path (host.ts: setTimeout → reject → the `.catch`
    // that maps to a broadcast-failed denial) with fake timers, so we exercise
    // it deterministically without waiting the full MUTATION_TIMEOUT_MS and
    // without changing production. The extension NEVER replies, so only the
    // timer resolves the pending call.
    vi.useFakeTimers();
    try {
      handleExtensionMessage({ type: 'hello' });
      const corrId = 'timeout-mint';
      const callPromise = handleMcpRequest({
        jsonrpc: '2.0',
        id: corrId,
        method: 'tools/call',
        params: { name: 'cat21_mint', arguments: { mode: 'autonomous' } },
      });
      // Advance past the module's MUTATION_TIMEOUT_MS (60_000ms default, read at
      // load with no CAT21_MCP_TIMEOUT_MS set) to fire the pending timer.
      await vi.advanceTimersByTimeAsync(60_000);
      const res = await callPromise;
      const text = res.result?.content?.[0]?.text;
      expect(typeof text).toBe('string');
      const parsed = JSON.parse(text);
      // Must be a broadcast-failed denial whose detail names the timeout — a
      // mutation that drops the `.catch`, changes the reason, or never fires the
      // timer breaks this (no silent placeholder-green).
      expect(parsed.ok).toBe(false);
      expect(parsed.value.reason).toBe('broadcast-failed');
      expect(parsed.value.detail).toMatch(/cat21_mint timed out after \d+ms/);
    } finally {
      vi.useRealTimers();
    }
  });
});
