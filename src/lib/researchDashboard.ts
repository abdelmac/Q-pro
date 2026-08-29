import { ALL_QUESTION_IDS, RATING_SECTIONS } from '@/data/questions';
import { SPECIALTIES } from '@/data/specialties';
import { QUESTION_TRAITS, VALUE_MAPPING, VALUE_OPTIONS } from '@/data/traits';
import { calculateTraits, rankSpecialties, SCORING_ENGINE_REVISION } from '@/lib/scoring';
import { DASHBOARD_ANALYSIS_VERSION, DATA_VERSIONS } from '@/lib/researchVersions';
import type { Database, Json } from '@/lib/database.types';

export type SpecialistResponseRow = Database['public']['Tables']['specialist_responses']['Row'];
export type StudentResponseRow = Database['public']['Tables']['student_responses']['Row'];

export type EligibilityReason =
  | 'schema_version'
  | 'questionnaire_version'
  | 'value_catalog_version'
  | 'specialty_catalog_version'
  | 'analysis_version'
  | 'consent_version'
  | 'language'
  | 'specialty'
  | 'ratings_shape'
  | 'ratings_count'
  | 'ratings_ids'
  | 'ratings_values'
  | 'selected_values_shape'
  | 'selected_values_count'
  | 'selected_values_duplicates'
  | 'selected_values_catalog';

export interface EligibilityAssessment {
  eligible: boolean;
  exclusionReasons: EligibilityReason[];
}

export interface RankedSpecialty {
  name: string;
  score: number;
  rankMin: number;
  rankMax: number;
  tieCount: number;
}

export interface ResponseAnalysis extends EligibilityAssessment {
  analysisVersion: string;
  engineRevision: string;
  modelChecksum: string;
  baseTraits: Record<string, number>;
  adjustedTraits: Record<string, number>;
  ranking: RankedSpecialty[];
}

export interface SpecialistResponseAnalysis extends ResponseAnalysis {
  actualRank: number | null;
  actualRankMin: number | null;
  actualRankMax: number | null;
  actualTieCount: number | null;
  actualScore: number | null;
}

export interface StudentResponseAnalysis extends ResponseAnalysis {
  preferredRankMin: number | null;
  preferredRankMax: number | null;
  preferredTieCount: number | null;
  preferredScore: number | null;
}

export interface QuestionAggregate {
  id: string;
  count: number;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
}

export type TraitSource = 'question' | 'question_and_value' | 'value_only' | 'unmeasured';

export interface TraitAggregate {
  trait: string;
  baseCount: number;
  adjustedCount: number;
  baseMean: number | null;
  adjustedMean: number | null;
  target: number | null;
  importance: number | null;
  gap: number | null;
  source: TraitSource;
  usedInCurrentModel: boolean;
}

export interface ValueAggregate {
  value: string;
  count: number;
  percentage: number;
}

export interface SpecialtyAggregate {
  specialty: string;
  count: number;
  eligibleCount: number;
  excludedCount: number;
  completeCount: number;
  experienceCount: number;
  satisfactionCount: number;
  chooseAgainCount: number;
  rankableCount: number;
  averageExperience: number | null;
  averageSatisfaction: number | null;
  chooseAgainRate: number | null;
  medianActualRank: number | null;
  top3Rate: number | null;
  top3ConservativeRate: number | null;
}

export interface CalibrationSummary {
  total: number;
  eligibleCount: number;
  excludedCount: number;
  rankableCount: number;
  completeCount: number;
  experienceCount: number;
  satisfactionCount: number;
  chooseAgainCount: number;
  averageExperience: number | null;
  averageSatisfaction: number | null;
  chooseAgainRate: number | null;
  top1Rate: number | null;
  top3Rate: number | null;
  top5Rate: number | null;
  top1ConservativeRate: number | null;
  top3ConservativeRate: number | null;
  top5ConservativeRate: number | null;
  medianActualRank: number | null;
  exclusionReasons: Array<{ reason: EligibilityReason; count: number }>;
  specialtyAggregates: SpecialtyAggregate[];
  questionAggregates: QuestionAggregate[];
  traitAggregates: TraitAggregate[];
  valueAggregates: ValueAggregate[];
}

