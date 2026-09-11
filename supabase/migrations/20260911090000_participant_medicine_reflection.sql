BEGIN;

/*
 * Student and medicine-explorer submissions share the same quantitative
 * questionnaire, but they are distinct research populations. Store the role
 * explicitly so an explorer can never be counted silently as a student.
 *
 * Historical rows came exclusively from the student flow. The default and
 * backfill therefore preserve their known meaning without inventing a new
 * classification. The reflection fields remain nullable for schema 0-2 rows;
 * schema 3 submissions must contain a versioned, non-empty reflection.
 */
ALTER TABLE public.student_responses
  ADD COLUMN participant_role text NOT NULL DEFAULT 'student',
  ADD COLUMN medicine_view text,
  ADD COLUMN participant_reflection_version text;

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_participant_role_check
  CHECK (participant_role IN ('student', 'curious'));

CREATE INDEX student_responses_participant_role_created_at_idx
  ON public.student_responses (participant_role, created_at DESC);

COMMENT ON COLUMN public.student_responses.participant_role IS
  'Canonical participant population: student or curious. Historical rows are student because the former explorer flow did not submit research data.';
COMMENT ON COLUMN public.student_responses.medicine_view IS
  'Optional for historical rows; required trimmed 3-2000 character response to the medicine-perception prompt for schema 3 submissions.';
COMMENT ON COLUMN public.student_responses.participant_reflection_version IS
  'Version of the qualitative medicine-perception prompt and collection protocol.';

/*
 * Replace the schema-2 payload constraint. Its first three branches reproduce
 * the previous contract and also pin the new fields to their historical
 * defaults. The schema-3 branch adds population separation and qualitative
 * reflection validation without changing the specialist schema.
 */
ALTER TABLE public.student_responses
  DROP CONSTRAINT IF EXISTS student_responses_payload_v2_check;

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_payload_v3_check
  CHECK (
    (
      submission_schema_version = 0
      AND participant_role = 'student'
      AND medicine_view IS NULL
      AND participant_reflection_version IS NULL
    )
    OR (
      submission_schema_version = 1
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v1'
      AND consent_version = 'research-consent-2026-08-26'
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 12)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_role = 'student'
      AND medicine_view IS NULL
      AND participant_reflection_version IS NULL
    )
    OR (
      submission_schema_version = 2
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v2'
      AND consent_version = 'research-consent-2026-09-04'
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 12)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_role = 'student'
      AND medicine_view IS NULL
      AND participant_reflection_version IS NULL
    )
    OR (
      submission_schema_version = 3
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v2'
      AND consent_version = 'research-consent-2026-09-11'
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND participant_role IN ('student', 'curious')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 6)
      AND (participant_role = 'student' OR study_year IS NULL)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_reflection_version IS NOT NULL
      AND participant_reflection_version = 'medicine-view-v1'
      AND medicine_view IS NOT NULL
      AND medicine_view = regexp_replace(
        medicine_view,
        '^[[:space:]]+|[[:space:]]+$',
        '',
        'g'
      )
      AND char_length(medicine_view) BETWEEN 3 AND 2000
      AND octet_length(medicine_view) <= 8000
    )
  ) NOT VALID;

ALTER TABLE public.student_responses
  VALIDATE CONSTRAINT student_responses_payload_v3_check;

