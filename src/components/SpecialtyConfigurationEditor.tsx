import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SPECIALTIES } from '@/data/specialties';
import { translateBlurb, translateSpecialtyName, type Language } from '@/data/i18n';
import { translateTrait } from '@/data/specialtyDisplayI18n';
import type { Trait } from '@/data/traits';
import { getSupabaseConfigurationError, supabase } from '@/lib/supabase';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Languages,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
} from 'lucide-react';

type PortalRole = 'researcher' | 'doctor' | 'professor';
type ContentLanguage = 'en' | 'fr' | 'ro';
type BusyAction = 'loading' | 'saving' | 'publishing' | 'restoring' | null;

export interface SpecialtyConfigurationEditorProps {
  french: boolean;
  portalProfile: {
    display_name: string | null;
    portal_role: PortalRole;
    can_edit: boolean;
    can_publish: boolean;
  };
  onPublished?: () => void;
}

interface LocalizedText {
  en: string;
  fr: string;
  ro: string;
}

interface ProfileValue {
  target: number;
  importance: number;
}

interface CatalogEntry {
  specialtyName: string;
  descriptions: LocalizedText;
  clinicalSummaries: LocalizedText;
  profile: Record<string, ProfileValue>;
}

interface CatalogDraft {
  versionId: string | null;
  activeVersionId: string | null;
  lockVersion: number | null;
  status: string;
  source: 'database' | 'fallback';
  entries: CatalogEntry[];
}

interface CatalogVersion {
  id: string;
  versionNumber: number | null;
  status: string;
  lockVersion: number | null;
  changeNote: string;
  createdAt: string | null;
  publishedAt: string | null;
  actor: string | null;
  checksum: string | null;
}

interface PortalRpcError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

interface UntypedPortalRpcClient {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: PortalRpcError | null }>;
}

const CONTENT_LANGUAGES: ContentLanguage[] = ['en', 'fr', 'ro'];
const EMPTY_LOCALIZED_TEXT: LocalizedText = { en: '', fr: '', ro: '' };
const MANUAL_ORIENTATION = 'manual_orientation';
const PREVENTION_ORIENTATION = 'prevention_orientation';
const HISTORY_LIMIT = 30;

const LANGUAGE_LABELS: Record<ContentLanguage, string> = {
  en: 'English',
  fr: 'Français',
  ro: 'Română',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  return values.find(isRecord) as Record<string, unknown> | undefined ?? null;
}

function firstString(...values: unknown[]): string | null {
  const value = values.find((item) => typeof item === 'string' && item.length > 0);
  return typeof value === 'string' ? value : null;
}

function firstFiniteNumber(...values: unknown[]): number | null {
  const value = values.find((item) => typeof item === 'number' && Number.isFinite(item));
  return typeof value === 'number' ? value : null;
}

function cloneEntry(entry: CatalogEntry): CatalogEntry {
  return {
    specialtyName: entry.specialtyName,
    descriptions: { ...entry.descriptions },
    clinicalSummaries: { ...entry.clinicalSummaries },
    profile: Object.fromEntries(
      Object.entries(entry.profile).map(([trait, value]) => [trait, { ...value }]),
    ),
  };
}

function fallbackEntries(): CatalogEntry[] {
  return SPECIALTIES.map(({ name, blurb, profile }) => ({
    specialtyName: name,
    descriptions: {
      en: translateBlurb(name, 'en') || blurb,
      fr: translateBlurb(name, 'fr'),
      ro: translateBlurb(name, 'ro'),
    },
    clinicalSummaries: { ...EMPTY_LOCALIZED_TEXT },
    profile: Object.fromEntries(
      Object.entries(profile).map(([trait, [target, importance]]) => [
        trait,
        { target, importance },
      ]),
    ),
  }));
}

function parseLocalizedText(
  value: unknown,
  entry: Record<string, unknown>,
  prefix: 'description' | 'clinical_summary',
  fallback: LocalizedText,
): LocalizedText {
  const record = isRecord(value) ? value : null;
  return {
    en: firstString(record?.en, entry[`${prefix}_en`]) ?? fallback.en,
    fr: firstString(record?.fr, entry[`${prefix}_fr`]) ?? fallback.fr,
    ro: firstString(record?.ro, entry[`${prefix}_ro`]) ?? fallback.ro,
  };
}

