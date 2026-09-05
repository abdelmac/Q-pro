import { useLanguage } from '@/lib/LanguageContext';
import { getSpecialtyNarrative, hasSpecialistAuthoredNarrative } from '@/data/specialtyNarratives';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { ArrowLeft } from 'lucide-react';

interface SpecialtyDetailProps {
  specialtyName: string;
  score?: number;
  onBack: () => void;
}

export default function SpecialtyDetail({ specialtyName, score, onBack }: SpecialtyDetailProps) {
  const { t, lang } = useLanguage();
  const { specialties, getDescription, getClinicalSummary } = useSpecialtyCatalog();
  const specialty = specialties.find((s) => s.name === specialtyName);
  if (!specialty) return null;
  const blurb = getDescription(specialtyName, lang) || specialty.blurb;
  const clinicalSummary = getClinicalSummary(specialtyName, lang);
  const hasSuppliedNarrative = hasSpecialistAuthoredNarrative(specialtyName);
  const suppliedNarrative = getSpecialtyNarrative(specialtyName);
  const narrativeMatchesSource = Boolean(
    hasSuppliedNarrative
      && suppliedNarrative
      && suppliedNarrative.overview[lang] === blurb
      && suppliedNarrative.fitProfile[lang] === clinicalSummary,
  );

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.explorerBackToExplorer}
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 mb-2">
            {translateSpecialtyName(specialtyName, lang)}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-400">{translateCategory(specialty.category, lang)}</span>
            {score !== undefined && (
              <span className="text-sm font-semibold text-brand-600">{t.explorerYourMatch}: {Math.round(score)}%</span>
            )}
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-brand-100 bg-brand-50/40 p-5 sm:p-6">
          <header className="mb-5 border-b border-brand-100 pb-4">
            <h2 className="font-display text-lg font-semibold text-brand-900">
              {t.resultsSpecialistNarrativeTitle}
            </h2>
            {(!hasSuppliedNarrative || !narrativeMatchesSource) && (
              <p className="mt-1.5 text-xs leading-relaxed text-brand-800">
                {hasSuppliedNarrative
                  ? t.resultsEditedNarrativeProvenance
                  : t.resultsNoSpecialistNarrative}
              </p>
            )}
          </header>

          {hasSuppliedNarrative && (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                  {t.resultsSpecialtyOverview}
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{blurb}</p>
              </section>

              {clinicalSummary && (
                <section className="rounded-xl border border-brand-100 bg-white/70 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {t.resultsProfessionalProfile}
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{clinicalSummary}</p>
                </section>
              )}

            </div>
          )}
        </section>
      </div>
    </div>
  );
}
