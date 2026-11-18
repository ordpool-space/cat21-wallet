/* eslint-disable */
// @ts-nocheck
/**
 * VENDORED — do not edit by hand.
 *
 * Standalone CAT-21 cat renderer, bundled from ordpool-parser with no runtime
 * dependencies. Regenerate with, from an ordpool-parser checkout:
 *
 *   node_modules/.bin/esbuild src/cat21/cat21-bundle.ts \
 *     --bundle --format=esm --target=es2020 \
 *     --outfile=<wallet>/packages/utils/src/assets/vendor/cat21-render.js
 *
 * Source: ordpool-space/ordpool-parser @ 02d6e4d97c111fe61264be5498be20ca3f71cf12
 *
 * Vendored rather than depended upon because ordpool-parser publishes only
 * `src/` and builds via a `prepare` script, which pnpm refuses to run for
 * git-hosted packages (ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED). The SDK is
 * consumable because it ships pre-built artifacts; the parser does not.
 *
 * Safe to freeze: the cat rendering algorithm is fixed by the CAT-21 protocol.
 * An image is SHA256(mintTxid + blockHash) with the fee rate picking the
 * palette, so changing this file would change what a cat looks like.
 */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value })
    : (obj[key] = value);
var __publicField = (obj, key, value) =>
  __defNormalProp(obj, typeof key !== 'symbol' ? key + '' : key, value);

// src/lib/conversions.ts
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[j] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// src/lib/sha256-uint8array.ts
var K = [
  1116352408 | 0,
  1899447441 | 0,
  3049323471 | 0,
  3921009573 | 0,
  961987163 | 0,
  1508970993 | 0,
  2453635748 | 0,
  2870763221 | 0,
  3624381080 | 0,
  310598401 | 0,
  607225278 | 0,
  1426881987 | 0,
  1925078388 | 0,
  2162078206 | 0,
  2614888103 | 0,
  3248222580 | 0,
  3835390401 | 0,
  4022224774 | 0,
  264347078 | 0,
  604807628 | 0,
  770255983 | 0,
  1249150122 | 0,
  1555081692 | 0,
  1996064986 | 0,
  2554220882 | 0,
  2821834349 | 0,
  2952996808 | 0,
  3210313671 | 0,
  3336571891 | 0,
  3584528711 | 0,
  113926993 | 0,
  338241895 | 0,
  666307205 | 0,
  773529912 | 0,
  1294757372 | 0,
  1396182291 | 0,
  1695183700 | 0,
  1986661051 | 0,
  2177026350 | 0,
  2456956037 | 0,
  2730485921 | 0,
  2820302411 | 0,
  3259730800 | 0,
  3345764771 | 0,
  3516065817 | 0,
  3600352804 | 0,
  4094571909 | 0,
  275423344 | 0,
  430227734 | 0,
  506948616 | 0,
  659060556 | 0,
  883997877 | 0,
  958139571 | 0,
  1322822218 | 0,
  1537002063 | 0,
  1747873779 | 0,
  1955562222 | 0,
  2024104815 | 0,
  2227730452 | 0,
  2361852424 | 0,
  2428436474 | 0,
  2756734187 | 0,
  3204031479 | 0,
  3329325298 | 0,
];
var algorithms = {
  sha256: 1,
};
function createHash(algorithm) {
  if (algorithm && !algorithms[algorithm] && !algorithms[algorithm.toLowerCase()]) {
    throw new Error('Digest method not supported');
  }
  return new Hash();
}
var Hash = class {
  // surrogate pair
  constructor() {
    // first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19
    __publicField(this, 'A', 1779033703 | 0);
    __publicField(this, 'B', 3144134277 | 0);
    __publicField(this, 'C', 1013904242 | 0);
    __publicField(this, 'D', 2773480762 | 0);
    __publicField(this, 'E', 1359893119 | 0);
    __publicField(this, 'F', 2600822924 | 0);
    __publicField(this, 'G', 528734635 | 0);
    __publicField(this, 'H', 1541459225 | 0);
    __publicField(this, '_byte');
    __publicField(this, '_word');
    __publicField(this, '_size', 0);
    __publicField(this, '_sp', 0);
    if (!sharedBuffer || sharedOffset >= 8e3 /* allocTotal */) {
      sharedBuffer = new ArrayBuffer(8e3 /* allocTotal */);
      sharedOffset = 0;
    }
    this._byte = new Uint8Array(sharedBuffer, sharedOffset, 80 /* allocBytes */);
    this._word = new Int32Array(sharedBuffer, sharedOffset, 20 /* allocWords */);
    sharedOffset += 80 /* allocBytes */;
  }
  update(data) {
    if ('string' === typeof data) {
      return this._utf8(data);
    }
    if (data == null) {
      throw new TypeError('Invalid type: ' + typeof data);
    }
    const byteOffset = data.byteOffset;
    const length = data.byteLength;
    let blocks = (length / 64) /* inputBytes */ | 0;
    let offset = 0;
    if (blocks && !(byteOffset & 3) && !((this._size % 64) /* inputBytes */)) {
      const block = new Int32Array(data.buffer, byteOffset, blocks * 16 /* inputWords */);
      while (blocks--) {
        this._int32(block, offset >> 2);
        offset += 64 /* inputBytes */;
      }
      this._size += offset;
    }
    const BYTES_PER_ELEMENT = data.BYTES_PER_ELEMENT;
    if (BYTES_PER_ELEMENT !== 1 && data.buffer) {
      const rest = new Uint8Array(data.buffer, byteOffset + offset, length - offset);
      return this._uint8(rest);
    }
    if (offset === length) return this;
    return this._uint8(data, offset);
  }
  _uint8(data, offset) {
    const { _byte, _word } = this;
    const length = data.length;
    offset = offset | 0;
    while (offset < length) {
      const start = this._size % 64; /* inputBytes */
      let index = start;
      while (offset < length && index < 64 /* inputBytes */) {
        _byte[index++] = data[offset++];
      }
      if (index >= 64 /* inputBytes */) {
        this._int32(_word);
      }
      this._size += index - start;
    }
    return this;
  }
  _utf8(text) {
    const { _byte, _word } = this;
    const length = text.length;
    let surrogate = this._sp;
    for (let offset = 0; offset < length; ) {
      const start = this._size % 64; /* inputBytes */
      let index = start;
      while (offset < length && index < 64 /* inputBytes */) {
        let code = text.charCodeAt(offset++) | 0;
        if (code < 128) {
          _byte[index++] = code;
        } else if (code < 2048) {
          _byte[index++] = 192 | (code >>> 6);
          _byte[index++] = 128 | (code & 63);
        } else if (code < 55296 || code > 57343) {
          _byte[index++] = 224 | (code >>> 12);
          _byte[index++] = 128 | ((code >>> 6) & 63);
          _byte[index++] = 128 | (code & 63);
        } else if (surrogate) {
          code = ((surrogate & 1023) << 10) + (code & 1023) + 65536;
          _byte[index++] = 240 | (code >>> 18);
          _byte[index++] = 128 | ((code >>> 12) & 63);
          _byte[index++] = 128 | ((code >>> 6) & 63);
          _byte[index++] = 128 | (code & 63);
          surrogate = 0;
        } else {
          surrogate = code;
        }
      }
      if (index >= 64 /* inputBytes */) {
        this._int32(_word);
        _word[0] = _word[16 /* inputWords */];
      }
      this._size += index - start;
    }
    this._sp = surrogate;
    return this;
  }
  _int32(data, offset) {
    let { A, B, C, D, E, F, G, H } = this;
    let i = 0;
    offset = offset | 0;
    while (i < 16 /* inputWords */) {
      W[i++] = swap32(data[offset++]);
    }
    for (i = 16 /* inputWords */; i < 64 /* workWords */; i++) {
      W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) | 0;
    }
    for (i = 0; i < 64 /* workWords */; i++) {
      const T1 = (H + sigma1(E) + ch(E, F, G) + K[i] + W[i]) | 0;
      const T2 = (sigma0(A) + maj(A, B, C)) | 0;
      H = G;
      G = F;
      F = E;
      E = (D + T1) | 0;
      D = C;
      C = B;
      B = A;
      A = (T1 + T2) | 0;
    }
    this.A = (A + this.A) | 0;
    this.B = (B + this.B) | 0;
    this.C = (C + this.C) | 0;
    this.D = (D + this.D) | 0;
    this.E = (E + this.E) | 0;
    this.F = (F + this.F) | 0;
    this.G = (G + this.G) | 0;
    this.H = (H + this.H) | 0;
  }
  digest(encoding) {
    const { _byte, _word } = this;
    let i = this._size % 64 /* inputBytes */ | 0;
    _byte[i++] = 128;
    while (i & 3) {
      _byte[i++] = 0;
    }
    i >>= 2;
    if (i > 14 /* highIndex */) {
      while (i < 16 /* inputWords */) {
        _word[i++] = 0;
      }
      i = 0;
      this._int32(_word);
    }
    while (i < 16 /* inputWords */) {
      _word[i++] = 0;
    }
    const bits64 = this._size * 8;
    const low32 = (bits64 & 4294967295) >>> 0;
    const high32 = (bits64 - low32) / 4294967296;
    if (high32) _word[14 /* highIndex */] = swap32(high32);
    if (low32) _word[15 /* lowIndex */] = swap32(low32);
    this._int32(_word);
    return encoding === 'hex' ? this._hex() : this._bin();
  }
  _hex() {
    const { A, B, C, D, E, F, G, H } = this;
    return hex32(A) + hex32(B) + hex32(C) + hex32(D) + hex32(E) + hex32(F) + hex32(G) + hex32(H);
  }
  _bin() {
    const { A, B, C, D, E, F, G, H, _byte, _word } = this;
    _word[0] = swap32(A);
    _word[1] = swap32(B);
    _word[2] = swap32(C);
    _word[3] = swap32(D);
    _word[4] = swap32(E);
    _word[5] = swap32(F);
    _word[6] = swap32(G);
    _word[7] = swap32(H);
    return _byte.slice(0, 32);
  }
};
var W = new Int32Array(64 /* workWords */);
var sharedBuffer;
var sharedOffset = 0;
var hex32 = num => (num + 4294967296).toString(16).substr(-8);
var swapLE = c =>
  ((c << 24) & 4278190080) | ((c << 8) & 16711680) | ((c >> 8) & 65280) | ((c >> 24) & 255);
