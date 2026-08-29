import { lazy, Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { RATING_SECTIONS, ALL_QUESTION_IDS } from '@/data/questions';
import { translateSection } from '@/data/i18n';
import {
  reRankWithPriorities,
  calculateTraits,
  type SpecialtyScore,
  PriorityWeights,
} from '@/lib/scoring';
import { DEFAULT_PRIORITY_WEIGHTS } from '@/data/dimensions';
import type { PriorityWeights } from '@/lib/scoring';
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext';
import Intro from '@/components/Intro';
import ProgressBar from '@/components/ProgressBar';
import SpecialtyStep from '@/components/SpecialtyStep';
import ValuesStep from '@/components/ValuesStep';
import RatingStep from '@/components/RatingStep';
import Results from '@/components/Results';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import SpecialistPrompt from '@/components/SpecialistPrompt';
import StudentPrompt from '@/components/StudentPrompt';
import QProfile from '@/components/QProfile';
import SpecialtyExplorer from '@/components/SpecialtyExplorer';
import SpecialtyDetail from '@/components/SpecialtyDetail';
import SpecialtyComparison from '@/components/SpecialtyComparison';
import MethodologyPage from '@/components/MethodologyPage';
import { ArrowLeft, ArrowRight, Stethoscope } from 'lucide-react';

const Dashboard = lazy(() => import('@/components/Dashboard'));

type Phase = 'intro' | 'quiz' | 'qprofile' | 'student' | 'results' | 'specialist' | 'dashboard' | 'explorer' | 'detail' | 'methodology' | 'comparison';

const TOTAL_QUESTIONS = ALL_QUESTION_IDS.length + 2;

const QUIZ_STEPS = [
  { type: 'specialty' as const, label: 'Specialty', sectionId: undefined as string | undefined },
  { type: 'values' as const, label: 'Values', sectionId: undefined as string | undefined },
  ...RATING_SECTIONS.map((s) => ({ type: 'rating' as const, label: s.title, sectionId: s.id })),
];

function AppContent() {
  const { t, lang } = useLanguage();
  const [phase, setPhase] = useState<Phase>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [preferredSpecialty, setPreferredSpecialty] = useState<string | null>(null);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<SpecialtyScore[]>([]);
  const [isSpecialist, setIsSpecialist] = useState(false);
  const [priorities, setPriorities] = useState<PriorityWeights>(DEFAULT_PRIORITY_WEIGHTS);
  const [explorerSpecialty, setExplorerSpecialty] = useState<string | null>(null);

  const studentTraits = useMemo(
    () => calculateTraits(ratings, selectedValues),
    [ratings, selectedValues]
  );

  const startQuiz = () => {
    setPhase('quiz');
    setStepIndex(0);
  };

  const toggleValue = (value: string) => {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : prev.length < 4 ? [...prev, value] : prev
    );
  };

  const setRating = (id: string, value: number) => {
    setRatings((prev) => ({ ...prev, [id]: value }));
  };

  const computeAndShowQProfile = () => {
    setPhase('qprofile');
  };

  const computeAndShowResults = () => {
    const result = reRankWithPriorities({ ratings, selectedValues, preferredSpecialty }, priorities);
    setScores(result);
    setPhase(isSpecialist ? 'specialist' : 'student');
  };

  const restart = () => {
    setPreferredSpecialty(null);
    setSelectedValues([]);
    setRatings({});
    setScores([]);
    setStepIndex(0);
    setPriorities(DEFAULT_PRIORITY_WEIGHTS);
    setExplorerSpecialty(null);
    setPhase('intro');
  };

  const currentStep = QUIZ_STEPS[stepIndex];
  const isLastStep = stepIndex === QUIZ_STEPS.length - 1;

  const canProceed = useMemo(() => {
    if (currentStep.type === 'values') return selectedValues.length > 0;
    if (currentStep.type === 'rating' && currentStep.sectionId) {
      const section = RATING_SECTIONS.find((item) => item.id === currentStep.sectionId);
      return section?.questions.every((question) => ratings[question.id] !== undefined) ?? false;
    }
    return true;
  }, [currentStep.sectionId, currentStep.type, ratings, selectedValues.length]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      computeAndShowQProfile();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLastStep]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      setPhase('intro');
    } else {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  // Prevent accidental data loss
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (Object.keys(ratings).length > 0 && phase !== 'results' && phase !== 'intro') {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [ratings, phase]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  if (phase === 'intro') {
    return <Intro onStart={startQuiz} totalQuestions={TOTAL_QUESTIONS} isSpecialist={isSpecialist} onSpecialistToggle={setIsSpecialist} onOpenExplorer={() => setPhase('explorer')} onOpenMethodology={() => setPhase('methodology')} onOpenDashboard={() => setPhase('dashboard')} />;
  }

  if (phase === 'qprofile') {
    return (
      <div className="min-h-screen bg-ink-50">
        <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
              <Stethoscope className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-ink-900">{t.appName}</span>
          </div>
          <LanguageSwitcher />
        </header>
        <QProfile traits={studentTraits} onContinue={computeAndShowResults} />
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <Results
        scores={scores}
        preferredSpecialty={preferredSpecialty}
        onRestart={restart}
        isSpecialist={isSpecialist}
        onContributeData={() => setPhase('specialist')}
        onOpenExplorer={() => setPhase('explorer')}
        onOpenMethodology={() => setPhase('methodology')}
      />
    );
  }

  if (phase === 'student') {
    return (
      <div className="min-h-screen">
        <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <span className="font-display text-lg font-semibold tracking-tight text-ink-900">{t.appName}</span>
          <LanguageSwitcher />
        </header>
        <StudentPrompt
          preferredSpecialty={preferredSpecialty}
          ratings={ratings}
          selectedValues={selectedValues}
          scores={scores}
          language={lang}
          onDone={() => setPhase('results')}
        />
      </div>
    );
  }

  if (phase === 'specialist') {
    return (
      <div className="min-h-screen">
        <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
              <Stethoscope className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-ink-900">{t.appName}</span>
          </div>
          <LanguageSwitcher />
        </header>
        <SpecialistPrompt
          ratings={ratings}
          selectedValues={selectedValues}
          language={lang}
          onDone={() => setPhase('results')}
        />
      </div>
    );
  }

  if (phase === 'dashboard') {
    return (
      <Suspense fallback={<main className="min-h-screen bg-ink-50 flex items-center justify-center text-sm text-ink-500">{lang === 'fr' ? 'Chargement du dashboard…' : 'Loading dashboard…'}</main>}>
        <Dashboard onBack={() => setPhase('intro')} />
      </Suspense>
    );
  }

  if (phase === 'explorer') {
    const scoreForExplorer = scores.length > 0 ? scores.map((s) => ({ specialty: s.specialty, score: s.score })) : undefined;
    return (
      <SpecialtyExplorer
        scores={scoreForExplorer}
        onSelectSpecialty={(name) => {
          setExplorerSpecialty(name);
          setPhase('detail');
        }}
        onBack={() => setPhase(scores.length > 0 ? 'results' : 'intro')}
      />
    );
  }

  if (phase === 'detail' && explorerSpecialty) {
    const score = scores.find((s) => s.specialty.name === explorerSpecialty)?.score;
    return (
      <SpecialtyDetail
        specialtyName={explorerSpecialty}
        score={score}
        onBack={() => setPhase('explorer')}
      />
    );
  }

  if (phase === 'methodology') {
    return <MethodologyPage onBack={() => setPhase(scores.length > 0 ? 'results' : 'intro')} />;
  }

  if (phase === 'comparison') {
    return (
      <SpecialtyComparison
        studentTraits={studentTraits}
        onBack={() => setPhase('results')}
      />
    );
  }

  // Quiz phase
  const progressCurrent = stepIndex + 1;
  const progressTotal = QUIZ_STEPS.length;

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <header className="px-6 py-4 sm:px-10 sm:py-5 border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {stepIndex === 0 ? t.home : t.back}
            </button>
            <div className="flex items-center gap-3">
              {isSpecialist && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold">
                  {t.specialistBadge}
                </span>
              )}
              <LanguageSwitcher />
            </div>
          </div>
          <ProgressBar current={progressCurrent} total={progressTotal} />
        </div>
      </header>

      <main className="flex-1 px-6 py-8 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div key={stepIndex} className="animate-fade-up">
            {currentStep.type === 'specialty' && (
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 mb-2 text-balance">
                  {t.specialtyTitle}
                </h2>
                <p className="text-ink-500 mb-6 text-balance">
                  {t.specialtySubtitle}
                </p>
                <SpecialtyStep selected={preferredSpecialty} onChange={setPreferredSpecialty} />
              </div>
            )}

            {currentStep.type === 'values' && (
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 mb-2 text-balance">
                  {t.valuesTitle}
                </h2>
                <p className="text-ink-500 mb-6 text-balance">
                  {t.valuesSubtitle}
                </p>
                <ValuesStep selected={selectedValues} onToggle={toggleValue} />
              </div>
            )}

            {currentStep.type === 'rating' && currentStep.sectionId && (
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 mb-2 text-balance">
                  {translateSection(currentStep.sectionId, lang).title}
                </h2>
                <RatingStep
                  section={RATING_SECTIONS.find((s) => s.id === currentStep.sectionId)!}
                  ratings={ratings}
                  onChange={setRating}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 px-6 py-4 sm:px-10 sm:py-5 border-t border-ink-100 bg-white/90 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLastStep ? t.seeResults : t.continue}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
