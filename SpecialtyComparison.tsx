import { VALUE_OPTIONS } from '@/data/traits';
import { translateValue } from '@/data/i18n';
import { useLanguage } from '@/lib/LanguageContext';
import { Check } from 'lucide-react';

interface ValuesStepProps {
  selected: string[];
  onToggle: (value: string) => void;
  max?: number;
}

export default function ValuesStep({ selected, onToggle, max = 4 }: ValuesStepProps) {
  const { lang, t } = useLanguage();
  const remaining = max - selected.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-500">
          {remaining === max
            ? t.valuesSelectUpTo(max)
            : remaining > 0
            ? t.valuesMoreToSelect(remaining)
            : t.valuesAllSelected}
        </p>
        <div className="flex gap-1.5">
          {Array.from({ length: max }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < selected.length ? 'bg-brand-500' : 'bg-ink-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {VALUE_OPTIONS.map((key) => {
          const active = selected.includes(key);
          const disabled = !active && selected.length >= max;
          const label = translateValue(key, lang);
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              disabled={disabled}
              className={`group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border text-left text-sm transition-all duration-150 ${
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-soft'
                  : disabled
                  ? 'border-ink-100 bg-ink-50 text-ink-300 cursor-not-allowed'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              <span className="font-medium leading-snug">{label}</span>
              <span
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  active
                    ? 'border-brand-500 bg-brand-500'
                    : disabled
                    ? 'border-ink-200'
                    : 'border-ink-200 group-hover:border-ink-300'
                }`}
              >
                {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