var swapBE = c => c;
var swap32 = isBE() ? swapBE : swapLE;
var ch = (x, y, z) => z ^ (x & (y ^ z));
var maj = (x, y, z) => (x & y) | (z & (x | y));
var sigma0 = x => ((x >>> 2) | (x << 30)) ^ ((x >>> 13) | (x << 19)) ^ ((x >>> 22) | (x << 10));
var sigma1 = x => ((x >>> 6) | (x << 26)) ^ ((x >>> 11) | (x << 21)) ^ ((x >>> 25) | (x << 7));
var gamma0 = x => ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
var gamma1 = x => ((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10);
function isBE() {
  const buf = new Uint8Array(new Uint16Array([65279]).buffer);
  return buf[0] === 254;
}

// src/cat21/cat21-parser.service.helper.ts
function sha256Hash(inputData) {
  return createHash().update(inputData).digest();
}
function createCatHash(transactionId, blockId) {
  if (transactionId.length !== 64 || blockId.length !== 64) {
    throw new Error(
      'Invalid input: transactionId and blockId must be 64-character hexadecimal strings'
    );
  }
  if (!/^[a-fA-F0-9]+$/.test(transactionId) || !/^[a-fA-F0-9]+$/.test(blockId)) {
    throw new Error('Invalid input: transactionId and blockId must be hexadecimal strings');
  }
  const concatenateHex = transactionId + blockId;
  const concatenateBytes = hexToBytes(concatenateHex);
  const hashedResult = sha256Hash(concatenateBytes);
  return bytesToHex(hashedResult);
}

// src/cat21/mooncat-parser.backgrounds.ts
var bgOpacity = 0.5;
function getBgRect(fill, opacity = 1) {
  if (opacity === 1) {
    return `<rect x="0" y="0" width="22" height="22" fill="${fill}" />
`;
  }
  return `<rect x="0" y="0" width="22" height="22" fill="${fill}" opacity="${opacity}" />
`;
}
function getCubePoints(baseX, baseY, size) {
  const halfSize = size / 2;
  const halfHeight = halfSize / 2;
  return {
    top: [
      { x: baseX - halfSize, y: baseY - halfHeight },
      { x: baseX, y: baseY - halfSize },
      { x: baseX + halfSize, y: baseY - halfHeight },
      { x: baseX, y: baseY },
    ],
    left: [
      { x: baseX - halfSize, y: baseY - halfHeight },
      { x: baseX - halfSize, y: baseY + halfHeight },
      { x: baseX, y: baseY + halfSize },
      { x: baseX, y: baseY },
    ],
    right: [
      { x: baseX, y: baseY },
      { x: baseX, y: baseY + halfSize },
      { x: baseX + halfSize, y: baseY + halfHeight },
      { x: baseX + halfSize, y: baseY - halfHeight },
    ],
  };
}
function getCubeFromPolygons(x, y, size, gridWidth, gridHeight, backgroundColors) {
  const points = getCubePoints(x, y, size);
  let colorTop = backgroundColors[0];
  let colorLeft = backgroundColors[1];
  let colorRight = backgroundColors[2];
  if (points.left[0].x > gridWidth) {
    return '';
  }
  if (points.right[0].x < 0) {
    return '';
  }
  if (points.top[0].y > gridHeight) {
    return '';
  }
  return `
    <polygon points="${points.top.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorTop}" opacity="${bgOpacity}" />
    <polygon points="${points.left.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorLeft}" opacity="${bgOpacity}" />
    <polygon points="${points.right.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colorRight}" opacity="${bgOpacity}" />
  `;
}
function getIsomometricCubePattern(
  rows,
  columns,
  cubeSize,
  gridWidth,
  gridHeight,
  [n1, n2, n3, o1, o2, o3]
) {
  let svg = getBgRect('#ffffff', bgOpacity);
  const normalCubesColors = [n1, n2, n3];
  const orangeColors = [o1, o2, o3];
  const startX = cubeSize / 2;
  const startY = cubeSize / 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = startX + c * cubeSize - (r * cubeSize) / 2;
      const y = startY + r * cubeSize * 0.75;
      const isCube9 = r == 0 && c == 9;
      svg += getCubeFromPolygons(
        x,
        y,
        cubeSize,
        gridWidth,
        gridHeight,
        isCube9 ? orangeColors : normalCubesColors
      );
    }
  }
  return svg;
}
function textToBinary(text) {
  let binaryString = '';
  for (let i = 0; i < text.length; i++) {
    const binaryChar = text[i].charCodeAt(0).toString(2);
    const paddedBinaryChar = '0'.repeat(8 - binaryChar.length) + binaryChar;
    binaryString += paddedBinaryChar;
  }
  return binaryString;
}
function wrapTextWithTspan(text, x = 0, dy = 2, letterSpacing = 0) {
  return `<tspan x="${x}" dy="${dy}"${letterSpacing ? ` letter-spacing="${letterSpacing}"` : ''}>${text}</tspan>
`;
}
function splitAndWrapTextWithTspan(text, maxCharsPerLine, x = 0, dy = 2) {
  let wrappedText = '';
  const lines = [];
  for (let i = 0; i < text.length; i += maxCharsPerLine) {
    lines.push(text.substring(i, i + maxCharsPerLine));
  }
  for (const line of lines) {
    wrappedText += wrapTextWithTspan(line, x, dy);
  }
  return wrappedText;
}
function getCypherpunksManifestoText(backgroundColors) {
  let svg = getBgRect(backgroundColors[0], bgOpacity);
  svg += `<text y="-0.38" font-family="Courier New, Courier" font-weight="bold" font-size="1.8px" fill="${backgroundColors[1]}" opacity="${bgOpacity}">${splitAndWrapTextWithTspan(textToBinary('Cypherpunks write code. 1993'), 20, 0.2)}</text>
`;
  return svg;
}
function getWhitepaperText(backgroundColors) {
  const fill = backgroundColors[0];
  const bg = backgroundColors[1];
  let svg = getBgRect(bg, bgOpacity);
  svg += `<svg viewBox="-4 -5 50 78" xmlns="http://www.w3.org/2000/svg" opacity="${bgOpacity}">`;
  svg += `<text y="2" font-family="Times New Roman, Times" font-weight="bold" font-size="2px" fill="${fill}">
`;
  svg += wrapTextWithTspan('Bitcoin: A Peer-to-Peer Electronic Cash System');
  svg += `</text>
`;
  svg += `<text y="7" font-family="Times New Roman, Times" font-size="1.12px" fill="${fill}" text-anchor="middle">
`;
  svg += wrapTextWithTspan('Satoshi Nakamoto', 20.2, 1.3);
  svg += wrapTextWithTspan('satoshin@gmx.com', 20.2, 1.3);
  svg += wrapTextWithTspan('www.bitcoin.org', 20.2, 1.3);
  svg += `</text>
`;
  svg += `<text y="16" font-family="Times New Roman, Times" font-weight="bold" font-size="1.12px" fill="${fill}">
`;
  svg += wrapTextWithTspan('Abstract.', 1.4, 0);
  svg += `</text>
`;
  svg += `<text y="16" font-family="Times New Roman, Times" font-size="1.12px" fill="${fill}" xml:space="preserve">
`;
  svg += wrapTextWithTspan(
    'A purely peer-to-peer version of electronic cash would allow online',
    6.8,
    0,
    0.03
  );
  svg += wrapTextWithTspan(
    'payments to be sent directly from one party to another without going through a',
    1.4,
    1.3,
    0.03
  );
  svg += wrapTextWithTspan(
    'financial institution.  Digital signatures provide part of the solution, but the main',
    1.4,
    1.32,
    0.02
  );
  svg += wrapTextWithTspan(
    'benefits are lost if a trusted third party is still required to prevent double-spending.',
    1.4,
    1.3,
    0.012
  );
  svg += wrapTextWithTspan(
    'We propose a solution to the double-spending problem using a peer-to-peer network.',
    1.4,
    1.3,
    0
  );
  svg += wrapTextWithTspan(
    'The network timestamps transactions by hashing them into an ongoing chain of',
    1.4,
    1.3,
    0.028
  );
  svg += wrapTextWithTspan(
    'hash-based proof-of-work, forming a record that cannot be changed without redoing',
    1.4,
    1.3,
    4e-3
  );
  svg += wrapTextWithTspan(
    'the proof-of-work.  The longest chain not only serves as proof of the sequence of',
    1.4,
    1.3,
    0.02
  );
  svg += wrapTextWithTspan(
    'events witnessed, but proof that it came from the largest pool of CPU power.  As',
    1.4,
    1.3,
    0.022
  );
  svg += wrapTextWithTspan(
    'long as a majority of CPU power is controlled by nodes that are not cooperating to',
    1.4,
    1.3,
    0.012
  );
  svg += wrapTextWithTspan(
    "attack the network, they'll generate the longest chain and outpace attackers.  The",
    1.4,
    1.3,
    0.024
  );
  svg += wrapTextWithTspan(
    'network itself requires minimal structure.  Messages are broadcast on a best effort',
    1.4,
    1.3,
    0.018
  );
  svg += wrapTextWithTspan(
    'basis, and nodes can leave and rejoin the network at will, accepting the longest',
    1.4,
    1.3,
    0.034
  );
  svg += wrapTextWithTspan(
    'proof-of-work chain as proof of what happened while they were gone.',
    1.4,
    1.3,
    4e-3
  );
  svg += `</text>
`;
  svg += `<text y="35" font-family="Times New Roman, Times" font-weight="bold" font-size="1.3px" fill="${fill}" xml:space="preserve">
`;
  svg += wrapTextWithTspan('1.    Introduction', -2);
  svg += `</text>
`;
  svg += `<text y="40" font-family="Times New Roman, Times" font-size="1.12px" fill="${fill}" xml:space="preserve">
`;
  svg += wrapTextWithTspan(
    'Commerce on the Internet has come to rely almost exclusively on financial institutions serving as',
    -2,
    0,
    0.01
  );
  svg += wrapTextWithTspan(
    'trusted third parties to process electronic payments.  While the system works well enough for',
    -2,
    1.3,
    0.03
  );
  svg += wrapTextWithTspan(
    'most transactions, it still suffers from the inherent weaknesses of the trust based model.',
    -2,
    1.3,
    0.062
  );
  svg += wrapTextWithTspan(
    'avoid mediating disputes.  The cost of mediation increases transaction costs, limiting the',
    -2,
    1.3,
    0.055
  );
  svg += wrapTextWithTspan(
    'minimum practical transaction size and cutting off the possibility for small casual transactions,',
    -2,
    1.3,
    0.024
  );
  svg += wrapTextWithTspan(
    'and there is a broader cost in the loss of ability to make non-reversible payments for non-',
    -2,
    1.3,
    0.052
  );
  svg += wrapTextWithTspan(
    'reversible services.  With the possibility of reversal, the need for trust spreads. Merchants must',
    -2,
    1.3,
    0.022
  );
  svg += wrapTextWithTspan(
    'be wary of their customers, hassling them for more information than they would otherwise need.',
    -2,
    1.3,
    0.018
  );
  svg += wrapTextWithTspan(
    'A certain percentage of fraud is accepted as unavoidable.  These costs and payment uncertainties',
    -2,
    1.3,
    0.015
  );
  svg += wrapTextWithTspan(
    'can be avoided in person by using physical currency, but no mechanism exists to make payments',
    -2,
    1.3,
    0.014
  );
  svg += wrapTextWithTspan('over a communications channel without a trusted party.', -2, 1.3, 0.01);
  svg += wrapTextWithTspan(
    '   What is needed is an electronic payment system based on cryptographic proof instead of trust,',
    -2,
    1.3,
    0.02
  );
  svg += wrapTextWithTspan(
    'allowing any two willing parties to transact directly with each other without the need for a trusted',
    -2,
    1.3,
    0.01
  );
  svg += wrapTextWithTspan(
    'third party.  Transactions that are computationally impractical to reverse would protect sellers',
    -2,
    1.3,
    0.03
  );
  svg += wrapTextWithTspan(
    'from fraud, and routine escrow mechanisms could easily be implemented to protect buyers.  In',
    -2,
    1.3,
    0.024
  );
  svg += wrapTextWithTspan(
    'this paper, we propose a solution to the double-spending problem using a peer-to-peer distributed',
    -2,
    1.3,
    0.012
  );
  svg += wrapTextWithTspan(
    'timestamp server to generate computational proof of the chronological order of transactions.  The',
    -2,
    1.3,
    0.012
  );
  svg += wrapTextWithTspan(
    'system is secure as long as honest nodes collectively control more CPU power than any',
    -2,
    1.3,
    0.066
  );
  svg += wrapTextWithTspan('cooperating group of attacker nodes.', -2, 1.3, 0.02);
  svg += `</text>
`;
  svg += `<text y="68" font-family="Times New Roman, Times" font-size="1.12px" fill="${fill}">
`;
  svg += wrapTextWithTspan('1', 21, 0);
  svg += `</text>
`;
  svg += `</svg>`;
  return svg;
}

