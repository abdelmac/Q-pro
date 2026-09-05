BEGIN;

/*
 * Schema 2 keeps the 81-question payload stable while versioning the scoring
 * engine, specialist qualitative interview, and consent text. Schema 0/1
 * rows and the v1/v2 RPCs remain untouched and readable.
 */
ALTER TABLE public.specialist_responses
  ADD COLUMN IF NOT EXISTS current_specialty_view text,
  ADD COLUMN IF NOT EXISTS specialty_changes_over_years text,
  ADD COLUMN IF NOT EXISTS most_important_specialty_quality text,
  ADD COLUMN IF NOT EXISTS would_not_choose_again_reason text,
  ADD COLUMN IF NOT EXISTS student_self_question text;

COMMENT ON COLUMN public.specialist_responses.current_specialty_view IS
  'Schema-2 specialist reflection on how they currently view their specialty.';
COMMENT ON COLUMN public.specialist_responses.specialty_changes_over_years IS
  'Schema-2 specialist reflection on how their specialty or view of it changed over time.';
COMMENT ON COLUMN public.specialist_responses.most_important_specialty_quality IS
  'Schema-2 specialist statement of the most important quality required in their specialty.';
COMMENT ON COLUMN public.specialist_responses.would_not_choose_again_reason IS
  'Schema-2 explanation required only when would_choose_again_code is no.';
COMMENT ON COLUMN public.specialist_responses.student_self_question IS
  'Schema-2 question a student should ask themselves before choosing the specialty.';

ALTER TABLE public.student_responses
  ALTER COLUMN submission_schema_version SET DEFAULT 2,
  ALTER COLUMN scoring_version SET DEFAULT 'client-scoring-v2';

ALTER TABLE public.specialist_responses
  ALTER COLUMN submission_schema_version SET DEFAULT 2,
  ALTER COLUMN calibration_version SET DEFAULT 'calibration-v2-qualitative';

/*
 * Publish a new immutable catalog snapshot that repairs measured key-trait
 * omissions. Existing targets in a published catalog or an in-progress draft
 * always win; this migration only fills missing keys. prevention_orientation
 * deliberately remains untouched because q81-v1 does not measure it.
 */
