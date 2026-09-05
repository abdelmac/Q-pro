import { useLanguage } from '@/lib/LanguageContext';
import { SPECIALTY_METADATA } from '@/data/specialtyMetadata';
import { getSpecialtyNarrative, hasSpecialistAuthoredNarrative } from '@/data/specialtyNarratives';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import {
  translateCareType,
  translatePatientContact,
  translateProceduralIntensity,
  translateTrait,
  translateWorkStyle,
} from '@/data/specialtyDisplayI18n';
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
  const meta = SPECIALTY_METADATA[specialtyName];
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
  const suppliedReferences = hasSuppliedNarrative
    ? suppliedNarrative?.sourceReferences ?? []
    : [];
  const metadataReferences = meta?.references ?? [];

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

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                  {t.resultsSourceReferences}
                </h3>
                {suppliedReferences.length > 0 ? (
                  <>
                    <ul className="space-y-1.5">
                      {suppliedReferences.map((reference) => (
                        <li key={reference} className="break-words text-sm leading-relaxed text-ink-600">
                          {reference}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{t.resultsReferencesDisclaimer}</p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-ink-500">{t.resultsNoSourceReferences}</p>
                )}
              </section>
            </div>
          )}
        </section>

        {meta && (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
            <header className="mb-5 border-b border-ink-100 pb-4">
              <h2 className="font-display text-lg font-semibold text-ink-900">
                {t.resultsQProMetadataTitle}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{t.resultsQProMetadataNote}</p>
            </header>

            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoCard label={t.explorerWorkStyle} value={translateWorkStyle(meta.workStyle, lang)} />
              <InfoCard label={t.explorerPatientContact} value={translatePatientContact(meta.patientContact, lang)} />
              <InfoCard label={t.explorerCareType} value={translateCareType(meta.careType, lang)} />
              <InfoCard label={t.explorerProceduralIntensity} value={translateProceduralIntensity(meta.proceduralIntensity, lang)} />
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">{t.explorerKeyTraits}</h3>
              <div className="flex flex-wrap gap-2">
                {meta.keyTraits.map((trait) => (
                  <span key={trait} className="inline-flex items-center px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium">
                    {translateTrait(trait, lang)}
                  </span>
                ))}
              </div>
            </div>

            {metadataReferences.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t.resultsQProMetadataReferences}
                </h3>
                <ul className="space-y-1.5">
                  {metadataReferences.map((reference) => (
                    <li key={reference} className="break-words text-sm leading-relaxed text-ink-600">
                      {reference}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-400">{t.resultsReferencesDisclaimer}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-ink-100">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1.5">{label}</p>
      <p className="text-sm font-medium text-ink-800 capitalize">{value}</p>
    </div>
  );
}