// src/cat21/mooncat-parser.colors.ts
function generativeColorPalette(t, baseColor, amplitude, frequency, phase) {
  return [
    baseColor[0] + amplitude[0] * Math.cos(2 * Math.PI * (frequency[0] * t + phase[0])),
    baseColor[1] + amplitude[1] * Math.cos(2 * Math.PI * (frequency[1] * t + phase[1])),
    baseColor[2] + amplitude[2] * Math.cos(2 * Math.PI * (frequency[2] * t + phase[2])),
  ];
}
function map(n, from1, to1, from2, to2) {
  return ((n - from1) / (to1 - from1)) * (to2 - from2) + from2;
}
function feeRateToColor(feeRate, saturationSeed) {
  const baseColor = [0.5, 0.5, 0.5];
  const amplitude = [-0.9, 0.6, 0.4];
  const frequency = [1, 0.5, 0.5];
  const phase = [0, 0, 0];
  const rgb = generativeColorPalette(feeRate / 300, baseColor, amplitude, frequency, phase);
  let saturation = map(saturationSeed, 0, 255, 0.75, 1);
  if (feeRate >= 420 && feeRate < 421) {
    saturation = 42;
  }
  if (feeRate < 300) {
    let transitionFactor = Math.max(0, (feeRate - 250) / 50);
    rgb[0] += 0.7 * (1 - transitionFactor);
    rgb[2] *= transitionFactor;
  } else {
    let postTransitionFactor = Math.min(1, (feeRate - 300) / 50);
    rgb[1] *= 1 - postTransitionFactor;
    rgb[2] = postTransitionFactor;
  }
  return {
    rgb,
    saturation,
  };
}

