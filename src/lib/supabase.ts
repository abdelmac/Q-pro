import { createClient } from '@supabase/supabase-js';
import { ALL_QUESTION_IDS } from '@/data/questions';
import { SPECIALTIES } from '@/data/specialties';
import { VALUE_OPTIONS } from '@/data/traits';
import { DATA_VERSIONS } from '@/lib/researchVersions';
import type { Database, Json } from '@/lib/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const supabaseLegacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabaseBrowserKey = supabasePublishableKey || supabaseLegacyAnonKey;

export { DATA_VERSIONS } from '@/lib/researchVersions';

export type SupportedLanguage = 'en' | 'ro' | 'fr';
export type WouldChooseAgainCode = 'yes' | 'no' | 'unsure';
export type IntentionToChangeCode =
  | 'definitely'
  | 'probably'
  | 'probably_not'
  | 'definitely_not';
export type VoluntaryChoiceCode =
  | 'fully_voluntary'
  | 'somewhat_voluntary'
  | 'not_voluntary';

function validateSupabaseConfiguration(): string | null {
  if (!supabaseUrl && !supabaseBrowserKey) {
    return 'Supabase is not configured for this deployment.';
  }
  if (!supabaseUrl || !supabaseBrowserKey) {
    return 'Supabase configuration is incomplete.';
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const isLocalhost = parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === 'localhost';
    const isAllowedProtocol = parsedUrl.protocol === 'https:' || (isLocalhost && parsedUrl.protocol === 'http:');
    if (!isAllowedProtocol) {
      return 'Supabase URL must use HTTPS outside local development.';
    }
  } catch {
    return 'Supabase URL is invalid.';
  }

  return null;
}

const supabaseConfigurationError = validateSupabaseConfiguration();

export const supabase = !supabaseConfigurationError && supabaseUrl && supabaseBrowserKey
  ? createClient<Database>(supabaseUrl, supabaseBrowserKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function getSupabaseConfigurationError(): string | null {
  return supabaseConfigurationError;
}

type SupabaseErrorLike = string | { code?: string; message: string };

export function formatSupabaseError(error: SupabaseErrorLike): string {
  const message = typeof error === 'string' ? error : error.message;
  const code = typeof error === 'string' ? undefined : error.code;

  if (
    code === 'PGRST202'
    || code === 'PGRST205'
    || message.includes('submit_student_response_v1')
    || message.includes('submit_specialist_response_v1')
    || message.includes('submit_student_response_v2')
    || message.includes('submit_specialist_response_v2')
  ) {
    return 'La base Supabase n’est pas à jour. Déployez toutes les migrations du dossier supabase/migrations.';
  }
  if (code === '22023' || message.includes('Invalid student') || message.includes('Invalid specialist')) {
    return 'Les réponses sont incomplètes ou invalides. Vérifiez les 81 notes puis réessayez.';
  }
  if (code === '23505' && message.includes('Submission id')) {
    return 'Cette soumission a déjà été utilisée avec d’autres données. Rechargez la page puis réessayez.';
  }
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return 'Supabase refuse cette opération. Vérifiez la migration RLS et la clé publique du projet.';
  }
  return message;
}

export interface SpecialistResponse {
  submission_id: string;
  actual_specialty: string;
  ratings: Record<string, number>;
  selected_values: string[];
  language: SupportedLanguage;
  years_of_experience?: number | null;
  career_satisfaction?: number | null;
  would_choose_again_code?: WouldChooseAgainCode | null;
  intention_to_change_code?: IntentionToChangeCode | null;
  voluntary_choice_code?: VoluntaryChoiceCode | null;
  specialty_config_version_id?: string | null;
}

export interface StudentResponse {
  submission_id: string;
  study_year?: number | null;
  preferred_specialty: string | null;
  ratings: Record<string, number>;
  selected_values: string[];
  client_scores: Array<{ specialty: string; score: number }>;
  language: SupportedLanguage;
  specialty_config_version_id?: string | null;
}

export interface SubmissionResult {
  success: boolean;
  id?: string;
  error?: string;
}

const questionIds = new Set(ALL_QUESTION_IDS);
const valueOptions = new Set(VALUE_OPTIONS);
const specialtyNames = new Set(SPECIALTIES.map((specialty) => specialty.name));
const supportedLanguages = new Set<SupportedLanguage>(['en', 'ro', 'fr']);

// PostgreSQL routine arguments accept SQL NULL, but generated Supabase types
// expose only each argument's base scalar type. Keep that limitation isolated
// at the RPC boundary; the database functions validate every nullable field.
function asPostgresRoutineArgs<T>(value: unknown): T {
  return value as T;
}

function validateSharedResponse(
  ratings: Record<string, number>,
  selectedValues: string[],
  language: SupportedLanguage,
): string | null {
  const ratingEntries = Object.entries(ratings);
  if (
    ratingEntries.length !== ALL_QUESTION_IDS.length
    || ratingEntries.some(([id, value]) => (
      !questionIds.has(id) || !Number.isInteger(value) || value < 1 || value > 10
    ))
  ) {
    return 'Les 81 réponses, notées de 1 à 10, sont obligatoires.';
  }

  if (
    selectedValues.length < 1
    || selectedValues.length > 4
    || new Set(selectedValues).size !== selectedValues.length
    || selectedValues.some((value) => !valueOptions.has(value))
  ) {
    return 'Sélectionnez entre une et quatre valeurs valides.';
  }

  if (!supportedLanguages.has(language)) {
    return 'La langue du questionnaire est invalide.';
  }

  return null;
}

