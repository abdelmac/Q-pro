import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'q-pro-map-tests-'));
const outputFile = join(temporaryDirectory, 'map-tests.mjs');
try {
  await build({
    stdin: {
      contents: `export * from './src/lib/participationMap'; export * from './src/data/geography'; export * from './src/data/mapI18n'; export { canUseMapFilters } from './src/lib/useMapFilterAccess';`,
      resolveDir: process.cwd(), loader: 'ts',
    },
    outfile: outputFile, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
    plugins: [{
      name: 'read-only-map-client-fixture',
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'map-client-fixture', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
          export const supabase = { rpc(name,args) {
            globalThis.__mapRpcCalls.push({name,args});
            const promise = Promise.resolve({ data:globalThis.__mapRpcFixture,error:globalThis.__mapRpcError ?? null,status:globalThis.__mapRpcStatus ?? 200 });
            promise.abortSignal=()=>promise;
            return promise;
          }};
        ` }));
      },
    }],
  });
  const module = await import(pathToFileURL(outputFile).href);
  const {
    parseParticipationMapStats, mapRpcArguments, fetchParticipationMapStats, DEFAULT_MAP_FILTERS,
    areValidMapDates, latestClosedMonth, COUNTRIES, countryOptions, normalizeGeography, MAP_TRANSLATIONS,
    canUseMapFilters, MapFilterAccessError,
  } = module;
  const fixture = {
    total: 45, countries: 2, students: 20, specialists: 15, nonMedical: 10,
    groups: [
      { countryCode: 'RO', country: 'Romania', count: 35, students: 20, specialists: 15, nonMedical: 0 },
      { countryCode: 'FR', country: 'France', count: 10, students: 0, specialists: 0, nonMedical: 10 },
    ],
    privacyThreshold: 10, rounding: 5, granularity: 'month', publishedThrough: '2026-08-31',
  };
  assert.deepEqual(parseParticipationMapStats(fixture), fixture);
  assert.deepEqual(parseParticipationMapStats({ ...fixture, submissionId: 'must-not-be-exposed' }), fixture);
  const empty = { ...fixture, total: 0, countries: 0, students: 0, specialists: 0, nonMedical: 0, groups: [], publishedThrough: null };
  assert.deepEqual(parseParticipationMapStats(empty), empty);
  for (const changed of [
    { total: 50 }, { students: 25 }, { countries: 3 }, { privacyThreshold: 1 }, { rounding: 1 },
    { granularity: 'day' }, { publishedThrough: 'invalid' }, { publishedThrough: '2026-02-31' }, { publishedThrough: null }, { total: -5 }, { total: 45.5 },
    { groups: [...fixture.groups, fixture.groups[0]] },
    { groups: [{ ...fixture.groups[0], count: 5 }] },
    { groups: [{ ...fixture.groups[0], students: 21 }] },
    { groups: [{ ...fixture.groups[0], countryCode: 'ZZ' }] },
  ]) assert.throws(() => parseParticipationMapStats({ ...fixture, ...changed }));

  globalThis.__mapRpcFixture = fixture;
  globalThis.__mapRpcCalls = [];
  for (const respondentType of ['all', 'student', 'specialist', 'non_medical']) {
    const filters = { ...DEFAULT_MAP_FILTERS, respondentType, countryCode: 'RO', language: 'ro', monthFrom: '2025-01', monthTo: '2025-03', dataVersion: 'current' };
    const expectedArgs = { p_respondent_type: respondentType, p_country_code: 'RO', p_language: 'ro', p_month_from: '2025-01-01', p_month_to: '2025-03-01', p_data_version: 'current' };
    assert.deepEqual(mapRpcArguments(filters), expectedArgs);
    assert.deepEqual(await fetchParticipationMapStats(filters, new AbortController().signal, 'private'), fixture);
    assert.deepEqual(globalThis.__mapRpcCalls.at(-1), { name: 'get_private_participation_map_stats', args: expectedArgs });
  }
  assert.equal(globalThis.__mapRpcCalls.length, 4, 'Only aggregate RPC calls are made');
  globalThis.__mapRpcError = { code: '42501', message: 'Administrator access required for map filters' };
  await assert.rejects(() => fetchParticipationMapStats({ ...DEFAULT_MAP_FILTERS, countryCode: 'RO' }, undefined, 'private'), MapFilterAccessError,
    'A denied filtered RPC must not return stale aggregates or silently compute a client-side subset');
  for (const status of [401, 403]) {
    globalThis.__mapRpcError = { message: 'Denied' };
    globalThis.__mapRpcStatus = status;
    await assert.rejects(() => fetchParticipationMapStats({ ...DEFAULT_MAP_FILTERS, countryCode: 'RO' }, undefined, 'private'), MapFilterAccessError);
  }
  globalThis.__mapRpcError = null;
  globalThis.__mapRpcStatus = 200;
  assert.deepEqual(await fetchParticipationMapStats(DEFAULT_MAP_FILTERS), fixture, 'The public unfiltered aggregate uses its visibility-gated endpoint');
  assert.equal(globalThis.__mapRpcCalls.at(-1).name, 'get_participation_map_stats');
  const publicCalls = globalThis.__mapRpcCalls.length;
  await assert.rejects(() => fetchParticipationMapStats({ ...DEFAULT_MAP_FILTERS, countryCode: 'RO' }), MapFilterAccessError);
  assert.equal(globalThis.__mapRpcCalls.length, publicCalls, 'Public routes must not even request filtered geographic data');
  globalThis.__mapRpcError = { code: '42501', message: 'Public map disabled' };
  await assert.rejects(() => fetchParticipationMapStats(DEFAULT_MAP_FILTERS), MapFilterAccessError, 'Disabled public maps never return stale data');
  globalThis.__mapRpcError = null;
  for (const role of ['researcher', 'doctor', 'professor']) {
    assert.equal(canUseMapFilters({ authorized: true, role }), true, 'Canonical server profile role grants access');
    assert.equal(canUseMapFilters({ authorized: true, portal_role: role }), true, 'Supported server profile alias grants access');
  }
  for (const profile of [null, undefined, false, [], 'professor', {},
    { authorized: false, portal_role: 'doctor' },
    { authorized: 'true', portal_role: 'professor' },
    { is_researcher: true, portal_role: 'doctor' },
    { authorized: true, role: 'admin' },
    { authorized: true, portal_role: 'admin' },
    { user_metadata: { authorized: true, portal_role: 'professor' } },
    { app_metadata: { authorized: true, portal_role: 'doctor' } },
  ]) assert.equal(canUseMapFilters(profile), false, `Only an affirmative server doctor/professor profile grants filter access: ${JSON.stringify(profile)}`);
  assert.deepEqual(mapRpcArguments(DEFAULT_MAP_FILTERS), { p_respondent_type: 'all', p_country_code: null, p_language: 'all', p_month_from: null, p_month_to: null, p_data_version: 'all' });
  for (const invalid of [{ countryCode: 'ZZ' }, { countryCode: 'ro' }, { respondentType: 'curious' }, { language: 'de' }, { dataVersion: 'private' }]) {
    assert.throws(() => mapRpcArguments({ ...DEFAULT_MAP_FILTERS, ...invalid }));
  }
  assert.equal(latestClosedMonth(new Date('2026-01-15T00:00:00Z')), '2025-12');
  const now = new Date('2026-09-16T00:00:00Z');
  for (const pair of [['2026-08', '2026-08'], ['', ''], ['2025-01', '2026-08']]) assert.equal(areValidMapDates({ monthFrom: pair[0], monthTo: pair[1] }, now), true);
  for (const pair of [['2026-09', ''], ['2026-08', '2026-07'], ['2026-13', ''], ['2026-01-10', '']]) assert.equal(areValidMapDates({ monthFrom: pair[0], monthTo: pair[1] }, now), false);

  assert.equal(COUNTRIES.length, 249);
  assert.equal(new Set(COUNTRIES.map(country => country.code)).size, 249);
  assert.deepEqual(normalizeGeography({ countryCode: '', region: '   ' }), { countryCode: null, region: null });
  assert.deepEqual(normalizeGeography({ countryCode: ' ro ', region: '  Cluj  ' }), { countryCode: 'RO', region: 'Cluj' });
  for (const draft of [{ countryCode: 'ZZ', region: '' }, { countryCode: '', region: 'Bavaria' }, { countryCode: 'DE', region: 'x'.repeat(101) }, { countryCode: 'DE', region: 'Bad\nRegion' }]) assert.throws(() => normalizeGeography(draft));
  for (const language of ['en', 'fr', 'ro']) {
    assert.deepEqual(Object.keys(MAP_TRANSLATIONS[language]).sort(), Object.keys(MAP_TRANSLATIONS.en).sort());
    assert.equal(Object.values(MAP_TRANSLATIONS[language]).every(value => typeof value === 'string' && value.length > 0), true);
    assert.equal(countryOptions(language).length, 249);
    assert.equal(COUNTRIES.every(country => typeof country[language] === 'string' && country[language].length > 0), true);
  }
  assert.equal(COUNTRIES.find(country => country.code === 'RO').ro, 'România');
  assert.equal(COUNTRIES.find(country => country.code === 'DE').fr, 'Allemagne');
  const geometry = JSON.parse(await readFile('src/data/worldMapPaths.json', 'utf8'));
  assert.equal(geometry.paths.length, 176);
  assert.match(geometry.source, /v5\.1\.2/);
  assert.match(geometry.sourceSha256, /^[a-f0-9]{64}$/);
  for (const path of geometry.paths) {
    assert.match(path.d, /^M/);
    assert.equal(/NaN|Infinity|undefined/.test(path.d), false);
    if (path.code !== null) assert.ok(COUNTRIES.some(country => country.code === path.code));
  }

  // Exercise the real visibility helper with an entirely synthetic client and configuration.
  const featureOutput = join(temporaryDirectory, 'public-feature-tests.mjs');
  await build({
    stdin: {
      contents: `export { fetchPublicFeatures, PublicFeaturesError } from './src/lib/supabase';`,
      resolveDir: process.cwd(), loader: 'ts',
    },
    outfile: featureOutput, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
    define: { 'import.meta.env': 'globalThis.__publicFeaturesEnv' },
    plugins: [{
      name: 'synthetic-public-feature-client',
      setup(builder) {
        builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'feature-client', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
          export const createClient = () => ({ rpc(name) {
            globalThis.__publicFeaturesCalls.push(name);
            const promise = Promise.resolve(globalThis.__publicFeaturesResponse);
            promise.abortSignal = signal => { globalThis.__publicFeaturesSignal = signal; return promise; };
            return promise;
          }});
        ` }));
      },
    }],
  });
  globalThis.__publicFeaturesEnv = {};
  globalThis.__publicFeaturesCalls = [];
  const unconfigured = await import(`${pathToFileURL(featureOutput).href}?unconfigured`);
  await assert.rejects(() => unconfigured.fetchPublicFeatures(), error =>
    error instanceof unconfigured.PublicFeaturesError && error.issue === 'unavailable',
  'Missing configuration must not be reported as a confirmed disabled map');
  assert.equal(globalThis.__publicFeaturesCalls.length, 0);

  globalThis.__publicFeaturesEnv = { VITE_SUPABASE_URL: 'https://synthetic.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-only' };
  const { fetchPublicFeatures, PublicFeaturesError } = await import(`${pathToFileURL(featureOutput).href}?configured`);
  for (const enabled of [true, false]) {
    globalThis.__publicFeaturesResponse = { data: { public_map_enabled: enabled, unrelated: 'not exposed' }, error: null };
    assert.deepEqual(await fetchPublicFeatures(), { public_map_enabled: enabled });
  }
  const visibilitySignal = new AbortController().signal;
  await fetchPublicFeatures(visibilitySignal);
  assert.equal(globalThis.__publicFeaturesSignal, visibilitySignal);
  for (const data of [undefined, null, [], true, 1, 'false', {}, { public_map_enabled: 'true' }, { public_map_enabled: 1 }, { public_map_enabled: null }]) {
    globalThis.__publicFeaturesResponse = { data, error: null };
    await assert.rejects(() => fetchPublicFeatures(), error => error instanceof PublicFeaturesError && error.issue === 'unavailable',
      'Malformed settings must remain unavailable rather than becoming a confirmed disabled map');
  }
  for (const [code, issue] of [['PGRST202', 'setup-required'], ['42501', 'unavailable'], ['unexpected', 'unavailable']]) {
    globalThis.__publicFeaturesResponse = { data: { public_map_enabled: true }, error: { code, message: 'private server detail' } };
    await assert.rejects(() => fetchPublicFeatures(), error =>
      error instanceof PublicFeaturesError && error.issue === issue && !error.message.includes('private server detail'));
  }
  assert.ok(globalThis.__publicFeaturesCalls.every(name => name === 'get_public_features'), 'Visibility checks use only the public read RPC');
  console.log('Participation map checks passed: aggregate-only RPC, strict visibility readiness, privacy/count contract, administrator roles and access errors, filters, geography, localization and geometry.');
} finally {
  const resolvedDirectory = resolve(temporaryDirectory);
  if (!resolvedDirectory.startsWith(resolve(tmpdir()) + sep) || !resolvedDirectory.includes('q-pro-map-tests-')) throw new Error('Unexpected test temporary directory');
  await rm(resolvedDirectory, { recursive: true, force: true });
  delete globalThis.__mapRpcFixture;
  delete globalThis.__mapRpcCalls;
  delete globalThis.__mapRpcError;
  delete globalThis.__mapRpcStatus;
  delete globalThis.__publicFeaturesEnv;
  delete globalThis.__publicFeaturesCalls;
  delete globalThis.__publicFeaturesResponse;
  delete globalThis.__publicFeaturesSignal;
}
