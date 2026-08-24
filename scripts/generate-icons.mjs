/**
 * Regenerates every PWA icon from the two colours below.
 *
 *   node scripts/generate-icons.mjs
 *
 * No image library required — it rasterises the mark and writes PNGs with
 * Node's built-in zlib. Re-run it after you change your brand colour.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---- Brand ---------------------------------------------------------------
const BRAND = [0x8c, 0x6d, 0x58]; // --brand
const CREAM = [0xfd, 0xfb, 0xf7]; // --bg
// --------------------------------------------------------------------------

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/* ---------------------------------- PNG ---------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------- Shapes --------------------------------- */

/** Signed distance to a rounded rectangle: negative inside, positive outside. */
function sdRoundRect(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r);
  const qy = Math.abs(py - cy) - (halfH - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** Paints `color` wherever the SDF is negative, with a 1px antialiased edge. */
function paint(buf, size, sdf, color, alpha = 1) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      const cover = Math.min(1, Math.max(0, 0.5 - d)) * alpha;
      if (cover <= 0) continue;
      const i = (y * size + x) * 4;
      const src = 1 - cover;
      buf[i] = Math.round(buf[i] * src + color[0] * cover);
      buf[i + 1] = Math.round(buf[i + 1] * src + color[1] * cover);
      buf[i + 2] = Math.round(buf[i + 2] * src + color[2] * cover);
      buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * cover));
    }
  }
}

/**
 * @param inset fraction of the canvas kept clear around the mark. Maskable
 *              icons need ~10% so Android's circle crop never clips the glyph.
 */
function renderIcon(size, { inset = 0, squircle = 0.22 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = size * inset;
  const box = size - pad * 2;
  const c = size / 2;

  // Background plate
  paint(buf, size, (x, y) => sdRoundRect(x, y, c, c, box / 2, box / 2, box * squircle), BRAND);

  // Wallet flap
  paint(
    buf,
    size,
    (x, y) => sdRoundRect(x, y, c, pad + box * 0.365, box * 0.235, box * 0.075, box * 0.05),
    CREAM,
    0.55,
  );

  // Wallet body
  paint(
    buf,
    size,
    (x, y) => sdRoundRect(x, y, c, pad + box * 0.565, box * 0.29, box * 0.185, box * 0.075),
    CREAM,
  );

  // Clasp
  paint(
    buf,
    size,
    (x, y) => sdCircle(x, y, pad + box * 0.705, pad + box * 0.565, box * 0.055),
    BRAND,
  );

  return encodePng(size, size, buf);
}

/* --------------------------------- Write --------------------------------- */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="rgb(${BRAND.join(",")})"/>
  <rect x="26.5" y="29" width="47" height="15" rx="5" fill="rgb(${CREAM.join(",")})" opacity="0.55"/>
  <rect x="21" y="38" width="58" height="37" rx="7.5" fill="rgb(${CREAM.join(",")})"/>
  <circle cx="70.5" cy="56.5" r="5.5" fill="rgb(${BRAND.join(",")})"/>
</svg>
`;

mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ["icon-192.png", renderIcon(192)],
  ["icon-512.png", renderIcon(512)],
  ["icon-maskable-512.png", renderIcon(512, { inset: 0.1, squircle: 0.5 })],
  ["apple-touch-icon.png", renderIcon(180, { squircle: 0.0001 })],
  ["icon.svg", Buffer.from(svg, "utf8")],
];

for (const [name, data] of files) {
  writeFileSync(join(OUT_DIR, name), data);
  console.log(`✓ public/icons/${name} (${(data.length / 1024).toFixed(1)} KB)`);
}
