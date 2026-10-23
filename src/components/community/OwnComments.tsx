import { useEffect, useRef, useState } from 'react';
import { communityApi, type OwnCommunityComment } from '@/lib/community';
import { useLanguage } from '@/lib/LanguageContext';
import { COMMUNITY_COPY } from '@/data/communityI18n';
import { translateSpecialtyName } from '@/data/i18n';
import { CARD, SECONDARY } from './CommunityShell';

/** Owner-only withdrawal stays available during a community pause or suspension. */
export default function OwnComments() {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [items, setItems] = useState<OwnCommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailed(false); setItems([]);
    void communityApi.myComments(controller.signal).then(value => { if (!controller.signal.aborted) setItems(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const withdraw = async (id: string) => {
    if (busy || !window.confirm(copy.withdrawConfirm)) return;
    setBusy(id); setFailed(false); setNotice(false);
    try {
      await communityApi.withdrawComment(id);
      if (active.current) { setNotice(true); setRevision(value => value + 1); }
    } catch { if (active.current) setFailed(true); }
    finally { if (active.current) setBusy(null); }
  };
  return <section className={`${CARD} mt-5`} data-community-own-comments>
    <h2 className="text-xl font-semibold text-ink-900">{copy.myPosts}</h2><p className="mt-2 text-sm leading-6 text-ink-600">{copy.ownAccess}</p>
    {loading && <p role="status" className="mt-4 text-sm">{copy.loading}</p>}
    {!loading && !failed && !items.length && <p className="mt-4 text-sm text-ink-500">{copy.noOwnPosts}</p>}
    <div className="mt-4 space-y-4">{items.map(item => <article key={item.id} className="rounded-xl border border-ink-100 p-4">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="text-sm font-semibold text-brand-800">{translateSpecialtyName(item.specialty, lang)}</h3><span className="text-xs font-semibold text-ink-500">{copy[item.status]}</span></div>
      <p lang={item.language} className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-700">{item.body}</p>
      {item.status !== 'withdrawn' && <button type="button" className={`${SECONDARY} mt-3`} disabled={busy !== null} onClick={() => void withdraw(item.id)}>{busy === item.id ? copy.busy : copy.withdraw}</button>}
    </article>)}</div>
    {failed && <div className="mt-4"><p role="alert" className="text-sm text-red-700">{copy.failed}</p><button type="button" className={`${SECONDARY} mt-3`} disabled={busy !== null || loading} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button></div>}
    {notice && <p role="status" className="mt-3 text-sm text-brand-800">{copy.withdrawDone}</p>}
  </section>;
}
