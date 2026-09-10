BEGIN;

/*
 * Specialists may now deliberately omit the personality questionnaire while
 * still submitting the qualitative specialty interview. Keep the JSON columns
 * non-null and record the choice explicitly so that an intentional omission
 * can never be confused with an incomplete or malformed questionnaire.
 */
ALTER TABLE public.specialist_responses
  ADD COLUMN IF NOT EXISTS questionnaire_completed boolean;

UPDATE public.specialist_responses
SET questionnaire_completed = true
WHERE questionnaire_completed IS NULL;

ALTER TABLE public.specialist_responses
  ALTER COLUMN questionnaire_completed SET DEFAULT true,
  ALTER COLUMN questionnaire_completed SET NOT NULL;

COMMENT ON COLUMN public.specialist_responses.questionnaire_completed IS
  'True only when ratings contains the complete q81-v1 payload and selected_values contains 1-4 values; false records an intentional skip using {} and [].';

/*
 * Preserve schema 0/1 compatibility. Schema 2 now records the optional
 * questionnaire state explicitly while retaining the same qualitative
 * protocol and version identifiers used by existing schema-2 rows.
 */
ALTER TABLE public.specialist_responses
  DROP CONSTRAINT IF EXISTS specialist_responses_payload_v2_check;

ALTER TABLE public.specialist_responses
  ADD CONSTRAINT specialist_responses_payload_v2_check
  CHECK (
    submission_schema_version = 0
    OR (
      submission_schema_version = 1
      AND questionnaire_completed
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND calibration_version = 'calibration-v1'
      AND consent_version = 'research-consent-2026-08-26'
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_specialty_v1(actual_specialty)
      AND language IN ('en', 'ro', 'fr')
      AND (years_of_experience IS NULL OR years_of_experience BETWEEN 0 AND 60)
      AND (career_satisfaction IS NULL OR career_satisfaction BETWEEN 1 AND 5)
      AND (
        would_choose_again_code IS NULL
        OR would_choose_again_code IN ('yes', 'no', 'unsure')
      )
      AND (
        intention_to_change_code IS NULL
        OR intention_to_change_code IN (
          'definitely', 'probably', 'probably_not', 'definitely_not'
        )
      )
      AND (
        voluntary_choice_code IS NULL
        OR voluntary_choice_code IN (
          'fully_voluntary', 'somewhat_voluntary', 'not_voluntary'
        )
      )
      AND current_specialty_view IS NULL
      AND specialty_changes_over_years IS NULL
      AND most_important_specialty_quality IS NULL
      AND would_not_choose_again_reason IS NULL
      AND student_self_question IS NULL
    )
    OR (
      submission_schema_version = 2
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND calibration_version = 'calibration-v2-qualitative'
      AND consent_version = 'research-consent-2026-09-04'
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND (
        (
          questionnaire_completed
          AND private.valid_ratings_q81_v1(ratings)
          AND private.valid_selected_values_v1(selected_values)
        )
        OR (
          NOT questionnaire_completed
          AND ratings = '{}'::jsonb
          AND selected_values = '[]'::jsonb
        )
      )
      AND private.valid_specialty_v1(actual_specialty)
      AND language IN ('en', 'ro', 'fr')
      AND years_of_experience IS NULL
      AND career_satisfaction IS NULL
      AND would_choose_again IS NULL
      AND intention_to_change IS NULL
      AND voluntary_choice IS NULL
      AND intention_to_change_code IS NULL
      AND voluntary_choice_code IS NULL
      AND would_choose_again_code IS NOT NULL
      AND would_choose_again_code IN ('yes', 'no')
      AND current_specialty_view IS NOT NULL
      AND current_specialty_view = btrim(current_specialty_view)
      AND char_length(current_specialty_view) BETWEEN 3 AND 2000
      AND specialty_changes_over_years IS NOT NULL
      AND specialty_changes_over_years = btrim(specialty_changes_over_years)
      AND char_length(specialty_changes_over_years) BETWEEN 3 AND 2000
      AND most_important_specialty_quality IS NOT NULL
      AND most_important_specialty_quality = btrim(most_important_specialty_quality)
      AND char_length(most_important_specialty_quality) BETWEEN 3 AND 2000
      AND student_self_question IS NOT NULL
      AND student_self_question = btrim(student_self_question)
      AND char_length(student_self_question) BETWEEN 3 AND 1000
      AND (
        (
          would_choose_again_code = 'yes'
          AND would_not_choose_again_reason IS NULL
        )
        OR (
          would_choose_again_code = 'no'
          AND would_not_choose_again_reason IS NOT NULL
          AND would_not_choose_again_reason = btrim(would_not_choose_again_reason)
          AND char_length(would_not_choose_again_reason) BETWEEN 3 AND 2000
        )
      )
    )
  ) NOT VALID;

