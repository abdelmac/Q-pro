import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translateSpecialtyName } from '@/data/i18n';
import { useLanguage } from '@/lib/LanguageContext';
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
import CalibrationAnalysis from '@/components/CalibrationAnalysis';
import ResearchResponseDetail, { type DetailedResponse } from '@/components/ResearchResponseDetail';
import SpecialtyConfigurationEditor from '@/components/SpecialtyConfigurationEditor';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
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
  LogOut,
  Microscope,
  RefreshCw,
  Stethoscope,
  Settings2,
  Users,
} from 'lucide-react';

const PAGE_SIZE = 50;
const EXPORT_BATCH_SIZE = 250;
const IDLE_SIGN_OUT_MS = 30 * 60 * 1000;
const STUDY_YEARS = Array.from({ length: 12 }, (_, index) => index + 1);

type StudentListRow = Pick<
  Database['public']['Tables']['student_responses']['Row'],
  'id' | 'study_year' | 'preferred_specialty' | 'language' | 'created_at'
>;
type SpecialistListRow = Pick<
  Database['public']['Tables']['specialist_responses']['Row'],
  | 'id'
  | 'actual_specialty'
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
type DashboardView = 'students' | 'specialists' | 'configuration';
type CompletenessFilter = 'all' | 'complete' | 'partial';
type DataVersionFilter = 'current' | 'all' | 'legacy';
type ExportKind = 'raw' | 'long' | 'analytic' | 'json';

