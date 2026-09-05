import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type SpecialtyScore,
  strongestMatches,
  weakestMatches,
  type Dimension,
} from '@/lib/scoring';
import { CATEGORY_ORDER } from '@/data/specialties';
import { SPECIALTY_METADATA } from '@/data/specialtyMetadata';
import { getSpecialtyNarrative, hasSpecialistAuthoredNarrative } from '@/data/specialtyNarratives';
import {
  translateCareType,
  translatePatientContact,
  translateProceduralIntensity,
  translateTrait,
  translateWorkStyle,
} from '@/data/specialtyDisplayI18n';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import { FEATURE_FLAGS } from '@/config/features';
import { useLanguage } from '@/lib/LanguageContext';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { RESULTS_TOP_COUNT } from '@/lib/resultsPresentation';
import LanguageSwitcher from './LanguageSwitcher';
import {
  Stethoscope, Trophy, RotateCcw, Heart,
  FlaskConical, GitCompare, Compass, BookOpen, AlertCircle, X,
} from 'lucide-react';

interface ResultsProps {
  scores: SpecialtyScore[];
  preferredSpecialty: string | null;
  onRestart: () => void;
  isSpecialist: boolean;
  onContributeData: () => void;
  onOpenExplorer: () => void;
  onOpenComparison: () => void;
  onOpenMethodology: () => void;
}

