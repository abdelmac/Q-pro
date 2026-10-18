import assert from 'node:assert/strict';
import {
  canRecordSiteVisit,
  createSiteVisitCounter,
  parseSiteVisitCount,
  SITE_VISIT_LIFETIME_MS,
  SITE_VISIT_STORAGE_KEY,
  type SiteVisitDependencies,
  type SiteVisitEnvironment,
} from '../src/lib/siteVisitCounter';
import { VISITOR_COUNTER_COPY } from '../src/data/visitorCounterI18n';

const firstId = '00000000-0000-4000-8000-000000000001';
const nextId = '00000000-0000-4000-8000-000000000002';
const startedAt = '2026-10-18T12:00:00+00:00';
const initialNow = Date.parse(startedAt);
const production: SiteVisitEnvironment = { hostname: 'medcompass-web.com', protocol: 'https:' };

function fixture(overrides: Partial<SiteVisitDependencies> = {}) {
  const stored = new Map<string, string>();
  const registrations: Array<{ id: string; signal: AbortSignal }> = [];
  let reads = 0;
  let storageReads = 0;
  let randomCalls = 0;
  let now = initialNow;
  const dependencies: SiteVisitDependencies = {
    environment: () => production,
    now: () => now,
    storage: () => {
      storageReads++;
      return {
        getItem: key => stored.get(key) ?? null,
        setItem: (key, value) => { stored.set(key, value); },
      };
    },
    randomUUID: () => (++randomCalls === 1 ? firstId : nextId),
    read: async () => { reads++; return { total: 41, started_at: startedAt }; },
    register: async (id, signal) => {
      registrations.push({ id, signal });
      return { total: 42, started_at: startedAt, counted: true };
    },
    ...overrides,
  };
  return {
    dependencies, stored, registrations,
    controller: createSiteVisitCounter(dependencies),
    counts: () => ({ reads, storageReads, randomCalls }),
    setNow: (value: number) => { now = value; },
  };
}

for (const hostname of ['medcompass-web.com', 'www.medcompass-web.com', 'medcompass-web.medcompass-web.workers.dev']) {
  assert.equal(canRecordSiteVisit({ ...production, hostname }), true);
}
for (const hostname of ['localhost', '127.0.0.1', 'preview.medcompass-web.com', 'medcompass-web.com.example.org', 'random.workers.dev']) {
  assert.equal(canRecordSiteVisit({ ...production, hostname }), false);
}
for (const preference of [
  { webdriver: true }, { globalPrivacyControl: true }, { doNotTrack: '1' },
  { doNotTrack: 'yes' }, { windowDoNotTrack: '1' }, { windowDoNotTrack: 'YES' }, { protocol: 'http:' },
]) {
  const environment = { ...production, ...preference };
  assert.equal(canRecordSiteVisit(environment), false);
  const readOnly = fixture({ environment: () => environment });
  assert.equal((await readOnly.controller.load()).total, 41);
  assert.equal(readOnly.registrations.length, 0);
  assert.deepEqual(readOnly.counts(), { reads: 1, storageReads: 0, randomCalls: 0 }, 'Opted-out visits must not even access visit storage or generate an ID');
}
assert.equal(canRecordSiteVisit({ ...production, doNotTrack: '0' }), true);

const expected = { total: 0, started_at: startedAt };
assert.deepEqual(parseSiteVisitCount({ ...expected, private_field: 'must not leak' }), expected);
assert.deepEqual(parseSiteVisitCount({ ...expected, counted: false, rate_limited: true }, true), expected);
for (const invalid of [
  null, [], 0, '42', {}, { total: 0 }, { total: '42', started_at: startedAt },
  { total: -1, started_at: startedAt }, { total: 1.2, started_at: startedAt },
  { total: Number.MAX_SAFE_INTEGER + 1, started_at: startedAt },
  { total: Infinity, started_at: startedAt }, { total: NaN, started_at: startedAt },
  { total: 1, started_at: 'not a date' }, { total: 1, started_at: '2026-10-18' },
  { total: 1, started_at: '2026-19-99T99:99:99Z' },
]) assert.throws(() => parseSiteVisitCount(invalid));
assert.throws(() => parseSiteVisitCount(expected, true), 'Register replies require an explicit counted flag');
assert.throws(() => parseSiteVisitCount({ ...expected, counted: 'yes' }, true));
assert.throws(() => parseSiteVisitCount({ ...expected, counted: false, rate_limited: 'yes' }, true));

const first = fixture();
const inFlightA = first.controller.load();
const inFlightB = first.controller.load();
assert.equal(inFlightA, inFlightB, 'StrictMode/concurrent callers must share one request');
assert.equal((await inFlightA).total, 42);
assert.equal(first.registrations.length, 1);
assert.deepEqual(JSON.parse(first.stored.get(SITE_VISIT_STORAGE_KEY)!), { id: firstId, createdAt: initialNow });
assert.equal(first.stored.size, 1, 'The only stored value is a temporary visit token, never answers or an account ID');
await first.controller.load();
assert.equal(first.registrations.length, 1, 'Navigation/language remounts reuse the snapshot without a new network call');
await first.controller.load(true);
assert.equal(first.registrations.length, 2);
assert.equal(first.registrations[1].id, firstId, 'Explicit retries must keep the same visit ID');

