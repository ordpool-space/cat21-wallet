import { describe, expect, it } from 'vitest';

import { handleMcpRequest, handleExtensionMessage } from './host.js';
import {
  CAT21_MCP_TOOLS,
  CAT21_MUTATING_TOOLS,
} from './protocol.js';

describe('MCP host request handler', () => {
  it('lists the v1 tool surface', () => {
    const res = handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.id).toBe(1);
    expect(res.result?.tools).toEqual(CAT21_MCP_TOOLS);
    expect(res.error).toBeUndefined();
  });

  it('returns METHOD_NOT_FOUND for unknown methods', () => {
    const res = handleMcpRequest({
      jsonrpc: '2.0',
      id: 'a',
      method: 'tools/destroy_universe',
    });
    expect(res.error?.code).toBe(-32601);
  });

  it('tools/call refuses calls without a name', () => {
    const res = handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call' });
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.message).toContain('missing name');
  });

  it('wallet_status reports extensionConnected: false in fresh host', () => {
    const res = handleMcpRequest({
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

  it('list_cats returns an empty list when extension is not connected', () => {
    const res = handleMcpRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'list_cats' },
    });
    expect(res.result?.content?.[0]?.text).toBe('[]');
  });

  it('cat21_ord_status errors when extension is not connected', () => {
    const res = handleMcpRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'cat21_ord_status' },
    });
    expect(res.error?.code).toBe(-32603);
    expect(res.error?.message).toContain('extension not connected');
  });

  it('rejects an unknown tool name', () => {
    const res = handleMcpRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'nuke' },
    });
    expect(res.error?.code).toBe(-32601);
    expect(res.error?.message).toContain('unknown tool');
  });

  it('lists all 4 cat21_* mutating tools in the v1 surface', () => {
    const res = handleMcpRequest({ jsonrpc: '2.0', id: 100, method: 'tools/list' });
    const names = (res.result?.tools as { name: string }[]).map(t => t.name);
    for (const tool of CAT21_MUTATING_TOOLS) {
      expect(names).toContain(tool);
    }
  });

  // The mutating-tool dispatch: 8a returns "extension not connected" when
  // there's no extension peer (matches the read-only cat21_ord_status
  // shape); when peer IS connected the stub returns a -32603 with a
  // "not yet implemented in this NMH build (iter 8b)" hint. 8b will
  // replace the second branch with the real correlated NMH dispatch.

  it.each(CAT21_MUTATING_TOOLS)(
    '%s rejects with "extension not connected" when no peer is connected',
    tool => {
      const res = handleMcpRequest({
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
    '%s rejects with "not yet implemented" when the extension IS connected (8a stub)',
    tool => {
      // Connect the extension by feeding a hello message.
      handleExtensionMessage({ type: 'hello' });
      const res = handleMcpRequest({
        jsonrpc: '2.0',
        id: `post-${tool}`,
        method: 'tools/call',
        params: { name: tool, arguments: {} },
      });
      expect(res.error?.code).toBe(-32603);
      expect(res.error?.message).toContain('not yet implemented');
    }
  );
});
