// Isolated synthetic built-site test. No production backend is contacted.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, extname } from 'node:path';
import { build } from 'vite';
import { chromium } from 'playwright';
import { runInNewContext } from 'node:vm';
import { publicAppPwaPlugin } from './pwaBuildPlugin.ts';

function verifyBuildPlugin() {
  const plugin = publicAppPwaPlugin();
  plugin.configResolved({ root: process.cwd(), base: '/Q-pro/' });
  let output;
  const run = code => plugin.generateBundle.call({ emitFile: file => { output = file; } }, {}, {
    'index.html': { type: 'asset', source: '<html>synthetic public shell</html>' },
    'assets/app-fixture.js': { type: 'chunk', code },
    'exports/private.json': { type: 'asset', source: 'private fixture must not enter the worker' },
  });
  run('export const fixture = 1;');
  const first = output.source;
  assert.equal(output.fileName, 'sw.js');
  assert.ok(first.includes('assets/app-fixture.js'));
  assert.ok(!first.includes('exports/private.json'));
  assert.ok(!first.includes('const PRECACHE = null'));
  run('export const fixture = 2;');
  assert.notEqual(first, output.source, 'Changing bundled code must change the cache version');
  console.log('PASS PWA build manifest: exact public outputs only; content changes invalidate the shell cache.');
}