// src/cat21/mooncat-parser.designs.ts
var designs = [
  // 0
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 0, 1, 3, 1],
    [1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 1
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 3, 1, 3, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 2
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 3, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 3
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 4
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 3, 1, 1, 0, 1, 2, 1],
    [1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1, 3, 2, 3, 3, 2, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 2, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 2, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 5
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 2, 3, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 2, 3, 3, 2, 3, 1, 1],
    [0, 1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 3, 2, 3, 2, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 6
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 2, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 3, 1, 1, 2, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 7
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 2, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1, 1, 2, 3, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 3, 3, 3, 3, 3, 1],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 2, 3, 1, 3, 2, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 8
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 2, 2, 2, 1, 1, 0, 1, 2, 1],
    [1, 3, 3, 4, 3, 5, 3, 4, 3, 2, 1, 3, 3, 2, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 2, 2, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 3, 3, 1, 4, 4, 4, 1, 2, 2, 2, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 2, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 9
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 3, 3, 4, 3, 5, 3, 4, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 1, 1, 3, 3, 1],
    [1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 2, 2, 5, 1, 5, 3, 3, 1, 2, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 10
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 5, 3, 4, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 2, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 3, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 2, 3, 2, 1, 2, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 11
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 2, 2, 2, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1, 1, 1, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 3, 3, 3, 3, 1],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 2, 2, 1, 0],
    [1, 3, 3, 4, 3, 5, 3, 4, 3, 2, 1, 3, 3, 3, 3, 4, 2, 2, 1, 0],
    [1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 2, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 2, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 12
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 1, 1, 0, 1, 3, 1],
    [1, 2, 2, 4, 2, 5, 2, 4, 3, 3, 1, 3, 3, 3, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 3, 3, 3, 2, 2, 1, 1, 1, 3, 1],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 2, 2, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 2, 2, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 2, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 2, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 13
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 2, 2, 4, 2, 5, 2, 4, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 3, 3, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 3, 1, 1, 2, 2, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 2, 2, 1, 1],
    [1, 1, 3, 3, 5, 1, 2, 2, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 14
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 4, 2, 5, 2, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 2, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 2, 2, 2, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 2, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 2, 2, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 15
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 2, 2, 2, 3, 1],
    [1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 2, 4, 2, 5, 2, 4, 3, 3, 1, 2, 2, 2, 3, 4, 3, 3, 1, 0],
    [1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 2, 2, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 2, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 3, 3, 1, 1, 2, 1, 1],
    [1, 1, 3, 3, 3, 1, 2, 2, 1, 1, 1, 1, 5, 3, 1, 1, 2, 2, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 16
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 17
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 3, 1, 3, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 18
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 3, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 19
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 20
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 3, 1, 1, 0, 1, 2, 1],
    [1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 2, 3, 3, 2, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 2, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 2, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 21
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 2, 3, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 2, 3, 3, 2, 3, 1, 1],
    [0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 3, 2, 3, 2, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 22
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 2, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 3, 1, 1, 2, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 23
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 2, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1, 1, 2, 3, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 2, 3, 3, 3, 3, 3, 1],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 2, 3, 1, 3, 2, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 24
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 2, 2, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 2, 2, 2, 1, 1, 0, 1, 2, 1],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 2, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 2, 2, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 3, 3, 1, 4, 4, 4, 1, 2, 2, 2, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 2, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 25
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 4, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 1, 1, 3, 3, 1],
    [1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 2, 2, 5, 1, 5, 3, 3, 1, 2, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 26
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 2, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 3, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 2, 3, 2, 1, 2, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 27
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 2, 2, 2, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1, 1, 1, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 2, 2, 3, 3, 3, 4, 3, 3, 1, 3, 3, 2, 2, 3, 3, 3, 3, 1],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 2, 2, 1, 0],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 4, 2, 2, 1, 0],
    [1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 2, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 2, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 28
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 2, 2, 4, 2, 2, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 1, 1, 0, 1, 3, 1],
    [1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 3, 3, 3, 2, 2, 1, 1, 1, 3, 1],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 2, 2, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 2, 2, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 2, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 2, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 29
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 2, 2, 4, 2, 2, 3, 4, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 3, 3, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 3, 1, 1, 2, 2, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 2, 2, 1, 1],
    [1, 1, 3, 3, 5, 1, 2, 2, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 30
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 4, 2, 2, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 2, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 2, 2, 2, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 2, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 2, 2, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 31
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 2, 2, 2, 3, 1],
    [1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 4, 2, 2, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 2, 2, 2, 3, 4, 3, 3, 1, 0],
    [1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 2, 2, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 2, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 3, 3, 1, 1, 2, 1, 1],
    [1, 1, 3, 3, 3, 1, 2, 2, 1, 1, 1, 1, 5, 3, 1, 1, 2, 2, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 32
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 3, 3, 1, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 33
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 3, 1, 3, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 34
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 3, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 35
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 36
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 2, 3, 1, 1, 0, 1, 2, 1],
    [1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 2, 3, 3, 2, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 2, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 2, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 37
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 2, 3, 3, 2, 1, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 2, 3, 3, 2, 3, 1, 1],
    [0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 3, 2, 3, 2, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 38
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 2, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 3, 1, 1, 2, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 39
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 2, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1, 1, 2, 3, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 3, 3, 3, 3, 3, 1],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 2, 3, 1, 3, 2, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 40
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 2, 1, 3, 2, 2, 2, 1, 1, 0, 1, 2, 1],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 2, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 2, 2, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 3, 3, 1, 4, 4, 4, 1, 2, 2, 2, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 2, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 41
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 2, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 1, 1, 3, 3, 1],
    [1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 2, 2, 5, 1, 5, 3, 3, 1, 2, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 42
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 2, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 3, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 2, 3, 2, 1, 2, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 43
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 2, 2, 2, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1, 1, 1, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 3, 3, 3, 3, 1],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 1, 1],
    [1, 3, 3, 4, 3, 3, 3, 4, 3, 2, 1, 3, 3, 3, 3, 3, 2, 2, 1, 0],
    [1, 3, 3, 3, 3, 5, 3, 3, 3, 2, 1, 3, 3, 3, 3, 4, 2, 2, 1, 0],
    [1, 2, 3, 3, 4, 3, 4, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 2, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 2, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 44
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 2, 2, 4, 2, 2, 2, 4, 3, 3, 1, 3, 3, 3, 2, 1, 1, 0, 1, 3, 1],
    [1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 3, 3, 3, 2, 2, 1, 1, 1, 3, 1],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 2, 2, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 2, 2, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 2, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 2, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 45
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 2, 4, 2, 2, 2, 4, 3, 3, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 3, 3, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 3, 1, 1, 2, 2, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 2, 2, 1, 1],
    [1, 1, 3, 3, 5, 1, 2, 2, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 46
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 4, 2, 2, 2, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 2, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 2, 2, 2, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 2, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 2, 2, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 47
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 2, 2, 2, 3, 1],
    [1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 2, 2, 4, 2, 2, 2, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 2, 2, 2, 5, 2, 3, 3, 3, 1, 2, 2, 2, 3, 4, 3, 3, 1, 0],
    [1, 2, 2, 2, 4, 2, 4, 3, 3, 3, 1, 2, 2, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 2, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 3, 3, 1, 1, 2, 1, 1],
    [1, 1, 3, 3, 3, 1, 2, 2, 1, 1, 1, 1, 5, 3, 1, 1, 2, 2, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 48
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 0, 1, 3, 1],
    [1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 3, 3, 3, 3, 3, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 49
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 3, 1, 3, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 50
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 3, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 51
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 52
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 3, 1, 1, 0, 1, 2, 1],
    [1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1, 3, 2, 3, 3, 2, 1, 0, 1, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 2, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 2, 3, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 53
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 2, 3, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 2, 3, 3, 2, 3, 1, 1],
    [0, 1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 3, 2, 3, 2, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 54
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 2, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 3, 1, 1, 2, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 3, 1, 3, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 3, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 55
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 3, 3, 3, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 2, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1, 1, 2, 3, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 3, 3, 3, 3, 3, 1],
    [1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1, 3, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 3, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 2, 3, 1, 3, 2, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 56
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 2, 2, 2, 1, 1, 0, 1, 2, 1],
    [1, 3, 4, 4, 3, 5, 3, 4, 4, 2, 1, 3, 3, 2, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 2, 3, 1, 1, 1, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 3, 3, 3, 3, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 2, 2, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 3, 3, 1, 4, 4, 4, 1, 2, 2, 2, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 3, 3, 1, 4, 1, 3, 3, 2, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 3, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 57
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 3, 4, 4, 3, 5, 3, 4, 4, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 2, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 1, 1, 3, 3, 1],
    [1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 2, 2, 5, 1, 5, 3, 3, 1, 2, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 58
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 3, 4, 4, 3, 5, 3, 4, 4, 2, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 2, 1, 1, 0],
    [1, 1, 1, 3, 2, 1, 1, 1, 3, 3, 3, 3, 1, 1, 2, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 3, 3, 3, 2, 3, 2, 1, 2, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 2, 2, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 3, 3, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 3, 2, 1, 3, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 59
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 2, 2, 2, 3, 1, 1],
    [1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1, 1, 1, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1],
    [1, 3, 2, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 2, 2, 3, 3, 3, 3, 1],
    [1, 3, 2, 1, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 1, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 2, 2, 1, 0],
    [1, 3, 4, 4, 3, 5, 3, 4, 4, 2, 1, 3, 3, 3, 3, 4, 2, 2, 1, 0],
    [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 4, 4, 3, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 4, 4, 4, 1, 3, 2, 2, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1],
    [1, 1, 3, 3, 2, 1, 3, 3, 1, 1, 1, 1, 5, 3, 1, 1, 3, 3, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 5, 3, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 60
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
    [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 1, 1, 1, 1, 1, 0, 1, 1, 3, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 1, 1, 0, 1, 3, 1],
    [1, 2, 4, 4, 2, 5, 2, 4, 4, 3, 1, 3, 3, 3, 2, 2, 1, 0, 1, 3, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 1, 1, 1, 3, 1],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 2, 2, 3, 1, 1, 1, 0],
    [0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 2, 2, 1, 4, 4, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 3, 3, 1, 2, 2, 1, 4, 1, 3, 3, 3, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 1, 1, 2, 1, 4, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 5, 1, 1, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 61
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 1, 1],
    [0, 1, 2, 4, 4, 2, 5, 2, 4, 4, 3, 1, 3, 3, 3, 3, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 1, 3, 3, 3, 3, 1, 1, 2, 2, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 2, 2, 1, 1],
    [1, 1, 3, 3, 5, 1, 2, 2, 2, 1, 3, 1, 1, 1, 1, 3, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
  // 62
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 4, 4, 2, 5, 2, 4, 4, 3, 1, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0],
    [1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 3, 3, 1, 1, 1, 2, 3, 3, 3, 1, 1, 3, 1, 0],
    [0, 0, 1, 1, 3, 1, 5, 2, 2, 2, 3, 3, 3, 1, 3, 1, 1],
    [0, 0, 0, 1, 3, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 3, 3, 3, 1, 1, 3, 1],
    [0, 0, 0, 1, 1, 4, 4, 4, 3, 1, 1, 1, 2, 1, 2, 2, 1],
    [0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 3, 2, 2, 1, 2, 1, 1],
    [0, 0, 0, 0, 1, 2, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 1, 2, 2, 1, 1, 3, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 5, 1, 1, 1, 1, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 63
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 3, 2, 2, 2, 3, 1],
    [1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 2, 1, 2, 2, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 2, 4, 4, 2, 5, 2, 4, 4, 3, 1, 2, 2, 2, 3, 4, 3, 3, 1, 0],
    [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 2, 2, 4, 4, 4, 3, 3, 1, 0],
    [0, 1, 2, 2, 2, 2, 2, 3, 3, 1, 1, 2, 4, 4, 4, 1, 3, 3, 3, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 3, 3, 1, 1, 2, 1, 1],
    [1, 1, 3, 3, 3, 1, 2, 2, 1, 1, 1, 1, 5, 3, 1, 1, 2, 2, 1, 0],
    [1, 5, 3, 1, 1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  ],
  // 64
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [1, 3, 1, 0, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1],
    [1, 3, 1, 1, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 65
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 3, 1, 3, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 66
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 3, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 67
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 3, 3, 4, 3, 5, 3, 4, 3, 3, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 68
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [1, 2, 1, 0, 1, 1, 3, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 3, 3, 2, 3, 1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1],
    [1, 2, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 1, 3, 2, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 69
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 3, 3, 2, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [1, 1, 3, 2, 3, 3, 2, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1, 0],
    [1, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 2, 3, 2, 3, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 70
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 2, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 2, 1, 1, 3, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 71
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 2, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 3, 3, 2, 1, 1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 2, 3, 4, 3, 5, 3, 4, 3, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 2, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 2, 3, 1, 3, 2, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 72
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1],
    [1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [1, 2, 1, 0, 1, 1, 2, 2, 2, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 2, 2, 3, 3, 1, 2, 3, 4, 3, 5, 3, 4, 3, 3, 1],
    [1, 3, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 2, 2, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 2, 2, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 2, 2, 2, 1, 4, 4, 4, 1, 3, 3, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 2, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 73
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 1, 2, 2, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 4, 3, 5, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1, 1],
    [1, 3, 3, 1, 1, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 2, 1, 3, 3, 5, 1, 5, 2, 2, 1, 1],
    [0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 74
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 4, 3, 5, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 2, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 3, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 2, 1, 2, 3, 2, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 2, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 75
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 2, 2, 2, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 2, 2, 2, 1, 1, 1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1],
    [1, 1, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [0, 1, 2, 2, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 2, 2, 4, 3, 3, 3, 3, 1, 2, 3, 4, 3, 5, 3, 4, 3, 3, 1],
    [0, 1, 2, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1],
    [1, 2, 2, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 2, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 76
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [1, 3, 1, 0, 1, 1, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 0, 1, 2, 2, 3, 3, 3, 1, 3, 3, 4, 2, 5, 2, 4, 2, 2, 1],
    [1, 3, 1, 1, 1, 2, 2, 3, 3, 3, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 1, 3, 2, 2, 3, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 2, 2, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 2, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 2, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 2, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 77
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 2, 3, 3, 3, 3, 1, 3, 3, 4, 2, 5, 2, 4, 2, 2, 1, 0],
    [1, 2, 2, 2, 2, 1, 3, 3, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1, 1],
    [1, 2, 2, 1, 1, 3, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 1, 2, 2, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 2, 2, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 78
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 2, 5, 2, 4, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 2, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 2, 2, 2, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 2, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 2, 2, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 79
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 2, 2, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 3, 3, 4, 3, 2, 2, 2, 1, 3, 3, 4, 2, 5, 2, 4, 2, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 2, 2, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 2, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [1, 3, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 2, 1, 1, 3, 3, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 0],
    [0, 1, 2, 2, 1, 1, 3, 5, 1, 1, 1, 1, 2, 2, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 80
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [1, 3, 1, 0, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 81
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 3, 1, 3, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 82
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 3, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 83
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 84
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [1, 2, 1, 0, 1, 1, 3, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 3, 3, 2, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1],
    [1, 2, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 1, 3, 2, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 85
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 1, 2, 3, 3, 2, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [1, 1, 3, 2, 3, 3, 2, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0],
    [1, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 2, 3, 2, 3, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 86
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 2, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 2, 1, 1, 3, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 87
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 2, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 3, 3, 2, 1, 1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 2, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 2, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 2, 3, 1, 3, 2, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 88
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 2, 2, 3, 1],
    [1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [1, 2, 1, 0, 1, 1, 2, 2, 2, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 2, 2, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 2, 2, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 2, 2, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 2, 2, 2, 1, 4, 4, 4, 1, 3, 3, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 2, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 89
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 4, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 1, 2, 2, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1, 1],
    [1, 3, 3, 1, 1, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 2, 1, 3, 3, 5, 1, 5, 2, 2, 1, 1],
    [0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 90
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 2, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 3, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 2, 1, 2, 3, 2, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 2, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 91
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 2, 2, 2, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 2, 2, 2, 1, 1, 1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 2, 2, 3, 3, 1, 3, 3, 4, 3, 3, 3, 2, 2, 3, 1],
    [1, 1, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [0, 1, 2, 2, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 2, 2, 4, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [0, 1, 2, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1],
    [1, 2, 2, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 2, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 92
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 2, 2, 4, 2, 2, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [1, 3, 1, 0, 1, 1, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 0, 1, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1],
    [1, 3, 1, 1, 1, 2, 2, 3, 3, 3, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 1, 3, 2, 2, 3, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 2, 2, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 2, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 2, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 2, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 93
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 4, 3, 2, 2, 4, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 2, 2, 1, 3, 3, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1, 1],
    [1, 2, 2, 1, 1, 3, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 1, 2, 2, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 2, 2, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 94
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 2, 2, 4, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 2, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 2, 2, 2, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 2, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 2, 2, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 95
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 2, 2, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 2, 2, 4, 2, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 3, 3, 4, 3, 2, 2, 2, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 2, 2, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 2, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [1, 3, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 2, 1, 1, 3, 3, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 0],
    [0, 1, 2, 2, 1, 1, 3, 5, 1, 1, 1, 1, 2, 2, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 96
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [1, 3, 1, 0, 1, 1, 3, 3, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 3, 1, 0, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 97
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 3, 1, 3, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 98
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 3, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 99
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 100
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [1, 2, 1, 0, 1, 1, 3, 2, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 3, 3, 2, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1],
    [1, 2, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 1, 3, 2, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 101
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 3, 3, 2, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [1, 1, 3, 2, 3, 3, 2, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0],
    [1, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 2, 3, 2, 3, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 102
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 2, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 2, 1, 1, 3, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 103
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 2, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 3, 3, 2, 1, 1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 3, 1],
    [1, 2, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 2, 3, 1, 3, 2, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 104
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1],
    [1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [1, 2, 1, 0, 1, 1, 2, 2, 2, 3, 1, 2, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 2, 2, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 2, 2, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 2, 2, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 2, 2, 2, 1, 4, 4, 4, 1, 3, 3, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 2, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 105
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 1, 2, 2, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 2, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1, 1],
    [1, 3, 3, 1, 1, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 2, 1, 3, 3, 5, 1, 5, 2, 2, 1, 1],
    [0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 106
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 4, 3, 3, 3, 4, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 2, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 3, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 2, 1, 2, 3, 2, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 2, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 107
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 2, 2, 2, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 2, 2, 2, 1, 1, 1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1],
    [1, 1, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [0, 1, 2, 2, 3, 3, 3, 3, 3, 1, 2, 3, 4, 3, 3, 3, 4, 3, 3, 1],
    [0, 1, 2, 2, 4, 3, 3, 3, 3, 1, 2, 3, 3, 3, 5, 3, 3, 3, 3, 1],
    [0, 1, 2, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 4, 3, 4, 3, 3, 2, 1],
    [1, 2, 2, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 2, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 108
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [1, 3, 1, 0, 1, 1, 2, 3, 3, 3, 1, 3, 3, 4, 2, 2, 2, 4, 2, 2, 1],
    [1, 3, 1, 0, 1, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1],
    [1, 3, 1, 1, 1, 2, 2, 3, 3, 3, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 1, 3, 2, 2, 3, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 2, 2, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 2, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 2, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 2, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 109
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 3, 3, 4, 2, 2, 2, 4, 2, 2, 1, 0],
    [1, 2, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 2, 2, 1, 3, 3, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1, 1],
    [1, 2, 2, 1, 1, 3, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 1, 2, 2, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 2, 2, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 110
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 4, 2, 2, 2, 4, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 2, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 2, 2, 2, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 2, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 2, 2, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 111
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 2, 2, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 4, 2, 2, 2, 4, 2, 2, 1],
    [0, 1, 3, 3, 4, 3, 2, 2, 2, 1, 3, 3, 3, 2, 5, 2, 2, 2, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 2, 2, 1, 3, 3, 3, 4, 2, 4, 2, 2, 2, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 2, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [1, 3, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 2, 1, 1, 3, 3, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 0],
    [0, 1, 2, 2, 1, 1, 3, 5, 1, 1, 1, 1, 2, 2, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 112
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [1, 3, 1, 0, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 3, 3, 3, 3, 3, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1],
    [1, 3, 1, 1, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 113
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [1, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 3, 1, 3, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 114
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 3, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 3, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 115
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 3, 3, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 116
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [1, 2, 1, 0, 1, 1, 3, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 3, 3, 2, 3, 1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1],
    [1, 2, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 2, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 3, 3, 3, 3, 2, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 117
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 2, 3, 3, 2, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [1, 1, 3, 2, 3, 3, 2, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1, 0],
    [1, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 3, 5, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 2, 3, 2, 3, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 118
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 3, 2, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 2, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 3, 1, 2, 3, 3, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 2, 1, 1, 3, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 3, 1, 3, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 3, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 119
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 3, 2, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 3, 3, 2, 1, 1, 3, 3, 3, 2, 3, 2, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 3, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 1, 3, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 3, 3, 4, 3, 3, 3, 3, 1, 2, 4, 4, 3, 5, 3, 4, 4, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 2, 3, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 2, 3, 1, 3, 2, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 120
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1],
    [1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [1, 2, 1, 0, 1, 1, 2, 2, 2, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 1, 0, 1, 2, 2, 2, 3, 3, 1, 2, 4, 4, 3, 5, 3, 4, 4, 3, 1],
    [1, 3, 1, 1, 1, 3, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 1, 1, 3, 3, 3, 3, 3, 2, 2, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 2, 2, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 2, 2, 2, 1, 4, 4, 4, 1, 3, 3, 2, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 2, 3, 3, 1, 4, 1, 3, 3, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 3, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 121
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 1, 2, 2, 2, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 2, 4, 4, 3, 5, 3, 4, 4, 3, 1, 0],
    [1, 3, 3, 3, 3, 1, 2, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1],
    [1, 3, 3, 1, 1, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1],
    [1, 1, 3, 3, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1],
    [0, 1, 1, 3, 3, 1, 1, 1, 1, 2, 1, 3, 3, 5, 1, 5, 2, 2, 1, 1],
    [0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 122
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 2, 1, 1, 1, 3, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 2, 4, 4, 3, 5, 3, 4, 4, 3, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 2, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 3, 5, 1],
    [0, 1, 2, 1, 1, 3, 3, 3, 3, 1, 1, 1, 2, 3, 1, 1, 1],
    [1, 1, 2, 1, 2, 3, 2, 3, 3, 3, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 3, 3, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 3, 1, 2, 3, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 123
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 2, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 3, 2, 2, 2, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 1, 3, 1, 0],
    [1, 3, 3, 3, 2, 2, 2, 1, 1, 1, 2, 5, 2, 1, 1, 1, 3, 5, 3, 1],
    [1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 3, 3, 3, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 1],
    [1, 1, 2, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 1, 2, 3, 1],
    [0, 1, 2, 2, 3, 3, 3, 3, 3, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [0, 1, 2, 2, 4, 3, 3, 3, 3, 1, 2, 4, 4, 3, 5, 3, 4, 4, 3, 1],
    [0, 1, 2, 3, 4, 4, 4, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    [1, 2, 2, 3, 1, 4, 4, 4, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0],
    [1, 3, 3, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0],
    [0, 1, 3, 3, 1, 1, 3, 5, 1, 1, 1, 1, 3, 3, 1, 2, 3, 3, 1, 1],
    [0, 1, 1, 3, 5, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 124
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1],
    [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 1, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [1, 3, 1, 0, 1, 1, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [1, 3, 1, 0, 1, 2, 2, 3, 3, 3, 1, 3, 4, 4, 2, 5, 2, 4, 4, 2, 1],
    [1, 3, 1, 1, 1, 2, 2, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 1, 3, 2, 2, 3, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 4, 4, 1, 2, 2, 3, 3, 3, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 3, 3, 3, 1, 4, 1, 2, 2, 1, 3, 3, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 4, 1, 2, 1, 1, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 3, 2, 1, 1, 5, 1, 1, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  ],
  // 125
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 1, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [1, 1, 2, 2, 3, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 2, 3, 3, 3, 3, 1, 3, 4, 4, 2, 5, 2, 4, 4, 2, 1, 0],
    [1, 2, 2, 2, 2, 1, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1],
    [1, 2, 2, 1, 1, 3, 3, 3, 3, 1, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 1, 2, 2, 1, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1],
    [0, 1, 1, 2, 3, 1, 1, 1, 1, 3, 1, 2, 2, 2, 1, 5, 3, 3, 1, 1],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // 126
  [
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 3, 1, 1, 1, 2, 5, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 4, 4, 2, 5, 2, 4, 4, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1],
    [0, 1, 1, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1],
    [0, 1, 3, 1, 1, 3, 3, 3, 2, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 3, 1, 3, 3, 3, 2, 2, 2, 5, 1, 3, 1, 1, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 2, 2, 1, 1, 3, 3, 1, 0, 0, 0],
    [1, 3, 1, 1, 3, 3, 3, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0],
    [1, 2, 2, 1, 2, 1, 1, 1, 3, 4, 4, 4, 1, 1, 0, 0, 0],
    [1, 1, 2, 1, 2, 2, 3, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0],
    [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 2, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 2, 3, 3, 1, 1, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ],
  // 127
  [
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 1, 3, 1, 0, 0, 0, 1, 2, 1, 0],
    [1, 3, 2, 2, 2, 3, 3, 1, 1, 1, 3, 5, 3, 1, 1, 1, 2, 5, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 2, 2, 1, 2, 2, 1],
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 3, 3, 4, 3, 2, 2, 2, 1, 3, 4, 4, 2, 5, 2, 4, 4, 2, 1],
    [0, 1, 3, 3, 4, 4, 4, 2, 2, 1, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
    [1, 3, 3, 3, 1, 4, 4, 4, 2, 1, 1, 3, 3, 2, 2, 2, 2, 2, 1, 0],
    [1, 3, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 2, 1, 1, 3, 3, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 1, 0],
    [0, 1, 2, 2, 1, 1, 3, 5, 1, 1, 1, 1, 2, 2, 1, 3, 3, 3, 1, 1],
    [0, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 1, 1, 5, 1, 1, 1, 3, 5, 1],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  ],
  // 128 - sleeping cat
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 0],
    [0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 7, 7, 7, 7, 7, 7, 0, 0, 0],
    [0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 3, 1, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 3, 1, 1, 1, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 3, 3, 6, 3, 3, 3, 6, 3, 3, 1, 1, 3, 3, 1, 1, 1, 1, 0],
    [0, 1, 3, 6, 7, 6, 3, 6, 7, 6, 3, 1, 3, 3, 3, 3, 3, 3, 1, 0],
    [0, 1, 3, 3, 6, 3, 3, 3, 6, 3, 3, 1, 3, 3, 3, 3, 3, 3, 1, 1],
    [0, 1, 3, 4, 4, 3, 5, 3, 4, 4, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 1, 3, 3, 3, 3, 1],
    [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1],
    [1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 3, 1, 3, 3, 1, 1],
    [1, 1, 3, 3, 5, 1, 5, 3, 3, 1, 3, 1, 1, 1, 1, 3, 3, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  ],
];

// src/cat21/mooncat-parser.helper.ts
function RGBToHSL(r, g, b) {
  var r = r / 255;
  var g = g / 255;
  var b = b / 255;
  var cMax = Math.max(r, g, b);
  var cMin = Math.min(r, g, b);
  var delta = cMax - cMin;
  if (delta == 0) {
    var h = 0;
  } else if (cMax == r) {
    var h = 60 * (((g - b) / delta) % 6);
  } else if (cMax == g) {
    var h = 60 * ((b - r) / delta + 2);
  } else if (cMax == b) {
    var h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) {
    h += 360;
  }
  var l = (cMax + cMin) / 2;
  if (delta == 0) {
    var s = 0;
  } else {
    var s = delta / (1 - Math.abs(2 * l - 1));
  }
  return [h, s, l];
}
function HSLToRGB(h, s, l) {
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - c / 2;
  if (h >= 0 && h < 60) {
    var r = c,
      g = x,
      b = 0;
  } else if (h >= 60 && h < 120) {
    var r = x,
      g = c,
      b = 0;
  } else if (h >= 120 && h < 180) {
    var r = 0,
      g = c,
      b = x;
  } else if (h >= 180 && h < 240) {
    var r = 0,
      g = x,
      b = c;
  } else if (h >= 240 && h < 300) {
    var r = x,
      g = 0,
      b = c;
  } else if (h >= 300 && h < 360) {
    var r = c,
      g = 0,
      b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  return [r, g, b];
}
function RGBToHex(arr) {
  var r = arr[0],
    g = arr[1],
    b = arr[2];
  return (
    '#' +
    ('0' + r.toString(16)).slice(-2) +
    ('0' + g.toString(16)).slice(-2) +
    ('0' + b.toString(16)).slice(-2)
  );
}
function derivePalette(r, g, b, s = 1) {
  var hsl = RGBToHSL(r, g, b);
  var h = hsl[0];
  var hx = h % 360;
  var hy = (h + 320) % 360;
  var c1 = HSLToRGB(hx, s, 0.1);
  var c2 = HSLToRGB(hx, s, 0.2);
  var c3 = HSLToRGB(hx, s, 0.45);
  var c4 = HSLToRGB(hx, s, 0.7);
  var c5 = HSLToRGB(hy, s, 0.8);
  return [null, RGBToHex(c1), RGBToHex(c2), RGBToHex(c3), RGBToHex(c4), RGBToHex(c5)];
}
function deriveDarkPalette(r, g, b) {
  var hsl = RGBToHSL(r, g, b);
  var h = hsl[0];
  var hx = h % 360;
  var c1 = HSLToRGB(hx, 1, 0.15);
  var c2 = HSLToRGB(hx, 1, 0.1);
  var c3 = HSLToRGB(hx, 1, 0.075);
  var c4 = HSLToRGB(hx, 1, 0.05);
  return [RGBToHex(c1), RGBToHex(c2), RGBToHex(c3), RGBToHex(c4)];
}

// src/cat21/mooncat-parser.traits.ts
var eyesPositions = [
  {
    traits: 'Standing-Left',
    position: [8, 2],
  },
  {
    traits: 'Sleeping-Left',
    position: [11, 4],
  },
  {
    traits: 'Pouncing-Left',
    position: [4, 5],
  },
  {
    traits: 'Stalking-Left',
    position: [10, 3],
  },
  {
    traits: 'Standing-Right',
    position: [8, 12],
  },
  {
    traits: 'Sleeping-Right',
    position: [11, 11],
  },
  {
    traits: 'Pouncing-Right',
    position: [4, 9],
  },
  {
    traits: 'Stalking-Right',
    position: [10, 12],
  },
];
var laserEyesPattern = [
  [0, 6, 0, 0, 0, 6, 0],
  [6, 7, 6, 0, 6, 7, 6],
  [0, 6, 0, 0, 0, 6, 0],
];
var crownPattern = [
  [8, 9, 0, 0, 0, 8, 0, 0, 0, 9, 8],
  [8, 9, 9, 0, 8, 8, 8, 0, 9, 9, 8],
  [8, 8, 9, 8, 8, 9, 8, 8, 9, 8, 8],
  [0, 8, 8, 9, 9, 8, 9, 9, 8, 8, 0],
];
var blackSunglassesPattern = [
  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  [0, 0, 10, 10, 10, 10, 0, 10, 10, 10, 10, 0],
  [0, 0, 0, 10, 10, 0, 0, 0, 10, 10, 0, 0],
];
var laserEyesBlackSunglassesPattern = [
  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  [0, 0, 10, 10, 0, 10, 0, 10, 0, 10, 10, 0],
  [0, 0, 0, 10, 10, 0, 0, 0, 10, 10, 0, 0],
];
var coolSunglassesPattern = [
  [0, 10, 10, 10, 10, 10, 0, 10, 10, 10, 10, 10],
  [0, 10, 11, 11, 11, 10, 10, 10, 11, 11, 11, 10],
  [10, 10, 12, 12, 12, 10, 0, 10, 12, 12, 12, 10],
  [0, 10, 13, 13, 13, 10, 0, 10, 13, 13, 13, 10],
  [0, 0, 10, 10, 10, 0, 0, 0, 10, 10, 10, 0],
];
var laserEyesCoolSunglassesPattern = [
  [0, 10, 10, 10, 10, 10, 0, 10, 10, 10, 10, 10],
  [0, 10, 11, 11, 0, 10, 10, 10, 0, 11, 11, 10],
  [10, 10, 12, 12, 12, 10, 0, 10, 12, 12, 12, 10],
  [0, 10, 13, 13, 13, 10, 0, 10, 13, 13, 13, 10],
  [0, 0, 10, 10, 10, 0, 0, 0, 10, 10, 10, 0],
];
var threeDimensionsGlassesPattern = [
  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  [0, 0, 10, 11, 11, 11, 10, 12, 12, 12, 10, 0],
  [0, 0, 10, 11, 11, 11, 10, 12, 12, 12, 10, 0],
  [0, 0, 10, 10, 10, 10, 0, 10, 10, 10, 10, 0],
];
var nounsGlassesPattern = [
  [0, 0, 10, 10, 10, 10, 0, 10, 10, 10, 10],
  [10, 10, 10, 11, 12, 10, 10, 10, 11, 12, 10],
  [10, 0, 10, 11, 12, 10, 0, 10, 11, 12, 10],
  [0, 0, 10, 10, 10, 10, 0, 10, 10, 10, 10],
];
function enlargeAndAlignDesign(originalDesign) {
  const gridWidth = 22;
  const gridHeight = 22;
  const bottomPadding = 1;
  const catWidth = originalDesign[0].length;
  const catHeight = originalDesign.length;
  const xOffset = Math.floor((gridWidth - catWidth) / 2);
  const yOffset = Math.max(gridHeight - catHeight - bottomPadding, 0);
  const enlargedDesign = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
  for (let rowIndex = 0; rowIndex < catHeight; rowIndex++) {
    for (let colIndex = 0; colIndex < catWidth; colIndex++) {
      const newRow = rowIndex + yOffset;
      const newCol = colIndex + xOffset;
      enlargedDesign[newRow][newCol] = originalDesign[rowIndex][colIndex];
    }
  }
  return enlargedDesign;
}
function decodeTraits(designIndex) {
  const poses = ['Standing', 'Sleeping', 'Pouncing', 'Stalking'];
  const expressions = ['Smile', 'Grumpy', 'Pouting', 'Shy'];
  const patterns = ['Solid', 'Striped', 'Eyepatch', 'Half/Half'];
  const pose = poses[designIndex % 4];
  const expression = expressions[Math.floor(designIndex / 16) % 4];
  const pattern = patterns[Math.floor(designIndex / 4) % 4];
  const facing = designIndex < 64 ? 'Left' : 'Right';
  return {
    pose,
    expression,
    pattern,
    facing,
  };
}
function alterDesign(design, position, newPattern) {
  const alteredDesign = design.map(row => [...row]);
  const [startRow, startColumn] = position;
  for (let row = 0; row < newPattern.length; row++) {
    for (let column = 0; column < newPattern[row].length; column++) {
      const designRow = startRow + row;
      const designColumn = startColumn + column;
      if (
        alteredDesign[designRow] !== void 0 &&
        alteredDesign[designRow][designColumn] !== void 0
      ) {
        if (newPattern[row][column] > 0) {
          alteredDesign[designRow][designColumn] = newPattern[row][column];
        }
      }
    }
  }
  return alteredDesign;
}
function getEyesPosition(designIndex, rowOffset = 0, colOffset = 0) {
  const traits = decodeTraits(designIndex);
  const poseFacingKey = `${traits.pose}-${traits.facing}`;
  const eyesPosition = eyesPositions.find(x => x.traits == poseFacingKey);
  if (!eyesPosition) {
    return [-99, -99];
  }
  return [eyesPosition.position[0] + rowOffset, eyesPosition.position[1] + colOffset];
}
function applyLaserEyes(design, designIndex) {
  const position = getEyesPosition(designIndex);
  return alterDesign(design, position, laserEyesPattern);
}
function applyCrown(design, designIndex) {
  const position = getEyesPosition(designIndex, -4, -2);
  return alterDesign(design, position, crownPattern);
}
function applyBlackSunglasses(design, designIndex) {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, blackSunglassesPattern);
}
function applyLaserEyesBlackSunglasses(design, designIndex) {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, laserEyesBlackSunglassesPattern);
}
function applyCoolSunglasses(design, designIndex) {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, coolSunglassesPattern);
}
function applyLaserEyesCoolSunglasses(design, designIndex) {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, laserEyesCoolSunglassesPattern);
}
function applyThreeDimensionsGlasses(design, designIndex) {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, threeDimensionsGlassesPattern);
}
function applyNounsGlasses(design, designIndex) {
  const position = getEyesPosition(designIndex, 0, -3);
  return alterDesign(design, position, nounsGlassesPattern);
}

// src/cat21/mooncat-parser.ts
var MooncatParser = class _MooncatParser {
  /**
   * Parses a modified Mooncat design based on the given transaction ID + block ID + feeRate.
   *
   * @param catHash - concatenated transactionId and blockId
   * @param feeRate - the fee rate of the transaction in sat/vB
   * @returns Mooncat design as a 2D array.
   */
  static parse(catHash, feeRate) {
    const bytes = hexToBytes(catHash);
    const genesis = bytes[0] === 79;
    const k = bytes[1];
    const saturationSeed = bytes[1];
    const dark_r = bytes[2];
    const dark_g = bytes[3];
    const dark_b = bytes[4];
    const laserEyesByte = bytes[5];
    const orangeLaserEyes = laserEyesByte >= 0 && laserEyesByte <= 50;
    const greenLaserEyes = laserEyesByte >= 51 && laserEyesByte <= 101;
    const redLaserEyes = laserEyesByte >= 102 && laserEyesByte <= 152;
    const blueLaserEyes = laserEyesByte >= 153 && laserEyesByte <= 203;
    const noLaserEyes = laserEyesByte >= 204 && laserEyesByte <= 255;
    const backgroundByte = bytes[6];
    const block9Background = backgroundByte >= 0 && backgroundByte <= 63;
    const orangeBackground = backgroundByte >= 64 && backgroundByte <= 127;
    const whitepaperBackground = backgroundByte >= 128 && backgroundByte <= 191;
    const cyberpunkBackground = backgroundByte >= 192 && backgroundByte <= 255;
    const crown = bytes[7] >= 120 && bytes[7] <= 145;
    const glassesByte = bytes[8];
    const blackSunglasses = glassesByte >= 0 && glassesByte <= 25;
    const coolSunglasses = glassesByte >= 26 && glassesByte <= 51;
    const threeDimensionsGlasses = noLaserEyes && glassesByte >= 52 && glassesByte <= 77;
    const nounsGlasses = noLaserEyes && glassesByte >= 78 && glassesByte <= 153;
    const inverted = k >= 128;
    const designIndex = k % 128;
    let design = enlargeAndAlignDesign(designs[designIndex]);
    const [dark1, dark2, dark3, dark4] = deriveDarkPalette(dark_r, dark_g, dark_b);
    let glassesColors = [];
    let glassesName = 'None';
    if (!noLaserEyes) {
      design = applyLaserEyes(design, designIndex);
    }
    if (noLaserEyes && blackSunglasses) {
      glassesName = 'Black';
      glassesColors = ['#000000'];
      design = applyBlackSunglasses(design, designIndex);
    }
    if (!noLaserEyes && blackSunglasses) {
      glassesName = 'Black';
      glassesColors = ['#000000'];
      design = applyLaserEyesBlackSunglasses(design, designIndex);
    }
    if (noLaserEyes && coolSunglasses) {
      glassesName = 'Cool';
      glassesColors = ['#000000', dark3, dark2, dark1];
      design = applyCoolSunglasses(design, designIndex);
    }
    if (!noLaserEyes && coolSunglasses) {
      glassesName = 'Cool';
      glassesColors = ['#000000', dark3, dark2, dark1];
      design = applyLaserEyesCoolSunglasses(design, designIndex);
    }
    if (threeDimensionsGlasses) {
      glassesName = '3D';
      glassesColors = ['#ffffff', '#328dfd', '#fd3232'];
      design = applyThreeDimensionsGlasses(design, designIndex);
    }
    if (nounsGlasses) {
      glassesName = 'Nouns';
      let firstColor = '#f3322c';
      const colorMappings = [
        { range: [78, 81], color: '#ff638d' },
        // hip rose
        { range: [82, 85], color: '#2b83f6' },
        // blue med saturated
        { range: [86, 89], color: '#5648ed' },
        // blue
        { range: [90, 93], color: '#8dd122' },
        // frog green
        { range: [94, 97], color: '#9cb4b8' },
        // grey light
        { range: [98, 101], color: '#e8705b' },
        // guava
        { range: [102, 105], color: '#d19a54' },
        // honey
        { range: [106, 109], color: '#b9185c' },
        // magenta
        { range: [110, 113], color: '#fe500c' },
        // orange
        { range: [114, 117], color: '#d7d3cd' },
        // smoke
        { range: [118, 121], color: '#4bea69' },
        // teal
        { range: [122, 126], color: '#ec5b43' },
        // watermelon
        { range: [127, 130], color: '#ffef16' },
        // yellow saturated
      ];
      for (const { range, color } of colorMappings) {
        if (glassesByte >= range[0] && glassesByte <= range[1]) {
          firstColor = color;
          break;
        }
      }
      glassesColors = [firstColor, '#ffffff', '#000000'];
      design = applyNounsGlasses(design, designIndex);
    }
    if (crown) {
      design = applyCrown(design, designIndex);
    }
    let colors;
    let laserEyesColors = [null, null];
    let laserEyesName = 'None';
    let crownColors = orangeBackground ? ['#b8d8e7', '#cbe3f0'] : ['#ffaf51', '#ffcf39'];
    if (redLaserEyes) {
      laserEyesColors = ['#ff0000', '#ff9900'];
      laserEyesName = 'Red';
    } else if (greenLaserEyes) {
      laserEyesColors = ['#009900', '#33ff00'];
      laserEyesName = 'Green';
    } else if (blueLaserEyes) {
      laserEyesColors = ['#0033cc', '#66ccff'];
      laserEyesName = 'Blue';
    } else if (orangeLaserEyes) {
      laserEyesColors = ['#ff9900', '#ffe0b3'];
      laserEyesName = 'Orange';
    }
    const { rgb, saturation } = feeRateToColor(feeRate, saturationSeed);
    colors = derivePalette(rgb[0], rgb[1], rgb[2], saturation);
    if (feeRate >= 69 && feeRate < 70) {
      colors[1] = '#ff0000';
      colors[2] = '#ffa500';
      colors[3] = '#ffff00';
    }
    if (genesis) {
      if (inverted) {
        colors = [null, '#555555', '#d3d3d3', '#ffffff', '#aaaaaa', '#ff9999'];
      } else {
        colors = [null, '#555555', '#222222', '#111111', '#bbbbbb', '#ff9999'];
      }
    }
    colors = [
      ...colors,
      // 0 to 5
      laserEyesColors[0],
      // 6
      laserEyesColors[1],
      // 7
      crownColors[0],
      // 8
      crownColors[1],
      // 9
      ...glassesColors,
      // 10 to 13
    ];
    const catData = design.map(row => {
      return row.map(cell => colors[cell]);
    });
    const designTraits = decodeTraits(designIndex);
    const genderName = designIndex < 64 ? 'Female' : 'Male';
    let backgroundColors = ['#ff9900'];
    let backgroundName = 'Orange';
    if (block9Background) {
      backgroundName = 'Block9';
      backgroundColors = inverted
        ? [dark2, dark4, dark3, '#ff9900', '#cc7a00', '#ffad33']
        : [dark2, dark3, dark4, '#ff9900', '#ffad33', '#cc7a00'];
    } else if (cyberpunkBackground) {
      const [, , , c4] = derivePalette(dark_r, dark_g, dark_b);
      backgroundColors = inverted ? [dark1, c4] : [c4, dark1];
      backgroundName = 'Cyberpunk';
    } else if (whitepaperBackground) {
      const [, , , c4] = derivePalette(dark_r, dark_g, dark_b);
      backgroundColors = inverted ? ['#ffffff', dark2] : [c4, '#ffffff'];
      backgroundName = 'Whitepaper';
    }
    const crownName = crown ? (orangeBackground ? 'Diamond' : 'Gold') : 'None';
    const traits = {
      genesis,
      catColors: [colors[1], colors[2], colors[3], colors[4], colors[5]],
      backgroundColors,
      gender: genderName,
      designIndex,
      designPose: designTraits.pose,
      designExpression: designTraits.expression,
      designPattern: designTraits.pattern,
      designFacing: designTraits.facing,
      laserEyes: laserEyesName,
      background: backgroundName,
      crown: crownName,
      glasses: glassesName,
      glassesColors,
    };
    return {
      catData,
      traits,
    };
  }
  /**
   * Returns a placeholder cat 2D array
   *
   * @returns Mooncat design.
   */
  static parsePlaceholder() {
    let colors = [
      null,
      '#bbbbbb',
      '#ffffff',
      '#ffffff',
      '#ffffff',
      '#ffffff',
      '#ffffff',
      '#555555',
    ];
    const design = enlargeAndAlignDesign(designs[128]);
    const catData = design.map(row => {
      return row.map(cell => colors[cell]);
    });
    return {
      catData,
      traits: null,
    };
  }
  /**
   * Generates an SVG representation of a Mooncat from a given catHash.
   *
   * This function parses the Mooncat design from the catHash (transactionId + blockId) and constructs an SVG
   * image, where each pixel of the Mooncat design is represented as an SVG rectangle.
   *
   * @param catHash - transactionId in hex format
   * @param blockId - blockId in hex format
   * @param feeRate - the fee rate of the transaction in sat/vB
   * @returns The traits and a string containing the SVG markup of the Mooncat.
   */
  static parseAndGenerateSvg(catHash, feeRate) {
    let parsed;
    if (catHash) {
      parsed = _MooncatParser.parse(catHash, feeRate);
    } else {
      parsed = _MooncatParser.parsePlaceholder();
    }
    const catData = parsed.catData;
    const traits = parsed.traits;
    let svg = `<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
`;
    switch (traits?.background) {
      case 'Block9': {
        const rows = 14;
        const columns = 17;
        const cubeSize = 2.21;
        svg += getIsomometricCubePattern(rows, columns, cubeSize, 22, 22, traits.backgroundColors);
        break;
      }
      case 'Cyberpunk': {
        svg += getCypherpunksManifestoText(traits.backgroundColors);
        break;
      }
      case 'Whitepaper': {
        svg += getWhitepaperText(traits.backgroundColors);
        break;
      }
      default: {
        const bgColor = traits?.backgroundColors[0] || '#000000';
        svg += getBgRect(bgColor);
        break;
      }
    }
    for (let rowIndex = 0; rowIndex < 22; rowIndex++) {
      for (let colIndex = 0; colIndex < 22; colIndex++) {
        const color = catData[rowIndex][colIndex];
        if (color) {
          svg += `<rect x="${colIndex}" y="${rowIndex}" width="1" height="1" fill="${color}" stroke="${color}" stroke-width="0.05" />
`;
        }
      }
    }
    svg += '</svg>';
    return {
      svg,
      traits,
    };
  }
};

// src/cat21/cat21-parser.service.ts
var Cat21ParserService = class _Cat21ParserService {
  /**
   * Parses a transaction to determine if it is a valid CAT-21 mint transaction.
   *
   * @param transaction - The transaction to parse.
   * @returns A ParsedCat object if the transaction is a valid CAT-21 transaction, otherwise null.
   *          For unconfirmed transactions the SVG is a placeholder image and the traits are null
   */
  static parse(transaction, onError) {
    try {
      if (!_Cat21ParserService.hasCat21(transaction)) {
        return null;
      }
      const vsize = transaction.weight / 4;
      const feeRate = transaction.fee / vsize;
      const type = 'Cat21'; /* Cat21 */
      const transactionId = transaction.txid;
      const blockId = transaction.status.block_hash || null;
      const uniqueId = `${'Cat21' /* Cat21 */}-${transaction.txid}-${blockId || 'unconfirmed'}`;
      const catHash = blockId ? createCatHash(transactionId, blockId) : null;
      let svgAndTraits = null;
      return {
        type,
        transactionId,
        blockId,
        uniqueId,
        getImage: () => {
          if (!svgAndTraits) {
            svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);
          }
          return svgAndTraits.svg;
        },
        getTraits: () => {
          if (!svgAndTraits) {
            svgAndTraits = MooncatParser.parseAndGenerateSvg(catHash, feeRate);
          }
          return svgAndTraits.traits;
        },
      };
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }
  /**
   * Validates if a transaction meets all the CAT-21 protocol rules.
   *
   * @param transaction - The transaction to validate.
   * @returns True if the transaction is a valid CAT-21 transaction, false otherwise.
   */
  static hasCat21(transaction) {
    if (transaction.locktime == 21) {
      return true;
    }
    return false;
  }
};
export { Cat21ParserService, MooncatParser, createCatHash, feeRateToColor };
