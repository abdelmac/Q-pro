import { getAppStorage } from '@/lib/mobileRuntime';
import { createQuestionnairePersistence } from '@/lib/questionnairePersistence';
import { createSubmissionQueue } from '@/lib/submissionQueue';

let instance: Promise<{
  drafts: ReturnType<typeof createQuestionnairePersistence>;
  queue: ReturnType<typeof createSubmissionQueue>;
}> | undefined;

export function getLocalResearchStorage() {
  if (!instance) {
    instance = getAppStorage().then((storage) => ({
      drafts: createQuestionnairePersistence(storage),
      queue: createSubmissionQueue(storage),
    })).catch((error: unknown) => { instance = undefined; throw error; });
  }
  return instance;
}

export const QUEUE_CHANGE_EVENT = 'qpro:queue-change';
export function notifyQueueChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_CHANGE_EVENT));
}
