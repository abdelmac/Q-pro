import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Flag, LockKeyhole, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useCommunityAuth } from '@/lib/CommunityAuthContext';
import { communityApi, COMMUNITY_PUBLICATION_VERSION, type CommunityComment, type CommunityProfile, type OwnCommunityComment } from '@/lib/community';
import { useLanguage } from '@/lib/LanguageContext';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { translateSpecialtyName } from '@/data/i18n';
import { COMMUNITY_COPY } from '@/data/communityI18n';
import CommunityShell, { CARD, FIELD, PRIMARY, SECONDARY } from './CommunityShell';

interface Props { onBack: () => void; onHome: () => void; onAccount: () => void }
export default function CommunityPage({ onBack, onHome, onAccount }: Props) {
  const { lang } = useLanguage();
  const auth = useCommunityAuth();
  const copy = COMMUNITY_COPY[lang];
  return <CommunityShell title={copy.community} subtitle={copy.intro} onBack={onBack} onHome={onHome}>
    {auth.loading || auth.statusLoading ? <p role="status">{copy.loading}</p> : !auth.enabled ? <div className={CARD}><p className="text-sm leading-6 text-ink-600">{copy.unavailable}</p><div className="mt-4 flex flex-wrap gap-3"><button className={SECONDARY} onClick={() => void auth.refreshStatus().catch(() => undefined)}>{copy.refresh}</button><button className={SECONDARY} onClick={onAccount}>{copy.account}</button></div></div>
      : !auth.user ? <section className={`${CARD} mx-auto max-w-2xl text-center`}>
        <LockKeyhole className="mx-auto h-9 w-9 text-brand-700" aria-hidden="true" /><p className="mt-4 text-base leading-7 text-ink-600">{copy.membersOnly}</p>
        <button className={`${PRIMARY} mt-6`} onClick={onAccount}>{copy.login} / {copy.signup}</button><button className={`${SECONDARY} mx-auto mt-3 block`} onClick={onBack}>{copy.guest}</button>
      </section> : <MemberGate key={auth.user.id} onAccount={onAccount} />}
  </CommunityShell>;
}

