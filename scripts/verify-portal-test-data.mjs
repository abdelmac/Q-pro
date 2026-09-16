import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputFile = join(tmpdir(), `qpro-portal-test-data-${process.pid}.mjs`);
try {
  await build({
    stdin: {
      contents: `
        export * from './src/lib/portalTestData';
        export * from './src/lib/portalTestDashboard';
        export { SPECIALTIES } from './src/data/specialties';
        export { ALL_QUESTION_IDS } from './src/data/questions';
        export { VALUE_OPTIONS } from './src/data/traits';
        export { DATA_VERSIONS } from './src/lib/researchVersions';
        export { assessSpecialistEligibility, assessStudentEligibility, isSpecialistCalibrationComplete, studentRawCsv } from './src/lib/researchDashboard';
        export { calculateTraits, rankSpecialties } from './src/lib/scoring';
        export { DEFAULT_MAP_FILTERS, parseParticipationMapStats } from './src/lib/participationMap';
      `,
      resolveDir: process.cwd(), loader: 'ts',
    },
    outfile: outputFile, bundle: true, platform: 'node', format: 'esm',
    tsconfig: 'tsconfig.app.json', logLevel: 'silent',
    plugins: [{
      name: 'no-database-writes-in-synthetic-generator-tests',
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'no-database', namespace: 'test' }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
          export const supabase = new Proxy({}, { get() { throw new Error('Synthetic generation must not access Supabase.'); } });
          export const getSupabaseConfigurationError = () => null;
        ` }));
      },
    }],
  });
  const api = await import(`${pathToFileURL(outputFile).href}?run=${Date.now()}`);
  const raw = {
    id: '730cd8e3-086a-43f8-91c4-c5843f7b5d60', seed: 317_029,
    created_at: '2026-09-16T12:23:48.123456+00:00', generator_version: 'portal-test-v1',
    catalog: {
      version: { id: 'c6811020-357c-47cc-b66e-ae6874db9f09', revision: 7, label: 'Published test fixture', content_hash: `md5:${'a'.repeat(32)}`, published_at: '2026-09-15T10:00:00.000Z' },
      specialties: api.SPECIALTIES.map(specialty => ({
        name: specialty.name, category: specialty.category, profile: specialty.profile,
        descriptions: { en: specialty.blurb, fr: specialty.blurb, ro: specialty.blurb },
        clinical_summaries: { en: specialty.blurb, fr: specialty.blurb, ro: specialty.blurb },
      })),
    },
  };
  const recipe = api.parsePortalTestDatasetRecipe(raw);
  const dataset = api.generatePortalTestDataset(recipe);
  assert.deepEqual(dataset, api.generatePortalTestDataset(api.parsePortalTestDatasetRecipe(JSON.parse(JSON.stringify(raw)))), 'the same frozen recipe survives reload exactly');
  const other = api.generatePortalTestDataset(api.parsePortalTestDatasetRecipe({ ...raw, seed: raw.seed + 1 }));
  assert.notDeepEqual(dataset.specialists[0].ratings, other.specialists[0].ratings, 'different seeds generate different ratings');
  const alteredCatalog = JSON.parse(JSON.stringify(raw));
  alteredCatalog.catalog.version.content_hash = `md5:${'b'.repeat(32)}`;
  alteredCatalog.catalog.version.revision = 8;
  for (const specialty of alteredCatalog.catalog.specialties) {
    specialty.profile = Object.fromEntries(Object.entries(specialty.profile).map(([trait, pair]) => [trait, [0, pair[1]]]));
  }
  const altered = api.generatePortalTestDataset(api.parsePortalTestDatasetRecipe(alteredCatalog));
  assert.deepEqual(altered.specialists[0].ratings, dataset.specialists[0].ratings, 'catalog updates do not alter seeded questionnaire answers');
  assert.notDeepEqual(altered.specialists[0].client_scores, dataset.specialists[0].client_scores, 'the scoring catalog comes from the recipe, not static or current defaults');
  assert.equal(altered.specialists[0].specialty_config_revision, 8);
  assert.equal(dataset.specialists.length, 5);
  assert.equal(dataset.students.filter(row => row.participant_role === 'student').length, 5);
  assert.equal(dataset.students.filter(row => row.participant_role === 'curious').length, 5);
  const rows = [...dataset.specialists, ...dataset.students];
  assert.equal(new Set(rows.map(row => row.id)).size, 15);
  assert.deepEqual(new Set(rows.map(row => row.language)), new Set(['en', 'fr', 'ro']));
  assert.deepEqual(new Set(rows.map(row => row.country_code)), new Set(['RO', 'FR', 'GB']));
  assert.deepEqual(new Set(rows.map(row => row.created_at.slice(0, 7))), new Set(['2026-06', '2026-07', '2026-08']));
  assert.ok(Object.isFrozen(dataset) && Object.isFrozen(dataset.students[0].ratings));
  for (const row of rows) {
    assert.equal(row.is_test, true);
    assert.equal(row.research_consent, false, 'synthetic data must never claim participant consent');
    assert.equal(row.test_dataset_id, recipe.id);
    assert.match(row.test_label, /TEST/);
    assert.deepEqual(Object.keys(row.ratings).sort(), [...api.ALL_QUESTION_IDS].sort());
    assert.equal(Object.keys(row.ratings).length, 81);
    assert.ok(Object.values(row.ratings).every(value => Number.isInteger(value) && value >= 1 && value <= 10));
    assert.ok(row.selected_values.length >= 1 && row.selected_values.length <= 4);
    assert.equal(new Set(row.selected_values).size, row.selected_values.length);
    assert.ok(row.selected_values.every(value => api.VALUE_OPTIONS.includes(value)));
    assert.equal(row.specialty_config_version_id, recipe.catalog.version.id);
    assert.equal(row.specialty_config_revision, recipe.catalog.revision);
    assert.equal(row.country_name.length > 0, true);
    assert.equal(row.region, null);
    assert.ok(Date.parse(row.created_at) < Date.parse('2026-09-01T00:00:00Z'));
    assert.deepEqual(row.computed_traits, api.calculateTraits(row.ratings, row.selected_values));
    const ranking = api.rankSpecialties({ ratings: row.ratings, selectedValues: row.selected_values, preferredSpecialty: row.preferred_specialty ?? null }, undefined, recipe.catalog.specialties);
    assert.deepEqual(row.client_scores, ranking.map(({ specialty, score }) => ({ specialty: specialty.name, score })), 'scores use exactly the shared engine and frozen catalog');
    assert.equal(row.client_scores.length, api.SPECIALTIES.length);
    assert.ok(row.client_scores.every((score, index) => Number.isFinite(score.score) && score.score >= 0 && score.score <= 100
      && (!index || score.score <= row.client_scores[index - 1].score)));
    for (const key of ['email', 'name', 'user_id', 'patient', 'access_token', 'password']) assert.equal(key in row, false);
  }
  for (const row of dataset.specialists) {
    assert.deepEqual(api.assessSpecialistEligibility(row), { eligible: true, exclusionReasons: [] });
    assert.equal(api.isSpecialistCalibrationComplete(row), true);
    assert.equal(row.questionnaire_completed, true);
    for (const key of ['current_specialty_view', 'specialty_changes_over_years', 'most_important_specialty_quality', 'student_self_question']) assert.match(row[key], /TEST/);
    if (row.would_choose_again_code === 'no') assert.match(row.would_not_choose_again_reason, /TEST/);
    else assert.equal(row.would_not_choose_again_reason, null);
  }
  assert.equal(new Set(dataset.specialists.map(row => row.actual_specialty)).size, 5);
  for (const row of dataset.students) {
    assert.deepEqual(api.assessStudentEligibility(row), { eligible: true, exclusionReasons: [] });
    assert.match(row.medicine_view, /TEST/);
    if (row.participant_role === 'student') assert.ok(Number.isInteger(row.study_year) && row.study_year >= 1 && row.study_year <= 6);
    else assert.equal(row.study_year, null);
  }

  const stats = api.buildTestParticipationMapStats(dataset, api.DEFAULT_MAP_FILTERS);
  assert.equal(stats.total, 15);
  assert.equal(stats.countries, 3);
  assert.equal(stats.students, 5);
  assert.equal(stats.specialists, 5);
  assert.equal(stats.nonMedical, 5);
  assert.equal(stats.publishedThrough, '2026-08-31');
  for (const name of ['privacyThreshold', 'rounding', 'granularity']) assert.equal(name in stats, false, 'synthetic counts must not claim production privacy guarantees');
  assert.throws(() => api.parseParticipationMapStats(stats), /Unsupported map privacy protocol/, 'synthetic results cannot masquerade as the public map protocol');
  assert.deepEqual(api.buildTestParticipationMapStats(dataset, { ...api.DEFAULT_MAP_FILTERS, dataVersion: 'current' }), stats);
  for (const respondentType of ['student', 'specialist', 'non_medical']) {
    const selected = api.buildTestParticipationMapStats(dataset, { ...api.DEFAULT_MAP_FILTERS, respondentType });
    assert.equal(selected.total, 5, 'small synthetic groups remain exact and visible');
  }
  const one = rows[0];
  const combined = { ...api.DEFAULT_MAP_FILTERS, respondentType: 'specialist', countryCode: one.country_code, language: one.language, monthFrom: one.created_at.slice(0, 7), monthTo: one.created_at.slice(0, 7) };
  const expected = dataset.specialists.filter(row => row.country_code === one.country_code && row.language === one.language && row.created_at.slice(0, 7) === one.created_at.slice(0, 7)).length;
  assert.equal(api.buildTestParticipationMapStats(dataset, combined).total, expected);
  assert.ok(expected > 0 && expected < 10);
  assert.equal(api.buildTestParticipationMapStats(dataset, { ...api.DEFAULT_MAP_FILTERS, countryCode: 'DE' }).total, 0);
  assert.equal(api.buildTestParticipationMapStats(dataset, { ...api.DEFAULT_MAP_FILTERS, monthFrom: '2027-01' }).total, 0, 'filters are pure and do not depend on the current clock');
  assert.throws(() => api.buildTestParticipationMapStats(dataset, { ...api.DEFAULT_MAP_FILTERS, monthFrom: '2026-09', monthTo: '2026-08' }));
  assert.throws(() => api.buildTestParticipationMapStats({ ...dataset, specialists: [{ ...dataset.specialists[0], is_test: false }] }, api.DEFAULT_MAP_FILTERS), /Real research rows/);
  const obsolete = { ...dataset, students: dataset.students.map(row => ({ ...row, scoring_version: 'other' })) };
  assert.equal(api.buildTestParticipationMapStats(obsolete, { ...api.DEFAULT_MAP_FILTERS, dataVersion: 'current' }).total, 5);
  for (const patch of [{ seed: 0 }, { seed: 2_147_483_648 }, { seed: 1.5 }, { generator_version: 'future' }, { id: 'not-a-uuid' }, { created_at: '2026-02-31T12:00:00Z' }]) {
    assert.throws(() => api.parsePortalTestDatasetRecipe({ ...raw, ...patch }));
  }
  assert.throws(() => api.parsePortalTestDatasetRecipe({ ...raw, catalog: { ...raw.catalog, specialties: raw.catalog.specialties.slice(1) } }));
  assert.throws(() => api.parsePortalTestDatasetRecipe({ ...raw, catalog: { ...raw.catalog, version: { ...raw.catalog.version, content_hash: 'static-fallback' } } }));
  assert.throws(() => api.parsePortalTestDatasetRecipe({ ...raw, created_at: '2026-01-01T00:00:00Z' }), /not published/);
  const january = { ...raw, created_at: '2027-01-05T00:00:00Z' };
  const januaryData = api.generatePortalTestDataset(api.parsePortalTestDatasetRecipe(january));
  assert.deepEqual(new Set([...januaryData.specialists, ...januaryData.students].map(row => row.created_at.slice(0, 7))), new Set(['2026-10', '2026-11', '2026-12']));
  assert.equal(api.buildTestParticipationMapStats(januaryData, api.DEFAULT_MAP_FILTERS).publishedThrough, '2026-12-31');

  const dashboardFilters = {
    specialty: 'all', questionnaire: 'all', completeness: 'all', chooseAgain: 'all', language: 'all',
    dataVersion: 'all', participantRole: 'all', year: 'all', preferredSpecialty: 'all', dateFrom: '', dateTo: '',
  };
  const originalStudents = JSON.stringify(dataset.students);
  const originalSpecialists = JSON.stringify(dataset.specialists);
  const ids = items => items.map(row => row.id).sort();
  const medicalStudents = api.filterTestStudents(dataset.students, { ...dashboardFilters, participantRole: 'student' });
  const explorers = api.filterTestStudents(dataset.students, { ...dashboardFilters, participantRole: 'curious' });
  assert.equal(medicalStudents.length, 5);
  assert.equal(explorers.length, 5);
  assert.ok(medicalStudents.every(row => row.participant_role === 'student'));
  assert.ok(explorers.every(row => row.participant_role === 'curious' && row.study_year === null));
  const targetStudent = dataset.students[0];
  assert.deepEqual(ids(api.filterTestStudents(dataset.students, { ...dashboardFilters, year: String(targetStudent.study_year) })), [targetStudent.id]);
  assert.equal(api.filterTestStudents(dataset.students, { ...dashboardFilters, participantRole: 'curious', year: String(targetStudent.study_year) }).length, 0, 'explorers cannot match a medical study year');
  assert.deepEqual(ids(api.filterTestStudents(dataset.students, { ...dashboardFilters, preferredSpecialty: targetStudent.preferred_specialty })), [targetStudent.id]);
  assert.equal(api.filterTestStudents(dataset.students, { ...dashboardFilters, language: 'en' }).length, 4);
  assert.equal(api.filterTestStudents(dataset.students, { ...dashboardFilters, dataVersion: 'current' }).length, 10);
  assert.equal(api.filterTestStudents(dataset.students, { ...dashboardFilters, dataVersion: 'legacy' }).length, 0);
  const historicStudent = { ...targetStudent, id: 'historic-student', submission_schema_version: 4, consent_version: api.DATA_VERSIONS.optionalReflectionConsent };
  const incompatibleStudent = { ...targetStudent, id: 'incompatible-student', scoring_version: 'future-engine' };
  const mixedStudents = Object.freeze([targetStudent, Object.freeze(historicStudent), Object.freeze(incompatibleStudent)]);
  assert.deepEqual(ids(api.filterTestStudents(mixedStudents, { ...dashboardFilters, dataVersion: 'current' })), [targetStudent.id]);
  assert.deepEqual(ids(api.filterTestStudents(mixedStudents, { ...dashboardFilters, dataVersion: 'legacy' })), [historicStudent.id]);
  assert.equal(api.filterTestStudents(mixedStudents, dashboardFilters).length, 3);

  assert.equal(api.filterTestSpecialists(dataset.specialists, { ...dashboardFilters, questionnaire: 'completed', completeness: 'complete', dataVersion: 'current' }).length, 5);
  assert.equal(api.filterTestSpecialists(dataset.specialists, { ...dashboardFilters, questionnaire: 'skipped' }).length, 0);
  assert.equal(api.filterTestSpecialists(dataset.specialists, { ...dashboardFilters, completeness: 'partial' }).length, 0);
  assert.equal(api.filterTestSpecialists(dataset.specialists, { ...dashboardFilters, chooseAgain: 'no' }).length, 2);
  const targetSpecialist = dataset.specialists[0];
  assert.deepEqual(ids(api.filterTestSpecialists(dataset.specialists, { ...dashboardFilters, specialty: targetSpecialist.actual_specialty, language: targetSpecialist.language })), [targetSpecialist.id]);
  const skippedSpecialist = { ...targetSpecialist, id: 'skipped-specialist', questionnaire_completed: false, ratings: {}, selected_values: [] };
  const partialSpecialist = { ...targetSpecialist, id: 'partial-specialist', most_important_specialty_quality: null };
  const historicSpecialist = { ...targetSpecialist, id: 'historic-specialist', submission_schema_version: 1, years_of_experience: 5, career_satisfaction: 7, intention_to_change_code: 'no', voluntary_choice_code: 'yes' };
  const incompatibleSpecialist = { ...targetSpecialist, id: 'incompatible-specialist', calibration_version: 'future-calibration' };
  const mixedSpecialists = Object.freeze([targetSpecialist, skippedSpecialist, partialSpecialist, historicSpecialist, incompatibleSpecialist].map(row => Object.freeze(row)));
  assert.deepEqual(ids(api.filterTestSpecialists(mixedSpecialists, { ...dashboardFilters, questionnaire: 'skipped' })), [skippedSpecialist.id]);
  assert.deepEqual(ids(api.filterTestSpecialists(mixedSpecialists, { ...dashboardFilters, completeness: 'partial' })), [partialSpecialist.id]);
  assert.deepEqual(ids(api.filterTestSpecialists(mixedSpecialists, { ...dashboardFilters, dataVersion: 'legacy', completeness: 'complete' })), [historicSpecialist.id]);
  assert.deepEqual(ids(api.filterTestSpecialists(mixedSpecialists, { ...dashboardFilters, dataVersion: 'current' })), [targetSpecialist.id, skippedSpecialist.id, partialSpecialist.id].sort());
  assert.equal(api.hasCompleteTestInterview({ ...historicSpecialist, years_of_experience: null }), false);
  assert.equal(api.hasCompleteTestInterview({ ...targetSpecialist, would_choose_again_code: 'no', would_not_choose_again_reason: null }), false);

  // Dashboard date inputs describe local calendar days, including their full final day.
  const startOfDay = new Date(2026, 6, 15).getTime();
  const startOfNextDay = new Date(2026, 6, 16).getTime();
  const boundaryRows = [
    ['before', startOfDay - 1], ['first', startOfDay], ['last', startOfNextDay - 1], ['after', startOfNextDay],
  ].map(([name, instant]) => ({ id: name, created_at: new Date(instant).toISOString() }));
  for (const [filter, template] of [[api.filterTestStudents, targetStudent], [api.filterTestSpecialists, targetSpecialist]]) {
    const source = Object.freeze(boundaryRows.map(row => Object.freeze({ ...template, ...row })));
    assert.deepEqual(ids(filter(source, { ...dashboardFilters, dateFrom: '2026-07-15', dateTo: '2026-07-15' })), ['first', 'last']);
    assert.deepEqual(ids(filter(source, { ...dashboardFilters, dateFrom: '2026-07-16' })), ['after']);
    assert.deepEqual(ids(filter(source, { ...dashboardFilters, dateTo: '2026-07-14' })), ['before']);
    const ties = Object.freeze(['alpha', 'zeta'].map(id => Object.freeze({ ...template, id, created_at: new Date(startOfDay).toISOString() })));
    assert.deepEqual(filter(ties, dashboardFilters).map(row => row.id), ['zeta', 'alpha'], 'equal dates use deterministic descending ID order');
  }
  assert.equal(JSON.stringify(dataset.students), originalStudents, 'filtering never mutates frozen student data');
  assert.equal(JSON.stringify(dataset.specialists), originalSpecialists, 'filtering never mutates frozen specialist data');
  const detachedResults = api.filterTestStudents(dataset.students, dashboardFilters);
  assert.notEqual(detachedResults, dataset.students);
  detachedResults.pop();
  assert.equal(dataset.students.length, 10, 'callers may paginate filtered arrays without modifying the frozen dataset');

  const sourceCsv = '\uFEFF"id","reflection","safe_formula"\r\n'
    + '"row1","First line, ""quoted""\r\nSecond line","\'=SUM(1,2)"\r\n'
    + '"row2","A comma, stays","\'@SUM(1+2)"\r\n';
  const headerMarker = '"is_test","test_dataset_id","research_consent","test_notice",';
  const rowMarker = `"true","${dataset.id}","false","SYNTHETIC TEST DATA - NOT RESEARCH",`;
  assert.equal(api.markPortalTestCsv(sourceCsv, dataset.id), '\uFEFF' + headerMarker + '"id","reflection","safe_formula"\r\n'
    + rowMarker + '"row1","First line, ""quoted""\r\nSecond line","\'=SUM(1,2)"\r\n'
    + rowMarker + '"row2","A comma, stays","\'@SUM(1+2)"', 'markers prefix logical CSV records and preserve multiline quoted content, commas and escaped quotes');
  const lfCsv = api.markPortalTestCsv(sourceCsv.replace(/\r\n/g, '\n'), dataset.id);
  assert.ok(lfCsv.includes('"First line, ""quoted""\nSecond line"'), 'embedded LF remains part of the same field');
  assert.equal(lfCsv.split(rowMarker).length - 1, 2, 'multiline text does not create phantom test records');
  assert.equal(lfCsv.match(/\uFEFF/g).length, 1, 'the BOM is retained exactly once');
  assert.throws(() => api.markPortalTestCsv(sourceCsv, 'formula,not-an-id'));
  for (const formula of ['=HYPERLINK("https://example.invalid/","label, with comma")\nSecond line', '+2', '-2', '@SUM(1)', '\t=2', '  =2']) {
    const realExport = api.studentRawCsv([{ ...targetStudent, medicine_view: formula }], dataset.catalog.specialties);
    const originalLogicalDataRecord = realExport.slice(realExport.indexOf('\r\n') + 2);
    assert.ok(originalLogicalDataRecord.includes(`"'${formula.replace(/"/g, '""')}"`), 'the research CSV exporter escapes spreadsheet formulas');
    const marked = api.markPortalTestCsv(realExport, dataset.id);
    assert.ok(marked.endsWith(originalLogicalDataRecord), 'adding test markers never unescapes spreadsheet formulas or any original data field');
    assert.equal(marked.split(rowMarker).length - 1, 1);
  }
  console.log('Portal synthetic dataset tests passed: deterministic 5+5+5 rows, full scoring/provenance, synthetic consent markers, filters and exact test-only counts.');
} finally {
  await rm(outputFile, { force: true });
}
