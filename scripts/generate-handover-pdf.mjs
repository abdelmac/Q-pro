import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolve } from 'node:path';

// Documentation only: no app build, backend request or credential access.
const argumentsList = process.argv.slice(2);
if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== '--accounts')) {
  throw new Error('Usage: node scripts/generate-handover-pdf.mjs [--accounts]');
}
const accountsSheet = argumentsList[0] === '--accounts';
const stem = accountsSheet
  ? 'Specialty-Match-Accounts-Checklist-2026-09-25'
  : 'Specialty-Match-Technical-Handover-2026-09-25';
const documentLabel = accountsSheet ? 'Accounts checklist' : 'Technical handover';
const source = resolve('docs', `${stem}.html`);
const output = resolve('docs', `${stem}.pdf`);
const qaDirectory = resolve('.local', accountsSheet ? 'accounts-pdf-qa' : 'handover-pdf-qa');
const logo = await readFile('public/branding/compass.svg', 'utf8');
const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const html = (await readFile(source, 'utf8'))
  .replaceAll('@@GIT_COMMIT@@', revision)
  .replaceAll('@@LOGO@@', `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`);
if (/@@[A-Z_]+@@/.test(html)) throw new Error('Unresolved document placeholder');
// Do not accidentally publish credentials in a handover.
if (/sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./.test(html)) {
  throw new Error('Credential-shaped material found in document');
}
await mkdir(qaDirectory, { recursive: true });
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1150 }, deviceScaleFactor: 1.4 });
  await page.route('**/*', route => route.abort());
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const audit = await page.evaluate(() => [...document.querySelectorAll('.sheet')].map((sheet, i) => ({
    page: i + 1, title: sheet.querySelector('h1,h2')?.textContent,
    width: sheet.clientWidth, height: sheet.clientHeight,
    scrollWidth: sheet.scrollWidth, scrollHeight: sheet.scrollHeight,
  })));
  const overflow = audit.filter(item => item.scrollHeight > item.height + 1 || item.scrollWidth > item.width + 1);
  if (overflow.length) throw new Error(`Document page overflow: ${JSON.stringify(overflow)}`);
  if (accountsSheet && audit.length !== 1) throw new Error('Accounts checklist must be one page');
  const invalidLinks = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
    .filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')));
  if (invalidLinks.length) throw new Error(`Broken contents links: ${invalidLinks.join(', ')}`);
  await page.pdf({ path: output, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, tagged: true, outline: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;margin:0 14mm;font-family:Arial,sans-serif;font-size:8px;color:#536775;display:flex;justify-content:space-between"><span>SPECIALTY MATCH · ${documentLabel} · 25 September 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
  for (let index = 0; index < audit.length; index++) {
    await page.locator('.sheet').nth(index).screenshot({ path: resolve(qaDirectory, `page-${String(index + 1).padStart(2, '0')}.png`) });
  }
  const pdf = await readFile(output);
  const pageObjects = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  if (!pdf.subarray(0, 8).toString().startsWith('%PDF-') || pageObjects !== audit.length) {
    throw new Error(`Unexpected PDF structure: ${pageObjects} PDF pages for ${audit.length} authored pages`);
  }
  await writeFile(resolve(qaDirectory, 'layout-audit.json'), JSON.stringify({ revision, pageObjects, pages: audit }, null, 2));
  console.log(JSON.stringify({ file: output, pages: pageObjects, bytes: (await stat(output)).size,
    layoutOverflow: false, internalLinksValid: true, credentialScan: 'passed', backendRequests: 0, revision }));
} finally { await browser.close(); }
