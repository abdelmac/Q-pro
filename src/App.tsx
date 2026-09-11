import { lazy, Suspense, useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { RATING_SECTIONS, ALL_QUESTION_IDS } from '@/data/questions';
import { translateSection } from '@/data/i18n';
import {
  reRankWithPriorities,
  calculateTraits,
  type SpecialtyScore,
  type PriorityWeights,
} from '@/lib/scoring';
import { DEFAULT_PRIORITY_WEIGHTS } from '@/data/dimensions';
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext';
import { SpecialtyCatalogProvider, useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { getAppNavigationScrollKey, useScrollToPageTop } from '@/lib/scrollToTop';
import Intro from '@/components/Intro';
import RoleSelection from '@/components/RoleSelection';
import ProgressBar from '@/components/ProgressBar';
import SpecialtyStep from '@/components/SpecialtyStep';
import ValuesStep from '@/components/ValuesStep';
import RatingStep from '@/components/RatingStep';
import Results from '@/components/Results';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import SpecialistPrompt from '@/components/SpecialistPrompt';
import SpecialistQuestionnaireChoice from '@/components/SpecialistQuestionnaireChoice';
import StudentPrompt, { type ParticipantReflectionDraft } from '@/components/StudentPrompt';
import QProfile from '@/components/QProfile';
import SpecialtyExplorer from '@/components/SpecialtyExplorer';
import SpecialtyDetail from '@/components/SpecialtyDetail';
import SpecialtyComparison from '@/components/SpecialtyComparison';
import MethodologyPage from '@/components/MethodologyPage';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import PageBackButton from '@/components/PageBackButton';
import {
  createAppNavigationReducer,
  createAppNavigationState,
  getCurrentAppLocation,
  navigateBack,
  navigateTo,
  replaceNavigation,
  resetNavigation,
  type AppLocation,
} from '@/lib/appNavigation';
import {
  getPostQuestionnaireDestination,
  INITIAL_PARTICIPANT_ROLE,
  type ParticipantRole,
} from '@/lib/participantProfile';

const Dashboard = lazy(() => import('@/components/Dashboard'));

type SpecialistQuestionnaireMode = 'completed' | 'skipped' | null;

const QUIZ_STEPS = [
  { type: 'specialty' as const, label: 'Specialty', sectionId: undefined as string | undefined },
  { type: 'values' as const, label: 'Values', sectionId: undefined as string | undefined },
  ...RATING_SECTIONS.map((s) => ({ type: 'rating' as const, label: s.title, sectionId: s.id })),
];

const appNavigationReducer = createAppNavigationReducer({
  maxQuizStepIndex: QUIZ_STEPS.length - 1,
});

function createParticipantReflectionDraft(): ParticipantReflectionDraft {
  return {
    submissionId: crypto.randomUUID(),
    studyYear: '',
    medicineView: '',
  };
}

function AppContent() {
  const { t, lang } = useLanguage();
  const { specialties, source: catalogSource, isLoading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useSpecialtyCatalog();
  const [navigation, dispatchNavigation] = useReducer(
    appNavigationReducer,
    undefined,
    () => createAppNavigationState(),
  );
  const location = getCurrentAppLocation(navigation);
  const phase = location.phase;
  const [preferredSpecialty, setPreferredSpecialty] = useState<string | null>(null);
  const [actualSpecialty, setActualSpecialty] = useState<string | null>(null);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<SpecialtyScore[]>([]);
  const [participantRole, setParticipantRole] = useState<ParticipantRole | null>(INITIAL_PARTICIPANT_ROLE);
  const [specialistQuestionnaireMode, setSpecialistQuestionnaireMode] = useState<SpecialistQuestionnaireMode>(null);
  const [participantReflectionDraft, setParticipantReflectionDraft] = useState<ParticipantReflectionDraft>(
    createParticipantReflectionDraft,
  );
  const [contributionSubmitting, setContributionSubmitting] = useState(false);
  const [priorities, setPriorities] = useState<PriorityWeights>(DEFAULT_PRIORITY_WEIGHTS);
  const [catalogGateMessage, setCatalogGateMessage] = useState<string | null>(null);
  const isSpecialist = participantRole === 'specialist';

  // Specialists who opt into the quantitative profile identify their actual
  // specialty only after the 81 ratings, avoiding ground-truth priming.
  const quizSteps = useMemo(
    () => isSpecialist ? QUIZ_STEPS.filter((step) => step.type !== 'specialty') : QUIZ_STEPS,
    [isSpecialist],
  );
  const stepIndex = location.phase === 'quiz'
    ? Math.min(location.stepIndex, Math.max(0, quizSteps.length - 1))
    : 0;
  const explorerSpecialty = location.phase === 'detail' ? location.specialtyName : null;
  // The intro count applies to student/curious orientation. Specialists see
  // the duration and scope of each optional path on their dedicated choice.
  const totalQuestions = ALL_QUESTION_IDS.length + 2;

  const studentTraits = useMemo(
    () => calculateTraits(ratings, selectedValues),
    [ratings, selectedValues]
  );

  const goTo = useCallback((nextLocation: AppLocation) => {
    dispatchNavigation(navigateTo(nextLocation));
  }, []);

  const goBack = useCallback(() => {
    dispatchNavigation(navigateBack());
  }, []);

  const replaceCurrentPage = useCallback((nextLocation: AppLocation) => {
    dispatchNavigation(replaceNavigation(nextLocation));
  }, []);

  const startQuiz = () => {
    if (participantRole === null) return;
    if (catalogLoading || catalogSource !== 'remote') {
      setCatalogGateMessage(lang === 'fr'
        ? 'La configuration publiée de l’algorithme doit être chargée avant de commencer.'
        : lang === 'ro'
          ? 'Configurația publicată a algoritmului trebuie încărcată înainte de a începe.'
          : 'The published algorithm configuration must load before the quiz can start.');
      if (!catalogLoading) void refreshCatalog();
      return;
    }
    setCatalogGateMessage(null);
    setSpecialistQuestionnaireMode(null);
    goTo(isSpecialist ? { phase: 'specialist-choice' } : { phase: 'quiz', stepIndex: 0 });
  };

  const answerSpecialistQuestionnaire = () => {
    setSpecialistQuestionnaireMode('completed');
    setSelectedValues([]);
    setRatings({});
    setScores([]);
    goTo({ phase: 'quiz', stepIndex: 0 });
  };

  const skipSpecialistQuestionnaire = useCallback(() => {
    if (!isSpecialist) return;
    const hasPartialAnswers = selectedValues.length > 0 || Object.keys(ratings).length > 0;
    if (hasPartialAnswers && !window.confirm(t.specialistSkipQuestionnaireConfirm)) return;
    setSpecialistQuestionnaireMode('skipped');
    setScores([]);
    goTo({ phase: 'specialist' });
  }, [goTo, isSpecialist, ratings, selectedValues.length, t.specialistSkipQuestionnaireConfirm]);

  const toggleValue = (value: string) => {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : prev.length < 4 ? [...prev, value] : prev
    );
  };

  const setRating = (id: string, value: number) => {
    setRatings((prev) => ({ ...prev, [id]: value }));
  };

  const computeAndShowQProfile = () => {
    goTo({ phase: 'qprofile' });
  };

  const computeAndShowResults = () => {
    if (participantRole === null) return;
    const result = reRankWithPriorities({
      ratings,
      selectedValues,
      preferredSpecialty: isSpecialist ? null : preferredSpecialty,
    }, priorities, specialties);
    setScores(result);
    goTo({ phase: getPostQuestionnaireDestination(participantRole) });
  };

  const clearAssessment = () => {
    setPreferredSpecialty(null);
    setActualSpecialty(null);
    setSelectedValues([]);
    setRatings({});
    setScores([]);
    setPriorities(DEFAULT_PRIORITY_WEIGHTS);
    setSpecialistQuestionnaireMode(null);
    setParticipantReflectionDraft(createParticipantReflectionDraft());
    setContributionSubmitting(false);
    setCatalogGateMessage(null);
  };

  const restart = () => {
    clearAssessment();
    setParticipantRole(null);
    dispatchNavigation(resetNavigation());
  };

  const changeParticipantRole = () => {
    clearAssessment();
    setParticipantRole(null);
    dispatchNavigation(resetNavigation());
  };

  const selectParticipantRole = (role: ParticipantRole) => {
    clearAssessment();
    setParticipantRole(role);
    dispatchNavigation(resetNavigation());
    dispatchNavigation(navigateTo({ phase: 'intro' }));
  };

  const currentStep = quizSteps[stepIndex];
  const isLastStep = stepIndex === quizSteps.length - 1;

  const canProceed = useMemo(() => {
    if (currentStep.type === 'specialty') return !isSpecialist || actualSpecialty !== null;
    if (currentStep.type === 'values') return selectedValues.length > 0;
    if (currentStep.type === 'rating' && currentStep.sectionId) {
      const section = RATING_SECTIONS.find((item) => item.id === currentStep.sectionId);
      return section?.questions.every((question) => ratings[question.id] !== undefined) ?? false;
    }
    return true;
  }, [actualSpecialty, currentStep.sectionId, currentStep.type, isSpecialist, ratings, selectedValues.length]);

  const handleNext = () => {
    if (isLastStep) {
      if (isSpecialist) computeAndShowResults();
      else computeAndShowQProfile();
    } else {
      goTo({ phase: 'quiz', stepIndex: stepIndex + 1 });
    }
  };

  const handleBack = goBack;

  // Prevent accidental data loss
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    const hasDraft = Object.keys(ratings).length > 0
      || selectedValues.length > 0
      || participantReflectionDraft.medicineView.trim().length > 0;
    if (hasDraft && phase !== 'results' && phase !== 'intro' && phase !== 'role') {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [participantReflectionDraft.medicineView, phase, ratings, selectedValues.length]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  // App navigation is state-based, so the browser otherwise preserves the
  // previous document offset when a new screen or questionnaire step renders.
  useScrollToPageTop(getAppNavigationScrollKey(
    phase,
    stepIndex,
    explorerSpecialty,
  ));

  if (phase === 'role' || participantRole === null) {
    return <RoleSelection onSelectRole={selectParticipantRole} />;
  }

  if (phase === 'intro') {
    return (
      <>
        <Intro onStart={startQuiz} totalQuestions={totalQuestions} participantRole={participantRole} onBack={goBack} onChangeRole={changeParticipantRole} onOpenExplorer={() => goTo({ phase: 'explorer' })} onOpenMethodology={() => goTo({ phase: 'methodology' })} onOpenDashboard={() => goTo({ phase: 'dashboard' })} />
        {(catalogGateMessage || (catalogError && catalogSource !== 'remote')) && (
          <div role="alert" className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,680px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-lift">
            <p className="font-semibold">{catalogGateMessage ?? (lang === 'fr' ? 'Catalogue publié indisponible.' : 'Published catalog unavailable.')}</p>
            <p className="mt-1 text-xs text-amber-800">{catalogError}</p>
            <button type="button" onClick={() => void refreshCatalog()} disabled={catalogLoading} className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {catalogLoading ? (lang === 'fr' ? 'Chargement…' : 'Loading…') : (lang === 'fr' ? 'Réessayer' : 'Retry')}
            </button>
          </div>
        )}
      </>
    );
  }

  if (phase === 'specialist-choice') {
    return (
      <SpecialistQuestionnaireChoice
        onAnswerQuestionnaire={answerSpecialistQuestionnaire}
        onSkipQuestionnaire={skipSpecialistQuestionnaire}
        onBack={goBack}
      />
    );
  }

  if (phase === 'qprofile') {
    return (
      <div className="min-h-screen bg-accent-50">
        <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <PageBackButton onClick={goBack} label={t.back} />
          <LanguageSwitcher />
        </header>
        <QProfile
          traits={studentTraits}
          onContinue={computeAndShowResults}
          continueLabel={isSpecialist ? t.specialistContinueToQuestions : undefined}
        />
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <Results
        scores={scores}
        preferredSpecialty={isSpecialist ? null : preferredSpecialty}
        onRestart={restart}
        onBack={goBack}
        participantRole={participantRole}
        onContributeData={() => goTo({ phase: 'specialist' })}
        onOpenExplorer={() => goTo({ phase: 'explorer' })}
        onOpenComparison={() => goTo({ phase: 'comparison' })}
        onOpenMethodology={() => goTo({ phase: 'methodology' })}
      />
    );
  }

  if (phase === 'student') {
    return (
      <div className="min-h-screen">
        <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <PageBackButton onClick={goBack} label={t.back} disabled={contributionSubmitting} />
          <LanguageSwitcher />
        </header>
        <StudentPrompt
          participantRole={participantRole === 'curious' ? 'curious' : 'student'}
          draft={participantReflectionDraft}
          onDraftChange={setParticipantReflectionDraft}
          preferredSpecialty={preferredSpecialty}
          ratings={ratings}
          selectedValues={selectedValues}
          scores={scores}
          language={lang}
          onSubmittingChange={setContributionSubmitting}
          onDone={(saved) => {
            if (saved) {
              setParticipantReflectionDraft(createParticipantReflectionDraft());
              replaceCurrentPage({ phase: 'results' });
            } else {
              goTo({ phase: 'results' });
            }
          }}
        />
      </div>
    );
  }

  if (phase === 'specialist') {
    return (
      <div className="min-h-screen">
        <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <PageBackButton onClick={goBack} label={t.back} disabled={contributionSubmitting} />
          <LanguageSwitcher />
        </header>
        <SpecialistPrompt
          initialSpecialty={isSpecialist ? actualSpecialty : null}
          ratings={specialistQuestionnaireMode === 'skipped' ? {} : ratings}
          selectedValues={specialistQuestionnaireMode === 'skipped' ? [] : selectedValues}
          questionnaireCompleted={specialistQuestionnaireMode !== 'skipped'}
          language={lang}
          onSubmittingChange={setContributionSubmitting}
          onDone={() => replaceCurrentPage({ phase: specialistQuestionnaireMode === 'skipped' ? 'explorer' : 'results' })}
        />
      </div>
    );
  }

  if (phase === 'dashboard') {
    return (
      <Suspense fallback={<main className="relative flex min-h-screen items-center justify-center bg-accent-50 px-6 text-sm text-ink-500"><PageBackButton onClick={goBack} label={t.back} className="absolute left-4 top-4" />{lang === 'fr' ? 'Chargement du dashboard…' : lang === 'ro' ? 'Se încarcă dashboardul…' : 'Loading dashboard…'}</main>}>
        <Dashboard onBack={goBack} />
      </Suspense>
    );
  }

  if (phase === 'explorer') {
    const scoreForExplorer = scores.length > 0 ? scores.map((s) => ({ specialty: s.specialty, score: s.score })) : undefined;
    return (
      <SpecialtyExplorer
        scores={scoreForExplorer}
        onSelectSpecialty={(name) => {
          goTo({ phase: 'detail', specialtyName: name });
        }}
        onBack={goBack}
      />
    );
  }

  if (phase === 'detail' && explorerSpecialty) {
    const score = scores.find((s) => s.specialty.name === explorerSpecialty)?.score;
    return (
      <SpecialtyDetail
        specialtyName={explorerSpecialty}
        score={score}
        onBack={goBack}
      />
    );
  }

  if (phase === 'methodology') {
    return <MethodologyPage onBack={goBack} />;
  }

  if (phase === 'comparison') {
    return (
      <SpecialtyComparison
        studentTraits={studentTraits}
        onBack={goBack}
      />
    );
  }

  // Quiz phase
  const progressCurrent = stepIndex + 1;
  const progressTotal = quizSteps.length;

  return (
    <div className="min-h-screen flex flex-col bg-accent-50">
      <header className="px-6 py-4 sm:px-10 sm:py-5 border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <PageBackButton onClick={handleBack} label={t.back} />
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
          {isSpecialist && specialistQuestionnaireMode === 'completed' && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={skipSpecialistQuestionnaire}
                className="min-h-11 rounded-full px-3 text-xs font-semibold text-ink-500 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                {t.specialistSkipQuestionnaire}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-8 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div key={stepIndex} className="animate-fade-up">
            {currentStep.type === 'specialty' && (
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 mb-2 text-balance">
                  {isSpecialist ? t.specialistSpecialtyTitle : t.specialtyTitle}
                </h2>
                <p className="text-ink-500 mb-6 text-balance">
                  {isSpecialist ? t.specialistSpecialtySubtitle : t.specialtySubtitle}
                </p>
                <SpecialtyStep
                  selected={isSpecialist ? actualSpecialty : preferredSpecialty}
                  onChange={isSpecialist ? setActualSpecialty : setPreferredSpecialty}
                  emptyMessage={isSpecialist ? t.specialistSpecialtyRequired : undefined}
                />
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
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand-800 text-white font-semibold text-sm shadow-lift hover:bg-brand-900 transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLastStep && isSpecialist ? t.specialistContinueToQuestions : isLastStep ? t.seeResults : t.continue}
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
      <SpecialtyCatalogProvider>
        <AppContent />
      </SpecialtyCatalogProvider>
    </LanguageProvider>
  );
}
