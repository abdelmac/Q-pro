import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Cache only committed public shell assets, never API responses or runtime data. */
export function publicAppPwaPlugin(): Plugin {
  let root = '';
  let nativeBuild = false;
  return {
    name: 'qpro-public-app-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
      nativeBuild = config.base === './';
    },
    generateBundle(_options, bundle) {
      // Capacitor already ships offline assets and must not install a web worker.
      if (nativeBuild) return;
      const shellFiles = ['index.html', 'manifest.webmanifest',
        'branding/compass.svg', 'branding/favicon.ico', 'branding/favicon-16.png',
        'branding/favicon-32.png', 'branding/apple-touch-icon.png',
        'branding/icon-192.png', 'branding/icon-512.png'];
      const outputFiles = Object.keys(bundle).filter(name => (
        name === 'index.html' || /^assets\/[\w.-]+\.(?:js|css|woff2?|png|svg)$/.test(name)
      ));
      const files = [...new Set([...shellFiles, ...outputFiles])].sort();
      const checksum = createHash('sha256');
      for (const file of files) {
        checksum.update(file);
        const output = bundle[file];
        checksum.update(output
          ? output.type === 'chunk' ? output.code : output.source
          : readFileSync(resolve(root, 'public', file)));
      }
      const template = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
      checksum.update(template);
      const configuration = JSON.stringify({ version: checksum.digest('hex').slice(0, 24), files });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace(
        'const PRECACHE = null; // Replaced only by the production build.',
        `const PRECACHE = ${configuration};`,
      ) });
    },
  };
}
