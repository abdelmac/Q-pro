import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translateSpecialtyName } from '@/data/i18n';
import { useLanguage } from '@/lib/LanguageContext';
import { getDashboardNavigationScrollKey, useScrollToPageTop } from '@/lib/scrollToTop';
import { DATA_VERSIONS, formatSupabaseError, getSupabaseConfigurationError, supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import {
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
} from '@/lib/researchDashboard';
import AlgorithmExplanation from '@/components/AlgorithmExplanation';
import CalibrationAnalysis from '@/components/CalibrationAnalysis';
import DashboardSidebar from '@/components/DashboardSidebar';
import {
  isCohortView,
  participantRoleLabel,
  participantRoleSupportsStudyYear,
  popDashboardViewHistory,
  pushDashboardViewHistory,
  type CohortView,
  type DashboardView,
} from '@/lib/dashboardNavigation';
import ResearchResponseDetail, { type DetailedResponse } from '@/components/ResearchResponseDetail';
import SpecialtyConfigurationEditor from '@/components/SpecialtyConfigurationEditor';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { STUDENT_STUDY_YEARS } from '@/lib/participantProfile';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  FilterX,
  GraduationCap,
  Loader2,
  LogIn,
  Menu,
  Microscope,
  RefreshCw,
  Stethoscope,
  Users,
} from 'lucide-react';

const PAGE_SIZE = 50;
const EXPORT_BATCH_SIZE = 250;
const IDLE_SIGN_OUT_MS = 30 * 60 * 1000;

type StudentListRow = Pick<
  Database['public']['Tables']['student_responses']['Row'],
  | 'id'
  | 'participant_role'
  | 'study_year'
  | 'preferred_specialty'
  | 'medicine_view'
  | 'language'
  | 'created_at'
>;
type SpecialistListRow = Pick<
  Database['public']['Tables']['specialist_responses']['Row'],
  | 'id'
  | 'actual_specialty'
  | 'questionnaire_completed'
  | 'submission_schema_version'
  | 'current_specialty_view'
  | 'specialty_changes_over_years'
  | 'most_important_specialty_quality'
  | 'would_not_choose_again_reason'
  | 'student_self_question'
  | 'years_of_experience'
  | 'career_satisfaction'
  | 'would_choose_again_code'
  | 'intention_to_change_code'
  | 'voluntary_choice_code'
  | 'language'
  | 'created_at'
>;
type AccessState = 'checking' | 'signed_out' | 'checking_access' | 'authorized';
type CompletenessFilter = 'all' | 'complete' | 'partial';
type QuestionnaireFilter = 'all' | 'completed' | 'skipped';
type ParticipantRoleFilter = 'all' | 'student' | 'curious';
type DataVersionFilter = 'current' | 'all' | 'legacy';
type ExportKind = 'raw' | 'long' | 'analytic' | 'json';

interface DashboardCounts {
  students: number;
  curious: number;
  specialists: number;
  studentsWithYear: number;
  specialistsComplete: number;
}

interface PortalProfile {
  display_name: string | null;
  portal_role: 'researcher' | 'doctor' | 'professor';
  can_edit: boolean;
  can_publish: boolean;
}

const EMPTY_COUNTS: DashboardCounts = {
  students: 0,
  curious: 0,
  specialists: 0,
  studentsWithYear: 0,
  specialistsComplete: 0,
};

function parsePortalProfile(value: unknown): PortalProfile | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.authorized !== true && record.is_researcher !== true) return null;
  const role = record.portal_role ?? record.role;
  if (role !== 'researcher' && role !== 'doctor' && role !== 'professor') return null;
  return {
    display_name: typeof record.display_name === 'string' ? record.display_name : null,
    portal_role: role,
    can_edit: record.can_edit === true || record.can_edit_catalog === true,
    can_publish: record.can_publish === true || record.can_publish_catalog === true,
  };
}

const CHOICE_LABELS: Record<string, Record<string, string>> = {
  fr: {
    yes: 'Oui', no: 'Non', unsure: 'Incertain',
    definitely: 'Certainement', probably: 'Probablement',
    probably_not: 'Probablement pas', definitely_not: 'Certainement pas',
    fully_voluntary: 'Entièrement volontaire', somewhat_voluntary: 'Partiellement volontaire',
    not_voluntary: 'Non volontaire',
  },
  en: {
    yes: 'Yes', no: 'No', unsure: 'Unsure',
    definitely: 'Definitely', probably: 'Probably',
    probably_not: 'Probably not', definitely_not: 'Definitely not',
    fully_voluntary: 'Fully voluntary', somewhat_voluntary: 'Somewhat voluntary',
    not_voluntary: 'Not voluntary',
  },
};

function choiceLabel(value: string | null, french: boolean): string {
  if (value === null) return '—';
  return CHOICE_LABELS[french ? 'fr' : 'en'][value] ?? value;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyDateFilters<T extends {
  gte: (column: 'created_at', value: string) => T;
  lt: (column: 'created_at', value: string) => T;
}>(query: T, dateFrom: string, dateTo: string): T {
  let filtered = query;
  const localBoundary = (date: string, nextDay: boolean) => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day + (nextDay ? 1 : 0)).toISOString();
  };
  if (dateFrom) filtered = filtered.gte('created_at', localBoundary(dateFrom, false));
  if (dateTo) filtered = filtered.lt('created_at', localBoundary(dateTo, true));
  return filtered;
}

