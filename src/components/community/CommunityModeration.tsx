import { useEffect, useRef, useState } from 'react';
import { useCommunityAuth } from '@/lib/CommunityAuthContext';
import { communityApi, type AdminCommunityMember, type AdminCommunityComment } from '@/lib/community';
import { useLanguage } from '@/lib/LanguageContext';
import { COMMUNITY_COPY } from '@/data/communityI18n';
import { translateSpecialtyName } from '@/data/i18n';
import { CARD, FIELD, PRIMARY, SECONDARY } from './CommunityShell';

export default function CommunityModeration() {
  const { user } = useCommunityAuth();
  return user ? <ModerationWorkspace key={user.id} identity={user.id} /> : null;
}

function ModerationWorkspace({ identity }: { identity: string }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [tab, setTab] = useState<'members' | 'comments'>('members');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [members, setMembers] = useState<AdminCommunityMember[]>([]);
  const [comments, setComments] = useState<AdminCommunityComment[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const key = `${tab}:${status}`;
  const request = useRef<AbortController | null>(null);
  const readLock = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);

  useEffect(() => {
    const controller = new AbortController(); request.current?.abort(); request.current = controller; readLock.current = true;
    setLoading(true); setFailed(false); setLoadedKey(''); setMembers([]); setComments([]); setNext(null);
    const fetch = async () => {
      try {
        if (tab === 'members') {
          const page = await communityApi.adminMembers({ signal: controller.signal });
          if (!controller.signal.aborted) { setMembers(page.items); setNext(page.next); }
        } else {
          const page = await communityApi.adminComments({ status, signal: controller.signal });
          if (!controller.signal.aborted) { setComments(page.items); setNext(page.next); }
        }
        if (!controller.signal.aborted) setLoadedKey(`${tab}:${status}`);
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) { setLoading(false); readLock.current = false; } }
    };
    void fetch(); return () => controller.abort();
  }, [tab, status, revision]);

  const more = async () => {
    if (!next || readLock.current) return;
    const controller = new AbortController(); request.current?.abort(); request.current = controller; readLock.current = true;
    setLoading(true); setFailed(false);
    try {
      if (tab === 'members') {
        const page = await communityApi.adminMembers({ after: next, signal: controller.signal });
        if (!controller.signal.aborted) { setMembers(previous => [...previous, ...page.items.filter(item => !previous.some(existing => existing.id === item.id))]); setNext(page.next); }
      } else {
        const page = await communityApi.adminComments({ after: next, status, signal: controller.signal });
        if (!controller.signal.aborted) { setComments(previous => [...previous, ...page.items.filter(item => !previous.some(existing => existing.id === item.id))]); setNext(page.next); }
      }
    } catch { if (!controller.signal.aborted && active.current) { setFailed(true); setMembers([]); setComments([]); setLoadedKey(''); setNext(null); } }
    finally { if (!controller.signal.aborted && active.current) { setLoading(false); readLock.current = false; } }
  };

  return <section data-community-moderation className="space-y-5">
    <div className="flex flex-wrap items-center gap-3">
      {(['members', 'comments'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} className={tab === value ? PRIMARY : SECONDARY} onClick={() => setTab(value)}>{copy[value]}</button>)}
      {tab === 'comments' && <label className="ml-auto w-full max-w-xs text-sm text-ink-700">{copy.comments}<select className={FIELD} value={status} onChange={event => setStatus(event.target.value as typeof status)}>{(['pending', 'approved', 'rejected'] as const).map(value => <option key={value} value={value}>{copy[value]}</option>)}</select></label>}
      <button type="button" className={SECONDARY} disabled={loading} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button>
    </div>
    {loading && <p role="status" className="text-sm text-ink-500">{copy.loading}</p>}
    {failed && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{copy.failed}</p>}
    {loadedKey === key && <div className="space-y-4">
      {tab === 'members' ? members.map(item => <MemberReview key={`${item.id}:${revision}`} member={item} identity={identity} onReviewed={() => setRevision(value => value + 1)} />)
        : comments.map(item => <CommentReview key={`${item.id}:${revision}`} comment={item} identity={identity} onReviewed={() => setRevision(value => value + 1)} />)}
      {!loading && !(tab === 'members' ? members.length : comments.length) && <p className={`${CARD} text-sm text-ink-500`}>{tab === 'members' ? copy.noMembers : copy.noComments}</p>}
      {next && <button type="button" className={SECONDARY} disabled={loading} onClick={() => void more()}>{copy.more}</button>}
    </div>}
  </section>;
}