function parseProfile(value: unknown, fallback: Record<string, ProfileValue>): Record<string, ProfileValue> {
  if (!isRecord(value)) return Object.fromEntries(
    Object.entries(fallback).map(([trait, profileValue]) => [trait, { ...profileValue }]),
  );

  const parsed: Record<string, ProfileValue> = {};
  Object.entries(value).forEach(([trait, rawValue]) => {
    let target: number | null = null;
    let importance: number | null = null;

    if (Array.isArray(rawValue)) {
      target = firstFiniteNumber(rawValue[0]);
      importance = firstFiniteNumber(rawValue[1]);
    } else if (isRecord(rawValue)) {
      target = firstFiniteNumber(rawValue.target, rawValue.target_score, rawValue.value);
      importance = firstFiniteNumber(
        rawValue.importance,
        rawValue.importance_weight,
        rawValue.weight,
      );
    }

    if (target !== null && importance !== null) {
      parsed[trait] = { target, importance };
    }
  });

  return Object.keys(parsed).length > 0 ? parsed : Object.fromEntries(
    Object.entries(fallback).map(([trait, profileValue]) => [trait, { ...profileValue }]),
  );
}

function rawCatalogEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  const candidate = value.entries ?? value.specialties ?? value.catalog;
  if (Array.isArray(candidate)) return candidate;
  if (isRecord(candidate)) {
    return Object.entries(candidate).map(([specialtyName, entry]) => (
      isRecord(entry) ? { specialty_name: specialtyName, ...entry } : null
    )).filter((entry): entry is { specialty_name: string } & Record<string, unknown> => entry !== null);
  }
  return [];
}

function parseCatalogEntry(value: unknown, fallbackMap: Map<string, CatalogEntry>): CatalogEntry | null {
  if (!isRecord(value)) return null;
  const specialtyName = firstString(value.specialty_name, value.name, value.canonical_name);
  if (!specialtyName) return null;

  const fallback = fallbackMap.get(specialtyName) ?? {
    specialtyName,
    descriptions: { ...EMPTY_LOCALIZED_TEXT },
    clinicalSummaries: { ...EMPTY_LOCALIZED_TEXT },
    profile: {},
  };

  return {
    specialtyName,
    descriptions: parseLocalizedText(
      value.descriptions ?? value.description,
      value,
      'description',
      fallback.descriptions,
    ),
    clinicalSummaries: parseLocalizedText(
      value.clinical_summaries ?? value.clinical_summary,
      value,
      'clinical_summary',
      fallback.clinicalSummaries,
    ),
    profile: parseProfile(value.profile ?? value.weights, fallback.profile),
  };
}

function parseCatalogDraft(value: unknown): CatalogDraft {
  const fallback = fallbackEntries();
  const fallbackMap = new Map(fallback.map((entry) => [entry.specialtyName, entry]));
  const root = isRecord(value) ? value : {};
  const body = firstRecord(root.draft, root.catalog_draft, root) ?? {};
  const parsedEntries = rawCatalogEntries(body)
    .map((entry) => parseCatalogEntry(entry, fallbackMap))
    .filter((entry): entry is CatalogEntry => entry !== null);
  const entries = parsedEntries.length > 0 ? parsedEntries : fallback;
  const versionId = firstString(body.version_id, body.draft_version_id, body.id, root.version_id);
  const activeVersionId = firstString(
    body.active_version_id,
    root.active_version_id,
    isRecord(root.active_version) ? root.active_version.id : null,
  );
  const lockVersion = firstFiniteNumber(
    body.lock_version,
    body.revision,
    root.lock_version,
  );

  return {
    versionId,
    activeVersionId,
    lockVersion,
    status: firstString(body.status, root.status) ?? (versionId ? 'draft' : 'fallback'),
    source: parsedEntries.length > 0 ? 'database' : 'fallback',
    entries: entries.sort((left, right) => left.specialtyName.localeCompare(right.specialtyName)),
  };
}

function parseVersions(value: unknown): CatalogVersion[] {
  const root = isRecord(value) ? value : null;
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(root?.versions)
      ? root.versions
      : Array.isArray(root?.history)
        ? root.history
        : [];

  return rows.flatMap((row): CatalogVersion[] => {
    if (!isRecord(row)) return [];
    const id = firstString(row.id, row.version_id);
    if (!id) return [];
    return [{
      id,
      versionNumber: firstFiniteNumber(row.version_number, row.number),
      status: firstString(row.status) ?? 'unknown',
      lockVersion: firstFiniteNumber(row.lock_version, row.revision),
      changeNote: firstString(row.change_note, row.change_summary, row.note) ?? '',
      createdAt: firstString(row.created_at),
      publishedAt: firstString(row.published_at),
      actor: firstString(
        row.actor_display_name,
        row.published_by_display_name,
        row.created_by_display_name,
      ),
      checksum: firstString(row.checksum),
    }];
  });
}