export interface ClientScore {
  specialty: string;
  score: number;
}

const RANK_EPSILON = 1e-9;
const QUESTION_IDS = new Set(ALL_QUESTION_IDS);
const SPECIALTY_NAMES = new Set(SPECIALTIES.map(({ name }) => name));
const VALUE_NAMES = new Set(VALUE_OPTIONS);
const LANGUAGES = new Set(['en', 'ro', 'fr']);
const QUESTION_TRAIT_NAMES = new Set<string>(
  Object.values(QUESTION_TRAITS).flatMap((mappings) => mappings.map(({ trait }) => trait)),
);
const VALUE_TRAIT_NAMES = new Set<string>(
  Object.values(VALUE_MAPPING).flatMap((mappings) => mappings.map(({ trait }) => trait)),
);
const MODEL_TRAIT_NAMES = new Set<string>(SPECIALTIES.flatMap(({ profile }) => Object.keys(profile)));

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(record[key])}`
  )).join(',')}}`;
}

function checksum32(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const MODEL_CONFIGURATION = stableSerialize({
  versions: DATA_VERSIONS,
  analysisVersion: DASHBOARD_ANALYSIS_VERSION,
  engineRevision: SCORING_ENGINE_REVISION,
  rankEpsilon: RANK_EPSILON,
  questionTraits: QUESTION_TRAITS,
  valueMapping: VALUE_MAPPING,
  specialties: SPECIALTIES.map(({ name, profile }) => ({ name, profile })),
});

export const DASHBOARD_MODEL_CHECKSUM = `fnv1a64-${
  checksum32(MODEL_CONFIGURATION, 2166136261)
}${checksum32(MODEL_CONFIGURATION, 3339675911)}`;

export const CALIBRATION_TRAITS = Array.from(new Set([
  ...QUESTION_TRAIT_NAMES,
  ...VALUE_TRAIT_NAMES,
  ...MODEL_TRAIT_NAMES,
])).sort();

export function parseRatings(value: Json): Record<string, number> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};

  const ratings: Record<string, number> = {};
  for (const [id, rating] of Object.entries(value)) {
    if (typeof rating === 'number' && Number.isFinite(rating)) ratings[id] = rating;
  }
  return ratings;
}

export function parseSelectedValues(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function parseClientScores(value: Json): ClientScore[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') return [];
    const specialty = entry.specialty;
    const score = entry.score;
    return typeof specialty === 'string' && typeof score === 'number' && Number.isFinite(score)
      ? [{ specialty, score }]
      : [];
  });
}

function uniqueReasons(reasons: EligibilityReason[]): EligibilityReason[] {
  return Array.from(new Set(reasons));
}

function assessPayload(ratingsJson: Json, selectedValuesJson: Json): EligibilityReason[] {
  const reasons: EligibilityReason[] = [];

  if (!ratingsJson || Array.isArray(ratingsJson) || typeof ratingsJson !== 'object') {
    reasons.push('ratings_shape');
  } else {
    const entries = Object.entries(ratingsJson);
    if (entries.length !== ALL_QUESTION_IDS.length) reasons.push('ratings_count');
    if (entries.some(([id]) => !QUESTION_IDS.has(id))) reasons.push('ratings_ids');
    if (entries.some(([, value]) => (
      typeof value !== 'number'
      || !Number.isInteger(value)
      || value < 1
      || value > 10
    ))) reasons.push('ratings_values');
  }

  if (!Array.isArray(selectedValuesJson)) {
    reasons.push('selected_values_shape');
  } else {
    const values = selectedValuesJson.filter((value): value is string => typeof value === 'string');
    if (values.length !== selectedValuesJson.length) reasons.push('selected_values_catalog');
    if (values.length < 1 || values.length > 4) reasons.push('selected_values_count');
    if (new Set(values).size !== values.length) reasons.push('selected_values_duplicates');
    if (values.some((value) => !VALUE_NAMES.has(value))) reasons.push('selected_values_catalog');
  }

  return uniqueReasons(reasons);
}