function validateSpecialistResponse(data: SpecialistResponse): string | null {
  const sharedError = validateSharedResponse(data.ratings, data.selected_values, data.language);
  if (sharedError) return sharedError;
  if (!specialtyNames.has(data.actual_specialty)) return 'La spécialité sélectionnée est invalide.';
  if (
    data.years_of_experience != null
    && (!Number.isInteger(data.years_of_experience) || data.years_of_experience < 0 || data.years_of_experience > 60)
  ) {
    return 'Le nombre d’années d’expérience doit être compris entre 0 et 60.';
  }
  if (
    data.career_satisfaction != null
    && (!Number.isInteger(data.career_satisfaction) || data.career_satisfaction < 1 || data.career_satisfaction > 5)
  ) {
    return 'La satisfaction professionnelle doit être comprise entre 1 et 5.';
  }
  return null;
}

function validateStudentResponse(data: StudentResponse): string | null {
  const sharedError = validateSharedResponse(data.ratings, data.selected_values, data.language);
  if (sharedError) return sharedError;
  if (data.preferred_specialty != null && !specialtyNames.has(data.preferred_specialty)) {
    return 'La spécialité préférée est invalide.';
  }
  if (
    data.study_year != null
    && (!Number.isInteger(data.study_year) || data.study_year < 1 || data.study_year > 12)
  ) {
    return 'L’année d’étude doit être comprise entre 1 et 12.';
  }
  if (
    data.client_scores.length !== SPECIALTIES.length
    || new Set(data.client_scores.map(({ specialty }) => specialty)).size !== SPECIALTIES.length
    || data.client_scores.some(({ specialty, score }, index) => (
      !specialtyNames.has(specialty)
      || !Number.isFinite(score)
      || score < 0
      || score > 100
      || (index > 0 && score > data.client_scores[index - 1].score)
    ))
  ) {
    return 'Le classement des spécialités est incomplet ou invalide.';
  }
  return null;
}

export async function submitSpecialistResponse(data: SpecialistResponse): Promise<SubmissionResult> {
  const configurationError = getSupabaseConfigurationError();
  if (!supabase || configurationError) {
    return { success: false, error: configurationError ?? 'Supabase is unavailable.' };
  }

  const validationError = validateSpecialistResponse(data);
  if (validationError) return { success: false, error: validationError };

  const rpcArguments = {
    p_submission_id: data.submission_id,
    p_actual_specialty: data.actual_specialty,
    p_ratings: data.ratings as Json,
    p_selected_values: data.selected_values as Json,
    p_language: data.language,
    p_years_of_experience: data.years_of_experience ?? null,
    p_career_satisfaction: data.career_satisfaction ?? null,
    p_would_choose_again_code: data.would_choose_again_code ?? null,
    p_intention_to_change_code: data.intention_to_change_code ?? null,
    p_voluntary_choice_code: data.voluntary_choice_code ?? null,
    p_questionnaire_version: DATA_VERSIONS.questionnaire,
    p_value_catalog_version: DATA_VERSIONS.valueCatalog,
    p_specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
    p_calibration_version: DATA_VERSIONS.calibration,
    p_consent_version: DATA_VERSIONS.consent,
  };
  const { data: responseId, error } = data.specialty_config_version_id
    ? await supabase.rpc(
        'submit_specialist_response_v2',
        asPostgresRoutineArgs<Database['public']['Functions']['submit_specialist_response_v2']['Args']>({
          ...rpcArguments,
          p_specialty_config_version_id: data.specialty_config_version_id,
        }),
      )
    : await supabase.rpc(
        'submit_specialist_response_v1',
        asPostgresRoutineArgs<Database['public']['Functions']['submit_specialist_response_v1']['Args']>(rpcArguments),
      );

  return error
    ? { success: false, error: formatSupabaseError(error) }
    : { success: true, id: responseId };
}

export async function submitStudentResponse(data: StudentResponse): Promise<SubmissionResult> {
  const configurationError = getSupabaseConfigurationError();
  if (!supabase || configurationError) {
    return { success: false, error: configurationError ?? 'Supabase is unavailable.' };
  }

  const validationError = validateStudentResponse(data);
  if (validationError) return { success: false, error: validationError };

  const rpcArguments = {
    p_submission_id: data.submission_id,
    p_study_year: data.study_year ?? null,
    p_preferred_specialty: data.preferred_specialty,
    p_ratings: data.ratings as Json,
    p_selected_values: data.selected_values as Json,
    p_client_scores: data.client_scores as Json,
    p_language: data.language,
    p_questionnaire_version: DATA_VERSIONS.questionnaire,
    p_value_catalog_version: DATA_VERSIONS.valueCatalog,
    p_specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
    p_scoring_version: DATA_VERSIONS.scoring,
    p_consent_version: DATA_VERSIONS.consent,
  };
  const { data: responseId, error } = data.specialty_config_version_id
    ? await supabase.rpc(
        'submit_student_response_v2',
        asPostgresRoutineArgs<Database['public']['Functions']['submit_student_response_v2']['Args']>({
          ...rpcArguments,
          p_specialty_config_version_id: data.specialty_config_version_id,
        }),
      )
    : await supabase.rpc(
        'submit_student_response_v1',
        asPostgresRoutineArgs<Database['public']['Functions']['submit_student_response_v1']['Args']>(rpcArguments),
      );

  return error
    ? { success: false, error: formatSupabaseError(error) }
    : { success: true, id: responseId };
}
