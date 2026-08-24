import { useMemo, useState } from 'react';
import { type SpecialtyScore, strongestMatches, generateExplanation } from '@/lib/scoring';
import { CATEGORY_ORDER } from '@/data/specialties';
import { prettyTrait } from '@/data/traits';
import { translateSpecialtyName, translateCategory, translateBlurb } from '@/data/i18n';
import { useLanguage } from '@/lib/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { Stethoscope, Trophy, RotateCcw, ChevronDown, Heart, ArrowUpRight, FlaskConical } from 'lucide-react';

interface ResultsProps {
  scores: SpecialtyScore[];
  preferredSpecialty: string | null;
  onRestart: () => void;
  isSpecialist: boolean;
  onContributeData: () => void;
}

function MatchRing({ percent, size = 132, label }: { percent: number; size?: number; label: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
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

export default function Results({ scores, preferredSpecialty, onRestart, isSpecialist, onContributeData }: ResultsProps) {
  const { lang, t } = useLanguage();
  const [expanded, setExpanded] = useState<number | null>(0);

  const top = scores[0];
  const runnerUps = scores.slice(1, 6);
  const preferredRank = useMemo(() => {
    if (!preferredSpecialty) return null;
    const idx = scores.findIndex((s) => s.specialty.name === preferredSpecialty);
    return idx >= 0 ? { rank: idx + 1, score: scores[idx] } : null;
  }, [scores, preferredSpecialty]);

  const topMatchPercent = Math.round(top.score);
  const topStrongest = strongestMatches(top, 5);
  const topBlurb = translateBlurb(top.specialty.name, lang) || top.specialty.blurb;

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
            <Stethoscope className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-900">
            {t.appName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t.resultsRetake}
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        {/* Hero match */}
        <div className="text-center mb-12 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-50 border border-accent-100 text-accent-700 text-xs font-semibold mb-6">
            <Trophy className="w-3.5 h-3.5" />
            {t.topMatch}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-ink-900 text-balance">
            {translateSpecialtyName(top.specialty.name, lang)}
          </h1>
          <div className="mt-3 flex justify-center">
            <CategoryBadge category={top.specialty.category} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 sm:gap-12 items-center mb-14 p-6 sm:p-10 rounded-3xl bg-white border border-ink-100 shadow-soft animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex justify-center">
            <MatchRing percent={topMatchPercent} label={t.matchPercent} />
          </div>
          <div>
            <p className="text-base sm:text-lg text-ink-600 leading-relaxed mb-5">
              {topBlurb}
            </p>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
                {t.whyItFits}
              </h3>
              <p className="text-sm text-ink-600 leading-relaxed mb-4">
                {generateExplanation(top)}
              </p>
              <div className="flex flex-wrap gap-2">
                {topStrongest.map((d) => (
                  <span
                    key={d.trait}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium"
                  >
                    {prettyTrait(d.trait)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preferred specialty callout */}
        {preferredRank && preferredRank.rank > 1 && (
          <div className="mb-10 p-5 rounded-2xl bg-ink-50 border border-ink-100 flex items-start gap-4 animate-fade-up" style={{ animationDelay: '120ms' }}>
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
        {!isSpecialist && (
          <div className="mb-10 p-5 rounded-2xl bg-brand-50 border border-brand-100 flex items-start gap-4 animate-fade-up" style={{ animationDelay: '140ms' }}>
            <div className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center text-brand-600 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-brand-900 leading-relaxed mb-3">
                {t.specialistSubtitle}
              </p>
              <button
                onClick={onContributeData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
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

        <div className="space-y-3">
          {runnerUps.map((s, idx) => {
            const isOpen = expanded === idx;
            const strongest = strongestMatches(s, 5);
            const blurb = translateBlurb(s.specialty.name, lang) || s.specialty.blurb;
            return (
              <div
                key={s.specialty.name}
                className="rounded-2xl bg-white border border-ink-100 overflow-hidden animate-fade-up"
                style={{ animationDelay: `${160 + idx * 60}ms` }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : idx)}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-ink-50/50 transition-colors"
                >
                  <span className="shrink-0 w-8 h-8 rounded-full bg-ink-100 text-ink-500 text-sm font-semibold flex items-center justify-center tabular-nums">
                    {idx + 2}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-semibold text-ink-900 text-base">{translateSpecialtyName(s.specialty.name, lang)}</h3>
                      <CategoryBadge category={s.specialty.category} />
                    </div>
                    {!isOpen && <p className="text-sm text-ink-500 mt-0.5 line-clamp-1">{blurb}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-display text-xl font-semibold text-brand-600 tabular-nums">{Math.round(s.score)}%</span>
                    <ChevronDown className={`w-5 h-5 text-ink-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pl-16 animate-fade-in">
                    <p className="text-sm text-ink-600 leading-relaxed mb-2">{blurb}</p>
                    <p className="text-sm text-ink-500 leading-relaxed mb-4">{generateExplanation(s)}</p>
                    <div className="space-y-2.5">
                      {strongest.map((d) => {
                        const pct = Math.round(d.similarity);
                        return (
                          <div key={d.trait} className="flex items-center gap-3">
                            <span className="w-40 text-xs font-medium text-ink-500 shrink-0">
                              {prettyTrait(d.trait)}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-brand-400 origin-left animate-grow-bar"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-ink-400 tabular-nums w-8 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
                        <span className="text-ink-400 tabular-nums text-xs font-medium">{Math.round(s.score)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.03] active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            {t.retakeAssessment}
          </button>
          <a
            href="https://bolt.new"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-600 transition-colors"
          >
            {t.builtWithBolt} <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </main>
    </div>
  );
}
