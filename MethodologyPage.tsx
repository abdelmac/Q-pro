import { useLanguage } from '@/lib/LanguageContext';
import { DEFAULT_PRIORITY_WEIGHTS, type Dimension, type PriorityWeights } from '@/lib/scoring';
import { RotateCcw, ArrowRight } from 'lucide-react';

interface AdjustablePrioritiesProps {
  weights: PriorityWeights;
  onChange: (weights: PriorityWeights) => void;
  onContinue: () => void;
  onReset: () => void;
}

export default function AdjustablePriorities({ weights, onChange, onContinue, onReset }: AdjustablePrioritiesProps) {
  const { t } = useLanguage();

  const dims: { key: Dimension; label: string }[] = [
    { key: 'thinking', label: t.priorityThinking },
    { key: 'working', label: t.priorityWorking },
    { key: 'interpersonal', label: t.priorityInterpersonal },
    { key: 'technical', label: t.priorityTechnical },
    { key: 'lifestyle', label: t.priorityLifestyle },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
      <div className="text-center mb-8">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 mb-3 text-balance">
          {t.prioritiesTitle}
        </h2>
        <p className="text-ink-500 leading-relaxed text-balance">
          {t.prioritiesSubtitle}
        </p>
      </div>

      <div className="space-y-6 mb-8">
        {dims.map(({ key, label }) => (
          <div key={key} className="p-5 rounded-2xl bg-white border border-ink-100 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink-800">{label}</span>
              <span className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${
                weights[key] > 55 ? 'bg-brand-50 text-brand-700' :
                weights[key] < 45 ? 'bg-ink-100 text-ink-500' :
                'bg-ink-50 text-ink-400'
              }`}>
                {weights[key] > 55 ? t.priorityMore : weights[key] < 45 ? t.priorityLess : t.priorityNeutral}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[key]}
              onChange={(e) => onChange({ ...weights, [key]: Number(e.target.value) })}
              className="w-full accent-brand-600 cursor-pointer"
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-ink-400 uppercase tracking-wide">
              <span>{t.priorityLess}</span>
              <span>{t.priorityNeutral}</span>
              <span>{t.priorityMore}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full text-sm font-medium text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t.prioritiesReset}
        </button>
        <button
          onClick={onContinue}
          className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          {t.prioritiesContinue}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

export { DEFAULT_PRIORITY_WEIGHTS, type PriorityWeights };
