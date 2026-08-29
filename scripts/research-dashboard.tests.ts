import assert from 'node:assert/strict';
import { ALL_QUESTION_IDS } from '../src/data/questions';
import { SPECIALTIES } from '../src/data/specialties';
import { VALUE_OPTIONS } from '../src/data/traits';
import {
  DASHBOARD_MODEL_CHECKSUM,
  analyzeSpecialistResponse,
  analyzeStudentResponse,
  assessSpecialistEligibility,
  assignTieAwareRanks,
  buildCalibrationSummary,
  specialistAnalyticCsv,
  specialistLongCsv,
  specialistRawCsv,
  studentAnalyticCsv,
  studentLongCsv,
  studentRawCsv,
  type SpecialistResponseRow,
  type StudentResponseRow,
} from '../src/lib/researchDashboard';
import { DASHBOARD_ANALYSIS_VERSION, DATA_VERSIONS } from '../src/lib/researchVersions';
import { calculateTraits, SCORING_ENGINE_REVISION } from '../src/lib/scoring';

function parseCsv(csv: string): string[][] {
  const input = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && input[index + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
    } else cell += character;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

const ratings = Object.fromEntries(ALL_QUESTION_IDS.map((id, index) => [id, (index % 10) + 1]));
const maximumTraits = calculateTraits(
  Object.fromEntries(ALL_QUESTION_IDS.map((id) => [id, 10])),
  [],
);
assert.ok(Object.values(maximumTraits).every((score) => score >= 0 && score <= 100));
assert.equal(maximumTraits.communication, 100);

const specialist: SpecialistResponseRow = {
  id: '00000000-0000-4000-8000-000000000001',
  created_at: '2026-08-28T12:00:00.000Z',
  actual_specialty: SPECIALTIES[0].name,
  years_of_experience: 10,
  career_satisfaction: 5,
  would_choose_again: null,
  intention_to_change: null,
  voluntary_choice: null,
  would_choose_again_code: 'yes',
  intention_to_change_code: 'definitely_not',
  voluntary_choice_code: 'fully_voluntary',
  language: 'fr',
  ratings,
  selected_values: [VALUE_OPTIONS[0]],
  submission_schema_version: 1,
  questionnaire_version: DATA_VERSIONS.questionnaire,
  value_catalog_version: DATA_VERSIONS.valueCatalog,
  specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
  calibration_version: DATA_VERSIONS.calibration,
  consent_version: DATA_VERSIONS.consent,
};

const student: StudentResponseRow = {
  id: '00000000-0000-4000-8000-000000000002',
  created_at: specialist.created_at,
  study_year: 6,
  preferred_specialty: SPECIALTIES[1].name,
  language: 'en',
  ratings,
  selected_values: [VALUE_OPTIONS[0]],
  client_scores: SPECIALTIES.map(({ name }, index) => ({ specialty: name, score: 100 - index })),
  submission_schema_version: 1,
  questionnaire_version: DATA_VERSIONS.questionnaire,
  value_catalog_version: DATA_VERSIONS.valueCatalog,
  specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
  scoring_version: DATA_VERSIONS.scoring,
  consent_version: DATA_VERSIONS.consent,
};

const validAnalysis = analyzeSpecialistResponse(specialist);
assert.equal(validAnalysis.eligible, true);
assert.equal(validAnalysis.ranking.length, SPECIALTIES.length);
assert.ok(validAnalysis.ranking.every(({ rankMin, rankMax }) => rankMin <= rankMax));
assert.equal(analyzeStudentResponse(student).eligible, true);
assert.match(DASHBOARD_MODEL_CHECKSUM, /^fnv1a64-[0-9a-f]{16}$/);
assert.equal(validAnalysis.modelChecksum, DASHBOARD_MODEL_CHECKSUM);
// Deliberate provenance lock: if mappings, profiles, versions or rank parameters
// change, bump the relevant revision/version and update this fixture together.
assert.deepEqual({
  analysisVersion: DASHBOARD_ANALYSIS_VERSION,
  engineRevision: SCORING_ENGINE_REVISION,
  modelChecksum: DASHBOARD_MODEL_CHECKSUM,
}, {
  analysisVersion: 'dashboard-canonical-default-v1',
  engineRevision: 'scoring-engine-v1',
  modelChecksum: 'fnv1a64-511dad2480fc6eba',
});

const invalidCases: SpecialistResponseRow[] = [
  { ...specialist, ratings: Object.fromEntries(ALL_QUESTION_IDS.slice(1).map((id) => [id, 5])) },
  { ...specialist, ratings: { ...ratings, UNKNOWN: 5 } },
  { ...specialist, ratings: { ...ratings, [ALL_QUESTION_IDS[0]]: 11 } },
  { ...specialist, ratings: { ...ratings, [ALL_QUESTION_IDS[0]]: 1.5 } },
  { ...specialist, selected_values: [] },
  { ...specialist, selected_values: [VALUE_OPTIONS[0], VALUE_OPTIONS[0]] },
  { ...specialist, selected_values: ['unknown'] },
  { ...specialist, questionnaire_version: 'legacy-unknown' },
  { ...specialist, consent_version: 'legacy-unrecorded' },
  { ...specialist, actual_specialty: 'unknown' },
];
for (const row of invalidCases) {
  assert.equal(assessSpecialistEligibility(row).eligible, false);
  assert.equal(analyzeSpecialistResponse(row).ranking.length, 0);
}

const otherSpecialty = { ...specialist, actual_specialty: SPECIALTIES[1].name };
assert.deepEqual(
  analyzeSpecialistResponse(specialist).ranking,
  analyzeSpecialistResponse(otherSpecialty).ranking,
  'The declared specialty must not leak into the canonical ranking',
);

const tieInput = [
  { name: 'E', score: 70 },
  { name: 'C', score: 80 },
  { name: 'A', score: 90 },
  { name: 'D', score: 80 },
  { name: 'B', score: 80 },
];
const ties = assignTieAwareRanks(tieInput);
assert.deepEqual(ties.map(({ name, rankMin, rankMax, tieCount }) => [name, rankMin, rankMax, tieCount]), [
  ['A', 1, 1, 1], ['B', 2, 4, 3], ['C', 2, 4, 3], ['D', 2, 4, 3], ['E', 5, 5, 1],
]);
assert.deepEqual(assignTieAwareRanks([...tieInput].reverse()), ties);
assert.deepEqual(
  assignTieAwareRanks([{ name: 'A', score: 90 }, { name: 'B', score: 90 - 5e-10 }])
    .map(({ rankMin, rankMax }) => [rankMin, rankMax]),
  [[1, 2], [1, 2]],
);

const legacy: SpecialistResponseRow = {
  ...specialist,
  id: '00000000-0000-4000-8000-000000000003',
  years_of_experience: -1,
  would_choose_again: '=2+2',
  intention_to_change: '+SUM(1,1)',
  voluntary_choice: '@legacy',
  submission_schema_version: 0,
  questionnaire_version: 'legacy-unknown',
  value_catalog_version: 'legacy-unknown',
  specialty_catalog_version: 'legacy-unknown',
  calibration_version: 'legacy-localized-labels',
  consent_version: 'legacy-unrecorded',
};
const summary = buildCalibrationSummary([specialist, legacy], null);
assert.equal(summary.total, 2);
assert.equal(summary.eligibleCount, 1);
assert.equal(summary.excludedCount, 1);
assert.equal(summary.questionAggregates[0].count, 1);
assert.equal(summary.questionAggregates[0].mean, ratings[ALL_QUESTION_IDS[0]]);
assert.equal(buildCalibrationSummary([legacy], null).questionAggregates[0].mean, null);
assert.ok((summary.top1ConservativeRate ?? 0) <= (summary.top1Rate ?? 0));
assert.ok((summary.top3ConservativeRate ?? 0) <= (summary.top3Rate ?? 0));
assert.ok((summary.top5ConservativeRate ?? 0) <= (summary.top5Rate ?? 0));

const denominatorRows = [
  { ...specialist, id: '00000000-0000-4000-8000-000000000010', years_of_experience: 0, career_satisfaction: 1, would_choose_again_code: 'yes' },
  { ...specialist, id: '00000000-0000-4000-8000-000000000011', years_of_experience: 10, career_satisfaction: 5, would_choose_again_code: 'no' },
  { ...specialist, id: '00000000-0000-4000-8000-000000000012', years_of_experience: null, career_satisfaction: null, would_choose_again_code: 'unsure' },
  { ...specialist, id: '00000000-0000-4000-8000-000000000013', years_of_experience: null, career_satisfaction: null, would_choose_again_code: null },
];
const denominatorSummary = buildCalibrationSummary(denominatorRows, specialist.actual_specialty);
assert.equal(denominatorSummary.experienceCount, 2);
assert.equal(denominatorSummary.averageExperience, 5);
assert.equal(denominatorSummary.satisfactionCount, 2);
assert.equal(denominatorSummary.averageSatisfaction, 3);
assert.equal(denominatorSummary.chooseAgainCount, 3);
assert.ok(Math.abs((denominatorSummary.chooseAgainRate ?? 0) - (100 / 3)) < 1e-10);

const manualTrait = denominatorSummary.traitAggregates.find(({ trait }) => trait === 'manual_orientation');
const preventionTrait = denominatorSummary.traitAggregates.find(({ trait }) => trait === 'prevention_orientation');
assert.equal(manualTrait?.source, 'value_only');
assert.equal(manualTrait?.baseCount, 0);
assert.equal(preventionTrait?.source, 'unmeasured');
assert.equal(preventionTrait?.adjustedMean, null);
assert.equal(preventionTrait?.gap, null);

for (const csv of [
  specialistRawCsv([specialist]), specialistAnalyticCsv([specialist]), specialistLongCsv([specialist]),
  studentRawCsv([student]), studentAnalyticCsv([student]), studentLongCsv([student]),
]) {
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const parsed = parseCsv(csv);
  assert.equal(new Set(parsed[0]).size, parsed[0].length, 'CSV headers must be unique');
  assert.ok(parsed.every((row) => row.length === parsed[0].length), 'CSV rows must have equal widths');
}
assert.equal(parseCsv(specialistLongCsv([specialist])).length, 82);
assert.equal(parseCsv(studentLongCsv([student])).length, 82);

const rawLegacy = parseCsv(specialistRawCsv([legacy]));
const rawHeaders = rawLegacy[0];
const rawValues = rawLegacy[1];
assert.equal(rawValues[rawHeaders.indexOf('would_choose_again')], "'=2+2");
assert.equal(rawValues[rawHeaders.indexOf('intention_to_change')], "'+SUM(1,1)");
assert.equal(rawValues[rawHeaders.indexOf('voluntary_choice')], "'@legacy");
assert.equal(rawValues[rawHeaders.indexOf('years_of_experience')], '-1');

const analyticLegacy = parseCsv(specialistAnalyticCsv([legacy]));
const analyticHeaders = analyticLegacy[0];
const analyticValues = analyticLegacy[1];
assert.equal(analyticValues[analyticHeaders.indexOf('analysis_eligible')], 'false');
assert.equal(analyticValues[analyticHeaders.indexOf('actual_rank_min')], '');
assert.ok(analyticValues[analyticHeaders.indexOf('dashboard_analysis_version')]);
assert.ok(analyticValues[analyticHeaders.indexOf('scoring_engine_revision')]);
assert.equal(analyticValues[analyticHeaders.indexOf('model_configuration_checksum')], DASHBOARD_MODEL_CHECKSUM);
assert.ok(analyticValues[analyticHeaders.indexOf('analysis_generated_at')]);

console.log(JSON.stringify({
  eligibility: true,
  noTargetLeakage: true,
  tieAwareRanks: true,
  explicitDenominators: true,
  structuralCoverageFlagged: true,
  csvSafetyAndShape: true,
  modelProvenance: DASHBOARD_MODEL_CHECKSUM,
  currentLongRowsPerResponse: 81,
}));
