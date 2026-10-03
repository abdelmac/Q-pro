import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Globe2, Loader2, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { usePublicFeatures } from '@/lib/PublicFeaturesContext';
import { PUBLIC_FEATURES_TRANSLATIONS } from '@/data/publicFeaturesI18n';

export default function PublicFeaturesSettings({ testMode = false, compact = false, quick = false, onOpenSettings }: {
  testMode?: boolean; compact?: boolean; quick?: boolean; onOpenSettings?: () => void;
}) {
  const { lang } = useLanguage();
  const copy = PUBLIC_FEATURES_TRANSLATIONS[lang];
  const { publicMapEnabled, status, issue, checkedAt, refresh, saving, saveMapVisibility } = usePublicFeatures();
  const [draft, setDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'failed' | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (status === 'ready' && !dirty) setDraft(publicMapEnabled);
  }, [status, publicMapEnabled, dirty]);

  const persist = async (enabled: boolean) => {
    if (testMode || saving || status !== 'ready') return;
    setOutcome(null);
    try {
      await saveMapVisibility(enabled);
      if (!mounted.current) return;
      setDirty(false);
      setOutcome('saved');
    } catch {
      if (mounted.current) setOutcome('failed');
    }
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (dirty) void persist(draft);
  };
  const statusText = status === 'checking' ? copy.checking : status === 'unavailable'
    ? issue === 'setup-required' ? copy.setupRequired : copy.unavailable
    : publicMapEnabled ? copy.enabled : copy.disabled;
  const feedback = <>
    {outcome && <p role={outcome === 'failed' ? 'alert' : 'status'} className={`mt-3 text-sm ${outcome === 'failed' ? 'text-red-700' : 'text-emerald-800'}`}>{outcome === 'failed' ? copy.saveError : copy.saved}</p>}
    {testMode && <p role="status" className="mt-3 text-sm text-amber-800">{copy.testMode}</p>}
  </>;

  if (quick) return <section data-public-features-settings data-public-map-toolbar className="mb-4 rounded-2xl border border-brand-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-900">{copy.title}</h2>
          <p role="status" className={`mt-1 text-sm ${status === 'unavailable' ? 'text-amber-800' : 'text-ink-600'}`}>{statusText}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void persist(!publicMapEnabled)} disabled={testMode || saving || status !== 'ready'}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? copy.saving : status === 'ready' && publicMapEnabled ? copy.hide : copy.show}
        </button>
        {status === 'unavailable' && <button type="button" onClick={() => void refresh()} disabled={saving} className="min-h-11 rounded-xl border border-ink-200 px-3 text-sm font-semibold text-ink-700 disabled:opacity-40">{copy.retry}</button>}
        {onOpenSettings && <button type="button" onClick={onOpenSettings} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50">{copy.settings}</button>}
      </div>
    </div>
    {status === 'unavailable' && issue === 'setup-required' && <p className="mt-3 text-sm text-ink-600">{copy.setupHelp}</p>}
    {feedback}
  </section>;

  return <section data-public-features-settings className={compact ? 'mb-6 space-y-3' : 'mb-6 max-w-3xl space-y-5'}>
    <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-700">{copy.settings} / {copy.title}</h2>
    {!compact && <p className="text-sm leading-relaxed text-ink-600">{copy.description}</p>}
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
          <p className="mt-2 text-sm text-ink-600" role="status">{statusText}</p>
          {status === 'unavailable' && issue === 'setup-required' && <p className="mt-2 text-sm text-amber-800">{copy.setupHelp}</p>}
          {!compact && checkedAt !== null && <time dateTime={new Date(checkedAt).toISOString()} className="mt-1 block text-xs text-ink-400">{new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(checkedAt)}</time>}
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-ink-600">{compact ? copy.compactExplanation : copy.explanation}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={testMode || saving || !dirty || status !== 'ready'} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{saving ? copy.saving : copy.save}
        </button>
        <button type="button" onClick={() => void refresh()} disabled={saving || status === 'checking'} className="min-h-11 rounded-full border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 disabled:opacity-40">{copy.retry}</button>
      </div>
      {feedback}
    </form>
    {!compact && <div className="flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-5 text-sm leading-relaxed text-ink-600">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div><p>{copy.privacy}</p><p className="mt-3">{copy.audit}</p></div>
    </div>}
  </section>;
}
