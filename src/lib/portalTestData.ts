import { ALL_QUESTION_IDS } from '@/data/questions';
import { VALUE_OPTIONS } from '@/data/traits';
import { getCountryName, isValidCountryCode } from '@/data/geography';
import type { Language } from '@/data/i18n';
import { calculateTraits, rankSpecialties } from '@/lib/scoring';
import { DATA_VERSIONS } from '@/lib/researchVersions';
import { mergeSpecialtyCatalog, restorePublishedCatalog, type SpecialtyCatalogSnapshot } from '@/lib/SpecialtyCatalogContext';
import type { SpecialistResponseRow, StudentResponseRow } from '@/lib/researchDashboard';
import type { ParticipationCountry, ParticipationMapFilters, ParticipationMapStats } from '@/lib/participationMap';

export const PORTAL_TEST_GENERATOR_VERSION = 'portal-test-v1' as const;

export interface PortalTestDatasetRecipe {
  id: string;
  seed: number;
  created_at: string;
  generator_version: typeof PORTAL_TEST_GENERATOR_VERSION;
  /** Parsed from the server's frozen get_active_specialty_catalog JSON shape. */
  catalog: SpecialtyCatalogSnapshot;
}

interface TestRowMetadata {
  is_test: true;
  test_dataset_id: string;
  test_label: string;
  /** Synthetic fixtures have no participant and cannot confer research consent. */
  research_consent: false;
  client_scores: Array<{ specialty: string; score: number }>;
  computed_traits: Record<string, number>;
}

export type TestSpecialistRow = SpecialistResponseRow & TestRowMetadata;
export type TestStudentRow = StudentResponseRow & TestRowMetadata & { participant_role: 'student' | 'curious' };
export interface PortalTestDataset extends PortalTestDatasetRecipe {
  specialists: TestSpecialistRow[];
  /** Five medical students followed by five people exploring medicine. */
  students: TestStudentRow[];
}

/** Deliberately omits the real map's privacyThreshold, rounding and granularity claims. */
export type PortalTestMapStats = Pick<ParticipationMapStats,
  'total' | 'countries' | 'students' | 'specialists' | 'nonMedical' | 'groups' | 'publishedThrough'>;

