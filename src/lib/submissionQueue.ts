import type { AsyncKeyValueStorage } from '@/lib/questionnairePersistence';

export type SubmissionKind = 'student' | 'specialist';
export type SubmissionPayload = Record<string, unknown>;
export interface ConsentedSubmission {
  id: string;
  kind: SubmissionKind;
  payload: SubmissionPayload;
  consent: true;
  catalogVersionId: string;
}
export interface PendingSubmission extends ConsentedSubmission {
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  status: 'pending' | 'rejected' | 'expired';
  /** A generic code only: never persist response bodies, tokens, or logs. */
  errorCode?: string;
}
export type SubmissionSendResult =
  | { status: 'sent' }
  | { status: 'retry' | 'rejected'; errorCode?: string };
export type SubmissionSender = (submission: PendingSubmission) => Promise<SubmissionSendResult>;
export const SUBMISSION_QUEUE_KEY = 'qpro.consented-submissions.v1';
export const SUBMISSION_QUEUE_LIMIT = 10;
export const SUBMISSION_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 1_000_000;
const FORBIDDEN_KEYS = /^(?:authorization|access[_-]?token|refresh[_-]?token|password|jwt|session|service[_-]?role[_-]?key)$/i;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1000 && value.every((entry) => safeJson(entry, depth + 1));
  return record(value) && Object.entries(value).every(([key, entry]) => !FORBIDDEN_KEYS.test(key) && safeJson(entry, depth + 1));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function validSubmission(value: unknown): value is ConsentedSubmission {
  if (!record(value) || value.consent !== true || typeof value.id !== 'string' || !UUID.test(value.id)
    || !['student', 'specialist'].includes(value.kind as string)
    || typeof value.catalogVersionId !== 'string' || !UUID.test(value.catalogVersionId)
    || !record(value.payload) || !safeJson(value.payload)) return false;
  const payload = value.payload;
  return (payload.submission_id === value.id || payload.p_submission_id === value.id)
    && (payload.specialty_config_version_id === value.catalogVersionId || payload.p_specialty_config_version_id === value.catalogVersionId)
    && (payload.submission_id === undefined || payload.submission_id === value.id)
    && (payload.p_submission_id === undefined || payload.p_submission_id === value.id)
    && (payload.specialty_config_version_id === undefined || payload.specialty_config_version_id === value.catalogVersionId)
    && (payload.p_specialty_config_version_id === undefined || payload.p_specialty_config_version_id === value.catalogVersionId);
}

function isPending(value: unknown): value is PendingSubmission {
  return validSubmission(value) && record(value)
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.nextAttemptAt === 'string' && Number.isFinite(Date.parse(value.nextAttemptAt))
    && Number.isInteger(value.attempts) && (value.attempts as number) >= 0
    && ['pending', 'rejected', 'expired'].includes(value.status as string)
    && (value.errorCode === undefined || (typeof value.errorCode === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value.errorCode)));
}

/** 4xx validation/auth errors are permanent; rate limits and transport failures retry. */
export function classifySubmissionFailure(error: unknown): 'retry' | 'rejected' {
  if (!record(error)) return 'retry';
  const status = Number(error.status ?? error.statusCode);
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  if (status >= 400 && status < 500) return 'rejected';
  const code = typeof error.code === 'string' ? error.code : '';
  if (/^(?:22|23|28|42|P0|PGRST[1-3])/.test(code)) return 'rejected';
  return 'retry';
}