function MemberGate({ onAccount }: { onAccount: () => void }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false); setProfile(null);
    void communityApi.profile(controller.signal).then(value => { if (!controller.signal.aborted) setProfile(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  if (loading) return <p role="status">{copy.loading}</p>;
  if (failed) return <div className={CARD}><p role="alert" className="text-sm text-red-700">{copy.failed}</p><button className={`${SECONDARY} mt-3`} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button></div>;
  if (!profile) return <section className={CARD}><p className="text-sm leading-6 text-ink-600">{copy.finishProfile}</p><button className={`${PRIMARY} mt-4`} onClick={onAccount}>{copy.profile}</button></section>;
  if (profile.suspended) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><p role="alert">{copy.suspended}</p><p className="mt-3 text-sm">{copy.ownAccess}</p><button className={`${SECONDARY} mt-3`} onClick={onAccount}>{copy.account}</button></div>;
  return <MemberCommunity profile={profile} onAccount={onAccount} />;
}

function MemberCommunity({ profile, onAccount }: { profile: CommunityProfile; onAccount: () => void }) {
  const { lang } = useLanguage();
  const { specialties } = useSpecialtyCatalog();
  const copy = COMMUNITY_COPY[lang];
  const [specialty, setSpecialty] = useState('');
  const [revision, setRevision] = useState(0);
  const [own, setOwn] = useState<OwnCommunityComment[]>([]);
  const [ownFailed, setOwnFailed] = useState(false);
  const [ownLoading, setOwnLoading] = useState(false);
  const [result, setResult] = useState<{ filter: string; items: CommunityComment[]; next: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  const readLock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
  const visible = result?.filter === specialty ? result : null;
  const ownIds = new Set(own.map(item => item.id));

  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort(); request.current = controller; readLock.current = true;
    setLoading(true); setFailed(false); setResult(null);
    void communityApi.listComments({ specialty: specialty || undefined, signal: controller.signal }).then(page => {
      if (!controller.signal.aborted) setResult({ filter: specialty, ...page });
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); readLock.current = false; } });
    return () => controller.abort();
  }, [specialty, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setOwn([]); setOwnFailed(false);
    if (profile.role !== 'specialist') return () => controller.abort();
    setOwnLoading(true);
    void communityApi.myComments(controller.signal).then(items => { if (!controller.signal.aborted) setOwn(items); })
      .catch(() => { if (!controller.signal.aborted) setOwnFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setOwnLoading(false); });
    return () => controller.abort();
  }, [profile.role, revision]);

  const more = async () => {
    if (readLock.current || !visible?.next) return;
    const controller = new AbortController(); request.current?.abort(); request.current = controller; readLock.current = true;
    setLoading(true); setFailed(false);
    try {
      const page = await communityApi.listComments({ after: visible.next, specialty: specialty || undefined, signal: controller.signal });
      if (!controller.signal.aborted && active.current) setResult(previous => previous?.filter === specialty ? {
        filter: specialty, items: [...previous.items, ...page.items.filter(item => !previous.items.some(existing => existing.id === item.id))], next: page.next,
      } : previous);
    } catch { if (!controller.signal.aborted && active.current) { setFailed(true); setResult(null); } }
    finally { if (!controller.signal.aborted && active.current) { setLoading(false); readLock.current = false; } }
  };
  const withdraw = async (id: string) => {
    if (withdrawing || !window.confirm(copy.withdrawConfirm)) return;
    setWithdrawing(id); setActionError(false); setNotice(null);
    try {
      await communityApi.withdrawComment(id);
      if (active.current) { setNotice(copy.withdrawDone); setResult(null); setRevision(value => value + 1); }
    } catch { if (active.current) setActionError(true); }
    finally { if (active.current) setWithdrawing(null); }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-brand-100 bg-white p-5">
      <p className="max-w-3xl text-sm leading-6 text-ink-600"><ShieldCheck className="mr-2 inline h-5 w-5 text-brand-700" aria-hidden="true" />{copy.disclosure}</p>
      <button type="button" className={SECONDARY} onClick={onAccount}>{copy.account}</button>
    </div>
    {profile.role === 'specialist' && <CommentComposer profile={profile} onSent={() => setRevision(value => value + 1)} />}
    {profile.role === 'specialist' && <section className={CARD}>
      <h2 className="text-xl font-semibold text-ink-900">{copy.myPosts}</h2>
      {ownLoading && <p role="status" className="mt-4 text-sm">{copy.loading}</p>}
      {ownFailed && <div className="mt-4"><p role="alert" className="text-sm text-red-700">{copy.failed}</p><button className={`${SECONDARY} mt-3`} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button></div>}
      {!ownFailed && !ownLoading && !own.length && <p className="mt-4 text-sm text-ink-500">{copy.noOwnPosts}</p>}
      <div className="mt-4 space-y-4">{own.map(item => <article key={item.id} className="rounded-xl border border-ink-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-brand-800">{translateSpecialtyName(item.specialty, lang)}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'approved' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-900'}`}>{copy[item.status]}</span></div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-700">{item.body}</p>
        {item.status !== 'withdrawn' && <button type="button" className={`${SECONDARY} mt-3`} disabled={withdrawing !== null} onClick={() => void withdraw(item.id)}>{withdrawing === item.id ? copy.busy : copy.withdraw}</button>}
      </article>)}</div>
      {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{copy.failed}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-brand-800">{notice}</p>}
    </section>}
    <section aria-labelledby="community-feed-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="community-feed-title" className="font-display text-2xl font-semibold text-ink-900">{copy.feed}</h2>
        <label className="w-full max-w-sm text-sm font-medium text-ink-700">{copy.specialty}<select className={FIELD} value={specialty} onChange={event => setSpecialty(event.target.value)}><option value="">{copy.allSpecialties}</option>{specialties.map(item => <option key={item.name} value={item.name}>{translateSpecialtyName(item.name, lang)}</option>)}</select></label>
      </div>
      {visible?.items.map(item => <article key={item.id} className={CARD}>
        <h3 className="flex items-center gap-2 text-base font-semibold text-brand-800"><MessageSquareText className="h-5 w-5 shrink-0" aria-hidden="true" />{translateSpecialtyName(item.specialty, lang)}</h3>
        <p lang={item.language} className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-ink-700">{item.body}</p>
        {!ownIds.has(item.id) && <ReportComment id={item.id} />}
      </article>)}
      {loading && <p role="status" className="text-sm text-ink-500">{copy.loading}</p>}
      {failed && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">{copy.failed}</p><button type="button" className={`${SECONDARY} mt-3`} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button></div>}
      {!loading && !failed && visible?.items.length === 0 && <p className={`${CARD} text-sm text-ink-500`}>{copy.empty}</p>}
      {visible?.next && <button type="button" className={SECONDARY} disabled={loading} onClick={() => void more()}>{copy.more}</button>}
    </section>
  </div>;
}

function CommentComposer({ profile, onSent }: { profile: CommunityProfile; onSent: () => void }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [body, setBody] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !consent || body.trim().length < 10 || body.length > 2000) return;
    setBusy(true); setError(false); setSent(false);
    try {
      await communityApi.submitComment({ id, body: body.trim(), language: lang, consent, consent_version: COMMUNITY_PUBLICATION_VERSION });
      if (active.current) { setBody(''); setConsent(false); setSent(true); setId(crypto.randomUUID()); onSent(); }
    } catch { if (active.current) setError(true); }
    finally { if (active.current) setBusy(false); }
  };
  return <section className={CARD}>
    <h2 className="text-xl font-semibold text-ink-900">{copy.write}</h2>
    <p className="mt-2 text-sm font-medium text-brand-800">{profile.specialty && translateSpecialtyName(profile.specialty, lang)}</p>
    {!profile.verified && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{copy.awaitingVerification}. {copy.verificationHelp}</p>}
    <form className="mt-5 space-y-4" onSubmit={event => void submit(event)}>
      <label className="block text-sm font-medium text-ink-700">{copy.message}<textarea className={`${FIELD} resize-y`} rows={5} required minLength={10} maxLength={2000} value={body} disabled={busy} onChange={event => { setBody(event.target.value); setSent(false); }} aria-describedby="community-message-help" /></label>
      <p id="community-message-help" className="text-xs leading-6 text-ink-500">{copy.messageHelp}</p><p className="text-right text-xs tabular-nums text-ink-500">{body.length}/2000</p>
      <label className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-ink-700"><input type="checkbox" required checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-800" />{copy.publicationConsent}</label>
      {error && <p role="alert" className="text-sm text-red-700">{copy.failed}</p>}
      {sent && <p role="status" className="text-sm text-brand-800">{copy.submitted}</p>}
      <button type="submit" className={PRIMARY} disabled={busy || !consent || body.trim().length < 10 || body.length > 2000}>{busy ? copy.busy : copy.submit}</button>
    </form>
  </section>;
}

