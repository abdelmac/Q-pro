/* eslint-disable react-refresh/only-export-components -- provider module also exports its immutable snapshot helpers */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CATEGORY_ORDER,
  SPECIALTIES,
  type Specialty,
  type SpecialtyCategory,
  type TraitProfile,
} from '@/data/specialties';
import { BLURB_TRANSLATIONS, type Language } from '@/data/i18n';
import { getSpecialtyNarrative } from '@/data/specialtyNarratives';
import { QUESTION_TRAITS, VALUE_MAPPING, type Trait } from '@/data/traits';
import { DATA_VERSIONS } from '@/lib/researchVersions';
import { getSupabaseConfigurationError, supabase } from '@/lib/supabase';

export type SpecialtyCatalogSource = 'remote' | 'fallback';
export type LocalizedSpecialtyText = Readonly<Record<Language, string>>;

export interface SpecialtyCatalogVersion {
  id: string;
  revision: number;
  label: string;
  content_hash: string;
  published_at: string;
}

export interface SpecialtyCatalogSnapshot {
  specialties: readonly Specialty[];
  version: Readonly<SpecialtyCatalogVersion>;
  revision: number;
  descriptions: Readonly<Record<string, LocalizedSpecialtyText>>;
  clinicalSummaries: Readonly<Record<string, LocalizedSpecialtyText>>;
  source: SpecialtyCatalogSource;
}

export interface SpecialtyCatalogContextValue extends SpecialtyCatalogSnapshot {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getDescription: (specialtyName: string, language: Language) => string;
  getClinicalSummary: (specialtyName: string, language: Language) => string;
}

interface RpcErrorLike {
  message: string;
}

interface UntypedRpcClient {
  rpc: (functionName: string) => Promise<{ data: unknown; error: RpcErrorLike | null }>;
}

interface RemoteSpecialty {
  name: string;
  category: SpecialtyCategory;
  descriptions: Record<Language, string>;
  clinicalSummaries: Record<Language, string>;
  profile: Partial<TraitProfile>;
}

interface RemoteCatalog {
  version: SpecialtyCatalogVersion;
  specialties: RemoteSpecialty[];
}