CREATE OR REPLACE FUNCTION private.submit_student_response_v4(
  p_submission_id uuid,
  p_participant_role text,
  p_medicine_view text,
  p_study_year integer,
  p_preferred_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_client_scores jsonb,
  p_language text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_scoring_version text,
  p_consent_version text,
  p_participant_reflection_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
  resolved_revision bigint;
  normalized_medicine_view text;
BEGIN
  normalized_medicine_view := regexp_replace(
    p_medicine_view,
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );

  IF p_submission_id IS NULL
     OR p_participant_role IS NULL
     OR p_participant_role NOT IN ('student', 'curious')
     OR normalized_medicine_view IS NULL
     OR char_length(normalized_medicine_view) NOT BETWEEN 3 AND 2000
     OR octet_length(normalized_medicine_view) > 8000
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_scoring_version IS DISTINCT FROM 'client-scoring-v2'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-09-11'
     OR p_participant_reflection_version IS DISTINCT FROM 'medicine-view-v1'
     OR private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
     OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
     OR private.valid_client_scores_v1(p_client_scores) IS NOT TRUE
     OR p_language IS NULL
     OR p_language NOT IN ('en', 'ro', 'fr')
     OR (p_study_year IS NOT NULL AND p_study_year NOT BETWEEN 1 AND 6)
     OR (p_participant_role = 'curious' AND p_study_year IS NOT NULL)
     OR (
       p_preferred_specialty IS NOT NULL
       AND private.valid_specialty_v1(p_preferred_specialty) IS NOT TRUE
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid participant research submission';
  END IF;

  IF p_specialty_config_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A specialty catalog version id is required';
  END IF;

  resolved_revision := private.resolve_published_specialty_config_revision(
    p_specialty_config_version_id
  );

  INSERT INTO public.student_responses (
    id,
    participant_role,
    medicine_view,
    participant_reflection_version,
    study_year,
    preferred_specialty,
    ratings,
    selected_values,
    client_scores,
    language,
    submission_schema_version,
    questionnaire_version,
    value_catalog_version,
    specialty_catalog_version,
    scoring_version,
    consent_version,
    specialty_config_version_id,
    specialty_config_revision
  ) VALUES (
    p_submission_id,
    p_participant_role,
    normalized_medicine_view,
    'medicine-view-v1',
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    3,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v2',
    'research-consent-2026-09-11',
    p_specialty_config_version_id,
    resolved_revision
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT response.id INTO inserted_id
    FROM public.student_responses AS response
    WHERE response.id = p_submission_id
      AND response.participant_role = p_participant_role
      AND response.medicine_view = normalized_medicine_view
      AND response.participant_reflection_version = 'medicine-view-v1'
      AND response.study_year IS NOT DISTINCT FROM p_study_year
      AND response.preferred_specialty IS NOT DISTINCT FROM p_preferred_specialty
      AND response.ratings = p_ratings
      AND response.selected_values = p_selected_values
      AND response.client_scores = p_client_scores
      AND response.language = p_language
      AND response.submission_schema_version = 3
      AND response.questionnaire_version = 'q81-v1'
      AND response.value_catalog_version = 'career-values-v1'
      AND response.specialty_catalog_version = 'medical-specialties-v1'
      AND response.scoring_version = 'client-scoring-v2'
      AND response.consent_version = 'research-consent-2026-09-11'
      AND response.specialty_config_version_id = p_specialty_config_version_id
      AND response.specialty_config_revision = resolved_revision;

    IF inserted_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with a different payload';
    END IF;
  END IF;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_student_response_v4(
  p_submission_id uuid,
  p_participant_role text,
  p_medicine_view text,
  p_study_year integer,
  p_preferred_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_client_scores jsonb,
  p_language text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_scoring_version text,
  p_consent_version text,
  p_participant_reflection_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_student_response_v4(
    p_submission_id,
    p_participant_role,
    p_medicine_view,
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_scoring_version,
    p_consent_version,
    p_participant_reflection_version,
    p_specialty_config_version_id
  );
$$;

REVOKE ALL ON FUNCTION private.submit_student_response_v4(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_student_response_v4(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_student_response_v4(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_student_response_v4(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid
) IS
  'Validated idempotent schema-3 submission for medical students and medicine explorers, including the versioned qualitative medicine-view prompt.';

COMMENT ON FUNCTION private.submit_student_response_v4(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid
) IS
  'Private validated writer for schema-3 student and medicine-explorer research submissions.';

NOTIFY pgrst, 'reload schema';

COMMIT;