/** Native calls serialize within the singleton; browser mutations require origin-wide Web Locks. */
export function createSubmissionQueue(storage: AsyncKeyValueStorage, now = () => Date.now()) {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>, allowWithoutCrossTabLock = false): Promise<T> => {
    const locked = () => {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (typeof locks?.request === 'function') return locks.request(SUBMISSION_QUEUE_KEY, work);
      if (storage.requiresCrossTabLock && !allowWithoutCrossTabLock) {
        throw new Error('This browser cannot safely coordinate pending contributions across tabs. Use an up-to-date browser over HTTPS or the native app. Existing pending data can still be viewed or cleared.');
      }
      return work();
    };
    const next = tail.then(locked, locked);
    tail = next.catch(() => undefined);
    return next;
  };
  const read = async (): Promise<PendingSubmission[]> => {
    const raw = await storage.getItem(SUBMISSION_QUEUE_KEY);
    if (raw === null) return [];
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error('Pending contributions cannot be read. Clear them explicitly to recover.'); }
    if (raw.length > MAX_BYTES || !record(value) || value.schema !== 1 || !Array.isArray(value.items)
      || value.items.length > SUBMISSION_QUEUE_LIMIT || !value.items.every(isPending)
      || new Set(value.items.map((item) => item.id)).size !== value.items.length) {
      throw new Error('Pending contributions are incompatible. Clear them explicitly to recover.');
    }
    return value.items.map((item) => now() - Date.parse(item.createdAt) > SUBMISSION_QUEUE_MAX_AGE_MS
      ? { ...item, status: 'expired' as const, errorCode: 'expired' } : item);
  };
  const write = async (items: PendingSubmission[]): Promise<void> => {
    if (!items.length) return storage.removeItem(SUBMISSION_QUEUE_KEY);
    const raw = JSON.stringify({ schema: 1, items });
    if (raw.length > MAX_BYTES) throw new Error('Pending contribution storage is full.');
    await storage.setItem(SUBMISSION_QUEUE_KEY, raw);
  };
  return {
    enqueue: (submission: ConsentedSubmission): Promise<PendingSubmission> => {
      if (!validSubmission(submission)) return Promise.reject(new Error('Explicit consent and a valid frozen submission are required.'));
      // Freeze the payload before waiting on another write or HTTP request.
      const frozen: ConsentedSubmission = JSON.parse(JSON.stringify(submission));
      return serial(async () => {
        const items = await read();
        const existing = items.find((item) => item.id === frozen.id);
        if (existing) {
          if (existing.kind !== frozen.kind || existing.catalogVersionId !== frozen.catalogVersionId
            || canonical(existing.payload) !== canonical(frozen.payload)) throw new Error('This submission ID already belongs to a different contribution.');
          return existing;
        }
        if (items.length >= SUBMISSION_QUEUE_LIMIT) throw new Error('There are too many pending contributions. Send or clear them before saving another.');
        const timestamp = new Date(now()).toISOString();
        const item: PendingSubmission = { ...frozen, createdAt: timestamp, nextAttemptAt: timestamp, attempts: 0, status: 'pending' };
        await write([...items, item]);
        return JSON.parse(JSON.stringify(item)) as PendingSubmission;
      });
    },
    // These remain usable for recovery without Web Locks: a read has no side
    // effects, and explicitly clearing the entire queue is one atomic removal.
    list: (): Promise<PendingSubmission[]> => serial(read, true),
    discard: (id: string): Promise<void> => serial(async () => write((await read()).filter((item) => item.id !== id))),
    clear: (): Promise<void> => serial(() => storage.removeItem(SUBMISSION_QUEUE_KEY), true),
    flush: (sender: SubmissionSender, options: { force?: boolean } = {}): Promise<{ sent: string[]; pending: PendingSubmission[] }> => serial(async () => {
      let items = await read();
      const sent: string[] = [];
      for (const item of [...items]) {
        if (item.status !== 'pending' || (!options.force && Date.parse(item.nextAttemptAt) > now())) continue;
        let result: SubmissionSendResult;
        try { result = await sender(JSON.parse(JSON.stringify(item)) as PendingSubmission); }
        catch (error) { result = { status: classifySubmissionFailure(error), errorCode: 'transport' }; }
        if (result.status === 'sent') {
          items = items.filter((candidate) => candidate.id !== item.id);
          sent.push(item.id);
        } else {
          const attempts = item.attempts + 1;
          const errorCode = result.errorCode && /^[a-zA-Z0-9_-]{1,40}$/.test(result.errorCode) ? result.errorCode : result.status;
          items = items.map((candidate) => candidate.id !== item.id ? candidate : {
            ...candidate,
            attempts,
            status: result.status === 'rejected' ? 'rejected' : 'pending',
            errorCode,
            nextAttemptAt: new Date(now() + Math.min(60_000 * 2 ** Math.min(attempts - 1, 8), 3_600_000)).toISOString(),
          });
        }
        // A crash after server acceptance can repeat this exact UUID; the RPC must be idempotent.
        await write(items);
      }
      return { sent, pending: items };
    }),
  };
}
