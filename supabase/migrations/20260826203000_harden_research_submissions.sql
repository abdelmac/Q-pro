BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

COMMENT ON SCHEMA private IS
  'Non-exposed helpers and researcher authorization data for Q Project.';

/*
 * Preserve old rows without pretending that their questionnaire, scoring, or
 * consent version is known. New rows use schema version 1 and are validated by
 * immutable, versioned functions below.
 */
ALTER TABLE public.student_responses
  RENAME COLUMN scores TO client_scores;

ALTER TABLE public.student_responses
  ADD COLUMN submission_schema_version smallint,
  ADD COLUMN questionnaire_version text,
  ADD COLUMN value_catalog_version text,
  ADD COLUMN specialty_catalog_version text,
  ADD COLUMN scoring_version text,
  ADD COLUMN consent_version text;

ALTER TABLE public.specialist_responses
  ADD COLUMN submission_schema_version smallint,
  ADD COLUMN questionnaire_version text,
  ADD COLUMN value_catalog_version text,
  ADD COLUMN specialty_catalog_version text,
  ADD COLUMN calibration_version text,
  ADD COLUMN consent_version text,
  ADD COLUMN would_choose_again_code text,
  ADD COLUMN intention_to_change_code text,
  ADD COLUMN voluntary_choice_code text;

UPDATE public.student_responses
SET
  submission_schema_version = 0,
  questionnaire_version = 'legacy-unknown',
  value_catalog_version = 'legacy-unknown',
  specialty_catalog_version = 'legacy-unknown',
  scoring_version = 'legacy-client-unknown',
  consent_version = 'legacy-unrecorded'
WHERE submission_schema_version IS NULL;

UPDATE public.specialist_responses
SET
  submission_schema_version = 0,
  questionnaire_version = 'legacy-unknown',
  value_catalog_version = 'legacy-unknown',
  specialty_catalog_version = 'legacy-unknown',
  calibration_version = 'legacy-localized-labels',
  consent_version = 'legacy-unrecorded'
WHERE submission_schema_version IS NULL;

/* Recover canonical codes from every UI language used before schema v1. */
UPDATE public.specialist_responses
SET would_choose_again_code = CASE lower(btrim(would_choose_again))
  WHEN 'yes' THEN 'yes'
  WHEN 'oui' THEN 'yes'
  WHEN 'da' THEN 'yes'
  WHEN 'no' THEN 'no'
  WHEN 'non' THEN 'no'
  WHEN 'nu' THEN 'no'
  WHEN 'not sure' THEN 'unsure'
  WHEN 'incertain' THEN 'unsure'
  WHEN 'nu sunt sigur' THEN 'unsure'
END
WHERE would_choose_again IS NOT NULL
  AND would_choose_again_code IS NULL;

UPDATE public.specialist_responses
SET intention_to_change_code = CASE lower(btrim(intention_to_change))
  WHEN 'definitely' THEN 'definitely'
  WHEN 'définitivement' THEN 'definitely'
  WHEN 'definitiv' THEN 'definitely'
  WHEN 'probably' THEN 'probably'
  WHEN 'probablement' THEN 'probably'
  WHEN 'probabil' THEN 'probably'
  WHEN 'probably not' THEN 'probably_not'
  WHEN 'probablement pas' THEN 'probably_not'
  WHEN 'probabil nu' THEN 'probably_not'
  WHEN 'definitely not' THEN 'definitely_not'
  WHEN 'définitivement pas' THEN 'definitely_not'
  WHEN 'definitiv nu' THEN 'definitely_not'
END
WHERE intention_to_change IS NOT NULL
  AND intention_to_change_code IS NULL;

UPDATE public.specialist_responses
SET voluntary_choice_code = CASE lower(btrim(voluntary_choice))
  WHEN 'fully voluntary' THEN 'fully_voluntary'
  WHEN 'totalement volontaire' THEN 'fully_voluntary'
  WHEN 'pe deplin voluntar' THEN 'fully_voluntary'
  WHEN 'somewhat voluntary' THEN 'somewhat_voluntary'
  WHEN 'plutôt volontaire' THEN 'somewhat_voluntary'
  WHEN 'oarecum voluntar' THEN 'somewhat_voluntary'
  WHEN 'not voluntary' THEN 'not_voluntary'
  WHEN 'non volontaire' THEN 'not_voluntary'
  WHEN 'nu voluntar' THEN 'not_voluntary'
END
WHERE voluntary_choice IS NOT NULL
  AND voluntary_choice_code IS NULL;

