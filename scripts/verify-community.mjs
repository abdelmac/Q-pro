// Pure, isolated contract checks. Supabase is replaced at bundle time; no live
// accounts, email, database rows, grants or network requests are involved.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'medcompass-community-contracts-'));
const fixtureKey = '__MEDCOMPASS_COMMUNITY_UNIT_FIXTURE__';
const fixture = { reply: null, calls: [], signals: [], timeouts: [] };
const previousFixture = globalThis[fixtureKey];
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
let assertions = 0;
let networkAttempts = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const ok = (value, message) => { assert.ok(value, message); assertions++; };
const uuid = n => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

globalThis[fixtureKey] = fixture;
globalThis.window = {
  location: new URL('https://medcompass-web.com/?returnTo=https://attacker.invalid/&redirect_to=https://attacker.invalid/#access_token=synthetic-do-not-copy'),
  setTimeout: (callback, delay) => { fixture.timeouts.push(delay); return setTimeout(callback, delay); },
};
globalThis.fetch = () => { networkAttempts++; throw new Error('Network is forbidden in community unit tests'); };

async function loadContracts(base, enabled, name) {
  const outputFile = join(directory, `${name}.mjs`);
  await build({
    stdin: {
      contents: `
        export { COMMUNITY_FEATURE_ENABLED, communityApi, CommunityError, parseCommunityProfile, parseCommunityMap } from './src/lib/community';
        export { communityAccountRedirect } from './src/lib/communityAuthRedirect';
        export { getDashboardNavItems } from './src/lib/dashboardNavigation';
        export { parsePortalProfile, isProfessorWorkspace } from './src/lib/portalAccess';
        export { normalizeAppLocation, createAppNavigationState, createAppNavigationReducer, navigateTo, navigateBack, getCurrentAppLocation } from './src/lib/appNavigation';
      `,
      loader: 'ts', resolveDir: process.cwd(),
    },
    outfile: outputFile, bundle: true, platform: 'node', format: 'esm',
    tsconfig: 'tsconfig.app.json', logLevel: 'silent',
    define: {
      'import.meta.env.VITE_COMMUNITY_ENABLED': JSON.stringify(enabled),
      'import.meta.env.BASE_URL': JSON.stringify(base),
    },
    plugins: [{
      name: 'synthetic-supabase-no-network',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /(?:^|\/)supabase(?:\.ts)?$/ }, () => ({ path: 'synthetic-supabase', namespace: 'community-test' }));
        pluginBuild.onLoad({ filter: /.*/, namespace: 'community-test' }, () => ({
          contents: `export const supabase = { rpc(name, args) {
            const fixture = globalThis.${fixtureKey};
            fixture.calls.push({ name, args });
            return { abortSignal(signal) {
              fixture.signals.push(signal);
              if (signal.aborted) return Promise.resolve({ data: null, error: { code: 'ABORT_ERR', message: 'synthetic cancelled request' } });
              if (fixture.reply === null) throw new Error('Missing synthetic RPC response');
              return Promise.resolve(fixture.reply);
            } };
          } };`,
          loader: 'js',
        }));
      },
    }],
  });
  return import(pathToFileURL(outputFile).href);
}