// Version-one fixture protocol tags are fixed. Changing a production collection
// protocol must not rewrite the same stored recipe on a subsequent page load.
// consent_version is only an analysis-compatibility tag: research_consent=false
// and is_test=true explicitly prohibit treating these rows as consented research.
const PROTOCOL = Object.freeze({
  questionnaire: 'q81-v1', values: 'career-values-v1', specialties: 'medical-specialties-v1',
  scoring: 'client-scoring-v2', calibration: 'calibration-v2-qualitative',
  specialistSchema: 3, studentSchema: 5,
  consent: 'research-consent-2026-09-16-geography', reflection: 'medicine-view-optional-v2',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LANGUAGES: Language[] = ['en', 'fr', 'ro'];
const COUNTRIES = ['RO', 'FR', 'GB'];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateMetadata(value: unknown): asserts value is Omit<PortalTestDatasetRecipe, 'catalog'> & { catalog: unknown } {
  if (!record(value) || typeof value.id !== 'string' || !UUID.test(value.id)
    || !Number.isInteger(value.seed) || (value.seed as number) < 1 || (value.seed as number) > 2_147_483_647
    || value.generator_version !== PORTAL_TEST_GENERATOR_VERSION
    || typeof value.created_at !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value.created_at)
    || !Number.isFinite(Date.parse(value.created_at))) {
    throw new Error('Invalid or unsupported portal test dataset recipe.');
  }
  const calendarDate = new Date(`${value.created_at.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value.created_at.slice(0, 10)) {
    throw new Error('Invalid portal test dataset creation date.');
  }
}

export function parsePortalTestDatasetRecipe(value: unknown): PortalTestDatasetRecipe {
  validateMetadata(value);
  // Reuse production parsing, known-specialty/profile validation and the
  // published UUID/hash check. Never substitute the current live catalog.
  const catalog = restorePublishedCatalog(mergeSpecialtyCatalog(value.catalog));
  if (Date.parse(catalog.version.published_at) > Date.parse(value.created_at)) {
    throw new Error('The test dataset catalog was not published when the recipe was created.');
  }
  return Object.freeze({
    id: value.id, seed: value.seed, created_at: value.created_at,
    generator_version: value.generator_version, catalog,
  });
}

function randomFromSeed(seed: number): () => number {
  // Mulberry32: deterministic integer operations, no browser locale or clock.
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function rowId(datasetId: string, index: number): string {
  // Preserve the recipe UUID's version/variant; changing one final byte makes
  // the fifteen row IDs stable and distinct without consuming rating RNG state.
  const suffix = (Number.parseInt(datasetId.slice(-2), 16) ^ (index + 1)).toString(16).padStart(2, '0');
  return `${datasetId.slice(0, -2)}${suffix}`;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

const TEXT = {
  en: {
    prefix: 'SYNTHETIC TEST',
    view: 'This fictional response explores how clinical reasoning and listening can complement each other.',
    changes: 'In this fictional scenario, teamwork and communication became more important over time.',
    quality: 'For this synthetic example, careful listening and thoughtful decisions are the most important qualities.',
    reason: 'In this fictional example, a different work rhythm would suit the simulated preferences better.',
    question: 'Which everyday activities would I still find meaningful after many years?',
    student: 'This fictional student sees medicine as a balance of scientific curiosity, responsibility and human connection.',
    curious: 'This fictional explorer is curious about the daily experience of caring for others and learning science.',
  },
  fr: {
    prefix: 'TEST SYNTHÉTIQUE',
    view: 'Cette réponse fictive explore la complémentarité du raisonnement clinique et de l’écoute.',
    changes: 'Dans ce scénario fictif, le travail d’équipe et la communication ont pris davantage de place avec le temps.',
    quality: 'Dans cet exemple synthétique, l’écoute attentive et des décisions réfléchies sont les qualités essentielles.',
    reason: 'Dans cet exemple fictif, un autre rythme de travail conviendrait mieux aux préférences simulées.',
    question: 'Quelles activités quotidiennes auraient encore du sens pour moi après de nombreuses années ?',
    student: 'Cet étudiant fictif voit la médecine comme un équilibre entre curiosité scientifique, responsabilité et relation humaine.',
    curious: 'Cette personne fictive s’interroge sur le quotidien du soin et sur l’apprentissage des sciences.',
  },
  ro: {
    prefix: 'TEST SINTETIC',
    view: 'Acest răspuns fictiv explorează felul în care raționamentul clinic și ascultarea se pot completa.',
    changes: 'În acest scenariu fictiv, munca în echipă și comunicarea au devenit mai importante în timp.',
    quality: 'În acest exemplu sintetic, ascultarea atentă și deciziile bine gândite sunt calitățile esențiale.',
    reason: 'În acest exemplu fictiv, un alt ritm de lucru s-ar potrivi mai bine preferințelor simulate.',
    question: 'Ce activități de zi cu zi ar continua să aibă sens pentru mine după mulți ani?',
    student: 'Acest student fictiv vede medicina ca pe un echilibru între curiozitate științifică, responsabilitate și relația umană.',
    curious: 'Această persoană fictivă este curioasă despre experiența zilnică a îngrijirii și despre studiul științelor.',
  },
} as const;

/** In-memory synthetic fixtures only. This function never performs a database write. */
export function generatePortalTestDataset(recipe: PortalTestDatasetRecipe): PortalTestDataset {
  validateMetadata(recipe);
  const catalog = restorePublishedCatalog(recipe.catalog);
  if (Date.parse(catalog.version.published_at) > Date.parse(recipe.created_at)) throw new Error('Invalid test catalog chronology.');
  const random = randomFromSeed(recipe.seed);
  const names = shuffled(catalog.specialties.map(({ name }) => name), random);
  const languagesByRole = Array.from({ length: 3 }, () => shuffled([...LANGUAGES, 'en' as Language, 'fr' as Language], random));
  const monthOffsets = shuffled(Array.from({ length: 15 }, (_, index) => index % 3), random);
  const anchor = new Date(recipe.created_at);
  const specialists: TestSpecialistRow[] = [];
  const students: TestStudentRow[] = [];
  for (let index = 0; index < 15; index += 1) {
    const role = index < 5 ? 'specialist' : index < 10 ? 'student' : 'curious';
    const localIndex = index % 5;
    const language = languagesByRole[Math.floor(index / 5)][localIndex];
    const text = TEXT[language];
    const ratings = Object.fromEntries(ALL_QUESTION_IDS.map(question => [question, 1 + Math.floor(random() * 10)]));
    const selectedValues = shuffled(VALUE_OPTIONS, random).slice(0, 1 + Math.floor(random() * 4));
    const specialty = names[index % names.length];
    const countryCode = COUNTRIES[index % COUNTRIES.length];
    const createdAt = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1 - monthOffsets[index],
      1 + Math.floor(random() * 28), 12, localIndex)).toISOString();
    const label = `${text.prefix} · ${role === 'curious' ? 'explorer' : role} ${localIndex + 1}`;
    const ranking = rankSpecialties({ ratings, selectedValues, preferredSpecialty: role === 'specialist' ? null : specialty }, undefined, catalog.specialties);
    const metadata: TestRowMetadata = {
      is_test: true, test_dataset_id: recipe.id, test_label: label, research_consent: false,
      client_scores: ranking.map(({ specialty: match, score }) => ({ specialty: match.name, score })),
      computed_traits: calculateTraits(ratings, selectedValues),
    };
    const shared = {
      scoring_context: null,
      ...metadata, id: rowId(recipe.id, index), ratings, selected_values: selectedValues,
      language, created_at: createdAt, country_code: countryCode,
      country_name: getCountryName(countryCode, 'en'), region: null,
      questionnaire_version: PROTOCOL.questionnaire, value_catalog_version: PROTOCOL.values,
      specialty_catalog_version: PROTOCOL.specialties, specialty_config_version_id: catalog.version.id,
      specialty_config_revision: catalog.revision, consent_version: PROTOCOL.consent,
    };
    if (role === 'specialist') {
      const chooseAgain = localIndex % 3 === 1 ? 'no' : 'yes';
      specialists.push({
        ...shared, actual_specialty: specialty, questionnaire_completed: true,
        submission_schema_version: PROTOCOL.specialistSchema, calibration_version: PROTOCOL.calibration,
        current_specialty_view: `${label}. ${text.view}`,
        specialty_changes_over_years: `${text.prefix}. ${text.changes}`,
        most_important_specialty_quality: `${text.prefix}. ${text.quality}`,
        would_choose_again_code: chooseAgain,
        would_not_choose_again_reason: chooseAgain === 'no' ? `${text.prefix}. ${text.reason}` : null,
        student_self_question: `${text.prefix}. ${text.question}`,
        years_of_experience: null, career_satisfaction: null, intention_to_change: null,
        intention_to_change_code: null, voluntary_choice: null, voluntary_choice_code: null, would_choose_again: null,
      });
    } else {
      students.push({
        ...shared, participant_role: role, preferred_specialty: specialty,
        study_year: role === 'student' ? 1 + ((localIndex + recipe.seed) % 6) : null,
        submission_schema_version: PROTOCOL.studentSchema, scoring_version: PROTOCOL.scoring,
        participant_reflection_version: PROTOCOL.reflection,
        medicine_view: `${label}. ${role === 'student' ? text.student : text.curious}`,
      });
    }
  }
  return deepFreeze({ ...recipe, catalog, specialists, students });
}

function isCurrentRow(row: TestSpecialistRow | TestStudentRow): boolean {
  if (row.questionnaire_version !== DATA_VERSIONS.questionnaire || row.value_catalog_version !== DATA_VERSIONS.valueCatalog
    || row.specialty_catalog_version !== DATA_VERSIONS.specialtyCatalog) return false;
  return 'actual_specialty' in row
    ? row.submission_schema_version === DATA_VERSIONS.specialistSubmissionSchema
      && row.consent_version === DATA_VERSIONS.specialistConsent && row.calibration_version === DATA_VERSIONS.calibration
    : row.submission_schema_version === DATA_VERSIONS.studentSubmissionSchema
      && row.consent_version === DATA_VERSIONS.studentConsent && row.scoring_version === DATA_VERSIONS.scoring
      && row.participant_reflection_version === DATA_VERSIONS.participantReflection;
}

/** Exact, small synthetic counts for the explicitly labelled administrator test map only. */
export function buildTestParticipationMapStats(dataset: PortalTestDataset, filters: ParticipationMapFilters): PortalTestMapStats {
  const month = /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u;
  if (!['all', 'student', 'specialist', 'non_medical'].includes(filters.respondentType)
    || !['all', 'en', 'fr', 'ro'].includes(filters.language) || !['all', 'current'].includes(filters.dataVersion)
    || (filters.countryCode && !isValidCountryCode(filters.countryCode))
    || (filters.monthFrom && !month.test(filters.monthFrom)) || (filters.monthTo && !month.test(filters.monthTo))
    || (filters.monthFrom && filters.monthTo && filters.monthFrom > filters.monthTo)) throw new Error('Invalid synthetic map filters.');
  const groups = new Map<string, ParticipationCountry>();
  for (const row of [...dataset.specialists, ...dataset.students]) {
    if (row.is_test !== true || row.research_consent !== false || row.test_dataset_id !== dataset.id) {
      throw new Error('Real research rows cannot be included in a synthetic test map.');
    }
    const role = 'actual_specialty' in row ? 'specialist' : row.participant_role === 'student' ? 'student' : 'non_medical';
    const responseMonth = row.created_at.slice(0, 7);
    if ((filters.respondentType !== 'all' && role !== filters.respondentType)
      || (filters.countryCode && row.country_code !== filters.countryCode)
      || (filters.language !== 'all' && row.language !== filters.language)
      || (filters.monthFrom && responseMonth < filters.monthFrom) || (filters.monthTo && responseMonth > filters.monthTo)
      || (filters.dataVersion === 'current' && !isCurrentRow(row))) continue;
    if (!row.country_code) continue;
    const group = groups.get(row.country_code) ?? {
      countryCode: row.country_code, country: getCountryName(row.country_code, 'en'), count: 0, students: 0, specialists: 0, nonMedical: 0,
    };
    group.count += 1;
    if (role === 'student') group.students += 1;
    else if (role === 'specialist') group.specialists += 1;
    else group.nonMedical += 1;
    groups.set(row.country_code, group);
  }
  const publishedGroups = [...groups.values()].sort((left, right) => left.countryCode < right.countryCode ? -1 : 1);
  const created = new Date(dataset.created_at);
  return {
    total: publishedGroups.reduce((sum, group) => sum + group.count, 0), countries: publishedGroups.length,
    students: publishedGroups.reduce((sum, group) => sum + group.students, 0),
    specialists: publishedGroups.reduce((sum, group) => sum + group.specialists, 0),
    nonMedical: publishedGroups.reduce((sum, group) => sum + group.nonMedical, 0), groups: publishedGroups,
    publishedThrough: new Date(Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), 0)).toISOString().slice(0, 10),
  };
}
