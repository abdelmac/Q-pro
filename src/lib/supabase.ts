import { createClient } from '@supabase/supabase-js';
import { ALL_QUESTION_IDS } from '@/data/questions';
import { SPECIALTIES } from '@/data/specialties';
import { VALUE_OPTIONS } from '@/data/traits';
import { DATA_VERSIONS } from '@/lib/researchVersions';
import { isValidOptionalStudentStudyYear } from '@/lib/participantProfile';
import type { Database, Json } from '@/lib/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const supabaseLegacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabaseBrowserKey = supabasePublishableKey || supabaseLegacyAnonKey;

export { DATA_VERSIONS } from '@/lib/researchVersions';

export type SupportedLanguage = 'en' | 'ro' | 'fr';
export type WouldChooseAgainCode = 'yes' | 'no';
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

function localized(
  language: SupportedLanguage,
  messages: Record<SupportedLanguage, string>,
): string {
  return messages[language] ?? messages.en;
}

export function formatSupabaseError(
  error: SupabaseErrorLike,
  language: SupportedLanguage = 'en',
): string {
  const message = typeof error === 'string' ? error : error.message;
  const code = typeof error === 'string' ? undefined : error.code;

  if (
    code === 'PGRST202'
    || code === 'PGRST205'
    || message.includes('submit_student_response_v1')
    || message.includes('submit_specialist_response_v1')
    || message.includes('submit_student_response_v2')
    || message.includes('submit_specialist_response_v2')
    || message.includes('submit_student_response_v3')
    || message.includes('submit_student_response_v4')
    || message.includes('submit_specialist_response_v3')
    || message.includes('submit_specialist_response_v4')
  ) {
    return localized(language, {
      en: 'The Supabase database is not up to date. Deploy every migration in supabase/migrations.',
      ro: 'Baza de date Supabase nu este actualizată. Aplică toate migrările din supabase/migrations.',
      fr: 'La base Supabase n’est pas à jour. Déployez toutes les migrations du dossier supabase/migrations.',
    });
  }
  if (code === '22023' || message.includes('Invalid student') || message.includes('Invalid specialist')) {
    return localized(language, {
      en: 'The submitted data is incomplete or invalid. Check your answers and try again.',
      ro: 'Datele trimise sunt incomplete sau nevalide. Verifică răspunsurile și încearcă din nou.',
      fr: 'Les données envoyées sont incomplètes ou invalides. Vérifiez vos réponses puis réessayez.',
    });
  }
  if (code === '23505' && message.includes('Submission id')) {
    return localized(language, {
      en: 'This submission identifier was already used with different data. Reload the page and try again.',
      ro: 'Acest identificator de trimitere a fost deja folosit cu alte date. Reîncarcă pagina și încearcă din nou.',
      fr: 'Cette soumission a déjà été utilisée avec d’autres données. Rechargez la page puis réessayez.',
    });
  }
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return localized(language, {
      en: 'Supabase denied this operation. Check the RLS migration and the project publishable key.',
      ro: 'Supabase a refuzat această operațiune. Verifică migrarea RLS și cheia publică a proiectului.',
      fr: 'Supabase refuse cette opération. Vérifiez la migration RLS et la clé publique du projet.',
    });
  }
  return message;
}

export interface SpecialistResponse {
  submission_id: string;
  actual_specialty: string;
  ratings: Record<string, number>;
  selected_values: string[];
  questionnaire_completed: boolean;
  language: SupportedLanguage;
  current_specialty_view: string;
  specialty_changes_over_years: string;
  most_important_specialty_quality: string;
  would_choose_again_code: WouldChooseAgainCode;
  would_not_choose_again_reason?: string | null;
  student_self_question: string;
  specialty_config_version_id?: string | null;
}

