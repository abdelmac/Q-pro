import assert from 'node:assert/strict';

/** UI integration checks only. Database authorization is separately verified by SQL tests. */
export async function verifyBrowserPublicFeatures({ context, page, fixtureDefinitions, defaultArgs, mapCalls, signIn, signOut, setProfile, getProfile, setPublicEnabled }) {
  const { TRANSLATIONS, MAP_TRANSLATIONS } = fixtureDefinitions;
  const copy = TRANSLATIONS.en;
  const pattern = /\/rest\/v1\/rpc\/(?:get_public_features|set_public_map_enabled)$/;
  let enabled = true;
  let responseMode = 'ready';
  let saves = 0;
  const setEnabled = value => { enabled = value; setPublicEnabled(value); };
  const handler = route => {
    if (route.request().url().endsWith('/set_public_map_enabled')) {
      if (!getProfile().authorized || !['doctor', 'professor'].includes(getProfile().role)) {
        return route.fulfill({ status: 403, json: { code: '42501', message: 'Administrator access required' } });
      }
      saves++;
      setEnabled(route.request().postDataJSON().p_enabled);
    }
    if (responseMode === 'error') return route.fulfill({ status: 503, json: { message: 'Synthetic settings outage' } });
    const json = responseMode === 'malformed' ? { public_map_enabled: 'true', private_field: 'must-not-be-used' } : { public_map_enabled: enabled };
    return route.fulfill({ headers: { 'cache-control': 'no-store, private' }, json });
  };
  await context.route(pattern, handler);
  const refresh = async () => {
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/rpc/get_public_features')),
      page.evaluate(() => window.dispatchEvent(new Event('focus'))),
    ]);
  };
  const publicMap = page.locator('[data-participation-map="public"]');
  const privateMap = page.locator('[data-participation-map="admin"]');
  const settings = page.locator('[data-public-features-settings]');
  try {
    // A map already on screen disappears on administrator disable, including its details/counters.
    setEnabled(false);
    const callsBeforeDisable = mapCalls.length;
    await refresh();
    await page.locator('[data-public-map-unavailable]').waitFor();
    assert.equal(await publicMap.count(), 0);
    assert.equal(mapCalls.length, callsBeforeDisable, 'A disabled public route cannot fetch geography');
    await page.locator('[data-navigation-back]').click();
    assert.equal(await page.getByRole('button', { name: copy.navWorldMap, exact: true }).count(), 0);
    await page.locator('[data-participant-role="specialist"]').click();
    assert.equal(await page.getByRole('button', { name: copy.navWorldMap, exact: true }).count(), 0, 'Intro map link is hidden too');
    await page.getByRole('button', { name: copy.startButton, exact: true }).click();
    await page.locator('[data-specialist-path="skip"]').click();
    assert.equal(await page.locator('#specialist-country').count(), 0, 'Map-related geography inputs are hidden');
    setEnabled(true);
    await refresh();
    await page.locator('#specialist-country').selectOption('RO');
    await page.locator('#specialist-region').fill('Cluj');
    setEnabled(false);
    await refresh();
    assert.equal(await page.locator('#specialist-country').count(), 0);
    setEnabled(true);
    await refresh();
    await page.locator('#specialist-country').waitFor();
    assert.equal(await page.locator('#specialist-country').inputValue(), 'RO');
    assert.equal(await page.locator('#specialist-region').inputValue(), 'Cluj', 'Hiding geography must not delete an existing input');

    // Failed, invalid, and offline decisions never keep a last-known true setting.
    await page.reload({ waitUntil: 'networkidle' });
    for (const mode of ['error', 'malformed']) {
      responseMode = mode;
      await refresh();
      assert.equal(await page.getByRole('button', { name: copy.navWorldMap, exact: true }).count(), 0, `${mode} settings fail closed`);
    }
    responseMode = 'ready';
    await refresh();
    await page.getByRole('button', { name: copy.navWorldMap, exact: true }).click();
    await publicMap.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    await context.setOffline(true);
    await page.locator('[data-public-map-unavailable]').waitFor();
    assert.equal(await publicMap.count(), 0, 'Previously loaded geography is not available offline');
    await context.setOffline(false);
    await publicMap.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    await page.locator('[data-navigation-back]').click();

    // Persist both switch directions only after durable acknowledgement.
    await page.setViewportSize({ width: 1440, height: 900 });
    setProfile({ authorized: true, role: 'professor', can_edit: true, can_publish: true });
    await signIn();
    await page.locator('[data-participant-role="curious"]').click();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="public-features"]').click();
    await settings.waitFor();
    const toggle = settings.getByRole('switch', { name: 'Show participation map to public users', exact: true });
    await toggle.waitFor();
    for (const desired of [false, true, false]) {
      await toggle.setChecked(desired);
      await settings.getByRole('button', { name: 'Save setting', exact: true }).click();
      await settings.getByText('Setting saved. The change was recorded in the administrative audit log.', { exact: true }).waitFor();
      assert.equal(enabled, desired);
      assert.equal(await toggle.isChecked(), desired);
    }
    assert.equal(saves, 3);
    await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="map"]').click();
    await privateMap.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    assert.equal(enabled, false, 'Private research map remains available while the public map is disabled');
    const publicDirect = await page.evaluate(async args => {
      const { supabase } = await import('/Q-pro/src/lib/supabase.ts');
      const result = await supabase.rpc('get_participation_map_stats', args);
      return { data: result.data, code: result.error?.code };
    }, defaultArgs);
    assert.equal(publicDirect.code, '42501', 'Even an admin cannot bypass the disabled public endpoint');
    assert.equal(publicDirect.data, null);
    await page.locator('#dashboard-sidebar-desktop').getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Specialist & admin portal', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();

    // Ordinary authenticated users with privileged-looking metadata remain ordinary.
    setProfile({ authorized: false });
    await signIn();
    assert.equal(await page.getByRole('button', { name: copy.navWorldMap, exact: true }).count(), 0);
    const unauthorized = await page.evaluate(async () => {
      const { supabase } = await import('/Q-pro/src/lib/supabase.ts');
      const result = await supabase.rpc('set_public_map_enabled', { p_enabled: true });
      return result.error?.code;
    });
    assert.equal(unauthorized, '42501');
    assert.equal(enabled, false);
    await signOut();
    setEnabled(true);
    await refresh();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: copy.navWorldMap, exact: true }).click();
    await publicMap.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: MAP_TRANSLATIONS.en.filters, exact: true }).count(), 0);
    console.log('Public feature browser checks passed: switch persistence in both directions, disabled routes/links/geography, preserved input, malformed/error/offline fail-closed, private map independence and ordinary-user denial.');
  } finally {
    await context.setOffline(false);
    setPublicEnabled(true);
    await context.unroute(pattern, handler);
  }
}