function MemberReview({ member, identity, onReviewed }: { member: AdminCommunityMember; identity: string; onReviewed: () => void }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const self = member.id === identity;
  const canReview = !self && !busy && note.trim().length >= 10 && note.length <= 500;
  const review = async (verified: boolean, suspended: boolean) => {
    if (!canReview) return;
    setBusy(true); setFailed(false);
    try { await communityApi.reviewMember({ id: member.id, verified, suspended, note: note.trim() }); if (active.current) onReviewed(); }
    catch { if (active.current) setFailed(true); }
    finally { if (active.current) setBusy(false); }
  };
  return <article className={CARD}>
    <h3 className="break-all text-base font-semibold text-ink-900">{member.email}</h3>
    <p className="mt-2 text-sm text-ink-600">{copy[member.role]}{member.specialty ? ` · ${translateSpecialtyName(member.specialty, lang)}` : ''}</p>
    {member.role === 'specialist' && <p className="mt-2 text-xs font-semibold text-brand-800">{member.verified ? copy.verified : copy.awaitingVerification}</p>}
    {member.suspended && <p className="mt-2 text-xs text-amber-900">{copy.suspended}</p>}
    {self ? <p className="mt-4 text-sm text-ink-500">{copy.selfReview}</p> : <>
      <label className="mt-4 block text-sm font-medium text-ink-700">{copy.moderationNote}<textarea className={FIELD} value={note} rows={2} minLength={10} maxLength={500} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      <div className="mt-4 flex flex-wrap gap-2">
        {member.role === 'specialist' && <button type="button" className={PRIMARY} disabled={!canReview || (!member.verified && member.suspended)} onClick={() => void review(!member.verified, member.suspended)}>{member.verified ? copy.revoke : copy.verify}</button>}
        <button type="button" className={SECONDARY} disabled={!canReview} onClick={() => void review(member.verified, !member.suspended)}>{member.suspended ? copy.restore : copy.suspend}</button>
      </div>
    </>}
    {busy && <p role="status" className="mt-3 text-sm">{copy.busy}</p>}{failed && <p role="alert" className="mt-3 text-sm text-red-700">{copy.failed}</p>}
  </article>;
}

function CommentReview({ comment, identity, onReviewed }: { comment: AdminCommunityComment; identity: string; onReviewed: () => void }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const self = comment.author_id === identity;
  const canReview = !busy && note.trim().length >= 10 && note.length <= 500;
  const review = async (approve: boolean) => {
    if (!canReview || (approve && (self || !comment.verified))) return;
    setBusy(true); setFailed(false);
    try { await communityApi.reviewComment({ id: comment.id, approve, note: note.trim() }); if (active.current) onReviewed(); }
    catch { if (active.current) setFailed(true); }
    finally { if (active.current) setBusy(false); }
  };
  return <article className={CARD}>
    <div className="flex flex-wrap justify-between gap-3"><h3 className="text-base font-semibold text-brand-800">{translateSpecialtyName(comment.specialty, lang)}</h3><span className="text-xs font-semibold text-ink-500">{copy[comment.status]}</span></div>
    <p className="mt-2 break-all text-xs text-ink-500">{comment.email}</p>
    <p lang={comment.language} className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-ink-700">{comment.body}</p>
    <p className="mt-3 text-xs font-semibold text-ink-600">{copy.reports}: {comment.report_count} · {comment.verified ? copy.verified : copy.awaitingVerification}</p>
    {self && <p className="mt-3 text-sm text-amber-900">{copy.selfReview}</p>}
    <label className="mt-4 block text-sm font-medium text-ink-700">{copy.moderationNote}<textarea className={FIELD} rows={2} minLength={10} maxLength={500} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={PRIMARY} disabled={!canReview || self || !comment.verified || comment.status === 'approved' || comment.status === 'withdrawn'} onClick={() => void review(true)}>{copy.approve}</button><button type="button" className={SECONDARY} disabled={!canReview || comment.status === 'rejected' || comment.status === 'withdrawn'} onClick={() => void review(false)}>{copy.reject}</button></div>
    {busy && <p role="status" className="mt-3 text-sm">{copy.busy}</p>}{failed && <p role="alert" className="mt-3 text-sm text-red-700">{copy.failed}</p>}
  </article>;
}