export interface StudentResponse {
  submission_id: string;
  participant_role: 'student' | 'curious';
  medicine_view: string;
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
    return localized(language, {
      en: 'All 81 answers, rated from 1 to 10, are required.',
      ro: 'Toate cele 81 de răspunsuri, evaluate de la 1 la 10, sunt obligatorii.',
      fr: 'Les 81 réponses, notées de 1 à 10, sont obligatoires.',
    });
  }

  if (
    selectedValues.length < 1
    || selectedValues.length > 4
    || new Set(selectedValues).size !== selectedValues.length
    || selectedValues.some((value) => !valueOptions.has(value))
  ) {
    return localized(language, {
      en: 'Select between one and four valid values.',
      ro: 'Selectează între una și patru valori valide.',
      fr: 'Sélectionnez entre une et quatre valeurs valides.',
    });
  }

  if (!supportedLanguages.has(language)) {
    return localized(language, {
      en: 'The questionnaire language is invalid.',
      ro: 'Limba chestionarului nu este validă.',
      fr: 'La langue du questionnaire est invalide.',
    });
  }

  return null;
}

function validateSpecialistResponse(data: SpecialistResponse): string | null {
  if (!supportedLanguages.has(data.language)) return localized(data.language, {
    en: 'The questionnaire language is invalid.',
    ro: 'Limba chestionarului nu este validă.',
    fr: 'La langue du questionnaire est invalide.',
  });
  if (typeof data.questionnaire_completed !== 'boolean') {
    return localized(data.language, {
      en: 'The specialist questionnaire status is invalid.',
      ro: 'Starea chestionarului pentru specialist nu este validă.',
      fr: 'Le statut du questionnaire spécialiste est invalide.',
    });
  }
  if (data.questionnaire_completed) {
    const sharedError = validateSharedResponse(data.ratings, data.selected_values, data.language);
    if (sharedError) return sharedError;
  } else if (Object.keys(data.ratings).length !== 0 || data.selected_values.length !== 0) {
    return localized(data.language, {
      en: 'A skipped questionnaire cannot contain partial answers.',
      ro: 'Un chestionar omis nu poate conține răspunsuri parțiale.',
      fr: 'Un questionnaire passé ne peut pas contenir de réponses partielles.',
    });
  }
  if (!specialtyNames.has(data.actual_specialty)) return localized(data.language, {
    en: 'The selected specialty is invalid.',
    ro: 'Specialitatea selectată nu este validă.',
    fr: 'La spécialité sélectionnée est invalide.',
  });
  const validText = (value: string, maximum: number) => {
    const length = value.trim().length;
    return length >= 3 && length <= maximum;
  };
  if (!validText(data.current_specialty_view, 2000)
      || !validText(data.specialty_changes_over_years, 2000)
      || !validText(data.most_important_specialty_quality, 2000)
      || !validText(data.student_self_question, 1000)) {
    return localized(data.language, {
      en: 'All qualitative answers are required and must stay within the maximum length.',
      ro: 'Toate răspunsurile calitative sunt obligatorii și trebuie să respecte lungimea maximă.',
      fr: 'Toutes les réponses qualitatives sont obligatoires et doivent respecter la longueur maximale.',
    });
  }
  if (data.would_choose_again_code !== 'yes' && data.would_choose_again_code !== 'no') {
    return localized(data.language, {
      en: 'Indicate whether you would choose this specialty again.',
      ro: 'Indică dacă ai alege din nou această specialitate.',
      fr: 'Indiquez si vous choisiriez à nouveau cette spécialité.',
    });
  }
  if (data.would_choose_again_code === 'no') {
    if (!data.would_not_choose_again_reason || !validText(data.would_not_choose_again_reason, 2000)) {
      return localized(data.language, {
        en: 'Explain why you would not choose this specialty again.',
        ro: 'Explică de ce nu ai alege din nou această specialitate.',
        fr: 'Expliquez pourquoi vous ne choisiriez pas à nouveau cette spécialité.',
      });
    }
  } else if (data.would_not_choose_again_reason != null) {
    return localized(data.language, {
      en: 'The reason must be empty when the answer is yes.',
      ro: 'Motivul trebuie să rămână gol când răspunsul este da.',
      fr: 'La raison doit être vide lorsque la réponse est oui.',
    });
  }
  if (!data.specialty_config_version_id) return localized(data.language, {
    en: 'A published catalog version is required.',
    ro: 'Este necesară o versiune publicată a catalogului.',
    fr: 'La version publiée du catalogue est obligatoire.',
  });
  return null;
}

