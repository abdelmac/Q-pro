import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

/** Real SDK/UI, synthetic sessions and aggregates; no production table access. */
export async function verifyBrowserDashboardMap({ context, page, fixtureDefinitions, defaultArgs, mapCalls, signIn, setProfile }) {
  const copy = fixtureDefinitions.MAP_TRANSLATIONS.en;
  const tablePattern = /\/rest\/v1\/(?:student|specialist)_responses(?:\?|$)/;
  let tableReads = 0;
  const tableHandler = route => {
    const method = route.request().method();
    assert.ok(['GET', 'HEAD'].includes(method), 'Dashboard map verification must never mutate research tables');
    tableReads++;
    return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, ...(method === 'HEAD' ? { body: '' } : { json: [] }) });
  };
  await context.route(tablePattern, tableHandler);
  const waitMap = expected => page.waitForResponse(response => response.url().includes('/rpc/get_private_participation_map_stats') && JSON.stringify(response.request().postDataJSON()) === JSON.stringify(expected));
  const map = page.locator('[data-participation-map]');
  const openSidebar = async mobile => {
    if (mobile) await page.getByRole('button', { name: 'Open dashboard menu', exact: true }).click();
    return page.locator(mobile ? '#dashboard-sidebar-mobile' : '#dashboard-sidebar-desktop');
  };
  const selectView = async (view, mobile) => {
    const sidebar = await openSidebar(mobile);
    await sidebar.locator(`[data-dashboard-view="${view}"]`).click();
    if (mobile) await page.getByRole('dialog', { name: 'Dashboard menu', exact: true }).waitFor({ state: 'hidden' });
  };
  const openFilters = async mobile => {
    if (!mobile) return map.locator('aside:visible');
    await map.getByRole('button', { name: copy.filters, exact: true }).click();
    const drawer = map.getByRole('dialog');
    await drawer.waitFor({ state: 'visible' });
    return drawer;
  };
  const closeFilters = async (mobile, form) => {
    if (mobile) await form.getByRole('button', { name: copy.close, exact: true }).click();
  };
  const noOverflow = async label => {
    const expectedWidth = page.viewportSize().width;
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.width <= expectedWidth + 1 && dimensions.scroll <= expectedWidth + 1, `${label}: no horizontal overflow or mobile viewport expansion (${JSON.stringify({ expectedWidth, ...dimensions })})`);
  };
  try {
    await mkdir('browser-qa.local', { recursive: true });
    // The authorization helper leaves us on the anonymous public map.
    await page.locator('[data-navigation-back]').click();
    await page.locator('[data-participant-role="curious"]').click();
    for (const role of ['doctor', 'professor']) {
      const mobile = role === 'doctor';
      await page.setViewportSize({ width: mobile ? 375 : 1440, height: 900 });
      setProfile({ authorized: true, role, can_edit: true, can_publish: role === 'professor', display_name: 'Synthetic portal reviewer' });
      await signIn();
      await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Specialist cohort', exact: true }).waitFor();
      await page.waitForLoadState('networkidle');
      await noOverflow(`${role} initial cohort before opening the map`);
      const sidebar = await openSidebar(mobile);
      assert.deepEqual(await sidebar.locator('[data-dashboard-view]').evaluateAll(buttons => buttons.map(button => button.dataset.dashboardView)), ['specialists', 'students', 'analytics', 'map', 'algorithm', 'configuration', 'public-features']);
      await sidebar.getByRole('button', { name: 'Participation map', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Participation map', exact: true }).waitFor();
      await map.getByRole('button', { name: copy.all, exact: true }).waitFor();
      await map.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
      assert.equal(await page.locator('main').count(), 1, 'Embedded map must retain one dashboard main landmark');
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, 'Embedded map must retain the single dashboard title');
      assert.equal(await map.locator('header, main, h1, [data-navigation-back]').count(), 0, 'Embedded map must not render public page chrome or its own back control');
      assert.equal(await page.locator('[data-dashboard-back]').isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'Refresh', exact: true }).isVisible(), true);
      if (!mobile) assert.equal(await page.locator('#dashboard-sidebar-desktop').isVisible(), true, 'Desktop sidebar remains alongside the map');
      await noOverflow(`${role} embedded map`);
      await page.screenshot({ path: `browser-qa.local/dashboard-map-${mobile ? 'mobile375' : 'desktop1440'}.png`, fullPage: true });
      if (!mobile) {
        await page.setViewportSize({ width: 1024, height: 900 });
        await noOverflow('Embedded map at the 1024px desktop sidebar breakpoint');
        await page.screenshot({ path: 'browser-qa.local/dashboard-map-desktop1024.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      await page.waitForLoadState('networkidle');
      const cohortReadsBeforeFilters = tableReads;

      await Promise.all([waitMap({ ...defaultArgs, p_respondent_type: 'specialist' }), map.getByRole('button', { name: copy.specialists, exact: true }).click()]);
      let form = await openFilters(mobile);
      await form.getByLabel(copy.country, { exact: true }).selectOption('RO');
      await form.getByLabel(copy.language, { exact: true }).selectOption('ro');
      await form.getByLabel(copy.version, { exact: true }).selectOption('current');
      await form.getByLabel(copy.monthFrom, { exact: true }).fill('2026-08');
      await form.getByLabel(copy.monthTo, { exact: true }).fill('2026-01');
      const requestsBeforeInvalidApply = mapCalls.length;
      assert.equal(await form.getByRole('button', { name: copy.applyFilters, exact: true }).isDisabled(), true, 'A reversed month range cannot be submitted');
      await form.getByText(copy.invalidDates, { exact: true }).waitFor();
      assert.equal(mapCalls.length, requestsBeforeInvalidApply, 'Editing invalid dates must not fetch an aggregate');
      await form.getByLabel(copy.monthTo, { exact: true }).fill('2999-12');
      assert.equal(await form.getByRole('button', { name: copy.applyFilters, exact: true }).isDisabled(), true, 'An unpublished future month cannot be submitted');
      assert.equal(mapCalls.length, requestsBeforeInvalidApply);
      await form.getByLabel(copy.monthFrom, { exact: true }).fill('2025-01');
      await form.getByLabel(copy.monthTo, { exact: true }).fill('2026-08');
      const applied = { p_respondent_type: 'specialist', p_country_code: 'RO', p_language: 'ro', p_month_from: '2025-01-01', p_month_to: '2026-08-01', p_data_version: 'current' };
      await Promise.all([waitMap(applied), form.getByRole('button', { name: copy.applyFilters, exact: true }).click()]);
      await map.getByRole('button', { name: /^Romania ≈ 15$/ }).waitFor();
      assert.equal(await map.getByRole('button', { name: copy.specialists, exact: true }).getAttribute('aria-pressed'), 'true');
      await noOverflow(`${role} filtered map`);

      // Refresh must use applied parameters, not a draft that has not been saved.
      form = await openFilters(mobile);
      await form.getByLabel(copy.country, { exact: true }).selectOption('FR');
      await closeFilters(mobile, form);
      await Promise.all([waitMap(applied), page.getByRole('button', { name: 'Refresh', exact: true }).click()]);
      await map.getByRole('button', { name: /^Romania ≈ 15$/ }).waitFor();
      assert.deepEqual(mapCalls.at(-1), applied, 'Dashboard Refresh preserves all six applied map filters');
      form = await openFilters(mobile);
      assert.equal(await form.getByLabel(copy.country, { exact: true }).inputValue(), 'FR', 'Refreshing must not overwrite a pending filter draft');
      await Promise.all([waitMap(defaultArgs), form.getByRole('button', { name: copy.resetFilters, exact: true }).click()]);
      await map.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
      form = await openFilters(mobile);
      for (const [label, value] of [[copy.country, ''], [copy.language, 'all'], [copy.version, 'all'], [copy.monthFrom, ''], [copy.monthTo, '']]) assert.equal(await form.getByLabel(label, { exact: true }).inputValue(), value, 'Reset clears every map filter');
      await closeFilters(mobile, form);
      assert.equal(await map.getByRole('button', { name: copy.all, exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(tableReads, cohortReadsBeforeFilters, 'Map filters and Refresh query only the aggregate RPC, not research response tables');

      await page.locator('[data-dashboard-back]').click();
      await page.getByRole('heading', { level: 1, name: 'Specialist cohort', exact: true }).waitFor();
      assert.equal(await map.count(), 0, 'Dashboard Back returns from the map to the previous tab');
      await selectView('map', mobile);
      await map.getByRole('button', { name: copy.all, exact: true }).waitFor();
      await selectView('algorithm', mobile);
      await page.getByRole('heading', { level: 1, name: 'Algorithm & calibration', exact: true }).waitFor();
      await page.locator('[data-dashboard-back]').click();
      await page.getByRole('heading', { level: 1, name: 'Participation map', exact: true }).waitFor();
      await map.getByRole('button', { name: copy.all, exact: true }).waitFor();
      const signOutSidebar = await openSidebar(mobile);
      setProfile({ authorized: false });
      await signOutSidebar.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Specialist & admin portal', exact: true }).waitFor();
      assert.equal(await map.count(), 0, 'Signing out removes the embedded map and its filtered content');
      assert.equal(await page.locator('[data-dashboard-sidebar]').count(), 0, 'Signing out removes administrative navigation');
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    }

    // A legitimate researcher can inspect the private map, but cannot edit public features.
    for (const mobile of [true, false]) {
      await page.setViewportSize({ width: mobile ? 375 : 1440, height: 900 });
      setProfile({ authorized: true, role: 'researcher', can_edit: false, can_publish: false });
      await signIn();
      await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Specialist cohort', exact: true }).waitFor();
      await page.waitForLoadState('networkidle');
      await noOverflow(`Researcher ${mobile ? 'mobile' : 'desktop'} cohort`);
      const sidebar = await openSidebar(mobile);
      assert.deepEqual(await sidebar.locator('[data-dashboard-view]').evaluateAll(buttons => buttons.map(button => button.dataset.dashboardView)), ['specialists', 'students', 'analytics', 'map', 'algorithm']);
      assert.equal(await page.locator('[data-dashboard-view="public-features"]').count(), 0, 'Researchers cannot change public visibility');
      await sidebar.locator('[data-dashboard-view="map"]').click();
      await map.getByRole('button', { name: copy.all, exact: true }).waitFor();
      await map.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
      const researcherSidebar = await openSidebar(mobile);
      await researcherSidebar.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Specialist & admin portal', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    }
    setProfile({ authorized: false });
    console.log('Dashboard map browser checks passed: authorized private routes, six filters, invalid dates/reset, applied-filter Refresh, tab history, sign-out, researcher access and settings exclusion.');
  } catch (error) {
    console.error('Dashboard map failure layout:', { viewport: page.viewportSize(), ...await page.evaluate(() => ({ innerWidth, innerHeight, scrollY, documentWidth: document.documentElement.scrollWidth })) });
    await page.screenshot({ path: 'browser-qa.local/dashboard-map-failure.png' });
    throw error;
  } finally {
    await context.unroute(tablePattern, tableHandler);
  }
}
