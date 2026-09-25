import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { LOCAL_PROGRESS_COPY } from '@/data/localProgressI18n';
import { getLocalResearchStorage, notifyQueueChange, QUEUE_CHANGE_EVENT } from '@/lib/localResearchStorage';
import { flushPendingResearchSubmissions } from '@/lib/supabase';
import { isNativeApp } from '@/lib/mobileRuntime';
import type { PendingSubmission } from '@/lib/submissionQueue';

/** Visible only when an explicitly saved contribution still needs attention. */
export default function PendingSubmissionsNotice() {
  const { lang } = useLanguage();
  const copy = LOCAL_PROGRESS_COPY[lang];
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [queueError, setQueueError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sending, setSending] = useState(false);
  const readQueue = useCallback(async () => {
    try { setPending(await (await getLocalResearchStorage()).queue.list()); setQueueError(false); }
    catch { setQueueError(true); }
  }, []);
  const send = useCallback(async (force = false) => {
    setSending(true);
    try { await flushPendingResearchSubmissions(force); setSendError(false); }
    catch { setSendError(true); }
    finally { setSending(false); await readQueue(); }
  }, [readQueue]);
  useEffect(() => {
    const refresh = () => { void readQueue(); };
    const reconnect = () => { void send(); };
    refresh(); reconnect();
    window.addEventListener(QUEUE_CHANGE_EVENT, refresh);
    window.addEventListener('online', reconnect);
    const timer = window.setInterval(reconnect, 60_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener(QUEUE_CHANGE_EVENT, refresh);
      window.removeEventListener('online', reconnect);
    };
  }, [readQueue, send]);
  const remove = async (id?: string) => {
    try {
      const { queue } = await getLocalResearchStorage();
      if (id) await queue.discard(id); else await queue.clear();
      notifyQueueChange(); await readQueue();
    } catch { setQueueError(true); }
  };

  // A missing backend configuration alone must not create a notice on an empty queue.
  if (pending.length === 0 && !queueError) return null;

  const button = 'min-h-11 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40';
  return <aside data-pending-submissions className="border-b border-ink-100 bg-amber-50 px-4 py-3 text-xs text-ink-600" aria-label={copy.title}>
    <div className="mx-auto max-w-6xl space-y-2 leading-relaxed">
      <h2 className="font-semibold">{copy.title}</h2>
      {queueError && <div role="alert"><p>{copy.queueError}</p><button type="button" className={button} onClick={() => void remove()}>{copy.clearQueue}</button></div>}
      {sendError && <p role="alert" className="text-amber-800">{copy.sendError}</p>}
      {pending.length > 0 && <div aria-live="polite" className="space-y-2">
        <p className="font-medium">{copy.pending}: {pending.length}</p>
        <p>{copy.queueHelp}</p>
        <p>{isNativeApp() ? copy.native : copy.browser}</p>
        <ul className="space-y-2">{pending.map((item, index) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>#{index + 1} — {item.status === 'rejected' ? copy.rejected : item.status === 'expired' ? copy.expired : copy.queued}</span>
          <button type="button" className={button} disabled={sending} onClick={() => void remove(item.id)}>{copy.remove}</button>
        </li>)}</ul>
        <button type="button" className={button} disabled={sending || !pending.some(item => item.status === 'pending')} onClick={() => void send(true)}>{sending ? copy.sending : copy.retry}</button>
      </div>}
    </div>
  </aside>;
}