function validateStudentResponse(data: StudentResponse): string | null {
  const sharedError = validateSharedResponse(data.ratings, data.selected_values, data.language);
  if (sharedError) return sharedError;
  if (data.participant_role !== 'student' && data.participant_role !== 'curious') {
    return localized(data.language, {
      en: 'The participant type is invalid.',
      ro: 'Tipul de participant nu este valid.',
      fr: 'Le type de participant est invalide.',
    });
  }
  const medicineViewLength = data.medicine_view.trim().length;
  if (medicineViewLength < 3 || medicineViewLength > 2000) {
    return localized(data.language, {
      en: 'Your answer about medicine must contain between 3 and 2,000 characters.',
      ro: 'Răspunsul despre medicină trebuie să conțină între 3 și 2.000 de caractere.',
      fr: 'Votre réponse sur la médecine doit contenir entre 3 et 2 000 caractères.',
    });
  }
  if (data.participant_role === 'curious' && data.study_year != null) {
    return localized(data.language, {
      en: 'A study year can only be recorded for a medical student.',
      ro: 'Anul de studiu poate fi înregistrat numai pentru un student la medicină.',
      fr: 'Une année d’étude ne peut être enregistrée que pour un étudiant en médecine.',
    });
  }
  if (data.preferred_specialty != null && !specialtyNames.has(data.preferred_specialty)) {
    return localized(data.language, {
      en: 'The preferred specialty is invalid.',
      ro: 'Specialitatea preferată nu este validă.',
      fr: 'La spécialité préférée est invalide.',
    });
  }
  if (!isValidOptionalStudentStudyYear(data.study_year)) {
    return localized(data.language, {
      en: 'The study year must be between 1 and 6.',
      ro: 'Anul de studiu trebuie să fie între 1 și 6.',
      fr: 'L’année d’étude doit être comprise entre 1 et 6.',
    });
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
    return localized(data.language, {
      en: 'The specialty ranking is incomplete or invalid.',
      ro: 'Clasamentul specialităților este incomplet sau nevalid.',
      fr: 'Le classement des spécialités est incomplet ou invalide.',
    });
  }
  if (!data.specialty_config_version_id) return localized(data.language, {
    en: 'A published catalog version is required.',
    ro: 'Este necesară o versiune publicată a catalogului.',
    fr: 'La version publiée du catalogue est obligatoire.',
  });
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
    p_questionnaire_completed: data.questionnaire_completed,
    p_language: data.language,
    p_current_specialty_view: data.current_specialty_view.trim(),
    p_specialty_changes_over_years: data.specialty_changes_over_years.trim(),
    p_most_important_specialty_quality: data.most_important_specialty_quality.trim(),
    p_would_choose_again_code: data.would_choose_again_code,
    p_would_not_choose_again_reason: data.would_choose_again_code === 'no'
      ? data.would_not_choose_again_reason?.trim() ?? null
      : null,
    p_student_self_question: data.student_self_question.trim(),
    p_questionnaire_version: DATA_VERSIONS.questionnaire,
    p_value_catalog_version: DATA_VERSIONS.valueCatalog,
    p_specialty_catalog_version: DATA_VERSIONS.specialtyCatalog,
    p_calibration_version: DATA_VERSIONS.calibration,
    p_consent_version: DATA_VERSIONS.consent,
  };
  const { data: responseId, error } = await supabase.rpc(
    'submit_specialist_response_v4',
    asPostgresRoutineArgs<Database['public']['Functions']['submit_specialist_response_v4']['Args']>({
      ...rpcArguments,
      p_specialty_config_version_id: data.specialty_config_version_id,
    }),
  );

  return error
    ? { success: false, error: formatSupabaseError(error, data.language) }
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
    p_participant_role: data.participant_role,
    p_medicine_view: data.medicine_view.trim(),
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
    p_consent_version: DATA_VERSIONS.studentConsent,
    p_participant_reflection_version: DATA_VERSIONS.participantReflection,
  };
  const { data: responseId, error } = await supabase.rpc(
    'submit_student_response_v4',
    asPostgresRoutineArgs<Database['public']['Functions']['submit_student_response_v4']['Args']>({
      ...rpcArguments,
      p_specialty_config_version_id: data.specialty_config_version_id,
    }),
  );

  return error
    ? { success: false, error: formatSupabaseError(error, data.language) }
    : { success: true, id: responseId };
}
