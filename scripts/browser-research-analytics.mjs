import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Deterministic, synthetic RPC contracts; no production research request can pass through. */
export async function verifyBrowserResearchAnalytics({ context, page, fixtureDefinitions, signIn, setProfile, getProfile }) {
  const questionIds = fixtureDefinitions.ALL_QUESTION_IDS;
  const timestamp = '2026-09-25T12:00:00Z';
  const cohortId = '98111111-1111-4111-8111-111111111111';
  const calls = [];
  let cohorts = [];
  let runs = [];
  let denied = false;
  let releaseRun;
  let delayNextRun = false;
  let pendingRunFinished = Promise.resolve();
  let runSequence = 0;
  const summary = filters => ({
    global_total: 20, total: 6, eligible: 5, excluded: 1, missing_geography: 2, questionnaire_skipped: 1,
    counts: {
      respondent_type: [{ key: 'student', count: 6 }], language: [{ key: filters.language ?? 'en', count: 6 }],
      country: [{ key: 'RO', count: 4 }, { key: null, count: 2 }],
      questionnaire_version: [{ key: 'q81-v1', count: 6 }], month: [{ key: '2026-09', count: 6 }],
    },
    exclusions: [{ reason: 'questionnaire_skipped', count: 1 }],
    filters, generated_at: timestamp, analysis_version: 'research-pilot-v1',
    completion_metrics: null, personalized_settings: 'historically unavailable',
  });
  const makeRun = args => ({
    id: `98222222-2222-4222-8222-${String(++runSequence).padStart(12, '0')}`,
    created_at: timestamp, completed_at: timestamp, status: 'completed', execution_ms: 8,
    filters: args.p_filters, parameters: args.p_parameters, analysis_version: 'research-pilot-v1',
    dataset_checksum: `sha256:synthetic-snapshot-${runSequence}`, snapshot_count: 6,
    model_versions: [{ questionnaire_version: 'q81-v1', scoring_version: 'synthetic-engine-v1', trait_mapping_version: 'synthetic-traits-v1', specialty_config_revision: 1 }],
    results: {
      summary: summary(args.p_filters),
      question: {
        question_id: args.p_parameters.question_id, questionnaire_version: 'q81-v1', n: 5, missing: 1,
        cohort_total: 6, excluded: 1, mean: 5, median: 5, stddev: 0,
        floor: 0, ceiling: 0, distribution: Array.from({ length: 10 }, (_, index) => ({ value: index + 1, count: index === 4 ? 5 : 0 })), scale: 'original',
      },
      correlation: { n: 5, r: null, method: 'Pearson, original responses, pairwise complete' },
    },
  });
  const pattern = /\/rest\/v1\/rpc\/(?:(?:list|save|delete|create|get)_research_[a-z_]+|research_cohort_summary)$/;
  const handler = async route => {
    const rpc = new URL(route.request().url()).pathname.split('/').at(-1);
    const args = route.request().postDataJSON() ?? {};
    calls.push({ rpc, args });
    assert.ok(route.request().headers().authorization?.startsWith('Bearer '), 'Every private analytics RPC carries the authenticated session');
    if (denied || getProfile().authorized !== true) return route.fulfill({ status: 403, json: { code: '42501', message: 'Synthetic research authorization denied' } });
    const reply = json => route.fulfill({ headers: { 'cache-control': 'no-store, private' }, json });
    if (rpc === 'list_research_cohorts') return reply(cohorts);
    if (rpc === 'list_research_analysis_runs') return reply(runs.map(({ results: _results, ...metadata }) => metadata));
    if (rpc === 'save_research_cohort') {
      cohorts = [{ id: cohortId, name: args.p_name, filters: args.p_filters, created_at: timestamp, updated_at: timestamp }];
      return reply(cohorts[0]);
    }
    if (rpc === 'delete_research_cohort') { cohorts = cohorts.filter(row => row.id !== args.p_id); return reply(true); }
    if (rpc === 'research_cohort_summary') return reply(summary(args.p_filters));
    if (rpc === 'get_research_analysis_run') return reply(runs.find(row => row.id === args.p_id));
    if (rpc === 'delete_research_analysis_run') { runs = runs.filter(row => row.id !== args.p_id); return reply(true); }
    if (rpc === 'create_research_analysis_run') {
      const result = makeRun(args);
      if (delayNextRun) {
        delayNextRun = false;
        let finish;
        pendingRunFinished = new Promise(resolve => { finish = resolve; });
        await new Promise(resolve => { releaseRun = resolve; });
        try { await reply(result); } catch { /* The UI deliberately aborted this request. */ }
        finally { finish(); }
        return;
      }
      runs = [result, ...runs];
      return reply(result);
    }
    return route.fulfill({ status: 400, json: { message: 'Unexpected analytics operation' } });
  };
  await context.route(pattern, handler);
  const panel = page.locator('[data-research-analytics]');
  const selectView = view => page.locator(`#dashboard-sidebar-desktop [data-dashboard-view="${view}"]`).click();
  const execute = () => panel.getByRole('button', { name: 'Run / refresh analysis', exact: true }).click();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    setProfile({ authorized: true, role: 'researcher', can_edit: false, can_publish: false });
    await signIn();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await selectView('analytics');
    await panel.waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await panel.getByLabel('Original item', { exact: true }).locator('option').count(), 81);
    await panel.getByLabel('Category', { exact: true }).selectOption('student');
    await panel.getByLabel('Language', { exact: true }).selectOption('ro');
    await panel.getByLabel('Study year', { exact: true }).selectOption('6');
    await panel.getByLabel('Country code / missing', { exact: true }).fill('missing');
    await panel.getByLabel('Cohort name', { exact: true }).fill('Synthetic Romanian students');
    await panel.getByRole('button', { name: 'Save filters', exact: true }).click();
    const cohort = panel.locator('li').filter({ hasText: 'Synthetic Romanian students' });
    await cohort.waitFor();
    assert.deepEqual(calls.find(call => call.rpc === 'save_research_cohort').args, {
      p_name: 'Synthetic Romanian students',
      p_filters: { questionnaire_version: 'q81-v1', respondent_type: 'student', language: 'ro', study_year: 6, country_code: 'missing' },
    });
    await execute();
    await panel.getByText('Global submissions', { exact: true }).waitFor();
    assert.match(await panel.textContent(), /n=5\/6/);
    assert.match(await panel.textContent(), /Missing geography: 2\/6/);
    assert.match(await panel.textContent(), /Original responses \(not reverse-scored\)/);
    assert.match(await panel.textContent(), /unavailable \(events not collected\)/);
    assert.deepEqual(calls.find(call => call.rpc === 'create_research_analysis_run').args.p_parameters,
      { question_id: questionIds[0], question_a: questionIds[0], question_b: questionIds[1] });
    await cohort.getByRole('button', { name: 'Compare', exact: true }).click();
    await panel.getByRole('heading', { name: 'Cohort comparison', exact: true }).waitFor();
    await panel.getByText(/Cohorts may overlap/).waitFor();
    await page.screenshot({ path: 'browser-qa.local/research-analytics-desktop1440.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: 'browser-qa.local/research-analytics-mobile375.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Analytics results and cohort comparisons fit a narrow mobile viewport');
    await page.setViewportSize({ width: 1440, height: 1000 });
    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export snapshot JSON', exact: true }).first().click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^analysis-.*\.json$/);
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(exported, runs[0], 'Snapshot exports retain exact filters, parameters, timestamps, checksum, model provenance and exclusions');
    assert.equal(exported.results.summary.eligible + exported.results.summary.excluded, exported.results.summary.total);

    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await panel.getByText('Global submissions', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await panel.getByText('Global submissions', { exact: true }).count(), 0, 'The dashboard header refresh also invalidates results');
    assert.equal(await panel.getByLabel('Language', { exact: true }).inputValue(), 'ro', 'Header refresh preserves cohort filters');
    await execute();
    await panel.getByText('Global submissions', { exact: true }).waitFor();

    // Filter edits invalidate the displayed snapshot and comparison, not the recorded history.
    await panel.getByLabel('Language', { exact: true }).selectOption('en');
    assert.equal(await panel.getByText('Global submissions', { exact: true }).count(), 0);
    assert.equal(await panel.getByRole('heading', { name: 'Cohort comparison', exact: true }).count(), 0);
    assert.equal(await cohort.getByRole('button', { name: 'Compare', exact: true }).isDisabled(), true);
    await cohort.getByRole('button', { name: 'Load', exact: true }).click();
    assert.equal(await panel.getByLabel('Language', { exact: true }).inputValue(), 'ro');
    await execute();
    await panel.getByText('Global submissions', { exact: true }).waitFor();

    // Refresh clears the old summary; a late cancelled response cannot repopulate it.
    delayNextRun = true;
    await Promise.all([
      page.waitForRequest(request => request.url().endsWith('/rpc/create_research_analysis_run')),
      execute(),
    ]);
    await panel.getByRole('button', { name: 'Cancel request', exact: true }).waitFor();
    assert.equal(await panel.getByText('Global submissions', { exact: true }).count(), 0, 'A refresh must invalidate its previous result while the new request runs');
    await panel.getByRole('button', { name: 'Cancel request', exact: true }).click();
    await panel.getByRole('alert').filter({ hasText: /cancelled or timed out/ }).waitFor();
    await panel.getByLabel('Language', { exact: true }).selectOption('fr');
    releaseRun();
    await pendingRunFinished;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await panel.getByText('Global submissions', { exact: true }).count(), 0);
    await execute();
    await panel.getByText('Global submissions', { exact: true }).waitFor();
    assert.equal(calls.filter(call => call.rpc === 'create_research_analysis_run').at(-1).args.p_filters.language, 'fr');

    // A server-denied refresh exposes no stale result and no download succeeds without reauthorization.
    denied = true;
    await execute();
    await panel.getByRole('alert').filter({ hasText: 'Synthetic research authorization denied' }).waitFor();
    assert.equal(await panel.getByText('Global submissions', { exact: true }).count(), 0);
    const downloadEvents = [];
    const collectDownload = artifact => downloadEvents.push(artifact);
    page.on('download', collectDownload);
    await panel.getByRole('button', { name: 'Export snapshot JSON', exact: true }).first().click();
    await panel.getByRole('alert').filter({ hasText: 'Synthetic research authorization denied' }).waitFor();
    assert.equal(downloadEvents.length, 0, 'Private export requires a successful authorized fetch');
    page.off('download', collectDownload);
    denied = false;
    await cohort.getByRole('button', { name: 'Delete filter', exact: true }).click();
    await cohort.waitFor({ state: 'hidden' });
    while (await panel.getByRole('button', { name: 'Delete result', exact: true }).count()) {
      const before = runs.length;
      await panel.getByRole('button', { name: 'Delete result', exact: true }).first().click();
      await page.waitForFunction(count => document.querySelectorAll('[data-research-analytics] li button').length === count, (before - 1) * 2);
    }
    assert.equal(runs.length, 0);
    assert.equal(cohorts.length, 0);
    await page.setViewportSize({ width: 375, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Analytics filters fit a narrow mobile viewport');
    await page.setViewportSize({ width: 1440, height: 1000 });
    setProfile({ authorized: false });
    await page.locator('#dashboard-sidebar-desktop').getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Specialist & admin portal', exact: true }).waitFor();
    assert.equal(await panel.count(), 0, 'Sign-out removes private analytics results and controls');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    console.log('Research analytics browser checks passed: named-cohort CRUD, server-side filter parameters, denominators, comparison warning, reproducible export, refresh/filter invalidation, cancellation/late responses, denied exports, result deletion and mobile layout.');
  } catch (error) {
    console.error('Synthetic analytics failure UI:', await page.locator('body').innerText());
    await page.screenshot({ path: 'browser-qa.local/research-analytics-failure.png', fullPage: true });
    throw error;
  } finally {
    releaseRun?.();
    await pendingRunFinished;
    await context.unroute(pattern, handler);
  }
}
