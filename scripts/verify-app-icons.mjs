import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

// Read-only checks: no browser, network, image tools, or generated test fixtures.
// Optional: --build-dir dist --base /Q-pro/ (or dist-mobile with --base ./).
const root = fileURLToPath(new URL('..', import.meta.url));
const load = path => readFile(resolve(root, path));
const text = async path => (await load(path)).toString('utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const originalHash = 'a94bd5c7f200df275760278c506267f3fc833d53f26ab484d0f0836744b12c98';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pngs = new Map();
let checkedPngs = 0;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function verifyPng(bytes, size, label, opaque = false) {
  assert.ok(bytes.subarray(0, 8).equals(pngSignature), `${label}: PNG signature`);
  let offset = 8;
  let header;
  let ended = false;
  const compressed = [];
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, `${label}: complete chunk header`);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    assert.ok(end <= bytes.length, `${label}: ${type} chunk bounds`);
    assert.equal(bytes.readUInt32BE(end - 4), crc32(bytes.subarray(offset + 4, end - 4)), `${label}: ${type} checksum`);
    const data = bytes.subarray(offset + 8, end - 4);
    if (!header) {
      assert.equal(type, 'IHDR', `${label}: first chunk is IHDR`);
      assert.equal(length, 13, `${label}: IHDR size`);
      header = data;
    }
    if (type === 'IDAT') compressed.push(data);
    if (opaque) assert.notEqual(type, 'tRNS', `${label}: no transparency chunk`);
    offset = end;
    if (type === 'IEND') {
      assert.equal(length, 0, `${label}: valid IEND`);
      ended = true;
      break;
    }
  }
  assert.ok(ended && offset === bytes.length, `${label}: complete PNG without trailing data`);
  assert.equal(header.readUInt32BE(0), size, `${label}: width ${size}`);
  assert.equal(header.readUInt32BE(4), size, `${label}: height ${size}`);
  assert.equal(header[8], 8, `${label}: 8-bit channels`);
  assert.ok([2, 6].includes(header[9]), `${label}: RGB or RGBA image`);
  if (opaque) assert.equal(header[9], 2, `${label}: RGB with no alpha channel`);
  assert.deepEqual([...header.subarray(10)], [0, 0, 0], `${label}: standard compression, filter and non-interlaced PNG`);
  assert.ok(compressed.length > 0, `${label}: image data exists`);
  const rowBytes = size * (header[9] === 6 ? 4 : 3) + 1;
  const pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: rowBytes * size });
  assert.equal(pixels.length, rowBytes * size, `${label}: all scanlines decode`);
  for (let row = 0; row < size; row++) {
    assert.ok(pixels[row * rowBytes] <= 4, `${label}: valid PNG filter on row ${row}`);
  }
  checkedPngs++;
  return { size, colorType: header[9], rowBytes, pixels };
}

function verifyTransparentCompass(decoded, label) {
  const { size, colorType, rowBytes, pixels } = decoded;
  assert.equal(colorType, 6, `${label}: transparent compass uses RGBA`);
  // The deterministic icon exporter writes unfiltered scanlines. Verify this
  // before reading alpha so a future encoder change cannot silently mis-test.
  for (let row = 0; row < size; row++) {
    assert.equal(pixels[row * rowBytes], 0, `${label}: alpha inspection uses an unfiltered scanline`);
  }
  const alphaAt = (x, y) => pixels[y * rowBytes + 1 + x * 4 + 3];
  for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
    assert.equal(alphaAt(x, y), 0, `${label}: corner ${x},${y} has no opaque image tile`);
  }
  assert.equal(alphaAt(Math.floor(size * 0.42), Math.floor(size * 0.4)), 0, `${label}: negative space inside the compass ring is transparent`);
  // At 16px the small central cutout may be antialiased rather than fully clear.
  assert.ok(alphaAt(Math.floor(size / 2), Math.floor(size / 2)) < 255, `${label}: the needle's central cutout is transparent`);
  let paintedPixels = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (alphaAt(x, y) > 0) paintedPixels++;
  }
  assert.ok(paintedPixels > size * size * 0.05, `${label}: a visible compass is present, not a blank transparent image`);
}

