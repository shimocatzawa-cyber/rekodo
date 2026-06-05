import sharp from "sharp";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, "../public");

// SVG template — ō centred in a white square.
// Georgia is a close match for Shippori Mincho's weight at favicon sizes;
// both are oldstyle serifs. The macron on ō stays legible down to 16px.
function makeSvg(size) {
  const fontSize = Math.round(size * 0.68);
  // Optical vertical centre: cap-height is ~70% of em, macron adds ~15% above.
  // Nudge baseline so the full glyph sits in the middle of the square.
  const y = Math.round(size * 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <text
    x="${size / 2}"
    y="${y}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="bold"
    font-size="${fontSize}"
    fill="#CC5500"
  >&#x14D;</text>
</svg>`;
}

async function pngBuffer(size) {
  return sharp(Buffer.from(makeSvg(size)), { density: 192 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─── ICO builder ─────────────────────────────────────────────────────────────
// Modern ICO files may embed PNG data directly (Windows Vista+).
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  let dataOffset = dirSize;
  const offsets = pngBuffers.map((buf) => {
    const off = dataOffset;
    dataOffset += buf.length;
    return off;
  });

  const ico = Buffer.alloc(dataOffset);

  // ICONDIR header
  ico.writeUInt16LE(0, 0);       // reserved
  ico.writeUInt16LE(1, 2);       // type: 1 = ICO
  ico.writeUInt16LE(count, 4);   // number of images

  // ICONDIRENTRY per image
  pngBuffers.forEach((buf, i) => {
    const base = headerSize + i * dirEntrySize;
    // Width/height: 0 means 256 in the spec, but we only use 16 and 32 here.
    const dim = buf.readUInt32BE(16); // PNG IHDR width (big-endian at offset 16)
    const w = dim > 255 ? 0 : dim;
    const h = w;
    ico.writeUInt8(w, base);           // width
    ico.writeUInt8(h, base + 1);       // height
    ico.writeUInt8(0, base + 2);       // colour count (0 = no palette)
    ico.writeUInt8(0, base + 3);       // reserved
    ico.writeUInt16LE(1, base + 4);    // colour planes
    ico.writeUInt16LE(32, base + 6);   // bits per pixel
    ico.writeUInt32LE(buf.length, base + 8);   // size of image data
    ico.writeUInt32LE(offsets[i], base + 12);  // offset of image data
    buf.copy(ico, offsets[i]);
  });

  return ico;
}

// ─── Generate ────────────────────────────────────────────────────────────────
const [png16, png32, png180] = await Promise.all([
  pngBuffer(16),
  pngBuffer(32),
  pngBuffer(180),
]);

writeFileSync(`${PUBLIC}/favicon-16x16.png`, png16);
console.log("✓ favicon-16x16.png");

writeFileSync(`${PUBLIC}/favicon-32x32.png`, png32);
console.log("✓ favicon-32x32.png");

writeFileSync(`${PUBLIC}/apple-touch-icon.png`, png180);
console.log("✓ apple-touch-icon.png");

const ico = buildIco([png16, png32]);
writeFileSync(`${PUBLIC}/favicon.ico`, ico);
console.log("✓ favicon.ico");

console.log("\nAll favicon files written to /public.");
