import { supabase } from './supabase';
import type { Database } from './database.types';
import { isValidCountryCode } from '@/data/geography';

export const COMMUNITY_FEATURE_ENABLED = import.meta.env.VITE_COMMUNITY_ENABLED === 'true';
export const COMMUNITY_TERMS_VERSION = 'community-membership-v1';
export const COMMUNITY_PUBLICATION_VERSION = 'community-publication-v1';
export type CommunityRole = 'student' | 'specialist' | 'curious';
export interface CommunityProfile {
  role: CommunityRole; specialty: string | null; verified: boolean; suspended: boolean;
  country_code: string | null; map_consent: boolean;
}
export interface CommunityComment { id: string; specialty: string; body: string; language: 'en' | 'fr' | 'ro' }
export interface OwnCommunityComment extends CommunityComment { status: 'pending' | 'approved' | 'rejected' | 'withdrawn' }
export interface AdminCommunityMember { id: string; email: string; role: CommunityRole; specialty: string | null; verified: boolean; suspended: boolean }
export interface AdminCommunityComment extends OwnCommunityComment { author_id: string; email: string; verified: boolean; report_count: number }
export interface CommunityMap { enabled: boolean; countries: { country_code: string; count: number }[] }
export interface CommunityPage<T> { items: T[]; next: string | null }
export type CommunityIssue = 'unavailable' | 'access' | 'invalid' | 'limit' | 'setup';
export class CommunityError extends Error {
  constructor(readonly issue: CommunityIssue) { super(`community:${issue}`); this.name = 'CommunityError'; }
}
type RpcName = keyof Database['public']['Functions'];
async function rpc<N extends RpcName>(name: N, args?: Database['public']['Functions'][N]['Args'], signal?: AbortSignal): Promise<unknown> {
  if (!supabase) throw new CommunityError('setup');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, 12_000);
  try {
    const { data, error } = await supabase.rpc(name, args).abortSignal(controller.signal);
    if (error) {
      const issue = error.code === '42501' || error.code === 'PGRST301' ? 'access'
        : error.code === 'PGRST202' ? 'setup' : error.code === '22023' ? 'invalid'
          : error.code === 'P0429' || error.code === 'PT429' || error.code === '54000' ? 'limit' : 'unavailable';
      throw new CommunityError(issue);
    }
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommunityError('unavailable');
  return value as Record<string, unknown>;
}
function str(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || value.length > max) throw new CommunityError('unavailable');
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new CommunityError('unavailable');
  return value;
}
function uuid(value: unknown): string {
  const id = str(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new CommunityError('unavailable');
  return id;
}
function role(value: unknown): CommunityRole {
  if (value !== 'student' && value !== 'specialist' && value !== 'curious') throw new CommunityError('unavailable');
  return value;
}
export function parseCommunityProfile(value: unknown): CommunityProfile | null {
  if (value === null) return null;
  const p = object(value);
  if (p.country_code !== null && !isValidCountryCode(p.country_code)) throw new CommunityError('unavailable');
  return { role: role(p.role), specialty: p.specialty === null ? null : str(p.specialty, 200), verified: bool(p.verified),
    suspended: bool(p.suspended), country_code: p.country_code as string | null, map_consent: bool(p.map_consent) };
}
function comment(value: unknown): CommunityComment {
  const c = object(value);
  if (!['en', 'fr', 'ro'].includes(String(c.language))) throw new CommunityError('unavailable');
  // Project an explicit public allow-list; never pass unexpected author data to UI.
  return { id: uuid(c.id), specialty: str(c.specialty, 200), body: str(c.body), language: c.language as CommunityComment['language'] };
}
function ownComment(value: unknown): OwnCommunityComment {
  const c = object(value);
  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(String(c.status))) throw new CommunityError('unavailable');
  return { ...comment(c), status: c.status as OwnCommunityComment['status'] };
}
function array<T>(value: unknown, parse: (v: unknown) => T, max = 20): T[] {
  if (!Array.isArray(value) || value.length > max) throw new CommunityError('unavailable');
  return value.map(parse);
}
function page<T extends { id: string }>(value: unknown, parse: (v: unknown) => T): CommunityPage<T> {
  const items = array(value, parse);
  return { items, next: items.length === 20 ? items[items.length - 1].id : null };
}
export function parseCommunityMap(value: unknown): CommunityMap {
  const v = object(value);
  const countries = array(v.countries, entry => {
    const c = object(entry);
    if (!isValidCountryCode(c.country_code) || !Number.isSafeInteger(c.count) || Number(c.count) < 10 || Number(c.count) % 5 !== 0) throw new CommunityError('unavailable');
    return { country_code: c.country_code, count: c.count as number };
  }, 250);
  const enabled = bool(v.enabled);
  if ((!enabled && countries.length > 0) || new Set(countries.map(c => c.country_code)).size !== countries.length) throw new CommunityError('unavailable');
  return { enabled, countries };
}
type PageOptions = { after?: string | null; signal?: AbortSignal };
export const communityApi = {
  status: async (signal?: AbortSignal) => ({ enabled: bool(object(await rpc('community_status', undefined, signal)).enabled) }),
  profile: async (signal?: AbortSignal) => parseCommunityProfile(await rpc('community_profile', undefined, signal)),
  saveProfile: async (p: { role: CommunityRole; specialty: string | null; country_code: string | null; map_consent: boolean; terms_version: string }) => parseCommunityProfile(await rpc('community_save_profile', {
    p_role: p.role, p_specialty: p.specialty, p_country_code: p.country_code, p_map_consent: p.map_consent, p_terms_version: p.terms_version,
  })),
  listComments: async ({ after = null, specialty = null, signal }: PageOptions & { specialty?: string | null } = {}) => page(await rpc('community_list_comments', { p_after: after, p_limit: 20, p_specialty: specialty }, signal), comment),
  myComments: async (signal?: AbortSignal) => array(await rpc('community_my_comments', undefined, signal), ownComment, 100),
  submitComment: async (p: { id: string; body: string; language: string; consent: boolean; consent_version: string }) => ownComment(await rpc('community_submit_comment', {
    p_id: p.id, p_body: p.body, p_language: p.language, p_consent: p.consent, p_consent_version: p.consent_version,
  })),
  withdrawComment: async (id: string) => bool(await rpc('community_withdraw_comment', { p_id: id })),
  withdrawMapConsent: async () => bool(await rpc('community_withdraw_map_consent')),
  reportComment: async (id: string, reason: string) => bool(await rpc('community_report_comment', { p_id: id, p_reason: reason })),
  adminMembers: async ({ after = null, signal }: PageOptions = {}) => page(await rpc('community_admin_members', { p_after: after, p_limit: 20 }, signal), value => {
    const m = object(value);
    return { id: uuid(m.id), email: str(m.email, 320), role: role(m.role), specialty: m.specialty === null ? null : str(m.specialty, 200), verified: bool(m.verified), suspended: bool(m.suspended) } satisfies AdminCommunityMember;
  }),
  reviewMember: async (p: { id: string; verified: boolean; suspended: boolean; note: string }) => bool(await rpc('community_admin_review_member', { p_id: p.id, p_verified: p.verified, p_suspended: p.suspended, p_note: p.note })),
  adminComments: async ({ after = null, status = 'pending', signal }: PageOptions & { status?: string } = {}) => page(await rpc('community_admin_comments', { p_after: after, p_limit: 20, p_status: status }, signal), value => {
    const c = object(value);
    if (!Number.isSafeInteger(c.report_count) || Number(c.report_count) < 0) throw new CommunityError('unavailable');
    return { ...ownComment(c), author_id: uuid(c.author_id), email: str(c.email, 320), verified: bool(c.verified), report_count: c.report_count as number } satisfies AdminCommunityComment;
  }),
  reviewComment: async (p: { id: string; approve: boolean; note: string }) => bool(await rpc('community_admin_review_comment', { p_id: p.id, p_approve: p.approve, p_note: p.note })),
  map: async (signal?: AbortSignal) => parseCommunityMap(await rpc('community_map', undefined, signal)),
};

