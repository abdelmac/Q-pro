import assert from 'node:assert/strict';
import AlgorithmExplanation from '../src/components/AlgorithmExplanation';
import DashboardSidebar from '../src/components/DashboardSidebar';
import PageBackButton from '../src/components/PageBackButton';
import ParticipantReflectionForm, {
  PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH,
  PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH,
  type ParticipantReflectionDraft,
} from '../src/components/ParticipantReflectionForm';
import {
  ALGORITHM_FLOW_STEP_IDS,
  getAlgorithmCoverage,
} from '../src/lib/algorithmExplanation';
import {
  getDashboardNavItems,
  isCohortView,
  participantRoleLabel,
  participantRoleSupportsStudyYear,
  popDashboardViewHistory,
  pushDashboardViewHistory,
  type DashboardView,
} from '../src/lib/dashboardNavigation';
import {
  createAppNavigationReducer,
  createAppNavigationState,
  getCurrentAppLocation,
  navigateBack,
  navigateTo,
  normalizeAppLocation,
  replaceNavigation,
} from '../src/lib/appNavigation';
import RatingScale from '../src/components/RatingScale';
import { RoleSelectionView, type RoleSelectionCopy } from '../src/components/RoleSelection';
import {
  SpecialistQuestionnaireChoiceView,
  type SpecialistQuestionnaireChoiceCopy,
} from '../src/components/SpecialistQuestionnaireChoice';
import SpecialtyBibliography from '../src/components/SpecialtyBibliography';
import { TRANSLATIONS } from '../src/data/i18n';
import { ALL_QUESTION_IDS } from '../src/data/questions';
import { SPECIALTIES } from '../src/data/specialties';
import { SPECIALTY_METADATA } from '../src/data/specialtyMetadata';
import {
  hasSpecialistAuthoredNarrative,
  SPECIALIST_SOURCE_DOCUMENT,
  SPECIALTY_NARRATIVES,
} from '../src/data/specialtyNarratives';
import { QUESTION_TRAITS, VALUE_MAPPING, VALUE_OPTIONS } from '../src/data/traits';
import {
  DASHBOARD_MODEL_CHECKSUM,
  analyzeSpecialistResponse,
  analyzeStudentResponse,
  assessSpecialistEligibility,
  assignTieAwareRanks,
  buildCalibrationSummary,
  isSpecialistCalibrationComplete,
  specialistAnalyticCsv,
  specialistLongCsv,
  specialistRawCsv,
  studentAnalyticCsv,
  studentLongCsv,
  studentRawCsv,
  type SpecialistResponseRow,
  type StudentResponseRow,
} from '../src/lib/researchDashboard';
import { DASHBOARD_ANALYSIS_VERSION, DATA_VERSIONS } from '../src/lib/researchVersions';
import { RESULTS_TOP_COUNT } from '../src/lib/resultsPresentation';
import {
  getAppNavigationScrollKey,
  getDashboardNavigationScrollKey,
  getSpecialistPromptNavigationScrollKey,
  scrollToPageTop,
  type ScrollViewport,
} from '../src/lib/scrollToTop';
import {
  calculateTraits,
  rankSpecialties,
  SCORING_ENGINE_REVISION,
  SELECTED_VALUE_ONLY_SCORE,
} from '../src/lib/scoring';
import { RATING_VALUES } from '../src/lib/ratingScale';
import {
  isValidOptionalStudentStudyYear,
  isValidStudentStudyYear,
  getPostQuestionnaireDestination,
  INITIAL_PARTICIPANT_ROLE,
  PARTICIPANT_ROLES,
  STUDENT_STUDY_YEARS,
  type ParticipantRole,
} from '../src/lib/participantProfile';

function parseCsv(csv: string): string[][] {
  const input = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && input[index + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
    } else cell += character;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function elementPropsByType(node: unknown, type: unknown): Array<Record<string, unknown>> {
  const matches: Array<Record<string, unknown>> = [];
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;

    const element = candidate as { type?: unknown; props?: Record<string, unknown> };
    if (!element.props) return;
    if (element.type === type) matches.push(element.props);
    visit(element.props.children);
  };
  visit(node);
  return matches;
}

function elementTextContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(elementTextContent).join(' ');
  if (!node || typeof node !== 'object') return '';

  const element = node as { props?: { children?: unknown } };
  return elementTextContent(element.props?.children);
}

function resolvedElementPropsByType(node: unknown, type: unknown): Array<Record<string, unknown>> {
  const matches: Array<Record<string, unknown>> = [];
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;

    const element = candidate as { type?: unknown; props?: Record<string, unknown> };
    if (!element.props) return;
    if (element.type === type) matches.push(element.props);
    if (typeof element.type === 'function') {
      visit(element.type(element.props));
      return;
    }
    visit(element.props.children);
  };
  visit(node);
  return matches;
}

function resolvedElementTextContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(resolvedElementTextContent).join(' ');
  if (!node || typeof node !== 'object') return '';

  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!element.props) return '';
  if (typeof element.type === 'function') {
    return resolvedElementTextContent(element.type(element.props));
  }
  return resolvedElementTextContent(element.props.children);
}

const appNavigationReducer = createAppNavigationReducer({ maxQuizStepIndex: 82 });
let appNavigation = createAppNavigationState();
assert.deepEqual(
  appNavigationReducer(appNavigation, navigateBack()),
  appNavigation,
  'Back at the participant-role root must remain safe and deterministic',
);
appNavigation = appNavigationReducer(appNavigation, navigateTo({ phase: 'intro' }));
appNavigation = appNavigationReducer(appNavigation, navigateTo({ phase: 'quiz', stepIndex: 0 }));
appNavigation = appNavigationReducer(appNavigation, navigateTo({ phase: 'quiz', stepIndex: 1 }));
appNavigation = appNavigationReducer(appNavigation, navigateTo({ phase: 'qprofile' }));
appNavigation = appNavigationReducer(appNavigation, navigateTo({ phase: 'student' }));
appNavigation = appNavigationReducer(appNavigation, replaceNavigation({ phase: 'results' }));
assert.deepEqual(
  getCurrentAppLocation(appNavigation),
  { phase: 'results' },
  'A completed contribution must replace its form with the result page',
);
appNavigation = appNavigationReducer(appNavigation, navigateBack());
assert.deepEqual(
  getCurrentAppLocation(appNavigation),
  { phase: 'qprofile' },
  'Back from results must return to the exact previous screen without reopening a submitted form',
);
appNavigation = appNavigationReducer(appNavigation, navigateBack());
assert.deepEqual(
  getCurrentAppLocation(appNavigation),
  { phase: 'quiz', stepIndex: 1 },
  'Application history must preserve the exact questionnaire step',
);
assert.deepEqual(normalizeAppLocation({ phase: 'quiz', stepIndex: 999 }, { maxQuizStepIndex: 82 }), { phase: 'quiz', stepIndex: 82 });
assert.deepEqual(normalizeAppLocation({ phase: 'detail', specialtyName: '   ' }), { phase: 'explorer' });
let explorerNavigation = createAppNavigationState({ phase: 'results' });
explorerNavigation = appNavigationReducer(explorerNavigation, navigateTo({ phase: 'explorer' }));
explorerNavigation = appNavigationReducer(explorerNavigation, navigateTo({ phase: 'detail', specialtyName: 'Cardiology' }));
explorerNavigation = appNavigationReducer(explorerNavigation, navigateBack());
assert.deepEqual(getCurrentAppLocation(explorerNavigation), { phase: 'explorer' });
explorerNavigation = appNavigationReducer(explorerNavigation, navigateBack());
assert.deepEqual(
  getCurrentAppLocation(explorerNavigation),
  { phase: 'results' },
  'Explorer and specialty detail must return to their actual origin instead of inferring it from score state',
);

let sharedBackClicks = 0;
const sharedBackButton = PageBackButton({ label: 'Previous page', onClick: () => { sharedBackClicks += 1; } });
const sharedBackButtonProps = elementPropsByType(sharedBackButton, 'button')[0];
assert.equal(sharedBackButtonProps.type, 'button');
assert.equal(sharedBackButtonProps['data-navigation-back'], true);
assert.ok(String(sharedBackButtonProps.className).includes('min-h-11'), 'The shared back control must expose a mobile-size touch target');
assert.match(resolvedElementTextContent(sharedBackButton), /Previous page/);
(sharedBackButtonProps.onClick as () => void)();
assert.equal(sharedBackClicks, 1);

