import { useLanguage } from '@/lib/LanguageContext';
import { type Specialty, CATEGORY_ORDER } from '@/data/specialties';
import { SPECIALTY_METADATA } from '@/data/specialtyMetadata';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { translateCareType, translatePatientContact, translateWorkStyle } from '@/data/specialtyDisplayI18n';
import { Search, ArrowLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface SpecialtyExplorerProps {
  scores?: { specialty: Specialty; score: number }[];
  onSelectSpecialty: (name: string) => void;
  onBack: () => void;
}

export default function SpecialtyExplorer({ scores, onSelectSpecialty, onBack }: SpecialtyExplorerProps) {
  const { t, lang } = useLanguage();
  const { specialties, getDescription } = useSpecialtyCatalog();
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const scoreMap = useMemo(() => {
    const m: Record<string, number> = {};
    if (scores) for (const s of scores) m[s.specialty.name] = s.score;
    return m;
  }, [scores]);

  const filtered = useMemo(() => {
    return specialties.filter((s) => {
      const name = translateSpecialtyName(s.name, lang).toLowerCase();
      const matchesQuery = name.includes(query.toLowerCase());
      const matchesCat = !filterCat || s.category === filterCat;
      return matchesQuery && matchesCat;
    });
  }, [query, filterCat, lang, specialties]);

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.explorerBack}
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 mb-2">{t.explorerTitle}</h1>
        <p className="text-ink-500 mb-6">{t.explorerSubtitle}</p>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.explorerSearchPlaceholder}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterCat(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !filterCat ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
            }`}
          >
            {t.explorerAllCategories}
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterCat === cat ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
              }`}
            >
              {translateCategory(cat, lang)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((s) => {
            const meta = SPECIALTY_METADATA[s.name];
            const blurb = getDescription(s.name, lang) || s.blurb;
            const score = scoreMap[s.name];
            return (
              <button
                key={s.name}
                onClick={() => onSelectSpecialty(s.name)}
                className="w-full text-left p-5 rounded-2xl bg-white border border-ink-100 hover:border-ink-200 hover:shadow-soft transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h3 className="font-semibold text-ink-900">{translateSpecialtyName(s.name, lang)}</h3>
                      <span className="text-xs font-medium text-ink-400">{translateCategory(s.category, lang)}</span>
                    </div>
                    <p className="text-sm text-ink-500 leading-relaxed line-clamp-2">{blurb}</p>
                    {meta && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-ink-50 text-ink-500">{translateWorkStyle(meta.workStyle, lang)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-ink-50 text-ink-500">{t.explorerPatientContact}: {translatePatientContact(meta.patientContact, lang)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-ink-50 text-ink-500">{translateCareType(meta.careType, lang)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {score !== undefined && (
                      <span className="font-display text-lg font-semibold text-brand-600 tabular-nums">{Math.round(score)}%</span>
                    )}
                    <ChevronRight className="w-5 h-5 text-ink-300 group-hover:text-ink-500 transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
