import { useLanguage } from '@/lib/LanguageContext';
import { prettyTrait } from '@/data/traits';
import { getTopTraits, getBottomTraits } from '@/lib/scoring';
import { ArrowRight } from 'lucide-react';

interface QProfileProps {
  traits: Record<string, number>;
  onContinue: () => void;
}

export default function QProfile({ traits, onContinue }: QProfileProps) {
  const { t } = useLanguage();
  const top = getTopTraits(traits, 12);
  const bottom = getBottomTraits(traits, 6);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-fade-up">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 mb-3 text-balance">
          {t.qProfileTitle}
        </h2>
        <p className="text-ink-500 leading-relaxed text-balance">
          {t.qProfileSubtitle}
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-4">
          {t.qProfileTopTraits}
        </h3>
        <div className="space-y-2.5">
          {top.map(({ trait, score }) => (
            <div key={trait} className="flex items-center gap-3">
              <span className="w-44 text-sm font-medium text-ink-700 shrink-0">
                {prettyTrait(trait)}
              </span>
              <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 origin-left transition-all duration-700"
                  style={{ width: `${Math.round(score)}%` }}
                />
              </div>
              <span className="text-xs text-ink-400 tabular-nums w-9 text-right">{Math.round(score)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-4">
          {t.qProfileBottomTraits}
        </h3>
        <div className="space-y-2.5">
          {bottom.map(({ trait, score }) => (
            <div key={trait} className="flex items-center gap-3">
              <span className="w-44 text-sm font-medium text-ink-500 shrink-0">
                {prettyTrait(trait)}
              </span>
              <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-ink-300 origin-left transition-all duration-700"
                  style={{ width: `${Math.round(score)}%` }}
                />
              </div>
              <span className="text-xs text-ink-400 tabular-nums w-9 text-right">{Math.round(score)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onContinue}
          className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          {t.qProfileContinue}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
