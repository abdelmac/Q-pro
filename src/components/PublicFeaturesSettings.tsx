import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Globe2, Loader2, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { usePublicFeatures } from '@/lib/PublicFeaturesContext';
import { setPublicMapEnabled } from '@/lib/supabase';
import { PUBLIC_FEATURES_TRANSLATIONS } from '@/data/publicFeaturesI18n';

export default function PublicFeaturesSettings({ testMode = false }: { testMode?: boolean }) {
  const { lang } = useLanguage();
  const copy = PUBLIC_FEATURES_TRANSLATIONS[lang];
  const { publicMapEnabled, status, checkedAt, refresh, invalidate } = usePublicFeatures();
  const [draft, setDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'failed' | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (status === 'ready' && !dirty) setDraft(publicMapEnabled);
  }, [status, publicMapEnabled, dirty]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (testMode || saving || status !== 'ready' || !dirty) return;
    setSaving(true);
    setOutcome(null);
    // Clear public data immediately, including while the mutation is pending.
    invalidate();
    try {
      await setPublicMapEnabled(draft);
      if (!mounted.current) return;
      setDirty(false);
      setOutcome('saved');
    } catch {
      if (mounted.current) setOutcome('failed');
    } finally {
      await refresh();
      if (mounted.current) setSaving(false);
    }
  };

  return <section data-public-features-settings className="max-w-3xl space-y-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{copy.settings} / {copy.title}</p>
    <p className="text-sm leading-relaxed text-ink-600">{copy.description}</p>
    <form onSubmit={save} className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-7">
      <div className="flex gap-3">
        <Globe2 className="mt-1 h-6 w-6 shrink-0 text-brand-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-base font-semibold text-ink-900">
            <span>{copy.mapLabel}</span>
            <input type="checkbox" role="switch" checked={draft} disabled={testMode || saving || status !== 'ready'}
              onChange={event => { setDraft(event.target.checked); setDirty(true); setOutcome(null); }}
              className="h-6 w-6 shrink-0 accent-brand-800 disabled:opacity-40" />
          </label>
          <p className="mt-2 text-sm text-ink-600" role="status">{status === 'checking' ? copy.checking : status === 'unavailable' ? copy.unavailable : publicMapEnabled ? copy.enabled : copy.disabled}</p>
          {checkedAt !== null && <time dateTime={new Date(checkedAt).toISOString()} className="mt-1 block text-xs text-ink-400">{new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(checkedAt)}</time>}
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-ink-600">{copy.explanation}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={testMode || saving || !dirty || status !== 'ready'} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{saving ? copy.saving : copy.save}
        </button>
        <button type="button" onClick={() => void refresh()} disabled={saving || status === 'checking'} className="min-h-11 rounded-full border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 disabled:opacity-40">{copy.retry}</button>
      </div>
      {outcome && <p role={outcome === 'failed' ? 'alert' : 'status'} className={`mt-4 text-sm ${outcome === 'failed' ? 'text-red-700' : 'text-emerald-800'}`}>{outcome === 'failed' ? copy.saveError : copy.saved}</p>}
      {testMode && <p role="status" className="mt-4 text-sm text-amber-800">{copy.testMode}</p>}
    </form>
    <div className="flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-5 text-sm leading-relaxed text-ink-600">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div><p>{copy.privacy}</p><p className="mt-3">{copy.audit}</p></div>
    </div>
  </section>;
}
