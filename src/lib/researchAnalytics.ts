import { supabase } from './supabase';
import type { Database, Json } from './database.types';

export type ResearchFilters = Record<string, string | number>;
export interface CountGroup { key: string | null; count: number }
export interface CohortSummary {
  global_total: number; total: number; eligible: number; excluded: number;
  missing_geography: number; missing_scoring_context?: number; questionnaire_skipped: number;
  counts: Record<string, CountGroup[]>; exclusions: Array<{ reason: string; count: number }>;
  filters: ResearchFilters; generated_at: string; analysis_version: string;
  completion_metrics: null; personalized_settings?: string;
}
export interface QuestionSummary {
  question_id: string; questionnaire_version: string; n: number; missing: number;
  cohort_total: number; excluded: number; mean: number | null; median: number | null;
  stddev: number | null; floor: number; ceiling: number;
  distribution: Array<{ value: number; count: number }>; scale: 'original';
}
export interface CorrelationSummary { n: number; r: number | null; method: string }
export interface SavedCohort { id: string; name: string; filters: ResearchFilters; created_at: string; updated_at: string }
export interface AnalysisRun {
  id: string; created_at: string; completed_at: string; status: string; execution_ms: number;
  filters: ResearchFilters; parameters: Record<string, string>; analysis_version: string;
  dataset_checksum: string; snapshot_count: number; model_versions: Json;
  results?: { summary: CohortSummary; question?: QuestionSummary; correlation?: CorrelationSummary };
  cache_hit?: boolean;
}
type Procedures = Database['public']['Functions'];
type AnalyticsProcedure = Extract<keyof Procedures, `research_${string}` | `${'list' | 'save' | 'delete' | 'create' | 'get'}_research_${string}`>;

/** No persistence or frontend caching of private research responses. */
export async function researchRequest<T, K extends AnalyticsProcedure = AnalyticsProcedure>(
  name: K, args: Procedures[K]['Args'], signal?: AbortSignal,
): Promise<T> {
  if (!supabase) throw new Error('The research backend is unavailable.');
  let request = supabase.rpc(name, args);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data as T;
}

export function normalizedResearchFilters(values: Record<string, string>): ResearchFilters {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== 'all')
    .map(([key, value]) => [key, /^(study_year|schema_version|specialty_config_revision|experience_min|experience_max|satisfaction_min|satisfaction_max)$/.test(key) ? Number(value) : value]));
}

export function downloadResearchJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