function MatchRing({ percent, size = 132, label }: { percent: number; size?: number; label: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink-100" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#43ab97" />
            <stop offset="100%" stopColor="#1f7264" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold text-ink-900 tabular-nums">{percent}</span>
        <span className="text-xs font-medium text-ink-400 uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const { lang } = useLanguage();
  const colors: Record<string, string> = {
    Surgical: 'bg-accent-50 text-accent-700 border-accent-200',
    Medical: 'bg-brand-50 text-brand-700 border-brand-200',
    Pediatric: 'bg-blue-50 text-blue-700 border-blue-200',
    Psychiatry: 'bg-purple-50 text-purple-700 border-purple-200',
    'Diagnostic & Support': 'bg-ink-100 text-ink-600 border-ink-200',
    'Public & Preventive': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[category] ?? colors['Diagnostic & Support']}`}>
      {translateCategory(category, lang)}
    </span>
  );
}

const DIMENSION_LABELS: Record<Dimension, string> = {
  thinking: 'subScoreThinking',
  working: 'subScoreWorking',
  interpersonal: 'subScoreInterpersonal',
  technical: 'subScoreTechnical',
  lifestyle: 'subScoreLifestyle',
};

function SpecialtyInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/70 p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="text-sm font-medium text-ink-700">{value}</p>
    </div>
  );
}

interface SpecialtyFactsProps {
  specialtyName: string;
  blurb: string;
  clinicalSummary: string;
  nested?: boolean;
}

function SpecialtyFacts({
  specialtyName,
  blurb,
  clinicalSummary,
  nested = false,
}: SpecialtyFactsProps) {
  const { lang, t } = useLanguage();
  const meta = SPECIALTY_METADATA[specialtyName];
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
  const GroupHeading = nested ? 'h4' : 'h2';
  const DetailHeading = nested ? 'h5' : 'h3';

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5 sm:p-6">
        <header className="mb-5 border-b border-brand-100 pb-4">
          <GroupHeading className="font-display text-lg font-semibold text-brand-900">
            {t.resultsSpecialistNarrativeTitle}
          </GroupHeading>
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
              <DetailHeading className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                {t.resultsSpecialtyOverview}
              </DetailHeading>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{blurb}</p>
            </section>

            {clinicalSummary && (
              <section className="rounded-xl border border-brand-100 bg-white/70 p-4">
                <DetailHeading className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                  {t.resultsProfessionalProfile}
                </DetailHeading>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{clinicalSummary}</p>
              </section>
            )}

            <section>
              <DetailHeading className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                {t.resultsSourceReferences}
              </DetailHeading>
              {suppliedReferences.length > 0 ? (
                <>
                  <ul className="space-y-1.5">
                    {suppliedReferences.map((reference) => (
                      <li key={reference} className="break-words text-xs leading-relaxed text-ink-600">
                        {reference}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{t.resultsReferencesDisclaimer}</p>
                </>
              ) : (
                <p className="text-xs leading-relaxed text-ink-500">{t.resultsNoSourceReferences}</p>
              )}
            </section>
          </div>
        )}
      </section>

      {meta && (
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
          <header className="mb-5 border-b border-ink-100 pb-4">
            <GroupHeading className="font-display text-lg font-semibold text-ink-900">
              {t.resultsQProMetadataTitle}
            </GroupHeading>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{t.resultsQProMetadataNote}</p>
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SpecialtyInfoCard label={t.explorerWorkStyle} value={translateWorkStyle(meta.workStyle, lang)} />
            <SpecialtyInfoCard label={t.explorerPatientContact} value={translatePatientContact(meta.patientContact, lang)} />
            <SpecialtyInfoCard label={t.explorerCareType} value={translateCareType(meta.careType, lang)} />
            <SpecialtyInfoCard label={t.explorerProceduralIntensity} value={translateProceduralIntensity(meta.proceduralIntensity, lang)} />
          </div>

          <section>
            <DetailHeading className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t.explorerKeyTraits}
            </DetailHeading>
            <div className="flex flex-wrap gap-2">
              {meta.keyTraits.map((trait) => (
                <span key={trait} className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
                  {translateTrait(trait, lang)}
                </span>
              ))}
            </div>
          </section>

          {metadataReferences.length > 0 && (
            <section>
              <DetailHeading className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                {t.resultsQProMetadataReferences}
              </DetailHeading>
              <ul className="space-y-1.5">
                {metadataReferences.map((reference) => (
                  <li key={reference} className="break-words text-xs leading-relaxed text-ink-500">
                    {reference}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-400">{t.resultsReferencesDisclaimer}</p>
            </section>
          )}
        </section>
      )}
    </div>
  );
}

interface ComparedTrait {
  trait: SpecialtyScore['details'][number]['trait'];
  student: number;
  target: number;
  gap?: number;
}

function TraitComparisonList({ items }: { items: readonly ComparedTrait[] }) {
  const { lang, t } = useLanguage();

  return (
    <div>
      <p className="mb-3 text-xs font-medium text-ink-500">{t.oppositeFitLegend}</p>
      <ul className="space-y-3">
        {items.map((item) => {
          const student = Math.round(item.student);
          const target = Math.round(item.target);
          const gap = Math.round(item.gap ?? Math.abs(item.student - item.target));
          return (
            <li key={item.trait} className="rounded-lg border border-ink-100 bg-white/70 p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-center sm:gap-3">
                <span className="text-xs font-semibold text-ink-600">{translateTrait(item.trait, lang)}</span>
                <div>
                  <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-ink-400" style={{ width: `${Math.min(100, Math.max(0, student))}%` }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.min(100, Math.max(0, target))}%` }} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                    {t.oppositeFitValues(student, target, gap)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Results({
  scores, preferredSpecialty, onRestart, isSpecialist, onContributeData,
  onOpenExplorer, onOpenComparison, onOpenMethodology,
}: ResultsProps) {
  const { lang, t } = useLanguage();
  const { getDescription, getClinicalSummary } = useSpecialtyCatalog();
  const [oppositeFitSpecialty, setOppositeFitSpecialty] = useState<SpecialtyScore | null>(null);
  const oppositeFitDialogRef = useRef<HTMLDivElement>(null);
  const oppositeFitTriggerRef = useRef<HTMLButtonElement | null>(null);

  const top = scores[0];
  const runnerUps = scores.slice(1, RESULTS_TOP_COUNT);
  const lowerRanked = scores.slice(-8);
  const preferredRank = useMemo(() => {
    if (!preferredSpecialty) return null;
    const idx = scores.findIndex((s) => s.specialty.name === preferredSpecialty);
    return idx >= 0 ? { rank: idx + 1, score: scores[idx] } : null;
  }, [scores, preferredSpecialty]);

  const topMatchPercent = Math.round(top.score);
  const topStrongest = strongestMatches(top, 5);
  const topBlurb = getDescription(top.specialty.name, lang) || top.specialty.blurb;
  const topClinicalSummary = getClinicalSummary(top.specialty.name, lang);
  const topTradeOffs = top.tradeOffs;
  const topSubScores = top.subScores;

  useEffect(() => {
    if (!oppositeFitSpecialty) return undefined;
    const returnFocusTarget = oppositeFitTriggerRef.current;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOppositeFitSpecialty(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        oppositeFitDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        oppositeFitDialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeys);
    return () => {
      document.removeEventListener('keydown', handleDialogKeys);
      returnFocusTarget?.focus();
    };
  }, [oppositeFitSpecialty]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-white/80 px-4 py-4 backdrop-blur sm:px-10 sm:py-7">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
            <Stethoscope className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-900">{t.appName}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={onOpenExplorer} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors">
            <Compass className="w-4 h-4" /> {t.navExplorer}
          </button>
          {FEATURE_FLAGS.specialtyComparison && (
            <button onClick={onOpenComparison} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors">
              <GitCompare className="w-4 h-4" /> {t.comparisonTitle}
            </button>
          )}
          {FEATURE_FLAGS.methodology && (
            <button onClick={onOpenMethodology} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors">
              <BookOpen className="w-4 h-4" /> {t.navMethodology}
            </button>
          )}
          <button onClick={onRestart} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors">
            <RotateCcw className="w-4 h-4" /> {t.resultsRetake}
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        {/* Hero match */}
        <div className="text-center mb-12 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-50 border border-accent-100 text-accent-700 text-xs font-semibold mb-6">
            <Trophy className="w-3.5 h-3.5" /> {t.topMatch}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-ink-900 text-balance">
            {translateSpecialtyName(top.specialty.name, lang)}
          </h1>
          <div className="mt-3 flex justify-center">
            <CategoryBadge category={top.specialty.category} />
          </div>
        </div>

        <div role="note" className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm leading-relaxed text-blue-900">
          {t.resultsInformationDisclaimer}
        </div>

        <div className="mb-10">
          <SpecialtyFacts
            specialtyName={top.specialty.name}
            blurb={topBlurb}
            clinicalSummary={topClinicalSummary}
          />
        </div>

        <section className="mb-10" aria-labelledby="top-calculated-analysis-title">
          <header className="mb-5">
            <h2 id="top-calculated-analysis-title" className="font-display text-xl font-semibold text-ink-900">
              {t.resultsCalculatedAnalysisTitle}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{t.resultsCalculatedAnalysisNote}</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 sm:gap-12 items-center mb-6 p-6 sm:p-10 rounded-3xl bg-white border border-ink-100 shadow-soft animate-fade-up" style={{ animationDelay: '80ms' }}>
            <div className="flex justify-center">
              <MatchRing percent={topMatchPercent} label={t.matchPercent} />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">{t.whyItFits}</h3>
              <div className="flex flex-wrap gap-2">
                {topStrongest.map((detail) => (
                  <span key={detail.trait} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium">
                    {translateTrait(detail.trait, lang)}
                    <span className="tabular-nums text-brand-600">{Math.round(detail.similarity)}/100</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-6 p-6 rounded-2xl bg-white border border-ink-100 shadow-soft animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-4">{t.subScoresTitle}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {topSubScores.map((sub) => {
                const labelKey = DIMENSION_LABELS[sub.dimension] as keyof typeof t;
                const circumference = 2 * Math.PI * 34;
                return (
                  <div key={sub.dimension} className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-2">
                      <svg width="80" height="80" className="-rotate-90" aria-hidden="true">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-ink-100" />
                        <circle
                          cx="40" cy="40" r="34" fill="none"
                          stroke="url(#subGrad)" strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={sub.score === null
                            ? circumference
                            : circumference - (sub.score / 100) * circumference}
                          className="transition-all duration-1000 ease-out"
                        />
                        <defs>
                          <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#43ab97" />
                            <stop offset="100%" stopColor="#1f7264" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink-700 tabular-nums">
                        {sub.score === null ? '—' : Math.round(sub.score)}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-ink-500 leading-tight block">{String(t[labelKey])}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {topTradeOffs.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 animate-fade-up" style={{ animationDelay: '120ms' }}>
              <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {t.tradeOffsTitle}
              </h3>
              <p className="text-sm text-amber-700 leading-relaxed mb-4">{t.tradeOffsDesc}</p>
              <TraitComparisonList items={topTradeOffs} />
            </div>
          )}
        </section>

        {/* Preferred specialty callout */}
        {preferredRank && preferredRank.rank > 1 && (
          <div className="mb-10 p-5 rounded-2xl bg-ink-50 border border-ink-100 flex items-start gap-4 animate-fade-up" style={{ animationDelay: '140ms' }}>
            <div className="w-10 h-10 rounded-xl bg-white border border-ink-200 flex items-center justify-center text-ink-500 shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-ink-600 leading-relaxed">
                {t.preferredCallout(translateSpecialtyName(preferredSpecialty!, lang), preferredRank.rank, Math.round(preferredRank.score.score))}
              </p>
            </div>
          </div>
        )}

        {/* Specialist contribution CTA */}
        {FEATURE_FLAGS.researchContributionCta && !isSpecialist && (
          <div className="mb-10 p-5 rounded-2xl bg-brand-50 border border-brand-100 flex items-start gap-4 animate-fade-up" style={{ animationDelay: '160ms' }}>
            <div className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center text-brand-600 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-brand-900 leading-relaxed mb-3">{t.specialistSubtitle}</p>
              <button onClick={onContributeData} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {t.specialistPromptTitle}
              </button>
            </div>
          </div>
        )}

        {/* Runner ups */}
        <div className="mb-4">
          <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1">{t.otherMatches}</h2>
          <p className="text-sm text-ink-500">{t.otherMatchesDesc}</p>
        </div>

        <ol start={2} className="space-y-6">
          {runnerUps.map((s, idx) => {
            const rank = idx + 2;
            const strongest = strongestMatches(s, 5);
            const blurb = getDescription(s.specialty.name, lang) || s.specialty.blurb;
            const clinicalSummary = getClinicalSummary(s.specialty.name, lang);
            const headingId = `top-ten-specialty-${rank}`;
            return (
              <li key={s.specialty.name} className="list-none">
                <article
                  aria-labelledby={headingId}
                  className="overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-soft animate-fade-up sm:p-6"
                  style={{ animationDelay: `${180 + idx * 45}ms` }}
                >
                  <div className="mb-6 flex flex-col gap-4 border-b border-ink-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold tabular-nums text-ink-500">
                        {rank}
                      </span>
                      <div className="min-w-0">
                        <span className="sr-only">{t.resultsRankLabel(rank)}</span>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 id={headingId} className="text-lg font-semibold leading-snug text-ink-900">
                            {translateSpecialtyName(s.specialty.name, lang)}
                          </h3>
                          <CategoryBadge category={s.specialty.category} />
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 font-display text-2xl font-semibold tabular-nums text-brand-600">
                      {Math.round(s.score)}/100
                    </span>
                  </div>

                  <SpecialtyFacts
                    specialtyName={s.specialty.name}
                    blurb={blurb}
                    clinicalSummary={clinicalSummary}
                    nested
                  />

                  <section className="mt-6 border-t border-ink-100 pt-5" aria-labelledby={`${headingId}-analysis`}>
                    <h4 id={`${headingId}-analysis`} className="font-display text-base font-semibold text-ink-900">
                      {t.resultsCalculatedAnalysisTitle}
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{t.resultsCalculatedAnalysisNote}</p>

                    <section className="mt-5">
                      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{t.whyItFits}</h5>
                      <div className="space-y-3">
                        {strongest.map((detail) => {
                          const percent = Math.round(detail.similarity);
                          return (
                            <div key={detail.trait} className="grid gap-1.5 sm:grid-cols-[minmax(0,10rem)_1fr_auto] sm:items-center sm:gap-3">
                              <span className="text-xs font-medium text-ink-500">{translateTrait(detail.trait, lang)}</span>
                              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                                <div className="h-full origin-left animate-grow-bar rounded-full bg-brand-400" style={{ width: `${Math.min(100, percent)}%` }} />
                              </div>
                              <span className="text-right text-xs tabular-nums text-ink-400">{percent}/100</span>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="mt-5">
                      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{t.subScoresTitle}</h5>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {s.subScores.map((sub) => {
                          const labelKey = DIMENSION_LABELS[sub.dimension] as keyof typeof t;
                          return (
                            <div key={sub.dimension} className="rounded-lg bg-ink-50 px-3 py-2 text-center">
                              <div className="text-sm font-bold tabular-nums text-ink-700">
                                {sub.score === null ? '—' : Math.round(sub.score)}
                              </div>
                              <div className="text-[10px] font-medium leading-tight text-ink-400">{String(t[labelKey])}</div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {s.tradeOffs.length > 0 && (
                      <section className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-3">
                        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">{t.tradeOffsTitle}</h5>
                        <p className="mb-3 text-xs leading-relaxed text-amber-700">{t.tradeOffsDesc}</p>
                        <TraitComparisonList items={s.tradeOffs} />
                      </section>
                    )}
                  </section>
                </article>
              </li>
            );
          })}
        </ol>

        {/* Opposite-fit section */}
        {FEATURE_FLAGS.oppositeFitExploration && (
          <>
            <div className="mt-14 mb-4">
              <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1">{t.oppositeFitTitle}</h2>
              <p className="text-sm text-ink-500">{t.oppositeFitDesc}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {lowerRanked.slice(0, 8).map((s) => (
                <button
                  key={s.specialty.name}
                  onClick={(event) => {
                    oppositeFitTriggerRef.current = event.currentTarget;
                    setOppositeFitSpecialty(s);
                  }}
                  className="p-4 rounded-2xl bg-white border border-ink-100 hover:border-ink-200 hover:shadow-soft transition-all text-left group"
                >
                  <h3 className="text-sm font-semibold text-ink-800 leading-snug mb-1">{translateSpecialtyName(s.specialty.name, lang)}</h3>
                  <span className="text-xs text-ink-400 tabular-nums">{Math.round(s.score)}/100</span>
                  <span className="block mt-2 text-xs text-brand-600 font-medium group-hover:text-brand-700">{t.oppositeFitExplore}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Full ranking by category */}
        <div className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1">{t.fullRanking}</h2>
          <p className="text-sm text-ink-500 mb-5">{t.fullRankingDesc(scores.length)}</p>
          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const items = scores.filter((s) => s.specialty.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2.5">{translateCategory(cat, lang)}</h3>
                  <div className="rounded-2xl bg-white border border-ink-100 overflow-hidden">
                    {items.map((s, i) => (
                      <div
                        key={s.specialty.name}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                          i > 0 ? 'border-t border-ink-100' : ''
                        } ${s.specialty.name === top.specialty.name ? 'bg-brand-50/50' : ''}`}
                      >
                        <span className={`font-medium ${s.specialty.name === top.specialty.name ? 'text-brand-800' : 'text-ink-700'}`}>
                          {translateSpecialtyName(s.specialty.name, lang)}
                        </span>
                        <span className="text-ink-400 tabular-nums text-xs font-medium">{Math.round(s.score)}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={onRestart} className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.03] active:scale-[0.98]">
            <RotateCcw className="w-4 h-4" /> {t.retakeAssessment}
          </button>
        </div>
      </main>

      {/* Opposite-fit modal */}
      {FEATURE_FLAGS.oppositeFitExploration && oppositeFitSpecialty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setOppositeFitSpecialty(null)}>
          <div
            ref={oppositeFitDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="opposite-fit-dialog-title"
            tabIndex={-1}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl animate-fade-up"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="opposite-fit-dialog-title" className="font-display text-xl font-semibold text-ink-900">{translateSpecialtyName(oppositeFitSpecialty.specialty.name, lang)}</h2>
                <span className="text-sm text-ink-400 tabular-nums">{Math.round(oppositeFitSpecialty.score)}/100 {t.matchPercent}</span>
              </div>
              <button autoFocus aria-label={t.oppositeFitClose} onClick={() => setOppositeFitSpecialty(null)} className="text-ink-400 hover:text-ink-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-ink-600 leading-relaxed mb-4">{t.oppositeFitDesc}</p>
            <TraitComparisonList items={weakestMatches(oppositeFitSpecialty, 5)} />
          </div>
        </div>
      )}
    </div>
  );
}
