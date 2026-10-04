import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only, offline checks. Optional: --build-dir dist (must be a root-path build).
const root = fileURLToPath(new URL('..', import.meta.url));
const text = path => readFile(resolve(root, path), 'utf8');
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--build-dir'
  && args[1] && !args[1].startsWith('--')), 'Usage: node scripts/verify-cloudflare-hosting.mjs [--build-dir directory]');

const config = JSON.parse(await text('wrangler.json'));
const allowedFields = new Set(['name', 'compatibility_date', 'build', 'assets']);
assert.deepEqual(Object.keys(config).filter(key => !allowedFields.has(key)), [],
  'Static hosting must not add a Worker script, bindings, schedules, account IDs or domain routes');
assert.equal(config.name, 'medcompass-web');
assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
assert.deepEqual(config.assets, { directory: './dist' }, 'Serve only dist; unmatched paths keep the default 404');
assert.deepEqual(config.build, {
  command: 'npm run build:hosted && node scripts/verify-cloudflare-hosting.mjs --build-dir dist',
}, 'Deploy must rebuild and verify the root-path artifact');
const packageJson = JSON.parse(await text('package.json'));
assert.equal(packageJson.scripts['build:hosted'], 'vite build --base /');

const headerSource = await text('public/_headers');
const rules = new Map();
let currentRule;
for (const line of headerSource.split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(line)) {
    assert.ok(!rules.has(line), `Duplicate header rule: ${line}`);
    currentRule = new Map();
    rules.set(line, currentRule);
  } else {
    const match = line.trim().match(/^([^:]+):\s*(.*)$/);
    assert.ok(currentRule && match, 'Headers must belong to a path rule');
    assert.ok(!currentRule.has(match[1].toLowerCase()), 'Repeated headers must be reviewed for combined values');
    currentRule.set(match[1].toLowerCase(), match[2]);
  }
}
const headers = rules.get('/*');
assert.equal(headers?.get('x-content-type-options'), 'nosniff');
assert.equal(headers?.get('x-frame-options'), 'DENY');
assert.equal(headers?.get('referrer-policy'), 'no-referrer');
for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'",
  "base-uri 'self'", "frame-ancestors 'none'", "worker-src 'self'"]) {
  assert.ok(headers?.get('content-security-policy')?.split(';').map(value => value.trim()).includes(directive),
    `Missing content-security-policy directive: ${directive}`);
}
for (const path of ['/', '/index.html', '/manifest.webmanifest', '/branding/*']) {
  assert.equal(rules.get(path)?.get('cache-control'), 'no-cache, max-age=0, must-revalidate',
    `${path} must revalidate so releases do not leave a stale shell`);
}
assert.equal(rules.get('/sw.js')?.get('cache-control'), 'no-store, max-age=0');
assert.equal(rules.get('/assets/*')?.get('cache-control'), 'public, max-age=31536000, immutable');

if (args.length) {
  const buildDirectory = resolve(root, args[1]);
  const files = new Set();
  async function inspectDirectory(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), `Build must not publish linked files: ${path}`);
      assert.ok(!/(^|\/)(?:\.[^/]+|private-exports|backups|node_modules)(\/|$)/i.test(path)
        && !/\.(?:pem|key|p12|pfx|sql|dump|backup|map)$/i.test(path)
        && !/(^|\/)(?:wrangler\.[^/]+|package(?:-lock)?\.json|credentials(?:\.[^/]+)?)$/i.test(path),
      `Unexpected private/configuration file in build: ${path}`);
      if (entry.isDirectory()) await inspectDirectory(join(directory, entry.name), `${path}/`);
      else {
        assert.ok(entry.isFile(), `Build entry must be a regular file: ${path}`);
        files.add(path);
        if (['.js', '.css', '.html', '.json', '.webmanifest', '.txt'].includes(extname(path))) {
          const source = await readFile(join(directory, entry.name), 'utf8');
          assert.ok(!/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source),
            `Private credential found in build: ${path}`);
          for (const token of source.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
            let payload;
            try { payload = JSON.parse(Buffer.from(token[1], 'base64url').toString('utf8')); } catch { continue; }
            assert.notEqual(payload.role, 'service_role', `Privileged backend token found in build: ${path}`);
          }
        }
      }
    }
  }
  await inspectDirectory(buildDirectory);
  for (const path of ['index.html', 'manifest.webmanifest', 'sw.js', '_headers']) {
    assert.ok(files.has(path), `Missing build output: ${path}`);
  }
  assert.equal(await readFile(join(buildDirectory, '_headers'), 'utf8'), headerSource, 'Build must contain the current headers');
  const html = await readFile(join(buildDirectory, 'index.html'), 'utf8');
  assert.ok(!html.includes('/Q-pro/') && !html.includes('%BASE_URL%'), 'Build must use the domain root');
  let compiledScript = false;
  for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^https:\/\//.test(value)) continue;
    assert.ok(/^\/(?!\/)/.test(value), 'Local HTML assets must use root paths');
    const url = new URL(value, 'https://hosting.fixture');
    assert.ok(files.has(decodeURIComponent(url.pathname.slice(1))), `Missing linked build asset: ${url.pathname}`);
    if (/^\/assets\/.+\.js$/.test(url.pathname)) compiledScript = true;
  }
  assert.ok(compiledScript, 'HTML must load a compiled application script');
  const worker = await readFile(join(buildDirectory, 'sw.js'), 'utf8');
  const precache = worker.match(/const PRECACHE = (\{[^\n]+\});/);
  assert.ok(precache, 'Production service worker must have its generated public asset list');
  for (const path of JSON.parse(precache[1]).files) assert.ok(files.has(path), `Missing precached asset: ${path}`);
  console.log(`PASS Cloudflare build: ${files.size} files, root asset paths, headers, PWA outputs and common private-file/credential checks.`);
}
console.log('PASS Cloudflare hosting: static assets only, root build, security headers and release cache policies.');
