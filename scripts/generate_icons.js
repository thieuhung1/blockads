// Script to generate high-quality PNG icons for NetShield using built-in Node.js modules
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, pixelFn) {
  // RGBA buffer: 4 bytes per pixel + 1 filter byte per scanline
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 implementation
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// Shield pixel generator
function shieldPixel(x, y, w, h) {
  const nx = (x / (w - 1)) * 2 - 1; // -1 to 1
  const ny = (y / (h - 1)) * 2 - 1; // -1 to 1

  // Outer circle/rounded rect background
  const distCenter = Math.sqrt(nx * nx + ny * ny);
  if (distCenter > 0.95) {
    return [0, 0, 0, 0];
  }

  // Shield shape logic
  // Top: flat with rounded top corners
  // Bottom: curving to point at (0, 0.75)
  const isInsideShield = (function() {
    if (ny < -0.7 || ny > 0.8) return false;
    if (Math.abs(nx) > 0.75) return false;
    if (ny < 0) {
      return Math.abs(nx) <= 0.7;
    } else {
      // Curve down to bottom
      const maxW = 0.7 * (1 - Math.pow(ny / 0.8, 1.8));
      return Math.abs(nx) <= maxW;
    }
  })();

  // Badge background (deep cyber blue / dark slate)
  const bgGrad = Math.floor(20 + 25 * (ny + 1));
  let r = 14;
  let g = 22;
  let b = 40;
  let a = 255;

  if (isInsideShield) {
    // Shield gradient: Cyan to Electric Indigo
    const shieldGrad = (ny + 0.7) / 1.5;
    r = Math.floor(6 + 30 * shieldGrad);
    g = Math.floor(182 - 70 * shieldGrad);
    b = Math.floor(212 + 40 * shieldGrad);

    // Inner checkmark or lightning symbol
    // Checkmark from (-0.3, 0) -> (-0.05, 0.3) -> (0.35, -0.25)
    const inCheck = (function() {
      // Segment 1: from (-0.3, 0.05) to (-0.05, 0.35)
      // Segment 2: from (-0.05, 0.35) to (0.35, -0.2)
      // Check distance to checkmark segments
      const d1 = distToSegment(nx, ny, -0.3, 0.05, -0.05, 0.35);
      const d2 = distToSegment(nx, ny, -0.05, 0.35, 0.35, -0.2);
      return Math.min(d1, d2) < 0.1;
    })();

    if (inCheck) {
      r = 255;
      g = 255;
      b = 255;
    }
  } else {
    // Subtle circular border
    if (distCenter > 0.88 && distCenter <= 0.95) {
      r = 14;
      g = 165;
      b = 233;
      a = Math.floor(200 * (1 - (distCenter - 0.88) / 0.07));
    }
  }

  return [r, g, b, a];
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPng(size, size, shieldPixel);
  const outPath = path.join(assetsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${pngBuf.length} bytes)`);
});