const participantDraft: ParticipantReflectionDraft = {
  submissionId: '00000000-0000-4000-8000-000000000099',
  studyYear: '4',
  medicineView: 'Medicine combines knowledge, care, and responsibility.',
};
let updatedParticipantDraft: ParticipantReflectionDraft | null = null;
let participantSkipCount = 0;
const studentReflectionForm = ParticipantReflectionForm({
  participantRole: 'student',
  draft: participantDraft,
  onDraftChange: (draft) => { updatedParticipantDraft = draft; },
  submitting: false,
  error: null,
  copy: TRANSLATIONS.en,
  onSubmit: () => undefined,
  onSkip: () => { participantSkipCount += 1; },
});
const participantTextareas = elementPropsByType(studentReflectionForm, 'textarea');
assert.equal(participantTextareas.length, 1, 'The participant consent page must render one medicine-reflection textbox');
assert.equal(participantTextareas[0].name, 'medicine_view');
assert.equal(participantTextareas[0].required, true);
assert.equal(participantTextareas[0].minLength, PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH);
assert.equal(participantTextareas[0].maxLength, PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH);
(participantTextareas[0].onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Updated view' } });
assert.equal(updatedParticipantDraft?.medicineView, 'Updated view');
const studentStudyYearSelects = elementPropsByType(studentReflectionForm, 'select');
assert.equal(studentStudyYearSelects.length, 1, 'Medical students must retain the optional 1-to-6 study-year field');
assert.deepEqual(
  elementPropsByType(studentStudyYearSelects[0].children, 'option').slice(1).map((option) => option.value),
  [1, 2, 3, 4, 5, 6],
);
const participantButtons = elementPropsByType(studentReflectionForm, 'button');
assert.equal(participantButtons.find((button) => button.type === 'submit')?.disabled, false);
const participantSkipButton = participantButtons.find((button) => button.type === 'button');
assert.ok(participantSkipButton, 'Saving the research contribution must remain optional');
(participantSkipButton?.onClick as () => void)();
assert.equal(participantSkipCount, 1);

const curiousReflectionForm = ParticipantReflectionForm({
  participantRole: 'curious',
  draft: { ...participantDraft, studyYear: '' },
  onDraftChange: () => undefined,
  submitting: false,
  error: null,
  copy: TRANSLATIONS.en,
  onSubmit: () => undefined,
  onSkip: () => undefined,
});
assert.equal(
  elementPropsByType(curiousReflectionForm, 'select').length,
  0,
  'People exploring medicine must never be shown a medical study-year field',
);
assert.match(resolvedElementTextContent(curiousReflectionForm), /What do you think about medicine\?/);
const blankReflectionForm = ParticipantReflectionForm({
  participantRole: 'student',
  draft: { ...participantDraft, medicineView: '   ' },
  onDraftChange: () => undefined,
  submitting: false,
  error: null,
  copy: TRANSLATIONS.en,
  onSubmit: () => undefined,
  onSkip: () => undefined,
});
assert.equal(
  elementPropsByType(blankReflectionForm, 'button').find((button) => button.type === 'submit')?.disabled,
  true,
  'Whitespace-only qualitative text must not enable research saving',
);

const readOnlyDashboardItems = getDashboardNavItems(false, 'en');
assert.deepEqual(
  readOnlyDashboardItems.map(({ id }) => id),
  ['specialists', 'students', 'algorithm'],
  'Every authorized portal account must see both cohorts followed by the algorithm guide',
);
assert.deepEqual(
  readOnlyDashboardItems.map(({ section }) => section),
  ['data', 'data', 'method'],
  'The sidebar must separate research cohorts from the algorithm method guide',
);
assert.deepEqual(
  getDashboardNavItems(true, 'en').map(({ id }) => id),
  ['specialists', 'students', 'algorithm', 'configuration'],
  'Catalog configuration must be appended only for accounts with edit permission',
);
assert.deepEqual(
  readOnlyDashboardItems.map(({ label }) => label),
  ['Specialists', 'Students & explorers', 'How the algorithm works'],
  'The dashboard must name both participant audiences instead of silently grouping explorers as students',
);
assert.deepEqual(
  getDashboardNavItems(false, 'fr').map(({ label }) => label),
  ['Spécialistes', 'Étudiants & explorateurs', 'Comprendre l’algorithme'],
  'The dashboard sidebar must expose French labels for every generally available view',
);
assert.deepEqual(
  getDashboardNavItems(false, 'ro').map(({ label }) => label),
  ['Specialiști', 'Studenți și exploratori', 'Cum funcționează algoritmul'],
  'The dashboard sidebar must expose Romanian labels for every generally available view',
);
assert.deepEqual(
  (['en', 'fr', 'ro'] as const).map((language) => participantRoleLabel('student', language)),
  ['Medical student', 'Étudiant en médecine', 'Student la medicină'],
);
assert.deepEqual(
  (['en', 'fr', 'ro'] as const).map((language) => participantRoleLabel('curious', language)),
  ['Exploring medicine', 'Découverte de la médecine', 'Explorează medicina'],
  'Every dashboard language must keep explorers visibly separate from medical students',
);
assert.equal(participantRoleSupportsStudyYear('student'), true);
assert.equal(participantRoleSupportsStudyYear('all'), true);
assert.equal(
  participantRoleSupportsStudyYear('curious'),
  false,
  'The dashboard must not combine a medicine-explorer audience with an impossible study-year filter',
);

for (const cohortView of ['specialists', 'students'] as const) {
  assert.equal(isCohortView(cohortView), true, `${cohortView} must be recognized as a cohort view`);
}
for (const staticView of ['algorithm', 'configuration'] as const) {
  assert.equal(
    isCohortView(staticView),
    false,
    `${staticView} must not be treated as a cohort query, filter, table, or export view`,
  );
}

let dashboardViewHistory: DashboardView[] = [];
dashboardViewHistory = pushDashboardViewHistory(dashboardViewHistory, 'specialists', 'students');
dashboardViewHistory = pushDashboardViewHistory(dashboardViewHistory, 'students', 'algorithm');
assert.deepEqual(
  dashboardViewHistory,
  ['specialists', 'students'],
  'Selecting distinct dashboard tabs must retain the exact visit order',
);
assert.deepEqual(
  pushDashboardViewHistory(dashboardViewHistory, 'algorithm', 'algorithm'),
  dashboardViewHistory,
  'Selecting the active dashboard tab must not add a duplicate history entry',
);
const firstDashboardBack = popDashboardViewHistory(dashboardViewHistory);
assert.equal(firstDashboardBack.previousView, 'students');
assert.deepEqual(firstDashboardBack.remainingHistory, ['specialists']);
const secondDashboardBack = popDashboardViewHistory(firstDashboardBack.remainingHistory);
assert.equal(secondDashboardBack.previousView, 'specialists');
assert.deepEqual(secondDashboardBack.remainingHistory, []);
assert.deepEqual(
  popDashboardViewHistory([]),
  { previousView: null, remainingHistory: [] },
  'At the first dashboard tab, Previous must fall through to the parent page',
);

const selectedDashboardViews: DashboardView[] = [];
const dashboardSidebar = DashboardSidebar({
  id: 'dashboard-sidebar-test',
  activeView: 'algorithm',
  canEdit: false,
  lang: 'en',
  displayName: 'Authorized reviewer',
  portalRole: 'doctor',
  onSelectView: (view) => selectedDashboardViews.push(view),
  onBack: () => undefined,
  onSignOut: () => undefined,
});
const dashboardAsides = elementPropsByType(dashboardSidebar, 'aside');
const dashboardNavs = elementPropsByType(dashboardSidebar, 'nav');
const dashboardNavButtons = elementPropsByType(dashboardSidebar, 'button')
  .filter((button) => button['data-dashboard-view'] !== undefined);
assert.equal(dashboardAsides.length, 1, 'The sidebar must use one semantic aside landmark');
assert.equal(dashboardAsides[0].id, 'dashboard-sidebar-test');
assert.equal(dashboardAsides[0]['data-dashboard-sidebar'], true);
assert.equal(dashboardAsides[0]['aria-label'], 'Dashboard navigation');
assert.equal(dashboardNavs.length, 1, 'The sidebar sections must be grouped in one navigation landmark');
assert.equal(dashboardNavs[0]['aria-label'], 'Dashboard sections');
assert.deepEqual(
  dashboardNavButtons.map((button) => button['data-dashboard-view']),
  ['specialists', 'students', 'algorithm'],
  'Rendered read-only navigation must preserve its canonical order and hide configuration',
);
for (const button of dashboardNavButtons) {
  assert.equal(button.type, 'button', 'Sidebar navigation controls must never submit a surrounding form');
  assert.ok(
    String(button.className ?? '').includes('focus-visible:ring-2'),
    'Every sidebar destination must expose a visible keyboard focus treatment',
  );
  const view = button['data-dashboard-view'] as DashboardView;
  assert.equal(
    button['aria-current'],
    view === 'algorithm' ? 'page' : undefined,
    'Exactly the active sidebar destination must expose aria-current="page"',
  );
  (button.onClick as () => void)();
}
assert.deepEqual(
  selectedDashboardViews,
  ['specialists', 'students', 'algorithm'],
  'Each sidebar destination must emit its exact dashboard view',
);

const editorSidebar = DashboardSidebar({
  activeView: 'configuration',
  canEdit: true,
  lang: 'en',
  displayName: 'Professor',
  portalRole: 'professor',
  onSelectView: () => undefined,
  onBack: () => undefined,
  onSignOut: () => undefined,
});
const editorNavButtons = elementPropsByType(editorSidebar, 'button')
  .filter((button) => button['data-dashboard-view'] !== undefined);
assert.equal(editorNavButtons.length, 4, 'An editor must receive the additional configuration destination');
assert.equal(editorNavButtons[3]['data-dashboard-view'], 'configuration');
assert.equal(editorNavButtons[3]['aria-current'], 'page');

let sidebarCloseCount = 0;
const mobileDashboardSidebar = DashboardSidebar({
  activeView: 'specialists',
  canEdit: false,
  lang: 'en',
  displayName: 'Doctor',
  portalRole: 'doctor',
  showClose: true,
  onClose: () => { sidebarCloseCount += 1; },
  onSelectView: () => undefined,
  onBack: () => undefined,
  onSignOut: () => undefined,
});
const closeSidebarButtons = elementPropsByType(mobileDashboardSidebar, 'button')
  .filter((button) => button['aria-label'] === 'Close menu');
assert.equal(closeSidebarButtons.length, 1, 'The mobile sidebar must expose one explicitly labelled close control');
assert.equal(closeSidebarButtons[0].autoFocus, true, 'The mobile close control must receive initial keyboard focus');
(closeSidebarButtons[0].onClick as () => void)();
assert.equal(sidebarCloseCount, 1, 'The mobile close control must call its close handler');

const algorithmSpecialtyCount = SPECIALTIES.length;
const algorithmCatalogRevision = 42;
const algorithmCatalogHash = '0123456789abcdef0123456789abcdef';
const algorithmExplanation = AlgorithmExplanation({
  lang: 'en',
  catalogRevision: algorithmCatalogRevision,
  catalogHash: algorithmCatalogHash,
  specialties: SPECIALTIES,
});
const algorithmArticles = elementPropsByType(algorithmExplanation, 'article');
const algorithmStepItems = elementPropsByType(algorithmExplanation, 'li')
  .filter((item) => item['data-algorithm-step'] !== undefined);
assert.equal(algorithmArticles.length, 1, 'The algorithm guide must have one article root');
assert.equal(algorithmArticles[0]['data-algorithm-explanation'], true);
assert.deepEqual(
  algorithmStepItems.map((item) => item['data-algorithm-step']),
  ALGORITHM_FLOW_STEP_IDS,
  'The detailed guide must render every canonical algorithm stage exactly once and in order',
);
assert.deepEqual(
  [...ALGORITHM_FLOW_STEP_IDS],
  ['inputs', 'traits', 'values', 'comparison', 'score', 'ranking'],
  'The public diagram contract must retain the complete input-to-ranking pipeline',
);

const algorithmText = resolvedElementTextContent(algorithmExplanation).replace(/\s+/gu, ' ');
for (const requiredText of [
  '81 ratings',
  '((answer − 1) / 9) × 100',
  '90/100 value-only signal',
  'only traits available in both',
  'similarity = max(0, 100 − |participant trait − specialty target|)',
  'dimension multiplier = 0.5 + priority / 100 (or 1.0 when neutral)',
  'value multiplier = 1 + mapped bonus / 24 (strongest selected value retained)',
  'effective weight = profile importance × dimension multiplier × value multiplier',
  'fit index = Σ(similarity × effective weight) / Σ(effective weight)',
  'manual_orientation',
  'prevention_orientation',
  'Top-k recall',
  'Very small eligible samples are descriptive only',
  'No automatic learning from submissions',
  'not a probability of success',
]) {
  assert.ok(
    algorithmText.includes(requiredText),
    `The algorithm guide must retain this scientific explanation: ${requiredText}`,
  );
}
assert.ok(
  algorithmText.includes(String(algorithmSpecialtyCount)),
  'The algorithm guide must display the specialty count supplied by the runtime catalog',
);
const algorithmCoverage = getAlgorithmCoverage(SPECIALTIES);
assert.deepEqual(
  {
    questionCount: algorithmCoverage.questionCount,
    dimensionCount: algorithmCoverage.dimensionCount,
    totalDictionary: algorithmCoverage.totalDictionary,
    usedByProfiles: algorithmCoverage.usedByProfiles,
    directlyMeasured: algorithmCoverage.directlyMeasured,
    valueOnly: algorithmCoverage.valueOnly,
    unmeasured: algorithmCoverage.unmeasured,
    unusedByProfiles: algorithmCoverage.unusedByProfiles,
    usedDirectlyMeasured: algorithmCoverage.usedDirectlyMeasured,
    usedValueOnly: algorithmCoverage.usedValueOnly,
    usedUnmeasured: algorithmCoverage.usedUnmeasured,
  },
  {
    questionCount: 81,
    dimensionCount: 5,
    totalDictionary: 96,
    usedByProfiles: 68,
    directlyMeasured: 92,
    valueOnly: 3,
    unmeasured: 1,
    unusedByProfiles: 28,
    usedDirectlyMeasured: 66,
    usedValueOnly: 1,
    usedUnmeasured: 1,
  },
  'The visual coverage audit must be derived from the canonical mappings and published profiles',
);
assert.deepEqual(
  algorithmCoverage.valueOnlyTraits,
  ['manual_orientation', 'prestige_priority', 'security_priority'],
);
assert.deepEqual(algorithmCoverage.unmeasuredTraits, ['prevention_orientation']);
for (const metric of [96, 92, 68, 66, 28]) {
  assert.ok(
    algorithmText.includes(String(metric)),
    `The algorithm guide must display the derived coverage metric ${metric}`,
  );
}
const algorithmImages = resolvedElementPropsByType(algorithmExplanation, 'svg');
const algorithmImageTitles = resolvedElementPropsByType(algorithmExplanation, 'title');
const algorithmImageDescriptions = resolvedElementPropsByType(algorithmExplanation, 'desc');
assert.equal(algorithmImages.length, 1, 'The algorithm flow must render as exactly one image semantic');
assert.equal(algorithmImages[0].role, 'img');
assert.equal(
  algorithmImages[0]['aria-labelledby'],
  'algorithm-diagram-title algorithm-diagram-description',
  'The algorithm image must reference its accessible title and description',
);
assert.equal(algorithmImageTitles.length, 1);
assert.equal(algorithmImageTitles[0].id, 'algorithm-diagram-title');
assert.equal(algorithmImageDescriptions.length, 1);
assert.equal(algorithmImageDescriptions[0].id, 'algorithm-diagram-description');
for (const provenance of [
  SCORING_ENGINE_REVISION,
  DATA_VERSIONS.scoring,
  DATA_VERSIONS.questionnaire,
  `r${algorithmCatalogRevision}`,
  algorithmCatalogHash.slice(0, 12),
]) {
  assert.ok(
    algorithmText.includes(provenance),
    `The active algorithm provenance must display ${provenance}`,
  );
}

for (const [language, requiredCopy] of [
  ['fr', ['Comment fonctionne l’algorithme de correspondance', 'Aucun apprentissage automatique depuis les réponses', 'similarité = max(0', 'Limites structurelles à garder visibles']],
  ['ro', ['Cum funcționează algoritmul de potrivire', 'Nicio învățare automată din răspunsuri', 'similaritate = max(0', 'Limitări structurale care trebuie păstrate vizibile']],
] as const) {
  const localizedText = resolvedElementTextContent(AlgorithmExplanation({
    lang: language,
    catalogRevision: algorithmCatalogRevision,
    catalogHash: algorithmCatalogHash,
    specialties: SPECIALTIES,
  })).replace(/\s+/gu, ' ');
  for (const copy of requiredCopy) {
    assert.ok(localizedText.includes(copy), `The ${language} algorithm guide must include: ${copy}`);
  }
}

assert.deepEqual(
  [...PARTICIPANT_ROLES],
  ['student', 'specialist', 'curious'],
  'The initial identity gate must expose student, specialist, and curious roles in that order',
);
assert.equal(
  INITIAL_PARTICIPANT_ROLE,
  null,
  'A new questionnaire session must not silently default to the student role',
);

const roleSelectionCopy: RoleSelectionCopy = {
  appName: 'Q-Pro',
  title: 'Identify your profile',
  description: 'Choose the profile that applies to you.',
  studentLabel: 'Student',
  studentDescription: 'Complete the orientation questionnaire.',
  specialistLabel: 'Specialist',
  specialistDescription: 'Contribute calibration data.',
  curiousLabel: 'Exploring medicine',
  curiousDescription: 'Explore medicine without joining a research cohort.',
  footerNote: 'Orientation tool',
};
const selectedRoles: ParticipantRole[] = [];
const roleSelection = RoleSelectionView({
  copy: roleSelectionCopy,
  onSelectRole: (role) => selectedRoles.push(role),
});
const roleFieldsets = elementPropsByType(roleSelection, 'fieldset');
const roleLegends = elementPropsByType(roleSelection, 'legend');
const roleButtons = elementPropsByType(roleSelection, 'button');
assert.equal(roleFieldsets.length, 1, 'The identity choices must be grouped in one fieldset');
assert.equal(roleLegends.length, 1, 'The identity choice group must have one accessible legend');
assert.equal(roleLegends[0].children, roleSelectionCopy.title);
assert.equal(roleButtons.length, 3, 'The identity gate must render one button per participant role');
assert.deepEqual(
  roleButtons.map((button) => button['data-participant-role']),
  PARTICIPANT_ROLES,
  'Role buttons must preserve the canonical student-then-specialist ordering',
);
for (const [index, button] of roleButtons.entries()) {
  assert.equal(button.type, 'button', 'Role choices must not submit an enclosing form');
  assert.equal(button.disabled, undefined, 'Both identity choices must be immediately operable');
  assert.ok(
    String(button.className ?? '').includes('focus-visible:ring-2'),
    'Each role button must expose a visible keyboard focus treatment',
  );
  const expectedCopy = [
    [roleSelectionCopy.studentLabel, roleSelectionCopy.studentDescription],
    [roleSelectionCopy.specialistLabel, roleSelectionCopy.specialistDescription],
    [roleSelectionCopy.curiousLabel, roleSelectionCopy.curiousDescription],
  ][index];
  const [expectedLabel, expectedDescription] = expectedCopy;
  const accessibleText = elementTextContent(button.children);
  assert.ok(
    accessibleText.includes(expectedLabel) && accessibleText.includes(expectedDescription),
    'Each native role button must contain its visible label and explanatory accessible text',
  );
  (button.onClick as () => void)();
}
assert.deepEqual(
  selectedRoles,
  PARTICIPANT_ROLES,
  'Selecting each identity button must emit its exact canonical participant role',
);

const specialistPathCopy: SpecialistQuestionnaireChoiceCopy = {
  appName: 'Q-Pro',
  back: 'Back',
  title: 'How would you like to contribute?',
  description: 'The 81-item questionnaire is optional.',
  answerLabel: 'Answer the 81-item questionnaire',
  answerDescription: 'Quantitative calibration and personal results.',
  skipLabel: 'Go directly to the specialist questions',
  skipDescription: 'Qualitative contribution only.',
  privacy: 'Data is stored only after explicit submission.',
};
const selectedSpecialistPaths: string[] = [];
const specialistPathChoice = SpecialistQuestionnaireChoiceView({
  copy: specialistPathCopy,
  onAnswerQuestionnaire: () => selectedSpecialistPaths.push('answer'),
  onSkipQuestionnaire: () => selectedSpecialistPaths.push('skip'),
  onBack: () => selectedSpecialistPaths.push('back'),
});
const specialistPathButtons = elementPropsByType(specialistPathChoice, 'button');
const answerPathButton = specialistPathButtons.find((button) => button['data-specialist-path'] === 'answer');
const skipPathButton = specialistPathButtons.find((button) => button['data-specialist-path'] === 'skip');
assert.ok(answerPathButton, 'Specialists must be offered the complete 81-item path');
assert.ok(skipPathButton, 'Specialists must be offered a direct path to the five qualitative questions');
assert.equal(answerPathButton.type, 'button');
assert.equal(skipPathButton.type, 'button');
assert.ok(String(answerPathButton.className).includes('min-h-48'));
assert.ok(String(skipPathButton.className).includes('min-h-48'));
(answerPathButton.onClick as () => void)();
(skipPathButton.onClick as () => void)();
assert.deepEqual(selectedSpecialistPaths, ['answer', 'skip']);
for (const language of ['en', 'ro', 'fr'] as const) {
  const copy = TRANSLATIONS[language];
  assert.ok(copy.specialistPathDescription.includes('81'), `${language} must explain that q81 is optional`);
  assert.ok(copy.specialistPromptDescSkipped.trim(), `${language} must explain the qualitative-only consent`);
  assert.ok(copy.specialistFinishSkipped.trim(), `${language} must provide a non-results completion action`);
}

assert.equal(getPostQuestionnaireDestination('student'), 'student');
assert.equal(getPostQuestionnaireDestination('specialist'), 'specialist');
assert.equal(
  getPostQuestionnaireDestination('curious'),
  'student',
  'Curious participants must see the shared reflection and consent screen before results',
);
for (const language of ['en', 'ro', 'fr'] as const) {
  const copy = TRANSLATIONS[language];
  assert.ok(copy.curiousMode.trim(), `${language} must define the curious role label`);
  assert.ok(copy.curiousRoleDescription.trim(), `${language} must explain the curious role`);
  assert.ok(copy.curiousIntroBadge.trim(), `${language} must define the curious intro badge`);
}

assert.deepEqual(
  [...STUDENT_STUDY_YEARS],
  [1, 2, 3, 4, 5, 6],
  'Medical student study years must be limited to the exact range from 1 to 6',
);
for (const year of STUDENT_STUDY_YEARS) {
  assert.equal(isValidStudentStudyYear(year), true, `Study year ${year} must be valid`);
  assert.equal(isValidOptionalStudentStudyYear(year), true, `Optional study year ${year} must be valid`);
}
for (const invalidYear of [0, 7, 12, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', '6', {}, []]) {
  assert.equal(isValidStudentStudyYear(invalidYear), false, `${String(invalidYear)} must not be a valid study year`);
  assert.equal(
    isValidOptionalStudentStudyYear(invalidYear),
    false,
    `${String(invalidYear)} must not be a valid optional study year`,
  );
}
assert.equal(isValidStudentStudyYear(null), false, 'A required study year validator must reject null');
assert.equal(isValidStudentStudyYear(undefined), false, 'A required study year validator must reject undefined');
assert.equal(isValidOptionalStudentStudyYear(null), true, 'An optional study year must accept null');
assert.equal(isValidOptionalStudentStudyYear(undefined), true, 'An optional study year must accept undefined');

const ratings = Object.fromEntries(ALL_QUESTION_IDS.map((id, index) => [id, (index % 10) + 1]));
assert.equal(ALL_QUESTION_IDS.length, 81, 'The questionnaire must keep all 81 rating questions');
assert.deepEqual(
  RATING_VALUES,
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'The mobile rating control must preserve the exact integer scale from 1 to 10',
);
const renderRatingScaleForTest = (
  value: number | null,
  onChange: (rating: number) => void = () => undefined,
) => RatingScale({
  value,
  onChange,
  questionId: 'T1',
  questionText: 'Translated question',
  labels: { low: 'Low', high: 'High' },
  unansweredLabel: 'No rating selected',
});
const emittedRatings: number[] = [];
const unansweredRatingScale = renderRatingScaleForTest(null, (value) => emittedRatings.push(value));
const unansweredRatingInputs = elementPropsByType(unansweredRatingScale, 'input');
const unansweredRatingInput = unansweredRatingInputs[0];
assert.equal(unansweredRatingScale.type, 'fieldset');
assert.equal(unansweredRatingScale.props['aria-describedby'], 'T1-rating-scale-help');
assert.equal(elementPropsByType(unansweredRatingScale, 'legend')[0]?.children, 'Translated question');
assert.equal(unansweredRatingInputs.length, 1, 'Each question must expose one native slider');
assert.equal(unansweredRatingInput.type, 'range');
assert.equal(unansweredRatingInput.min, 1);
assert.equal(unansweredRatingInput.max, 10);
assert.equal(unansweredRatingInput.step, 1);
assert.equal(
  unansweredRatingInput.value,
  1,
  'The native fallback stays in range while the visual and accessible state remains unanswered',
);
assert.equal(unansweredRatingInput['aria-label'], 'Translated question');
assert.equal(unansweredRatingInput['aria-describedby'], 'T1-rating-scale-help');
assert.equal(unansweredRatingInput['aria-valuetext'], 'No rating selected');
assert.equal(
  elementPropsByType(unansweredRatingScale, 'span')
    .filter(({ 'data-rating-thumb': thumb }) => thumb !== undefined).length,
  0,
  'An unanswered question must not display a thumb or imply a default answer',
);
assert.equal(
  elementPropsByType(unansweredRatingScale, 'svg').length,
  0,
  'The rating slider must not render a smiley or any SVG',
);

const changeRating = unansweredRatingInput.onChange as (event: {
  currentTarget: { value: string };
}) => void;
for (const candidate of ['1', '5', '10', '0', '11', '1.5', 'invalid']) {
  changeRating({ currentTarget: { value: candidate } });
}
assert.deepEqual(
  emittedRatings,
  [1, 5, 10],
  'The slider must emit unchanged scale integers and ignore invalid candidates',
);

const pointerRatings: number[] = [];
const pointerRatingScale = renderRatingScaleForTest(null, (value) => pointerRatings.push(value));
const pointerRatingInput = elementPropsByType(pointerRatingScale, 'input')[0];
assert.equal(pointerRatingInput.onClick, undefined, 'Synthetic clicks must not alter a rating');
const releasePointer = pointerRatingInput.onPointerUp as (event: {
  isPrimary: boolean;
  button: number;
  clientX: number;
  currentTarget: { getBoundingClientRect: () => { left: number; width: number } };
}) => void;
const pointerTarget = {
  getBoundingClientRect: () => ({ left: 100, width: 240 }),
};
for (const clientX of [100, 220, 340]) {
  releasePointer({ isPrimary: true, button: 0, clientX, currentTarget: pointerTarget });
}
assert.deepEqual(
  pointerRatings,
  [1, 6, 10],
  'Pointer releases must clamp to both endpoints and snap the physical midpoint to an exact integer',
);
releasePointer({ isPrimary: false, button: 0, clientX: 220, currentTarget: pointerTarget });
releasePointer({ isPrimary: true, button: 2, clientX: 220, currentTarget: pointerTarget });
assert.deepEqual(pointerRatings, [1, 6, 10], 'Secondary pointers and buttons must not alter a rating');

const keyboardRatings: number[] = [];
const keyboardRatingScale = renderRatingScaleForTest(null, (value) => keyboardRatings.push(value));
const keyboardRatingInput = elementPropsByType(keyboardRatingScale, 'input')[0];
const keyDown = keyboardRatingInput.onKeyDown as (event: {
  key: string;
  preventDefault: () => void;
}) => void;
let preventedKeyboardEvents = 0;
for (const key of [' ', 'ArrowRight', 'End', 'Tab']) {
  keyDown({ key, preventDefault: () => { preventedKeyboardEvents += 1; } });
}
assert.deepEqual(
  keyboardRatings,
  [1, 2, 10],
  'An unanswered slider must support keyboard selection without generating a fractional value',
);
assert.equal(preventedKeyboardEvents, 3, 'Only handled rating keys may suppress their native action');

const selectedRatingScale = renderRatingScaleForTest(7);
const selectedRatingInputs = elementPropsByType(selectedRatingScale, 'input');
assert.equal(selectedRatingInputs.length, 1);
assert.equal(selectedRatingInputs[0].value, 7, 'The native slider must reflect the exact selected integer');
assert.equal(
  selectedRatingInputs[0]['aria-valuetext'],
  undefined,
  'A selected value must use the native numeric announcement',
);
const selectedThumbs = elementPropsByType(selectedRatingScale, 'span')
  .filter(({ 'data-rating-thumb': thumb }) => thumb !== undefined);
assert.equal(selectedThumbs.length, 1, 'A selected rating must display exactly one numeric thumb');
assert.equal(selectedThumbs[0]['data-rating-thumb'], 7);
assert.equal(selectedThumbs[0].children, 7, 'The thumb must keep the selected integer visible');
assert.equal(
  elementPropsByType(selectedRatingScale, 'svg').length,
  0,
  'A selected rating must remain emoji- and SVG-free',
);
const invalidSelectedRatingScale = renderRatingScaleForTest(7.5);
assert.equal(
  elementPropsByType(invalidSelectedRatingScale, 'span')
    .filter(({ 'data-rating-thumb': thumb }) => thumb !== undefined).length,
  0,
  'A non-integer value must not appear as a valid selected rating',
);

const ratingScaleClasses = elementPropsByType(unansweredRatingScale, 'div')
  .map(({ className }) => String(className ?? ''));
assert.ok(
  String(unansweredRatingInput.className).includes('h-14')
    && String(unansweredRatingInput.className).includes('w-full')
    && String(unansweredRatingInput.className).includes('touch-pan-y'),
  'The native slider must expose a full-width, 56px touch target without blocking vertical scrolling',
);
assert.ok(
  ratingScaleClasses.some((className) => className.includes('peer-focus-visible:ring-2')),
  'Keyboard focus must produce a visible focus indicator',
);
const ratingTicks = elementPropsByType(unansweredRatingScale, 'span')
  .filter(({ 'data-rating-tick': tick }) => tick !== undefined);
assert.deepEqual(
  ratingTicks.map(({ 'data-rating-tick': tick }) => tick),
  RATING_VALUES,
  'The visible rail must retain all ten integer tick positions',
);
const ratingNumbers = elementPropsByType(unansweredRatingScale, 'span')
  .filter(({ className, children }) => (
    String(className ?? '').includes('text-xs') && typeof children === 'number'
  ));
assert.deepEqual(
  ratingNumbers.map(({ children }) => children),
  RATING_VALUES,
  'All ten numeric labels must remain visible around the compact mobile slider',
);
const trackWidth = (value: number | null) => {
  const progressElement = elementPropsByType(renderRatingScaleForTest(value), 'span')
    .find(({ 'data-rating-progress': marker }) => marker !== undefined);
  return (progressElement?.style as { width?: string } | undefined)?.width;
};
assert.equal(trackWidth(null), '0%', 'An unanswered scale must have no active rail');
assert.equal(trackWidth(1), '0%', 'The first rating must begin at the start of the rail');
assert.ok(
  Math.abs(Number.parseFloat(trackWidth(5) ?? '') - ((4 / 9) * 100)) < 1e-10,
  'The progress rail must place value 5 at its exact tenth-scale position',
);
assert.equal(trackWidth(10), '100%', 'Value 10 must complete the rail');

assert.equal(
  SpecialtyBibliography({ references: [], title: 'Bibliography' }),
  null,
  'A specialty without supplied references must not render an empty bibliography section',
);
const singleReference = 'Specialist reference — preserved verbatim.';
const singleBibliography = SpecialtyBibliography({
  references: [singleReference],
  title: 'Bibliography',
});
assert.equal(elementPropsByType(singleBibliography, 'h3').length, 1);
assert.equal(
  elementPropsByType(singleBibliography, 'h3')[0]?.children,
  'Bibliography',
  'The standalone bibliography must use its supplied h3 title',
);
assert.deepEqual(
  elementPropsByType(singleBibliography, 'li').map(({ children }) => children),
  [singleReference],
  'A single bibliography entry must be rendered verbatim',
);
const multipleReferences = [
  'First specialist reference, including punctuation.',
  'Second specialist reference — kept in source order.',
] as const;
const nestedBibliography = SpecialtyBibliography({
  references: multipleReferences,
  title: 'Bibliografie',
  headingLevel: 'h5',
});
assert.equal(elementPropsByType(nestedBibliography, 'h3').length, 0);
assert.equal(elementPropsByType(nestedBibliography, 'h5').length, 1);
assert.equal(
  elementPropsByType(nestedBibliography, 'h5')[0]?.children,
  'Bibliografie',
  'A bibliography nested in a result card must use its supplied h5 title',
);
assert.deepEqual(
  elementPropsByType(nestedBibliography, 'li').map(({ children }) => children),
  multipleReferences,
  'Multiple bibliography entries must remain verbatim and in their supplied order',
);

assert.equal(RESULTS_TOP_COUNT, 10, 'The results page must expose a complete Top 10');
assert.equal(SPECIALIST_SOURCE_DOCUMENT.numberedSections, 58);
assert.equal(SPECIALIST_SOURCE_DOCUMENT.uniqueSpecialties, 57);
assert.equal(
  SPECIALIST_SOURCE_DOCUMENT.sha256,
  '1E4C334306D56EE90CF007D57756860CC7690E301ABC83D768772F96EAB4E9E7',
);
assert.equal(
  SPECIALIST_SOURCE_DOCUMENT.localizedPayloadSha256,
  '5BAB0FAEEF926B14931708368C056184A044C17630AF1C8F76FD563C14FA0854',
);
assert.deepEqual(SPECIALIST_SOURCE_DOCUMENT.mergedSections.Pulmonology, [6, 55]);
assert.deepEqual(SPECIALIST_SOURCE_DOCUMENT.missingSpecialties, ['Pathology']);
assert.equal(hasSpecialistAuthoredNarrative('Pathology'), false);
assert.equal(hasSpecialistAuthoredNarrative('Pulmonology'), true);
assert.deepEqual(
  SPECIALTY_NARRATIVES.Pathology.sourceReferences,
  [],
  'Pathology must continue to render no bibliography when no specialist source exists',
);
assert.deepEqual(
  SPECIALTY_NARRATIVES['Otorhinolaryngology (ENT)'].sourceReferences,
  [
    'Loh C, et al. Personality traits of otorhinolaryngologists: associations with career satisfaction. Eur Arch Otorhinolaryngol. 2022;279(4):1807–1815.',
  ],
  'The exact specialist-supplied Otorhinolaryngology bibliography must be retained',
);
assert.equal(
  Object.values(SPECIALTY_NARRATIVES).reduce(
    (total, narrative) => total + narrative.sourceReferences.length,
    0,
  ),
  33,
  'Every bibliography entry supplied by the specialist must be preserved exactly once',
);
for (const language of ['en', 'ro', 'fr'] as const) {
  assert.equal(
    SPECIALTY_NARRATIVES.Pulmonology.overview[language].split(/\n\n/u).length,
    2,
    `Pulmonology overview.${language} must preserve source sections 6 and 55`,
  );
  assert.equal(
    SPECIALTY_NARRATIVES.Pulmonology.fitProfile[language].split(/\n\n/u).length,
    2,
    `Pulmonology fitProfile.${language} must preserve source sections 6 and 55`,
  );
}
let requestedScroll: ScrollToOptions | undefined;
scrollToPageTop({
  scrollTo(options) {
    requestedScroll = options;
  },
} satisfies ScrollViewport);
assert.deepEqual(
  requestedScroll,
  { top: 0, left: 0, behavior: 'auto' },
  'Every navigation transition must reset the viewport to the document origin',
);
assert.notEqual(
  getAppNavigationScrollKey('quiz', 3, null),
  getAppNavigationScrollKey('quiz', 4, null),
  'Moving between questionnaire steps must create a new scroll-reset key',
);
assert.equal(
  getAppNavigationScrollKey('results', 3, 'Cardiology'),
  getAppNavigationScrollKey('results', 4, 'Pathology'),
  'Non-navigation state must not reset scroll on a stable root screen',
);
assert.notEqual(
  getAppNavigationScrollKey('detail', 0, 'Cardiology'),
  getAppNavigationScrollKey('detail', 0, 'Pathology'),
  'Opening another specialty detail must create a new scroll-reset key',
);
assert.notEqual(
  getAppNavigationScrollKey('role', 0, null),
  getAppNavigationScrollKey('intro', 0, null),
  'Choosing a participant role must scroll the following intro screen to the top',
);
assert.notEqual(
  getDashboardNavigationScrollKey('authorized', 'specialists'),
  getDashboardNavigationScrollKey('authorized', 'configuration'),
  'Changing dashboard screens must create a new scroll-reset key',
);
assert.equal(
  new Set((['specialists', 'students', 'algorithm', 'configuration'] as const).map((view) => (
    getDashboardNavigationScrollKey('authorized', view)
  ))).size,
  4,
  'Every sidebar destination, including the algorithm guide, must receive a distinct scroll-reset key',
);
assert.notEqual(
  getSpecialistPromptNavigationScrollKey(false),
  getSpecialistPromptNavigationScrollKey(true),
  'The specialist thank-you screen must create a new scroll-reset key',
);
const maximumTraits = calculateTraits(
  Object.fromEntries(ALL_QUESTION_IDS.map((id) => [id, 10])),
  [],
);
assert.ok(Object.values(maximumTraits).every((score) => score >= 0 && score <= 100));
assert.equal(maximumTraits.communication, 100);

// A selected value is evidence about importance, not permission to rewrite a
// level that the 81-item questionnaire measured. Value-only traits receive a
// strong, explicit level instead of the old paradoxical 50 + small bonus.
const traitsWithoutValues = calculateTraits(ratings, []);
const traitsWithCaring = calculateTraits(ratings, ['Caring for people']);
assert.equal(
  traitsWithCaring.care_motivation,
  traitsWithoutValues.care_motivation,
  'A career value must not inflate a trait already measured by the questionnaire',
);
const traitsWithManualValue = calculateTraits(ratings, ['Manual/hands-on activity']);
assert.equal(SELECTED_VALUE_ONLY_SCORE, 90);
assert.equal(
  traitsWithManualValue.manual_orientation,
  90,
  'Manual/hands-on activity must create strong value-only evidence',
);

const manualOnlyCatalog = [
  {
    name: 'Manual A',
    category: 'Surgical' as const,
    profile: { manual_orientation: [90, 3] as [number, number] },
    blurb: 'Regression fixture',
  },
  {
    name: 'Manual B',
    category: 'Surgical' as const,
    profile: { manual_orientation: [90, 3] as [number, number] },
    blurb: 'Regression fixture',
  },
] as const;
const manualOnlyRanking = rankSpecialties({
  ratings,
  selectedValues: ['Manual/hands-on activity'],
  preferredSpecialty: null,
}, undefined, [...manualOnlyCatalog].reverse());
const manualOnlyRankingWithoutValue = rankSpecialties({
  ratings,
  selectedValues: [],
  preferredSpecialty: null,
}, undefined, manualOnlyCatalog);
assert.equal(manualOnlyRanking[0].score, 100);
assert.ok(
  manualOnlyRanking[0].score > manualOnlyRankingWithoutValue[0].score,
  'Selecting manual work must not penalize a specialty whose manual target is 90',
);
assert.deepEqual(
  manualOnlyRanking.map(({ specialty }) => specialty.name),
  ['Manual A', 'Manual B'],
  'Exact score ties must be ordered deterministically by specialty name',
);
assert.equal(
  manualOnlyRanking[0].subScores.find(({ dimension }) => dimension === 'technical')?.score,
  100,
);
assert.equal(
  manualOnlyRanking[0].subScores.find(({ dimension }) => dimension === 'thinking')?.score,
  null,
  'A dimension without evidence must be unavailable rather than a false zero',
);

const measuredTraits = new Set([
  ...Object.values(QUESTION_TRAITS).flatMap((mappings) => mappings.map(({ trait }) => trait)),
  ...Object.values(VALUE_MAPPING).flatMap((mappings) => mappings.map(({ trait }) => trait)),
]);
const documentedUnmeasuredMetadataTraits = new Set(['prevention_orientation']);
for (const specialty of SPECIALTIES) {
  const metadata = SPECIALTY_METADATA[specialty.name];
  assert.ok(metadata, `Missing display metadata for ${specialty.name}`);
  for (const trait of metadata.keyTraits) {
    if (specialty.profile[trait]) continue;
    assert.equal(
      measuredTraits.has(trait),
      false,
      `${specialty.name} metadata references measured trait ${trait}, which is absent from its scoring profile`,
    );
    assert.ok(
      documentedUnmeasuredMetadataTraits.has(trait),
      `${specialty.name} has undocumented unmeasured metadata trait ${trait}`,
    );
  }
}

const narrativeNames = Object.keys(SPECIALTY_NARRATIVES);
assert.equal(narrativeNames.length, SPECIALTIES.length, 'Every specialty must have exactly one narrative');
assert.deepEqual(
  [...narrativeNames].sort(),
  SPECIALTIES.map(({ name }) => name).sort(),
  'Narrative keys must exactly match the scoring catalog',
);
for (const specialty of SPECIALTIES) {
  const narrative = SPECIALTY_NARRATIVES[specialty.name];
  assert.ok(narrative, `Missing multilingual narrative for ${specialty.name}`);
  for (const language of ['en', 'ro', 'fr'] as const) {
    assert.notEqual(
      narrative.overview[language],
      narrative.fitProfile[language],
      `${specialty.name}.${language} must keep overview and professional profile distinct`,
    );
    for (const [field, text, minimum, maximum] of [
      ['overview', narrative.overview[language], 20, 2000],
      ['fitProfile', narrative.fitProfile[language], 20, 5000],
    ] as const) {
      assert.equal(text, text.trim(), `${specialty.name}.${field}.${language} has outer whitespace`);
      assert.equal(text, text.normalize('NFC'), `${specialty.name}.${field}.${language} is not NFC`);
      assert.ok(text.length >= minimum && text.length <= maximum, `${specialty.name}.${field}.${language} length is invalid`);
      assert.doesNotMatch(text, /�|Ã|Â|ǎ|[şţŞŢ]/u, `${specialty.name}.${field}.${language} contains broken Unicode`);
    }
  }
  assert.equal(new Set(Object.values(narrative.overview)).size, 3, `${specialty.name} overview must be translated`);
  assert.equal(new Set(Object.values(narrative.fitProfile)).size, 3, `${specialty.name} fit profile must be translated`);
}

const specialist: SpecialistResponseRow = {
  id: '00000000-0000-4000-8000-000000000001',
  created_at: '2026-08-28T12:00:00.000Z',
  actual_specialty: SPECIALTIES[0].name,
  years_of_experience: null,
  career_satisfaction: null,
  would_choose_again: null,
  intention_to_change: null,
  voluntary_choice: null,
  would_choose_again_code: 'yes',
  intention_to_change_code: null,
  voluntary_choice_code: null,
  current_specialty_view: 'A demanding specialty with meaningful longitudinal patient care.',
  specialty_changes_over_years: 'Clinical decisions increasingly rely on multidisciplinary teamwork.',
  most_important_specialty_quality: 'Sound judgment under uncertainty.',
  would_not_choose_again_reason: null,
  student_self_question: 'Do I enjoy the daily work, including its difficult and repetitive parts?',
  questionnaire_completed: true,
  language: 'fr',
  ratings,
  selected_values: [VALUE_OPTIONS[0]],
  specialty_config_version_id: '50000000-0000-4000-8000-000000000001',
  specialty_config_revision: 1,
  submission_schema_version: DATA_VERSIONS.submissionSchema,
  questionnaire_version: DATA_VERSIONS.questionnaire,
  value_catalog_version: DATA_VERSIONS.valueCatalog,
  specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
  calibration_version: DATA_VERSIONS.calibration,
  consent_version: DATA_VERSIONS.consent,
};

const student: StudentResponseRow = {
  id: '00000000-0000-4000-8000-000000000002',
  created_at: specialist.created_at,
  participant_role: 'student',
  study_year: 6,
  preferred_specialty: SPECIALTIES[1].name,
  medicine_view: null,
  participant_reflection_version: null,
  language: 'en',
  ratings,
  selected_values: [VALUE_OPTIONS[0]],
  client_scores: SPECIALTIES.map(({ name }, index) => ({ specialty: name, score: 100 - index })),
  specialty_config_version_id: '50000000-0000-4000-8000-000000000001',
  specialty_config_revision: 1,
  submission_schema_version: DATA_VERSIONS.submissionSchema,
  questionnaire_version: DATA_VERSIONS.questionnaire,
  value_catalog_version: DATA_VERSIONS.valueCatalog,
  specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
  scoring_version: DATA_VERSIONS.scoring,
  consent_version: DATA_VERSIONS.consent,
};

const curiousParticipant: StudentResponseRow = {
  ...student,
  id: '00000000-0000-4000-8000-000000000003',
  participant_role: 'curious',
  study_year: null,
  preferred_specialty: null,
  medicine_view: 'Medicine combines scientific reasoning, service, and a lasting responsibility toward patients.',
  participant_reflection_version: DATA_VERSIONS.participantReflection,
  submission_schema_version: DATA_VERSIONS.studentSubmissionSchema,
  consent_version: DATA_VERSIONS.studentConsent,
};

const validAnalysis = analyzeSpecialistResponse(specialist);
assert.equal(validAnalysis.eligible, true);
assert.equal(validAnalysis.ranking.length, SPECIALTIES.length);
assert.ok(validAnalysis.ranking.every(({ rankMin, rankMax }) => rankMin <= rankMax));
assert.equal(analyzeStudentResponse(student).eligible, true);
assert.equal(
  analyzeStudentResponse(curiousParticipant).eligible,
  true,
  'The current reflection protocol must keep a valid curious participant quantitatively analyzable',
);
assert.deepEqual(
  analyzeStudentResponse(curiousParticipant).ranking,
  analyzeStudentResponse({ ...curiousParticipant, medicine_view: 'A completely different qualitative reflection.' }).ranking,
  'The medicine reflection must never alter traits, scores, or specialty ranks',
);
assert.deepEqual(
  analyzeStudentResponse({ ...curiousParticipant, participant_reflection_version: null }).exclusionReasons,
  ['analysis_version'],
  'Schema-3 rows without the declared reflection protocol must be flagged without invalidating schema-2 student history',
);
assert.match(DASHBOARD_MODEL_CHECKSUM, /^fnv1a64-[0-9a-f]{16}$/);
assert.equal(validAnalysis.modelChecksum, DASHBOARD_MODEL_CHECKSUM);
const changedCatalog = SPECIALTIES.map((specialty, index) => index === 0
  ? {
      ...specialty,
      profile: {
        ...specialty.profile,
        scientific_curiosity: [0, 3] as [number, number],
      },
    }
  : specialty);
const changedCatalogAnalysis = analyzeSpecialistResponse(specialist, changedCatalog);
assert.notEqual(changedCatalogAnalysis.modelChecksum, DASHBOARD_MODEL_CHECKSUM);
assert.equal(changedCatalogAnalysis.ranking.length, SPECIALTIES.length);
// Deliberate provenance lock: if mappings, profiles, versions or rank parameters
// change, bump the relevant revision/version and update this fixture together.
assert.deepEqual({
  analysisVersion: DASHBOARD_ANALYSIS_VERSION,
  engineRevision: SCORING_ENGINE_REVISION,
  modelChecksum: DASHBOARD_MODEL_CHECKSUM,
}, {
  analysisVersion: 'dashboard-canonical-default-v2',
  engineRevision: 'scoring-engine-v2',
  modelChecksum: 'fnv1a64-abdce4ee5b50c668',
});

assert.equal(isSpecialistCalibrationComplete(specialist), true);
assert.equal(
  isSpecialistCalibrationComplete({ ...specialist, current_specialty_view: null }),
  false,
);
assert.equal(
  isSpecialistCalibrationComplete({
    ...specialist,
    would_choose_again_code: 'no',
    would_not_choose_again_reason: null,
  }),
  false,
);
assert.equal(
  isSpecialistCalibrationComplete({
    ...specialist,
    would_choose_again_code: 'no',
    would_not_choose_again_reason: 'The working conditions no longer fit my priorities.',
  }),
  true,
);

const invalidCases: SpecialistResponseRow[] = [
  { ...specialist, ratings: Object.fromEntries(ALL_QUESTION_IDS.slice(1).map((id) => [id, 5])) },
  { ...specialist, ratings: { ...ratings, UNKNOWN: 5 } },
  { ...specialist, ratings: { ...ratings, [ALL_QUESTION_IDS[0]]: 11 } },
  { ...specialist, ratings: { ...ratings, [ALL_QUESTION_IDS[0]]: 1.5 } },
  { ...specialist, selected_values: [] },
  { ...specialist, selected_values: [VALUE_OPTIONS[0], VALUE_OPTIONS[0]] },
  { ...specialist, selected_values: ['unknown'] },
  { ...specialist, questionnaire_version: 'legacy-unknown' },
  { ...specialist, consent_version: 'legacy-unrecorded' },
  { ...specialist, actual_specialty: 'unknown' },
];
for (const row of invalidCases) {
  assert.equal(assessSpecialistEligibility(row).eligible, false);
  assert.equal(analyzeSpecialistResponse(row).ranking.length, 0);
}

const skippedSpecialist: SpecialistResponseRow = {
  ...specialist,
  id: '00000000-0000-4000-8000-000000000020',
  questionnaire_completed: false,
  ratings: {},
  selected_values: [],
};
const skippedAssessment = assessSpecialistEligibility(skippedSpecialist);
assert.equal(
  skippedAssessment.eligible,
  false,
  'A specialist who explicitly skips the questionnaire must not enter quantitative calibration',
);
assert.deepEqual(
  skippedAssessment.exclusionReasons,
  ['questionnaire_skipped'],
  'An explicit skip must have a dedicated exclusion reason rather than masquerading as corrupt ratings',
);
assert.equal(
  analyzeSpecialistResponse(skippedSpecialist).ranking.length,
  0,
  'A skipped questionnaire must never produce a synthetic specialty ranking',
);
assert.equal(
  isSpecialistCalibrationComplete(skippedSpecialist),
  true,
  'A complete qualitative interview remains complete when the optional quantitative questionnaire was skipped',
);
const skippedSummary = buildCalibrationSummary([specialist, skippedSpecialist], null);
assert.equal(skippedSummary.total, 2);
assert.equal(skippedSummary.eligibleCount, 1);
assert.equal(skippedSummary.excludedCount, 1);
assert.equal(
  skippedSummary.completeCount,
  2,
  'A skipped quantitative questionnaire must not discard a complete qualitative interview',
);
assert.equal(skippedSummary.chooseAgainCount, 2);
assert.equal(skippedSummary.chooseAgainRate, 100);
assert.deepEqual(
  skippedSummary.exclusionReasons,
  [{ reason: 'questionnaire_skipped', count: 1 }],
  'Skipped questionnaires must be reported separately from malformed quantitative payloads',
);

for (const inconsistentRow of [
  { ...specialist, questionnaire_completed: false },
  { ...specialist, questionnaire_completed: false, ratings, selected_values: [] },
  { ...specialist, questionnaire_completed: false, ratings: {}, selected_values: [VALUE_OPTIONS[0]] },
  { ...specialist, questionnaire_completed: true, ratings: {}, selected_values: [] },
  {
    ...specialist,
    questionnaire_completed: true,
    ratings: Object.fromEntries(ALL_QUESTION_IDS.slice(1).map((id) => [id, 5])),
  },
] satisfies SpecialistResponseRow[]) {
  assert.equal(
    assessSpecialistEligibility(inconsistentRow).eligible,
    false,
    'Partial or status-inconsistent specialist questionnaire data must remain quantitatively ineligible',
  );
  assert.equal(analyzeSpecialistResponse(inconsistentRow).ranking.length, 0);
}

const otherSpecialty = { ...specialist, actual_specialty: SPECIALTIES[1].name };
assert.deepEqual(
  analyzeSpecialistResponse(specialist).ranking,
  analyzeSpecialistResponse(otherSpecialty).ranking,
  'The declared specialty must not leak into the canonical ranking',
);

const tieInput = [
  { name: 'E', score: 70 },
  { name: 'C', score: 80 },
  { name: 'A', score: 90 },
  { name: 'D', score: 80 },
  { name: 'B', score: 80 },
];
const ties = assignTieAwareRanks(tieInput);
assert.deepEqual(ties.map(({ name, rankMin, rankMax, tieCount }) => [name, rankMin, rankMax, tieCount]), [
  ['A', 1, 1, 1], ['B', 2, 4, 3], ['C', 2, 4, 3], ['D', 2, 4, 3], ['E', 5, 5, 1],
]);
assert.deepEqual(assignTieAwareRanks([...tieInput].reverse()), ties);
assert.deepEqual(
  assignTieAwareRanks([{ name: 'A', score: 90 }, { name: 'B', score: 90 - 5e-10 }])
    .map(({ rankMin, rankMax }) => [rankMin, rankMax]),
  [[1, 2], [1, 2]],
);

const legacy: SpecialistResponseRow = {
  ...specialist,
  id: '00000000-0000-4000-8000-000000000003',
  years_of_experience: -1,
  would_choose_again: '=2+2',
  intention_to_change: '+SUM(1,1)',
  voluntary_choice: '@legacy',
  current_specialty_view: null,
  specialty_changes_over_years: null,
  most_important_specialty_quality: null,
  would_not_choose_again_reason: null,
  student_self_question: null,
  submission_schema_version: 0,
  questionnaire_version: 'legacy-unknown',
  value_catalog_version: 'legacy-unknown',
  specialty_catalog_version: 'legacy-unknown',
  calibration_version: 'legacy-localized-labels',
  consent_version: 'legacy-unrecorded',
};
const summary = buildCalibrationSummary([specialist, legacy], null);
assert.equal(summary.total, 2);
assert.equal(summary.eligibleCount, 1);
assert.equal(summary.excludedCount, 1);
assert.equal(summary.questionAggregates[0].count, 1);
assert.equal(summary.questionAggregates[0].mean, ratings[ALL_QUESTION_IDS[0]]);
assert.equal(buildCalibrationSummary([legacy], null).questionAggregates[0].mean, null);
assert.ok((summary.top1ConservativeRate ?? 0) <= (summary.top1Rate ?? 0));
assert.ok((summary.top3ConservativeRate ?? 0) <= (summary.top3Rate ?? 0));
assert.ok((summary.top5ConservativeRate ?? 0) <= (summary.top5Rate ?? 0));

const denominatorRows = [
  { ...specialist, id: '00000000-0000-4000-8000-000000000010', would_choose_again_code: 'yes' },
  {
    ...specialist,
    id: '00000000-0000-4000-8000-000000000011',
    would_choose_again_code: 'no',
    would_not_choose_again_reason: 'The current workload is no longer sustainable for me.',
  },
  {
    ...specialist,
    id: '00000000-0000-4000-8000-000000000012',
    would_choose_again_code: null,
    current_specialty_view: null,
  },
];
const denominatorSummary = buildCalibrationSummary(denominatorRows, specialist.actual_specialty);
assert.equal(denominatorSummary.chooseAgainCount, 2);
assert.equal(denominatorSummary.chooseAgainRate, 50);
assert.equal(denominatorSummary.completeCount, 2);

const manualTrait = denominatorSummary.traitAggregates.find(({ trait }) => trait === 'manual_orientation');
const preventionTrait = denominatorSummary.traitAggregates.find(({ trait }) => trait === 'prevention_orientation');
assert.equal(manualTrait?.source, 'value_only');
assert.equal(manualTrait?.baseCount, 0);
assert.equal(preventionTrait?.source, 'unmeasured');
assert.equal(preventionTrait?.adjustedMean, null);
assert.equal(preventionTrait?.gap, null);

for (const csv of [
  specialistRawCsv([specialist]), specialistAnalyticCsv([specialist]), specialistLongCsv([specialist]),
  studentRawCsv([student, curiousParticipant]), studentAnalyticCsv([student, curiousParticipant]), studentLongCsv([student, curiousParticipant]),
]) {
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const parsed = parseCsv(csv);
  assert.equal(new Set(parsed[0]).size, parsed[0].length, 'CSV headers must be unique');
  assert.ok(parsed.every((row) => row.length === parsed[0].length), 'CSV rows must have equal widths');
}
assert.equal(parseCsv(specialistLongCsv([specialist])).length, 82);
assert.equal(
  parseCsv(specialistLongCsv([skippedSpecialist])).length,
  1,
  'A skipped questionnaire must not be expanded into 81 misleading blank long-format rows',
);
assert.equal(parseCsv(studentLongCsv([student])).length, 82);
assert.equal(parseCsv(studentLongCsv([curiousParticipant])).length, 82);

const participantRaw = parseCsv(studentRawCsv([student, curiousParticipant]));
const participantRawHeaders = participantRaw[0];
assert.equal(participantRawHeaders.includes('participant_role'), true);
assert.equal(participantRawHeaders.includes('medicine_view'), true);
assert.equal(participantRawHeaders.includes('participant_reflection_version'), true);
assert.deepEqual(
  participantRaw.slice(1).map((row) => row[participantRawHeaders.indexOf('participant_role')]),
  ['student', 'curious'],
  'Student and medicine-explorer rows must remain explicitly separable in exports',
);
assert.equal(
  participantRaw[2][participantRawHeaders.indexOf('medicine_view')],
  curiousParticipant.medicine_view,
  'The qualitative medicine reflection must be exported without lossy rewriting',
);
const multilineMedicineView = 'Medicine is a scientific vocation.\nIt also requires humility and sustained service.';
const participantFormulaRaw = parseCsv(studentRawCsv([{
  ...curiousParticipant,
  medicine_view: '=HYPERLINK("https://example.invalid")',
}, {
  ...curiousParticipant,
  id: '00000000-0000-4000-8000-000000000004',
  medicine_view: multilineMedicineView,
} ]));
assert.equal(
  participantFormulaRaw[1][participantRawHeaders.indexOf('medicine_view')],
  "'=HYPERLINK(\"https://example.invalid\")",
  'Medicine reflections must be neutralized against spreadsheet formula execution',
);
assert.equal(
  participantFormulaRaw[2][participantRawHeaders.indexOf('medicine_view')],
  multilineMedicineView,
  'Multiline qualitative reflections must survive CSV quoting exactly',
);
for (const csv of [studentAnalyticCsv([curiousParticipant]), studentLongCsv([curiousParticipant])]) {
  const parsed = parseCsv(csv);
  const roleIndex = parsed[0].indexOf('participant_role');
  const reflectionIndex = parsed[0].indexOf('medicine_view');
  assert.ok(roleIndex >= 0 && reflectionIndex >= 0, 'Every student/curious CSV shape must retain role and reflection metadata');
  assert.ok(parsed.slice(1).every((row) => row[roleIndex] === 'curious'));
  assert.ok(parsed.slice(1).every((row) => row[reflectionIndex] === curiousParticipant.medicine_view));
}
for (const response of [student, curiousParticipant]) {
  const parsed = parseCsv(studentAnalyticCsv([response]));
  assert.equal(
    parsed[1][parsed[0].indexOf('analysis_eligible')],
    'true',
    `Student schema ${response.submission_schema_version} must remain quantitatively analyzable`,
  );
}

const rawLegacy = parseCsv(specialistRawCsv([legacy]));
const rawHeaders = rawLegacy[0];
const rawValues = rawLegacy[1];
assert.equal(rawValues[rawHeaders.indexOf('would_choose_again')], "'=2+2");
assert.equal(rawValues[rawHeaders.indexOf('intention_to_change')], "'+SUM(1,1)");
assert.equal(rawValues[rawHeaders.indexOf('voluntary_choice')], "'@legacy");
assert.equal(rawValues[rawHeaders.indexOf('years_of_experience')], '-1');
assert.equal(rawHeaders.includes('specialty_config_version_id'), true);
assert.equal(rawHeaders.includes('specialty_config_revision'), true);
assert.equal(rawHeaders.includes('questionnaire_completed'), true);
for (const column of [
  'current_specialty_view',
  'specialty_changes_over_years',
  'most_important_specialty_quality',
  'would_not_choose_again_reason',
  'student_self_question',
]) {
  assert.equal(rawHeaders.includes(column), true, `Specialist export is missing ${column}`);
}

const qualitativeFormula = parseCsv(specialistRawCsv([{
  ...specialist,
  current_specialty_view: '=HYPERLINK("https://example.invalid")',
  specialty_changes_over_years: '+SUM(1,1)',
  most_important_specialty_quality: '-1+1',
  student_self_question: '@unsafe',
}]))[1];
assert.equal(qualitativeFormula[rawHeaders.indexOf('current_specialty_view')], "'=HYPERLINK(\"https://example.invalid\")");
assert.equal(qualitativeFormula[rawHeaders.indexOf('specialty_changes_over_years')], "'+SUM(1,1)");
assert.equal(qualitativeFormula[rawHeaders.indexOf('most_important_specialty_quality')], "'-1+1");
assert.equal(qualitativeFormula[rawHeaders.indexOf('student_self_question')], "'@unsafe");

const analyticLegacy = parseCsv(specialistAnalyticCsv([legacy]));
const analyticHeaders = analyticLegacy[0];
const analyticValues = analyticLegacy[1];
assert.equal(analyticValues[analyticHeaders.indexOf('analysis_eligible')], 'false');
assert.equal(analyticValues[analyticHeaders.indexOf('actual_rank_min')], '');
assert.ok(analyticValues[analyticHeaders.indexOf('dashboard_analysis_version')]);
assert.ok(analyticValues[analyticHeaders.indexOf('scoring_engine_revision')]);
assert.equal(analyticValues[analyticHeaders.indexOf('model_configuration_checksum')], DASHBOARD_MODEL_CHECKSUM);
assert.ok(analyticValues[analyticHeaders.indexOf('analysis_generated_at')]);

const analyticSkipped = parseCsv(specialistAnalyticCsv([skippedSpecialist]));
const analyticSkippedHeaders = analyticSkipped[0];
const analyticSkippedValues = analyticSkipped[1];
assert.equal(analyticSkippedValues[analyticSkippedHeaders.indexOf('questionnaire_completed')], 'false');
assert.equal(analyticSkippedValues[analyticSkippedHeaders.indexOf('analysis_eligible')], 'false');
assert.equal(
  analyticSkippedValues[analyticSkippedHeaders.indexOf('analysis_exclusion_reasons')],
  'questionnaire_skipped',
);
assert.equal(analyticSkippedValues[analyticSkippedHeaders.indexOf('actual_rank_min')], '');

console.log(JSON.stringify({
  eligibility: true,
  valueOnlyManualEvidence: true,
  measuredTraitNotInflatedByValues: true,
  unavailableDimensionsAreNull: true,
  specialtyMetadataMatchesProfiles: true,
  multilingualSpecialtyNarratives: true,
  navigationScrollPolicy: true,
  dashboardSidebarNavigation: true,
  dashboardPreviousViewHistory: true,
  algorithmExplanation: true,
  participantRoleSelection: true,
  curiousParticipantFlow: true,
  participantMedicineReflections: true,
  optionalSpecialistQuestionnaire: true,
  studentStudyYearsOneToSix: true,
  mobileRatingScale: true,
  noTargetLeakage: true,
  tieAwareRanks: true,
  explicitDenominators: true,
  structuralCoverageFlagged: true,
  runtimeCatalogAffectsProvenance: true,
  csvSafetyAndShape: true,
  modelProvenance: DASHBOARD_MODEL_CHECKSUM,
  currentLongRowsPerResponse: 81,
}));