function assessSharedVersions(row: Pick<
  SpecialistResponseRow | StudentResponseRow,
  | 'submission_schema_version'
  | 'questionnaire_version'
  | 'value_catalog_version'
  | 'specialty_catalog_version'
  | 'consent_version'
  | 'language'
  | 'ratings'
  | 'selected_values'
>): EligibilityReason[] {
  const reasons = assessPayload(row.ratings, row.selected_values);
  if (row.submission_schema_version !== 1) reasons.push('schema_version');
  if (row.questionnaire_version !== DATA_VERSIONS.questionnaire) reasons.push('questionnaire_version');
  if (row.value_catalog_version !== DATA_VERSIONS.valueCatalog) reasons.push('value_catalog_version');
  if (row.specialty_catalog_version !== DATA_VERSIONS.specialtyCatalog) reasons.push('specialty_catalog_version');
  if (row.consent_version !== DATA_VERSIONS.consent) reasons.push('consent_version');
  if (!LANGUAGES.has(row.language)) reasons.push('language');
  return reasons;
}

export function assessSpecialistEligibility(row: SpecialistResponseRow): EligibilityAssessment {
  const reasons = assessSharedVersions(row);
  if (row.calibration_version !== DATA_VERSIONS.calibration) reasons.push('analysis_version');
  if (!SPECIALTY_NAMES.has(row.actual_specialty)) reasons.push('specialty');
  const exclusionReasons = uniqueReasons(reasons);
  return { eligible: exclusionReasons.length === 0, exclusionReasons };
}

export function assessStudentEligibility(row: StudentResponseRow): EligibilityAssessment {
  const reasons = assessSharedVersions(row);
  if (row.scoring_version !== DATA_VERSIONS.scoring) reasons.push('analysis_version');
  if (row.preferred_specialty !== null && !SPECIALTY_NAMES.has(row.preferred_specialty)) {
    reasons.push('specialty');
  }
  const exclusionReasons = uniqueReasons(reasons);
  return { eligible: exclusionReasons.length === 0, exclusionReasons };
}

export function isSpecialistCalibrationComplete(row: Pick<
  SpecialistResponseRow,
  | 'years_of_experience'
  | 'career_satisfaction'
  | 'would_choose_again_code'
  | 'intention_to_change_code'
  | 'voluntary_choice_code'
>): boolean {
  return row.years_of_experience !== null
    && row.career_satisfaction !== null
    && row.would_choose_again_code !== null
    && row.intention_to_change_code !== null
    && row.voluntary_choice_code !== null;
}

export function assignTieAwareRanks(ranking: Array<{ name: string; score: number }>): RankedSpecialty[] {
  const sortedRanking = [...ranking].sort((left, right) => (
    right.score - left.score || left.name.localeCompare(right.name)
  ));
  const annotated: RankedSpecialty[] = [];
  let groupStart = 0;

  while (groupStart < sortedRanking.length) {
    const referenceScore = sortedRanking[groupStart].score;
    let groupEnd = groupStart;
    while (
      groupEnd + 1 < sortedRanking.length
      && Math.abs(sortedRanking[groupEnd + 1].score - referenceScore) <= RANK_EPSILON
    ) groupEnd += 1;

    for (let index = groupStart; index <= groupEnd; index += 1) {
      annotated.push({
        ...sortedRanking[index],
        rankMin: groupStart + 1,
        rankMax: groupEnd + 1,
        tieCount: groupEnd - groupStart + 1,
      });
    }
    groupStart = groupEnd + 1;
  }

  return annotated;
}

function emptyAnalysis(exclusionReasons: EligibilityReason[]): ResponseAnalysis {
  return {
    eligible: false,
    exclusionReasons,
    analysisVersion: DASHBOARD_ANALYSIS_VERSION,
    engineRevision: SCORING_ENGINE_REVISION,
    modelChecksum: DASHBOARD_MODEL_CHECKSUM,
    baseTraits: {},
    adjustedTraits: {},
    ranking: [],
  };
}

