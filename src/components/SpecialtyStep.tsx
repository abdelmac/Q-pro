import { useState } from 'react';
import { CATEGORY_ORDER, type Specialty } from '@/data/specialties';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import { useLanguage } from '@/lib/LanguageContext';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { Check, Search } from 'lucide-react';

interface SpecialtyStepProps {
  selected: string | null;
  onChange: (name: string | null) => void;
  emptyMessage?: string;
}

export default function SpecialtyStep({ selected, onChange, emptyMessage }: SpecialtyStepProps) {
  const { lang, t } = useLanguage();
  const { specialties } = useSpecialtyCatalog();
  const [query, setQuery] = useState('');

  const grouped: Record<string, Specialty[]> = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  for (const s of specialties) {
    const translated = translateSpecialtyName(s.name, lang).toLowerCase();
    if (translated.includes(query.toLowerCase())) {
      grouped[s.category]?.push(s);
    }
  }

  return (
    <div role="group" aria-describedby="specialty-selection-status">
      <div className="relative mb-6">
        <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
        />
      </div>

      <div id="specialty-selection-status" role="status" aria-live="polite" className="mb-5 text-sm text-ink-500">
        {selected ? (
          <span className="inline-flex items-center gap-1.5 text-brand-700 font-medium">
            <Check className="w-4 h-4" />
            {translateSpecialtyName(selected, lang)} {t.specialtySelected}
          </span>
        ) : (
          <span>{emptyMessage ?? t.specialtyOptional}</span>
        )}
      </div>

      <div className="space-y-7">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
                {translateCategory(cat, lang)}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {items.map((s) => {
                  const active = selected === s.name;
                  return (
                    <button
                      key={s.name}
                      onClick={() => onChange(active ? null : s.name)}
                      aria-pressed={active}
                      className={`group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all duration-150 ${
                        active
                          ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-soft'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
                      }`}
                    >
                      <span className="font-medium leading-snug">{translateSpecialtyName(s.name, lang)}</span>
                      <span
                        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          active ? 'border-brand-500 bg-brand-500' : 'border-ink-200 group-hover:border-ink-300'
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
        })}
      </div>
    </div>
  );
}
