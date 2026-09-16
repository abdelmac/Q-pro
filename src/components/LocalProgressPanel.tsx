import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { LOCAL_PROGRESS_COPY } from '@/data/localProgressI18n';
import { getLocalResearchStorage, notifyQueueChange, QUEUE_CHANGE_EVENT } from '@/lib/localResearchStorage';
import { flushPendingResearchSubmissions } from '@/lib/supabase';
import { isNativeApp } from '@/lib/mobileRuntime';
import type { PendingSubmission } from '@/lib/submissionQueue';

export interface LocalProgressPanelProps {
  enabled: boolean; onEnabledChange: (value: boolean) => void;
  status: 'loading' | 'ready' | 'saving' | 'saved' | 'unavailable' | 'invalid';
  hasResume: boolean; onResume: () => void; onDiscard: () => void;
}

export default function LocalProgressPanel(props: LocalProgressPanelProps) {
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
  const button = 'min-h-11 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40';
  return <aside className="border-b border-ink-100 bg-white px-4 py-2 text-xs text-ink-600" aria-label={copy.title}>
    <div className="mx-auto max-w-6xl">
      {props.hasResume && <div className="flex flex-wrap items-center gap-3 py-2" role="status">
        <p>{copy.resume}</p><button className={button} onClick={props.onResume}>{copy.resumeButton}</button>
        <button className={button} onClick={props.onDiscard}>{copy.discard}</button>
      </div>}
      {props.status === 'invalid' && <div role="alert" className="py-2"><p>{copy.invalid}</p><button className={button} onClick={props.onDiscard}>{copy.discard}</button></div>}
      {props.status === 'unavailable' && <p role="alert" className="py-2 text-amber-800">{copy.unavailable}</p>}
      <details open={pending.length > 0 || queueError || sendError ? true : undefined}>
        <summary className="min-h-8 cursor-pointer py-2 font-medium">{copy.title}{props.status === 'saved' ? ` · ${copy.saved}` : props.status === 'saving' ? ` · ${copy.saving}` : ''}{pending.length ? ` · ${pending.length}` : ''}</summary>
        <div className="space-y-3 pb-3 leading-relaxed">
          <p>{copy.notice} {isNativeApp() ? copy.native : copy.browser}</p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={props.enabled} onChange={event => props.onEnabledChange(event.target.checked)} />{copy.enable}</label>
            <button className={button} onClick={props.onDiscard}>{copy.discard}</button>
          </div>
          {queueError && <div role="alert"><p>{copy.queueError}</p><button className={button} onClick={() => void remove()}>{copy.clearQueue}</button></div>}
          {sendError && <p role="alert" className="text-amber-800">{copy.sendError}</p>}
          {pending.length > 0 && <div aria-live="polite" className="space-y-2 rounded-xl bg-amber-50 p-3">
            <h2 className="font-semibold">{copy.pending}: {pending.length}</h2><p>{copy.queueHelp}</p>
            <ul className="space-y-2">{pending.map((item, index) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>#{index + 1} — {item.status === 'rejected' ? copy.rejected : item.status === 'expired' ? copy.expired : copy.queued}</span>
              <button className={button} disabled={sending} onClick={() => void remove(item.id)}>{copy.remove}</button>
            </li>)}</ul>
            <button className={button} disabled={sending || !pending.some(item => item.status === 'pending')} onClick={() => void send(true)}>{sending ? copy.sending : copy.retry}</button>
          </div>}
        </div>
      </details>
    </div>
  </aside>;
}