function calculateCanonicalAnalysis(ratingsJson: Json, selectedValuesJson: Json): ResponseAnalysis {
  const ratings = parseRatings(ratingsJson);
  const selectedValues = parseSelectedValues(selectedValuesJson);
  const baseTraits = calculateTraits(ratings, []);
  const adjustedTraits = calculateTraits(ratings, selectedValues);
  const ranking = assignTieAwareRanks(rankSpecialties({
    ratings,
    selectedValues,
    preferredSpecialty: null,
  }).map((result) => ({
    name: result.specialty.name,
    score: result.score,
  })));

  return {
    eligible: true,
    exclusionReasons: [],
    analysisVersion: DASHBOARD_ANALYSIS_VERSION,
    engineRevision: SCORING_ENGINE_REVISION,
    modelChecksum: DASHBOARD_MODEL_CHECKSUM,
    baseTraits,
    adjustedTraits,
    ranking,
  };
}

// Payload-only helper kept for callers that do not own a full database row.
// Full dashboard analyses must use analyzeSpecialistResponse/analyzeStudentResponse
// so that protocol versions and consent are checked as well.
export function analyzeResponse(
  ratingsJson: Json,
  selectedValuesJson: Json,
): ResponseAnalysis {
  const exclusionReasons = assessPayload(ratingsJson, selectedValuesJson);
  return exclusionReasons.length > 0
    ? emptyAnalysis(exclusionReasons)
    : calculateCanonicalAnalysis(ratingsJson, selectedValuesJson);
}

export function analyzeSpecialistResponse(row: SpecialistResponseRow): SpecialistResponseAnalysis {
  const eligibility = assessSpecialistEligibility(row);
  const analysis = eligibility.eligible
    ? calculateCanonicalAnalysis(row.ratings, row.selected_values)
    : emptyAnalysis(eligibility.exclusionReasons);
  const actual = analysis.ranking.find(({ name }) => name === row.actual_specialty);
  return {
    ...analysis,
    actualRank: actual?.rankMin ?? null,
    actualRankMin: actual?.rankMin ?? null,
    actualRankMax: actual?.rankMax ?? null,
    actualTieCount: actual?.tieCount ?? null,
    actualScore: actual?.score ?? null,
  };
}

