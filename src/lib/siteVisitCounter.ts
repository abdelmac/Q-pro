/** Anonymous, approximate visit counts. This module never receives questionnaire data. */
export const SITE_VISIT_STORAGE_KEY = 'medcompass:site-visit:v1';
export const SITE_VISIT_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const SITE_VISIT_TIMEOUT_MS = 6_000;
const VISIT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCTION_HOSTS = new Set([
  'medcompass-web.com',
  'www.medcompass-web.com',
  'medcompass-web.medcompass-web.workers.dev',
]);

export interface SiteVisitCount { total: number; started_at: string }
export interface SiteVisitEnvironment {
  hostname: string;
  protocol: string;
  webdriver?: boolean;
  globalPrivacyControl?: boolean;
  doNotTrack?: string | null;
  windowDoNotTrack?: string | null;
}
interface VisitToken { id: string; createdAt: number }
interface VisitStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SiteVisitDependencies {
  environment: () => SiteVisitEnvironment;
  storage: () => VisitStorage | null;
  randomUUID: () => string | null;
  now: () => number;
  read: (signal: AbortSignal) => Promise<unknown>;
  register: (visitId: string, signal: AbortSignal) => Promise<unknown>;
  timeoutMs?: number;
}

export function canRecordSiteVisit(environment: SiteVisitEnvironment): boolean {
  const trackingDisabled = [environment.doNotTrack, environment.windowDoNotTrack]
    .some(value => value === '1' || value?.toLowerCase() === 'yes');
  return environment.protocol === 'https:' && PRODUCTION_HOSTS.has(environment.hostname.toLowerCase())
    && !environment.webdriver && !environment.globalPrivacyControl && !trackingDisabled;
}

export function parseSiteVisitCount(value: unknown, registration = false): SiteVisitCount {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Visit count unavailable');
  const reply = value as Record<string, unknown>;
  if (typeof reply.total !== 'number' || !Number.isSafeInteger(reply.total) || reply.total < 0
    || typeof reply.started_at !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(reply.started_at)
    || !Number.isFinite(Date.parse(reply.started_at))
    || (registration && typeof reply.counted !== 'boolean')
    || (registration && reply.rate_limited !== undefined && typeof reply.rate_limited !== 'boolean')) {
    throw new Error('Visit count unavailable');
  }
  return { total: reply.total, started_at: reply.started_at };
}

function parseVisitToken(value: unknown, now: number): VisitToken | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const token = value as Record<string, unknown>;
  if (typeof token.id !== 'string' || !VISIT_ID_PATTERN.test(token.id)
    || typeof token.createdAt !== 'number' || !Number.isSafeInteger(token.createdAt)
    || token.createdAt < 0 || now < token.createdAt || now - token.createdAt >= SITE_VISIT_LIFETIME_MS) return null;
  return { id: token.id, createdAt: token.createdAt };
}

/** Shared per page: React remounts/language switches reuse both the request and the visit ID. */
export function createSiteVisitCounter(dependencies: SiteVisitDependencies) {
  let memoryToken: VisitToken | null = null;
  let snapshot: SiteVisitCount | null = null;
  let inFlight: Promise<SiteVisitCount> | null = null;

  function getVisitId(): string | null {
    const now = dependencies.now();
    const remembered = parseVisitToken(memoryToken, now);
    if (remembered) return remembered.id;
    let storage: VisitStorage | null = null;
    try {
      storage = dependencies.storage();
      const stored = storage?.getItem(SITE_VISIT_STORAGE_KEY);
      const parsed = stored ? parseVisitToken(JSON.parse(stored), now) : null;
      if (parsed) { memoryToken = parsed; return parsed.id; }
    } catch { /* Browsers can block sessionStorage. The page still works without it. */ }

    let id: string | null;
    try { id = dependencies.randomUUID(); } catch { return null; }
    if (!id || !VISIT_ID_PATTERN.test(id)) return null;
    memoryToken = { id, createdAt: now };
    try { storage?.setItem(SITE_VISIT_STORAGE_KEY, JSON.stringify(memoryToken)); } catch { /* Memory-only fallback. */ }
    return id;
  }

  async function request(): Promise<SiteVisitCount> {
    const visitId = canRecordSiteVisit(dependencies.environment()) ? getVisitId() : null;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        visitId ? dependencies.register(visitId, controller.signal) : dependencies.read(controller.signal),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('Visit count unavailable'));
          }, dependencies.timeoutMs ?? SITE_VISIT_TIMEOUT_MS);
        }),
      ]);
      return parseSiteVisitCount(response, visitId !== null);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  return {
    load(retry = false): Promise<SiteVisitCount> {
      if (inFlight) return inFlight;
      if (snapshot && !retry) return Promise.resolve(snapshot);
      inFlight = request().then(result => { snapshot = result; return result; }).finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
