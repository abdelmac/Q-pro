import assert from 'node:assert/strict';
import { ALL_QUESTION_IDS } from '../src/data/questions';
import { SPECIALTIES } from '../src/data/specialties';
import { SPECIALTY_METADATA } from '../src/data/specialtyMetadata';
import {
  hasSpecialistAuthoredNarrative,
  SPECIALIST_SOURCE_DOCUMENT,
  SPECIALTY_NARRATIVES,
} from '../src/data/specialtyNarratives';
import { QUESTION_TRAITS, VALUE_MAPPING, VALUE_OPTIONS } from '../src/data/traits';
import {
  DASHBOARD_MODEL_CHECKSUM,
  analyzeSpecialistResponse,
  analyzeStudentResponse,
  assessSpecialistEligibility,
  assignTieAwareRanks,
  buildCalibrationSummary,
  isSpecialistCalibrationComplete,
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
import { RESULTS_TOP_COUNT } from '../src/lib/resultsPresentation';
import {
  getAppNavigationScrollKey,
  getDashboardNavigationScrollKey,
  getSpecialistPromptNavigationScrollKey,
  scrollToPageTop,
  type ScrollViewport,
} from '../src/lib/scrollToTop';
import {
  calculateTraits,
  rankSpecialties,
  SCORING_ENGINE_REVISION,
  SELECTED_VALUE_ONLY_SCORE,
} from '../src/lib/scoring';

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
assert.equal(RESULTS_TOP_COUNT, 10, 'The results page must expose a complete Top 10');
assert.equal(SPECIALIST_SOURCE_DOCUMENT.numberedSections, 58);
assert.equal(SPECIALIST_SOURCE_DOCUMENT.uniqueSpecialties, 57);
assert.equal(
  SPECIALIST_SOURCE_DOCUMENT.sha256,
  '1E4C334306D56EE90CF007D57756860CC7690E301ABC83D768772F96EAB4E9E7',
);
assert.equal(
  SPECIALIST_SOURCE_DOCUMENT.localizedPayloadSha256,
  '5BAB0FAEEF926B14931708368C056184A044C17630AF1C8F76FD563C14FA0854',
);
assert.deepEqual(SPECIALIST_SOURCE_DOCUMENT.mergedSections.Pulmonology, [6, 55]);
assert.deepEqual(SPECIALIST_SOURCE_DOCUMENT.missingSpecialties, ['Pathology']);
assert.equal(hasSpecialistAuthoredNarrative('Pathology'), false);
assert.equal(hasSpecialistAuthoredNarrative('Pulmonology'), true);
assert.equal(
  Object.values(SPECIALTY_NARRATIVES).reduce(
    (total, narrative) => total + narrative.sourceReferences.length,
    0,
  ),
  33,
  'Every bibliography entry supplied by the specialist must be preserved exactly once',
);
for (const language of ['en', 'ro', 'fr'] as const) {
  assert.equal(
    SPECIALTY_NARRATIVES.Pulmonology.overview[language].split(/\n\n/u).length,
    2,
    `Pulmonology overview.${language} must preserve source sections 6 and 55`,
  );
  assert.equal(
    SPECIALTY_NARRATIVES.Pulmonology.fitProfile[language].split(/\n\n/u).length,
    2,
    `Pulmonology fitProfile.${language} must preserve source sections 6 and 55`,
  );
}
let requestedScroll: ScrollToOptions | undefined;
scrollToPageTop({
  scrollTo(options) {
    requestedScroll = options;
  },
} satisfies ScrollViewport);
assert.deepEqual(
  requestedScroll,
  { top: 0, left: 0, behavior: 'auto' },
  'Every navigation transition must reset the viewport to the document origin',
);
assert.notEqual(
  getAppNavigationScrollKey('quiz', 3, null),
  getAppNavigationScrollKey('quiz', 4, null),
  'Moving between questionnaire steps must create a new scroll-reset key',
);
assert.equal(
  getAppNavigationScrollKey('results', 3, 'Cardiology'),
  getAppNavigationScrollKey('results', 4, 'Pathology'),
  'Non-navigation state must not reset scroll on a stable root screen',
);
assert.notEqual(
  getAppNavigationScrollKey('detail', 0, 'Cardiology'),
  getAppNavigationScrollKey('detail', 0, 'Pathology'),
  'Opening another specialty detail must create a new scroll-reset key',
);
assert.notEqual(
  getDashboardNavigationScrollKey('authorized', 'specialists'),
  getDashboardNavigationScrollKey('authorized', 'configuration'),
  'Changing dashboard screens must create a new scroll-reset key',
);
assert.notEqual(
  getSpecialistPromptNavigationScrollKey(false),
  getSpecialistPromptNavigationScrollKey(true),
  'The specialist thank-you screen must create a new scroll-reset key',
);
const maximumTraits = calculateTraits(
  Object.fromEntries(ALL_QUESTION_IDS.map((id) => [id, 10])),
  [],
);
assert.ok(Object.values(maximumTraits).every((score) => score >= 0 && score <= 100));
assert.equal(maximumTraits.communication, 100);

// A selected value is evidence about importance, not permission to rewrite a
// level that the 81-item questionnaire measured. Value-only traits receive a
// strong, explicit level instead of the old paradoxical 50 + small bonus.
const traitsWithoutValues = calculateTraits(ratings, []);
const traitsWithCaring = calculateTraits(ratings, ['Caring for people']);
assert.equal(
  traitsWithCaring.care_motivation,
  traitsWithoutValues.care_motivation,
  'A career value must not inflate a trait already measured by the questionnaire',
);
const traitsWithManualValue = calculateTraits(ratings, ['Manual/hands-on activity']);
assert.equal(SELECTED_VALUE_ONLY_SCORE, 90);
assert.equal(
  traitsWithManualValue.manual_orientation,
  90,
  'Manual/hands-on activity must create strong value-only evidence',
);

const manualOnlyCatalog = [
  {
    name: 'Manual A',
    category: 'Surgical' as const,
    profile: { manual_orientation: [90, 3] as [number, number] },
    blurb: 'Regression fixture',
  },
  {
    name: 'Manual B',
    category: 'Surgical' as const,
    profile: { manual_orientation: [90, 3] as [number, number] },
    blurb: 'Regression fixture',
  },
] as const;
const manualOnlyRanking = rankSpecialties({
  ratings,
  selectedValues: ['Manual/hands-on activity'],
  preferredSpecialty: null,
}, undefined, [...manualOnlyCatalog].reverse());
const manualOnlyRankingWithoutValue = rankSpecialties({
  ratings,
  selectedValues: [],
  preferredSpecialty: null,
}, undefined, manualOnlyCatalog);
assert.equal(manualOnlyRanking[0].score, 100);
assert.ok(
  manualOnlyRanking[0].score > manualOnlyRankingWithoutValue[0].score,
  'Selecting manual work must not penalize a specialty whose manual target is 90',
);
assert.deepEqual(
  manualOnlyRanking.map(({ specialty }) => specialty.name),
  ['Manual A', 'Manual B'],
  'Exact score ties must be ordered deterministically by specialty name',
);
assert.equal(
  manualOnlyRanking[0].subScores.find(({ dimension }) => dimension === 'technical')?.score,
  100,
);
assert.equal(
  manualOnlyRanking[0].subScores.find(({ dimension }) => dimension === 'thinking')?.score,
  null,
  'A dimension without evidence must be unavailable rather than a false zero',
);

const measuredTraits = new Set([
  ...Object.values(QUESTION_TRAITS).flatMap((mappings) => mappings.map(({ trait }) => trait)),
  ...Object.values(VALUE_MAPPING).flatMap((mappings) => mappings.map(({ trait }) => trait)),
]);
const documentedUnmeasuredMetadataTraits = new Set(['prevention_orientation']);
for (const specialty of SPECIALTIES) {
  const metadata = SPECIALTY_METADATA[specialty.name];
  assert.ok(metadata, `Missing display metadata for ${specialty.name}`);
  for (const trait of metadata.keyTraits) {
    if (specialty.profile[trait]) continue;
    assert.equal(
      measuredTraits.has(trait),
      false,
      `${specialty.name} metadata references measured trait ${trait}, which is absent from its scoring profile`,
    );
    assert.ok(
      documentedUnmeasuredMetadataTraits.has(trait),
      `${specialty.name} has undocumented unmeasured metadata trait ${trait}`,
    );
  }
}

const narrativeNames = Object.keys(SPECIALTY_NARRATIVES);
assert.equal(narrativeNames.length, SPECIALTIES.length, 'Every specialty must have exactly one narrative');
assert.deepEqual(
  [...narrativeNames].sort(),
  SPECIALTIES.map(({ name }) => name).sort(),
  'Narrative keys must exactly match the scoring catalog',
);
for (const specialty of SPECIALTIES) {
  const narrative = SPECIALTY_NARRATIVES[specialty.name];
  assert.ok(narrative, `Missing multilingual narrative for ${specialty.name}`);
  for (const language of ['en', 'ro', 'fr'] as const) {
    assert.notEqual(
      narrative.overview[language],
      narrative.fitProfile[language],
      `${specialty.name}.${language} must keep overview and professional profile distinct`,
    );
    for (const [field, text, minimum, maximum] of [
      ['overview', narrative.overview[language], 20, 2000],
      ['fitProfile', narrative.fitProfile[language], 20, 5000],
    ] as const) {
      assert.equal(text, text.trim(), `${specialty.name}.${field}.${language} has outer whitespace`);
      assert.equal(text, text.normalize('NFC'), `${specialty.name}.${field}.${language} is not NFC`);
      assert.ok(text.length >= minimum && text.length <= maximum, `${specialty.name}.${field}.${language} length is invalid`);
      assert.doesNotMatch(text, /�|Ã|Â|ǎ|[şţŞŢ]/u, `${specialty.name}.${field}.${language} contains broken Unicode`);
    }
  }
  assert.equal(new Set(Object.values(narrative.overview)).size, 3, `${specialty.name} overview must be translated`);
  assert.equal(new Set(Object.values(narrative.fitProfile)).size, 3, `${specialty.name} fit profile must be translated`);
}

const specialist: SpecialistResponseRow = {
  id: '00000000-0000-4000-8000-000000000001',
  created_at: '2026-08-28T12:00:00.000Z',
  actual_specialty: SPECIALTIES[0].name,
  years_of_experience: null,
  career_satisfaction: null,
  would_choose_again: null,
  intention_to_change: null,
  voluntary_choice: null,
  would_choose_again_code: 'yes',
  intention_to_change_code: null,
  voluntary_choice_code: null,
  current_specialty_view: 'A demanding specialty with meaningful longitudinal patient care.',
  specialty_changes_over_years: 'Clinical decisions increasingly rely on multidisciplinary teamwork.',
  most_important_specialty_quality: 'Sound judgment under uncertainty.',
  would_not_choose_again_reason: null,
  student_self_question: 'Do I enjoy the daily work, including its difficult and repetitive parts?',
  language: 'fr',
  ratings,
  selected_values: [VALUE_OPTIONS[0]],
  specialty_config_version_id: '50000000-0000-4000-8000-000000000001',
  specialty_config_revision: 1,
  submission_schema_version: DATA_VERSIONS.submissionSchema,
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
  specialty_config_version_id: '50000000-0000-4000-8000-000000000001',
  specialty_config_revision: 1,
  submission_schema_version: DATA_VERSIONS.submissionSchema,
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
const changedCatalog = SPECIALTIES.map((specialty, index) => index === 0
  ? {
      ...specialty,
      profile: {
        ...specialty.profile,
        scientific_curiosity: [0, 3] as [number, number],
      },
    }
  : specialty);
const changedCatalogAnalysis = analyzeSpecialistResponse(specialist, changedCatalog);
assert.notEqual(changedCatalogAnalysis.modelChecksum, DASHBOARD_MODEL_CHECKSUM);
assert.equal(changedCatalogAnalysis.ranking.length, SPECIALTIES.length);
// Deliberate provenance lock: if mappings, profiles, versions or rank parameters
// change, bump the relevant revision/version and update this fixture together.
assert.deepEqual({
  analysisVersion: DASHBOARD_ANALYSIS_VERSION,
  engineRevision: SCORING_ENGINE_REVISION,
  modelChecksum: DASHBOARD_MODEL_CHECKSUM,
}, {
  analysisVersion: 'dashboard-canonical-default-v2',
  engineRevision: 'scoring-engine-v2',
  modelChecksum: 'fnv1a64-abdce4ee5b50c668',
});

assert.equal(isSpecialistCalibrationComplete(specialist), true);
assert.equal(
  isSpecialistCalibrationComplete({ ...specialist, current_specialty_view: null }),
  false,
);
assert.equal(
  isSpecialistCalibrationComplete({
    ...specialist,
    would_choose_again_code: 'no',
    would_not_choose_again_reason: null,
  }),
  false,
);
assert.equal(
  isSpecialistCalibrationComplete({
    ...specialist,
    would_choose_again_code: 'no',
    would_not_choose_again_reason: 'The working conditions no longer fit my priorities.',
  }),
  true,
);

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
  current_specialty_view: null,
  specialty_changes_over_years: null,
  most_important_specialty_quality: null,
  would_not_choose_again_reason: null,
  student_self_question: null,
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
  { ...specialist, id: '00000000-0000-4000-8000-000000000010', would_choose_again_code: 'yes' },
  {
    ...specialist,
    id: '00000000-0000-4000-8000-000000000011',
    would_choose_again_code: 'no',
    would_not_choose_again_reason: 'The current workload is no longer sustainable for me.',
  },
  {
    ...specialist,
    id: '00000000-0000-4000-8000-000000000012',
    would_choose_again_code: null,
    current_specialty_view: null,
  },
];
const denominatorSummary = buildCalibrationSummary(denominatorRows, specialist.actual_specialty);
assert.equal(denominatorSummary.chooseAgainCount, 2);
assert.equal(denominatorSummary.chooseAgainRate, 50);
assert.equal(denominatorSummary.completeCount, 2);

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
assert.equal(rawHeaders.includes('specialty_config_version_id'), true);
assert.equal(rawHeaders.includes('specialty_config_revision'), true);
for (const column of [
  'current_specialty_view',
  'specialty_changes_over_years',
  'most_important_specialty_quality',
  'would_not_choose_again_reason',
  'student_self_question',
]) {
  assert.equal(rawHeaders.includes(column), true, `Specialist export is missing ${column}`);
}

const qualitativeFormula = parseCsv(specialistRawCsv([{
  ...specialist,
  current_specialty_view: '=HYPERLINK("https://example.invalid")',
  specialty_changes_over_years: '+SUM(1,1)',
  most_important_specialty_quality: '-1+1',
  student_self_question: '@unsafe',
}]))[1];
assert.equal(qualitativeFormula[rawHeaders.indexOf('current_specialty_view')], "'=HYPERLINK(\"https://example.invalid\")");
assert.equal(qualitativeFormula[rawHeaders.indexOf('specialty_changes_over_years')], "'+SUM(1,1)");
assert.equal(qualitativeFormula[rawHeaders.indexOf('most_important_specialty_quality')], "'-1+1");
assert.equal(qualitativeFormula[rawHeaders.indexOf('student_self_question')], "'@unsafe");

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
  valueOnlyManualEvidence: true,
  measuredTraitNotInflatedByValues: true,
  unavailableDimensionsAreNull: true,
  specialtyMetadataMatchesProfiles: true,
  multilingualSpecialtyNarratives: true,
  navigationScrollPolicy: true,
  noTargetLeakage: true,
  tieAwareRanks: true,
  explicitDenominators: true,
  structuralCoverageFlagged: true,
  runtimeCatalogAffectsProvenance: true,
  csvSafetyAndShape: true,
  modelProvenance: DASHBOARD_MODEL_CHECKSUM,
  currentLongRowsPerResponse: 81,
}));
