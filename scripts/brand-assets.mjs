import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Regenerate from the supplied transparent artwork, without tracing or redrawing it.
await mkdir('public/brand', { recursive: true });
const { data, info } = await sharp('logo.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let left = info.width, top = info.height, right = 0, bottom = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const i = (y * info.width + x) * 4 + 3;
  if (data[i] < 16) data[i] = 0; // Ignore almost invisible export noise in the outer margins.
  if (data[i] >= 16) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
}
const cropped = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer();
const { data: pixels, info: size } = await sharp(cropped).raw().toBuffer({ resolveWithObject: true });
// The first fully empty column separates the symbol from its wordmark.
let split = 0;
for (let x = 1; x < size.width; x++) {
  let occupied = false;
  for (let y = 0; y < size.height; y++) if (pixels[(y * size.width + x) * 4 + 3] >= 16) { occupied = true; break; }
  if (!occupied) { split = x; break; }
}
if (split < 100) throw new Error('Cannot identify the symbol: review the source artwork crop.');
const mark = await sharp(cropped).extract({ left: 0, top: 0, width: split, height: size.height }).png().toBuffer();
await sharp(cropped).resize({ width: 1280 }).png().toFile('public/brand/logo.png');
for (const width of [640, 1280]) await sharp(cropped).resize({ width }).webp({ quality: 92, alphaQuality: 100 }).toFile(`public/brand/logo-${width}.webp`);
async function square(n, white = false, padding = .08) {
  const inner = Math.round(n * (1 - padding * 2));
  const symbol = await sharp(mark).resize(inner, inner, { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: n, height: n, channels: 4, background: white ? '#ffffff' : '#ffffff00' } })
    .composite([{ input: symbol, gravity: 'centre' }]).png().toBuffer();
}
for (const n of [48, 96, 144]) await writeFile(`public/favicon-${n}.png`, await square(n));
await writeFile('public/brand/mark-512.png', await square(512));
await writeFile('public/brand/logo-square.png', await square(512, true));
await writeFile('public/apple-touch-icon.png', await square(180, true, .15));
for (const n of [192, 512]) await writeFile(`public/icon-${n}.png`, await square(n, true, .15));
// ICO directory with PNG-compressed frames, supported by modern browsers and Windows.
const frames = await Promise.all([16, 32, 48].map(n => square(n)));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
let offset = header.length;
for (const [i, n] of [16, 32, 48].entries()) {
  const p = 6 + i * 16;
  header[p] = n; header[p + 1] = n; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(frames[i].length, p + 8); header.writeUInt32LE(offset, p + 12); offset += frames[i].length;
}
await writeFile('public/favicon.ico', Buffer.concat([header, ...frames]));
await writeFile('public/site.webmanifest', JSON.stringify({
  name: 'compresser pdf', short_name: 'compresser pdf', id: '/', start_url: '/', scope: '/', display: 'browser',
  background_color: '#ffffff', theme_color: '#174f3b',
  icons: [192, 512].map(n => ({ src: `/icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any' })),
}, null, 2) + '\n');
const embedded = (await sharp(cropped).resize({ width: 640 }).png().toBuffer()).toString('base64');
for (const language of ['fr', 'en']) {
  const path = language === 'fr' ? 'public/social-fr.svg' : 'public/social.svg';
  let svg = await readFile(path, 'utf8');
  const logo = `<image id="brand-logo" x="86" y="65" width="330" height="73" href="data:image/png;base64,${embedded}"/>`;
  svg = svg.replace(/<text\b[^>]*>compresser pdf<\/text>|<image\b[^>]*id="brand-logo"[^>]*\/>/, logo);
  await writeFile(path, svg);
  await sharp(Buffer.from(svg)).png().toFile(`public/social-${language}.png`);
}
console.log(`Brand assets: wordmark ${size.width}x${size.height}, symbol ${split}x${size.height}; PNG, WebP, ICO, touch icons and social cards generated.`);
