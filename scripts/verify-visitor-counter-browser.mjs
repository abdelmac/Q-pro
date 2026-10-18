// Standalone, synthetic browser verification. No request reaches a live website or database.
import { build } from 'esbuild';
import { build as buildApp, preview } from 'vite';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyBrowserVisitorCounter } from './browser-visitor-counter.mjs';

const directory = await mkdtemp(join(tmpdir(), 'medcompass-visitor-browser-'));
let server;
let browser;
try {
  const fixtureModule = join(directory, 'fixtures.mjs');
  await build({
    stdin: { contents: `export { SPECIALTIES } from './src/data/specialties'; export { LANGUAGES, TRANSLATIONS } from './src/data/i18n'; export { VISITOR_COUNTER_COPY } from './src/data/visitorCounterI18n'; export { SITE_VISIT_STORAGE_KEY, SITE_VISIT_LIFETIME_MS } from './src/lib/siteVisitCounter';`, resolveDir: process.cwd(), loader: 'ts' },
    outfile: fixtureModule, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
  });
  const fixtureDefinitions = await import(pathToFileURL(fixtureModule).href);
  const appBuildDirectory = join(directory, 'app');
  await buildApp({
    base: '/',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://visitor-fixture.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_browser_fixture_only'),
    },
    build: { outDir: appBuildDirectory, emptyOutDir: false },
    logLevel: 'warn',
  });
  server = await preview({ base: '/', build: { outDir: appBuildDirectory }, preview: { host: '127.0.0.1', port: 4182, strictPort: true }, logLevel: 'warn' });
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  await mkdir('browser-qa.local', { recursive: true });
  await verifyBrowserVisitorCounter({ browser, fixtureDefinitions, localOrigin: 'http://127.0.0.1:4182' });
} finally {
  await browser?.close();
  if (server) await new Promise((resolveClose, rejectClose) => server.httpServer.close(error => error ? rejectClose(error) : resolveClose()));
  const target = resolve(directory);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('medcompass-visitor-browser-')) throw new Error('Unexpected visitor-browser temporary directory');
  await rm(target, { recursive: true, force: true });
}