function portalErrorMessage(error: unknown, french: boolean): string {
  if (isRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : '';
    const message = typeof error.message === 'string' ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (
      code === '40001'
      || normalized.includes('lock version')
      || normalized.includes('version conflict')
      || normalized.includes('stale')
    ) {
      return french
        ? 'Le brouillon a été modifié ailleurs. Actualisez la page avant de reprendre vos changements.'
        : 'The draft was changed elsewhere. Refresh before continuing your edits.';
    }
    if (normalized.includes('permission denied') || normalized.includes('not allowed')) {
      return french
        ? 'Votre rôle ne permet pas cette opération.'
        : 'Your role does not allow this operation.';
    }
    return message;
  }
  return error instanceof Error ? error.message : String(error);
}

async function callPortalRpc(functionName: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!supabase) {
    throw new Error(getSupabaseConfigurationError() ?? 'Supabase is unavailable.');
  }
  const client = supabase as unknown as UntypedPortalRpcClient;
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw error;
  return data;
}

function toRpcProfile(profile: Record<string, ProfileValue>): Record<string, [number, number]> {
  return Object.fromEntries(
    Object.entries(profile).map(([trait, value]) => [
      trait,
      [value.target, value.importance] as [number, number],
    ]),
  );
}

function validateEntry(entry: CatalogEntry, original: CatalogEntry | null): string | null {
  for (const language of CONTENT_LANGUAGES) {
    const descriptionLength = entry.descriptions[language].trim().length;
    const summaryLength = entry.clinicalSummaries[language].trim().length;
    if (descriptionLength < 1 || descriptionLength > 2000) return `description_${language}`;
    if (summaryLength < 20 || summaryLength > 5000) return `clinical_summary_${language}`;
  }
  const profileRows = Object.entries(entry.profile);
  if (profileRows.length === 0) return 'profile_empty';
  for (const [trait, value] of profileRows) {
    if (!Number.isInteger(value.target) || value.target < 0 || value.target > 100) {
      return `target:${trait}`;
    }
    if (!Number.isInteger(value.importance) || value.importance < 1 || value.importance > 3) {
      return `importance:${trait}`;
    }
  }

  const prevention = entry.profile[PREVENTION_ORIENTATION];
  const originalPrevention = original?.profile[PREVENTION_ORIENTATION];
  if (prevention && !originalPrevention) return 'prevention_added';
  if (
    prevention
    && originalPrevention
    && (
      prevention.target > originalPrevention.target
      || prevention.importance > originalPrevention.importance
    )
  ) {
    return 'prevention_increased';
  }
  return null;
}

function shortId(value: string | null): string {
  if (!value) return '—';
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatDate(value: string | null, french: boolean): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(french ? 'fr-FR' : 'en-GB');
}

function roleLabel(role: PortalRole, french: boolean): string {
  if (role === 'professor') return french ? 'Professeur' : 'Professor';
  if (role === 'doctor') return french ? 'Docteur' : 'Doctor';
  return french ? 'Chercheur' : 'Researcher';
}

function statusLabel(status: string, french: boolean): string {
  const normalized = status.toLowerCase();
  const labels: Record<string, [string, string]> = {
    active: ['Active', 'Active'],
    published: ['Publiée', 'Published'],
    draft: ['Brouillon', 'Draft'],
    archived: ['Archivée', 'Archived'],
    fallback: ['Valeurs du code', 'Code fallback'],
  };
  return labels[normalized]?.[french ? 0 : 1] ?? status;
}

