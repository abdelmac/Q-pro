import assert from 'node:assert/strict';

/** UI integration checks only. Database authorization is separately verified by SQL tests. */
export async function verifyBrowserPublicFeatures({ context, page, fixtureDefinitions, defaultArgs, mapCalls, signIn, signOut, setProfile, getProfile, setPublicEnabled }) {
  const { TRANSLATIONS, MAP_TRANSLATIONS } = fixtureDefinitions;
  const copy = TRANSLATIONS.en;
  const pattern = /\/rest\/v1\/rpc\/(?:get_public_features|set_public_map_enabled)$/;
  let enabled = true;
  let responseMode = 'ready';
  let writeMode = 'ready';
  let releaseWrite = null;
  let saves = 0;
  const setEnabled = value => { enabled = value; setPublicEnabled(value); };
  const handler = route => {
    if (route.request().url().endsWith('/set_public_map_enabled')) {
      if (!getProfile().authorized || !['doctor', 'professor'].includes(getProfile().role)) {
        return route.fulfill({ status: 403, json: { code: '42501', message: 'Administrator access required' } });
      }
      if (writeMode === 'error') return route.fulfill({ status: 503, json: { message: 'Synthetic write outage' } });
      if (writeMode === 'mismatch') return route.fulfill({ json: { public_map_enabled: enabled } });
      if (writeMode === 'pending') return new Promise(resolve => {
        releaseWrite = async () => {
          saves++;
          setEnabled(route.request().postDataJSON().p_enabled);
          await route.fulfill({ json: { public_map_enabled: enabled } });
          resolve();
        };
      });
      saves++;
      setEnabled(route.request().postDataJSON().p_enabled);
    }
    if (responseMode === 'missing') return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Synthetic missing function' } });
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
    // The landing tab has a direct action; no sidebar search is required.
    const toolbar = page.locator('[data-public-map-toolbar]');
    await toolbar.getByRole('button', { name: 'Hide public map', exact: true }).waitFor();
    responseMode = 'missing';
    await refresh();
    await toolbar.getByText('Map visibility control is unavailable on this deployment.', { exact: true }).waitFor();
    assert.equal(await toolbar.getByRole('button', { name: 'Show public map', exact: true }).isDisabled(), true);
    assert.equal(await toolbar.getByText('Public map hidden', { exact: true }).count(), 0, 'Unavailable is not a confirmed saved false');
    assert.equal(saves, 0);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: 'browser-qa.local/dashboard-map-setup-required-mobile375.png', fullPage: true });
    responseMode = 'ready';
    await toolbar.getByRole('button', { name: 'Check again', exact: true }).click();
    for (const desired of [false, true]) {
      const action = toolbar.getByRole('button', { name: desired ? 'Show public map' : 'Hide public map', exact: true });
      await action.waitFor();
      const bounds = await action.boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900, 'Map action is visible on the initial mobile screen');
      await action.click();
      await toolbar.getByText('Setting saved. The change was recorded in the administrative audit log.', { exact: true }).waitFor();
      await toolbar.getByRole('button', { name: desired ? 'Hide public map' : 'Show public map', exact: true }).waitFor();
      assert.equal(enabled, desired, 'Quick action saves the real setting contract');
    }
    for (const mode of ['error', 'mismatch']) {
      writeMode = mode;
      await toolbar.getByRole('button', { name: 'Hide public map', exact: true }).click();
      await toolbar.getByText('The setting could not be saved. Check your connection and administrator access, then try again.', { exact: true }).waitFor();
      await toolbar.getByRole('button', { name: 'Hide public map', exact: true }).waitFor();
      assert.equal(enabled, true, 'Rejected or unconfirmed saves never claim a successful change');
      assert.equal(await toolbar.getByText('Setting saved. The change was recorded in the administrative audit log.', { exact: true }).count(), 0);
    }
    writeMode = 'ready';
    await page.setViewportSize({ width: 1440, height: 900 });
    writeMode = 'pending';
    await toolbar.getByRole('button', { name: 'Hide public map', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
    await toolbar.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.waitFor();
    const toggle = settings.getByRole('switch', { name: 'Show participation map to public users', exact: true });
    await toggle.waitFor();
    await refresh();
    assert.equal(await toggle.isDisabled(), true, 'Pending-write lock survives navigation and an intervening read');
    assert.equal(saves, 2, 'No second write can start while the first is pending');
    assert.ok(releaseWrite);
    await releaseWrite();
    releaseWrite = null;
    writeMode = 'ready';
    await settings.getByText('Setting saved. The change was recorded in the administrative audit log.', { exact: true }).waitFor();
    assert.equal(enabled, false);
    for (const desired of [true, false]) {
      await toggle.setChecked(desired);
      await settings.getByRole('button', { name: 'Save setting', exact: true }).click();
      await settings.getByText('Setting saved. The change was recorded in the administrative audit log.', { exact: true }).waitFor();
      assert.equal(enabled, desired);
      assert.equal(await toggle.isChecked(), desired);
    }
    assert.equal(saves, 5);
    await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="map"]').click();
    await privateMap.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    assert.equal(enabled, false, 'Private research map remains available while the public map is disabled');
    // The control is also available directly on the map, including narrow screens.
    await page.setViewportSize({ width: 375, height: 900 });
    await settings.waitFor();
    for (const desired of [true, false]) {
      await toggle.setChecked(desired);
      assert.equal(enabled, !desired, 'Changing the switch alone does not publish a setting');
      await settings.getByRole('button', { name: 'Save setting', exact: true }).click();
      await settings.getByText('Setting saved. The change was recorded in the administrative audit log.', { exact: true }).waitFor();
      assert.equal(enabled, desired);
      await privateMap.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    }
    assert.equal(saves, 7, 'Quick, dedicated and map settings use the same persisted flag');
    const mobileWidth = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(mobileWidth.content <= mobileWidth.viewport + 1, 'Inline visibility settings fit on mobile');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="public-features"]').click();
    await page.getByRole('heading', { level: 1, name: 'Map visibility', exact: true }).waitFor();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/rpc/get_public_features')),
      page.getByRole('button', { name: 'Refresh', exact: true }).click(),
    ]);
    await settings.getByText('Public map hidden', { exact: true }).waitFor();
    assert.equal(await toggle.isChecked(), false, 'Dedicated settings reflect the value saved on the map tab');
    const publicDirect = await page.evaluate(async args => {
      const { supabase } = await import('/Q-pro/src/lib/supabase.ts');
      const result = await supabase.rpc('get_participation_map_stats', args);
      return { data: result.data, code: result.error?.code };
    }, defaultArgs);
    assert.equal(publicDirect.code, '42501', 'Even an admin cannot bypass the disabled public endpoint');
    assert.equal(publicDirect.data, null);
    await page.locator('#dashboard-sidebar-desktop').getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Professor & admin sign in', exact: true }).waitFor();
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
    console.log('Public feature browser checks passed: visible mobile quick action, missing-RPC setup warning, rejected/unconfirmed writes, working header Refresh, dedicated and inline switches, persistence in both directions, disabled routes/links/geography, preserved input, malformed/error/offline fail-closed, private map independence and ordinary-user denial.');
  } finally {
    if (releaseWrite) await releaseWrite();
    await context.setOffline(false);
    setPublicEnabled(true);
    await context.unroute(pattern, handler);
  }
}
