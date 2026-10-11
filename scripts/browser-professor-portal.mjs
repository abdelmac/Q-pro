import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';

const LOCAL_ORIGIN = 'http://127.0.0.1:4179';
const SYNTHETIC_PASSWORD = 'Synthetic-fixture-only-not-a-real-password';
const RESEARCH_USER_ID = 'b7611111-1111-4111-8111-111111111111';
const OTHER_USER_ID = 'b7622222-2222-4222-8222-222222222222';
const REMOVED_ACCESS_NOTICES = [
  'You can read and download saved responses. Website settings are managed by the administrator.',
  'Vous pouvez lire et télécharger les réponses enregistrées. Les réglages du site sont réservés à l’administrateur.',
  'Puteți citi și descărca răspunsurile salvate. Setările site-ului sunt gestionate de administrator.',
];

function sessionFixture(id) {
  const now = Math.floor(Date.now() / 1000);
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = {
    id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.invalid`,
    app_metadata: { provider: 'email', providers: ['email'] },
    // User-editable claims deliberately pretend to be an administrator.
    user_metadata: { role: 'professor', can_edit: true, can_publish: true },
    created_at: '2026-01-01T00:00:00Z',
  };
  return {
    access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}.${part('synthetic-not-a-credential')}`,
    refresh_token: 'synthetic-refresh-not-a-credential', expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user,
  };
}

