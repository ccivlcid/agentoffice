#!/usr/bin/env node
/**
 * Sprite generation pipeline script
 * Generates placeholder sprite files for a new character sprite number.
 *
 * Usage:
 *   node scripts/generate-sprite.mjs <sprite_number>
 *   node scripts/generate-sprite.mjs 13
 *
 * This creates 5 PNG files in public/sprites/:
 *   {N}-D-1.png, {N}-D-2.png, {N}-D-3.png  (down-facing frames)
 *   {N}-L-1.png                              (left-facing frame)
 *   {N}-R-1.png                              (right-facing frame)
 *
 * Each file is a 508x847 RGBA PNG placeholder.
 * Replace with actual pixel art assets after generation.
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const SPRITE_W = 508;
const SPRITE_H = 847;
const DIRECTIONS = [
  { suffix: "D-1", color: [60, 180, 120] },
  { suffix: "D-2", color: [50, 170, 110] },
  { suffix: "D-3", color: [70, 190, 130] },
  { suffix: "L-1", color: [120, 60, 180] },
  { suffix: "R-1", color: [180, 120, 60] },
];

function createMinimalPng(width, height, r, g, b, label) {
  // Build raw RGBA pixel data with filter byte per row
  const rowBytes = width * 4 + 1; // +1 for filter byte
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    rawData[y * rowBytes] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const offset = y * rowBytes + 1 + x * 4;
      // Simple silhouette: a rounded body shape
      const cx = width / 2, cy = height * 0.45;
      const rx = width * 0.35, ry = height * 0.4;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy < 1;
      // Head circle
      const hcx = width / 2, hcy = height * 0.18, hr = width * 0.2;
      const hdx = x - hcx, hdy = y - hcy;
      const inHead = hdx * hdx + hdy * hdy < hr * hr;

      if (inside || inHead) {
        rawData[offset] = r;
        rawData[offset + 1] = g;
        rawData[offset + 2] = b;
        rawData[offset + 3] = 255;
      } else {
        rawData[offset] = 0;
        rawData[offset + 1] = 0;
        rawData[offset + 2] = 0;
        rawData[offset + 3] = 0;
      }
    }
  }

  const compressed = deflateSync(rawData);

  // PNG file structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const combined = Buffer.concat([typeBuffer, data]);
    const crc = crc32(combined);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, combined, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", iend),
  ]);
}

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log("Usage: node scripts/generate-sprite.mjs <sprite_number>");
  console.log("Example: node scripts/generate-sprite.mjs 13");
  process.exit(0);
}

const spriteNum = parseInt(args[0], 10);
if (isNaN(spriteNum) || spriteNum < 1) {
  console.error("Error: sprite_number must be a positive integer");
  process.exit(1);
}

const repoRoot = resolve(import.meta.dirname, "..");
const spritesDir = join(repoRoot, "public", "sprites");

if (!existsSync(spritesDir)) {
  mkdirSync(spritesDir, { recursive: true });
  console.log(`Created directory: ${spritesDir}`);
}

let created = 0;
for (const { suffix, color } of DIRECTIONS) {
  const filename = `${spriteNum}-${suffix}.png`;
  const filepath = join(spritesDir, filename);

  if (existsSync(filepath)) {
    console.log(`  SKIP (exists): ${filename}`);
    continue;
  }

  const png = createMinimalPng(SPRITE_W, SPRITE_H, color[0], color[1], color[2], `${spriteNum}-${suffix}`);
  writeFileSync(filepath, png);
  console.log(`  CREATED: ${filename} (${png.length} bytes)`);
  created++;
}

console.log(`\nSprite #${spriteNum}: ${created} files created, ${DIRECTIONS.length - created} skipped (already exist).`);
console.log("Replace placeholder PNGs with actual pixel art assets.");