export function analyzeStudentResponse(row: StudentResponseRow): StudentResponseAnalysis {
  const eligibility = assessStudentEligibility(row);
  const analysis = eligibility.eligible
    ? calculateCanonicalAnalysis(row.ratings, row.selected_values)
    : emptyAnalysis(eligibility.exclusionReasons);
  const preferred = row.preferred_specialty
    ? analysis.ranking.find(({ name }) => name === row.preferred_specialty)
    : undefined;
  return {
    ...analysis,
    preferredRankMin: preferred?.rankMin ?? null,
    preferredRankMax: preferred?.rankMax ?? null,
    preferredTieCount: preferred?.tieCount ?? null,
    preferredScore: preferred?.score ?? null,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentage(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}

function traitSource(trait: string): TraitSource {
  const fromQuestion = QUESTION_TRAIT_NAMES.has(trait);
  const fromValue = VALUE_TRAIT_NAMES.has(trait);
  if (fromQuestion && fromValue) return 'question_and_value';
  if (fromQuestion) return 'question';
  if (fromValue) return 'value_only';
  return 'unmeasured';
}

export function buildCalibrationSummary(
  rows: SpecialistResponseRow[],
  targetSpecialty: string | null,
): CalibrationSummary {
  const analyses = rows.map((row) => ({ row, analysis: analyzeSpecialistResponse(row) }));
  const eligible = analyses.filter(({ analysis }) => analysis.eligible);
  const eligibleRows = eligible.map(({ row }) => row);
  const rankable = eligible.filter(({ analysis }) => analysis.actualRankMin !== null);
  const actualRanks = rankable.map(({ analysis }) => analysis.actualRankMin as number);
  const experienceValues = eligibleRows.flatMap(({ years_of_experience }) => (
    years_of_experience === null ? [] : [years_of_experience]
  ));
  const satisfactionValues = eligibleRows.flatMap(({ career_satisfaction }) => (
    career_satisfaction === null ? [] : [career_satisfaction]
  ));
  const chooseAgainAnswers = eligibleRows.filter(({ would_choose_again_code }) => would_choose_again_code !== null);
  const targetProfile = targetSpecialty
    ? SPECIALTIES.find(({ name }) => name === targetSpecialty)?.profile
    : undefined;

  const reasonCounts = new Map<EligibilityReason, number>();
  for (const { analysis } of analyses) {
    for (const reason of analysis.exclusionReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  const questionAggregates = ALL_QUESTION_IDS.map((id) => {
    const values = eligibleRows.map((row) => parseRatings(row.ratings)[id]);
    return {
      id,
      count: values.length,
      mean: average(values),
      minimum: values.length === 0 ? null : Math.min(...values),
      maximum: values.length === 0 ? null : Math.max(...values),
    };
  });

  const traitAggregates = CALIBRATION_TRAITS.map((trait): TraitAggregate => {
    const baseValues = eligible.flatMap(({ analysis }) => {
      const value = analysis.baseTraits[trait];
      return value === undefined ? [] : [value];
    });
    const adjustedValues = eligible.flatMap(({ analysis }) => {
      const value = analysis.adjustedTraits[trait];
      return value === undefined ? [] : [value];
    });
    const baseMean = average(baseValues);
    const adjustedMean = average(adjustedValues);
    const target = targetProfile?.[trait as keyof typeof targetProfile]?.[0] ?? null;
    const importance = targetProfile?.[trait as keyof typeof targetProfile]?.[1] ?? null;
    const fullyObserved = eligible.length > 0 && adjustedValues.length === eligible.length;
    return {
      trait,
      baseCount: baseValues.length,
      adjustedCount: adjustedValues.length,
      baseMean,
      adjustedMean,
      target,
      importance,
      gap: target === null || adjustedMean === null || !fullyObserved ? null : adjustedMean - target,
      source: traitSource(trait),
      usedInCurrentModel: MODEL_TRAIT_NAMES.has(trait),
    };
  }).sort((left, right) => {
    if (left.target !== null && right.target === null) return -1;
    if (left.target === null && right.target !== null) return 1;
    if (left.gap !== null && right.gap !== null) return Math.abs(right.gap) - Math.abs(left.gap);
    if (left.gap !== null) return -1;
    if (right.gap !== null) return 1;
    return left.trait.localeCompare(right.trait);
  });

  const valueCounts = new Map<string, number>();
  for (const row of eligibleRows) {
    for (const value of parseSelectedValues(row.selected_values)) {
      valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
    }
  }
  const valueAggregates = Array.from(valueCounts, ([value, count]) => ({
    value,
    count,
    percentage: percentage(count, eligibleRows.length) ?? 0,
  })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

  const specialtyGroups = new Map<string, typeof analyses>();
  for (const item of analyses) {
    const group = specialtyGroups.get(item.row.actual_specialty) ?? [];
    group.push(item);
    specialtyGroups.set(item.row.actual_specialty, group);
  }
  const specialtyAggregates = Array.from(specialtyGroups, ([specialty, group]) => {
    const groupEligible = group.filter(({ analysis }) => analysis.eligible);
    const groupRows = groupEligible.map(({ row }) => row);
    const groupRankable = groupEligible.filter(({ analysis }) => analysis.actualRankMin !== null);
    const groupRanks = groupRankable.map(({ analysis }) => analysis.actualRankMin as number);
    const groupExperience = groupRows.flatMap(({ years_of_experience }) => years_of_experience === null ? [] : [years_of_experience]);
    const groupSatisfaction = groupRows.flatMap(({ career_satisfaction }) => career_satisfaction === null ? [] : [career_satisfaction]);
    const groupChooseAgain = groupRows.filter(({ would_choose_again_code }) => would_choose_again_code !== null);
    return {
      specialty,
      count: group.length,
      eligibleCount: groupEligible.length,
      excludedCount: group.length - groupEligible.length,
      completeCount: groupRows.filter(isSpecialistCalibrationComplete).length,
      experienceCount: groupExperience.length,
      satisfactionCount: groupSatisfaction.length,
      chooseAgainCount: groupChooseAgain.length,
      rankableCount: groupRankable.length,
      averageExperience: average(groupExperience),
      averageSatisfaction: average(groupSatisfaction),
      chooseAgainRate: percentage(
        groupChooseAgain.filter(({ would_choose_again_code }) => would_choose_again_code === 'yes').length,
        groupChooseAgain.length,
      ),
      medianActualRank: median(groupRanks),
      top3Rate: percentage(
        groupRankable.filter(({ analysis }) => (analysis.actualRankMin as number) <= 3).length,
        groupRankable.length,
      ),
      top3ConservativeRate: percentage(
        groupRankable.filter(({ analysis }) => (analysis.actualRankMax as number) <= 3).length,
        groupRankable.length,
      ),
    };
  }).sort((left, right) => right.eligibleCount - left.eligibleCount || left.specialty.localeCompare(right.specialty));

  return {
    total: rows.length,
    eligibleCount: eligible.length,
    excludedCount: rows.length - eligible.length,
    rankableCount: rankable.length,
    completeCount: eligibleRows.filter(isSpecialistCalibrationComplete).length,
    experienceCount: experienceValues.length,
    satisfactionCount: satisfactionValues.length,
    chooseAgainCount: chooseAgainAnswers.length,
    averageExperience: average(experienceValues),
    averageSatisfaction: average(satisfactionValues),
    chooseAgainRate: percentage(
      chooseAgainAnswers.filter(({ would_choose_again_code }) => would_choose_again_code === 'yes').length,
      chooseAgainAnswers.length,
    ),
    top1Rate: percentage(rankable.filter(({ analysis }) => (analysis.actualRankMin as number) <= 1).length, rankable.length),
    top3Rate: percentage(rankable.filter(({ analysis }) => (analysis.actualRankMin as number) <= 3).length, rankable.length),
    top5Rate: percentage(rankable.filter(({ analysis }) => (analysis.actualRankMin as number) <= 5).length, rankable.length),
    top1ConservativeRate: percentage(rankable.filter(({ analysis }) => (analysis.actualRankMax as number) <= 1).length, rankable.length),
    top3ConservativeRate: percentage(rankable.filter(({ analysis }) => (analysis.actualRankMax as number) <= 3).length, rankable.length),
    top5ConservativeRate: percentage(rankable.filter(({ analysis }) => (analysis.actualRankMax as number) <= 5).length, rankable.length),
    medianActualRank: median(actualRanks),
    exclusionReasons: Array.from(reasonCounts, ([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    specialtyAggregates,
    questionAggregates,
    traitAggregates,
    valueAggregates,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  const safeText = typeof value === 'string' && (
    /^[\t\r\n]/.test(text)
    || /^[\t\r\n ]*[=+\-@]/.test(text)
  ) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function makeCsv(headers: string[], rows: unknown[][]): string {
  return `\uFEFF${[
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\r\n')}`;
}

const SPECIALIST_METADATA_COLUMNS = [
  'id', 'created_at', 'actual_specialty', 'years_of_experience', 'career_satisfaction',
  'would_choose_again_code', 'intention_to_change_code', 'voluntary_choice_code',
  'would_choose_again', 'intention_to_change', 'voluntary_choice', 'language',
  'submission_schema_version', 'questionnaire_version', 'value_catalog_version',
  'specialty_catalog_version', 'calibration_version', 'consent_version',
] as const;

const STUDENT_METADATA_COLUMNS = [
  'id', 'created_at', 'study_year', 'preferred_specialty', 'language',
  'submission_schema_version', 'questionnaire_version', 'value_catalog_version',
  'specialty_catalog_version', 'scoring_version', 'consent_version',
] as const;

const QUESTION_EXPORT_METADATA = new Map(
  RATING_SECTIONS.flatMap((section) => section.questions.map((question) => [
    question.id,
    { section: section.id, text: question.text },
  ] as const)),
);

function exportQuestionIds(ratings: Record<string, number>): string[] {
  return [
    ...ALL_QUESTION_IDS,
    ...Object.keys(ratings).filter((id) => !QUESTION_IDS.has(id)).sort(),
  ];
}

function analyticProvenance(analysis: ResponseAnalysis, generatedAt: string): unknown[] {
  return [
    DASHBOARD_ANALYSIS_VERSION,
    analysis.engineRevision,
    analysis.modelChecksum,
    generatedAt,
    'current_engine_default_priority_weights',
    false,
    analysis.eligible,
    analysis.exclusionReasons.join('|'),
  ];
}

const ANALYTIC_PROVENANCE_HEADERS = [
  'dashboard_analysis_version',
  'scoring_engine_revision',
  'model_configuration_checksum',
  'analysis_generated_at',
  'ranking_basis',
  'participant_priority_weights_recorded',
  'analysis_eligible',
  'analysis_exclusion_reasons',
];

export function specialistRawCsv(rows: SpecialistResponseRow[]): string {
  const headers = [
    ...SPECIALIST_METADATA_COLUMNS,
    'ratings_json', 'selected_values_json', 'selected_values',
    ...ALL_QUESTION_IDS,
  ];
  return makeCsv(headers, rows.map((row) => {
    const ratings = parseRatings(row.ratings);
    return [
      ...SPECIALIST_METADATA_COLUMNS.map((column) => row[column]),
      JSON.stringify(row.ratings),
      JSON.stringify(row.selected_values),
      parseSelectedValues(row.selected_values).join('|'),
      ...ALL_QUESTION_IDS.map((id) => ratings[id] ?? null),
    ];
  }));
}

export function specialistAnalyticCsv(rows: SpecialistResponseRow[]): string {
  const generatedAt = new Date().toISOString();
  const headers = [
    ...SPECIALIST_METADATA_COLUMNS,
    ...ANALYTIC_PROVENANCE_HEADERS,
    'selected_values',
    'actual_rank_min', 'actual_rank_max', 'actual_tie_count', 'actual_score',
    'actual_hit_top_1_inclusive', 'actual_hit_top_3_inclusive', 'actual_hit_top_5_inclusive',
    'actual_hit_top_1_conservative', 'actual_hit_top_3_conservative', 'actual_hit_top_5_conservative',
    'canonical_ranking_json',
    ...Array.from({ length: 5 }, (_, index) => [
      `display_position_${index + 1}_specialty`, `display_position_${index + 1}_score`,
      `display_position_${index + 1}_rank_min`, `display_position_${index + 1}_rank_max`,
    ]).flat(),
    ...CALIBRATION_TRAITS.flatMap((trait) => [`trait_base:${trait}`, `trait_adjusted:${trait}`]),
  ];
  return makeCsv(headers, rows.map((row) => {
    const analysis = analyzeSpecialistResponse(row);
    return [
      ...SPECIALIST_METADATA_COLUMNS.map((column) => row[column]),
      ...analyticProvenance(analysis, generatedAt),
      parseSelectedValues(row.selected_values).join('|'),
      analysis.actualRankMin,
      analysis.actualRankMax,
      analysis.actualTieCount,
      analysis.actualScore,
      analysis.actualRankMin === null ? null : analysis.actualRankMin <= 1,
      analysis.actualRankMin === null ? null : analysis.actualRankMin <= 3,
      analysis.actualRankMin === null ? null : analysis.actualRankMin <= 5,
      analysis.actualRankMax === null ? null : analysis.actualRankMax <= 1,
      analysis.actualRankMax === null ? null : analysis.actualRankMax <= 3,
      analysis.actualRankMax === null ? null : analysis.actualRankMax <= 5,
      analysis.eligible ? JSON.stringify(analysis.ranking) : null,
      ...analysis.ranking.slice(0, 5).flatMap(({ name, score, rankMin, rankMax }) => [name, score, rankMin, rankMax]),
      ...CALIBRATION_TRAITS.flatMap((trait) => [
        analysis.baseTraits[trait] ?? null,
        analysis.adjustedTraits[trait] ?? null,
      ]),
    ];
  }));
}

export function specialistLongCsv(rows: SpecialistResponseRow[]): string {
  const headers = [
    ...SPECIALIST_METADATA_COLUMNS,
    'analysis_eligible', 'analysis_exclusion_reasons',
    'selected_values', 'known_question', 'section', 'question_id', 'question_text_en', 'rating',
  ];
  return makeCsv(headers, rows.flatMap((row) => {
    const ratings = parseRatings(row.ratings);
    const eligibility = assessSpecialistEligibility(row);
    return exportQuestionIds(ratings).map((id) => {
      const question = QUESTION_EXPORT_METADATA.get(id);
      return [
        ...SPECIALIST_METADATA_COLUMNS.map((column) => row[column]),
        eligibility.eligible,
        eligibility.exclusionReasons.join('|'),
        parseSelectedValues(row.selected_values).join('|'),
        QUESTION_IDS.has(id),
        question?.section ?? 'legacy_unknown',
        id,
        question?.text ?? '',
        ratings[id] ?? null,
      ];
    });
  }));
}

export function studentRawCsv(rows: StudentResponseRow[]): string {
  const headers = [
    ...STUDENT_METADATA_COLUMNS,
    'ratings_json', 'selected_values_json', 'client_scores_json',
    'participant_priority_weights_recorded', 'selected_values',
    ...ALL_QUESTION_IDS,
    ...SPECIALTIES.map(({ name }) => `stored_score:${name}`),
  ];
  return makeCsv(headers, rows.map((row) => {
    const ratings = parseRatings(row.ratings);
    const clientScores = new Map(parseClientScores(row.client_scores).map(({ specialty, score }) => [specialty, score]));
    return [
      ...STUDENT_METADATA_COLUMNS.map((column) => row[column]),
      JSON.stringify(row.ratings),
      JSON.stringify(row.selected_values),
      JSON.stringify(row.client_scores),
      false,
      parseSelectedValues(row.selected_values).join('|'),
      ...ALL_QUESTION_IDS.map((id) => ratings[id] ?? null),
      ...SPECIALTIES.map(({ name }) => clientScores.get(name) ?? null),
    ];
  }));
}

export function studentAnalyticCsv(rows: StudentResponseRow[]): string {
  const generatedAt = new Date().toISOString();
  const headers = [
    ...STUDENT_METADATA_COLUMNS,
    ...ANALYTIC_PROVENANCE_HEADERS,
    'selected_values',
    'preferred_rank_min', 'preferred_rank_max', 'preferred_tie_count', 'preferred_score',
    'canonical_ranking_json',
    ...Array.from({ length: 5 }, (_, index) => [
      `display_position_${index + 1}_specialty`, `display_position_${index + 1}_score`,
      `display_position_${index + 1}_rank_min`, `display_position_${index + 1}_rank_max`,
    ]).flat(),
    ...CALIBRATION_TRAITS.flatMap((trait) => [`trait_base:${trait}`, `trait_adjusted:${trait}`]),
  ];
  return makeCsv(headers, rows.map((row) => {
    const analysis = analyzeStudentResponse(row);
    return [
      ...STUDENT_METADATA_COLUMNS.map((column) => row[column]),
      ...analyticProvenance(analysis, generatedAt),
      parseSelectedValues(row.selected_values).join('|'),
      analysis.preferredRankMin,
      analysis.preferredRankMax,
      analysis.preferredTieCount,
      analysis.preferredScore,
      analysis.eligible ? JSON.stringify(analysis.ranking) : null,
      ...analysis.ranking.slice(0, 5).flatMap(({ name, score, rankMin, rankMax }) => [name, score, rankMin, rankMax]),
      ...CALIBRATION_TRAITS.flatMap((trait) => [
        analysis.baseTraits[trait] ?? null,
        analysis.adjustedTraits[trait] ?? null,
      ]),
    ];
  }));
}

export function studentLongCsv(rows: StudentResponseRow[]): string {
  const headers = [
    ...STUDENT_METADATA_COLUMNS,
    'analysis_eligible', 'analysis_exclusion_reasons',
    'selected_values', 'known_question', 'section', 'question_id', 'question_text_en', 'rating',
  ];
  return makeCsv(headers, rows.flatMap((row) => {
    const ratings = parseRatings(row.ratings);
    const eligibility = assessStudentEligibility(row);
    return exportQuestionIds(ratings).map((id) => {
      const question = QUESTION_EXPORT_METADATA.get(id);
      return [
        ...STUDENT_METADATA_COLUMNS.map((column) => row[column]),
        eligibility.eligible,
        eligibility.exclusionReasons.join('|'),
        parseSelectedValues(row.selected_values).join('|'),
        QUESTION_IDS.has(id),
        question?.section ?? 'legacy_unknown',
        id,
        question?.text ?? '',
        ratings[id] ?? null,
      ];
    });
  }));
}
