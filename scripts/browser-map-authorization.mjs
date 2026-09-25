import assert from 'node:assert/strict';
import { verifyBrowserDashboardMap } from './browser-dashboard-map.mjs';
import { verifyBrowserPortalTestData } from './browser-portal-test-data.mjs';
import { verifyBrowserPublicFeatures } from './browser-public-features.mjs';

/** Synthetic sessions only: all Auth/profile/map calls are intercepted. */
export async function verifyBrowserMapAuthorization({ context, fixtureDefinitions, mapFixture, catalog }) {
  const { TRANSLATIONS, MAP_TRANSLATIONS } = fixtureDefinitions;
  const copy = MAP_TRANSLATIONS.en;
  const defaultArgs = { p_respondent_type: 'all', p_country_code: null, p_language: 'all', p_month_from: null, p_month_to: null, p_data_version: 'all' };
  const user = {
    id: 'ac8dd567-8b46-49d4-bdb5-d33a455485d9', aud: 'authenticated', role: 'authenticated',
    email: 'synthetic-map-admin@example.invalid',
    app_metadata: { provider: 'email', providers: ['email'] },
    // Editable claims must never grant access to a map or administrative setting.
    user_metadata: { portal_role: 'professor', role: 'admin', enabled: true, can_edit_catalog: true },
    created_at: '2026-01-01T00:00:00Z',
  };
  const jwtPart = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const token = `${jwtPart({ alg: 'HS256', typ: 'JWT' })}.${jwtPart({ sub: user.id, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}.${Buffer.from('synthetic-signature-not-a-credential').toString('base64url')}`;
  let profile = { authorized: false };
  let profileCalls = 0;
  let publicEnabled = true;
  const mapCalls = [];
  const authorized = () => profile.authorized === true && ['researcher', 'doctor', 'professor'].includes(profile.role);
  const authPattern = '**/auth/v1/**';
  const profilePattern = '**/rest/v1/rpc/current_user_portal_profile';
  const mapPattern = /\/rest\/v1\/rpc\/get_(?:private_)?participation_map_stats$/;
  const authHandler = route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 403, json: { message: 'Unexpected Auth endpoint blocked by browser fixture' } });
  };
  const profileHandler = route => { profileCalls++; return route.fulfill({ json: profile }); };
  const mapHandler = route => {
    const args = route.request().postDataJSON() ?? {};
    const isPrivate = route.request().url().includes('/get_private_');
    mapCalls.push(structuredClone(args));
    const permitted = isPrivate ? authorized() : publicEnabled && JSON.stringify(args) === JSON.stringify(defaultArgs);
    return permitted
      ? route.fulfill({ headers: { 'cache-control': 'no-store, private' }, json: mapFixture(args) })
      : route.fulfill({ status: 403, headers: { 'cache-control': 'no-store, private' }, json: { code: '42501', message: 'Geographic data access denied' } });
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
    await noFilters('Anonymous public map visitors have no filter controls');
    for (const role of ['researcher', 'doctor', 'professor', 'admin']) {
      profile = { authorized: role !== 'admin', role, can_edit: role !== 'researcher', can_publish: role === 'professor' };
      await signIn();
      await noFilters(`Even ${role} accounts use only the aggregate overview on a public route`);
      await signOut();
    }
    profile = { authorized: false };
    await verifyBrowserPublicFeatures({ context, page, fixtureDefinitions, defaultArgs, mapCalls, signIn, signOut,
      setProfile: value => { profile = value; }, getProfile: () => profile,
      setPublicEnabled: value => { publicEnabled = value; } });
    await verifyBrowserDashboardMap({ context, page, fixtureDefinitions, defaultArgs, mapCalls, signIn, setProfile: value => { profile = value; } });
    await verifyBrowserPortalTestData({ context, page, catalog, mapCalls, signIn, setProfile: value => { profile = value; } });
    assert.ok(profileCalls >= 6, 'Dashboard and private-map access is verified by the server profile');
    assert.ok(mapCalls.some(args => args.p_respondent_type === 'specialist'));
    assert.deepEqual(errors, []);
    console.log('Map authorization browser checks passed: no public filters for any role, fail-closed visibility, admin-only settings, authorized researcher private maps, logout clearing.');
  } finally {
    await page.close();
    await context.unroute(authPattern, authHandler);
    await context.unroute(profilePattern, profileHandler);
    await context.unroute(mapPattern, mapHandler);
  }
}