CREATE TEMP TABLE accuracy_profile_additions (
  specialty_name text PRIMARY KEY,
  additions jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO accuracy_profile_additions (specialty_name, additions) VALUES
  ('Diabetes, Nutrition and Metabolic Diseases', '{"communication":[85,2]}'::jsonb),
  ('Endocrinology', '{"precision":[90,2]}'::jsonb),
  ('Pediatric Gastroenterology', '{"detail_orientation":[90,3],"long_term_orientation":[90,2]}'::jsonb),
  ('Medical Genetics', '{"cognitive_empathy":[80,2]}'::jsonb),
  ('Geriatrics and Gerontology', '{"care_coordination":[90,3]}'::jsonb),
  ('Nephrology', '{"teamwork":[85,2]}'::jsonb),
  ('Pediatric Neurology', '{"patience":[85,2]}'::jsonb),
  ('Pulmonology', '{"technology_interest":[90,3]}'::jsonb),
  ('Pediatric Pulmonology', '{"detail_orientation":[90,3]}'::jsonb),
  ('Otorhinolaryngology (ENT)', '{"social_energy":[80,2]}'::jsonb),
  ('Pathology', '{"independence":[85,2]}'::jsonb),
  ('Epidemiology', '{"independence":[85,2]}'::jsonb),
  ('Hygiene', '{"independence":[85,2]}'::jsonb),
  ('Laboratory Medicine', '{"lifestyle_priority":[75,1]}'::jsonb),
  ('Forensic Medicine', '{"independence":[85,2]}'::jsonb),
  ('Medical Microbiology', '{"independence":[85,2]}'::jsonb),
  ('Radiology and Medical Imaging', '{"independence":[85,2]}'::jsonb);

CREATE TEMP TABLE accuracy_draft_before ON COMMIT DROP AS
SELECT
  entry.version_id,
  version.revision AS version_revision,
  entry.name AS specialty_name,
  entry.profile AS before_profile
FROM private.specialty_catalog_entries AS entry
JOIN private.specialty_catalog_versions AS version
  ON version.id = entry.version_id
JOIN accuracy_profile_additions AS patch
  ON patch.specialty_name = entry.name
WHERE version.status = 'draft'
  AND EXISTS (
    SELECT 1
    FROM jsonb_object_keys(patch.additions) AS key(trait_code)
    WHERE NOT entry.profile ? key.trait_code
  );

UPDATE private.specialty_catalog_entries AS entry
SET profile = patch.additions || entry.profile
FROM accuracy_profile_additions AS patch
JOIN accuracy_draft_before AS previous
  ON previous.specialty_name = patch.specialty_name
WHERE entry.version_id = previous.version_id
  AND entry.name = previous.specialty_name;

UPDATE private.specialty_catalog_versions AS version
SET lock_version = version.lock_version + 1
WHERE version.status = 'draft'
  AND EXISTS (
    SELECT 1
    FROM accuracy_draft_before AS previous
    WHERE previous.version_id = version.id
  );

INSERT INTO private.specialty_catalog_audit (
  actor_user_id,
  actor_role,
  action,
  version_id,
  version_revision,
  specialty_name,
  note,
  before_value,
  after_value
)
SELECT
  NULL,
  'system',
  'entry_updated',
  previous.version_id,
  previous.version_revision,
  previous.specialty_name,
  'Schema-2 measured key-trait integrity repair',
  jsonb_build_object('profile', previous.before_profile),
  jsonb_build_object('profile', entry.profile)
FROM accuracy_draft_before AS previous
JOIN private.specialty_catalog_entries AS entry
  ON entry.version_id = previous.version_id
 AND entry.name = previous.specialty_name;

DO $catalog_revision$
DECLARE
  active_version private.specialty_catalog_versions%ROWTYPE;
  repaired_version private.specialty_catalog_versions%ROWTYPE;
  resolved_checksum text;
  expected_count integer;
  actual_count integer;
BEGIN
  SELECT version.* INTO active_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'active'
  FOR UPDATE;

  IF active_version.id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'No active specialty catalog exists for the schema-2 repair';
  END IF;

  INSERT INTO private.specialty_catalog_versions (
    label,
    status,
    lock_version,
    parent_version_id,
    note,
    created_by,
    published_by,
    published_at,
    checksum
  ) VALUES (
    'medical-specialties-accuracy-v2-pending',
    'archived',
    1,
    active_version.id,
    'Schema-2 scoring repair: fill measured key-trait omissions without changing existing targets',
    NULL,
    NULL,
    now(),
    'md5:00000000000000000000000000000000'
  )
  RETURNING * INTO repaired_version;

  INSERT INTO private.specialty_catalog_entries (
    version_id,
    name,
    category,
    descriptions,
    clinical_summaries,
    profile,
    updated_by,
    updated_at
  )
  SELECT
    repaired_version.id,
    entry.name,
    entry.category,
    entry.descriptions,
    entry.clinical_summaries,
    coalesce(patch.additions, '{}'::jsonb) || entry.profile,
    NULL,
    now()
  FROM private.specialty_catalog_entries AS entry
  LEFT JOIN accuracy_profile_additions AS patch
    ON patch.specialty_name = entry.name
  WHERE entry.version_id = active_version.id;

  SELECT cardinality(private.specialty_catalog_v1()) INTO expected_count;
  SELECT count(*) INTO actual_count
  FROM private.specialty_catalog_entries AS entry
  WHERE entry.version_id = repaired_version.id;

  IF actual_count <> expected_count
     OR EXISTS (
       SELECT 1
       FROM private.specialty_catalog_entries AS entry
       WHERE entry.version_id = repaired_version.id
         AND private.valid_specialty_catalog_entry(
           entry.name,
           entry.category,
           entry.descriptions,
           entry.clinical_summaries,
           entry.profile
         ) IS NOT TRUE
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'The repaired specialty catalog is incomplete or invalid';
  END IF;

  resolved_checksum := private.specialty_catalog_content_hash(repaired_version.id);

  UPDATE private.specialty_catalog_versions AS version
  SET checksum = resolved_checksum
  WHERE version.id = repaired_version.id;

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'archived'
  WHERE version.id = active_version.id;

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'active',
      label = 'medical-specialties-r' || repaired_version.revision::text
  WHERE version.id = repaired_version.id
  RETURNING * INTO repaired_version;

  INSERT INTO private.specialty_catalog_audit (
    actor_user_id,
    actor_role,
    action,
    version_id,
    version_revision,
    note,
    before_value,
    after_value
  ) VALUES (
    NULL,
    'system',
    'published',
    repaired_version.id,
    repaired_version.revision,
    repaired_version.note,
    jsonb_build_object(
      'active_version_id', active_version.id,
      'active_revision', active_version.revision
    ),
    jsonb_build_object(
      'active_version_id', repaired_version.id,
      'active_revision', repaired_version.revision,
      'content_hash', resolved_checksum
    )
  );
END;
$catalog_revision$;

/*
 * Replace the original schema-1-only checks atomically. The schema-1 branches
 * reproduce the previous constraints; schema-2 additionally requires exact
 * published-catalog provenance and the newly versioned protocol.
 */
ALTER TABLE public.student_responses
  DROP CONSTRAINT IF EXISTS student_responses_payload_v1_check;

ALTER TABLE public.specialist_responses
  DROP CONSTRAINT IF EXISTS specialist_responses_payload_v1_check;

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_payload_v2_check
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
    )
  ) NOT VALID;