interface DashboardCounts {
  students: number;
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
  const locale = french ? 'fr-FR' : 'en-GB';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [portalProfile, setPortalProfile] = useState<PortalProfile | null>(null);
  const [students, setStudents] = useState<StudentListRow[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistListRow[]>([]);
  const [view, setView] = useState<DashboardView>('specialists');
  const [yearFilter, setYearFilter] = useState('all');
  const [studentSpecialtyFilter, setStudentSpecialtyFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('all');
  const [chooseAgainFilter, setChooseAgainFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [dataVersionFilter, setDataVersionFilter] = useState<DataVersionFilter>('current');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
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
    if (view === 'configuration') {
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
      supabase.from('student_responses').select('id', { count: 'exact', head: true }),
      supabase.from('specialist_responses').select('id', { count: 'exact', head: true }),
      supabase.from('student_responses').select('id', { count: 'exact', head: true }).not('study_year', 'is', null),
      supabase.from('specialist_responses').select('id', { count: 'exact', head: true })
        .eq('submission_schema_version', DATA_VERSIONS.submissionSchema)
        .not('current_specialty_view', 'is', null)
        .not('specialty_changes_over_years', 'is', null)
        .not('most_important_specialty_quality', 'is', null)
        .not('would_choose_again_code', 'is', null)
        .not('student_self_question', 'is', null)
        .or('would_choose_again_code.eq.yes,and(would_choose_again_code.eq.no,would_not_choose_again_reason.not.is.null)'),
    ]);

    try {
      if (view === 'specialists') {
        let query = supabase
          .from('specialist_responses')
          .select('id, actual_specialty, submission_schema_version, current_specialty_view, specialty_changes_over_years, most_important_specialty_quality, would_choose_again_code, would_not_choose_again_reason, student_self_question, years_of_experience, career_satisfaction, intention_to_change_code, voluntary_choice_code, language, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);
        if (specialtyFilter !== 'all') query = query.eq('actual_specialty', specialtyFilter);
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
          setError(formatSupabaseError(queryError));
          return;
        }
        setSpecialists(rowResult.data ?? []);
        setActiveTotal(rowResult.count ?? 0);
        setCounts({
          students: countResults[0].count ?? 0,
          specialists: countResults[1].count ?? 0,
          studentsWithYear: countResults[2].count ?? 0,
          specialistsComplete: countResults[3].count ?? 0,
        });
      } else {
        let query = supabase
          .from('student_responses')
          .select('id, study_year, preferred_specialty, language, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);
        if (yearFilter !== 'all') query = query.eq('study_year', Number(yearFilter));
        if (studentSpecialtyFilter !== 'all') query = query.eq('preferred_specialty', studentSpecialtyFilter);
        if (languageFilter !== 'all') query = query.eq('language', languageFilter);
        if (dataVersionFilter === 'current') {
          query = query
            .eq('submission_schema_version', DATA_VERSIONS.submissionSchema)
            .eq('questionnaire_version', DATA_VERSIONS.questionnaire)
            .eq('value_catalog_version', DATA_VERSIONS.valueCatalog)
            .eq('specialty_catalog_version', DATA_VERSIONS.specialtyCatalog)
            .eq('scoring_version', DATA_VERSIONS.scoring)
            .eq('consent_version', DATA_VERSIONS.consent);
        } else if (dataVersionFilter === 'legacy') {
          query = query.lt('submission_schema_version', DATA_VERSIONS.submissionSchema);
        }
        query = applyDateFilters(query, dateFrom, dateTo);

        const [rowResult, countResults] = await Promise.all([query, globalCounts]);
        const queryError = rowResult.error ?? countResults.find(({ error: countError }) => countError)?.error;
        if (requestId !== loadRequest.current) return;
        if (queryError) {
          setError(formatSupabaseError(queryError));
          return;
        }
        setStudents(rowResult.data ?? []);
        setActiveTotal(rowResult.count ?? 0);
        setCounts({
          students: countResults[0].count ?? 0,
          specialists: countResults[1].count ?? 0,
          studentsWithYear: countResults[2].count ?? 0,
          specialistsComplete: countResults[3].count ?? 0,
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
    chooseAgainFilter,
    completenessFilter,
    yearFilter,
    studentSpecialtyFilter,
    languageFilter,
    dataVersionFilter,
    dateFrom,
    dateTo,
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
          ? formatSupabaseError(accessError)
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
  }, []);

  useEffect(() => {
    if (accessState === 'authorized' && view !== 'configuration') void loadData();
  }, [accessState, loadData, view]);

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
      if (yearFilter !== 'all') query = query.eq('study_year', Number(yearFilter));
      if (studentSpecialtyFilter !== 'all') query = query.eq('preferred_specialty', studentSpecialtyFilter);
      if (languageFilter !== 'all') query = query.eq('language', languageFilter);
      if (dataVersionFilter === 'current') {
        query = query
          .eq('submission_schema_version', DATA_VERSIONS.submissionSchema)
          .eq('questionnaire_version', DATA_VERSIONS.questionnaire)
          .eq('value_catalog_version', DATA_VERSIONS.valueCatalog)
          .eq('specialty_catalog_version', DATA_VERSIONS.specialtyCatalog)
          .eq('scoring_version', DATA_VERSIONS.scoring)
          .eq('consent_version', DATA_VERSIONS.consent);
      } else if (dataVersionFilter === 'legacy') {
        query = query.lt('submission_schema_version', DATA_VERSIONS.submissionSchema);
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
  }, [yearFilter, studentSpecialtyFilter, languageFilter, dataVersionFilter, dateFrom, dateTo]);

  const openDetail = async (kind: DashboardView, id: string) => {
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
        setError(formatSupabaseError(detailError instanceof Error ? detailError.message : detailError as { message: string }));
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
        setError(formatSupabaseError(analysisError instanceof Error ? analysisError.message : analysisError as { message: string }));
      }
    } finally {
      if (requestId === analysisRequest.current) setAnalysisLoading(false);
    }
  };

  const exportData = async (kind: ExportKind) => {
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
        setError(formatSupabaseError(exportError instanceof Error ? exportError.message : exportError as { message: string }));
      }
    } finally {
      if (requestId === exportRequest.current) setExporting(null);
    }
  };

  const resetFilters = () => {
    const alreadyReset = yearFilter === 'all'
      && studentSpecialtyFilter === 'all'
      && specialtyFilter === 'all'
      && completenessFilter === 'all'
      && chooseAgainFilter === 'all'
      && languageFilter === 'all'
      && dataVersionFilter === 'current'
      && dateFrom === ''
      && dateTo === ''
      && page === 0;
    if (alreadyReset) return;
    setYearFilter('all');
    setStudentSpecialtyFilter('all');
    setSpecialtyFilter('all');
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
    analysisRequest.current += 1;
    setAnalysisRows(null);
    setAnalysisLoading(false);
    void loadData();
  };