async function verifyWorkerPolicy() {
  const template = await readFile('public/sw.js', 'utf8');
  const listeners = new Map();
  const buckets = new Map();
  const requests = [];
  let offline = false;
  const normalize = key => typeof key === 'string' ? key : key.url;
  const cacheStorage = {
    keys: async () => [...buckets.keys()],
    delete: async key => buckets.delete(key),
    open: async name => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name);
      return { put: async (key, response) => entries.set(normalize(key), response.clone()),
        match: async key => entries.get(normalize(key))?.clone() };
    },
  };
  buckets.set('unrelated-cache', new Map());
  buckets.set('qpro-public-shell:/Q-pro/:old', new Map());
  runInNewContext(template.replace('const PRECACHE = null;',
    'const PRECACHE = {version:"fixture",files:["index.html","assets/public-code.js"]};'), {
    self: { registration: { scope: 'https://fixture.test/Q-pro/' },
      addEventListener: (type, handler) => listeners.set(type, handler), clients: { claim: async () => {} } },
    URL, Request, Response, Set,
    caches: cacheStorage,
    fetch: async request => {
      requests.push({ url: request.url, cache: request.cache });
      if (offline) throw new Error('synthetic disconnected network');
      return new Response('public fixture', { status: 200 });
    },
  });
  let pending;
  listeners.get('install')({ waitUntil: promise => { pending = promise; } });
  await pending;
  listeners.get('activate')({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual([...buckets.keys()].sort(), ['qpro-public-shell:/Q-pro/:fixture', 'unrelated-cache']);
  const intercepted = request => {
    let result;
    listeners.get('fetch')({ request, respondWith: promise => { result = promise; } });
    return result;
  };
  const restricted = [
    new Request('https://fixture.test/Q-pro/api/private'),
    new Request('https://fixture.test/Q-pro/rest/v1/rpc/get_public_features'),
    new Request('https://fixture.test/Q-pro/map'),
    new Request('https://fixture.test/Q-pro/?view=map'),
    new Request('https://fixture.test/Q-pro/exports/research.csv'),
    new Request('https://backend.supabase.co/rest/v1/rpc/get_participation_map_stats'),
    new Request('https://fixture.test/Q-pro/assets/public-code.js?v=secret'),
    new Request('https://fixture.test/Q-pro/assets/public-code.js', { headers: { Authorization: 'Bearer fixture' } }),
    new Request('https://fixture.test/Q-pro/assets/public-code.js', { method: 'POST', body: '{}' }),
  ];
  for (const request of restricted) {
    await intercepted(request.clone());
    assert.equal(requests.at(-1).cache, 'no-store');
  }
  offline = true;
  for (const request of restricted) await assert.rejects(() => intercepted(request.clone()), /disconnected/);
  assert.equal((await intercepted(new Request('https://fixture.test/Q-pro/assets/public-code.js'))).status, 200);
  const rootNavigation = new Request('https://fixture.test/Q-pro/');
  Object.defineProperty(rootNavigation, 'mode', { value: 'navigate' });
  assert.equal((await intercepted(rootNavigation)).status, 200);
  console.log('PASS service-worker policy: exact static allowlist, network-only protected/cross-origin/query/POST/authenticated requests, scoped cache cleanup.');
}

verifyBuildPlugin();
await verifyWorkerPolicy();
if (process.argv.includes('--policy-only')) process.exit(0);

const temporaryRoot = await mkdtemp(join(tmpdir(), 'qpro-pwa-'));
const fixtureSecret = 'SYNTHETIC_PRIVATE_RESPONSE_DO_NOT_CACHE';
const hostedHeaders = await readFile('public/_headers', 'utf8');
const csp = hostedHeaders.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1];
assert.ok(csp?.includes("frame-ancestors 'none'"));
const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
let browser;
try {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const base of ['/Q-pro/', '/']) {
    const outputDirectory = join(temporaryRoot, base === '/' ? 'root' : 'pages');
    await build({ base, logLevel: 'warn', build: { outDir: outputDirectory, emptyOutDir: true },
      define: {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://pwa-fixture.supabase.co'),
        'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_pwa_fixture'),
      },
    });
    const worker = await readFile(join(outputDirectory, 'sw.js'), 'utf8');
    assert.ok(!worker.includes('const PRECACHE = null'), 'Build injects a concrete public-only asset manifest');
    const precache = JSON.parse(worker.match(/const PRECACHE = (\{[^\n]+\});/)[1]);
    assert.ok(precache.files.includes('index.html') && precache.files.includes('manifest.webmanifest'));
    assert.ok(precache.files.every(name => name === 'index.html' || name === 'manifest.webmanifest'
      || /^assets\/[\w.-]+\.(js|css|woff2?|png|svg)$/.test(name)
      || /^branding\/[\w.-]+\.(svg|ico|png)$/.test(name)));
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://fixture.test');
      if (/\/(?:api|rest|auth|functions|exports|dashboard|map|settings)(?:\/|$)/.test(url.pathname)) {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ fixture: fixtureSecret }));
        return;
      }
      if (!url.pathname.startsWith(base)) { response.writeHead(404); response.end(); return; }
      const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
      const absolute = resolve(outputDirectory, relative);
      if (!absolute.startsWith(`${resolve(outputDirectory)}${sep}`)) { response.writeHead(403); response.end(); return; }
      try {
        const bytes = await readFile(absolute);
        response.writeHead(200, { 'Content-Type': contentTypes[extname(absolute)] || 'application/octet-stream',
          'Content-Security-Policy': csp,
          'Cache-Control': 'no-cache' });
        response.end(bytes);
      } catch { response.writeHead(404); response.end(); }
    });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    try {
      await context.route('https://**/*', route => route.abort());
      const page = await context.newPage();
      await page.goto(`${origin}${base}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Worker activation timed out')), 20_000)),
      ]));
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 });
      const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      assert.equal(scope, `${origin}${base}`);
      const urls = [`${base}api/private`, `${base}rest/v1/rpc/get_participation_map_stats`,
        `${base}rest/v1/rpc/get_public_features`, `${base}auth/v1/user`, `${base}exports/research.csv`,
        `${base}dashboard`, `${base}map`, `${base}settings`, `${base}?view=map`];
      for (const path of urls) {
        assert.equal(await page.evaluate(async path => (await fetch(path)).ok, path), true);
      }
      await page.evaluate(async base => {
        await fetch(`${base}rest/v1/rpc/get_participation_map_stats`, { method: 'POST', body: '{}' });
      }, base);
      const cacheState = await page.evaluate(async () => {
        const names = await caches.keys();
        return Promise.all(names.map(async name => ({ name, urls: (await (await caches.open(name)).keys()).map(request => request.url) })));
      });
      assert.equal(cacheState.length, 1);
      assert.ok(cacheState[0].name.startsWith(`qpro-public-shell:${base}:`));
      assert.deepEqual(cacheState[0].urls.map(url => url.slice(`${origin}${base}`.length)).sort(), precache.files);
      // Even poisoned/legacy cache entries are never read for private data.
      await page.evaluate(async ({ name, urls }) => {
        const cache = await caches.open(name);
        for (const url of urls) await cache.put(url, new Response('synthetic stale restricted data'));
      }, { name: cacheState[0].name, urls });
      await context.setOffline(true);
      for (const path of urls) {
        assert.equal(await page.evaluate(async path => {
          try { await fetch(path); return true; } catch { return false; }
        }, path), false, `Offline restricted endpoint never falls back to cache: ${path}`);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('h1').waitFor();
      assert.equal(await page.evaluate(() => navigator.onLine), false);
      assert.equal(await page.evaluate(() => Boolean(localStorage.getItem('qpro.questionnaire.v1'))), false);
      await context.setOffline(false);
      assert.equal(await page.evaluate(async path => (await fetch(path)).ok, urls[0]), true, 'Network data recovers online');
      console.log(`PASS PWA ${base}: generated allowlist, offline public shell, no API/map/auth/export cache fallback, no draft persistence.`);
    } finally {
      await context.close();
      await new Promise(resolveClose => server.close(resolveClose));
    }
  }
} finally {
  await browser?.close();
  const checkedPath = resolve(temporaryRoot);
  if (checkedPath.startsWith(`${resolve(tmpdir())}${sep}`) && checkedPath.includes('qpro-pwa-')) {
    await rm(checkedPath, { recursive: true, force: true });
  }
}