const publicPngs = [
  ['favicon-16.png', 16], ['favicon-32.png', 32], ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512],
];
assert.equal(sha256(await load('public/branding/specialty-match-logo.png')), originalHash, 'The supplied artwork remains byte-for-byte unchanged');
const vector = await text('public/branding/compass.svg');
assert.match(vector, /<svg\b[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/, 'Compass is a standalone SVG document');
assert.match(vector, /<svg\b[^>]*\bviewBox=["']0 0 100 100["']/, 'Compass SVG has a square vector viewport');
for (const dimension of ['width', 'height']) {
  assert.match(vector, new RegExp(`<svg\\b[^>]*\\b${dimension}=["']100["']`), `Compass SVG ${dimension} is 100`);
}
assert.match(vector, /<path\b[^>]*\bd=["'][^"']+["']/, 'Compass SVG contains actual vector paths');
assert.doesNotMatch(vector, /<(?:image|foreignObject|script)\b|\b(?:href|src)\s*=|data:|;base64,/i, 'Compass SVG contains no embedded raster, external references, or executable content');
for (const [, target] of vector.matchAll(/url\(([^)]+)\)/gi)) {
  assert.match(target, /^#[a-z][\w-]*$/i, 'Compass SVG paint and mask references are internal fragments only');
}
for (const [name, size] of publicPngs) {
  const bytes = await load(`public/branding/${name}`);
  const favicon = name.startsWith('favicon-');
  const decoded = verifyPng(bytes, size, name, !favicon);
  if (favicon) verifyTransparentCompass(decoded, name);
  pngs.set(size, bytes);
}

const ico = await load('public/branding/favicon.ico');
assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved field');
assert.equal(ico.readUInt16LE(2), 1, 'ICO image type');
assert.equal(ico.readUInt16LE(4), 3, 'ICO contains 16, 32 and 48px images');
let previousEnd = 6 + 3 * 16;
for (const [index, size] of [16, 32, 48].entries()) {
  const start = 6 + index * 16;
  assert.equal(ico[start], size, `ICO ${size}px width`);
  assert.equal(ico[start + 1], size, `ICO ${size}px height`);
  assert.equal(ico[start + 2], 0, `ICO ${size}px non-paletted image`);
  assert.equal(ico[start + 3], 0, `ICO ${size}px reserved entry field`);
  assert.equal(ico.readUInt16LE(start + 4), 1, `ICO ${size}px planes`);
  assert.equal(ico.readUInt16LE(start + 6), 32, `ICO ${size}px depth`);
  const length = ico.readUInt32LE(start + 8);
  const offset = ico.readUInt32LE(start + 12);
  assert.equal(offset, previousEnd, `ICO ${size}px payload follows preceding data`);
  assert.ok(length > 0 && offset + length <= ico.length, `ICO ${size}px payload bounds`);
  assert.ok(ico.subarray(offset, offset + length).equals(pngs.get(size)), `ICO ${size}px embeds the matching PNG export`);
  previousEnd = offset + length;
}
assert.equal(previousEnd, ico.length, 'ICO has no unused trailing payload');

function htmlLinks(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(([, key, , value]) => [key.toLowerCase(), value]),
  ));
}

function verifyLinks(html, base, label) {
  const links = htmlLinks(html);
  for (const [rel, path, size] of [
    ['icon', 'branding/favicon.ico'],
    ['icon', 'branding/favicon-16.png', '16x16'],
    ['icon', 'branding/favicon-32.png', '32x32'],
    ['icon', 'branding/compass.svg', 'any'],
    ['apple-touch-icon', 'branding/apple-touch-icon.png', '180x180'],
    ['manifest', 'manifest.webmanifest'],
  ]) {
    const match = links.find(link => link.rel?.split(/\s+/).includes(rel) && link.href === `${base}${path}`);
    assert.ok(match, `${label}: ${rel} references ${base}${path}`);
    if (size) assert.equal(match.sizes, size, `${label}: ${path} advertises its actual size`);
    if (path.endsWith('.svg')) assert.equal(match.type, 'image/svg+xml', `${label}: vector favicon has the SVG MIME type`);
  }
  const iconLinks = links.filter(link => link.rel?.split(/\s+/).some(rel => ['icon', 'apple-touch-icon', 'manifest'].includes(rel)));
  assert.ok(iconLinks.every(link => link.href?.startsWith(base) && !link.href.includes('vite.svg')), `${label}: all icon links use the configured app base`);
}
// Vite rewrites public-root HTML URLs for its configured base in dev and builds.
// A %BASE_URL% prefix here is applied twice by the Vite 5 development server.
verifyLinks(await text('index.html'), '/', 'Source HTML');

const manifest = JSON.parse(await text('public/manifest.webmanifest'));
assert.equal(manifest.name, 'Specialty Match', 'Manifest application name');
for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], './', `Manifest ${key} stays within a subpath or mobile origin`);
for (const size of [192, 512]) {
  const icon = manifest.icons?.find(entry => entry.src === `branding/icon-${size}.png`);
  assert.ok(icon, `Manifest includes the ${size}px icon`);
  assert.equal(icon.sizes, `${size}x${size}`);
  assert.equal(icon.type, 'image/png');
  assert.deepEqual(new Set(icon.purpose?.split(/\s+/)), new Set(['any', 'maskable']), `Manifest ${size}px standard and maskable use`);
}
for (const icon of manifest.icons) {
  assert.match(icon.src, /^branding\/[a-z0-9-]+\.png$/, 'Manifest icons are local, relative URLs without traversal');
  await load(`public/${icon.src}`);
}