  const calibrationSummary = useMemo(() => analysisRows
    ? buildCalibrationSummary(analysisRows, specialtyFilter === 'all' ? null : specialtyFilter, specialties)
    : null, [analysisRows, specialtyFilter, specialties]);

  if (accessState !== 'authorized') return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
      <form onSubmit={signIn} className="w-full max-w-md p-8 rounded-2xl bg-white border border-ink-100 shadow-soft">
        <button type="button" onClick={() => void leaveDashboard()} className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 mb-8"><ArrowLeft className="w-4 h-4" />{french ? 'Retour' : 'Back'}</button>
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
        <button disabled={loading || accessState !== 'signed_out'} className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink-900 text-white font-semibold text-sm disabled:opacity-40"><LogIn className="w-4 h-4" />{loading || accessState !== 'signed_out' ? (french ? 'Vérification…' : 'Checking access...') : (french ? 'Se connecter' : 'Sign in')}</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button onClick={() => void leaveDashboard()} className="mb-3 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" />{french ? 'Retour et déconnexion' : 'Back and sign out'}</button>
            <h1 className="font-display text-3xl font-semibold text-ink-900">{french ? 'Portail spécialistes & administration' : 'Specialist & admin portal'}</h1>
            <p className="mt-1 text-sm text-ink-500">{french ? 'Cohortes anonymes, descriptions cliniques et configuration versionnée de l’algorithme.' : 'Anonymous cohorts, clinical content, and versioned algorithm configuration.'}</p>
            {portalProfile && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{portalProfile.display_name ?? (french ? 'Compte autorisé' : 'Authorized account')} · {portalProfile.portal_role}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshData} disabled={loading} title={french ? 'Actualiser' : 'Refresh data'} className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{french ? 'Actualiser' : 'Refresh'}</button>
            <button onClick={() => void signOutDashboard()} title={french ? 'Déconnexion' : 'Sign out'} className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"><LogOut className="h-4 w-4" />{french ? 'Déconnexion' : 'Sign out'}</button>
          </div>
        </header>

