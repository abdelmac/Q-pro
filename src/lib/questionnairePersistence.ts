import { ALL_QUESTION_IDS, RATING_SECTIONS } from '@/data/questions';
import { VALUE_OPTIONS, QUESTION_TRAITS, VALUE_MAPPING } from '@/data/traits';
import { SPECIALTIES, CATEGORY_ORDER } from '@/data/specialties';
import { DIMENSION_KEYS } from '@/data/dimensions';
import type { Language } from '@/data/i18n';
import { isAppPhase, areAppLocationsEqual, type AppLocation } from '@/lib/appNavigation';
import type { ParticipantRole } from '@/lib/participantProfile';
import type { PriorityWeights } from '@/lib/scoring';
import type { SpecialtyCatalogSnapshot } from '@/lib/SpecialtyCatalogContext';
import { DATA_VERSIONS } from '@/lib/researchVersions';

export interface AsyncKeyValueStorage {
  /** Shared browser localStorage needs an origin-wide lock for read/modify/write. */
  readonly requiresCrossTabLock?: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface GeographyDraft {
  countryCode: string;
  region: string;
}

export interface ParticipantReflectionDraftState {
  submissionId: string;
  studyYear: string;
  medicineView: string;
  geography?: GeographyDraft;
}

export interface SpecialistReflectionDraft {
  submissionId: string;
  actualSpecialty: string | null;
  currentSpecialtyView: string;
  specialtyChangesOverYears: string;
  mostImportantSpecialtyQuality: string;
  wouldChooseAgain: 'yes' | 'no' | null;
  wouldNotChooseAgainReason: string;
  studentSelfQuestion: string;
  geography?: GeographyDraft;
}

export interface QuestionnaireDraft {
  participantRole: ParticipantRole | null;
  language: Language;
  location: AppLocation;
  navigationStack?: AppLocation[];
  ratings: Record<string, number>;
  selectedValues: string[];
  preferredSpecialty: string | null;
  actualSpecialty: string | null;
  priorities: PriorityWeights;
  specialistQuestionnaireMode: 'completed' | 'skipped' | null;
  participantReflectionDraft: ParticipantReflectionDraftState;
  specialistDraft?: SpecialistReflectionDraft;
  /** The complete published snapshot used when this assessment started. */
  catalog: SpecialtyCatalogSnapshot;
}

export const QUESTIONNAIRE_STORAGE_KEY = 'qpro.questionnaire.v1';
export const QUESTIONNAIRE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DRAFT_BYTES = 2_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUESTION_IDS = new Set(ALL_QUESTION_IDS);
const SPECIALTY_NAMES = new Set(SPECIALTIES.map(({ name }) => name));
const TRAITS = new Set([
  ...SPECIALTIES.flatMap(({ profile }) => Object.keys(profile)),
  ...Object.values(QUESTION_TRAITS).flatMap((mappings) => mappings.map(({ trait }) => trait)),
  ...Object.values(VALUE_MAPPING).flatMap((mappings) => mappings.map(({ trait }) => trait)),
]);
const VERSION_STAMP = JSON.stringify({
  questionnaire: DATA_VERSIONS.questionnaire,
  values: DATA_VERSIONS.valueCatalog,
  scoring: DATA_VERSIONS.scoring,
  studentSchema: DATA_VERSIONS.studentSubmissionSchema,
  specialistSchema: DATA_VERSIONS.specialistSubmissionSchema,
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, limit = 2000): value is string {
  return typeof value === 'string' && value.length <= limit;
}

function specialty(value: unknown): boolean {
  return value === null || (typeof value === 'string' && SPECIALTY_NAMES.has(value));
}

function geography(value: unknown): boolean {
  return value === undefined || (record(value)
    && typeof value.countryCode === 'string' && /^(?:[A-Z]{2})?$/.test(value.countryCode)
    && boundedText(value.region, 120));
}

function localizedMap(value: unknown): boolean {
  return record(value) && SPECIALTIES.every(({ name }) => {
    const text = value[name];
    return record(text) && ['en', 'fr', 'ro'].every((lang) => boundedText(text[lang], 30_000));
  });
}

export function isPublishedCatalogSnapshot(value: unknown): value is SpecialtyCatalogSnapshot {
  if (!record(value) || value.source !== 'remote' || !record(value.version)) return false;
  const version = value.version;
  if (typeof version.id !== 'string' || !UUID.test(version.id)
    || !Number.isInteger(version.revision) || (version.revision as number) < 1
    || value.revision !== version.revision || !boundedText(version.label, 500)
    || typeof version.content_hash !== 'string' || !/^md5:[0-9a-f]{32}$/i.test(version.content_hash)
    || typeof version.published_at !== 'string' || !Number.isFinite(Date.parse(version.published_at))) return false;
  if (!Array.isArray(value.specialties) || value.specialties.length !== SPECIALTIES.length) return false;
  const names = new Set<string>();
  for (const item of value.specialties) {
    if (!record(item) || typeof item.name !== 'string' || !SPECIALTY_NAMES.has(item.name)
      || names.has(item.name) || !CATEGORY_ORDER.includes(item.category as typeof CATEGORY_ORDER[number])
      || !boundedText(item.blurb, 30_000) || !record(item.profile) || !Object.keys(item.profile).length) return false;
    names.add(item.name);
    for (const [trait, pair] of Object.entries(item.profile)) {
      if (!TRAITS.has(trait) || !Array.isArray(pair) || pair.length !== 2
        || typeof pair[0] !== 'number' || !Number.isFinite(pair[0]) || pair[0] < 0 || pair[0] > 100
        || !Number.isInteger(pair[1]) || pair[1] < 1 || pair[1] > 3) return false;
    }
  }
  return localizedMap(value.descriptions) && localizedMap(value.clinicalSummaries);
}

function validLocation(value: unknown, role: unknown): value is AppLocation {
  if (!record(value) || !isAppPhase(value.phase) || value.phase === 'dashboard') return false;
  if (['specialist', 'specialist-choice'].includes(value.phase) && role !== 'specialist') return false;
  if (['qprofile', 'student'].includes(value.phase) && !['student', 'curious'].includes(role as string)) return false;
  if (['quiz', 'results'].includes(value.phase) && role === null) return false;
  if (value.phase === 'quiz') {
    const maximum = RATING_SECTIONS.length + (role === 'specialist' ? 0 : 1);
    return Number.isInteger(value.stepIndex) && (value.stepIndex as number) >= 0 && (value.stepIndex as number) <= maximum;
  }
  return value.phase !== 'detail' || (typeof value.specialtyName === 'string' && SPECIALTY_NAMES.has(value.specialtyName));
}

/** No defaults are substituted for incompatible answers or an invalid scoring snapshot. */
export function parseQuestionnaireDraft(value: unknown): QuestionnaireDraft | null {
  if (!record(value) || ![null, 'student', 'curious', 'specialist'].includes(value.participantRole as string | null)
    || !['en', 'fr', 'ro'].includes(value.language as string) || !validLocation(value.location, value.participantRole)
    || !record(value.ratings) || !record(value.priorities) || !Array.isArray(value.selectedValues)
    || value.selectedValues.length > 4 || new Set(value.selectedValues).size !== value.selectedValues.length
    || !value.selectedValues.every((item) => typeof item === 'string' && VALUE_OPTIONS.includes(item))
    || !specialty(value.preferredSpecialty) || !specialty(value.actualSpecialty)
    || ![null, 'completed', 'skipped'].includes(value.specialistQuestionnaireMode as string | null)
    || !isPublishedCatalogSnapshot(value.catalog)) return null;
  if (value.navigationStack !== undefined && (!Array.isArray(value.navigationStack)
    || value.navigationStack.length < 1 || value.navigationStack.length > 256
    || !value.navigationStack.every((location) => validLocation(location, value.participantRole))
    || !areAppLocationsEqual(value.navigationStack[value.navigationStack.length - 1] as AppLocation, value.location as AppLocation))) return null;
  for (const [id, rating] of Object.entries(value.ratings)) {
    if (!QUESTION_IDS.has(id) || !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 10) return null;
  }
  if (['qprofile', 'student', 'results'].includes((value.location as AppLocation).phase)
    && (Object.keys(value.ratings).length !== ALL_QUESTION_IDS.length || value.selectedValues.length === 0
      || (value.participantRole === 'specialist' && value.specialistQuestionnaireMode !== 'completed'))) return null;
  if (Object.keys(value.priorities).length !== DIMENSION_KEYS.length
    || !DIMENSION_KEYS.every((dimension) => {
      const priority = (value.priorities as Record<string, unknown>)[dimension];
      return typeof priority === 'number' && Number.isFinite(priority) && priority >= 0 && priority <= 100;
    })) return null;
  const reflection = value.participantReflectionDraft;
  if (!record(reflection) || typeof reflection.submissionId !== 'string' || !UUID.test(reflection.submissionId)
    || typeof reflection.studyYear !== 'string' || !/^[1-6]?$/.test(reflection.studyYear)
    || !boundedText(reflection.medicineView) || !geography(reflection.geography)) return null;
  if (value.specialistDraft !== undefined) {
    const draft = value.specialistDraft;
    if (!record(draft) || typeof draft.submissionId !== 'string' || !UUID.test(draft.submissionId)
      || !specialty(draft.actualSpecialty) || ![null, 'yes', 'no'].includes(draft.wouldChooseAgain as string | null)
      || !['currentSpecialtyView', 'specialtyChangesOverYears', 'mostImportantSpecialtyQuality',
        'wouldNotChooseAgainReason', 'studentSelfQuestion'].every((key) => boundedText(draft[key]))
      || !geography(draft.geography)) return null;
  }
  // A detached clone prevents caller edits from changing a saved assessment.
  return JSON.parse(JSON.stringify(value)) as QuestionnaireDraft;
}

export type DraftLoadResult =
  | { status: 'restored'; draft: QuestionnaireDraft; savedAt: string }
  | { status: 'empty' | 'invalid' | 'stale' | 'unavailable' };

export function createQuestionnairePersistence(storage: AsyncKeyValueStorage, now = () => Date.now()) {
  let tail: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work, work);
    tail = next.catch(() => undefined);
    return next;
  };
  return {
    load: (): Promise<DraftLoadResult> => serialize(async () => {
      let raw: string | null;
      try { raw = await storage.getItem(QUESTIONNAIRE_STORAGE_KEY); }
      catch { return { status: 'unavailable' }; }
      if (raw === null) return { status: 'empty' };
      try {
        if (raw.length > MAX_DRAFT_BYTES) return { status: 'invalid' };
        const envelope: unknown = JSON.parse(raw);
        if (!record(envelope) || envelope.schema !== 1 || envelope.versions !== VERSION_STAMP
          || typeof envelope.savedAt !== 'string') return { status: 'invalid' };
        const timestamp = Date.parse(envelope.savedAt);
        if (!Number.isFinite(timestamp) || timestamp > now() + 60_000) return { status: 'invalid' };
        if (now() - timestamp > QUESTIONNAIRE_MAX_AGE_MS) return { status: 'stale' };
        const draft = parseQuestionnaireDraft(envelope.draft);
        return draft ? { status: 'restored', draft, savedAt: envelope.savedAt } : { status: 'invalid' };
      } catch { return { status: 'invalid' }; }
    }),
    save: (draft: QuestionnaireDraft): Promise<void> => {
      const snapshot = parseQuestionnaireDraft(draft);
      if (!snapshot) return Promise.reject(new Error('The questionnaire draft is incompatible or invalid.'));
      const raw = JSON.stringify({ schema: 1, versions: VERSION_STAMP, savedAt: new Date(now()).toISOString(), draft: snapshot });
      if (raw.length > MAX_DRAFT_BYTES) return Promise.reject(new Error('The questionnaire draft exceeds the storage limit.'));
      return serialize(() => storage.setItem(QUESTIONNAIRE_STORAGE_KEY, raw));
    },
    clear: (): Promise<void> => serialize(() => storage.removeItem(QUESTIONNAIRE_STORAGE_KEY)),
  };
}
