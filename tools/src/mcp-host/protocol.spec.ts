import { describe, expect, it } from 'vitest';

import {
  NMH_MAX_MESSAGE_BYTES,
  NmhMessageDecoder,
  encodeNmhMessage,
} from './protocol.js';

describe('NMH framing', () => {
  it('roundtrips a small JSON message', () => {
    const message = { type: 'hello', payload: { greeting: 'hi cat21' } };
    const encoded = encodeNmhMessage(message);

    // Header is 4 bytes little-endian length.
    const length = encoded.readUInt32LE(0);
    expect(length).toBe(encoded.byteLength - 4);

    const decoder = new NmhMessageDecoder();
    const decoded = decoder.feed(encoded);
    expect(decoded).toEqual([message]);
  });

  it('decodes a multi-frame chunk in one feed', () => {
    const a = encodeNmhMessage({ type: 'a' });
    const b = encodeNmhMessage({ type: 'b' });
    const both = Buffer.concat([a, b]);

    const decoder = new NmhMessageDecoder();
    const decoded = decoder.feed(both);
    expect(decoded).toEqual([{ type: 'a' }, { type: 'b' }]);
  });

  it('holds a partial frame across feeds and emits when complete', () => {
    const encoded = encodeNmhMessage({ type: 'split', payload: { n: 42 } });
    const half = Math.floor(encoded.byteLength / 2);
    const first = encoded.subarray(0, half);
    const second = encoded.subarray(half);

    const decoder = new NmhMessageDecoder();
    expect(decoder.feed(first)).toEqual([]);
    expect(decoder.feed(second)).toEqual([{ type: 'split', payload: { n: 42 } }]);
  });

  it('refuses to encode messages over the Chrome NMH size ceiling', () => {
    const big = 'x'.repeat(NMH_MAX_MESSAGE_BYTES);
    expect(() => encodeNmhMessage({ type: 'big', payload: big })).toThrowError(
      /exceeds Chrome limit/
    );
  });

  it('refuses to decode an oversized header', () => {
    // Craft a header that claims a body bigger than the ceiling.
    const evilHeader = Buffer.alloc(4);
    evilHeader.writeUInt32LE(NMH_MAX_MESSAGE_BYTES + 1, 0);

    const decoder = new NmhMessageDecoder();
    expect(() => decoder.feed(evilHeader)).toThrowError(/frame size .* exceeds limit/);
  });
});