const refreshed = createSiteVisitCounter(first.dependencies);
await refreshed.load();
assert.equal(first.registrations[2].id, firstId, 'A refresh in the same tab reuses the session token');
assert.equal(first.counts().randomCalls, 1);
first.setNow(initialNow + SITE_VISIT_LIFETIME_MS - 1);
await createSiteVisitCounter(first.dependencies).load();
assert.equal(first.registrations.at(-1)?.id, firstId);
first.setNow(initialNow + SITE_VISIT_LIFETIME_MS);
await createSiteVisitCounter(first.dependencies).load();
assert.equal(first.registrations.at(-1)?.id, nextId, 'An expired token cannot identify a later visit indefinitely');
assert.deepEqual(JSON.parse(first.stored.get(SITE_VISIT_STORAGE_KEY)!), { id: nextId, createdAt: initialNow + SITE_VISIT_LIFETIME_MS });

for (const badToken of [
  'invalid JSON', 'null', '[]', JSON.stringify({ id: 'not-a-uuid', createdAt: initialNow }),
  JSON.stringify({ id: firstId, createdAt: initialNow + 1 }),
  JSON.stringify({ id: firstId, createdAt: initialNow - SITE_VISIT_LIFETIME_MS }),
  JSON.stringify({ id: firstId, createdAt: '2026-10-18' }),
  JSON.stringify({ id: '00000000-0000-1000-8000-000000000001', createdAt: initialNow }),
]) {
  const invalid = fixture();
  invalid.stored.set(SITE_VISIT_STORAGE_KEY, badToken);
  await invalid.controller.load();
  assert.equal(invalid.counts().randomCalls, 1, 'Invalid, future and expired session tokens must be replaced');
}

const blockedStorage = fixture({ storage: () => { throw new Error('SecurityError'); } });
await blockedStorage.controller.load();
await blockedStorage.controller.load(true);
assert.equal(blockedStorage.registrations[0].id, blockedStorage.registrations[1].id);
assert.equal(blockedStorage.counts().randomCalls, 1, 'In-memory fallback must retain ID across retries');
const quotaExceeded = fixture({ storage: () => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } }) });
await quotaExceeded.controller.load();
await quotaExceeded.controller.load(true);
assert.equal(quotaExceeded.registrations[0].id, quotaExceeded.registrations[1].id);

for (const randomUUID of [() => null, () => 'weak-identifier', () => { throw new Error('Unavailable'); }]) {
  const noCrypto = fixture({ randomUUID });
  await noCrypto.controller.load();
  assert.equal(noCrypto.counts().reads, 1, 'Without cryptographic UUIDs, the counter is read-only');
  assert.equal(noCrypto.registrations.length, 0);
  assert.equal(noCrypto.stored.size, 0);
}

const retryIds: string[] = [];
const failed = fixture({ register: async id => {
  retryIds.push(id);
  if (retryIds.length === 1) throw new Error('Offline');
  return { total: 42, started_at: startedAt, counted: false };
} });
await assert.rejects(failed.controller.load());
assert.equal((await failed.controller.load(true)).total, 42);
assert.deepEqual(retryIds, [firstId, firstId], 'Unknown network outcomes must never generate a fresh ID for retry');

let timeoutSignal: AbortSignal | null = null;
const timeout = fixture({ timeoutMs: 5, register: async (_id, signal) => {
  timeoutSignal = signal;
  return new Promise(() => undefined);
} });
await assert.rejects(timeout.controller.load(), /unavailable/);
assert.equal(timeoutSignal?.aborted, true, 'Finite timeouts must abort the RPC and settle even if transport never responds');

const capped = fixture({ register: async () => ({ total: 5000, started_at: startedAt, counted: false, rate_limited: true }) });
assert.equal((await capped.controller.load()).total, 5000);
assert.deepEqual(Object.keys(JSON.parse(capped.stored.get(SITE_VISIT_STORAGE_KEY)!)).sort(), ['createdAt', 'id'], 'A rate-limited request must never persist a counted/success flag');

assert.equal(VISITOR_COUNTER_COPY.en.label, 'Recorded visits');
assert.equal(VISITOR_COUNTER_COPY.fr.label, 'Visites enregistrées');
assert.equal(VISITOR_COUNTER_COPY.ro.label, 'Vizite înregistrate');
for (const copy of Object.values(VISITOR_COUNTER_COPY)) {
  assert.deepEqual(Object.keys(copy).sort(), ['label', 'loading', 'retry', 'unavailable'],
    'Only the counter label and operational states remain; date and explanatory copy are removed in every language');
  assert.ok(copy.label && copy.unavailable && copy.retry && copy.loading);
}

console.log(JSON.stringify({ visitorCounter: 'passed', productionOnly: true, privacySignals: true, strictModeDeduplication: true, refreshDeduplication: true, sessionLifetimeHours: 24, memoryFallback: true, malformedRepliesRejected: true, retryIdempotency: true, finiteTimeout: true, noQuestionnaireStorage: true, languages: ['en', 'fr', 'ro'] }));
