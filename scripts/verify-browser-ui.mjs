// Browser-only synthetic fixtures. Every Supabase request is intercepted; this
// verification cannot read or write production research submissions.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyBrowserResearchFlows } from './browser-research-flows.mjs';

const testDirectory = await mkdtemp(join(tmpdir(), 'q-pro-browser-tests-'));
let server;
let browser;
try {
  const fixtureModule = join(testDirectory, 'fixtures.mjs');
  await build({
    stdin: { contents: `export { SPECIALTIES } from './src/data/specialties'; export { TRANSLATIONS, LANGUAGES } from './src/data/i18n'; export { MAP_TRANSLATIONS } from './src/data/mapI18n'; export { LOCAL_PROGRESS_COPY } from './src/data/localProgressI18n'; export { ALL_QUESTION_IDS } from './src/data/questions'; export { VALUE_OPTIONS } from './src/data/traits'; export { DEFAULT_PRIORITY_WEIGHTS } from './src/data/dimensions'; export { createQuestionnairePersistence } from './src/lib/questionnairePersistence';`, resolveDir: process.cwd(), loader: 'ts' },
    outfile: fixtureModule, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
  });
  const fixtureDefinitions = await import(pathToFileURL(fixtureModule).href);
  const { SPECIALTIES, TRANSLATIONS, LANGUAGES, MAP_TRANSLATIONS, LOCAL_PROGRESS_COPY } = fixtureDefinitions;
  const catalog = {
    version: { id: '8b297aed-b47a-4b58-baa9-848091db8637', revision: 1, label: 'Browser test fixture', content_hash: 'md5:00000000000000000000000000000000', published_at: '2026-01-01T00:00:00Z' },
    specialties: SPECIALTIES.map(specialty => ({ ...specialty, descriptions: { en: specialty.blurb, fr: specialty.blurb, ro: specialty.blurb }, clinical_summaries: { en: '', fr: '', ro: '' } })),
  };
  const fixtureGroups = [
    { countryCode: 'RO', country: 'Romania', count: 35, students: 20, specialists: 15, nonMedical: 0 },
    { countryCode: 'FR', country: 'France', count: 10, students: 0, specialists: 0, nonMedical: 10 },
  ];
  function mapFixture(args) {
    let groups = fixtureGroups.map(group => ({ ...group }));
    if (args.p_country_code) groups = groups.filter(group => group.countryCode === args.p_country_code);
    if (args.p_language !== 'all') groups = groups.filter(group => (args.p_language === 'ro' && group.countryCode === 'RO') || (args.p_language === 'fr' && group.countryCode === 'FR'));
    if (args.p_respondent_type !== 'all') {
      const field = { student: 'students', specialist: 'specialists', non_medical: 'nonMedical' }[args.p_respondent_type];
      groups = groups.map(group => ({ ...group, count: group[field], students: field === 'students' ? group.students : 0, specialists: field === 'specialists' ? group.specialists : 0, nonMedical: field === 'nonMedical' ? group.nonMedical : 0 })).filter(group => group.count > 0);
    }
    if (args.p_month_to && args.p_month_to < '2026-08-01') groups = [];
    return { total: groups.reduce((sum, group) => sum + group.count, 0), countries: groups.length, students: groups.reduce((sum, group) => sum + group.students, 0), specialists: groups.reduce((sum, group) => sum + group.specialists, 0), nonMedical: groups.reduce((sum, group) => sum + group.nonMedical, 0), groups, privacyThreshold: 10, rounding: 5, granularity: 'month', publishedThrough: '2026-08-31' };
  }

  server = await createServer({ server: { host: '127.0.0.1', port: 4179, strictPort: true, watch: { ignored: ['**/dist-mobile/**', '**/apps/mobile/**', '**/browser-qa.local/**', '**/.local/**'] } }, clearScreen: false });
  await server.listen();
  const edgeExecutable = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edgeExecutable) ? edgeExecutable : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const requests = [];
  const submissionMocks = { handler: null };
  const pageErrors = [];
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('q-pro-browser-fixture-initialized')) {
      localStorage.clear(); sessionStorage.setItem('q-pro-browser-fixture-initialized', 'yes');
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.route('**/*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const rpc = url.pathname.split('/').at(-1);
    const args = route.request().postDataJSON() ?? {};
    requests.push({ rpc, args });
    if (rpc === 'get_participation_map_stats') return route.fulfill({ json: mapFixture(args) });
    if (rpc === 'get_active_specialty_catalog') return route.fulfill({ json: catalog });
    if (rpc.startsWith('submit_') && submissionMocks.handler) return submissionMocks.handler({ route, rpc, args });
    return route.fulfill({ status: 403, json: { message: 'Browser test blocks every non-fixture endpoint' } });
  });
  // Do not permit third-party requests in this deterministic browser check.
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());

  const noOverflow = async label => {
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  };
  const chooseLanguage = async language => {
    await page.locator('header button').last().click();
    await page.getByRole('button', { name: `${language.flag} ${language.label}`, exact: true }).click();
  };
  const waitForMap = predicate => page.waitForResponse(response => response.url().includes('/rpc/get_participation_map_stats') && predicate(response.request().postDataJSON()));
  await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' });

  for (const language of LANGUAGES) {
    const copy = TRANSLATIONS[language.code];
    const mapCopy = MAP_TRANSLATIONS[language.code];
    if (language.code !== 'en') await chooseLanguage(language);
    await page.getByRole('heading', { name: copy.roleIntrospection, exact: true }).waitFor();
    assert.deepEqual(await page.locator('[data-participant-role]').evaluateAll(elements => elements.map(element => element.dataset.participantRole)), ['curious', 'student', 'specialist']);
    await noOverflow(`roles ${language.code}`);
    await page.getByRole('button', { name: copy.navCredits, exact: true }).click();
    await page.getByText(copy.creditsMotivation, { exact: true }).waitFor();
    await noOverflow(`credits ${language.code}`);
    await page.locator('[data-navigation-back]').click();

    await page.getByRole('button', { name: copy.navWorldMap, exact: true }).click();
    await page.getByRole('heading', { name: mapCopy.title, exact: true }).waitFor();
    await page.getByRole('button', { name: /Romania|România|Roumanie/ }).last().waitFor();
    await noOverflow(`map ${language.code}`);
    assert.equal(await page.locator('svg[role="group"] path').count(), 176);
    await page.getByRole('button', { name: mapCopy.filters, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await noOverflow(`map filter drawer ${language.code}`);
    await dialog.getByLabel(mapCopy.country, { exact: true }).selectOption('RO');
    await dialog.getByLabel(mapCopy.language, { exact: true }).selectOption('ro');
    await dialog.getByLabel(mapCopy.version, { exact: true }).selectOption('current');
    await Promise.all([waitForMap(args => args.p_country_code === 'RO' && args.p_language === 'ro'), dialog.getByRole('button', { name: mapCopy.applyFilters, exact: true }).click()]);
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.equal(requests.at(-1).args.p_country_code, 'RO');
    assert.equal(requests.at(-1).args.p_language, 'ro');
    assert.equal(requests.at(-1).args.p_data_version, 'current');
    await Promise.all([waitForMap(args => args.p_respondent_type === 'specialist'), page.locator('div[aria-label]').getByRole('button', { name: mapCopy.specialists, exact: true }).click()]);
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.equal(requests.at(-1).args.p_respondent_type, 'specialist');
    const countryButton = page.getByRole('button', { name: /^(Romania|România|Roumanie) ≈ 15$/ });
    await countryButton.click();
    const details = page.getByRole('region', { name: mapCopy.details });
    assert.match(await details.textContent(), /≈ 15/);
    await page.getByRole('button', { name: mapCopy.zoomIn, exact: true }).click();
    const zoomed = await page.locator('svg[role="group"]').getAttribute('viewBox');
    assert.notEqual(zoomed, '0 0 960 500');
    await page.getByRole('button', { name: mapCopy.panRight, exact: true }).click();
    assert.notEqual(await page.locator('svg[role="group"]').getAttribute('viewBox'), zoomed);
    await page.getByRole('button', { name: mapCopy.resetView, exact: true }).click();
    assert.equal(await page.locator('svg[role="group"]').getAttribute('viewBox'), '0 0 960 500');
    await details.getByRole('button', { name: mapCopy.close, exact: true }).click();
    await page.locator('path[data-country="RO"]').scrollIntoViewIfNeeded();
    await page.locator('path[data-country="RO"]').tap();
    await details.getByRole('heading', { name: /^(Romania|România|Roumanie)$/ }).waitFor();
    await page.locator('path[data-country="RO"]').focus();
    await page.keyboard.press('Enter');
    assert.match(await details.textContent(), /≈ 15/);
    if (language.code === 'en') {
      await mkdir('browser-qa.local', { recursive: true });
      await page.screenshot({ path: 'browser-qa.local/map-mobile-synthetic.png', fullPage: true });
    }
    await page.getByRole('button', { name: mapCopy.filters, exact: true }).click();
    await Promise.all([waitForMap(args => args.p_respondent_type === 'all' && args.p_country_code === null), dialog.getByRole('button', { name: mapCopy.resetFilters, exact: true }).click()]);
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    await page.locator('[data-navigation-back]').click();
  }

  await chooseLanguage(LANGUAGES.find(language => language.code === 'en'));
  await page.locator('[data-participant-role="specialist"]').click();
  await page.getByRole('button', { name: TRANSLATIONS.en.startButton, exact: true }).click();
  await page.locator('[data-specialist-path="skip"]').click();
  await page.getByRole('heading', { name: TRANSLATIONS.en.specialistSpecialtyTitle, exact: true }).waitFor();
  assert.equal(await page.getByText(TRANSLATIONS.en.specialtyTitle, { exact: true }).count(), 0);
  await page.getByLabel(MAP_TRANSLATIONS.en.country, { exact: true }).selectOption('RO');
  const region = page.getByLabel(MAP_TRANSLATIONS.en.region, { exact: true });
  await region.fill('Cluj');
  assert.equal(await region.getAttribute('maxlength'), '100');
  await page.getByLabel(MAP_TRANSLATIONS.en.country, { exact: true }).selectOption('');
  assert.equal(await region.inputValue(), '');
  assert.equal(await region.isDisabled(), true);
  await noOverflow('specialist geography');
  await page.getByRole('button', { name: SPECIALTIES[0].name, exact: true }).click();
  await page.getByPlaceholder(TRANSLATIONS.en.specialistCurrentViewPlaceholder, { exact: true }).fill('Synthetic test of specialist draft persistence.');
  await page.getByLabel(MAP_TRANSLATIONS.en.country, { exact: true }).selectOption('RO');
  await region.fill('Cluj');
  await page.locator('[data-navigation-back]').click();
  await page.locator('[data-specialist-path="skip"]').click();
  assert.equal(await page.getByPlaceholder(TRANSLATIONS.en.specialistCurrentViewPlaceholder, { exact: true }).inputValue(), 'Synthetic test of specialist draft persistence.');
  assert.equal(await region.inputValue(), 'Cluj');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('qpro.questionnaire.v1') ?? '{}').draft?.specialistDraft?.geography?.region === 'Cluj');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: LOCAL_PROGRESS_COPY.en.resumeButton, exact: true }).click();
  assert.equal(await page.getByPlaceholder(TRANSLATIONS.en.specialistCurrentViewPlaceholder, { exact: true }).inputValue(), 'Synthetic test of specialist draft persistence.');
  assert.equal(await page.getByLabel(MAP_TRANSLATIONS.en.region, { exact: true }).inputValue(), 'Cluj');
  await page.locator('[data-navigation-back]').click();
  await page.locator('[data-specialist-path="answer"]').click();
  await page.locator('main button').first().click();
  await page.getByRole('button', { name: TRANSLATIONS.en.continue, exact: true }).click();
  const rating = page.locator('input[type="range"]').first();
  await rating.focus();
  await page.keyboard.press('End');
  assert.equal(await rating.inputValue(), '10');
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('qpro.questionnaire.v1') ?? '{}').draft?.ratings ?? {}).includes(10));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: LOCAL_PROGRESS_COPY.en.resumeButton, exact: true }).click();
  assert.equal(await page.locator('input[type="range"]').first().inputValue(), '10');
  await noOverflow('resumed partial questionnaire');

  // Independently check desktop layout, where the filter form stays beside the map.
  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1440, height: 1000 });
  await desktop.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' });
  await desktop.getByRole('button', { name: TRANSLATIONS.en.navWorldMap, exact: true }).click();
  await desktop.getByLabel(MAP_TRANSLATIONS.en.country, { exact: true }).first().waitFor({ state: 'visible' });
  assert.ok(await desktop.locator('aside').last().isVisible());
  await desktop.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  await desktop.screenshot({ path: 'browser-qa.local/map-desktop-synthetic.png', fullPage: true });
  assert.deepEqual(pageErrors, []);
  assert.equal(requests.some(request => request.rpc.startsWith('submit_')), false, 'No research submission was made');
  await desktop.close();
  await verifyBrowserResearchFlows({ page, context, catalog, fixtureDefinitions, submissionMocks, requests });
  assert.deepEqual(pageErrors, []);
  console.log('Browser checks passed: responsive three-language UI/map, optional geography, reload/resume, offline consent synchronization, payload-specific receipts and persistent opt-out. All research endpoints were mocked; no production submissions.');
} finally {
  await browser?.close();
  await server?.close();
  const directory = resolve(testDirectory);
  if (!directory.startsWith(resolve(tmpdir()) + sep) || !directory.includes('q-pro-browser-tests-')) throw new Error('Unexpected browser test temporary directory');
  await rm(directory, { recursive: true, force: true });
}