ALTER TABLE public.specialist_responses
  ADD CONSTRAINT specialist_responses_payload_v2_check
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
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
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

ALTER TABLE public.student_responses
  VALIDATE CONSTRAINT student_responses_payload_v2_check;
ALTER TABLE public.specialist_responses
  VALIDATE CONSTRAINT specialist_responses_payload_v2_check;

CREATE OR REPLACE FUNCTION private.submit_student_response_v3(
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
BEGIN
  IF p_submission_id IS NULL
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_scoring_version IS DISTINCT FROM 'client-scoring-v2'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-09-04'
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
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    2,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v2',
    'research-consent-2026-09-04',
    p_specialty_config_version_id,
    resolved_revision
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT response.id INTO inserted_id
    FROM public.student_responses AS response
    WHERE response.id = p_submission_id
      AND response.study_year IS NOT DISTINCT FROM p_study_year
      AND response.preferred_specialty IS NOT DISTINCT FROM p_preferred_specialty
      AND response.ratings = p_ratings
      AND response.selected_values = p_selected_values
      AND response.client_scores = p_client_scores
      AND response.language = p_language
      AND response.submission_schema_version = 2
      AND response.questionnaire_version = 'q81-v1'
      AND response.value_catalog_version = 'career-values-v1'
      AND response.specialty_catalog_version = 'medical-specialties-v1'
      AND response.scoring_version = 'client-scoring-v2'
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

CREATE OR REPLACE FUNCTION private.submit_specialist_response_v3(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
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
     OR private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
     OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
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

CREATE OR REPLACE FUNCTION public.submit_student_response_v3(
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
  p_consent_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_student_response_v3(
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
    p_consent_version,
    p_specialty_config_version_id
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_specialist_response_v3(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
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
  SELECT private.submit_specialist_response_v3(
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
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

REVOKE ALL ON FUNCTION private.submit_student_response_v3(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_student_response_v3(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_specialist_response_v3(
  uuid, text, jsonb, jsonb, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_specialist_response_v3(
  uuid, text, jsonb, jsonb, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_student_response_v3(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_specialist_response_v3(
  uuid, text, jsonb, jsonb, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_student_response_v3(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) IS
  'Validated schema-2 student ingestion endpoint for client-scoring-v2 with exact published specialty catalog provenance.';
COMMENT ON FUNCTION public.submit_specialist_response_v3(
  uuid, text, jsonb, jsonb, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid
) IS
  'Validated schema-2 qualitative specialist ingestion endpoint with exact published specialty catalog provenance.';

NOTIFY pgrst, 'reload schema';

COMMIT;