UPDATE public.student_responses
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.specialist_responses
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.student_responses
  ALTER COLUMN submission_schema_version SET DEFAULT 1,
  ALTER COLUMN submission_schema_version SET NOT NULL,
  ALTER COLUMN questionnaire_version SET DEFAULT 'q81-v1',
  ALTER COLUMN questionnaire_version SET NOT NULL,
  ALTER COLUMN value_catalog_version SET DEFAULT 'career-values-v1',
  ALTER COLUMN value_catalog_version SET NOT NULL,
  ALTER COLUMN specialty_catalog_version SET DEFAULT 'medical-specialties-v1',
  ALTER COLUMN specialty_catalog_version SET NOT NULL,
  ALTER COLUMN scoring_version SET DEFAULT 'client-scoring-v1',
  ALTER COLUMN scoring_version SET NOT NULL,
  ALTER COLUMN consent_version SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.specialist_responses
  ALTER COLUMN submission_schema_version SET DEFAULT 1,
  ALTER COLUMN submission_schema_version SET NOT NULL,
  ALTER COLUMN questionnaire_version SET DEFAULT 'q81-v1',
  ALTER COLUMN questionnaire_version SET NOT NULL,
  ALTER COLUMN value_catalog_version SET DEFAULT 'career-values-v1',
  ALTER COLUMN value_catalog_version SET NOT NULL,
  ALTER COLUMN specialty_catalog_version SET DEFAULT 'medical-specialties-v1',
  ALTER COLUMN specialty_catalog_version SET NOT NULL,
  ALTER COLUMN calibration_version SET DEFAULT 'calibration-v1',
  ALTER COLUMN calibration_version SET NOT NULL,
  ALTER COLUMN consent_version SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