try {
  const api = await loadContracts('/', 'true', 'enabled-root');
  const off = await loadContracts('/Q-pro/', 'false', 'disabled-subpath');
  const respond = data => { fixture.reply = { data, error: null }; };
  const malformed = operation => { assert.throws(operation, error => error instanceof api.CommunityError && error.issue === 'unavailable'); assertions++; };
  const rejected = async (operation, issue = 'unavailable') => {
    await assert.rejects(operation, error => error instanceof api.CommunityError && error.issue === issue);
    assertions++;
  };
  const rawProfile = {
    role: 'specialist', specialty: 'Cardiology', verified: true, suspended: false,
    country_code: 'RO', map_consent: true,
  };
  const rawComment = { id: uuid(1), specialty: 'Cardiology', body: 'Synthetic specialist career perspective.', language: 'en' };

  eq(api.COMMUNITY_FEATURE_ENABLED, true, 'Only the explicit build flag opens community UI');
  eq(off.COMMUNITY_FEATURE_ENABLED, false, 'Disabled builds keep community UI off');
  eq(api.parseCommunityProfile(null), null, 'Missing member profile is not an implied membership');
  eq(api.parseCommunityProfile({ ...rawProfile, email: 'private@example.invalid', author_id: uuid(9), can_edit: true, role_claim: 'professor' }), rawProfile, 'Profile parser exposes only explicit fields, never grants');
  for (const value of [undefined, false, [], 'member', {}, { ...rawProfile, role: 'professor' }, { ...rawProfile, role: 'doctor' }, { ...rawProfile, country_code: 'ZZ' }, { ...rawProfile, country_code: 'ro' }, { ...rawProfile, verified: 'true' }, { ...rawProfile, suspended: 0 }, { ...rawProfile, map_consent: 'false' }, { ...rawProfile, specialty: {} }, { ...rawProfile, specialty: 'x'.repeat(201) }]) malformed(() => api.parseCommunityProfile(value));
  for (const role of ['student', 'curious', 'specialist']) {
    eq(api.parseCommunityProfile({ ...rawProfile, role, specialty: null, country_code: null, map_consent: false }).role, role);
  }

  eq(api.parseCommunityMap({ enabled: false, countries: [] }), { enabled: false, countries: [] });
  eq(api.parseCommunityMap({ enabled: true, countries: [{ country_code: 'RO', count: 10, members: [uuid(9)] }], exact_total: 11 }), { enabled: true, countries: [{ country_code: 'RO', count: 10 }] }, 'Map projects only suppressed, rounded country aggregates');
  for (const value of [null, [], {}, { enabled: 'true', countries: [] }, { enabled: true, countries: {} }, { enabled: false, countries: [{ country_code: 'RO', count: 10 }] }, { enabled: true, countries: [{ country_code: 'ZZ', count: 10 }] }, { enabled: true, countries: [{ country_code: 'RO', count: 10 }, { country_code: 'RO', count: 15 }] }, { enabled: true, countries: Array.from({ length: 251 }, () => ({ country_code: 'RO', count: 10 })) }]) malformed(() => api.parseCommunityMap(value));
  for (const count of [-10, 0, 5, 9, 11, 10.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '10', true, null]) malformed(() => api.parseCommunityMap({ enabled: true, countries: [{ country_code: 'RO', count }] }));

  respond([{ ...rawComment, author_id: uuid(7), email: 'private@example.invalid', country_code: 'RO', status: 'approved', metadata: { role: 'doctor' } }]);
  eq(await api.communityApi.listComments(), { items: [rawComment], next: null }, 'Feed never passes author identifiers, email, country, status or metadata to UI');
  eq(fixture.calls.at(-1), { name: 'community_list_comments', args: { p_after: null, p_limit: 20, p_specialty: null } });
  const twenty = Array.from({ length: 20 }, (_, index) => ({ ...rawComment, id: uuid(index + 1) }));
  respond(twenty);
  eq(await api.communityApi.listComments({ after: uuid(9), specialty: 'Cardiology' }), { items: twenty, next: uuid(20) }, 'Full pages return a keyset cursor, not an offset');
  eq(fixture.calls.at(-1).args, { p_after: uuid(9), p_limit: 20, p_specialty: 'Cardiology' });
  respond([]);
  eq(await api.communityApi.listComments(), { items: [], next: null });
  for (const value of [null, {}, { items: [] }, [...twenty, rawComment], [null], [{ ...rawComment, id: 'not-a-uuid' }], [{ ...rawComment, language: 'de' }], [{ ...rawComment, body: 'x'.repeat(2001) }], [{ ...rawComment, body: { html: 'unsafe' } }], [{ ...rawComment, specialty: [] }]]) {
    respond(value); await rejected(() => api.communityApi.listComments());
  }
  for (const status of ['pending', 'approved', 'rejected', 'withdrawn']) {
    respond([{ ...rawComment, status, email: 'owner@example.invalid', author_id: uuid(9) }]);
    eq(await api.communityApi.myComments(), [{ ...rawComment, status }]);
  }
  respond([{ ...rawComment, status: 'published' }]); await rejected(() => api.communityApi.myComments());
  respond(Array.from({ length: 101 }, () => ({ ...rawComment, status: 'pending' }))); await rejected(() => api.communityApi.myComments());

  const member = { id: uuid(2), email: 'synthetic@example.invalid', role: 'specialist', specialty: 'Cardiology', verified: false, suspended: false };
  respond([{ ...member, raw_user_meta_data: { role: 'professor' }, research: 'must not escape' }]);
  eq(await api.communityApi.adminMembers(), { items: [member], next: null });
  const moderationComment = { ...rawComment, status: 'pending', author_id: uuid(2), email: member.email, verified: false, report_count: 2 };
  respond([{ ...moderationComment, patient: 'must not escape', report_reasons: [] }]);
  eq(await api.communityApi.adminComments(), { items: [moderationComment], next: null });
  for (const count of [-1, 1.1, '1', Number.MAX_SAFE_INTEGER + 1]) {
    respond([{ ...moderationComment, report_count: count }]); await rejected(() => api.communityApi.adminComments());
  }

  for (const [code, issue] of [['42501', 'access'], ['PGRST301', 'access'], ['PGRST202', 'setup'], ['22023', 'invalid'], ['P0429', 'limit'], ['PT429', 'limit'], ['54000', 'limit'], ['XX000', 'unavailable']]) {
    fixture.reply = { data: null, error: { code, message: 'PRIVATE provider detail email@example.invalid' } };
    await assert.rejects(() => api.communityApi.profile(), error => error instanceof api.CommunityError && error.issue === issue && error.message === `community:${issue}`);
    assertions++;
  }
  const controller = new AbortController(); controller.abort(); respond(rawProfile);
  await rejected(() => api.communityApi.profile(controller.signal));
  ok(fixture.signals.at(-1).aborted, 'Cancelled reads pass cancellation to the mocked RPC');
  ok(fixture.timeouts.length > 0 && fixture.timeouts.every(delay => delay === 12_000), 'Community requests have a finite timeout');

  for (const lang of ['en', 'fr', 'ro']) {
    const admin = api.parsePortalProfile({ authorized: true, role: 'professor', can_edit: true, can_publish: true });
    const doctor = api.parsePortalProfile({ authorized: true, role: 'doctor', can_edit: true, can_publish: false });
    const researcher = api.parsePortalProfile({ authorized: true, role: 'researcher', can_edit: true, can_publish: true });
    const readonly = api.parsePortalProfile({ authorized: true, role: 'doctor', can_edit: false });
    const nav = (profile, feature = true) => api.getDashboardNavItems(profile?.can_edit ?? false, lang, api.isProfessorWorkspace(profile), feature).map(item => item.id);
    ok(nav(admin).includes('community'), `${lang}: administrator can navigate to moderation`);
    ok(nav(doctor).includes('community'), `${lang}: authorized editing doctor can navigate to moderation`);
    ok(!nav(researcher).includes('community'), `${lang}: research-only profile cannot gain moderation from inconsistent flags`);
    ok(!nav(readonly).includes('community'), `${lang}: read-only doctor cannot moderate`);
    ok(!nav(admin, false).includes('community'), `${lang}: build gate hides moderation`);
    eq(researcher.can_edit, false);
    eq(researcher.can_publish, false);
    eq(api.parsePortalProfile({ user_metadata: { role: 'professor', can_edit: true, authorized: true } }), null, 'User-editable claims do not grant portal access');
    eq(api.parsePortalProfile({ authorized: false, role: 'professor', can_edit: true }), null);
    eq(api.parsePortalProfile({ authorized: true, role: 'student', can_edit: true }), null);
  }
  // These are presentation guards only. The pgTAP/browser suites separately
  // verify server authorization; rendering a nav item never creates a grant.
  eq(api.normalizeAppLocation({ phase: 'account', user_id: uuid(9), role: 'professor' }), { phase: 'account' });
  eq(api.normalizeAppLocation({ phase: 'community', auth: true }), { phase: 'community' });
  eq(api.normalizeAppLocation({ phase: 'community-admin' }), { phase: 'role' });
  const navigation = api.createAppNavigationReducer();
  const quiz = api.createAppNavigationState({ phase: 'quiz', stepIndex: 3 });
  const account = navigation(quiz, api.navigateTo({ phase: 'account' }));
  eq(api.getCurrentAppLocation(navigation(account, api.navigateBack())), { phase: 'quiz', stepIndex: 3 }, 'Account navigation preserves the in-memory previous questionnaire step');

  eq(api.communityAccountRedirect(), 'https://medcompass-web.com/?community=account');
  eq(api.communityAccountRedirect(true), 'https://medcompass-web.com/?community=account&recovery=1');
  eq(off.communityAccountRedirect(), 'https://medcompass-web.com/Q-pro/?community=account');
  eq(off.communityAccountRedirect(true), 'https://medcompass-web.com/Q-pro/?community=account&recovery=1');
  ok(!api.communityAccountRedirect(true).includes('attacker'), 'Redirect ignores untrusted returnTo/query input');
  ok(!api.communityAccountRedirect(true).includes('access_token'), 'Redirect never copies token fragments');
  eq(networkAttempts, 0, 'No network request was attempted');
  console.log(`Community contracts: ${assertions} assertions passed; all RPCs synthetic, no network or live data.`);
} finally {
  if (previousFixture === undefined) delete globalThis[fixtureKey]; else globalThis[fixtureKey] = previousFixture;
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
  const target = resolve(directory);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('medcompass-community-contracts-')) throw new Error('Unexpected community-test temporary path');
  await rm(target, { recursive: true, force: true });
}
