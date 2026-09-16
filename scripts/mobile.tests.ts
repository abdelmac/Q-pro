import assert from 'node:assert/strict';
import { ALL_QUESTION_IDS } from '../src/data/questions';
import { SPECIALTIES } from '../src/data/specialties';
import { VALUE_OPTIONS } from '../src/data/traits';
import { DEFAULT_PRIORITY_WEIGHTS } from '../src/data/dimensions';
import { reRankWithPriorities } from '../src/lib/scoring';
import {
  createQuestionnairePersistence, parseQuestionnaireDraft, QUESTIONNAIRE_STORAGE_KEY,
  QUESTIONNAIRE_MAX_AGE_MS, type AsyncKeyValueStorage, type QuestionnaireDraft,
} from '../src/lib/questionnairePersistence';
import {
  createSubmissionQueue, classifySubmissionFailure, SUBMISSION_QUEUE_KEY,
  SUBMISSION_QUEUE_MAX_AGE_MS, SUBMISSION_QUEUE_LIMIT, type ConsentedSubmission,
} from '../src/lib/submissionQueue';

class MemoryStorage implements AsyncKeyValueStorage {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

const id = '12345678-1234-4234-8234-123456789012';
const catalogId = '87654321-4321-4321-8321-210987654321';
const draft: QuestionnaireDraft = {
  participantRole: 'student', language: 'fr', location: { phase: 'quiz', stepIndex: 2 },
  navigationStack: [{ phase: 'role' }, { phase: 'intro' }, { phase: 'quiz', stepIndex: 2 }],
  ratings: { T1: 3, T2: 10 }, selectedValues: [VALUE_OPTIONS[0]],
  preferredSpecialty: SPECIALTIES[0].name, actualSpecialty: null,
  priorities: { ...DEFAULT_PRIORITY_WEIGHTS }, specialistQuestionnaireMode: null,
  participantReflectionDraft: { submissionId: id, studyYear: '6', medicineView: '', geography: { countryCode: 'RO', region: '' } },
  catalog: {
    specialties: SPECIALTIES,
    source: 'remote', revision: 2,
    version: { id: catalogId, revision: 2, label: 'Published research configuration', content_hash: `md5:${'a'.repeat(32)}`, published_at: '2026-09-16T00:00:00.000Z' },
    descriptions: Object.fromEntries(SPECIALTIES.map((specialty) => [specialty.name, { en: specialty.blurb, fr: specialty.blurb, ro: specialty.blurb }])),
    clinicalSummaries: Object.fromEntries(SPECIALTIES.map((specialty) => [specialty.name, { en: specialty.blurb, fr: specialty.blurb, ro: specialty.blurb }])),
  },
};
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const store = new MemoryStorage();
let clock = Date.parse('2026-09-16T12:00:00.000Z');
const persistence = createQuestionnairePersistence(store, () => clock);
assert.equal((await persistence.load()).status, 'empty');
await persistence.save(draft);
const loaded = await createQuestionnairePersistence(store, () => clock).load();
assert.equal(loaded.status, 'restored', 'new app instance resumes after close');
if (loaded.status === 'restored') assert.deepEqual(loaded.draft, draft);

for (const change of [
  { ratings: { T1: 0 } }, { ratings: { T1: 11 } }, { ratings: { T1: 2.5 } },
  { ratings: { unknown: 5 } }, { participantRole: 'admin' }, { language: 'invalid' },
  { priorities: { ...DEFAULT_PRIORITY_WEIGHTS, thinking: Infinity } },
  { selectedValues: [VALUE_OPTIONS[0], VALUE_OPTIONS[0]] }, { selectedValues: ['invented'] },
  { location: { phase: 'dashboard' } }, { location: { phase: 'quiz', stepIndex: 100 } },
  { location: { phase: 'results' } }, { location: { phase: 'student' }, participantRole: 'specialist' },
  { participantReflectionDraft: { ...draft.participantReflectionDraft, studyYear: '12' } },
  { catalog: { ...draft.catalog, source: 'fallback' } },
]) assert.equal(parseQuestionnaireDraft({ ...draft, ...change }), null);

const partialCatalog = copy(draft);
partialCatalog.catalog.specialties = partialCatalog.catalog.specialties.slice(1);
assert.equal(parseQuestionnaireDraft(partialCatalog), null);
const invalidProfile = copy(draft);
invalidProfile.catalog.specialties[0].profile = { ...invalidProfile.catalog.specialties[0].profile, scientific_curiosity: [101, 3] };
assert.equal(parseQuestionnaireDraft(invalidProfile), null);
const invalidStack = { ...draft, navigationStack: [{ phase: 'intro' }] };
assert.equal(parseQuestionnaireDraft(invalidStack), null);
const complete = copy(draft);
complete.ratings = Object.fromEntries(ALL_QUESTION_IDS.map((question, i) => [question, (i % 10) + 1]));
complete.location = { phase: 'results' };
complete.navigationStack = [{ phase: 'role' }, { phase: 'results' }];
await persistence.save(complete);
const resumed = await persistence.load();
assert.equal(resumed.status, 'restored');
if (resumed.status !== 'restored') throw new Error('Expected restored state');
const before = reRankWithPriorities({ ratings: complete.ratings, selectedValues: complete.selectedValues, preferredSpecialty: complete.preferredSpecialty }, complete.priorities, complete.catalog.specialties);
const after = reRankWithPriorities({ ratings: resumed.draft.ratings, selectedValues: resumed.draft.selectedValues, preferredSpecialty: resumed.draft.preferredSpecialty }, resumed.draft.priorities, resumed.draft.catalog.specialties);
assert.deepEqual(after, before, 'the shared scoring engine gives identical offline and resumed results');
clock += QUESTIONNAIRE_MAX_AGE_MS + 1;
assert.equal((await persistence.load()).status, 'stale');
assert.ok(store.values.has(QUESTIONNAIRE_STORAGE_KEY), 'stale data retained until explicit clear');
await persistence.clear();
store.values.set(QUESTIONNAIRE_STORAGE_KEY, '{broken');
assert.equal((await persistence.load()).status, 'invalid');
await persistence.clear();
await persistence.save(draft);
const envelope = JSON.parse(store.values.get(QUESTIONNAIRE_STORAGE_KEY)!);
envelope.versions = 'incompatible-version';
store.values.set(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(envelope));
assert.equal((await persistence.load()).status, 'invalid');

const queueStorage = new MemoryStorage();
const queue = createSubmissionQueue(queueStorage, () => clock);
const submission: ConsentedSubmission = { id, consent: true, kind: 'student', catalogVersionId: catalogId, payload: { submission_id: id, specialty_config_version_id: catalogId, medicine_view: 'An optional perspective', ratings: complete.ratings } };
await assert.rejects(queue.enqueue({ ...submission, consent: false } as unknown as ConsentedSubmission));
await assert.rejects(queue.enqueue({ ...submission, payload: { ...submission.payload, access_token: 'not-stored' } }));
await assert.rejects(queue.enqueue({ ...submission, payload: { ...submission.payload, submission_id: catalogId } }));
const mutable = copy(submission);
const firstEnqueue = queue.enqueue(mutable);
mutable.payload.medicine_view = 'Changed after the save click';
await firstEnqueue;
assert.equal((await queue.list())[0].payload.medicine_view, submission.payload.medicine_view, 'payload frozen before asynchronous writes');
await queue.enqueue(copy(submission));
assert.equal((await queue.list()).length, 1, 'repeated UUID + same payload does not duplicate');
await assert.rejects(queue.enqueue(mutable), /different contribution/);
const firstTry = await queue.flush(async () => ({ status: 'retry', errorCode: 'offline' }));
assert.equal(firstTry.pending[0].attempts, 1);
assert.equal(firstTry.pending[0].id, id);
assert.deepEqual(firstTry.pending[0].payload, submission.payload);
let calls = 0;
await queue.flush(async () => { calls += 1; return { status: 'sent' }; });
assert.equal(calls, 0, 'backoff avoids repeated reconnect sends');
const sender = async () => { calls += 1; await Promise.resolve(); return { status: 'sent' as const }; };
await Promise.all([queue.flush(sender, { force: true }), queue.flush(sender, { force: true })]);
assert.equal(calls, 1, 'concurrent flush is serialized');
assert.equal((await queue.list()).length, 0);
assert.equal(queueStorage.values.has(SUBMISSION_QUEUE_KEY), false, 'clear local payload after server acceptance');
await queue.enqueue(submission);
await queue.flush(async () => ({ status: 'rejected', errorCode: 'validation' }));
await queue.flush(sender, { force: true });
assert.equal(calls, 1, 'validation errors never auto retry');
await queue.discard(id);
await queue.enqueue(submission);
clock += SUBMISSION_QUEUE_MAX_AGE_MS + 1;
assert.equal((await queue.list())[0].status, 'expired');
await queue.flush(sender, { force: true });
assert.equal(calls, 1, 'expired consent is not sent automatically');
await queue.clear();
for (let index = 0; index < SUBMISSION_QUEUE_LIMIT; index += 1) {
  const nextId = `12345678-1234-4234-8234-${String(index).padStart(12, '0')}`;
  await queue.enqueue({ ...submission, id: nextId, payload: { ...submission.payload, submission_id: nextId } });
}
await assert.rejects(queue.enqueue(submission), /too many/);
await queue.clear();
queueStorage.values.set(SUBMISSION_QUEUE_KEY, '{broken');
await assert.rejects(queue.list(), /cannot be read/);
assert.equal(queueStorage.values.get(SUBMISSION_QUEUE_KEY), '{broken');
await queue.clear();
assert.equal(classifySubmissionFailure({ status: 422 }), 'rejected');
assert.equal(classifySubmissionFailure({ status: 401 }), 'rejected');
assert.equal(classifySubmissionFailure({ code: '23505' }), 'rejected');
assert.equal(classifySubmissionFailure({ status: 429 }), 'retry');
assert.equal(classifySubmissionFailure({ status: 503 }), 'retry');
assert.equal(classifySubmissionFailure(new TypeError('Failed to fetch')), 'retry');

// Two tabs have separate queue instances but share an origin's storage and locks.
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
try {
  let lockTail: Promise<unknown> = Promise.resolve();
  let activeLocks = 0;
  let maximumLocks = 0;
  const locks = {
    request: <T>(name: string, callback: () => Promise<T>): Promise<T> => {
      assert.equal(name, SUBMISSION_QUEUE_KEY);
      const next = lockTail.then(async () => {
        activeLocks += 1;
        maximumLocks = Math.max(maximumLocks, activeLocks);
        try { return await callback(); } finally { activeLocks -= 1; }
      });
      lockTail = next.catch(() => undefined);
      return next;
    },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  const sharedStorage = new MemoryStorage();
  const browserStorage: AsyncKeyValueStorage = {
    requiresCrossTabLock: true,
    getItem: (key) => sharedStorage.getItem(key),
    setItem: (key, value) => sharedStorage.setItem(key, value),
    removeItem: (key) => sharedStorage.removeItem(key),
  };
  const tabA = createSubmissionQueue(browserStorage, () => clock);
  const tabB = createSubmissionQueue(browserStorage, () => clock);
  const secondId = '12345678-1234-4234-8234-123456789013';
  const thirdId = '12345678-1234-4234-8234-123456789014';
  const second = { ...submission, id: secondId, payload: { ...submission.payload, submission_id: secondId } };
  const third = { ...submission, id: thirdId, payload: { ...submission.payload, submission_id: thirdId } };
  await Promise.all([tabA.enqueue(submission), tabB.enqueue(second)]);
  assert.deepEqual((await tabA.list()).map((item) => item.id).sort(), [id, secondId].sort(), 'simultaneous tab writes preserve both submissions');
  const sentIds: string[] = [];
  let releaseSend!: () => void;
  let announceSend!: () => void;
  const sendGate = new Promise<void>((resolve) => { releaseSend = resolve; });
  const sendStarted = new Promise<void>((resolve) => { announceSend = resolve; });
  const crossTabSender = async (item: { id: string }) => {
    sentIds.push(item.id);
    if (item.id === id) { announceSend(); await sendGate; }
    return { status: 'sent' as const };
  };
  const flushA = tabA.flush(crossTabSender, { force: true });
  await sendStarted;
  let thirdEnqueued = false;
  const enqueueDuringFlush = tabB.enqueue(third).then(() => { thirdEnqueued = true; });
  const flushB = tabB.flush(crossTabSender, { force: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(thirdEnqueued, false, 'another tab cannot overwrite storage while a request is in flight');
  releaseSend();
  await Promise.all([flushA, enqueueDuringFlush, flushB]);
  assert.deepEqual(sentIds.sort(), [id, secondId, thirdId].sort(), 'each frozen UUID sent exactly once across simultaneous flushes and enqueue');
  assert.equal((await tabB.list()).length, 0);
  assert.equal(maximumLocks, 1);

  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const savedRaw = JSON.stringify({ schema: 1, items: [] });
  sharedStorage.values.set(SUBMISSION_QUEUE_KEY, savedRaw);
  const unsupportedBrowser = createSubmissionQueue(browserStorage, () => clock);
  await assert.rejects(unsupportedBrowser.enqueue(submission), /cannot safely coordinate/);
  await assert.rejects(unsupportedBrowser.discard(id), /cannot safely coordinate/);
  await assert.rejects(unsupportedBrowser.flush(crossTabSender), /cannot safely coordinate/);
  assert.equal(sharedStorage.values.get(SUBMISSION_QUEUE_KEY), savedRaw, 'missing lock support never modifies stored data');
  assert.deepEqual(await unsupportedBrowser.list(), [], 'read-only recovery remains available');
  await unsupportedBrowser.clear();
  assert.equal(sharedStorage.values.has(SUBMISSION_QUEUE_KEY), false, 'explicit whole-queue deletion remains available');
  const nativeWithoutWebLocks = createSubmissionQueue(new MemoryStorage(), () => clock);
  await nativeWithoutWebLocks.enqueue(submission);
  assert.equal((await nativeWithoutWebLocks.list()).length, 1, 'native and test adapters do not require browser lock support');
} finally {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
}
console.log('Mobile persistence, catalog continuity, shared scoring, consent, queue retry, expiry, and concurrency checks passed.');