function researchFixtures({ DATA_VERSIONS: versions, ALL_QUESTION_IDS, VALUE_OPTIONS, SPECIALTIES }, catalog) {
  const common = {
    created_at: '2026-09-15T12:00:00Z', scoring_context: null,
    ratings: Object.fromEntries(ALL_QUESTION_IDS.map((id, index) => [id, 1 + index % 10])),
    selected_values: [VALUE_OPTIONS[0]], language: 'en',
    specialty_config_version_id: catalog.version.id, specialty_config_revision: catalog.version.revision,
    questionnaire_version: versions.questionnaire, value_catalog_version: versions.valueCatalog,
    specialty_catalog_version: versions.specialtyCatalog, country_code: 'RO', region: null,
  };
  const student = {
    ...common, participant_role: 'student', study_year: 6, preferred_specialty: SPECIALTIES[1].name,
    medicine_view: 'SYNTHETIC student perspective: medicine joins science and service.',
    participant_reflection_version: versions.participantReflection,
    client_scores: SPECIALTIES.map(({ name }, index) => ({ specialty: name, score: 100 - index })),
    submission_schema_version: versions.studentSubmissionSchema,
    scoring_version: versions.scoring, consent_version: versions.studentConsent,
  };
  const students = Array.from({ length: 11 }, (_, index) => ({
    ...student, id: `b7700000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    medicine_view: `SYNTHETIC ${index < 4 ? 'current' : 'legacy'} student ${index + 1}: medicine joins science and service.`,
    ...(index < 4 ? {} : { submission_schema_version: 1, participant_reflection_version: null, consent_version: 'synthetic-legacy-consent' }),
  }));
  const curious = {
    ...student, id: 'b7800000-0000-4000-8000-000000000001', participant_role: 'curious', study_year: null,
    preferred_specialty: null, medicine_view: 'SYNTHETIC explorer perspective: I am curious about caring for others.',
  };
  const specialist = {
    ...common, id: 'b7900000-0000-4000-8000-000000000001', actual_specialty: SPECIALTIES[0].name,
    questionnaire_completed: true, years_of_experience: null, career_satisfaction: null,
    would_choose_again: null, intention_to_change: null, voluntary_choice: null,
    would_choose_again_code: 'yes', intention_to_change_code: null, voluntary_choice_code: null,
    current_specialty_view: 'SYNTHETIC specialist view: a demanding and rewarding practice.',
    specialty_changes_over_years: 'SYNTHETIC changes: care is increasingly collaborative.',
    most_important_specialty_quality: 'SYNTHETIC quality: attentive judgment.',
    would_not_choose_again_reason: null, student_self_question: 'SYNTHETIC question: do I enjoy the daily work?',
    submission_schema_version: versions.specialistSubmissionSchema, calibration_version: versions.calibration,
    consent_version: versions.specialistConsent,
  };
  const skipped = {
    ...specialist, id: 'b7900000-0000-4000-8000-000000000002', questionnaire_completed: false,
    ratings: {}, selected_values: [], current_specialty_view: 'SYNTHETIC interview-only specialist view.',
  };
  return { students: [...students, curious], specialists: [specialist, skipped], student: students[0], legacy: students[4], curious, specialist, skipped };
}

// A small deterministic subset of PostgREST filters, sufficient for these
// read-only lists/counts/details/exports. Unrecognized operations fail closed.
function filterRows(rows, search) {
  return rows.filter(row => [...search].every(([field, condition]) => {
    if (['select', 'order', 'offset', 'limit', 'or'].includes(field)) return true;
    if (condition === 'not.is.null') return row[field] != null;
    if (condition === 'is.null') return row[field] == null;
    if (condition.startsWith('eq.')) return String(row[field]) === condition.slice(3);
    if (condition.startsWith('lt.')) return String(row[field]) < condition.slice(3);
    if (condition.startsWith('lte.')) return String(row[field]) <= condition.slice(4);
    if (condition.startsWith('gte.')) return String(row[field]) >= condition.slice(4);
    if (condition.startsWith('in.(')) return condition.slice(4, -1).split(',').includes(String(row[field]));
    throw new Error(`Unhandled synthetic filter: ${field}=${condition}`);
  })).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

/** Fresh contexts, no production sessions, only local GET assets and mocked APIs. */
export async function verifyBrowserProfessorPortal({ browser, fixtureDefinitions, catalog, liveStaticSmoke = false, expectedMainAsset }) {
  const origin = liveStaticSmoke ? 'https://www.medcompass-web.com' : LOCAL_ORIGIN;
  const screenshotPrefix = liveStaticSmoke ? 'professor-live' : 'professor';
  const { TRANSLATIONS, LANGUAGES, PROFESSOR_PORTAL_COPY } = fixtureDefinitions;
  const fixtures = researchFixtures(fixtureDefinitions, catalog);
  await mkdir('browser-qa.local', { recursive: true });

  for (const language of liveStaticSmoke ? ['en'] : ['en', 'fr', 'ro']) {
    for (const width of [375, 1440]) {
      const mobile = width < 1024;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      await context.routeWebSocket('**', socket => socket.close());
      const calls = [];
      const unexpected = [];
      const blockedNonAssetGets = [];
      const errors = [];
      let documentRequests = 0;
      let session = sessionFixture(RESEARCH_USER_ID);
      let currentPassword = SYNTHETIC_PASSWORD;
      let profile = { authorized: true, role: 'researcher', can_edit: false, can_publish: false, display_name: 'Synthetic professor' };
      let denyReads = false;
      let delayNextDetail = false;
      let releaseDetail;
      let pendingDetail = Promise.resolve();
      const handler = async route => {
        const request = route.request();
        const url = new URL(request.url());
        const safeStaticPath = url.pathname === '/' || url.pathname === '/manifest.webmanifest'
          || /^\/(?:assets|branding)\/[A-Za-z0-9_.-]+\.(?:js|css|svg|png|ico|woff2?)$/u.test(url.pathname);
        if (url.origin === origin && request.method() === 'GET' && (!liveStaticSmoke || (!url.search && safeStaticPath))) {
          if (request.resourceType() === 'document') documentRequests++;
          return route.continue();
        }
        if (liveStaticSmoke && url.origin === origin && request.method() === 'GET') {
          // Hosting/browser-injected non-asset requests are deliberately blocked.
          // Record only resource type and count, not opaque URL tokens.
          blockedNonAssetGets.push(request.resourceType());
          return route.abort('blockedbyclient');
        }
        // Fonts are intentionally blocked, without hitting a third party.
        if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.abort();
        if (!url.hostname.endsWith('.supabase.co')) {
          unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
          return route.abort();
        }
        const rpc = url.pathname.split('/').at(-1);
        calls.push({ rpc, method: request.method(), args: request.postDataJSON(), search: Object.fromEntries(url.searchParams) });
        const reply = (json, extra = {}) => route.fulfill({ headers: { 'cache-control': 'no-store, private' }, json, ...extra });
        if (url.pathname === '/auth/v1/token') {
          assert.equal(url.searchParams.get('grant_type'), 'password');
          assert.equal(request.postDataJSON().password, currentPassword);
          return reply(session);
        }
        if (url.pathname === '/auth/v1/user') {
          if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            assert.deepEqual(Object.keys(body).filter(key => !['code_challenge', 'code_challenge_method'].includes(key)), ['password'], 'Only password plus SDK PKCE transport fields may be sent, never email, identity, metadata or role');
            assert.equal(body.password, 'Synthetic-replacement-password-only');
            currentPassword = body.password;
          } else assert.equal(request.method(), 'GET');
          return reply(session.user);
        }
        if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
        if (rpc === 'get_public_features') return reply({ public_map_enabled: false });
        if (rpc === 'get_active_specialty_catalog') return reply(catalog);
        if (rpc === 'current_user_portal_profile') return reply(profile);
        if (rpc === 'get_portal_test_dataset' && profile.role !== 'researcher') return reply(null);
        if (rpc === 'get_public_feature_settings' && profile.role !== 'researcher') return reply({ public_map_enabled: false });
        if (['student_responses', 'specialist_responses'].includes(rpc)) {
          assert.ok(['GET', 'HEAD'].includes(request.method()), 'The professor workspace never mutates submissions');
          assert.ok(request.headers().authorization?.startsWith('Bearer '));
          if (denyReads || profile.authorized !== true) return reply({ code: '42501', message: 'Synthetic access denied' }, { status: 403 });
          const filtered = filterRows(rpc === 'student_responses' ? fixtures.students : fixtures.specialists, url.searchParams);
          if (request.method() === 'HEAD') return route.fulfill({ headers: { 'content-range': `*/${filtered.length}`, 'access-control-expose-headers': 'content-range' }, body: '' });
          const rowResult = url.searchParams.has('id') ? filtered[0] : filtered.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 250));
          if (delayNextDetail && url.searchParams.has('id')) {
            delayNextDetail = false;
            let finished;
            pendingDetail = new Promise(resolve => { finished = resolve; });
            await new Promise(resolve => { releaseDetail = resolve; });
            try { await reply(rowResult); } catch { /* Expected after request cancellation. */ }
            finally { finished(); }
            return;
          }
          return reply(rowResult, { headers: { 'content-range': `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`, 'access-control-expose-headers': 'content-range', 'cache-control': 'no-store, private' } });
        }
        unexpected.push(`${request.method()} ${url.pathname}`);
        return reply({ message: 'Unexpected operation blocked by professor test' }, { status: 403 });
      };
      await context.route('**/*', handler);
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.on('pageerror', error => errors.push(error.message));
      const noOverflow = async label => {
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(dimensions.viewport <= width + 1 && dimensions.scroll <= width + 1, `${label}: ${JSON.stringify(dimensions)}`);
      };
      const sidebar = async () => {
        if (mobile) await page.locator('button[aria-controls="dashboard-sidebar-mobile"]').click();
        return page.locator(mobile ? '#dashboard-sidebar-mobile' : '#dashboard-sidebar-desktop');
      };
      const selectView = async view => {
        await (await sidebar()).locator(`[data-dashboard-view="${view}"]`).click();
        if (mobile) await page.locator('#dashboard-sidebar-mobile').waitFor({ state: 'hidden' });
        await page.waitForLoadState('networkidle');
      };
      const waitRows = count => page.waitForFunction(expected => document.querySelectorAll('tbody tr').length === expected, count);
      const assertParticipantOnlyWorkspace = async () => {
        assert.equal(await page.locator('[data-dashboard-view="algorithm"], [data-dashboard-view="analytics"], [data-dashboard-view="map"], [data-professor-action="map"], [data-algorithm-explanation], [data-research-analytics], [data-participation-map]').count(), 0, 'The professor workspace has no algorithm, statistics or map destination, card or content, including hidden markup');
        assert.equal(await page.locator('[data-professor-access]').count(), 0, 'The professor research-access banner is removed, not merely hidden');
        const content = await page.locator('body').textContent();
        for (const notice of REMOVED_ACCESS_NOTICES) assert.equal(content.includes(notice), false, 'The removed access explanation is absent from rendered and hidden content in every language');
        assert.equal(calls.some(call => /participation_map_stats$|research_cohort_summary|(?:list|save|delete|create|get)_research_/.test(call.rpc)), false, 'Professor navigation never requests map aggregates or research analytics');
      };
      const signIn = async () => {
        await page.locator('input[type="email"]').fill(session.user.email);
        await page.locator('input[type="password"]').fill(currentPassword);
        await page.locator('form button[type="submit"], form button:not([type])').click();
        await page.locator('#dashboard-sidebar-desktop').waitFor({ state: 'attached' });
        await page.waitForLoadState('networkidle');
      };
      const signOut = async () => {
        await (await sidebar()).getByRole('button', { name: language === 'fr' ? 'Déconnexion' : language === 'ro' ? 'Deconectare' : 'Sign out', exact: true }).click();
        await page.locator('input[type="email"]').waitFor();
        assert.equal(await page.locator('table, [data-professor-overview], [data-participation-map], [data-dashboard-exports]').count(), 0, 'Logout erases all private views');
      };
      try {
        await page.goto(origin, { waitUntil: 'networkidle' });
        if (liveStaticSmoke) assert.equal(await page.locator('script[type="module"]').getAttribute('src'), expectedMainAsset, 'Live page references the expected release bundle');
        if (language !== 'en') {
          const option = LANGUAGES.find(item => item.code === language);
          await page.locator('header button').last().click();
          await page.getByRole('button', { name: `${option.flag} ${option.label}`, exact: true }).click();
        }
        assert.equal(await page.getByRole('button', { name: TRANSLATIONS[language].navWorldMap, exact: true }).count(), 0, 'The public map remains hidden');
        await page.locator('[data-participant-role="curious"]').click();
        await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
        await page.getByRole('heading', { name: PROFESSOR_PORTAL_COPY[language].loginTitle, exact: true }).waitFor();
        await signIn();
        const overview = page.locator('[data-professor-overview]');
        await overview.waitFor();
        const portalLabel = PROFESSOR_PORTAL_COPY[language].portalTitle;
        assert.match(await page.locator('main').innerText(), new RegExp(portalLabel, 'i'));
        await overview.locator('dl[aria-busy="false"]').waitFor();
        assert.equal(await overview.locator('[data-professor-count="students"]').textContent(), '11');
        assert.equal(await overview.locator('[data-professor-count="curious"]').textContent(), '1');
        assert.equal(await overview.locator('[data-professor-count="specialists"]').textContent(), '2');
        assert.equal(await overview.locator('[data-professor-count="total"]').textContent(), '14');
        assert.equal(calls.filter(call => ['student_responses', 'specialist_responses'].includes(call.rpc)).every(call => call.method === 'HEAD'), true, 'Overview reads counts, never loads raw participant answers');
        const menu = await sidebar();
        const destinations = await menu.locator('[data-dashboard-view]').evaluateAll(buttons => buttons.map(button => button.dataset.dashboardView));
        assert.deepEqual(destinations, ['overview', 'specialists', 'students'], 'Professor navigation contains only the overview and participant groups');
        assert.equal(destinations.some(view => ['algorithm', 'configuration', 'public-features'].includes(view)), false);
        assert.deepEqual(await overview.locator('[data-professor-action]').evaluateAll(buttons => buttons.map(button => button.dataset.professorAction)), ['students', 'specialists'], 'Overview links only to the two participant groups');
        await assertParticipantOnlyWorkspace();
        if (mobile) await menu.getByRole('button', { name: language === 'fr' ? 'Fermer le menu' : language === 'ro' ? 'Închide meniul' : 'Close menu', exact: true }).click();
        assert.equal(await page.locator('[data-public-map-toolbar], [data-public-features-settings], [data-portal-test-panel]').count(), 0);
        await noOverflow(`professor overview ${language}/${width}`);
        await page.screenshot({ path: `browser-qa.local/${screenshotPrefix}-overview-${language}-${width}.png`, fullPage: true });
        if (!liveStaticSmoke && language === 'en' && mobile) {
          const passwordSettings = page.locator('[data-portal-password-settings]');
          await passwordSettings.locator('summary').click();
          const passwordInputs = passwordSettings.locator('input[type="password"]');
          assert.equal(await passwordInputs.first().getAttribute('minlength'), '12');
          const beforeMismatch = calls.filter(call => call.rpc === 'user').length;
          await passwordInputs.first().fill('Synthetic-replacement-password-only');
          await passwordInputs.last().fill('Synthetic-does-not-match');
          await passwordSettings.getByRole('button', { name: 'Save password and sign out', exact: true }).click();
          await passwordSettings.getByRole('alert').filter({ hasText: 'Enter the same password in both fields.' }).waitFor();
          assert.equal(calls.filter(call => call.rpc === 'user').length, beforeMismatch, 'Mismatched passwords never leave the browser');
          await passwordInputs.last().fill('Synthetic-replacement-password-only');
          await passwordSettings.getByRole('button', { name: 'Save password and sign out', exact: true }).click();
          await page.getByRole('heading', { name: PROFESSOR_PORTAL_COPY.en.loginTitle, exact: true }).waitFor();
          const updateCalls = calls.filter(call => call.rpc === 'user').slice(beforeMismatch);
          assert.deepEqual(updateCalls.map(call => call.method), ['GET', 'PUT'], 'Authenticated identity is revalidated before password update');
          assert.equal(await page.locator('[data-portal-password-settings], [data-professor-overview]').count(), 0);
          assert.equal(await page.evaluate(value => `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}${document.body.innerHTML}`.includes(value), currentPassword), false, 'Password is absent from storage and DOM after sign-out');
          await signIn();
          await overview.waitFor();
        }
        await overview.locator('[data-professor-export="students"]').click();
        await waitRows(12);
        assert.equal(await page.locator('[data-dashboard-exports]').evaluate(element => element.open), true, 'Overview export shortcut opens the chosen cohort and its export tools');
        assert.equal(await page.getByRole('button', { name: PROFESSOR_PORTAL_COPY[language].spreadsheet, exact: true }).isVisible(), true, 'Spreadsheet is the immediately available professor export');
        assert.equal(await page.locator('[data-professor-other-formats]').evaluate(element => element.open), false, 'Advanced export formats start collapsed');
        assert.equal(await page.getByRole('button', { name: 'JSON', exact: true }).isVisible(), false, 'Secondary formats do not clutter the initial professor export controls');
        assert.equal(await page.locator('tbody tr').count(), 12, 'All eleven students plus the explorer are accessible by default, including seven legacy rows');
        assert.equal(await page.locator('[data-dashboard-version-summary]').textContent(), language === 'fr' ? 'Toutes les versions' : language === 'ro' ? 'Toate versiunile' : 'All versions');
        await noOverflow(`professor student table ${language}/${width}`);
        await assertParticipantOnlyWorkspace();
        await page.screenshot({ path: `browser-qa.local/${screenshotPrefix}-students-${language}-${width}.png`, fullPage: true });
        await selectView('specialists');
        await waitRows(2);
        await assertParticipantOnlyWorkspace();
        await noOverflow(`professor specialist table ${language}/${width}`);
        await page.screenshot({ path: `browser-qa.local/${screenshotPrefix}-specialists-${language}-${width}.png`, fullPage: true });

        if (!liveStaticSmoke && language === 'en' && width === 1440) {
          await selectView('students');
          await page.getByLabel('Audience', { exact: true }).selectOption('student');
          await waitRows(11);
          assert.equal(await page.locator('tbody tr').count(), 11);
          await page.locator('[data-dashboard-advanced-filters] summary').click();
          await page.getByLabel('Data version', { exact: true }).selectOption('current');
          await waitRows(4);
          assert.equal(await page.locator('tbody tr').count(), 4, 'Four current rows never stand for all eleven students');
          await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
          await waitRows(12);
          assert.equal(await page.locator('tbody tr').count(), 12, 'Professor reset restores all data versions');
          assert.equal(await page.getByLabel('Data version', { exact: true }).inputValue(), 'all');

          const inspect = async (row, field) => {
            await page.locator('tbody tr').filter({ hasText: row[field] }).getByRole('button', { name: 'Details', exact: true }).click();
            const dialog = page.getByRole('dialog');
            await dialog.waitFor();
            await dialog.locator('summary').filter({ hasText: 'Exact raw JSON' }).click();
            assert.deepEqual(JSON.parse(await dialog.locator('pre').textContent()), row, 'Detail drawer preserves exact submitted ratings, qualitative text, versions and provenance');
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden' });
          };
          await inspect(fixtures.student, 'medicine_view');
          await inspect(fixtures.legacy, 'medicine_view');
          await inspect(fixtures.curious, 'medicine_view');

          await page.getByLabel('Audience', { exact: true }).selectOption('curious');
          await waitRows(1);
          assert.equal(await page.getByLabel('Study year', { exact: true }).count(), 0);
          await page.locator('[data-dashboard-exports] > summary').click();
          await page.locator('[data-professor-other-formats] summary').click();
          const downloads = [];
          page.on('download', download => downloads.push(download));
          const downloadJson = page.waitForEvent('download');
          await page.getByRole('button', { name: 'JSON', exact: true }).click();
          const exportedJson = JSON.parse(await readFile(await (await downloadJson).path(), 'utf8'));
          assert.deepEqual(exportedJson.rows, [fixtures.curious]);
          assert.equal(exportedJson.metadata.filters.participantRoleFilter, 'curious');
          assert.equal(exportedJson.metadata.filters.dataVersionFilter, 'all');
          assert.equal(exportedJson.metadata.submissions, 1);
          assert.equal(exportedJson.metadata.model.questionnaire, fixtureDefinitions.DATA_VERSIONS.questionnaire);
          assert.equal(exportedJson.metadata.dataset_checksum, `sha256:${createHash('sha256').update(JSON.stringify([fixtures.curious])).digest('hex')}`);
          const csvCount = downloads.length;
          const metadataReady = new Promise(resolve => {
            const collect = download => { if (download.suggestedFilename().endsWith('.metadata.json')) { page.off('download', collect); resolve(download); } };
            page.on('download', collect);
          });
          await page.getByRole('button', { name: PROFESSOR_PORTAL_COPY.en.spreadsheet, exact: true }).click();
          const metadata = JSON.parse(await readFile(await (await metadataReady).path(), 'utf8'));
          const csvDownload = downloads.slice(csvCount).find(download => download.suggestedFilename().endsWith('.csv'));
          assert.ok(csvDownload, 'CSV export also emits reproducibility metadata');
          const csv = await readFile(await csvDownload.path(), 'utf8');
          assert.ok(csv.includes(fixtures.curious.id) && !csv.includes(fixtures.student.id), 'CSV applies the same participant filter');
          assert.ok(csv.includes('participant_role') && csv.includes('questionnaire_version'));
          assert.equal(metadata.filters.participantRoleFilter, 'curious');
          assert.equal(metadata.dataset_checksum, exportedJson.metadata.dataset_checksum);

          denyReads = true;
          const beforeDenied = downloads.length;
          await page.getByRole('button', { name: 'JSON', exact: true }).click();
          await page.getByText(/Synthetic access denied/).waitFor();
          assert.equal(downloads.length, beforeDenied, 'Denied database access never exports cached private rows');
          denyReads = false;

          await selectView('specialists');
          await waitRows(2);
          await inspect(fixtures.specialist, 'current_specialty_view');
          await inspect(fixtures.skipped, 'current_specialty_view');
          const specialtyJson = page.waitForEvent('download');
          if (!await page.locator('[data-dashboard-exports]').evaluate(element => element.open)) await page.locator('[data-dashboard-exports] > summary').click();
          if (!await page.locator('[data-professor-other-formats]').evaluate(element => element.open)) await page.locator('[data-professor-other-formats] summary').click();
          await page.getByRole('button', { name: 'JSON', exact: true }).click();
          const specialistExport = JSON.parse(await readFile(await (await specialtyJson).path(), 'utf8'));
          assert.equal(specialistExport.rows.length, 2);
          assert.deepEqual(specialistExport.rows.find(row => row.id === fixtures.skipped.id), fixtures.skipped, 'Interview-only specialists remain exportable without invented quantitative answers');

          // A delayed prior identity's drawer cannot reappear after reauthorization.
          await selectView('students');
          await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
          await waitRows(12);
          delayNextDetail = true;
          await Promise.all([
            page.waitForRequest(request => new URL(request.url()).searchParams.get('id') === `eq.${fixtures.student.id}`),
            page.locator('tbody tr').filter({ hasText: fixtures.student.medicine_view }).getByRole('button', { name: 'Details', exact: true }).click(),
          ]);
          session = sessionFixture(OTHER_USER_ID);
          await page.evaluate(async session => {
            const { supabase } = await import('/Q-pro/src/lib/supabase.ts');
            const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
            if (error) throw error;
          }, session);
          releaseDetail();
          await pendingDetail;
          await page.waitForLoadState('networkidle');
          assert.equal(await page.getByRole('dialog').count(), 0, 'Prior identity detail response stays discarded');
          await page.locator('[data-professor-overview]').waitFor();
          await assertParticipantOnlyWorkspace();

          // Administrator permissions and landing defaults remain distinct.
          await signOut();
          profile = { authorized: true, role: 'professor', can_edit: true, can_publish: true, display_name: 'Synthetic administrator' };
          await signIn();
          await page.getByRole('heading', { level: 1, name: 'Specialist cohort', exact: true }).waitFor();
          assert.equal(await page.locator('[data-dashboard-version-summary]').textContent(), 'Current versions only');
          assert.equal(await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="configuration"]').count(), 1);
          assert.equal(await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="public-features"]').count(), 1);
          assert.equal(await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="algorithm"]').count(), 1, 'Administrators retain the algorithm tab');
          assert.equal(await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="analytics"]').count(), 1, 'Administrators retain the research analytics tab');
          assert.equal(await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="map"]').count(), 1, 'Administrators retain the participation map tab');
          assert.equal(await page.locator('[data-professor-overview]').count(), 0);
          await selectView('algorithm');
          await page.locator('[data-algorithm-explanation]').waitFor();
        }
        await signOut();
        assert.deepEqual(errors, [], `No browser runtime errors for ${language}/${width}`);
        assert.deepEqual(unexpected, [], 'No unexpected backend operation or external network request was allowed');
        assert.equal(calls.some(call => call.rpc.startsWith('submit_')), false, 'Professor verification never submits participant data');
        assert.equal(documentRequests, 1, 'The isolated verification session never reloads a questionnaire');
        if (liveStaticSmoke) console.log(`Blocked non-asset GET requests: ${JSON.stringify(blockedNonAssetGets)}. Only allowlisted static GETs reached the site.`);
        console.log(`Professor portal ${language}/${width}: shared login, participant-only navigation, no map/statistics requests, all-version records, logout and layout passed.`);
      } catch (error) {
        console.error('Synthetic request summary:', calls.map(({ rpc, method, search }) => ({ rpc, method, search })));
        console.error(`Professor portal failure ${language}/${width}:`, await page.locator('body').innerText());
        await page.screenshot({ path: `browser-qa.local/${screenshotPrefix}-failure-${language}-${width}.png`, fullPage: true });
        throw error;
      } finally {
        releaseDetail?.();
        await pendingDetail;
        await context.close();
      }
    }
  }
  console.log(`Professor portal ${liveStaticSmoke ? 'live-static smoke' : 'local'} checks passed using only synthetic backend fixtures; no production Auth, research, or map request was made.`);
}
