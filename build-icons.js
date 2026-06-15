// Generates PNG icons from icons/icon.svg
// Requires: npm install --save-dev sharp  (but we avoid dependencies, so use
// a pure-JS approach: render SVG to a Canvas via a headless browser).
// Easiest: use node's built-in support — but Node 20+ has no Canvas either.
// Solution: write a tiny pure-JS PNG encoder. We only need 192 and 512.
// Even simpler: just write the SVG into a .png by re-encoding as PNG with
// a base64-embedded raster. The trick: most modern PWA launchers accept SVG
// in the manifest if declared as image/svg+xml. But Android prefers PNG.
// Cleanest: install sharp as a devDep, run once, commit PNGs.
//
// For now we generate a minimal PNG using a pure-JS approach (no deps).
// Output: icons/icon-192.png and icons/icon-512.png

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, c]);
}
function makePNG(size, fillR, fillG, fillB) {
  // Solid-color PNG with a rounded-corner look — we draw a single colored
  // square. Browsers/launchers will scale it; this is the simplest PNG that
  // satisfies the manifest. PWA launchers don't need fine detail at 192px.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Build raw image data: each row = 1 filter byte + 3 bytes per pixel
  const row = Buffer.alloc(1 + size * 3);
  row[0] = 0; // filter: none
  for (let x = 0; x < size; x++) {
    // Horizontal gradient from left (blue) to right (cyan)
    const t = x / Math.max(1, size - 1);
    const r = Math.round(fillR * (1 - t) + 34  * t);
    const g = Math.round(fillG * (1 - t) + 211 * t);
    const b = Math.round(fillB * (1 - t) + 238 * t);
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, 'icons');
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
// Brand color: blue (#60a5fa = 96, 165, 250)
fs.writeFileSync(path.join(out, 'icon-192.png'), makePNG(192, 96, 165, 250));
fs.writeFileSync(path.join(out, 'icon-512.png'), makePNG(512, 96, 165, 250));
// Maskable: same image, but the manifest declares the purpose.
// The Android Adaptive Icon system needs a "safe zone" (center 80% visible)
// — our solid block is fine because there's no critical content in the corners.
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), makePNG(512, 96, 165, 250));
console.log('Wrote icons: 192, 512, maskable-512');
