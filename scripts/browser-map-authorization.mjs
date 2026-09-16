import assert from 'node:assert/strict';

/** Synthetic sessions only: all Auth/profile/map calls are intercepted. */
export async function verifyBrowserMapAuthorization({ context, fixtureDefinitions, mapFixture }) {
  const { TRANSLATIONS, MAP_TRANSLATIONS } = fixtureDefinitions;
  const copy = MAP_TRANSLATIONS.en;
  const defaultArgs = { p_respondent_type: 'all', p_country_code: null, p_language: 'all', p_month_from: null, p_month_to: null, p_data_version: 'all' };
  const user = {
    id: 'ac8dd567-8b46-49d4-bdb5-d33a455485d9', aud: 'authenticated', role: 'authenticated',
    // Deliberately privileged-looking editable claims: only the server profile
    // may grant access, never these client-visible user metadata values.
    email: 'synthetic-map-admin@example.invalid',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { portal_role: 'professor', role: 'admin', enabled: true, can_edit_catalog: true },
    created_at: '2026-01-01T00:00:00Z',
  };
  const jwtPart = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const token = `${jwtPart({ alg: 'HS256', typ: 'JWT' })}.${jwtPart({ sub: user.id, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}.${Buffer.from('synthetic-signature-not-a-credential').toString('base64url')}`;
  let profile = { authorized: false };
  let profileFailure = false;
  let profileGate = null;
  let finishDelayedProfile = null;
  let profileCalls = 0;
  const mapCalls = [];
  const authorized = () => profile.authorized === true && ['doctor', 'professor'].includes(profile.role);
  const authPattern = '**/auth/v1/**';
  const profilePattern = '**/rest/v1/rpc/current_user_portal_profile';
  const mapPattern = '**/rest/v1/rpc/get_participation_map_stats';
  const authHandler = route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 403, json: { message: 'Unexpected Auth endpoint blocked by browser fixture' } });
  };
  const profileHandler = async route => {
    profileCalls++;
    const snapshot = structuredClone(profile);
    const failure = profileFailure;
    const gate = profileGate;
    if (gate) await gate;
    try {
      await (failure ? route.fulfill({ status: 503, json: { message: 'Synthetic profile service unavailable' } }) : route.fulfill({ json: snapshot }));
    } catch {
      // Logout deliberately aborts the old authorization request.
    } finally {
      if (gate) finishDelayedProfile?.();
    }
  };
  const mapHandler = route => {
    const args = route.request().postDataJSON() ?? {};
    mapCalls.push(structuredClone(args));
    const unfiltered = JSON.stringify(args) === JSON.stringify(defaultArgs);
    return unfiltered || authorized()
      ? route.fulfill({ json: mapFixture(args) })
      : route.fulfill({ status: 403, json: { code: '42501', message: 'Administrator access required for filters' } });
  };
  await context.route(authPattern, authHandler);
  await context.route(profilePattern, profileHandler);
  await context.route(mapPattern, mapHandler);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const noFilters = async reason => {
    assert.equal(await page.getByRole('button', { name: copy.filters, exact: true }).count(), 0, reason);
    assert.equal(await page.getByRole('button', { name: copy.all, exact: true }).count(), 0, reason);
    assert.equal(await page.getByRole('combobox').count(), 0, reason);
    assert.equal(await page.getByRole('dialog', { includeHidden: true }).count(), 0, reason);
  };
  const waitMap = predicate => page.waitForResponse(response => response.url().includes('/rpc/get_participation_map_stats') && predicate(response.request().postDataJSON()));
  const signIn = () => page.evaluate(async ({ accessToken }) => {
    const { supabase } = await import('/Q-pro/src/lib/supabase.ts');
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: 'synthetic-refresh-not-a-credential' });
    if (error) throw new Error(`Synthetic sign-in failed: ${error.message}`);
  }, { accessToken: token });
  const signOut = () => page.evaluate(async () => {
    const { supabase } = await import('/Q-pro/src/lib/supabase.ts');
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Synthetic sign-out failed');
  });
  try {
    await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: TRANSLATIONS.en.navWorldMap, exact: true }).click();
    await page.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    await noFilters('Anonymous map visitors have no filter controls');

    // Anonymous tokens and editable role metadata cannot grant administrator access.
    for (const denied of [
      { authorized: true, role: 'researcher', can_edit_catalog: true },
      { authorized: false, role: 'doctor', enabled: false },
      { authorized: true, role: 'admin' },
      { authorized: false, role: 'professor' },
      {},
    ]) {
      profile = denied;
      const response = page.waitForResponse(response => response.url().includes('/rpc/current_user_portal_profile'));
      await Promise.all([response, signIn()]);
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
      await noFilters(`Denied server profile ${JSON.stringify(denied)}`);
      await signOut();
    }
    profile = { authorized: true, role: 'professor' };
    profileFailure = true;
    const failedProfile = page.waitForResponse(response => response.url().includes('/rpc/current_user_portal_profile') && response.status() === 503);
    await Promise.all([failedProfile, signIn()]);
    await noFilters('Profile verification failure must fail closed');
    await signOut();
    profileFailure = false;

    // Both administrative roles get controls. They remain visible while the
    // client uses the server's aggregate RPC instead of fetching research rows.
    for (const role of ['doctor', 'professor']) {
      profile = { authorized: true, is_researcher: true, role, enabled: true, can_edit_catalog: true };
      await page.setViewportSize({ width: role === 'doctor' ? 375 : 1440, height: 900 });
      await signIn();
      await page.getByRole('button', { name: copy.all, exact: true }).waitFor();
      let form;
      if (role === 'doctor') {
        await page.getByRole('button', { name: copy.filters, exact: true }).click();
        form = page.getByRole('dialog');
        await form.waitFor({ state: 'visible' });
      } else form = page.locator('aside').filter({ has: page.getByLabel(copy.country, { exact: true }) });
      await form.getByLabel(copy.country, { exact: true }).selectOption('RO');
      await form.getByLabel(copy.language, { exact: true }).selectOption('ro');
      await form.getByLabel(copy.version, { exact: true }).selectOption('current');
      await Promise.all([
        waitMap(args => args.p_country_code === 'RO' && args.p_language === 'ro' && args.p_data_version === 'current'),
        form.getByRole('button', { name: copy.applyFilters, exact: true }).click(),
      ]);
      await Promise.all([
        waitMap(args => args.p_respondent_type === 'specialist'),
        page.getByRole('button', { name: copy.specialists, exact: true }).click(),
      ]);
      await page.getByRole('button', { name: /^Romania ≈ 15$/ }).click();
      assert.match(await page.getByRole('region', { name: copy.details }).textContent(), /≈ 15/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
      if (role === 'doctor') {
        await page.getByRole('button', { name: copy.filters, exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'visible' });
      }
      profile = { authorized: false };
      await Promise.all([waitMap(args => JSON.stringify(args) === JSON.stringify(defaultArgs)), signOut()]);
      await page.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
      await noFilters('Logout removes controls, closes the drawer and restores the public aggregate');
      assert.equal(await page.getByRole('button', { name: /^Romania ≈ 15$/ }).count(), 0, 'Filtered totals do not remain after logout');
      assert.equal(await page.getByRole('region', { name: copy.details }).getByRole('heading').count(), 0, 'Filtered country details are cleared on logout');
    }

    // A server-side role revocation takes effect on the next filtered request,
    // including an already-open drawer and previously rendered country details.
    await page.setViewportSize({ width: 375, height: 812 });
    profile = { authorized: true, role: 'professor' };
    await signIn();
    await page.getByRole('button', { name: copy.all, exact: true }).waitFor();
    await Promise.all([waitMap(args => args.p_respondent_type === 'specialist'), page.getByRole('button', { name: copy.specialists, exact: true }).click()]);
    await page.getByRole('button', { name: /^Romania ≈ 15$/ }).click();
    await page.getByRole('button', { name: copy.filters, exact: true }).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByLabel(copy.country, { exact: true }).selectOption('RO');
    profile = { authorized: true, role: 'researcher' };
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/rpc/get_participation_map_stats') && response.status() === 403),
      drawer.getByRole('button', { name: copy.applyFilters, exact: true }).click(),
    ]);
    await page.getByRole('button', { name: /^Romania ≈ 35$/ }).waitFor();
    await noFilters('A 42501/403 response revokes filter access and restores public defaults');
    assert.equal(await page.getByRole('region', { name: copy.details }).getByRole('heading').count(), 0);
    assert.equal(await page.getByRole('button', { name: /^Romania ≈ 15$/ }).count(), 0);
    await signOut();

    // A late successful role verification cannot restore controls after logout.
    profile = { authorized: true, role: 'doctor' };
    let releaseProfile;
    profileGate = new Promise(resolve => { releaseProfile = resolve; });
    const delayedFinished = new Promise(resolve => { finishDelayedProfile = resolve; });
    await Promise.all([
      page.waitForRequest(request => request.url().includes('/rpc/current_user_portal_profile')),
      signIn(),
    ]);
    await noFilters('Controls remain hidden until the server verification succeeds');
    await signOut();
    profile = { authorized: false };
    releaseProfile();
    await delayedFinished;
    profileGate = null;
    finishDelayedProfile = null;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await noFilters('A delayed pre-logout authorization cannot grant access after logout');
    assert.ok(profileCalls >= 8, 'Every authorization is verified by the server profile');
    assert.ok(mapCalls.some(args => args.p_respondent_type === 'specialist'));
    assert.deepEqual(errors, []);
    console.log('Map authorization browser checks passed: public/researcher/disabled/error denied, doctor/professor filters, logout/revocation clear filtered results, late profile cannot restore access.');
  } finally {
    await page.close();
    await context.unroute(authPattern, authHandler);
    await context.unroute(profilePattern, profileHandler);
    await context.unroute(mapPattern, mapHandler);
  }
}
