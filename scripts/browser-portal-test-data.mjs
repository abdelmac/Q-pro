import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** All dataset CRUD is mocked. Never insert or delete real research records. */
export async function verifyBrowserPortalTestData({ context, page, catalog, mapCalls, signIn, setProfile }) {
  let recipe = null;
  let creates = 0;
  const deletes = [];
  let tableReads = 0;
  let datasetReads = 0;
  let datasetFailure = false;
  const recipeFixture = () => ({
    id: creates > 1 ? '77222222-1111-4111-8111-111111111111' : '77111111-1111-4111-8111-111111111111',
    seed: creates > 1 ? 91523 : 45678,
    created_at: '2026-09-16T12:00:00Z', generator_version: 'portal-test-v1', catalog,
  });
  const rpcPattern = '**/rest/v1/rpc/*portal_test_dataset';
  const tablePattern = /\/rest\/v1\/(?:student|specialist)_responses(?:\?|$)/;
  const datasetHandler = route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (name === 'get_portal_test_dataset') {
      datasetReads++;
      return datasetFailure
        ? route.fulfill({ status: 503, json: { message: 'Synthetic temporary outage' } })
        : route.fulfill({ json: recipe });
    }
    if (name === 'create_portal_test_dataset') {
      if (!recipe) { creates++; recipe = recipeFixture(); }
      return route.fulfill({ json: recipe });
    }
    if (name === 'delete_portal_test_dataset') {
      const id = route.request().postDataJSON().p_dataset_id;
      deletes.push(id);
      const removed = recipe?.id === id;
      if (removed) recipe = null;
      return route.fulfill({ json: removed });
    }
    return route.fulfill({ status: 403, json: { message: 'Unexpected test dataset RPC' } });
  };
  const tableHandler = route => {
    const method = route.request().method();
    assert(['GET', 'HEAD'].includes(method), 'Test UI must not write research tables');
    tableReads++;
    return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, ...(method === 'HEAD' ? { body: '' } : { json: [] }) });
  };
  await context.route(rpcPattern, datasetHandler);
  await context.route(tablePattern, tableHandler);
  const panel = page.locator('[data-portal-test-panel]');
  const map = page.locator('[data-participation-map="admin"]');
  const chooseView = async view => {
    await page.locator(`#dashboard-sidebar-desktop [data-dashboard-view="${view}"]`).click();
  };
  const waitReady = () => page.waitForFunction(() => !document.querySelector('[data-portal-test-panel] button[data-portal-data-mode="live"]:disabled'));
  const testMode = async () => { await waitReady(); await panel.locator('[data-portal-data-mode="test"]').click(); await panel.locator('[data-portal-test-banner]').waitFor(); };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    setProfile({ authorized: true, role: 'professor', can_edit: true, can_publish: true });
    await signIn();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('heading', { level: 1, name: 'Specialist cohort', exact: true }).waitFor();
    await panel.getByText('No test dataset is available.', { exact: true }).waitFor();
    await page.waitForLoadState('networkidle');
    const liveReads = tableReads;
    await panel.getByRole('button', { name: 'Create test dataset', exact: true }).click();
    await panel.locator('[data-portal-test-banner]').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 5);
    assert.equal(creates, 1);
    assert.equal(tableReads, liveReads, 'Creating/selecting a test dataset never reloads real cohorts');
    const originalDatasetId = recipe.id;
    const originalRows = await page.locator('table tbody').textContent();

    await page.locator('table tbody tr').first().getByRole('button', { name: 'Details', exact: true }).click();
    const detail = page.getByRole('dialog');
    await detail.waitFor();
    assert.match(await detail.textContent(), /TEST|SYNTHETIC/i, 'The detail modal must identify fictional data');
    await page.keyboard.press('Escape');
    await detail.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Load full analysis', exact: true }).click();
    await page.getByRole('button', { name: 'Recompute analysis', exact: true }).waitFor();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    const artifact = await download;
    assert.match(artifact.suggestedFilename(), /test/i);
    const exported = JSON.parse(await readFile(await artifact.path(), 'utf8'));
    const exportedRows = Array.isArray(exported) ? exported : exported.rows;
    assert.equal(exportedRows.length, 5);
    assert.ok(exportedRows.every(row => row.is_test === true && row.test_dataset_id === originalDatasetId && row.research_consent === false));
    assert.ok(exportedRows.every(row => Object.keys(row.ratings).length === 81));

    await chooseView('students');
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 10);
    await chooseView('configuration');
    await page.getByText(/Configuration editing and publication are disabled in test mode/).waitFor();
    assert.equal(await page.getByRole('button', { name: /Publish draft/ }).count(), 0);
    // Supabase can reconfirm SIGNED_IN for the same account on tab return.
    // It must not silently unlock the real catalog or replace the test cohort.
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/rpc/current_user_portal_profile')),
      signIn(),
    ]);
    await panel.locator('[data-portal-test-banner]').waitFor();
    await waitReady();
    await page.getByText(/Configuration editing and publication are disabled in test mode/).waitFor();
    assert.equal(await panel.locator('[data-portal-data-mode="test"]').getAttribute('aria-pressed'), 'true');
    assert.equal(tableReads, liveReads, 'Same-account session revalidation preserves the test-only data source');
    const mapReadsBeforeTest = mapCalls.length;
    await chooseView('map');
    await map.locator('[data-test-map-notice]').waitFor();
    await map.getByRole('button', { name: 'All participants', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-participation-map] [aria-busy="true"]'));
    assert.match(await map.textContent(), /15/);
    assert.doesNotMatch(await map.textContent(), /≈/u, 'Test counts must not pretend to be rounded public totals');
    await map.getByRole('button', { name: 'Specialists', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-participation-map] [aria-busy="true"]'));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-participation-map] [aria-busy="true"]'));
    assert.equal(mapCalls.length, mapReadsBeforeTest, 'Synthetic map/filters/refresh never query real public aggregates');
    assert.equal(tableReads, liveReads, 'Test details, analyses and exports never read real research tables');

    // A real reload gets the same persisted recipe but requires explicit test mode.
    await page.reload({ waitUntil: 'networkidle' });
    const replaceDemoDraft = dialog => { assert.equal(dialog.type(), 'confirm'); void dialog.accept(); };
    page.once('dialog', replaceDemoDraft);
    await page.locator('[data-participant-role="curious"]').click();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    page.off('dialog', replaceDemoDraft);
    await panel.waitFor();
    await waitReady();
    assert.equal(await panel.locator('[data-portal-data-mode="live"]').getAttribute('aria-pressed'), 'true');
    await testMode();
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 5);
    assert.equal(await page.locator('table tbody').textContent(), originalRows, 'Reload reconstructs the same seeded examples');
    const readsAfterReload = tableReads;

    // Losing the recipe or its service must never silently display real responses.
    datasetFailure = true;
    await panel.getByRole('button', { name: 'Check test dataset', exact: true }).click();
    await panel.getByRole('alert').waitFor();
    assert.equal(await page.locator('table tbody tr').count(), 0);
    assert.equal(tableReads, readsAfterReload);
    assert.equal(await panel.locator('[data-portal-data-mode="live"]').getAttribute('aria-pressed'), 'false');
    datasetFailure = false;
    await panel.getByRole('button', { name: 'Check test dataset', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 5);

    const savedRecipe = recipe;
    recipe = null; // Another administrator removed the recipe while this tab was inactive.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await panel.getByText('No test dataset is available.', { exact: true }).waitFor();
    assert.equal(await page.locator('table tbody tr').count(), 0);
    assert.equal(tableReads, readsAfterReload, 'Rechecking a deleted test recipe cannot load the live cohort');
    assert.equal(await panel.locator('[data-portal-data-mode="test"]').getAttribute('aria-pressed'), 'true');
    recipe = savedRecipe;
    await panel.getByRole('button', { name: 'Check test dataset', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 5);

    // The complete deletion controls must remain usable on a narrow phone.
    await page.setViewportSize({ width: 375, height: 900 });
    await panel.locator('summary').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Expanded test controls must not overflow a mobile viewport');
    await page.screenshot({ path: 'browser-qa.local/portal-test-delete-mobile375.png', fullPage: true });
    await panel.locator('#portal-test-delete-confirmation').fill('wrong-id');
    assert.equal(await panel.locator('[data-delete-portal-test-dataset]').isDisabled(), true);
    await panel.locator('#portal-test-delete-confirmation').fill(originalDatasetId);
    await panel.locator('[data-delete-portal-test-dataset]').click();
    await panel.getByText('No test dataset is available.', { exact: true }).waitFor();
    assert.deepEqual(deletes, [originalDatasetId], 'Deletion targets exactly the selected isolated recipe');
    assert.equal(recipe, null);
    assert.equal(await page.locator('[data-portal-test-banner]').count(), 0);
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 0);
    await panel.getByRole('button', { name: 'Create test dataset', exact: true }).click();
    await panel.locator('[data-portal-test-banner]').waitFor();
    await waitReady();
    assert.notEqual(recipe.id, originalDatasetId);
    assert.equal(creates, 2);
    await page.setViewportSize({ width: 1440, height: 1000 });
    setProfile({ authorized: false });
    await page.locator('#dashboard-sidebar-desktop').getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { level: 1, name: 'Specialist & admin portal', exact: true }).waitFor();
    assert.equal(await panel.count(), 0, 'Sign-out clears the entire synthetic view');
    assert.ok(datasetReads >= 3);
    console.log('Portal test dataset browser checks passed: create5/5/5, isolated lists/details/analysis/export/map, reload, fail-closed outage, exact deletion and recreation, logout.');
  } finally {
    await context.unroute(rpcPattern, datasetHandler);
    await context.unroute(tablePattern, tableHandler);
  }
}