        {error && <p className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label={french ? 'Spécialistes' : 'Specialists'} value={counts.specialists} icon={<Stethoscope className="h-5 w-5" />} />
          <Stat label={french ? 'Entretiens actuels complets' : 'Complete current interviews'} value={counts.specialistsComplete} icon={<CheckCircle2 className="h-5 w-5" />} />
          <Stat label={french ? 'Étudiants' : 'Students'} value={counts.students} icon={<Users className="h-5 w-5" />} />
          <Stat label={french ? 'Étudiants avec année' : 'Students with study year'} value={counts.studentsWithYear} icon={<GraduationCap className="h-5 w-5" />} />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-white p-1">
            <button onClick={() => { if (view !== 'specialists') { setView('specialists'); resetPageAndAnalysis(); } }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${view === 'specialists' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}><Stethoscope className="h-4 w-4" />{french ? 'Spécialistes' : 'Specialists'}</button>
            <button onClick={() => { if (view !== 'students') { setView('students'); resetPageAndAnalysis(); } }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${view === 'students' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}><GraduationCap className="h-4 w-4" />{french ? 'Étudiants' : 'Students'}</button>
            {portalProfile?.can_edit && <button onClick={() => { if (view !== 'configuration') { setView('configuration'); resetPageAndAnalysis(); } }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${view === 'configuration' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}><Settings2 className="h-4 w-4" />{french ? 'Configuration' : 'Configuration'}</button>}
          </div>
          {view !== 'configuration' && <div className="flex flex-wrap items-center gap-2">
            <ExportButton icon={<Download className="h-4 w-4" />} label={french ? 'CSV large' : 'Wide CSV'} busy={exporting === 'raw'} disabled={exporting !== null} onClick={() => void exportData('raw')} />
            <ExportButton icon={<Download className="h-4 w-4" />} label={french ? 'CSV long' : 'Long CSV'} busy={exporting === 'long'} disabled={exporting !== null} onClick={() => void exportData('long')} />
            <ExportButton icon={<BarChart3 className="h-4 w-4" />} label={french ? 'CSV analytique' : 'Analytic CSV'} busy={exporting === 'analytic'} disabled={exporting !== null} onClick={() => void exportData('analytic')} />
            <ExportButton icon={<FileJson className="h-4 w-4" />} label="JSON" busy={exporting === 'json'} disabled={exporting !== null} onClick={() => void exportData('json')} />
          </div>}
        </div>

        {view === 'configuration' && portalProfile && (
          <SpecialtyConfigurationEditor french={french} portalProfile={portalProfile} onPublished={() => void refreshCatalog()} />
        )}

        {view !== 'configuration' && <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {view === 'specialists' ? (
              <>
                <FilterSelect label={french ? 'Spécialité réelle' : 'Actual specialty'} value={specialtyFilter} onChange={(value) => { setSpecialtyFilter(value); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Toutes les spécialités' : 'All specialties'}</option>
                  {specialties.map(({ name }) => <option key={name} value={name}>{translateSpecialtyName(name, lang)}</option>)}
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
                <FilterSelect label={french ? 'Année d’étude' : 'Study year'} value={yearFilter} onChange={(value) => { setYearFilter(value); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Toutes les années' : 'All study years'}</option>
                  {STUDY_YEARS.map((year) => <option key={year} value={year}>{french ? 'Année' : 'Year'} {year}</option>)}
                </FilterSelect>
                <FilterSelect label={french ? 'Spécialité préférée' : 'Preferred specialty'} value={studentSpecialtyFilter} onChange={(value) => { setStudentSpecialtyFilter(value); resetPageAndAnalysis(); }}>
                  <option value="all">{french ? 'Toutes les préférences' : 'All preferences'}</option>
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

        {view !== 'configuration' && <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-soft">
          {view === 'specialists'
            ? <SpecialistTable rows={specialists} lang={lang} french={french} locale={locale} loadingId={detailLoadingId} onOpen={(id) => void openDetail('specialists', id)} />
            : <StudentTable rows={students} lang={lang} french={french} locale={locale} loadingId={detailLoadingId} onOpen={(id) => void openDetail('students', id)} />}
          {(view === 'specialists' ? specialists.length : students.length) === 0 && (
            <p className="p-8 text-center text-sm text-ink-500">{loading ? (french ? 'Chargement…' : 'Loading…') : (french ? 'Aucune réponse pour ces filtres.' : 'No responses match these filters.')}</p>
          )}
        </div>}

        {view !== 'configuration' && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
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

      {detailedResponse && <ResearchResponseDetail response={detailedResponse} lang={lang} onClose={() => setDetailedResponse(null)} />}
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
    <table className="w-full min-w-[2100px] text-left text-sm">
      <thead className="bg-ink-50 text-xs text-ink-500"><tr>
        <th className="px-5 py-3 font-semibold">{french ? 'Spécialité réelle' : 'Actual specialty'}</th>
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

function StudentTable({
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
    <table className="w-full min-w-[780px] text-left text-sm">
      <thead className="bg-ink-50 text-xs text-ink-500"><tr>
        <th className="px-5 py-3 font-semibold">{french ? 'Année d’étude' : 'Study year'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Spécialité préférée' : 'Preferred specialty'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Langue' : 'Language'}</th>
        <th className="px-4 py-3 font-semibold">{french ? 'Date' : 'Date'}</th>
        <th className="px-4 py-3"><span className="sr-only">{french ? 'Détails' : 'Details'}</span></th>
      </tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.id} className="border-t border-ink-100 hover:bg-ink-50/60">
          <td className="px-5 py-3">{row.study_year ?? '—'}</td>
          <td className="px-4 py-3 font-medium text-ink-900">{row.preferred_specialty ? translateSpecialtyName(row.preferred_specialty, lang) : '—'}</td>
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
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tone === 'green' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{children}</span>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div><div><p className="text-2xl font-semibold text-ink-900">{value}</p><p className="text-xs text-ink-500">{label}</p></div></div>;
}