ALTER TABLE public.specialist_responses
  VALIDATE CONSTRAINT specialist_responses_payload_v2_check;

CREATE OR REPLACE FUNCTION private.submit_specialist_response_v4(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_questionnaire_completed boolean,
  p_language text,
  p_current_specialty_view text,
  p_specialty_changes_over_years text,
  p_most_important_specialty_quality text,
  p_would_choose_again_code text,
  p_would_not_choose_again_reason text,
  p_student_self_question text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text,
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
  normalized_current_specialty_view text;
  normalized_specialty_changes_over_years text;
  normalized_most_important_specialty_quality text;
  normalized_would_not_choose_again_reason text;
  normalized_student_self_question text;
BEGIN
  normalized_current_specialty_view := btrim(p_current_specialty_view);
  normalized_specialty_changes_over_years := btrim(p_specialty_changes_over_years);
  normalized_most_important_specialty_quality := btrim(p_most_important_specialty_quality);
  normalized_would_not_choose_again_reason := nullif(btrim(p_would_not_choose_again_reason), '');
  normalized_student_self_question := btrim(p_student_self_question);

  IF p_submission_id IS NULL
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_calibration_version IS DISTINCT FROM 'calibration-v2-qualitative'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-09-04'
     OR p_questionnaire_completed IS NULL
     OR (
       p_questionnaire_completed
       AND (
         private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
         OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
       )
     )
     OR (
       NOT p_questionnaire_completed
       AND (
         p_ratings IS DISTINCT FROM '{}'::jsonb
         OR p_selected_values IS DISTINCT FROM '[]'::jsonb
       )
     )
     OR private.valid_specialty_v1(p_actual_specialty) IS NOT TRUE
     OR p_language IS NULL
     OR p_language NOT IN ('en', 'ro', 'fr')
     OR normalized_current_specialty_view IS NULL
     OR char_length(normalized_current_specialty_view) NOT BETWEEN 3 AND 2000
     OR normalized_specialty_changes_over_years IS NULL
     OR char_length(normalized_specialty_changes_over_years) NOT BETWEEN 3 AND 2000
     OR normalized_most_important_specialty_quality IS NULL
     OR char_length(normalized_most_important_specialty_quality) NOT BETWEEN 3 AND 2000
     OR normalized_student_self_question IS NULL
     OR char_length(normalized_student_self_question) NOT BETWEEN 3 AND 1000
     OR p_would_choose_again_code IS NULL
     OR p_would_choose_again_code NOT IN ('yes', 'no')
     OR (
       p_would_choose_again_code = 'yes'
       AND normalized_would_not_choose_again_reason IS NOT NULL
     )
     OR (
       p_would_choose_again_code = 'no'
       AND (
         normalized_would_not_choose_again_reason IS NULL
         OR char_length(normalized_would_not_choose_again_reason) NOT BETWEEN 3 AND 2000
       )
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid specialist research submission';
  END IF;

  IF p_specialty_config_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A specialty catalog version id is required';
  END IF;

  resolved_revision := private.resolve_published_specialty_config_revision(
    p_specialty_config_version_id
  );

  INSERT INTO public.specialist_responses (
    id,
    actual_specialty,
    ratings,
    selected_values,
    questionnaire_completed,
    language,
    years_of_experience,
    career_satisfaction,
    would_choose_again,
    intention_to_change,
    voluntary_choice,
    would_choose_again_code,
    intention_to_change_code,
    voluntary_choice_code,
    current_specialty_view,
    specialty_changes_over_years,
    most_important_specialty_quality,
    would_not_choose_again_reason,
    student_self_question,
    submission_schema_version,
    questionnaire_version,
    value_catalog_version,
    specialty_catalog_version,
    calibration_version,
    consent_version,
    specialty_config_version_id,
    specialty_config_revision
  ) VALUES (
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_questionnaire_completed,
    p_language,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p_would_choose_again_code,
    NULL,
    NULL,
    normalized_current_specialty_view,
    normalized_specialty_changes_over_years,
    normalized_most_important_specialty_quality,
    CASE
      WHEN p_would_choose_again_code = 'no'
        THEN normalized_would_not_choose_again_reason
      ELSE NULL
    END,
    normalized_student_self_question,
    2,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v2-qualitative',
    'research-consent-2026-09-04',
    p_specialty_config_version_id,
    resolved_revision
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT response.id INTO inserted_id
    FROM public.specialist_responses AS response
    WHERE response.id = p_submission_id
      AND response.actual_specialty = p_actual_specialty
      AND response.ratings = p_ratings
      AND response.selected_values = p_selected_values
      AND response.questionnaire_completed = p_questionnaire_completed
      AND response.language = p_language
      AND response.years_of_experience IS NULL
      AND response.career_satisfaction IS NULL
      AND response.would_choose_again IS NULL
      AND response.intention_to_change IS NULL
      AND response.voluntary_choice IS NULL
      AND response.would_choose_again_code = p_would_choose_again_code
      AND response.intention_to_change_code IS NULL
      AND response.voluntary_choice_code IS NULL
      AND response.current_specialty_view = normalized_current_specialty_view
      AND response.specialty_changes_over_years = normalized_specialty_changes_over_years
      AND response.most_important_specialty_quality = normalized_most_important_specialty_quality
      AND response.would_not_choose_again_reason IS NOT DISTINCT FROM CASE
        WHEN p_would_choose_again_code = 'no'
          THEN normalized_would_not_choose_again_reason
        ELSE NULL
      END
      AND response.student_self_question = normalized_student_self_question
      AND response.submission_schema_version = 2
      AND response.questionnaire_version = 'q81-v1'
      AND response.value_catalog_version = 'career-values-v1'
      AND response.specialty_catalog_version = 'medical-specialties-v1'
      AND response.calibration_version = 'calibration-v2-qualitative'
      AND response.consent_version = 'research-consent-2026-09-04'
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

CREATE OR REPLACE FUNCTION public.submit_specialist_response_v4(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_questionnaire_completed boolean,
  p_language text,
  p_current_specialty_view text,
  p_specialty_changes_over_years text,
  p_most_important_specialty_quality text,
  p_would_choose_again_code text,
  p_would_not_choose_again_reason text,
  p_student_self_question text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_specialist_response_v4(
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_questionnaire_completed,
    p_language,
    p_current_specialty_view,
    p_specialty_changes_over_years,
    p_most_important_specialty_quality,
    p_would_choose_again_code,
    p_would_not_choose_again_reason,
    p_student_self_question,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_calibration_version,
    p_consent_version,
    p_specialty_config_version_id
  );
$$;

REVOKE ALL ON FUNCTION private.submit_specialist_response_v4(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_specialist_response_v4(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_specialist_response_v4(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_specialist_response_v4(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) IS
  'Validated schema-2 specialist ingestion endpoint. The q81 payload is complete or explicitly skipped; qualitative answers and published-catalog provenance remain mandatory.';

NOTIFY pgrst, 'reload schema';

COMMIT;
