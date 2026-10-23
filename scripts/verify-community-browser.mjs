// Isolated production-build regression: no live accounts, emails, or research writes.
import { build } from 'esbuild';
import { build as buildApp, preview } from 'vite';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyBrowserCommunity } from './browser-community.mjs';

const temporaryRoot = resolve('.local');
await mkdir(temporaryRoot, { recursive: true });
const directory = await mkdtemp(join(temporaryRoot, 'community-browser-'));
let server;
let browser;
try {
  const fixtureModule = join(directory, 'fixtures.mjs');
  await build({
    stdin: {
      contents: `export { SPECIALTIES } from './src/data/specialties'; export { LANGUAGES, TRANSLATIONS } from './src/data/i18n'; export { COMMUNITY_COPY } from './src/data/communityI18n';`,
      resolveDir: process.cwd(), loader: 'ts',
    },
    outfile: fixtureModule, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
  });
  const fixtureDefinitions = await import(pathToFileURL(fixtureModule).href);
  const appBuildDirectory = join(directory, 'app');
  await buildApp({
    base: '/',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://community-fixture.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_synthetic_browser_fixture_only'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
      'import.meta.env.VITE_COMMUNITY_ENABLED': JSON.stringify('true'),
    },
    build: { outDir: appBuildDirectory, emptyOutDir: false },
    logLevel: 'warn',
  });
  server = await preview({ base: '/', build: { outDir: appBuildDirectory }, preview: { host: '127.0.0.1', port: 4183, strictPort: true }, logLevel: 'warn' });
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  await mkdir('browser-qa.local', { recursive: true });
  await verifyBrowserCommunity({ browser, fixtureDefinitions, localOrigin: 'http://127.0.0.1:4183' });
} finally {
  await browser?.close();
  if (server) await new Promise((resolveClose, rejectClose) => server.httpServer.close(error => error ? rejectClose(error) : resolveClose()));
  const target = resolve(directory);
  if (!target.startsWith(temporaryRoot + sep) || !target.includes('community-browser-')) throw new Error('Unexpected community-browser temporary directory');
  await rm(target, { recursive: true, force: true });
}