export default function Dashboard({ onBack }: { onBack: () => void }) {
  const { lang } = useLanguage();
  const { specialties, version: catalogVersion, refresh: refreshCatalog } = useSpecialtyCatalog();
  const french = lang === 'fr';
  const romanian = lang === 'ro';
  const locale = french ? 'fr-FR' : romanian ? 'ro-RO' : 'en-GB';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [portalProfile, setPortalProfile] = useState<PortalProfile | null>(null);
  const [students, setStudents] = useState<StudentListRow[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistListRow[]>([]);
  const [view, setView] = useState<DashboardView>('specialists');
  const [viewHistory, setViewHistory] = useState<DashboardView[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState('all');
  const [participantRoleFilter, setParticipantRoleFilter] = useState<ParticipantRoleFilter>('all');
  const [studentSpecialtyFilter, setStudentSpecialtyFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [questionnaireFilter, setQuestionnaireFilter] = useState<QuestionnaireFilter>('all');
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('all');
  const [chooseAgainFilter, setChooseAgainFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [dataVersionFilter, setDataVersionFilter] = useState<DataVersionFilter>('current');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  useScrollToPageTop(getDashboardNavigationScrollKey(accessState, view));
  const [activeTotal, setActiveTotal] = useState(0);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailedResponse, setDetailedResponse] = useState<DetailedResponse | null>(null);
  const [analysisRows, setAnalysisRows] = useState<SpecialistResponseRow[] | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRequest = useRef(0);
  const detailRequest = useRef(0);
  const analysisRequest = useRef(0);
  const exportRequest = useRef(0);
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarDialogRef = useRef<HTMLDivElement>(null);

  const resetPageAndAnalysis = () => {
    loadRequest.current += 1;
    detailRequest.current += 1;
    analysisRequest.current += 1;
    exportRequest.current += 1;
    setPage(0);
    setDetailedResponse(null);
    setAnalysisRows(null);
    setLoading(false);
    setAnalysisLoading(false);
    setExporting(null);
    setDetailLoadingId(null);
  };

  const loadData = useCallback(async () => {
    if (!isCohortView(view)) {
      setLoading(false);
      return;
    }
    if (!supabase) {
      setError(getSupabaseConfigurationError() ?? 'Supabase is not configured.');
      return;
    }
    const requestId = ++loadRequest.current;
    setLoading(true);
    setError(null);
    if (view === 'specialists') setSpecialists([]);
    else if (view === 'students') setStudents([]);
    const rangeStart = page * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;

    const globalCounts = Promise.all([
      supabase.from('student_responses').select('id', { count: 'exact', head: true }).eq('participant_role', 'student'),
      supabase.from('specialist_responses').select('id', { count: 'exact', head: true }),
      supabase.from('student_responses').select('id', { count: 'exact', head: true }).eq('participant_role', 'student').not('study_year', 'is', null),
      supabase.from('specialist_responses').select('id', { count: 'exact', head: true })
        .eq('submission_schema_version', DATA_VERSIONS.submissionSchema)
        .not('current_specialty_view', 'is', null)
        .not('specialty_changes_over_years', 'is', null)
        .not('most_important_specialty_quality', 'is', null)
        .not('would_choose_again_code', 'is', null)
        .not('student_self_question', 'is', null)
        .or('would_choose_again_code.eq.yes,and(would_choose_again_code.eq.no,would_not_choose_again_reason.not.is.null)'),
      supabase.from('student_responses').select('id', { count: 'exact', head: true }).eq('participant_role', 'curious'),
    ]);

    try {
      if (view === 'specialists') {
        let query = supabase
          .from('specialist_responses')
          .select('id, actual_specialty, questionnaire_completed, submission_schema_version, current_specialty_view, specialty_changes_over_years, most_important_specialty_quality, would_choose_again_code, would_not_choose_again_reason, student_self_question, years_of_experience, career_satisfaction, intention_to_change_code, voluntary_choice_code, language, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);
        if (specialtyFilter !== 'all') query = query.eq('actual_specialty', specialtyFilter);
        if (questionnaireFilter !== 'all') query = query.eq('questionnaire_completed', questionnaireFilter === 'completed');
        if (chooseAgainFilter !== 'all') query = query.eq('would_choose_again_code', chooseAgainFilter);
        if (languageFilter !== 'all') query = query.eq('language', languageFilter);
        if (dataVersionFilter === 'current') {
          query = query
            .eq('submission_schema_version', DATA_VERSIONS.submissionSchema)
            .eq('questionnaire_version', DATA_VERSIONS.questionnaire)
            .eq('value_catalog_version', DATA_VERSIONS.valueCatalog)
            .eq('specialty_catalog_version', DATA_VERSIONS.specialtyCatalog)
            .eq('calibration_version', DATA_VERSIONS.calibration)
            .eq('consent_version', DATA_VERSIONS.consent);
        } else if (dataVersionFilter === 'legacy') {
          query = query.lt('submission_schema_version', DATA_VERSIONS.submissionSchema);
        }
        if (completenessFilter === 'complete') {
          if (dataVersionFilter === 'legacy') {
            query = query
              .not('years_of_experience', 'is', null)
              .not('career_satisfaction', 'is', null)
              .not('would_choose_again_code', 'is', null)
              .not('intention_to_change_code', 'is', null)
              .not('voluntary_choice_code', 'is', null);
          } else if (dataVersionFilter === 'current') {
            query = query
              .not('current_specialty_view', 'is', null)
              .not('specialty_changes_over_years', 'is', null)
              .not('most_important_specialty_quality', 'is', null)
              .not('would_choose_again_code', 'is', null)
              .not('student_self_question', 'is', null)
              .or('would_choose_again_code.eq.yes,and(would_choose_again_code.eq.no,would_not_choose_again_reason.not.is.null)');
          } else {
            query = query.or(`and(submission_schema_version.lt.${DATA_VERSIONS.submissionSchema},years_of_experience.not.is.null,career_satisfaction.not.is.null,would_choose_again_code.not.is.null,intention_to_change_code.not.is.null,voluntary_choice_code.not.is.null),and(submission_schema_version.gte.${DATA_VERSIONS.submissionSchema},current_specialty_view.not.is.null,specialty_changes_over_years.not.is.null,most_important_specialty_quality.not.is.null,would_choose_again_code.not.is.null,student_self_question.not.is.null,or(would_choose_again_code.eq.yes,and(would_choose_again_code.eq.no,would_not_choose_again_reason.not.is.null)))`);
          }
        } else if (completenessFilter === 'partial') {
          if (dataVersionFilter === 'legacy') {
            query = query.or('years_of_experience.is.null,career_satisfaction.is.null,would_choose_again_code.is.null,intention_to_change_code.is.null,voluntary_choice_code.is.null');
          } else if (dataVersionFilter === 'current') {
            query = query.or('current_specialty_view.is.null,specialty_changes_over_years.is.null,most_important_specialty_quality.is.null,would_choose_again_code.is.null,student_self_question.is.null,and(would_choose_again_code.eq.no,would_not_choose_again_reason.is.null)');
          } else {
            query = query.or(`and(submission_schema_version.lt.${DATA_VERSIONS.submissionSchema},or(years_of_experience.is.null,career_satisfaction.is.null,would_choose_again_code.is.null,intention_to_change_code.is.null,voluntary_choice_code.is.null)),and(submission_schema_version.gte.${DATA_VERSIONS.submissionSchema},or(current_specialty_view.is.null,specialty_changes_over_years.is.null,most_important_specialty_quality.is.null,would_choose_again_code.is.null,student_self_question.is.null,and(would_choose_again_code.eq.no,would_not_choose_again_reason.is.null)))`);
          }
        }
        query = applyDateFilters(query, dateFrom, dateTo);

        const [rowResult, countResults] = await Promise.all([query, globalCounts]);
        const queryError = rowResult.error ?? countResults.find(({ error: countError }) => countError)?.error;
        if (requestId !== loadRequest.current) return;
        if (queryError) {
          setError(formatSupabaseError(queryError, lang));
          return;
        }
        setSpecialists(rowResult.data ?? []);
        setActiveTotal(rowResult.count ?? 0);
        setCounts({
          students: countResults[0].count ?? 0,
          specialists: countResults[1].count ?? 0,
          studentsWithYear: countResults[2].count ?? 0,
          specialistsComplete: countResults[3].count ?? 0,
          curious: countResults[4].count ?? 0,
        });
      } else {
        let query = supabase
          .from('student_responses')
          .select('id, participant_role, study_year, preferred_specialty, medicine_view, language, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);
        if (participantRoleFilter !== 'all') query = query.eq('participant_role', participantRoleFilter);
        if (yearFilter !== 'all') query = query.eq('study_year', Number(yearFilter));
        if (studentSpecialtyFilter !== 'all') query = query.eq('preferred_specialty', studentSpecialtyFilter);
        if (languageFilter !== 'all') query = query.eq('language', languageFilter);
        if (dataVersionFilter === 'current') {
          query = query
            .eq('submission_schema_version', DATA_VERSIONS.studentSubmissionSchema)
            .eq('questionnaire_version', DATA_VERSIONS.questionnaire)
            .eq('value_catalog_version', DATA_VERSIONS.valueCatalog)
            .eq('specialty_catalog_version', DATA_VERSIONS.specialtyCatalog)
            .eq('scoring_version', DATA_VERSIONS.scoring)
            .eq('consent_version', DATA_VERSIONS.studentConsent)
            .eq('participant_reflection_version', DATA_VERSIONS.participantReflection);
        } else if (dataVersionFilter === 'legacy') {
          query = query.lt('submission_schema_version', DATA_VERSIONS.studentSubmissionSchema);
        }
        query = applyDateFilters(query, dateFrom, dateTo);

        const [rowResult, countResults] = await Promise.all([query, globalCounts]);
        const queryError = rowResult.error ?? countResults.find(({ error: countError }) => countError)?.error;
        if (requestId !== loadRequest.current) return;
        if (queryError) {
          setError(formatSupabaseError(queryError, lang));
          return;
        }
        setStudents(rowResult.data ?? []);
        setActiveTotal(rowResult.count ?? 0);
        setCounts({
          students: countResults[0].count ?? 0,
          specialists: countResults[1].count ?? 0,
          studentsWithYear: countResults[2].count ?? 0,
          specialistsComplete: countResults[3].count ?? 0,
          curious: countResults[4].count ?? 0,
        });
      }
    } catch (loadError) {
      if (requestId === loadRequest.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load data.');
      }
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }, [
    page,
    view,
    specialtyFilter,
    questionnaireFilter,
    chooseAgainFilter,
    completenessFilter,
    yearFilter,
    participantRoleFilter,
    studentSpecialtyFilter,
    languageFilter,
    dataVersionFilter,
    dateFrom,
    dateTo,
    lang,
  ]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setError(getSupabaseConfigurationError());
      setAccessState('signed_out');
      return;
    }

    let active = true;
    let authTimer: number | undefined;
    const verifySession = async (hasSession: boolean) => {
      if (!active) return;
      if (!hasSession) {
        loadRequest.current += 1;
        detailRequest.current += 1;
        analysisRequest.current += 1;
        exportRequest.current += 1;
        setPassword('');
        setStudents([]);
        setSpecialists([]);
        setDetailedResponse(null);
        setAnalysisRows(null);
        setExporting(null);
        setActiveTotal(0);
        setCounts(EMPTY_COUNTS);
        setPage(0);
        setView('specialists');
        setViewHistory([]);
        setSidebarOpen(false);
        setPortalProfile(null);
        setAccessState('signed_out');
        return;
      }

      setAccessState('checking_access');
      const { data: profileData, error: accessError } = await client.rpc('current_user_portal_profile');
      const profile = parsePortalProfile(profileData);
      if (!active) return;
      if (accessError || !profile) {
        setError(accessError
          ? formatSupabaseError(accessError, lang)
          : 'This account is not authorized to access research data.');
        await client.auth.signOut();
        setAccessState('signed_out');
        return;
      }
      setPortalProfile(profile);
      setAccessState('authorized');
    };

    void client.auth.getSession().then(({ data }) => verifySession(Boolean(data.session)));
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return;
      if (authTimer !== undefined) window.clearTimeout(authTimer);
      authTimer = window.setTimeout(() => void verifySession(Boolean(session)), 0);
    });

    return () => {
      active = false;
      loadRequest.current += 1;
      detailRequest.current += 1;
      analysisRequest.current += 1;
      exportRequest.current += 1;
      if (authTimer !== undefined) window.clearTimeout(authTimer);
      authListener.subscription.unsubscribe();
    };
  }, [lang]);

  useEffect(() => {
    if (accessState === 'authorized' && isCohortView(view)) void loadData();
  }, [accessState, loadData, view]);

  const closeMobileSidebar = useCallback(() => {
    setSidebarOpen(false);
    window.setTimeout(() => sidebarTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileSidebar();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        mobileSidebarDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
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
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [closeMobileSidebar, sidebarOpen]);

  useEffect(() => {
    const client = supabase;
    if (accessState !== 'authorized' || !client) return;

    let idleTimer = window.setTimeout(
      () => void client.auth.signOut({ scope: 'local' }),
      IDLE_SIGN_OUT_MS,
    );
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(
        () => void client.auth.signOut({ scope: 'local' }),
        IDLE_SIGN_OUT_MS,
      );
    };

    window.addEventListener('pointerdown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
    };
  }, [accessState]);

  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));
  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  const fetchAllSpecialists = useCallback(async (): Promise<SpecialistResponseRow[]> => {
    if (!supabase) throw new Error(getSupabaseConfigurationError() ?? 'Supabase is not configured.');
    const allRows: SpecialistResponseRow[] = [];
    let cursor: { createdAt: string; id: string } | null = null;
    for (;;) {
      let query = supabase
        .from('specialist_responses')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(EXPORT_BATCH_SIZE);
      if (cursor) {
        query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
      }
      if (specialtyFilter !== 'all') query = query.eq('actual_specialty', specialtyFilter);
      if (questionnaireFilter !== 'all') query = query.eq('questionnaire_completed', questionnaireFilter === 'completed');
      if (chooseAgainFilter !== 'all') query = query.eq('would_choose_again_code', chooseAgainFilter);
      if (languageFilter !== 'all') query = query.eq('language', languageFilter);
      if (dataVersionFilter === 'current') {
        query = query
          .eq('submission_schema_version', DATA_VERSIONS.submissionSchema)
          .eq('questionnaire_version', DATA_VERSIONS.questionnaire)
          .eq('value_catalog_version', DATA_VERSIONS.valueCatalog)
          .eq('specialty_catalog_version', DATA_VERSIONS.specialtyCatalog)
          .eq('calibration_version', DATA_VERSIONS.calibration)
          .eq('consent_version', DATA_VERSIONS.consent);
      } else if (dataVersionFilter === 'legacy') {
        query = query.lt('submission_schema_version', DATA_VERSIONS.submissionSchema);
      }
      if (completenessFilter === 'complete') {
        if (dataVersionFilter === 'legacy') {
          query = query
            .not('years_of_experience', 'is', null)
            .not('career_satisfaction', 'is', null)
            .not('would_choose_again_code', 'is', null)
            .not('intention_to_change_code', 'is', null)
            .not('voluntary_choice_code', 'is', null);
        } else if (dataVersionFilter === 'current') {
          query = query
            .not('current_specialty_view', 'is', null)
            .not('specialty_changes_over_years', 'is', null)
            .not('most_important_specialty_quality', 'is', null)
            .not('would_choose_again_code', 'is', null)
            .not('student_self_question', 'is', null)
            .or('would_choose_again_code.eq.yes,and(would_choose_again_code.eq.no,would_not_choose_again_reason.not.is.null)');
        } else {
          query = query.or(`and(submission_schema_version.lt.${DATA_VERSIONS.submissionSchema},years_of_experience.not.is.null,career_satisfaction.not.is.null,would_choose_again_code.not.is.null,intention_to_change_code.not.is.null,voluntary_choice_code.not.is.null),and(submission_schema_version.gte.${DATA_VERSIONS.submissionSchema},current_specialty_view.not.is.null,specialty_changes_over_years.not.is.null,most_important_specialty_quality.not.is.null,would_choose_again_code.not.is.null,student_self_question.not.is.null,or(would_choose_again_code.eq.yes,and(would_choose_again_code.eq.no,would_not_choose_again_reason.not.is.null)))`);
        }
      } else if (completenessFilter === 'partial') {
        if (dataVersionFilter === 'legacy') {
          query = query.or('years_of_experience.is.null,career_satisfaction.is.null,would_choose_again_code.is.null,intention_to_change_code.is.null,voluntary_choice_code.is.null');
        } else if (dataVersionFilter === 'current') {
          query = query.or('current_specialty_view.is.null,specialty_changes_over_years.is.null,most_important_specialty_quality.is.null,would_choose_again_code.is.null,student_self_question.is.null,and(would_choose_again_code.eq.no,would_not_choose_again_reason.is.null)');
        } else {
          query = query.or(`and(submission_schema_version.lt.${DATA_VERSIONS.submissionSchema},or(years_of_experience.is.null,career_satisfaction.is.null,would_choose_again_code.is.null,intention_to_change_code.is.null,voluntary_choice_code.is.null)),and(submission_schema_version.gte.${DATA_VERSIONS.submissionSchema},or(current_specialty_view.is.null,specialty_changes_over_years.is.null,most_important_specialty_quality.is.null,would_choose_again_code.is.null,student_self_question.is.null,and(would_choose_again_code.eq.no,would_not_choose_again_reason.is.null)))`);
        }
      }
      query = applyDateFilters(query, dateFrom, dateTo);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      const batch = data ?? [];
      allRows.push(...batch);
      if (batch.length < EXPORT_BATCH_SIZE) break;
      const last = batch[batch.length - 1];
      cursor = { createdAt: last.created_at, id: last.id };
    }
    return allRows;
  }, [
    specialtyFilter,
    questionnaireFilter,
    chooseAgainFilter,
    completenessFilter,
    languageFilter,
    dataVersionFilter,
    dateFrom,
    dateTo,
  ]);

  const fetchAllStudents = useCallback(async (): Promise<StudentResponseRow[]> => {
    if (!supabase) throw new Error(getSupabaseConfigurationError() ?? 'Supabase is not configured.');
    const allRows: StudentResponseRow[] = [];
    let cursor: { createdAt: string; id: string } | null = null;
    for (;;) {
      let query = supabase
        .from('student_responses')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(EXPORT_BATCH_SIZE);
      if (cursor) {
        query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
      }
      if (participantRoleFilter !== 'all') query = query.eq('participant_role', participantRoleFilter);
      if (yearFilter !== 'all') query = query.eq('study_year', Number(yearFilter));
      if (studentSpecialtyFilter !== 'all') query = query.eq('preferred_specialty', studentSpecialtyFilter);
      if (languageFilter !== 'all') query = query.eq('language', languageFilter);
      if (dataVersionFilter === 'current') {
        query = query
          .eq('submission_schema_version', DATA_VERSIONS.studentSubmissionSchema)
          .eq('questionnaire_version', DATA_VERSIONS.questionnaire)
          .eq('value_catalog_version', DATA_VERSIONS.valueCatalog)
          .eq('specialty_catalog_version', DATA_VERSIONS.specialtyCatalog)
          .eq('scoring_version', DATA_VERSIONS.scoring)
          .eq('consent_version', DATA_VERSIONS.studentConsent)
          .eq('participant_reflection_version', DATA_VERSIONS.participantReflection);
      } else if (dataVersionFilter === 'legacy') {
        query = query.lt('submission_schema_version', DATA_VERSIONS.studentSubmissionSchema);
      }
      query = applyDateFilters(query, dateFrom, dateTo);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      const batch = data ?? [];
      allRows.push(...batch);
      if (batch.length < EXPORT_BATCH_SIZE) break;
      const last = batch[batch.length - 1];
      cursor = { createdAt: last.created_at, id: last.id };
    }
    return allRows;
  }, [participantRoleFilter, yearFilter, studentSpecialtyFilter, languageFilter, dataVersionFilter, dateFrom, dateTo]);

  const openDetail = async (kind: CohortView, id: string) => {
    if (!supabase) return;
    const requestId = ++detailRequest.current;
    setDetailLoadingId(id);
    setError(null);
    try {
      if (kind === 'specialists') {
        const { data, error: detailError } = await supabase.from('specialist_responses').select('*').eq('id', id).single();
        if (detailError) throw detailError;
        if (requestId !== detailRequest.current) return;
        setDetailedResponse({ kind: 'specialist', row: data });
      } else {
        const { data, error: detailError } = await supabase.from('student_responses').select('*').eq('id', id).single();
        if (detailError) throw detailError;
        if (requestId !== detailRequest.current) return;
        setDetailedResponse({ kind: 'student', row: data });
      }
    } catch (detailError) {
      if (requestId === detailRequest.current) {
        setError(formatSupabaseError(detailError instanceof Error ? detailError.message : detailError as { message: string }, lang));
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoadingId(null);
    }
  };

  const loadCalibrationAnalysis = async () => {
    const requestId = ++analysisRequest.current;
    setAnalysisLoading(true);
    setError(null);
    try {
      const rows = await fetchAllSpecialists();
      if (requestId === analysisRequest.current) setAnalysisRows(rows);
    } catch (analysisError) {
      if (requestId === analysisRequest.current) {
        setError(formatSupabaseError(analysisError instanceof Error ? analysisError.message : analysisError as { message: string }, lang));
      }
    } finally {
      if (requestId === analysisRequest.current) setAnalysisLoading(false);
    }
  };

  const exportData = async (kind: ExportKind) => {
    if (!isCohortView(view)) return;
    const requestId = ++exportRequest.current;
    setExporting(kind);
    setError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (view === 'specialists') {
        // Always take a fresh, time-bounded snapshot. The on-screen analysis is
        // intentionally not reused because new submissions may have arrived.
        const rows = await fetchAllSpecialists();
        if (requestId !== exportRequest.current) return;
        if (kind === 'json') {
          downloadTextFile(`q-project-specialists-${date}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
        } else {
          const csv = kind === 'raw'
            ? specialistRawCsv(rows)
            : kind === 'long'
              ? specialistLongCsv(rows)
              : specialistAnalyticCsv(rows, specialties);
          downloadTextFile(`q-project-specialists-${kind}-${date}.csv`, csv, 'text/csv;charset=utf-8');
        }
      } else {
        const rows = await fetchAllStudents();
        if (requestId !== exportRequest.current) return;
        if (kind === 'json') {
          downloadTextFile(`q-project-students-${date}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
        } else {
          const csv = kind === 'raw'
            ? studentRawCsv(rows, specialties)
            : kind === 'long'
              ? studentLongCsv(rows)
              : studentAnalyticCsv(rows, specialties);
          downloadTextFile(`q-project-students-${kind}-${date}.csv`, csv, 'text/csv;charset=utf-8');
        }
      }
    } catch (exportError) {
      if (requestId === exportRequest.current) {
        setError(formatSupabaseError(exportError instanceof Error ? exportError.message : exportError as { message: string }, lang));
      }
    } finally {
      if (requestId === exportRequest.current) setExporting(null);
    }
  };

  const resetFilters = () => {
    const alreadyReset = yearFilter === 'all'
      && participantRoleFilter === 'all'
      && studentSpecialtyFilter === 'all'
      && specialtyFilter === 'all'
      && questionnaireFilter === 'all'
      && completenessFilter === 'all'
      && chooseAgainFilter === 'all'
      && languageFilter === 'all'
      && dataVersionFilter === 'current'
      && dateFrom === ''
      && dateTo === ''
      && page === 0;
    if (alreadyReset) return;
    setYearFilter('all');
    setParticipantRoleFilter('all');
    setStudentSpecialtyFilter('all');
    setSpecialtyFilter('all');
    setQuestionnaireFilter('all');
    setCompletenessFilter('all');
    setChooseAgainFilter('all');
    setLanguageFilter('all');
    setDataVersionFilter('current');
    setDateFrom('');
    setDateTo('');
    resetPageAndAnalysis();
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError(getSupabaseConfigurationError() ?? 'Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    } finally {
      setPassword('');
      setLoading(false);
    }
  };

  const leaveDashboard = async () => {
    exportRequest.current += 1;
    setExporting(null);
    try {
      await supabase?.auth.signOut({ scope: 'local' });
    } finally {
      onBack();
    }
  };

  const signOutDashboard = async () => {
    exportRequest.current += 1;
    setExporting(null);
    await supabase?.auth.signOut();
  };

  const refreshData = () => {
    if (view === 'configuration') {
      void refreshCatalog();
      return;
    }
    if (!isCohortView(view)) return;
    analysisRequest.current += 1;
    setAnalysisRows(null);
    setAnalysisLoading(false);
    void loadData();
  };

  const selectDashboardView = (nextView: DashboardView) => {
    if (sidebarOpen) closeMobileSidebar();
    if (view === nextView) return;
    setError(null);
    setViewHistory((history) => pushDashboardViewHistory(history, view, nextView));
    setView(nextView);
    resetPageAndAnalysis();
  };

  const goToPreviousDashboardPage = () => {
    if (detailedResponse) {
      setDetailedResponse(null);
      return;
    }
    const { previousView, remainingHistory } = popDashboardViewHistory(viewHistory);
    if (previousView) {
      setViewHistory(remainingHistory);
      setView(previousView);
      resetPageAndAnalysis();
      return;
    }
    void leaveDashboard();
  };

  const viewCopy: Record<DashboardView, { title: string; description: string }> = {
    specialists: {
      title: french ? 'Cohorte des spécialistes' : romanian ? 'Cohorta specialiștilor' : 'Specialist cohort',
      description: french
        ? 'Entretiens qualitatifs, réponses brutes et analyse de calibration contrôlée.'
        : romanian
          ? 'Interviuri calitative, răspunsuri brute și analiză de calibrare controlată.'
          : 'Qualitative interviews, raw responses, and governed calibration analysis.',
    },
    students: {
      title: french ? 'Étudiants & découverte de la médecine' : romanian ? 'Studenți și explorarea medicinei' : 'Students & medicine explorers',
      description: french
        ? 'Réponses anonymes, regards sur la médecine, préférences déclarées et classements calculés dans le navigateur, avec séparation explicite des deux publics.'
        : romanian
          ? 'Răspunsuri anonime, perspective asupra medicinei, preferințe declarate și clasamente calculate în browser, cu separarea explicită a celor două grupuri.'
          : 'Anonymous responses, views of medicine, stated preferences, and browser-computed rankings, with the two audiences kept explicit.',
    },
    algorithm: {
      title: french ? 'Algorithme & calibration' : romanian ? 'Algoritm și calibrare' : 'Algorithm & calibration',
      description: french
        ? 'Du questionnaire au classement, avec les formules, la provenance et les limites actuelles.'
        : romanian
          ? 'De la chestionar la clasament, cu formulele, proveniența și limitările actuale.'
          : 'From questionnaire to ranking, including formulas, provenance, and current limitations.',
    },
    configuration: {
      title: french ? 'Configuration versionnée' : romanian ? 'Configurare versionată' : 'Versioned configuration',
      description: french
        ? 'Descriptions, résumés cliniques et profils cibles soumis à publication contrôlée.'
        : romanian
          ? 'Descrieri, rezumate clinice și profiluri-țintă supuse unei publicări controlate.'
          : 'Descriptions, clinical summaries, and target profiles under governed publication.',
    },
  };

  const calibrationSummary = useMemo(() => analysisRows
    ? buildCalibrationSummary(analysisRows, specialtyFilter === 'all' ? null : specialtyFilter, specialties)
    : null, [analysisRows, specialtyFilter, specialties]);

  if (accessState !== 'authorized') return (
    <main className="min-h-screen bg-accent-50 flex items-center justify-center px-6">
      <form onSubmit={signIn} className="w-full max-w-md p-8 rounded-2xl bg-white border border-ink-100 shadow-soft">
        <button type="button" onClick={() => void leaveDashboard()} disabled={loading || accessState === 'checking_access'} className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="w-4 h-4" />{french ? 'Retour' : romanian ? 'Înapoi' : 'Back'}</button>
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-5"><BarChart3 /></div>
        <h1 className="font-display text-3xl font-semibold text-ink-900 mb-2">{french ? 'Portail spécialistes & administration' : 'Specialist & admin portal'}</h1>
        <p className="text-sm text-ink-500 mb-6">{french ? 'Connectez-vous avec un compte Supabase autorisé pour consulter les cohortes et, selon votre rôle, calibrer le catalogue.' : 'Sign in with an authorized Supabase account to review cohorts and, according to your role, calibrate the catalog.'}</p>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-600">Email</span>
          <input required disabled={accessState !== 'signed_out'} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" autoComplete="username" className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-600">{french ? 'Mot de passe' : 'Password'}</span>
          <input required disabled={accessState !== 'signed_out'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60" />
        </label>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button disabled={loading || accessState !== 'signed_out'} className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-brand-800 text-white font-semibold text-sm hover:bg-brand-900 disabled:opacity-40"><LogIn className="w-4 h-4" />{loading || accessState !== 'signed_out' ? (french ? 'Vérification…' : 'Checking access...') : (french ? 'Se connecter' : 'Sign in')}</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-accent-50">
      <div className="flex min-h-screen">
        <DashboardSidebar
          id="dashboard-sidebar-desktop"
          className="sticky top-0 hidden h-screen w-72 shrink-0 lg:block"
          activeView={view}
          canEdit={portalProfile?.can_edit ?? false}
          lang={lang}
          displayName={portalProfile?.display_name ?? (french ? 'Compte autorisé' : romanian ? 'Cont autorizat' : 'Authorized account')}
          portalRole={portalProfile?.portal_role ?? ''}
          onSelectView={selectDashboardView}
          onBack={() => void leaveDashboard()}
          onSignOut={() => void signOutDashboard()}
        />

        {sidebarOpen && (
          <div
            ref={mobileSidebarDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={french ? 'Menu du dashboard' : romanian ? 'Meniul tabloului de bord' : 'Dashboard menu'}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={closeMobileSidebar}
              className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm"
            />
            <DashboardSidebar
              id="dashboard-sidebar-mobile"
              className="relative z-10 w-[min(88vw,20rem)]"
              activeView={view}
              canEdit={portalProfile?.can_edit ?? false}
              lang={lang}
              displayName={portalProfile?.display_name ?? (french ? 'Compte autorisé' : romanian ? 'Cont autorizat' : 'Authorized account')}
              portalRole={portalProfile?.portal_role ?? ''}
              showClose
              onClose={closeMobileSidebar}
              onSelectView={selectDashboardView}
              onBack={() => void leaveDashboard()}
              onSignOut={() => void signOutDashboard()}
            />
          </div>
        )}

        <section className="min-w-0 flex-1">
          <div className="px-4 py-5 sm:px-8 sm:py-7 lg:px-10">
            <div className="mx-auto max-w-[1500px]">
              <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-6">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    ref={sidebarTriggerRef}
                    type="button"
                    aria-controls="dashboard-sidebar-mobile"
                    aria-expanded={sidebarOpen}
                    aria-label={french ? 'Ouvrir le menu du dashboard' : romanian ? 'Deschide meniul tabloului de bord' : 'Open dashboard menu'}
                    onClick={() => setSidebarOpen(true)}
                    className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-dashboard-back="true"
                    onClick={goToPreviousDashboardPage}
                    aria-label={french ? 'Revenir à l’onglet ou à la page précédente' : romanian ? 'Înapoi la fila sau pagina anterioară' : 'Back to the previous tab or page'}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 shadow-soft transition-colors hover:border-brand-300 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {viewHistory.length > 0
                        ? (french ? 'Onglet précédent' : romanian ? 'Fila anterioară' : 'Previous tab')
                        : (french ? 'Page précédente' : romanian ? 'Pagina anterioară' : 'Previous page')}
                    </span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                      {french ? 'Portail spécialistes & administration' : romanian ? 'Portal pentru specialiști și administrare' : 'Specialist & admin portal'}
                    </p>
                    <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">{viewCopy[view].title}</h1>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">{viewCopy[view].description}</p>
                  </div>
                </div>
                {view !== 'algorithm' && (
                  <button
                    type="button"
                    onClick={refreshData}
                    disabled={loading}
                    title={french ? 'Actualiser' : romanian ? 'Actualizează datele' : 'Refresh data'}
                    className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 shadow-soft disabled:opacity-40"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {french ? 'Actualiser' : romanian ? 'Actualizează' : 'Refresh'}
                  </button>
                )}
              </header>

        {error && <p className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {isCohortView(view) && <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Stat label={french ? 'Spécialistes' : 'Specialists'} value={counts.specialists} icon={<Stethoscope className="h-5 w-5" />} />
          <Stat label={french ? 'Entretiens actuels complets' : 'Complete current interviews'} value={counts.specialistsComplete} icon={<CheckCircle2 className="h-5 w-5" />} />
          <Stat label={french ? 'Étudiants' : romanian ? 'Studenți' : 'Students'} value={counts.students} icon={<Users className="h-5 w-5" />} />
          <Stat label={french ? 'Explorateurs' : romanian ? 'Persoane care explorează' : 'Medicine explorers'} value={counts.curious} icon={<Users className="h-5 w-5" />} />
          <Stat label={french ? 'Étudiants avec année' : romanian ? 'Studenți cu anul declarat' : 'Students with study year'} value={counts.studentsWithYear} icon={<GraduationCap className="h-5 w-5" />} />
        </div>}

        {isCohortView(view) && <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
            <ExportButton icon={<Download className="h-4 w-4" />} label={french ? 'CSV large' : 'Wide CSV'} busy={exporting === 'raw'} disabled={exporting !== null} onClick={() => void exportData('raw')} />
            <ExportButton icon={<Download className="h-4 w-4" />} label={french ? 'CSV long' : 'Long CSV'} busy={exporting === 'long'} disabled={exporting !== null} onClick={() => void exportData('long')} />
            <ExportButton icon={<BarChart3 className="h-4 w-4" />} label={french ? 'CSV analytique' : 'Analytic CSV'} busy={exporting === 'analytic'} disabled={exporting !== null} onClick={() => void exportData('analytic')} />
            <ExportButton icon={<FileJson className="h-4 w-4" />} label="JSON" busy={exporting === 'json'} disabled={exporting !== null} onClick={() => void exportData('json')} />
        </div>}

        {view === 'algorithm' && (
          <AlgorithmExplanation
            lang={lang}
            catalogRevision={catalogVersion.revision}
            catalogHash={catalogVersion.content_hash}
            specialties={specialties}
          />
        )}

        {view === 'configuration' && portalProfile && (
          <SpecialtyConfigurationEditor french={french} portalProfile={portalProfile} onPublished={() => void refreshCatalog()} />
        )}

        {isCohortView(view) && <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {view === 'specialists' ? (
              <>
                <FilterSelect label={french ? 'Spécialité réelle' : 'Actual specialty'} value={specialtyFilter} onChange={(value) => { setSpecialtyFilter(value); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Toutes les spécialités' : 'All specialties'}</option>
                  {specialties.map(({ name }) => <option key={name} value={name}>{translateSpecialtyName(name, lang)}</option>)}
                </FilterSelect>
                <FilterSelect
                  label={french ? 'Questionnaire 81 items' : romanian ? 'Chestionar 81 itemi' : '81-item questionnaire'}
                  value={questionnaireFilter}
                  onChange={(value) => { setQuestionnaireFilter(value as QuestionnaireFilter); resetPageAndAnalysis(); }}
                >
                  <option value="all">{french ? 'Tous les parcours' : romanian ? 'Toate parcursurile' : 'All paths'}</option>
                  <option value="completed">{french ? 'Complété' : romanian ? 'Completat' : 'Completed'}</option>
                  <option value="skipped">{french ? 'Passé' : romanian ? 'Omis' : 'Skipped'}</option>
                </FilterSelect>
                <FilterSelect label={french ? 'Complétude' : 'Completeness'} value={completenessFilter} onChange={(value) => { setCompletenessFilter(value as CompletenessFilter); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Tous les dossiers' : 'All records'}</option>
                  <option value="complete">{french ? 'Entretien qualitatif complet' : 'Complete qualitative interview'}</option>
                  <option value="partial">{french ? 'Au moins une réponse absente' : 'At least one answer missing'}</option>
                </FilterSelect>
                <FilterSelect label={french ? 'Rechoisirait' : 'Would choose again'} value={chooseAgainFilter} onChange={(value) => { setChooseAgainFilter(value); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Toutes les réponses' : 'All answers'}</option>
                  <option value="yes">{french ? 'Oui' : 'Yes'}</option>
                  <option value="no">{french ? 'Non' : 'No'}</option>
                </FilterSelect>
              </>
            ) : (
              <>
                <FilterSelect label={french ? 'Public' : romanian ? 'Public' : 'Audience'} value={participantRoleFilter} onChange={(value) => {
                  const nextRole = value as ParticipantRoleFilter;
                  setParticipantRoleFilter(nextRole);
                  if (!participantRoleSupportsStudyYear(nextRole)) setYearFilter('all');
                  resetPageAndAnalysis();
                }}>
                  <option value="all">{french ? 'Étudiants et explorateurs' : romanian ? 'Studenți și exploratori' : 'Students and explorers'}</option>
                  <option value="student">{participantRoleLabel('student', lang)}</option>
                  <option value="curious">{participantRoleLabel('curious', lang)}</option>
                </FilterSelect>
                {participantRoleSupportsStudyYear(participantRoleFilter) && (
                  <FilterSelect label={french ? 'Année d’étude' : romanian ? 'Anul de studiu' : 'Study year'} value={yearFilter} onChange={(value) => { setYearFilter(value); resetPageAndAnalysis(); }}>
                    <option value="all">{french ? 'Toutes les années' : romanian ? 'Toți anii de studiu' : 'All study years'}</option>
                    {STUDENT_STUDY_YEARS.map((year) => <option key={year} value={year}>{french ? 'Année' : romanian ? 'Anul' : 'Year'} {year}</option>)}
                  </FilterSelect>
                )}
                <FilterSelect label={french ? 'Spécialité préférée' : romanian ? 'Specialitatea preferată' : 'Preferred specialty'} value={studentSpecialtyFilter} onChange={(value) => { setStudentSpecialtyFilter(value); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Toutes les préférences' : romanian ? 'Toate preferințele' : 'All preferences'}</option>
                  {specialties.map(({ name }) => <option key={name} value={name}>{translateSpecialtyName(name, lang)}</option>)}
                </FilterSelect>
              </>
            )}
            <FilterSelect label={french ? 'Langue' : 'Language'} value={languageFilter} onChange={(value) => { setLanguageFilter(value); resetPageAndAnalysis(); }}>
              <option value="all">{french ? 'Toutes les langues' : 'All languages'}</option>
              <option value="fr">Français</option><option value="en">English</option><option value="ro">Română</option>
            </FilterSelect>
            <FilterSelect label={french ? 'Version des données' : 'Data version'} value={dataVersionFilter} onChange={(value) => { setDataVersionFilter(value as DataVersionFilter); resetPageAndAnalysis(); }}>
              <option value="current">{french ? 'Versions courantes uniquement' : 'Current versions only'}</option>
              <option value="all">{french ? 'Toutes les versions' : 'All versions'}</option>
              <option value="legacy">{french ? 'Données legacy uniquement' : 'Legacy data only'}</option>
            </FilterSelect>
            <FilterDate label={french ? 'Depuis' : 'From'} value={dateFrom} onChange={(value) => { setDateFrom(value); resetPageAndAnalysis(); }} />
            <FilterDate label={french ? 'Jusqu’au' : 'To'} value={dateTo} onChange={(value) => { setDateTo(value); resetPageAndAnalysis(); }} />
            <div className="flex items-end">
              <button type="button" onClick={resetFilters} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 px-3 py-2.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"><FilterX className="h-4 w-4" />{french ? 'Réinitialiser' : 'Reset filters'}</button>
            </div>
          </div>
        </section>}

        {view === 'specialists' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <div>
              <p className="font-semibold text-ink-900">{french ? 'Calibration avec la cohorte filtrée' : 'Calibration using the filtered cohort'}</p>
              <p className="mt-1 text-xs text-ink-600">{french ? 'Charge un instantané complet, exclut les protocoles incompatibles, puis recalcule le rang canonique de la spécialité réelle avec gestion des ex æquo.' : 'Loads a complete snapshot, excludes incompatible protocols, then recomputes the practiced specialty’s canonical rank with tie handling.'}</p>
            </div>
            <button type="button" disabled={analysisLoading} onClick={() => void loadCalibrationAnalysis()} className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Microscope className="h-4 w-4" />}
              {analysisRows ? (french ? 'Recalculer l’analyse' : 'Recompute analysis') : (french ? 'Charger l’analyse complète' : 'Load full analysis')}
            </button>
          </div>
        )}

        {isCohortView(view) && <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-soft">
          {view === 'specialists'
            ? <SpecialistTable rows={specialists} lang={lang} french={french} locale={locale} loadingId={detailLoadingId} onOpen={(id) => void openDetail('specialists', id)} />
            : <StudentTable rows={students} lang={lang} french={french} locale={locale} loadingId={detailLoadingId} onOpen={(id) => void openDetail('students', id)} />}
          {(view === 'specialists' ? specialists.length : students.length) === 0 && (
            <p className="p-8 text-center text-sm text-ink-500">{loading ? (french ? 'Chargement…' : 'Loading…') : (french ? 'Aucune réponse pour ces filtres.' : 'No responses match these filters.')}</p>
          )}
        </div>}

        {isCohortView(view) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
          <span>{activeTotal === 0 ? (french ? '0 réponse' : '0 responses') : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, activeTotal)} / ${activeTotal}`}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={loading || page === 0} className="rounded-full border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700 disabled:opacity-40">{french ? 'Précédent' : 'Previous'}</button>
            <span className="tabular-nums">{french ? 'Page' : 'Page'} {page + 1} / {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={loading || page + 1 >= totalPages} className="rounded-full border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700 disabled:opacity-40">{french ? 'Suivant' : 'Next'}</button>
          </div>
        </div>}

        {view === 'specialists' && calibrationSummary && (
          <CalibrationAnalysis
            summary={calibrationSummary}
            specialtyFilter={specialtyFilter}
            lang={lang}
            catalogRevision={catalogVersion.revision}
            catalogHash={catalogVersion.content_hash}
          />
        )}
            </div>
          </div>
        </section>
      </div>

      {detailedResponse && <ResearchResponseDetail response={detailedResponse} lang={lang} onClose={goToPreviousDashboardPage} />}
    </main>
  );
}

function SpecialistTable({
  rows,
  lang,
  french,
  locale,
  loadingId,
  onOpen,
}: {
  rows: SpecialistListRow[];
  lang: 'en' | 'ro' | 'fr';
  french: boolean;
  locale: string;
  loadingId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[2220px] text-left text-sm">
      <thead className="bg-ink-50 text-xs text-ink-500"><tr>
        <th className="px-5 py-3 font-semibold">{french ? 'Spécialité réelle' : 'Actual specialty'}</th>
        <th className="px-4 py-3 font-semibold">
          {french ? 'Questionnaire 81 items' : lang === 'ro' ? 'Chestionar 81 itemi' : '81-item questionnaire'}
        </th>
        <th className="px-4 py-3 font-semibold">{french ? 'Vision actuelle' : 'Current view'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Évolution au fil des ans' : 'Changes over the years'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Qualité essentielle' : 'Most important quality'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Rechoisirait' : 'Choose again'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Pourquoi non' : 'Why not'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Question à se poser' : 'Question for students'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Complétude' : 'Completeness'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Schéma' : 'Schema'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Langue' : 'Language'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Date' : 'Date'}</th>
        <th className="px-4 py-3"><span className="sr-only">{french ? 'Détails' : 'Details'}</span></th>
      </tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.id} className="border-t border-ink-100 hover:bg-ink-50/60">
          <td className="px-5 py-3 font-medium text-ink-900">{translateSpecialtyName(row.actual_specialty, lang)}</td>
          <td className="px-4 py-3">
            {row.questionnaire_completed
              ? <Badge tone="green">{french ? 'Complété' : lang === 'ro' ? 'Completat' : 'Completed'}</Badge>
              : <Badge tone="amber">{french ? 'Passé' : lang === 'ro' ? 'Omis' : 'Skipped'}</Badge>}
          </td>
          <td className="px-4 py-3"><AnswerPreview value={row.current_specialty_view} /></td>
          <td className="px-4 py-3"><AnswerPreview value={row.specialty_changes_over_years} /></td>
          <td className="px-4 py-3"><AnswerPreview value={row.most_important_specialty_quality} /></td>
          <td className="px-4 py-3">{choiceLabel(row.would_choose_again_code, french)}</td>
          <td className="px-4 py-3"><AnswerPreview value={row.would_not_choose_again_reason} /></td>
          <td className="px-4 py-3"><AnswerPreview value={row.student_self_question} /></td>
          <td className="px-4 py-3">{isSpecialistCalibrationComplete(row) ? <Badge tone="green">{row.submission_schema_version < DATA_VERSIONS.submissionSchema ? (french ? 'Legacy complet' : 'Complete legacy') : (french ? 'Complet' : 'Complete')}</Badge> : <Badge tone="amber">{row.submission_schema_version < DATA_VERSIONS.submissionSchema ? 'Legacy' : (french ? 'Partiel' : 'Partial')}</Badge>}</td>
          <td className="px-4 py-3 font-mono text-xs">v{row.submission_schema_version}</td>
          <td className="px-4 py-3 uppercase">{row.language}</td>
          <td className="px-4 py-3 text-ink-500">{new Date(row.created_at).toLocaleDateString(locale)}</td>
          <td className="px-4 py-3"><DetailButton french={french} loading={loadingId === row.id} onClick={() => onOpen(row.id)} /></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function AnswerPreview({ value }: { value: string | null }) {
  const answer = value?.trim();
  return answer
    ? <span className="block max-w-[280px] truncate text-ink-700" title={answer}>{answer}</span>
    : <span className="text-ink-400">—</span>;
}

export function StudentTable({
  rows,
  lang,
  french,
  locale,
  loadingId,
  onOpen,
}: {
  rows: StudentListRow[];
  lang: 'en' | 'ro' | 'fr';
  french: boolean;
  locale: string;
  loadingId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[1220px] text-left text-sm">
      <thead className="bg-ink-50 text-xs text-ink-500"><tr>
        <th className="px-5 py-3 font-semibold">{french ? 'Public' : lang === 'ro' ? 'Public' : 'Audience'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Année d’étude' : lang === 'ro' ? 'Anul de studiu' : 'Study year'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Spécialité préférée' : lang === 'ro' ? 'Specialitatea preferată' : 'Preferred specialty'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Regard sur la médecine' : lang === 'ro' ? 'Perspectiva asupra medicinei' : 'View of medicine'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Langue' : lang === 'ro' ? 'Limba' : 'Language'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Date' : 'Date'}</th>
        <th className="px-4 py-3"><span className="sr-only">{french ? 'Détails' : 'Details'}</span></th>
      </tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.id} className="border-t border-ink-100 hover:bg-ink-50/60">
          <td className="px-5 py-3"><Badge tone={row.participant_role === 'curious' ? 'amber' : 'green'}>{participantRoleLabel(row.participant_role, lang)}</Badge></td>
          <td className="px-4 py-3">{row.study_year ?? '—'}</td>
          <td className="px-4 py-3 font-medium text-ink-900">{row.preferred_specialty ? translateSpecialtyName(row.preferred_specialty, lang) : '—'}</td>
          <td className="px-4 py-3"><AnswerPreview value={row.medicine_view} /></td>
          <td className="px-4 py-3 uppercase">{row.language}</td>
          <td className="px-4 py-3 text-ink-500">{new Date(row.created_at).toLocaleDateString(locale)}</td>
          <td className="px-4 py-3"><DetailButton french={french} loading={loadingId === row.id} onClick={() => onOpen(row.id)} /></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function DetailButton({ french, loading, onClick }: { french: boolean; loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-white disabled:opacity-50">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}{french ? 'Détails' : 'Details'}
    </button>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs text-ink-800 focus:border-brand-500 focus:outline-none">{children}</select>
    </label>
  );
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs text-ink-800 focus:border-brand-500 focus:outline-none" />
    </label>
  );
}

function ExportButton({ icon, label, busy, disabled, onClick }: { icon: React.ReactNode; label: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{label}
    </button>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'amber'; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{children}</span>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div><div><p className="text-2xl font-semibold text-ink-900">{value}</p><p className="text-xs text-ink-500">{label}</p></div></div>;
}
