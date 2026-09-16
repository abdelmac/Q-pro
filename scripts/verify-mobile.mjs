import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputFile = join(tmpdir(), `qpro-mobile-tests-${process.pid}.mjs`);
try {
  await build({
    entryPoints: ['scripts/mobile.tests.ts'], outfile: outputFile,
    bundle: true, platform: 'node', format: 'esm',
    tsconfig: 'tsconfig.app.json', logLevel: 'silent',
  });
  await import(`${pathToFileURL(outputFile).href}?run=${Date.now()}`);
} finally {
  await rm(outputFile, { force: true });
}
