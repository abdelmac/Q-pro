import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Non-mutating checks only: reads of public aggregates and deliberately invalid
// submissions (null ID plus invalid country) that cannot write research records.
const localEnv = {};
try {
  for (const raw of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/u)) {
    const match = raw.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/u);
    if (match) localEnv[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || localEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
assert(url && key, 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
const headers = { apikey: key, 'Content-Type': 'application/json' };
const countries = new Set(JSON.parse(readFileSync(new URL('../src/data/countries.json', import.meta.url), 'utf8')).map(country => country.code));

async function rpc(name, payload) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, value: await response.json() };
}
function validateMap(map) {
  assert.equal(map.privacyThreshold, 10);
  assert.equal(map.rounding, 5);
  assert.equal(map.granularity, 'month');
  assert(map.publishedThrough === null || /^\d{4}-\d{2}-\d{2}$/u.test(map.publishedThrough));
  assert(Array.isArray(map.groups));
  assert.equal(map.countries, map.groups.length);
  const count = value => assert(Number.isSafeInteger(value) && (value === 0 || (value >= 10 && value % 5 === 0)));
  const seen = new Set();
  for (const group of map.groups) {
    assert(countries.has(group.countryCode));
    assert(!seen.has(group.countryCode));
    seen.add(group.countryCode);
    for (const field of ['count', 'students', 'specialists', 'nonMedical']) count(group[field]);
    assert.equal(group.count, group.students + group.specialists + group.nonMedical);
    assert.deepEqual(Object.keys(group).sort(), ['count', 'country', 'countryCode', 'nonMedical', 'specialists', 'students'].sort());
  }
  for (const [summary, group] of [['total', 'count'], ['students', 'students'], ['specialists', 'specialists'], ['nonMedical', 'nonMedical']]) {
    count(map[summary]);
    assert.equal(map[summary], map.groups.reduce((sum, row) => sum + row[group], 0));
  }
}
for (const payload of [{}, {
  p_respondent_type: 'all', p_country_code: null, p_language: 'all',
  p_month_from: null, p_month_to: null, p_data_version: 'all',
}]) {
  const { status, value } = await rpc('get_participation_map_stats', payload);
  assert.equal(status, 200, 'Unfiltered public map RPC must resolve');
  validateMap(value);
}
for (const payload of [
  { p_respondent_type: 'student' },
  { p_respondent_type: 'specialist' },
  { p_respondent_type: 'non_medical' },
  { p_country_code: 'RO' },
  { p_language: 'en' },
  { p_month_from: '2001-01-01' },
  { p_month_to: '2001-01-01' },
  { p_data_version: 'current' },
  { p_country_code: 'ZZ' },
  { p_month_from: '2001-01-02' },
  { p_language: 'unknown' },
  { p_data_version: 'unknown' },
]) {
  const { status, value } = await rpc('get_participation_map_stats', payload);
  assert([401, 403].includes(status), 'Anonymous map filtering must be denied');
  assert.equal(value.code, '42501');
}
for (const table of ['student_responses', 'specialist_responses']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=id,country_code,region&limit=1`, {
    headers, signal: AbortSignal.timeout(20_000),
  });
  assert([401, 403].includes(response.status), `${table} must not be publicly readable`);
}
const common = {
  p_submission_id: null,
  p_ratings: {}, p_selected_values: [], p_language: 'en',
  p_questionnaire_version: 'q81-v1', p_value_catalog_version: 'career-values-v1',
  p_specialty_catalog_version: 'medical-specialties-v1',
  p_specialty_config_version_id: null,
  p_consent_version: 'research-consent-2026-09-16-geography',
  p_country_code: 'ZZ', p_region: null,
};
const invalid = [
  ['submit_student_response_v6', {
    ...common, p_participant_role: 'student', p_medicine_view: null, p_study_year: null,
    p_preferred_specialty: null, p_client_scores: [], p_scoring_version: 'client-scoring-v2',
    p_participant_reflection_version: 'medicine-view-optional-v2',
  }],
  ['submit_specialist_response_v5', {
    ...common, p_actual_specialty: 'Cardiology', p_questionnaire_completed: false,
    p_current_specialty_view: '', p_specialty_changes_over_years: '',
    p_most_important_specialty_quality: '', p_would_choose_again_code: 'yes',
    p_would_not_choose_again_reason: null, p_student_self_question: '',
    p_calibration_version: 'calibration-v2-qualitative',
  }],
];
for (const [name, payload] of invalid) {
  const { status, value } = await rpc(name, payload);
  assert.equal(status, 400, `${name} must resolve and reject invalid geography`);
  assert.equal(value.code, '22023');
  assert.equal(value.message, 'Invalid voluntary geography');
}
console.log('Participation map runtime: public unfiltered aggregates, anonymous filters denied, private-row protection and both versioned geography RPCs passed. No records created.');
