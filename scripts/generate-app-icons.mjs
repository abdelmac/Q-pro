// Deterministic exports from the same vector paths as BrandLogo, not a bitmap crop.
// The original supplied PNG is preserved as a reference. No network is needed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const source = await readFile('public/branding/specialty-match-logo.png');
assert.equal(createHash('sha256').update(source).digest('hex'), 'a94bd5c7f200df275760278c506267f3fc833d53f26ab484d0f0836744b12c98', 'Review the supplied artwork before changing the icon source');
const geometry = JSON.parse(await readFile('src/data/brandArtwork.json', 'utf8'));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="${geometry.markViewBox}">
  <defs>
    <linearGradient id="compass-gradient" x1="2" y1="65" x2="98" y2="35" gradientUnits="userSpaceOnUse">
      <stop stop-color="${geometry.blue}"/><stop offset="1" stop-color="${geometry.teal}"/>
    </linearGradient>
    <mask id="compass-needle" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <path d="${geometry.northPath} ${geometry.southPath}" fill="white"/>
      <circle cx="49" cy="50" r="4" fill="black"/>
    </mask>
  </defs>
  <path d="${geometry.ringPath}" fill="url(#compass-gradient)"/>
  <g mask="url(#compass-needle)">
    <path d="${geometry.northPath}" fill="${geometry.teal}"/>
    <path d="${geometry.southPath}" fill="${geometry.blue}"/>
  </g>
</svg>
`;
const sourceUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length, 0);
  data.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}

// Opaque exports use true RGB PNGs, without an alpha channel, for iOS.
function png(size, rgba, opaque) {
  const channels = opaque ? 3 : 4;
  assert.equal(rgba.length, size * size * 4);
  const scanlines = Buffer.alloc(size * (size * channels + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const input = (y * size + x) * 4;
    const output = y * (size * channels + 1) + 1 + x * channels;
    if (opaque) assert.equal(rgba[input + 3], 255, 'Opaque app icons must have no transparent pixels');
    rgba.copy(scanlines, output, input, input + channels);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = opaque ? 2 : 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, {level:9})), chunk('IEND', Buffer.alloc(0))]);
}

function ico(images) {
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({size, bytes}, index) => {
    const entry = 6 + index * 16;
    directory[entry] = size; directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(bytes.length, entry + 8); directory.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  return Buffer.concat([directory, ...images.map(image => image.bytes)]);
}

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined);
const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
await writeFile('public/branding/compass.svg', svg);
let written = 1;
try {
  const page = await browser.newPage();
  await page.route('http{,s}://**/*', route => route.abort());
  const exportIcon = async (path, size, {fraction = 0.8, opaque = true, round = false, foreground = false} = {}) => {
    const raw = await page.evaluate(async ({sourceUrl, size, fraction, round, foreground}) => {
      const image = new Image(); image.src = sourceUrl; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (round) { context.beginPath(); context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); context.clip(); }
      if (!foreground) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, size, size); }
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      const side = size * fraction; const inset = (size - side) / 2;
      context.drawImage(image, inset, inset, side, side);
      const data = context.getImageData(0, 0, size, size).data;
      let binary = '';
      for (let start = 0; start < data.length; start += 16384) binary += String.fromCharCode(...data.subarray(start, start + 16384));
      return btoa(binary);
    }, {sourceUrl, size, fraction, round, foreground});
    const bytes = png(size, Buffer.from(raw, 'base64'), opaque);
    await mkdir(dirname(path), {recursive:true});
    await writeFile(path, bytes);
    written++;
    return {size, bytes};
  };
  const favicons = [];
  for (const size of [16,32,48]) favicons.push(await exportIcon(`public/branding/favicon-${size}.png`, size, {fraction:1, foreground:true, opaque:false}));
  await writeFile('public/branding/favicon.ico', ico(favicons)); written++;
  await exportIcon('public/branding/apple-touch-icon.png', 180);
  for (const size of [192,512]) await exportIcon(`public/branding/icon-${size}.png`, size);
  for (const [density, size, adaptive] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]) {
    const directory = `android/app/src/main/res/mipmap-${density}`;
    await exportIcon(`${directory}/ic_launcher.png`, size);
    await exportIcon(`${directory}/ic_launcher_round.png`, size, {round:true, opaque:false});
    // Android's 108dp adaptive layer has a 66dp safe zone. Keep the mark inside it:
    // https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
    await exportIcon(`${directory}/ic_launcher_foreground.png`, adaptive, {fraction:0.6, foreground:true, opaque:false});
  }
  await exportIcon('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024);
  console.log(`Exported ${written} vector/browser, home-screen, Android and iOS icon assets from shared vector paths; original reference PNG unchanged.`);
} finally { await browser.close(); }
