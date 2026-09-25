import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runResearchOperator, validateOperatorConfiguration } from './research-operator.mjs';

const testDirectory = await mkdtemp(join(tmpdir(), 'qpro-operator-synthetic-'));
try {
  const fixtureModule = join(testDirectory, 'definitions.mjs');
  await build({ stdin: { contents: `export { ALL_QUESTION_IDS } from './src/data/questions'; export { SPECIALTIES } from './src/data/specialties'; export { VALUE_OPTIONS } from './src/data/traits'; export { DATA_VERSIONS } from './src/lib/researchVersions';`,
    resolveDir: process.cwd(), loader: 'ts' }, outfile: fixtureModule,
    bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent' });
  const { ALL_QUESTION_IDS, SPECIALTIES, VALUE_OPTIONS, DATA_VERSIONS } = await import(pathToFileURL(fixtureModule).href);
  const tokenFor = role => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ role,
    sub: '00000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic-signature`;
  const environment = { RESEARCH_SUPABASE_URL: 'https://operator-fixture.supabase.co',
    RESEARCH_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_fixture', RESEARCH_ACCESS_TOKEN: tokenFor('authenticated') };
  const common = { created_at: '2026-09-25T12:00:00Z', ratings: Object.fromEntries(ALL_QUESTION_IDS.map(id => [id, 5])),
    selected_values: [VALUE_OPTIONS[0]], questionnaire_version: DATA_VERSIONS.questionnaire,
    value_catalog_version: DATA_VERSIONS.valueCatalog, specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
    consent_version: DATA_VERSIONS.studentConsent, language: 'en', specialty_config_revision: 1,
    country_code: null, scoring_context: null };
  const specialist = { ...common, id: '00000000-0000-4000-8000-000000000011',
    actual_specialty: SPECIALTIES[0].name, questionnaire_completed: true, calibration_version: DATA_VERSIONS.calibration,
    submission_schema_version: DATA_VERSIONS.specialistSubmissionSchema, would_choose_again_code: 'yes',
    current_specialty_view: '=SYNTHETIC_FORMULA()', specialty_changes_over_years: 'Synthetic changed practice',
    most_important_specialty_quality: 'Synthetic patience', student_self_question: 'Synthetic work preferences?',
    would_not_choose_again_reason: null, years_of_experience: null, career_satisfaction: null };
  const student = { ...common, id: '00000000-0000-4000-8000-000000000013', participant_role: 'student',
    submission_schema_version: DATA_VERSIONS.studentSubmissionSchema, scoring_version: DATA_VERSIONS.scoring,
    participant_reflection_version: DATA_VERSIONS.participantReflection, preferred_specialty: null,
    study_year: null, medicine_view: null, client_scores: [] };
  const entries = [
    { respondent_type: 'specialist', response: specialist },
    { respondent_type: 'specialist', response: { ...specialist, id: '00000000-0000-4000-8000-000000000012', questionnaire_completed: false, ratings: {}, selected_values: [] } },
    { respondent_type: 'student', response: student },
    { respondent_type: 'non_medical', response: { ...student, id: '00000000-0000-4000-8000-000000000014', participant_role: 'curious' } },
  ];
  const filters = { questionnaire_version: 'q81-v1' };
  let calls = [];
  const mock = ({ changed = false, denied = false, oversized = false, duplicate = false } = {}) => {
    let snapshots = 0;
    return async (url, request) => {
      const name = new URL(url).pathname.split('/').at(-1);
      const args = JSON.parse(request.body);
      calls.push(name);
      assert.equal(request.headers.apikey, environment.RESEARCH_SUPABASE_PUBLISHABLE_KEY);
      assert.equal(request.headers.Authorization, `Bearer ${environment.RESEARCH_ACCESS_TOKEN}`);
      assert.equal(request.redirect, 'error');
      assert.equal(request.cache, 'no-store');
      assert.deepEqual(args.p_filters, filters);
      if (denied) return new Response('private server error must never be printed', { status: 403 });
      if (name === 'create_research_analysis_run') {
        snapshots++;
        return Response.json({ id: `00000000-0000-4000-8000-00000000000${snapshots}`, status: 'completed',
          snapshot_count: oversized ? 5001 : entries.length, created_at: '2026-09-25T12:05:00Z',
          dataset_checksum: `md5:${(changed && snapshots > 1 ? '2' : '1').repeat(32)}`,
          model_versions: [{ questionnaire_version: 'q81-v1' }], results: { summary: { total: entries.length } } });
      }
      assert.equal(name, 'research_response_page');
      assert.equal(args.p_limit, 100);
      assert.equal(args.p_sort, 'oldest');
      return Response.json({ rows: args.p_cursor ? (duplicate ? entries.slice(0, 2) : entries.slice(2)) : entries.slice(0, 2),
        next_cursor: args.p_cursor ? null : { created_at: entries[1].response.created_at, id: entries[1].response.id, respondent_type: 'specialist' } });
    };
  };

  const result = await runResearchOperator({ filters, environment, fetchImpl: mock(), outputDirectory: join(testDirectory, 'completed') });
  assert.deepEqual(calls, ['create_research_analysis_run', 'research_response_page', 'research_response_page', 'create_research_analysis_run']);
  assert.equal(result.manifest.status, 'completed');
  assert.equal(result.manifest.counts.loaded, 4);
  assert.equal(result.manifest.counts.eligible, 3);
  assert.equal(result.manifest.counts.excluded, 1);
  assert.equal(result.manifest.counts.missing_personalized_settings, 4);
  assert.equal(result.manifest.counts.reasons.questionnaire_skipped, 1);
  assert.match(result.manifest.downloaded_content_checksum, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.manifest.files.length, 12);
  const raw = JSON.parse(await readFile(join(result.outputDirectory, 'responses.json'), 'utf8'));
  assert.deepEqual(raw, entries, 'Raw submitted payload/provenance must be preserved exactly');
  const csv = await readFile(join(result.outputDirectory, 'specialists-wide.csv'), 'utf8');
  assert.ok(csv.includes("'=SYNTHETIC_FORMULA()"), 'Shared CSV serializer neutralizes formula cells');
  const analysis = JSON.parse(await readFile(join(result.outputDirectory, 'analyses.json'), 'utf8'));
  assert.ok(analysis.every(row => row.recorded_scoring_context === null));
  assert.ok(analysis[1].analysis.ranking.length === 0, 'Skipped questionnaires remain excluded');
  const summary = JSON.parse(await readFile(join(result.outputDirectory, 'calibration.json'), 'utf8'));
  assert.equal(summary.summary.total, 2, 'Professional ground truth excludes student/non-medical preferences');
  const evaluation = JSON.parse(await readFile(join(result.outputDirectory, 'evaluation.json'), 'utf8'));
  assert.deepEqual(evaluation.participantWeighted.recall.map(row => row.k), [1, 3, 5, 10]);
  const candidate = structuredClone(SPECIALTIES);
  const trait = Object.keys(candidate[0].profile)[0];
  candidate[0].profile[trait][0] = candidate[0].profile[trait][0] === 0 ? 100 : 0;
  const comparison = await runResearchOperator({ filters, environment, fetchImpl: mock(), candidate,
    outputDirectory: join(testDirectory, 'candidate') });
  assert.notEqual(comparison.manifest.candidate_model_checksum, comparison.manifest.model_checksum);
  assert.equal(JSON.parse(await readFile(join(comparison.outputDirectory, 'candidate-comparison.json'), 'utf8')).production_promotion, false);
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock(), candidate: [{ name: 'unknown', profile: {} }],
    outputDirectory: join(testDirectory, 'invalid-candidate') }), /worker failed/);

  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock({ changed: true }), outputDirectory: join(testDirectory, 'changed') }), /checksum changed/);
  assert.equal(JSON.parse(await readFile(join(testDirectory, 'changed/RUN_STATUS.json'), 'utf8')).status, 'failed');
  await assert.rejects(() => stat(join(testDirectory, 'changed/manifest.json')), /ENOENT/);
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock({ denied: true }), outputDirectory: join(testDirectory, 'denied') }), /HTTP 403/);
  await assert.rejects(() => stat(join(testDirectory, 'denied')), /ENOENT/);
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock({ oversized: true }), outputDirectory: join(testDirectory, 'oversized') }), /oversized/);
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock({ duplicate: true }), outputDirectory: join(testDirectory, 'duplicate') }), /Duplicate/);
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock(), maxExportBytes: 10,
    outputDirectory: join(testDirectory, 'byte-cap') }), /Export exceeded/);
  for (const role of ['service_role', 'anon']) assert.throws(() => validateOperatorConfiguration({ filters,
    outputDirectory: join(testDirectory, role), environment: { ...environment, RESEARCH_ACCESS_TOKEN: tokenFor(role) } }), /privileged tokens/);
  assert.throws(() => validateOperatorConfiguration({ filters, outputDirectory: join(testDirectory, 'secret'),
    environment: { ...environment, RESEARCH_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_refused' } }), /never a service-role/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock(), signal: cancelled.signal,
    outputDirectory: join(testDirectory, 'cancelled') }), /abort/i);
  await assert.rejects(() => runResearchOperator({ filters, environment, requestTimeoutMs: 5,
    fetchImpl: (_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(new Error('synthetic timeout')), { once: true });
    }), outputDirectory: join(testDirectory, 'timeout') }), /timeout/);
  await assert.rejects(() => runResearchOperator({ filters, environment, fetchImpl: mock(),
    outputDirectory: join(process.cwd(), '.private-operator-forbidden') }), /outside the repository/);
  if (process.argv.includes('--benchmark')) {
    const benchmarkRows = Array.from({ length: 1000 }, (_, index) => ({
      ...entries[index % entries.length], response: { ...entries[index % entries.length].response,
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` },
    }));
    const started = performance.now();
    const benchmark = await runResearchOperator({ filters, environment, outputDirectory: join(testDirectory, 'benchmark'),
      fetchImpl: async (url, request) => {
        if (url.endsWith('/create_research_analysis_run')) return Response.json({
          id: '00000000-0000-4000-8000-000000000099', status: 'completed', created_at: '2026-09-25T12:05:00Z',
          dataset_checksum: `md5:${'3'.repeat(32)}`, snapshot_count: benchmarkRows.length, model_versions: [] });
        const args = JSON.parse(request.body);
        const offset = args.p_cursor ? Number(args.p_cursor.id.split('-').at(-1)) : 0;
        const rows = benchmarkRows.slice(offset, offset + args.p_limit);
        const last = rows.at(-1);
        return Response.json({ rows, next_cursor: offset + rows.length < benchmarkRows.length
          ? { created_at: last.response.created_at, id: last.response.id, respondent_type: last.respondent_type } : null });
      } });
    console.log(`BENCHMARK synthetic operator: ${benchmarkRows.length} responses, ${Math.round(performance.now() - started)} ms, ${benchmark.manifest.files.reduce((sum, file) => sum + file.bytes, 0)} output bytes. Mocked network, local CPU/disk only; not production throughput.`);
  }
  console.log('PASS research operator: authorized mocked RPCs, keyset page bounds, checksum drift rejection, immutable raw JSON, exclusions, formula-safe CSV, privileged-key refusal, byte cap and cancellation.');
} finally {
  const checked = resolve(testDirectory);
  if (checked.startsWith(`${resolve(tmpdir())}${sep}`) && checked.includes('qpro-operator-synthetic-')) {
    await rm(checked, { recursive: true, force: true });
  }
}
