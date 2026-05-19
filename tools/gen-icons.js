/**
 * CLMS PWA 아이콘 생성기 (placeholder 아이콘)
 * 외부 의존성 없이 Node 내장 모듈(zlib)만으로 PNG를 인코딩한다.
 *
 *   node tools/gen-icons.js
 *
 * 정식 도입 시 디자인된 아이콘으로 교체할 것.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- 색상 ----
const NAVY = [26, 58, 92, 255];   // #1a3a5c
const GOLD = [201, 169, 97, 255]; // #c9a961
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

// ---- PNG 인코더 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * stride + 1, y * width * 4, y * width * 4 + width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 드로잉 ----
function canvas(size) {
  return { size, buf: Buffer.alloc(size * size * 4) };
}

function fill(c, color) {
  for (let i = 0; i < c.size * c.size; i++) {
    c.buf[i * 4] = color[0];
    c.buf[i * 4 + 1] = color[1];
    c.buf[i * 4 + 2] = color[2];
    c.buf[i * 4 + 3] = color[3];
  }
}

function rect(c, x, y, w, h, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(c.size, Math.round(x + w));
  const y1 = Math.min(c.size, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * c.size + px) * 4;
      c.buf[i] = color[0];
      c.buf[i + 1] = color[1];
      c.buf[i + 2] = color[2];
      c.buf[i + 3] = color[3];
    }
  }
}

/** 스카이라인(3개 건물) 마크를 그린다. */
function drawSkyline(c, color, withWindows) {
  const N = c.size;
  const margin = N * 0.2;
  const usable = N - margin * 2;
  const gap = N * 0.045;
  const bw = (usable - gap * 2) / 3;
  const baseTop = N * 0.74;

  // 바닥선
  rect(c, margin, baseTop, usable, N * 0.045, color);

  const heights = [N * 0.30, N * 0.46, N * 0.36];
  for (let b = 0; b < 3; b++) {
    const bx = margin + b * (bw + gap);
    const bh = heights[b];
    const by = baseTop - bh;
    rect(c, bx, by, bw, bh, color);

    if (withWindows) {
      const cols = 2;
      const rows = Math.max(2, Math.round(bh / (N * 0.12)));
      const pad = bw * 0.18;
      const ww = (bw - pad * 3) / cols;
      const wh = ww;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const wx = bx + pad + col * (ww + pad);
          const wy = by + pad + r * (wh + pad);
          if (wy + wh < by + bh - pad) rect(c, wx, wy, ww, wh, NAVY);
        }
      }
    }
  }
}

// ---- 출력 ----
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, bg: NAVY, fg: GOLD, windows: true },
  { file: 'icon-512.png', size: 512, bg: NAVY, fg: GOLD, windows: true },
  { file: 'apple-touch-icon.png', size: 180, bg: NAVY, fg: GOLD, windows: true },
  { file: 'favicon-32.png', size: 32, bg: NAVY, fg: GOLD, windows: false },
  { file: 'badge-72.png', size: 72, bg: TRANSPARENT, fg: WHITE, windows: false },
];

for (const t of targets) {
  const c = canvas(t.size);
  fill(c, t.bg);
  drawSkyline(c, t.fg, t.windows);
  fs.writeFileSync(path.join(outDir, t.file), encodePNG(t.size, t.size, c.buf));
  console.log(`  생성: public/icons/${t.file} (${t.size}x${t.size})`);
}

console.log('아이콘 생성 완료.');