const CATEGORY_NAMES = new Set<string>(CATEGORY_ORDER);
const FALLBACK_BY_NAME = new Map(SPECIALTIES.map((specialty) => [specialty.name, specialty]));
const KNOWN_TRAITS = new Set<string>([
  ...SPECIALTIES.flatMap(({ profile }) => Object.keys(profile)),
  ...Object.values(QUESTION_TRAITS).flatMap((mappings) => mappings.map(({ trait }) => trait)),
  ...Object.values(VALUE_MAPPING).flatMap((mappings) => mappings.map(({ trait }) => trait)),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid specialty catalog: ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalLocalizedText(value: unknown, field: string): Record<Language, string> {
  if (!isRecord(value)) {
    throw new Error(`Invalid specialty catalog: ${field} must be an object.`);
  }

  return {
    en: typeof value.en === 'string' ? value.en.trim() : '',
    ro: typeof value.ro === 'string' ? value.ro.trim() : '',
    fr: typeof value.fr === 'string' ? value.fr.trim() : '',
  };
}

function parseVersion(value: unknown): SpecialtyCatalogVersion {
  if (!isRecord(value)) {
    throw new Error('Invalid specialty catalog: version must be an object.');
  }

  const revision = value.revision;
  if (!Number.isInteger(revision) || (revision as number) < 1) {
    throw new Error('Invalid specialty catalog: version.revision must be a positive integer.');
  }

  const publishedAt = requiredString(value.published_at, 'version.published_at');
  if (Number.isNaN(Date.parse(publishedAt))) {
    throw new Error('Invalid specialty catalog: version.published_at must be an ISO date.');
  }

  return {
    id: requiredString(value.id, 'version.id'),
    revision: revision as number,
    label: requiredString(value.label, 'version.label'),
    content_hash: requiredString(value.content_hash, 'version.content_hash'),
    published_at: publishedAt,
  };
}

function parseProfile(value: unknown, specialtyName: string): Partial<TraitProfile> {
  if (!isRecord(value)) {
    throw new Error(`Invalid specialty catalog: profile for ${specialtyName} must be an object.`);
  }

  const profile: Partial<TraitProfile> = {};
  for (const [trait, rawPair] of Object.entries(value)) {
    if (!KNOWN_TRAITS.has(trait)) {
      throw new Error(`Invalid specialty catalog: unknown trait ${trait} for ${specialtyName}.`);
    }
    if (!Array.isArray(rawPair) || rawPair.length !== 2) {
      throw new Error(`Invalid specialty catalog: ${specialtyName}.${trait} must be [target, importance].`);
    }

    const [target, importance] = rawPair;
    if (!Number.isFinite(target) || (target as number) < 0 || (target as number) > 100) {
      throw new Error(`Invalid specialty catalog: target for ${specialtyName}.${trait} must be between 0 and 100.`);
    }
    if (!Number.isInteger(importance) || (importance as number) < 1 || (importance as number) > 3) {
      throw new Error(`Invalid specialty catalog: importance for ${specialtyName}.${trait} must be an integer from 1 to 3.`);
    }

    profile[trait as Trait] = [target as number, importance as number];
  }

  if (Object.keys(profile).length === 0) {
    throw new Error(`Invalid specialty catalog: profile for ${specialtyName} cannot be empty.`);
  }

  return profile;
}

function parseRemoteSpecialty(value: unknown, index: number): RemoteSpecialty {
  if (!isRecord(value)) {
    throw new Error(`Invalid specialty catalog: specialties[${index}] must be an object.`);
  }

  const name = requiredString(value.name, `specialties[${index}].name`);
  if (!FALLBACK_BY_NAME.has(name)) {
    throw new Error(`Invalid specialty catalog: unknown specialty ${name}.`);
  }

  const category = requiredString(value.category, `${name}.category`);
  if (!CATEGORY_NAMES.has(category)) {
    throw new Error(`Invalid specialty catalog: unknown category ${category} for ${name}.`);
  }

  return {
    name,
    category: category as SpecialtyCategory,
    descriptions: optionalLocalizedText(value.descriptions, `${name}.descriptions`),
    clinicalSummaries: optionalLocalizedText(value.clinical_summaries, `${name}.clinical_summaries`),
    profile: parseProfile(value.profile, name),
  };
}

function parseRemoteCatalog(value: unknown): RemoteCatalog {
  if (!isRecord(value)) {
    throw new Error('Invalid specialty catalog: RPC result must be an object.');
  }
  if (!Array.isArray(value.specialties) || value.specialties.length !== SPECIALTIES.length) {
    throw new Error(`Invalid specialty catalog: exactly ${SPECIALTIES.length} specialties are required.`);
  }

  const specialties = value.specialties.map(parseRemoteSpecialty);
  const names = new Set(specialties.map(({ name }) => name));
  if (names.size !== specialties.length) {
    throw new Error('Invalid specialty catalog: specialty names must be unique.');
  }

  return { version: parseVersion(value.version), specialties };
}

function staticDescription(specialty: Specialty, language: Language): string {
  if (language === 'en') return specialty.blurb;
  return BLURB_TRANSLATIONS[language][specialty.name] || specialty.blurb;
}

function freezeLocalizedText(value: Record<Language, string>): LocalizedSpecialtyText {
  return Object.freeze({ ...value });
}

function freezeProfile(profile: Partial<TraitProfile>): TraitProfile {
  const entries = Object.entries(profile).map(([trait, pair]) => [
    trait,
    Object.freeze([pair![0], pair![1]]) as [number, number],
  ]);
  return Object.freeze(Object.fromEntries(entries)) as TraitProfile;
}

function freezeSpecialty(specialty: Specialty): Specialty {
  return Object.freeze({
    ...specialty,
    profile: freezeProfile(specialty.profile),
  });
}

function freezeSnapshot(
  version: SpecialtyCatalogVersion,
  specialties: Specialty[],
  descriptions: Record<string, LocalizedSpecialtyText>,
  clinicalSummaries: Record<string, LocalizedSpecialtyText>,
  source: SpecialtyCatalogSource,
): SpecialtyCatalogSnapshot {
  const frozenVersion = Object.freeze({ ...version });
  return Object.freeze({
    specialties: Object.freeze(specialties.map(freezeSpecialty)),
    version: frozenVersion,
    revision: frozenVersion.revision,
    descriptions: Object.freeze({ ...descriptions }),
    clinicalSummaries: Object.freeze({ ...clinicalSummaries }),
    source,
  });
}

function createFallbackSnapshot(): SpecialtyCatalogSnapshot {
  const descriptions: Record<string, LocalizedSpecialtyText> = {};
  const clinicalSummaries: Record<string, LocalizedSpecialtyText> = {};

  for (const specialty of SPECIALTIES) {
    const narrative = getSpecialtyNarrative(specialty.name);
    const localized = freezeLocalizedText({
      en: narrative?.overview.en ?? staticDescription(specialty, 'en'),
      ro: narrative?.overview.ro ?? staticDescription(specialty, 'ro'),
      fr: narrative?.overview.fr ?? staticDescription(specialty, 'fr'),
    });
    descriptions[specialty.name] = localized;
    clinicalSummaries[specialty.name] = narrative
      ? freezeLocalizedText({ ...narrative.fitProfile })
      : localized;
  }

  return freezeSnapshot(
    {
      id: `static:${DATA_VERSIONS.specialtyCatalog}`,
      revision: 1,
      label: DATA_VERSIONS.specialtyCatalog,
      content_hash: 'static-fallback',
      published_at: '1970-01-01T00:00:00.000Z',
    },
    [...SPECIALTIES],
    descriptions,
    clinicalSummaries,
    'fallback',
  );
}

export const FALLBACK_SPECIALTY_CATALOG = createFallbackSnapshot();

export function mergeSpecialtyCatalog(value: unknown): SpecialtyCatalogSnapshot {
  const remote = parseRemoteCatalog(value);
  const remoteByName = new Map(remote.specialties.map((specialty) => [specialty.name, specialty]));
  const specialties: Specialty[] = [];
  const descriptions: Record<string, LocalizedSpecialtyText> = {};
  const clinicalSummaries: Record<string, LocalizedSpecialtyText> = {};

  for (const fallback of SPECIALTIES) {
    const remoteSpecialty = remoteByName.get(fallback.name);
    const fallbackDescriptions = FALLBACK_SPECIALTY_CATALOG.descriptions[fallback.name];
    const remoteDescriptions = remoteSpecialty?.descriptions;
    const mergedDescriptions = freezeLocalizedText({
      en: remoteDescriptions?.en || fallbackDescriptions.en,
      ro: remoteDescriptions?.ro || fallbackDescriptions.ro,
      fr: remoteDescriptions?.fr || fallbackDescriptions.fr,
    });
    const remoteSummaries = remoteSpecialty?.clinicalSummaries;
    const fallbackSummaries = FALLBACK_SPECIALTY_CATALOG.clinicalSummaries[fallback.name];
    const mergedSummaries = freezeLocalizedText({
      en: remoteSummaries?.en || fallbackSummaries.en,
      ro: remoteSummaries?.ro || fallbackSummaries.ro,
      fr: remoteSummaries?.fr || fallbackSummaries.fr,
    });
    const mergedProfile = (remoteSpecialty?.profile ?? fallback.profile) as TraitProfile;

    descriptions[fallback.name] = mergedDescriptions;
    clinicalSummaries[fallback.name] = mergedSummaries;
    specialties.push({
      name: fallback.name,
      category: remoteSpecialty?.category ?? fallback.category,
      profile: mergedProfile,
      blurb: mergedDescriptions.en,
    });
  }

  return freezeSnapshot(
    remote.version,
    specialties,
    descriptions,
    clinicalSummaries,
    'remote',
  );
}

const SpecialtyCatalogContext = createContext<SpecialtyCatalogContextValue | null>(null);

export function SpecialtyCatalogProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SpecialtyCatalogSnapshot>(FALLBACK_SPECIALTY_CATALOG);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(getSupabaseConfigurationError());
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!supabase) {
      setError(getSupabaseConfigurationError() ?? 'Supabase is unavailable.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // This RPC is introduced by the catalog migration. Keep the cast local so
      // generated database types can remain unchanged until the next type pull.
      const rpcClient = supabase as unknown as UntypedRpcClient;
      const { data, error: rpcError } = await rpcClient.rpc('get_active_specialty_catalog');
      if (rpcError) throw new Error(rpcError.message);
      const nextSnapshot = mergeSpecialtyCatalog(data);
      if (currentRequest === requestId.current) setSnapshot(nextSnapshot);
    } catch (refreshError) {
      if (currentRequest === requestId.current) {
        setError(refreshError instanceof Error ? refreshError.message : 'Unable to load the specialty catalog.');
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const value = useMemo<SpecialtyCatalogContextValue>(() => ({
    ...snapshot,
    isLoading,
    error,
    refresh,
    getDescription: (specialtyName, language) => (
      snapshot.descriptions[specialtyName]?.[language]
      ?? snapshot.descriptions[specialtyName]?.en
      ?? ''
    ),
    getClinicalSummary: (specialtyName, language) => (
      snapshot.clinicalSummaries[specialtyName]?.[language]
      ?? snapshot.clinicalSummaries[specialtyName]?.en
      ?? FALLBACK_SPECIALTY_CATALOG.clinicalSummaries[specialtyName]?.[language]
      ?? FALLBACK_SPECIALTY_CATALOG.clinicalSummaries[specialtyName]?.en
      ?? ''
    ),
  }), [error, isLoading, refresh, snapshot]);

  return <SpecialtyCatalogContext.Provider value={value}>{children}</SpecialtyCatalogContext.Provider>;
}

export function useSpecialtyCatalog(): SpecialtyCatalogContextValue {
  const context = useContext(SpecialtyCatalogContext);
  if (!context) {
    throw new Error('useSpecialtyCatalog must be used within SpecialtyCatalogProvider.');
  }
  return context;
}