const androidRoot = 'android/app/src/main';
for (const [density, size, foregroundSize] of [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
]) {
  for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
    const path = `${androidRoot}/res/mipmap-${density}/${name}.png`;
    const foreground = name === 'ic_launcher_foreground';
    const decoded = verifyPng(await load(path), foreground ? foregroundSize : size, path, name === 'ic_launcher');
    if (foreground) verifyTransparentCompass(decoded, path);
  }
}
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  const xml = await text(`${androidRoot}/res/mipmap-anydpi-v26/${name}.xml`);
  assert.match(xml, /<adaptive-icon\b/, `${name}: adaptive icon remains configured`);
  assert.match(xml, /<background\s+android:drawable="@color\/ic_launcher_background"\s*\//);
  assert.match(xml, /<foreground\s+android:drawable="@mipmap\/ic_launcher_foreground"\s*\//);
}
assert.match(await text(`${androidRoot}/res/values/ic_launcher_background.xml`), /<color\s+name="ic_launcher_background">\s*#(?:FF)?FFFFFF\s*<\/color>/i, 'Android adaptive icon has an opaque white background');
const androidManifest = await text(`${androidRoot}/AndroidManifest.xml`);
assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
assert.match(androidManifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);

const iosDirectory = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
const iosContents = JSON.parse(await text(`${iosDirectory}/Contents.json`));
const iosIcon = iosContents.images.find(entry => entry.filename === 'AppIcon-512@2x.png');
assert.ok(iosIcon, 'iOS asset catalog references the generated icon');
assert.equal(iosIcon.size, '1024x1024');
verifyPng(await load(`${iosDirectory}/${iosIcon.filename}`), 1024, 'iOS application icon', true);

const args = process.argv.slice(2);
let buildDirectory;
let buildBase = '/Q-pro/';
for (let index = 0; index < args.length; index++) {
  assert.ok(['--build-dir', '--base'].includes(args[index]), `Unknown argument ${args[index]}`);
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `${args[index]} requires a value`);
  if (args[index] === '--build-dir') buildDirectory = args[++index];
  else buildBase = args[++index];
}
if (buildDirectory) {
  assert.ok(buildBase.endsWith('/'), 'The build base includes its trailing slash');
  const html = await text(`${buildDirectory}/index.html`);
  assert.ok(!html.includes('%BASE_URL%'), 'Built HTML resolves Vite base placeholders');
  verifyLinks(html, buildBase, 'Built HTML');
  assert.deepEqual(JSON.parse(await text(`${buildDirectory}/manifest.webmanifest`)), manifest, 'Built manifest preserves relative icon paths');
  for (const filename of ['compass.svg', 'favicon.ico', ...publicPngs.map(([name]) => name)]) {
    assert.ok((await load(`${buildDirectory}/branding/${filename}`)).equals(await load(`public/branding/${filename}`)), `Build includes the exact ${filename} asset`);
  }
}

console.log(`App icons: standalone vector compass, ${checkedPngs} valid PNG exports, transparent favicon/adaptive layers, multi-resolution ICO, untouched supplied artwork, base-aware HTML/manifest, opaque home-screen and iOS icons passed${buildDirectory ? `; ${buildDirectory} URLs and files passed` : ''}.`);