export default function SpecialtyConfigurationEditor({
  french,
  portalProfile,
  onPublished,
}: SpecialtyConfigurationEditorProps) {
  const initialEntries = useMemo(fallbackEntries, []);
  const [catalog, setCatalog] = useState<CatalogDraft>({
    versionId: null,
    activeVersionId: null,
    lockVersion: null,
    status: 'fallback',
    source: 'fallback',
    entries: initialEntries,
  });
  const [selectedName, setSelectedName] = useState(initialEntries[0]?.specialtyName ?? '');
  const [workingEntry, setWorkingEntry] = useState<CatalogEntry | null>(
    initialEntries[0] ? cloneEntry(initialEntries[0]) : null,
  );
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>('en');
  const [search, setSearch] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [versions, setVersions] = useState<CatalogVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<BusyAction>('loading');
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedNameRef = useRef(selectedName);
  const catalogRequest = useRef(0);
  const historyRequest = useRef(0);

  useEffect(() => {
    selectedNameRef.current = selectedName;
  }, [selectedName]);

  const loadCatalog = useCallback(async (showLoader = true) => {
    const requestId = ++catalogRequest.current;
    if (showLoader) setBusy('loading');
    setError(null);
    try {
      const response = await callPortalRpc('get_specialty_catalog_draft');
      if (requestId !== catalogRequest.current) return;
      const nextCatalog = parseCatalogDraft(response);
      const nextSelectedName = nextCatalog.entries.some(
        ({ specialtyName }) => specialtyName === selectedNameRef.current,
      ) ? selectedNameRef.current : nextCatalog.entries[0]?.specialtyName ?? '';
      const nextEntry = nextCatalog.entries.find(
        ({ specialtyName }) => specialtyName === nextSelectedName,
      ) ?? null;

      setCatalog(nextCatalog);
      setSelectedName(nextSelectedName);
      setWorkingEntry(nextEntry ? cloneEntry(nextEntry) : null);
      setDirty(false);
    } catch (loadError) {
      if (requestId !== catalogRequest.current) return;
      setError(portalErrorMessage(loadError, french));
    } finally {
      if (requestId === catalogRequest.current) setBusy(null);
    }
  }, [french]);

  const loadHistory = useCallback(async () => {
    const requestId = ++historyRequest.current;
    setHistoryError(null);
    try {
      const response = await callPortalRpc('list_specialty_catalog_versions', {
        p_limit: HISTORY_LIMIT,
      });
      if (requestId !== historyRequest.current) return;
      setVersions(parseVersions(response));
    } catch (loadError) {
      if (requestId !== historyRequest.current) return;
      setHistoryError(portalErrorMessage(loadError, french));
    }
  }, [french]);

  useEffect(() => {
    void loadCatalog();
    void loadHistory();
    return () => {
      catalogRequest.current += 1;
      historyRequest.current += 1;
    };
  }, [loadCatalog, loadHistory]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(french ? 'fr' : 'en');
    if (!normalizedSearch) return catalog.entries;
    return catalog.entries.filter(({ specialtyName }) => {
      const translated = translateSpecialtyName(specialtyName, french ? 'fr' : 'en');
      return specialtyName.toLowerCase().includes(normalizedSearch)
        || translated.toLocaleLowerCase(french ? 'fr' : 'en').includes(normalizedSearch);
    });
  }, [catalog.entries, french, search]);

  const originalEntry = useMemo(() => catalog.entries.find(
    ({ specialtyName }) => specialtyName === selectedName,
  ) ?? null, [catalog.entries, selectedName]);

  const profileRows = useMemo(() => Object.entries(workingEntry?.profile ?? {}).sort(
    ([left], [right]) => {
      const riskOrder = [PREVENTION_ORIENTATION, MANUAL_ORIENTATION];
      const leftRisk = riskOrder.indexOf(left);
      const rightRisk = riskOrder.indexOf(right);
      if (leftRisk >= 0 || rightRisk >= 0) {
        if (leftRisk < 0) return 1;
        if (rightRisk < 0) return -1;
        return leftRisk - rightRisk;
      }
      return left.localeCompare(right);
    },
  ), [workingEntry]);

  const activeVersionId = catalog.activeVersionId
    ?? versions.find(({ status }) => ['active', 'published'].includes(status.toLowerCase()))?.id
    ?? null;
  const catalogHasVersionLock = Boolean(catalog.versionId && catalog.lockVersion !== null);
  const draftReadyForPublication = catalog.status.toLowerCase() === 'draft' && catalogHasVersionLock;

  const updateWorkingEntry = (updater: (entry: CatalogEntry) => CatalogEntry) => {
    if (!portalProfile.can_edit) return;
    setWorkingEntry((current) => current ? updater(current) : current);
    setDirty(true);
    setError(null);
    setSuccess(null);
  };

  const selectSpecialty = (specialtyName: string) => {
    if (specialtyName === selectedName) return;
    if (dirty && !window.confirm(
      french
        ? 'Abandonner les modifications non enregistrées de cette spécialité ?'
        : 'Discard unsaved changes for this specialty?',
    )) return;

    const entry = catalog.entries.find((candidate) => candidate.specialtyName === specialtyName);
    if (!entry) return;
    setSelectedName(specialtyName);
    setWorkingEntry(cloneEntry(entry));
    setDirty(false);
    setError(null);
    setSuccess(null);
  };

  const requireChangeNote = (): boolean => {
    if (changeNote.trim().length >= 3) return true;
    setError(french
      ? 'Une justification d’au moins 3 caractères est obligatoire avant toute sauvegarde, publication ou restauration.'
      : 'A change note of at least 3 characters is required before saving, publishing, or restoring.');
    return false;
  };

  const saveDraft = async () => {
    if (!portalProfile.can_edit || !workingEntry || busy) return;
    if (!catalogHasVersionLock) {
      setError(french
        ? 'La version de configuration n’est pas disponible. Actualisez avant de modifier.'
        : 'The configuration version is unavailable. Refresh before editing.');
      return;
    }
    if (!requireChangeNote()) return;
    const validationError = validateEntry(workingEntry, originalEntry);
    if (validationError) {
      setError(french
        ? `Le profil contient une valeur invalide ou une modification interdite (${validationError}).`
        : `The profile contains an invalid or forbidden change (${validationError}).`);
      return;
    }

    setBusy('saving');
    setError(null);
    setSuccess(null);
    try {
      await callPortalRpc('save_specialty_catalog_entry_draft', {
        p_expected_version_id: catalog.versionId,
        p_expected_lock_version: catalog.lockVersion,
        p_specialty_name: workingEntry.specialtyName,
        p_descriptions: { ...workingEntry.descriptions },
        p_clinical_summaries: { ...workingEntry.clinicalSummaries },
        p_profile: toRpcProfile(workingEntry.profile),
        p_change_note: changeNote.trim(),
      });
      setChangeNote('');
      await Promise.all([loadCatalog(false), loadHistory()]);
      setSuccess(french ? 'Brouillon enregistré et verrou actualisé.' : 'Draft saved and lock refreshed.');
    } catch (saveError) {
      setError(portalErrorMessage(saveError, french));
    } finally {
      setBusy(null);
    }
  };

  const publishDraft = async () => {
    if (!portalProfile.can_publish || busy) return;
    if (dirty) {
      setError(french
        ? 'Enregistrez les modifications de la spécialité avant de publier.'
        : 'Save the specialty changes before publishing.');
      return;
    }
    if (!draftReadyForPublication || !catalog.versionId || catalog.lockVersion === null) {
      setError(french
        ? 'Aucun brouillon versionné n’est disponible. Enregistrez d’abord une spécialité.'
        : 'No versioned draft is available. Save a specialty first.');
      return;
    }
    if (!requireChangeNote()) return;
    if (!window.confirm(french
      ? 'Publier ce brouillon pour le moteur de matching ? Cette action crée une nouvelle version active.'
      : 'Publish this draft to the matching engine? This creates a new active version.')) return;

    setBusy('publishing');
    setError(null);
    setSuccess(null);
    try {
      await callPortalRpc('publish_specialty_catalog_draft', {
        p_draft_version_id: catalog.versionId,
        p_expected_lock_version: catalog.lockVersion,
        p_change_note: changeNote.trim(),
      });
      setChangeNote('');
      await Promise.all([loadCatalog(false), loadHistory()]);
      setSuccess(french
        ? 'Nouvelle version publiée. Le moteur peut maintenant recharger cette configuration.'
        : 'New version published. The engine can now reload this configuration.');
      onPublished?.();
    } catch (publishError) {
      setError(portalErrorMessage(publishError, french));
    } finally {
      setBusy(null);
    }
  };

  const restoreVersion = async (source: CatalogVersion) => {
    if (!portalProfile.can_publish || busy) return;
    if (dirty) {
      setError(french
        ? 'Enregistrez ou abandonnez les modifications locales avant une restauration.'
        : 'Save or discard local changes before restoring a version.');
      return;
    }
    if (!activeVersionId) {
      setError(french
        ? 'La version active est inconnue. Actualisez avant de restaurer.'
        : 'The active version is unknown. Refresh before restoring.');
      return;
    }
    if (catalog.status.toLowerCase() === 'draft') {
      setError(french
        ? 'Un brouillon existe déjà. Publiez-le avant de restaurer une version historique.'
        : 'A draft already exists. Publish it before restoring a historical version.');
      return;
    }
    if (!requireChangeNote()) return;
    if (!window.confirm(french
      ? `Restaurer la version ${source.versionNumber ?? shortId(source.id)} sous forme de nouvelle version active ?`
      : `Restore version ${source.versionNumber ?? shortId(source.id)} as a new active version?`)) return;

    setBusy('restoring');
    setError(null);
    setSuccess(null);
    try {
      await callPortalRpc('restore_specialty_catalog_version', {
        p_source_version_id: source.id,
        p_expected_active_version_id: activeVersionId,
        p_change_note: changeNote.trim(),
      });
      setChangeNote('');
      await Promise.all([loadCatalog(false), loadHistory()]);
      setSuccess(french
        ? 'Version restaurée via une nouvelle publication traçable.'
        : 'Version restored through a new traceable publication.');
      onPublished?.();
    } catch (restoreError) {
      setError(portalErrorMessage(restoreError, french));
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    if (busy) return;
    if (dirty && !window.confirm(french
      ? 'Actualiser et abandonner les modifications non enregistrées ?'
      : 'Refresh and discard unsaved changes?')) return;
    setSuccess(null);
    await Promise.all([loadCatalog(), loadHistory()]);
  };

  const uiLanguage = (french ? 'fr' : 'en') as Language;
  const selectedTitle = workingEntry
    ? translateSpecialtyName(workingEntry.specialtyName, uiLanguage)
    : (french ? 'Aucune spécialité' : 'No specialty');

  return (
    <section className="mt-8 space-y-5" aria-labelledby="specialty-configuration-title">
      <header className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                {french ? 'Portail spécialiste / administration' : 'Specialist / admin portal'}
              </p>
              <h2 id="specialty-configuration-title" className="mt-1 font-display text-2xl font-semibold text-ink-900">
                {french ? 'Configuration du catalogue et du matching' : 'Catalog and matching configuration'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                {french
                  ? 'Modifiez un brouillon versionné. Les réponses étudiantes et spécialistes restent immuables ; seule une publication explicite rend la nouvelle configuration disponible au moteur.'
                  : 'Edit a versioned draft. Student and specialist responses remain immutable; only an explicit publication makes the new configuration available to the engine.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 font-semibold text-ink-700">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
              {portalProfile.display_name ?? (french ? 'Compte autorisé' : 'Authorized account')}
            </span>
            <span className="rounded-full bg-brand-50 px-3 py-1.5 font-semibold text-brand-800">
              {roleLabel(portalProfile.portal_role, french)}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-semibold text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === 'loading' ? 'animate-spin' : ''}`} />
              {french ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <VersionInfo
            icon={<FileText className="h-4 w-4" />}
            label={french ? 'Brouillon' : 'Draft'}
            value={catalog.versionId ? shortId(catalog.versionId) : (french ? 'À créer' : 'Not created')}
          />
          <VersionInfo
            icon={<LockKeyhole className="h-4 w-4" />}
            label={french ? 'Verrou optimiste' : 'Optimistic lock'}
            value={catalog.lockVersion === null ? '—' : String(catalog.lockVersion)}
          />
          <VersionInfo
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={french ? 'Version active' : 'Active version'}
            value={shortId(activeVersionId)}
          />
        </div>

        {catalog.source === 'fallback' && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {french
                ? 'Aucun brouillon n’a été renvoyé par la base. Les valeurs TypeScript actuelles sont affichées comme point de départ ; la première sauvegarde doit créer le brouillon côté serveur.'
                : 'The database returned no draft. Current TypeScript values are shown as a starting point; the first save must create the server-side draft.'}
            </p>
          </div>
        )}

        {!portalProfile.can_edit && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{french
              ? 'Votre rôle dispose d’un accès en lecture seule. Doctor ou Professor est requis pour modifier un brouillon.'
              : 'Your role has read-only access. Doctor or Professor is required to edit a draft.'}</p>
          </div>
        )}
      </header>

      <div aria-live="polite" className="space-y-3">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{success}</p>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(250px,0.72fr)_minmax(0,2fr)]">
        <aside className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="border-b border-ink-100 p-4">
            <label htmlFor="specialty-config-search" className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {french ? 'Spécialités' : 'Specialties'}
            </label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="specialty-config-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={french ? 'Rechercher…' : 'Search…'}
                className="w-full rounded-xl border border-ink-200 bg-ink-50 py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <p className="mt-2 text-xs text-ink-400">{filteredEntries.length}/{catalog.entries.length}</p>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-2">
            {filteredEntries.map((entry) => {
              const selected = entry.specialtyName === selectedName;
              return (
                <button
                  key={entry.specialtyName}
                  type="button"
                  onClick={() => selectSpecialty(entry.specialtyName)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? 'bg-brand-50 font-semibold text-brand-900'
                      : 'text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  <span className="block leading-snug">
                    {translateSpecialtyName(entry.specialtyName, uiLanguage)}
                  </span>
                  {selected && dirty && (
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {french ? 'Non enregistré' : 'Unsaved'}
                    </span>
                  )}
                </button>
              );
            })}
            {filteredEntries.length === 0 && (
              <p className="p-4 text-center text-sm text-ink-500">
                {french ? 'Aucun résultat.' : 'No results.'}
              </p>
            )}
          </div>
        </aside>

        <article className="min-w-0 space-y-5">
          {busy === 'loading' && !workingEntry ? (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border border-ink-100 bg-white shadow-soft">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : workingEntry ? (
            <>
              <section className="rounded-2xl border border-ink-100 bg-white shadow-soft">
                <div className="border-b border-ink-100 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                        {statusLabel(catalog.status, french)}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-semibold text-ink-900">{selectedTitle}</h3>
                      <p className="mt-1 font-mono text-[11px] text-ink-400">{workingEntry.specialtyName}</p>
                    </div>
                    <div className="inline-flex self-start rounded-xl border border-ink-200 bg-ink-50 p-1" aria-label={french ? 'Langue du contenu' : 'Content language'}>
                      {CONTENT_LANGUAGES.map((language) => (
                        <button
                          key={language}
                          type="button"
                          onClick={() => setContentLanguage(language)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            contentLanguage === language
                              ? 'bg-white text-brand-800 shadow-sm'
                              : 'text-ink-500 hover:text-ink-800'
                          }`}
                        >
                          {language.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                    <Languages className="h-4 w-4 text-brand-600" />
                    {LANGUAGE_LABELS[contentLanguage]}
                  </div>
                  <label className="block">
                    <span className="text-sm font-semibold text-ink-800">
                      {french ? 'Description destinée au public' : 'Public-facing description'}
                    </span>
                    <textarea
                      value={workingEntry.descriptions[contentLanguage]}
                      onChange={(event) => updateWorkingEntry((entry) => ({
                        ...entry,
                        descriptions: { ...entry.descriptions, [contentLanguage]: event.target.value },
                      }))}
                      disabled={!portalProfile.can_edit || busy !== null}
                      rows={4}
                      maxLength={2000}
                      className="mt-2 w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500"
                    />
                    <span className="mt-1 block text-right text-[11px] text-ink-400">
                      {workingEntry.descriptions[contentLanguage].length}/2000
                    </span>
                  </label>

                  <label className="block">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-800">
                      <Stethoscope className="h-4 w-4 text-brand-600" />
                      {french ? 'Profil professionnel détaillé' : 'Detailed professional profile'}
                    </span>
                    <textarea
                      value={workingEntry.clinicalSummaries[contentLanguage]}
                      onChange={(event) => updateWorkingEntry((entry) => ({
                        ...entry,
                        clinicalSummaries: {
                          ...entry.clinicalSummaries,
                          [contentLanguage]: event.target.value,
                        },
                      }))}
                      disabled={!portalProfile.can_edit || busy !== null}
                      rows={6}
                      maxLength={5000}
                      className="mt-2 w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500"
                    />
                    <span className="mt-1 block text-right text-[11px] text-ink-400">
                      {workingEntry.clinicalSummaries[contentLanguage].length}/5000
                    </span>
                  </label>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
                <div className="border-b border-ink-100 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <div>
                      <h3 className="font-semibold text-ink-900">
                        {french ? 'Profil cible et poids de matching' : 'Target profile and matching weights'}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">
                        {french
                          ? 'La cible décrit le niveau attendu (0–100). L’importance détermine le poids relatif dans le score (1–3). Une amélioration du Top-k ne suffit pas à valider scientifiquement un changement.'
                          : 'Target describes the expected level (0–100). Importance controls relative score weight (1–3). A Top-k improvement alone does not scientifically validate a change.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-red-100 bg-red-50/70 p-4 text-xs leading-relaxed text-red-950 sm:px-6">
                  <p><strong>{MANUAL_ORIENTATION}</strong> — {french
                    ? 'mesuré uniquement lorsque la valeur manuelle est sélectionnée : couverture partielle.'
                    : 'measured only when the hands-on value is selected: partial coverage.'}</p>
                  <p className="mt-1"><strong>{PREVENTION_ORIENTATION}</strong> — {french
                    ? 'non mesuré par le questionnaire actuel : les champs sont verrouillés et ce trait ne peut pas être ajouté ou augmenté depuis cette interface.'
                    : 'unmeasured by the current questionnaire: fields are locked and this trait cannot be added or increased here.'}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[660px] text-left text-sm">
                    <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">{french ? 'Trait' : 'Trait'}</th>
                        <th className="w-36 px-4 py-3 font-semibold">{french ? 'Cible' : 'Target'}</th>
                        <th className="w-44 px-4 py-3 font-semibold">{french ? 'Importance' : 'Importance'}</th>
                        <th className="w-36 px-4 py-3 font-semibold">{french ? 'Mesure' : 'Measurement'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {profileRows.map(([trait, value]) => {
                        const prevention = trait === PREVENTION_ORIENTATION;
                        const manual = trait === MANUAL_ORIENTATION;
                        return (
                          <tr key={trait} className={prevention ? 'bg-red-50/60' : manual ? 'bg-amber-50/60' : ''}>
                            <td className="px-5 py-3">
                              <p className="font-medium text-ink-800">
                                {translateTrait(trait as Trait, uiLanguage)}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] text-ink-400">{trait}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={value.target}
                                  onChange={(event) => {
                                    const next = Number(event.target.value);
                                    if (!Number.isFinite(next)) return;
                                    updateWorkingEntry((entry) => ({
                                      ...entry,
                                      profile: {
                                        ...entry.profile,
                                        [trait]: { ...entry.profile[trait], target: next },
                                      },
                                    }));
                                  }}
                                  disabled={!portalProfile.can_edit || busy !== null || prevention}
                                  aria-label={`${trait} target`}
                                  className="w-20 rounded-lg border border-ink-200 px-2.5 py-2 text-right tabular-nums text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-100 disabled:text-ink-500"
                                />
                                <span className="text-xs text-ink-400">/100</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={value.importance}
                                onChange={(event) => updateWorkingEntry((entry) => ({
                                  ...entry,
                                  profile: {
                                    ...entry.profile,
                                    [trait]: {
                                      ...entry.profile[trait],
                                      importance: Number(event.target.value),
                                    },
                                  },
                                }))}
                                disabled={!portalProfile.can_edit || busy !== null || prevention}
                                aria-label={`${trait} importance`}
                                className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-100 disabled:text-ink-500"
                              >
                                <option value={1}>1 — {french ? 'pertinent' : 'relevant'}</option>
                                <option value={2}>2 — {french ? 'important' : 'important'}</option>
                                <option value={3}>3 — {french ? 'très important' : 'very important'}</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {prevention ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-red-800">
                                  <LockKeyhole className="h-3.5 w-3.5" />
                                  {french ? 'Non mesuré' : 'Unmeasured'}
                                </span>
                              ) : manual ? (
                                <span className="font-semibold text-amber-800">
                                  {french ? 'Partielle' : 'Partial'}
                                </span>
                              ) : (
                                <span className="text-ink-500">{french ? 'Questionnaire' : 'Questionnaire'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
                <label htmlFor="specialty-change-note" className="block text-sm font-semibold text-ink-800">
                  {french ? 'Justification du changement' : 'Change note'} <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="specialty-change-note"
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={french
                    ? 'Source clinique, hypothèse, référence ou raison opérationnelle…'
                    : 'Clinical source, hypothesis, reference, or operational reason…'}
                  disabled={busy !== null || (!portalProfile.can_edit && !portalProfile.can_publish)}
                  className="mt-2 w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink-500">
                    {french
                      ? 'Chaque action est attribuée au compte connecté et conservée dans l’historique.'
                      : 'Every action is attributed to the signed-in account and retained in history.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveDraft()}
                      disabled={!portalProfile.can_edit || !dirty || !catalogHasVersionLock || busy !== null}
                      className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {busy === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {french ? 'Enregistrer le brouillon' : 'Save draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void publishDraft()}
                      disabled={!portalProfile.can_publish || dirty || !draftReadyForPublication || busy !== null}
                      title={!portalProfile.can_publish
                        ? (french ? 'Réservé au Professor' : 'Professor only')
                        : undefined}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-300"
                    >
                      {busy === 'publishing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {french ? 'Publier la version' : 'Publish version'}
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-sm text-ink-500 shadow-soft">
              {french ? 'Aucune spécialité disponible.' : 'No specialty is available.'}
            </div>
          )}
        </article>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
        >
          <span className="flex items-center gap-3">
            <History className="h-5 w-5 text-brand-600" />
            <span>
              <span className="block font-semibold text-ink-900">
                {french ? 'Historique des versions' : 'Version history'}
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                {versions.length} {french ? 'version(s) chargée(s)' : 'version(s) loaded'}
              </span>
            </span>
          </span>
          <span className="text-sm font-semibold text-brand-700">
            {historyOpen ? (french ? 'Masquer' : 'Hide') : (french ? 'Afficher' : 'Show')}
          </span>
        </button>

        {historyOpen && (
          <div className="border-t border-ink-100">
            {historyError && (
              <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                {historyError}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">{french ? 'Version' : 'Version'}</th>
                    <th className="px-4 py-3 font-semibold">{french ? 'Statut' : 'Status'}</th>
                    <th className="px-4 py-3 font-semibold">{french ? 'Justification' : 'Change note'}</th>
                    <th className="px-4 py-3 font-semibold">{french ? 'Auteur' : 'Actor'}</th>
                    <th className="px-4 py-3 font-semibold">{french ? 'Date' : 'Date'}</th>
                    <th className="px-4 py-3 text-right font-semibold">{french ? 'Action' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {versions.map((version) => {
                    const active = version.id === activeVersionId
                      || ['active', 'published'].includes(version.status.toLowerCase());
                    return (
                      <tr key={version.id} className={active ? 'bg-emerald-50/50' : ''}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink-800">
                            {version.versionNumber === null ? shortId(version.id) : `v${version.versionNumber}`}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-ink-400">{shortId(version.id)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100 text-ink-600'
                          }`}>
                            {statusLabel(version.status, french)}
                          </span>
                        </td>
                        <td className="max-w-md px-4 py-3 text-ink-600">
                          <p className="line-clamp-3">{version.changeNote || '—'}</p>
                          {version.checksum && (
                            <p className="mt-1 font-mono text-[10px] text-ink-400">{version.checksum}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-600">{version.actor ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-ink-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDate(version.publishedAt ?? version.createdAt, french)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void restoreVersion(version)}
                            disabled={!portalProfile.can_publish || active || catalog.status.toLowerCase() === 'draft' || busy !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy === 'restoring' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {french ? 'Restaurer' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {versions.length === 0 && !historyError && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-ink-500">
                        {french ? 'Aucune version enregistrée.' : 'No saved version.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function VersionInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-sm font-semibold text-ink-800">{value}</p>
    </div>
  );
}
