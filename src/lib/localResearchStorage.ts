import { getAppStorage } from '@/lib/mobileRuntime';
import type { AsyncKeyValueStorage } from '@/lib/questionnairePersistence';
import { createSubmissionQueue } from '@/lib/submissionQueue';

let instance: Promise<{
  queue: ReturnType<typeof createSubmissionQueue>;
}> | undefined;

export function getLocalResearchStorage() {
  if (!instance) {
    instance = getAppStorage().then((storage) => ({
      queue: createSubmissionQueue(storage),
    })).catch((error: unknown) => { instance = undefined; throw error; });
  }
  return instance;
}

export const QUEUE_CHANGE_EVENT = 'qpro:queue-change';

/** Remove only the retired auto-save keys; consented submissions are separate. */
export async function clearLegacyQuestionnaireProgress(storage: AsyncKeyValueStorage): Promise<void> {
  await Promise.all([
    storage.removeItem('qpro.questionnaire.v1'),
    storage.removeItem('qpro.autosave-enabled.v1'),
  ]);
}

export function notifyQueueChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_CHANGE_EVENT));
}
