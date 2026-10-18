import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { VISITOR_COUNTER_COPY } from '@/data/visitorCounterI18n';
import type { SiteVisitCount } from '@/lib/siteVisitCounter';

export default function VisitorCounter() {
  const { lang } = useLanguage();
  const copy = VISITOR_COUNTER_COPY[lang];
  const [count, setCount] = useState<SiteVisitCount | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    void import('@/lib/siteVisitApi').then(({ siteVisitCounter }) => siteVisitCounter.load(attempt > 0))
      .then(result => {
        if (!active) return;
        setCount(result);
        setStatus('ready');
      }).catch(() => {
        if (active) setStatus('error');
      });
    return () => { active = false; };
  }, [attempt]);

  const locale = { en: 'en-GB', fr: 'fr-FR', ro: 'ro-RO' }[lang];
  return (
    <section data-visitor-counter className="mx-auto mt-6 max-w-lg text-center" aria-label={copy.label}>
      <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm text-ink-600">
        <Users className="h-4 w-4 text-brand-600" aria-hidden="true" />
        <span>{copy.label}</span>
        <span data-visitor-count aria-live="polite" aria-atomic="true" className="font-semibold tabular-nums text-brand-800">
          {status === 'ready' && count ? new Intl.NumberFormat(locale).format(count.total) : '—'}
        </span>
      </div>
      {status !== 'ready' && <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-xs text-ink-500">
        <span role="status">{status === 'error' ? copy.unavailable : copy.loading}</span>
        {status === 'error' && <button data-visitor-retry type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 rounded-lg px-2 font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900 focus-visible:ring-2 focus-visible:ring-brand-500">
          {copy.retry}
        </button>}
      </div>}
    </section>
  );
}
