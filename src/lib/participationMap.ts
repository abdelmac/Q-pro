import { isValidCountryCode } from '@/data/geography';
import type { Language } from '@/data/i18n';
import { supabase } from '@/lib/supabase';

export type MapRespondentType = 'all' | 'student' | 'specialist' | 'non_medical';
export interface ParticipationMapFilters {
  respondentType: MapRespondentType;
  countryCode: string;
  language: 'all' | Language;
  monthFrom: string;
  monthTo: string;
  dataVersion: 'all' | 'current';
}

export const DEFAULT_MAP_FILTERS: ParticipationMapFilters = {
  respondentType: 'all', countryCode: '', language: 'all', monthFrom: '', monthTo: '', dataVersion: 'all',
};

export interface ParticipationCountry {
  countryCode: string;
  country: string;
  count: number;
  students: number;
  specialists: number;
  nonMedical: number;
}

export interface ParticipationMapStats {
  total: number;
  countries: number;
  students: number;
  specialists: number;
  nonMedical: number;
  groups: ParticipationCountry[];
  privacyThreshold: 10;
  rounding: 5;
  granularity: 'month';
  publishedThrough: string | null;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid map response');
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value % 5 !== 0 || (value > 0 && value < 10)) {
    throw new Error('Invalid published count');
  }
  return value;
}

/** Whitelist the aggregate-only contract; reject partial or inconsistent responses. */
export function parseParticipationMapStats(value: unknown): ParticipationMapStats {
  const data = record(value);
  if (data.privacyThreshold !== 10 || data.rounding !== 5 || data.granularity !== 'month' || !Array.isArray(data.groups)) {
    throw new Error('Unsupported map privacy protocol');
  }
  if (data.publishedThrough !== null && (
    typeof data.publishedThrough !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.publishedThrough)
    || !Number.isFinite(Date.parse(data.publishedThrough))
    || new Date(data.publishedThrough).toISOString().slice(0, 10) !== data.publishedThrough
  )) throw new Error('Invalid map publication date');

  const seen = new Set<string>();
  const groups = data.groups.map(raw => {
    const group = record(raw);
    if (!isValidCountryCode(group.countryCode) || seen.has(group.countryCode) || typeof group.country !== 'string') {
      throw new Error('Invalid published country');
    }
    seen.add(group.countryCode);
    const parsed = {
      countryCode: group.countryCode, country: group.country,
      count: count(group.count), students: count(group.students), specialists: count(group.specialists), nonMedical: count(group.nonMedical),
    };
    if (!parsed.count || parsed.count !== parsed.students + parsed.specialists + parsed.nonMedical) {
      throw new Error('Inconsistent country totals');
    }
    return parsed;
  });
  const total = count(data.total);
  const students = count(data.students);
  const specialists = count(data.specialists);
  const nonMedical = count(data.nonMedical);
  if (data.countries !== groups.length || total !== students + specialists + nonMedical
    || (total > 0 && data.publishedThrough === null)
    || total !== groups.reduce((sum, group) => sum + group.count, 0)
    || students !== groups.reduce((sum, group) => sum + group.students, 0)
    || specialists !== groups.reduce((sum, group) => sum + group.specialists, 0)
    || nonMedical !== groups.reduce((sum, group) => sum + group.nonMedical, 0)) {
    throw new Error('Inconsistent published totals');
  }
  return {
    total, students, specialists, nonMedical, countries: groups.length, groups,
    privacyThreshold: 10, rounding: 5, granularity: 'month', publishedThrough: data.publishedThrough as string | null,
  };
}

export function latestClosedMonth(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return date.toISOString().slice(0, 7);
}

export function areValidMapDates(filters: Pick<ParticipationMapFilters, 'monthFrom' | 'monthTo'>, now = new Date()): boolean {
  const monthPattern = /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/;
  const latest = latestClosedMonth(now);
  if ([filters.monthFrom, filters.monthTo].some(month => month && (!monthPattern.test(month) || month > latest))) return false;
  return !filters.monthFrom || !filters.monthTo || filters.monthFrom <= filters.monthTo;
}

export function mapRpcArguments(filters: ParticipationMapFilters) {
  if (!areValidMapDates(filters) || (filters.countryCode && !isValidCountryCode(filters.countryCode))
    || !['all', 'student', 'specialist', 'non_medical'].includes(filters.respondentType)
    || !['all', 'en', 'fr', 'ro'].includes(filters.language)
    || !['all', 'current'].includes(filters.dataVersion)) throw new Error('Invalid map filters');
  return {
    p_respondent_type: filters.respondentType,
    p_country_code: filters.countryCode || null,
    p_language: filters.language,
    p_month_from: filters.monthFrom ? `${filters.monthFrom}-01` : null,
    p_month_to: filters.monthTo ? `${filters.monthTo}-01` : null,
    p_data_version: filters.dataVersion,
  };
}

export class MapFilterAccessError extends Error {
  constructor() { super('Geographic data access denied'); }
}

export async function fetchParticipationMapStats(filters: ParticipationMapFilters, signal?: AbortSignal, access: 'public' | 'private' = 'public'): Promise<ParticipationMapStats> {
  if (!supabase) throw new Error('Map service unavailable');
  if (access === 'public' && Object.keys(DEFAULT_MAP_FILTERS).some(key => filters[key as keyof ParticipationMapFilters] !== DEFAULT_MAP_FILTERS[key as keyof ParticipationMapFilters])) {
    throw new MapFilterAccessError();
  }
  const query = supabase.rpc(access === 'private' ? 'get_private_participation_map_stats' : 'get_participation_map_stats', mapRpcArguments(filters));
  const { data, error, status } = await (signal ? query.abortSignal(signal) : query);
  if (error && (error.code === '42501' || status === 401 || status === 403)) throw new MapFilterAccessError();
  if (error) throw new Error('Map service unavailable');
  return parseParticipationMapStats(data);
}