function ReportComment({ id }: { id: string }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<'identifying' | 'medical-advice' | 'other'>('identifying');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setFailed(false);
    try { await communityApi.reportComment(id, reason); if (active.current) { setSent(true); setOpen(false); } }
    catch { if (active.current) setFailed(true); }
    finally { if (active.current) setBusy(false); }
  };
  return <div className="mt-4 border-t border-ink-100 pt-3">
    {sent ? <p role="status" className="text-xs text-brand-800">{copy.reportDone}</p> : !open ? <button type="button" className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-ink-500 hover:text-brand-800" onClick={() => setOpen(true)}><Flag className="h-3.5 w-3.5" aria-hidden="true" />{copy.report}</button> : <form onSubmit={event => void submit(event)} className="space-y-3">
      <label className="block text-sm text-ink-700">{copy.reportReason}<select value={reason} disabled={busy} className={FIELD} onChange={event => setReason(event.target.value as typeof reason)}><option value="identifying">{copy.identifying}</option><option value="medical-advice">{copy.medicalAdvice}</option><option value="other">{copy.other}</option></select></label>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className={PRIMARY}>{busy ? copy.busy : copy.reportSend}</button><button type="button" disabled={busy} className={SECONDARY} onClick={() => setOpen(false)}>{copy.cancel}</button></div>
      {failed && <p role="alert" className="text-sm text-red-700">{copy.failed}</p>}
    </form>}
  </div>;
}