CREATE OR REPLACE FUNCTION private.question_catalog_q81_v1()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12',
    'W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12','W13',
    'I1','I2','I3','I4','I5','I6','I7','I8','I9','I10','I11',
    'M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12',
    'P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12','P13',
    'S1','S2','S3','S4','S5','S6','S7','S8','S9',
    'V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION private.value_catalog_v1()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'Sufficient free time',
    'Personal achievement',
    'Prestige',
    'Decision-making',
    'Independence',
    'Intellectual activity',
    'Manual/hands-on activity',
    'Working with people',
    'Job security',
    'Variety in your work',
    'Satisfactory income',
    'Creativity',
    'Feedback from others',
    'Caring for people'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION private.valid_ratings_q81_v1(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  expected constant text[] := private.question_catalog_q81_v1();
  answer_key text;
  answer_value jsonb;
  numeric_value numeric;
  key_count integer;
BEGIN
  IF payload IS NULL
     OR pg_catalog.jsonb_typeof(payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(payload::text) > 8192 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO key_count
  FROM pg_catalog.jsonb_object_keys(payload);

  IF key_count <> 81 THEN
    RETURN false;
  END IF;

  FOR answer_key, answer_value IN
    SELECT item.key, item.value
    FROM pg_catalog.jsonb_each(payload) AS item
  LOOP
    IF NOT (answer_key = ANY(expected))
       OR pg_catalog.jsonb_typeof(answer_value) IS DISTINCT FROM 'number' THEN
      RETURN false;
    END IF;

    BEGIN
      numeric_value := (answer_value #>> '{}')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;

    IF numeric_value < 1
       OR numeric_value > 10
       OR numeric_value <> pg_catalog.trunc(numeric_value) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.valid_selected_values_v1(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  allowed constant text[] := private.value_catalog_v1();
  item jsonb;
  value_text text;
  seen text[] := ARRAY[]::text[];
  item_count integer;
BEGIN
  IF payload IS NULL
     OR pg_catalog.jsonb_typeof(payload) IS DISTINCT FROM 'array'
     OR pg_catalog.octet_length(payload::text) > 2048 THEN
    RETURN false;
  END IF;

  item_count := pg_catalog.jsonb_array_length(payload);
  IF item_count < 1 OR item_count > 4 THEN
    RETURN false;
  END IF;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(payload)
  LOOP
    IF pg_catalog.jsonb_typeof(item) IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    value_text := item #>> '{}';
    IF NOT (value_text = ANY(allowed)) OR value_text = ANY(seen) THEN
      RETURN false;
    END IF;
    seen := pg_catalog.array_append(seen, value_text);
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.specialty_catalog_v1()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'Allergy and Clinical Immunology',
    'Anesthesiology and Intensive Care',
    'Infectious Diseases',
    'Cardiology',
    'Pediatric Cardiology',
    'Dermatology and Venereology',
    'Diabetes, Nutrition and Metabolic Diseases',
    'Endocrinology',
    'Medical Assessment of Work Capacity / Occupational Disability Assessment',
    'Clinical Pharmacology',
    'Gastroenterology',
    'Pediatric Gastroenterology',
    'Medical Genetics',
    'Geriatrics and Gerontology',
    'Hematology',
    'Family Medicine',
    'Emergency Medicine',
    'Internal Medicine',
    'Physical Medicine and Rehabilitation',
    'Occupational Medicine',
    'Sports Medicine',
    'Nephrology',
    'Pediatric Nephrology',
    'Neonatology',
    'Neurology',
    'Pediatric Neurology',
    'Medical Oncology',
    'Pediatric Oncology and Hematology',
    'Pediatrics',
    'Pulmonology',
    'Pediatric Pulmonology',
    'Psychiatry',
    'Child and Adolescent Psychiatry',
    'Radiation Oncology',
    'Rheumatology',
    'Cardiovascular Surgery',
    'General Surgery',
    'Oral and Maxillofacial Surgery',
    'Pediatric Surgery',
    'Plastic, Aesthetic and Reconstructive Microsurgery',
    'Thoracic Surgery',
    'Vascular Surgery',
    'Neurosurgery',
    'Obstetrics and Gynecology',
    'Ophthalmology',
    'Pediatric Orthopedics',
    'Orthopedics and Traumatology',
    'Otorhinolaryngology (ENT)',
    'Urology',
    'Pathology',
    'Epidemiology',
    'Hygiene',
    'Laboratory Medicine',
    'Forensic Medicine',
    'Nuclear Medicine',
    'Medical Microbiology',
    'Radiology and Medical Imaging',
    'Public Health and Healthcare Management'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION private.valid_specialty_v1(specialty_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(
    specialty_name = ANY(private.specialty_catalog_v1()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION private.valid_client_scores_v1(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  item_key_count integer;
  specialty_name text;
  numeric_score numeric;
  previous_score numeric := 101;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF payload IS NULL
     OR pg_catalog.jsonb_typeof(payload) IS DISTINCT FROM 'array'
     OR pg_catalog.octet_length(payload::text) > 32768 THEN
    RETURN false;
  END IF;

  IF pg_catalog.jsonb_array_length(payload) <> 58 THEN
    RETURN false;
  END IF;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(payload)
  LOOP
    IF pg_catalog.jsonb_typeof(item) IS DISTINCT FROM 'object' THEN
      RETURN false;
    END IF;

    SELECT count(*) INTO item_key_count
    FROM pg_catalog.jsonb_object_keys(item);

    IF item_key_count <> 2
       OR pg_catalog.jsonb_typeof(item -> 'specialty') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(item -> 'score') IS DISTINCT FROM 'number' THEN
      RETURN false;
    END IF;

    specialty_name := item ->> 'specialty';
    IF NOT private.valid_specialty_v1(specialty_name)
       OR specialty_name = ANY(seen) THEN
      RETURN false;
    END IF;

    BEGIN
      numeric_score := (item ->> 'score')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;

    IF numeric_score < 0
       OR numeric_score > 100
       OR numeric_score > previous_score THEN
      RETURN false;
    END IF;

    seen := pg_catalog.array_append(seen, specialty_name);
    previous_score := numeric_score;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.question_catalog_q81_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.value_catalog_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.specialty_catalog_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_ratings_q81_v1(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_selected_values_v1(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_specialty_v1(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_client_scores_v1(jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.question_catalog_q81_v1() TO service_role;
GRANT EXECUTE ON FUNCTION private.value_catalog_v1() TO service_role;
GRANT EXECUTE ON FUNCTION private.specialty_catalog_v1() TO service_role;
GRANT EXECUTE ON FUNCTION private.valid_ratings_q81_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.valid_selected_values_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.valid_specialty_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.valid_client_scores_v1(jsonb) TO service_role;

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_payload_v1_check
  CHECK (
    submission_schema_version = 0
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
    )
  ) NOT VALID;

ALTER TABLE public.specialist_responses
  ADD CONSTRAINT specialist_responses_payload_v1_check
  CHECK (
    submission_schema_version = 0
    OR (
      submission_schema_version = 1
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
    )
  ) NOT VALID;

ALTER TABLE public.student_responses
  VALIDATE CONSTRAINT student_responses_payload_v1_check;
ALTER TABLE public.specialist_responses
  VALIDATE CONSTRAINT specialist_responses_payload_v1_check;

CREATE TABLE private.researchers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT researchers_display_name_length_check
    CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 120)
);

ALTER TABLE private.researchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.researchers FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.researchers IS
  'Explicit allowlist for accounts permitted to read research submissions.';

CREATE OR REPLACE FUNCTION private.is_researcher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.researchers AS researcher
    WHERE researcher.user_id = (SELECT auth.uid())
      AND researcher.enabled
  );
$$;

CREATE OR REPLACE FUNCTION private.add_researcher_by_email(
  researcher_email text,
  researcher_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  researcher_id uuid;
BEGIN
  SELECT auth_user.id INTO researcher_id
  FROM auth.users AS auth_user
  WHERE lower(auth_user.email) = lower(btrim(researcher_email))
  LIMIT 1;

  IF researcher_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'No Supabase Auth user exists for this email';
  END IF;

  INSERT INTO private.researchers (user_id, display_name, enabled)
  VALUES (researcher_id, nullif(btrim(researcher_display_name), ''), true)
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      enabled = true;

  RETURN researcher_id;
END;
$$;

REVOKE ALL ON FUNCTION private.is_researcher()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.add_researcher_by_email(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.submit_student_response_v1(
  p_submission_id uuid,
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
  p_consent_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF p_submission_id IS NULL
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_scoring_version IS DISTINCT FROM 'client-scoring-v1'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-08-26'
     OR private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
     OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
     OR private.valid_client_scores_v1(p_client_scores) IS NOT TRUE
     OR p_language IS NULL
     OR p_language NOT IN ('en', 'ro', 'fr')
     OR (p_study_year IS NOT NULL AND p_study_year NOT BETWEEN 1 AND 12)
     OR (
       p_preferred_specialty IS NOT NULL
       AND private.valid_specialty_v1(p_preferred_specialty) IS NOT TRUE
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid student research submission';
  END IF;

  INSERT INTO public.student_responses (
    id,
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
    consent_version
  ) VALUES (
    p_submission_id,
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    1,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v1',
    'research-consent-2026-08-26'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT existing.id INTO inserted_id
    FROM public.student_responses AS existing
    WHERE existing.id = p_submission_id
      AND existing.study_year IS NOT DISTINCT FROM p_study_year
      AND existing.preferred_specialty IS NOT DISTINCT FROM p_preferred_specialty
      AND existing.ratings = p_ratings
      AND existing.selected_values = p_selected_values
      AND existing.client_scores = p_client_scores
      AND existing.language = p_language
      AND existing.submission_schema_version = 1
      AND existing.questionnaire_version = 'q81-v1'
      AND existing.value_catalog_version = 'career-values-v1'
      AND existing.specialty_catalog_version = 'medical-specialties-v1'
      AND existing.scoring_version = 'client-scoring-v1'
      AND existing.consent_version = 'research-consent-2026-08-26';

    IF inserted_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with a different payload';
    END IF;
  END IF;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.submit_specialist_response_v1(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_language text,
  p_years_of_experience integer,
  p_career_satisfaction integer,
  p_would_choose_again_code text,
  p_intention_to_change_code text,
  p_voluntary_choice_code text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF p_submission_id IS NULL
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_calibration_version IS DISTINCT FROM 'calibration-v1'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-08-26'
     OR private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
     OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
     OR private.valid_specialty_v1(p_actual_specialty) IS NOT TRUE
     OR p_language IS NULL
     OR p_language NOT IN ('en', 'ro', 'fr')
     OR (p_years_of_experience IS NOT NULL AND p_years_of_experience NOT BETWEEN 0 AND 60)
     OR (p_career_satisfaction IS NOT NULL AND p_career_satisfaction NOT BETWEEN 1 AND 5)
     OR (
       p_would_choose_again_code IS NOT NULL
       AND p_would_choose_again_code NOT IN ('yes', 'no', 'unsure')
     )
     OR (
       p_intention_to_change_code IS NOT NULL
       AND p_intention_to_change_code NOT IN (
         'definitely', 'probably', 'probably_not', 'definitely_not'
       )
     )
     OR (
       p_voluntary_choice_code IS NOT NULL
       AND p_voluntary_choice_code NOT IN (
         'fully_voluntary', 'somewhat_voluntary', 'not_voluntary'
       )
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid specialist research submission';
  END IF;

  INSERT INTO public.specialist_responses (
    id,
    actual_specialty,
    ratings,
    selected_values,
    language,
    years_of_experience,
    career_satisfaction,
    would_choose_again_code,
    intention_to_change_code,
    voluntary_choice_code,
    submission_schema_version,
    questionnaire_version,
    value_catalog_version,
    specialty_catalog_version,
    calibration_version,
    consent_version
  ) VALUES (
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_language,
    p_years_of_experience,
    p_career_satisfaction,
    p_would_choose_again_code,
    p_intention_to_change_code,
    p_voluntary_choice_code,
    1,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v1',
    'research-consent-2026-08-26'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT existing.id INTO inserted_id
    FROM public.specialist_responses AS existing
    WHERE existing.id = p_submission_id
      AND existing.actual_specialty = p_actual_specialty
      AND existing.ratings = p_ratings
      AND existing.selected_values = p_selected_values
      AND existing.language = p_language
      AND existing.years_of_experience IS NOT DISTINCT FROM p_years_of_experience
      AND existing.career_satisfaction IS NOT DISTINCT FROM p_career_satisfaction
      AND existing.would_choose_again_code IS NOT DISTINCT FROM p_would_choose_again_code
      AND existing.intention_to_change_code IS NOT DISTINCT FROM p_intention_to_change_code
      AND existing.voluntary_choice_code IS NOT DISTINCT FROM p_voluntary_choice_code
      AND existing.submission_schema_version = 1
      AND existing.questionnaire_version = 'q81-v1'
      AND existing.value_catalog_version = 'career-values-v1'
      AND existing.specialty_catalog_version = 'medical-specialties-v1'
      AND existing.calibration_version = 'calibration-v1'
      AND existing.consent_version = 'research-consent-2026-08-26';

    IF inserted_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with a different payload';
    END IF;
  END IF;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_student_response_v1(
  p_submission_id uuid,
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
  p_consent_version text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_student_response_v1(
    p_submission_id,
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
    p_consent_version
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_specialist_response_v1(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_language text,
  p_years_of_experience integer,
  p_career_satisfaction integer,
  p_would_choose_again_code text,
  p_intention_to_change_code text,
  p_voluntary_choice_code text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_specialist_response_v1(
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_language,
    p_years_of_experience,
    p_career_satisfaction,
    p_would_choose_again_code,
    p_intention_to_change_code,
    p_voluntary_choice_code,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_calibration_version,
    p_consent_version
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_researcher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_researcher();
$$;

REVOKE ALL ON FUNCTION private.submit_student_response_v1(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_specialist_response_v1(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_student_response_v1(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_specialist_response_v1(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_is_researcher()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_student_response_v1(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_specialist_response_v1(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_researcher() TO authenticated;

DROP POLICY IF EXISTS "anon_insert_student_responses"
  ON public.student_responses;
DROP POLICY IF EXISTS "anon_insert_specialist_responses"
  ON public.specialist_responses;
DROP POLICY IF EXISTS "authenticated_read_student_responses"
  ON public.student_responses;
DROP POLICY IF EXISTS "authenticated_read_specialist_responses"
  ON public.specialist_responses;
DROP POLICY IF EXISTS "researchers_read_student_responses"
  ON public.student_responses;
DROP POLICY IF EXISTS "researchers_read_specialist_responses"
  ON public.specialist_responses;
DROP POLICY IF EXISTS "researcher_guard_student_responses"
  ON public.student_responses;
DROP POLICY IF EXISTS "researcher_guard_specialist_responses"
  ON public.specialist_responses;

ALTER TABLE public.student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "researchers_read_student_responses"
ON public.student_responses
FOR SELECT
TO authenticated
USING ((SELECT public.current_user_is_researcher()));

CREATE POLICY "researchers_read_specialist_responses"
ON public.specialist_responses
FOR SELECT
TO authenticated
USING ((SELECT public.current_user_is_researcher()));

/* Restrictive guards prevent a later permissive policy from widening access. */
CREATE POLICY "researcher_guard_student_responses"
ON public.student_responses
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING ((SELECT public.current_user_is_researcher()));

CREATE POLICY "researcher_guard_specialist_responses"
ON public.specialist_responses
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING ((SELECT public.current_user_is_researcher()));

REVOKE ALL ON TABLE public.student_responses
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.specialist_responses
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.student_responses TO authenticated;
GRANT SELECT ON TABLE public.specialist_responses TO authenticated;

COMMENT ON COLUMN public.student_responses.client_scores IS
  'Unverified browser-computed ranking. Recompute from raw answers for research.';
COMMENT ON COLUMN public.student_responses.consent_version IS
  'Version of the disclosure accepted when the participant submitted the row.';
COMMENT ON COLUMN public.specialist_responses.consent_version IS
  'Version of the disclosure accepted when the participant submitted the row.';
COMMENT ON FUNCTION public.submit_student_response_v1(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text
) IS 'Validated and idempotent public ingestion endpoint for student responses.';
COMMENT ON FUNCTION public.submit_specialist_response_v1(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text
) IS 'Validated and idempotent public ingestion endpoint for specialist responses.';

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
