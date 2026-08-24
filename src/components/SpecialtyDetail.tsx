import { useLanguage } from '@/lib/LanguageContext';
import { SPECIALTIES, type Specialty } from '@/data/specialties';
import { SPECIALTY_METADATA } from '@/data/specialtyMetadata';
import { translateSpecialtyName, translateCategory, translateBlurb } from '@/data/i18n';
import { prettyTrait } from '@/data/traits';
import { ArrowLeft } from 'lucide-react';

interface SpecialtyDetailProps {
  specialtyName: string;
  score?: number;
  onBack: () => void;
}

export default function SpecialtyDetail({ specialtyName, score, onBack }: SpecialtyDetailProps) {
  const { t, lang } = useLanguage();
  const specialty = SPECIALTIES.find((s) => s.name === specialtyName);
  if (!specialty) return null;
  const meta = SPECIALTY_METADATA[specialtyName];
  const blurb = translateBlurb(specialtyName, lang) || specialty.blurb;

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

        <p className="text-base text-ink-600 leading-relaxed mb-8">{blurb}</p>

        {meta && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <InfoCard label={t.explorerWorkStyle} value={meta.workStyle} />
              <InfoCard label={t.explorerPatientContact} value={meta.patientContact} />
              <InfoCard label={t.explorerCareType} value={meta.careType} />
              <InfoCard label={t.explorerProceduralIntensity} value={meta.proceduralIntensity} />
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">{t.explorerKeyTraits}</h3>
              <div className="flex flex-wrap gap-2">
                {meta.keyTraits.map((trait) => (
                  <span key={trait} className="inline-flex items-center px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium">
                    {prettyTrait(trait)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">{t.explorerReferences}</h3>
              <ul className="space-y-1.5">
                {meta.references.map((ref) => (
                  <li key={ref} className="text-sm text-ink-600">{ref}</li>
                ))}
              </ul>
            </div>
          </>
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
