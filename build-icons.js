// Generates the PWA icons: 192×192, 512×512, and 512×512 maskable.
// Pure-JS PNG encoder (no native deps) so it runs anywhere Node does.
// Design: blue→cyan gradient background with concentric circles (lab/petri
// dish feel) and a small dark center dot. The gradient is also drawn at a
// slight angle so the icons don't look flat.

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

// Pre-built draw routine. The icon is a flat square with a rounded-corner
// mask applied by a separate mask pass. The mask turns the square into a
// superellipse (squircle), which is what Android & iOS use for app icons.
function makeIcon(size, opts) {
  const r = opts.rounded;     // corner radius (px)
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.36;   // outermost ring
  const middleR = size * 0.16;  // middle ring
  const innerR  = size * 0.05;  // center dot
  const strokeOuter = size * 0.045;
  const strokeMid   = size * 0.035;

  // For each pixel, compute the color.
  // We don't draw circles via path rasterization — we use the distance from
  // center and a series of annular bands. Simple and fast.
  function pixelColor(x, y) {
    // Linear gradient: top-left (purple) → bottom-right (cyan)
    const t = (x + y) / (2 * size);
    const tr = Math.max(0, Math.min(1, t));
    // Interpolate purple (#a78bfa) → blue (#60a5fa) → cyan (#22d3ee)
    let r, g, b;
    if (tr < 0.5) {
      const u = tr * 2;
      r = Math.round(167 * (1 - u) + 96  * u);
      g = Math.round(139 * (1 - u) + 165 * u);
      b = Math.round(250 * (1 - u) + 250 * u);
    } else {
      const u = (tr - 0.5) * 2;
      r = Math.round(96  * (1 - u) + 34  * u);
      g = Math.round(165 * (1 - u) + 211 * u);
      b = Math.round(250 * (1 - u) + 238 * u);
    }

    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Center dot (dark)
    if (dist < innerR) {
      return { r: 10, g: 14, b: 26, a: 255 };
    }
    // Inner ring stroke
    if (Math.abs(dist - middleR) < strokeMid / 2) {
      // Dark stroke against the gradient
      return { r: 10, g: 14, b: 26, a: 255 };
    }
    // Outer ring stroke
    if (Math.abs(dist - outerR) < strokeOuter / 2) {
      return { r: 10, g: 14, b: 26, a: 255 };
    }
    // Maskable: leave a safe area around the edge
    if (opts.maskable) {
      const edge = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      if (edge > size * 0.30) {
        // Same as background — no important content outside the safe zone
        return { r, g, b, a: 255 };
      }
    }
    return { r, g, b, a: 255 };
  }

  // Build raw image with rounded corner mask
  const row = Buffer.alloc(1 + size * 4);
  const raw = [];
  for (let y = 0; y < size; y++) {
    row.fill(0);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      // Rounded-corner alpha: if we're in a corner, check the rounded mask
      let alpha = 255;
      if (r > 0) {
        const cornerX = x < r ? r : (x > size - r ? size - r : null);
        const cornerY = y < r ? r : (y > size - r ? size - r : null);
        if (cornerX !== null && cornerY !== null) {
          const ddx = x - cornerX, ddy = y - cornerY;
          const d = Math.sqrt(ddx*ddx + ddy*ddy);
          if (d > r) {
            // Fully transparent
            alpha = 0;
          } else if (d > r - 1) {
            // Smooth edge
            alpha = Math.round(255 * (1 - (d - (r - 1))));
          }
        }
      }
      const c = pixelColor(x, y);
      const off = 1 + x * 4;
      row[off]     = c.r;
      row[off + 1] = c.g;
      row[off + 2] = c.b;
      row[off + 3] = alpha;
    }
    raw.push(Buffer.from(row));
  }
  const rawData = Buffer.concat(raw);
  const idat = zlib.deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, 'icons');
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

fs.writeFileSync(path.join(out, 'icon-192.png'),
  makeIcon(192, { rounded: 38, maskable: false }));
fs.writeFileSync(path.join(out, 'icon-512.png'),
  makeIcon(512, { rounded: 100, maskable: false }));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'),
  makeIcon(512, { rounded: 0, maskable: true }));
console.log('Wrote icons: 192, 512, maskable-512');
