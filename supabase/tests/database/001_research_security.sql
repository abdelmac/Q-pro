BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(111);

SELECT extensions.has_schema('private', 'private schema exists');
SELECT extensions.has_table('public', 'student_responses', 'student table exists');
SELECT extensions.has_table('public', 'specialist_responses', 'specialist table exists');
SELECT extensions.has_table('private', 'specialty_catalog_versions', 'private specialty catalog versions table exists');
SELECT extensions.has_table('private', 'specialty_catalog_entries', 'private specialty catalog entries table exists');
SELECT extensions.has_table('private', 'trait_catalog', 'private trait catalog exists');
SELECT extensions.has_table('private', 'specialty_catalog_audit', 'private specialty catalog audit exists');

SELECT extensions.has_column(
  'public', 'student_responses', 'specialty_config_version_id',
  'student rows store specialty catalog version ids'
);
SELECT extensions.has_column(
  'public', 'student_responses', 'specialty_config_revision',
  'student rows store specialty catalog revisions'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'specialty_config_version_id',
  'specialist rows store specialty catalog version ids'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'specialty_config_revision',
  'specialist rows store specialty catalog revisions'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'current_specialty_view',
  'specialist rows store the current specialty view'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'specialty_changes_over_years',
  'specialist rows store changes observed over the years'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'most_important_specialty_quality',
  'specialist rows store the most important required quality'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'would_not_choose_again_reason',
  'specialist rows store the conditional no explanation'
);
SELECT extensions.has_column(
  'public', 'specialist_responses', 'student_self_question',
  'specialist rows store the proposed student self-question'
);

SELECT extensions.is(
  (SELECT count(*) FROM private.specialty_catalog_versions WHERE status = 'active'),
  1::bigint,
  'exactly one specialty catalog snapshot is active'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM private.specialty_catalog_entries AS entry
    JOIN private.specialty_catalog_versions AS version ON version.id = entry.version_id
    WHERE version.status = 'active'
  ),
  58::bigint,
  'the active specialty catalog contains all 58 specialties'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM private.specialty_catalog_entries AS entry
    JOIN private.specialty_catalog_versions AS version ON version.id = entry.version_id
    WHERE version.status = 'active'
      AND (
        private.valid_localized_catalog_text(entry.descriptions, 1, 2000) IS NOT TRUE
        OR private.valid_localized_catalog_text(entry.clinical_summaries, 20, 5000) IS NOT TRUE
      )
  ),
  'all active specialty narratives contain valid Romanian, French, and English text'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM private.specialty_catalog_entries AS entry
    JOIN private.specialty_catalog_versions AS version ON version.id = entry.version_id
    WHERE version.status = 'active'
      AND (
        entry.clinical_summaries::text LIKE '%Initial clinical summary, not yet clinically reviewed:%'
        OR entry.clinical_summaries::text LIKE '%Résumé clinique initial, pas encore validé cliniquement%'
        OR entry.clinical_summaries::text LIKE '%Rezumat clinic inițial, care nu a fost încă validat clinic%'
      )
  ),
  'no legacy placeholder remains in the active professional narratives'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM private.specialty_catalog_entries AS entry
    JOIN private.specialty_catalog_versions AS version ON version.id = entry.version_id
    WHERE version.status = 'active'
      AND (
        entry.descriptions::text ~ '[�ǎşţŞŢ]'
        OR entry.clinical_summaries::text ~ '[�ǎşţŞŢ]'
        OR position('Ã' IN entry.descriptions::text) > 0
        OR position('Ã' IN entry.clinical_summaries::text) > 0
      )
  ),
  'active specialty narratives do not contain known Unicode corruption markers'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM private.specialty_catalog_versions AS narrative_version
    JOIN private.specialty_catalog_entries AS narrative_entry
      ON narrative_entry.version_id = narrative_version.id
    JOIN private.specialty_catalog_entries AS parent_entry
      ON parent_entry.version_id = narrative_version.parent_version_id
     AND parent_entry.name = narrative_entry.name
    WHERE narrative_version.note = 'Reviewed Romanian, French, and English specialty narratives supplied for the complete Top-10 results view'
  ),
  58::bigint,
  'the multilingual publication has a complete parent snapshot for comparison'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM private.specialty_catalog_versions AS narrative_version
    JOIN private.specialty_catalog_entries AS narrative_entry
      ON narrative_entry.version_id = narrative_version.id
    JOIN private.specialty_catalog_entries AS parent_entry
      ON parent_entry.version_id = narrative_version.parent_version_id
     AND parent_entry.name = narrative_entry.name
    WHERE narrative_version.note = 'Reviewed Romanian, French, and English specialty narratives supplied for the complete Top-10 results view'
      AND narrative_entry.profile IS DISTINCT FROM parent_entry.profile
  ),
  'the multilingual editorial publication does not modify matching profiles'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM private.specialty_catalog_versions AS narrative_version
    WHERE narrative_version.note = 'Reviewed Romanian, French, and English specialty narratives supplied for the complete Top-10 results view'
      AND narrative_version.status IN ('active', 'archived')
      AND narrative_version.checksum = private.specialty_catalog_content_hash(narrative_version.id)
  ),
  'the multilingual publication stores its computed content checksum'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM private.specialty_catalog_versions AS narrative_version
    JOIN private.specialty_catalog_versions AS parent_version
      ON parent_version.id = narrative_version.parent_version_id
    WHERE narrative_version.note = 'Reviewed Romanian, French, and English specialty narratives supplied for the complete Top-10 results view'
      AND parent_version.status = 'archived'
  ),
  'the multilingual publication preserves its parent as an archived snapshot'
);
SELECT extensions.is(
  (SELECT count(*) FROM private.trait_catalog),
  96::bigint,
  'the trait metadata seed contains all 96 traits'
);
SELECT extensions.ok(
  NOT EXISTS (
    WITH required_profile_traits(specialty_name, trait_code) AS (
      VALUES
        ('Diabetes, Nutrition and Metabolic Diseases', 'communication'),
        ('Endocrinology', 'precision'),
        ('Pediatric Gastroenterology', 'detail_orientation'),
        ('Pediatric Gastroenterology', 'long_term_orientation'),
        ('Medical Genetics', 'cognitive_empathy'),
        ('Geriatrics and Gerontology', 'care_coordination'),
        ('Nephrology', 'teamwork'),
        ('Pediatric Neurology', 'patience'),
        ('Pulmonology', 'technology_interest'),
        ('Pediatric Pulmonology', 'detail_orientation'),
        ('Otorhinolaryngology (ENT)', 'social_energy'),
        ('Pathology', 'independence'),
        ('Epidemiology', 'independence'),
        ('Hygiene', 'independence'),
        ('Laboratory Medicine', 'lifestyle_priority'),
        ('Forensic Medicine', 'independence'),
        ('Medical Microbiology', 'independence'),
        ('Radiology and Medical Imaging', 'independence')
    )
    SELECT 1
    FROM required_profile_traits AS required
    LEFT JOIN private.specialty_catalog_entries AS entry
      ON entry.name = required.specialty_name
      AND entry.version_id = (
        SELECT version.id
        FROM private.specialty_catalog_versions AS version
        WHERE version.status = 'active'
      )
    WHERE entry.name IS NULL OR NOT entry.profile ? required.trait_code
  ),
  'all measured specialty metadata traits exist in the active scoring profiles'
);
SELECT extensions.is(
  (SELECT measurement_source FROM private.trait_catalog WHERE code = 'manual_orientation'),
  'value_only'::text,
  'manual orientation is explicitly marked as value-only'
);
SELECT extensions.is(
  (SELECT measurement_source FROM private.trait_catalog WHERE code = 'prevention_orientation'),
  'unmeasured'::text,
  'prevention orientation is explicitly marked as unmeasured'
);
SELECT extensions.ok(
  (public.get_active_specialty_catalog() ?& ARRAY['version', 'specialties'])
  AND jsonb_array_length(public.get_active_specialty_catalog() -> 'specialties') = 58
  AND (public.get_active_specialty_catalog() -> 'version')
      ?& ARRAY['id', 'revision', 'label', 'content_hash', 'published_at'],
  'the active catalog RPC returns the stable public JSON contract'
);
SELECT extensions.ok(
  has_function_privilege('anon', 'public.get_active_specialty_catalog()', 'EXECUTE'),
  'anon can read the active specialty catalog RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_specialty_catalog_draft()', 'EXECUTE'),
  'anon cannot execute the draft catalog RPC'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.current_user_portal_profile()', 'EXECUTE'),
  'authenticated accounts can request their portal profile'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_specialty_catalog_draft()', 'EXECUTE'),
  'authenticated accounts can issue role-checked draft reads'
);
SELECT extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.save_specialty_catalog_entry_draft(uuid,bigint,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated accounts can issue role-checked draft saves'
);
SELECT extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.publish_specialty_catalog_draft(uuid,bigint,text)',
    'EXECUTE'
  ),
  'authenticated accounts can issue role-checked publications'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.list_specialty_catalog_versions(integer)', 'EXECUTE'),
  'authenticated accounts can issue role-checked version listing'
);
SELECT extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.restore_specialty_catalog_version(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated accounts can issue role-checked restores'
);
SELECT extensions.ok(
  has_function_privilege(
    'anon',
    'public.submit_student_response_v2(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anon can execute the versioned student submission RPC'
);
SELECT extensions.ok(
  has_function_privilege(
    'anon',
    'public.submit_specialist_response_v2(uuid,text,jsonb,jsonb,text,integer,integer,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anon can execute the versioned specialist submission RPC'
);
SELECT extensions.ok(
  has_function_privilege(
    'anon',
    'public.submit_student_response_v3(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anon can execute the schema-2 student submission RPC'
);
SELECT extensions.ok(
  has_function_privilege(
    'anon',
    'public.submit_specialist_response_v3(uuid,text,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anon can execute the qualitative specialist submission RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege(
    'anon',
    'private.submit_student_response_v3(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'private.submit_specialist_response_v3(uuid,text,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'clients cannot execute schema-2 private submission workers'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'private.specialty_catalog_versions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.specialty_catalog_entries', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.specialty_catalog_audit', 'INSERT'),
  'catalog snapshots and audit records have no direct client table privileges'
);
SELECT extensions.ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=""' = ANY(coalesce(procedure.proconfig, ARRAY[]::text[]))
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = 'public.get_active_specialty_catalog()'::regprocedure
  ),
  'active catalog RPC is security definer with an empty search path'
);
SELECT extensions.ok(
  (
    SELECT bool_and(
      procedure.prosecdef
      AND 'search_path=""' = ANY(coalesce(procedure.proconfig, ARRAY[]::text[]))
    )
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid IN (
      'public.submit_student_response_v3(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid)'::regprocedure,
      'public.submit_specialist_response_v3(uuid,text,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  'schema-2 public submission wrappers are security definer with empty search paths'
);
SELECT extensions.ok(
  (
    SELECT bool_and(class.relrowsecurity)
    FROM pg_catalog.pg_class AS class
    WHERE class.oid IN (
      'private.specialty_catalog_versions'::regclass,
      'private.specialty_catalog_entries'::regclass,
      'private.trait_catalog'::regclass,
      'private.specialty_catalog_audit'::regclass
    )
  ),
  'all private catalog tables have row-level security enabled'
);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.student_responses', 'SELECT'),
  'anon cannot select student responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.student_responses', 'INSERT'),
  'anon cannot insert directly into student responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.specialist_responses', 'SELECT'),
  'anon cannot select specialist responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.specialist_responses', 'INSERT'),
  'anon cannot insert directly into specialist responses'
);
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.student_responses', 'SELECT'),
  'authenticated can issue RLS-filtered student selects'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.student_responses', 'INSERT'),
  'authenticated cannot insert directly into student responses'
);
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.specialist_responses', 'SELECT'),
  'authenticated can issue RLS-filtered specialist selects'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.specialist_responses', 'INSERT'),
  'authenticated cannot insert directly into specialist responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.student_responses', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.student_responses', 'DELETE'),
  'anon cannot update or delete student responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.specialist_responses', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.specialist_responses', 'DELETE'),
  'anon cannot update or delete specialist responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.student_responses', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.student_responses', 'DELETE'),
  'authenticated cannot update or delete student responses'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.specialist_responses', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.specialist_responses', 'DELETE'),
  'authenticated cannot update or delete specialist responses'
);

SELECT extensions.ok(
  has_function_privilege(
    'anon',
    'public.submit_student_response_v1(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anon can execute the validated student RPC'
);
SELECT extensions.ok(
  has_function_privilege(
    'anon',
    'public.submit_specialist_response_v1(uuid,text,jsonb,jsonb,text,integer,integer,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anon can execute the validated specialist RPC'
);
SELECT extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_is_researcher()',
    'EXECUTE'
  ),
  'authenticated can check researcher access'
);
SELECT extensions.ok(
  NOT has_function_privilege(
    'anon',
    'private.valid_ratings_q81_v1(jsonb)',
    'EXECUTE'
  ),
  'anon cannot call private validators directly'
);
SELECT extensions.ok(
  NOT has_function_privilege(
    'anon',
    'private.submit_student_response_v1(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute the private student worker directly'
);
SELECT extensions.ok(
  NOT has_function_privilege(
    'authenticated',
    'private.submit_specialist_response_v1(uuid,text,jsonb,jsonb,text,integer,integer,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the private specialist worker directly'
);
SELECT extensions.ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=""' = ANY(coalesce(procedure.proconfig, ARRAY[]::text[]))
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = 'public.current_user_is_researcher()'::regprocedure
  ),
  'researcher access wrapper is security definer with an empty search path'
);
SELECT extensions.ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=""' = ANY(coalesce(procedure.proconfig, ARRAY[]::text[]))
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = 'public.submit_student_response_v1(uuid,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text)'::regprocedure
  ),
  'student wrapper is security definer with an empty search path'
);
SELECT extensions.ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=""' = ANY(coalesce(procedure.proconfig, ARRAY[]::text[]))
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = 'public.submit_specialist_response_v1(uuid,text,jsonb,jsonb,text,integer,integer,text,text,text,text,text,text,text,text)'::regprocedure
  ),
  'specialist wrapper is security definer with an empty search path'
);

SELECT extensions.ok(
  private.valid_ratings_q81_v1(
    (
      SELECT jsonb_object_agg(question_id, 5)
      FROM unnest(private.question_catalog_q81_v1()) AS question_id
    )
  ),
  'all 81 integer ratings are valid'
);
SELECT extensions.ok(
  NOT private.valid_ratings_q81_v1('{"T1": 5}'::jsonb),
  'an incomplete rating object is invalid'
);
SELECT extensions.ok(
  private.valid_selected_values_v1('["Prestige", "Creativity"]'::jsonb),
  'canonical distinct values are valid'
);
SELECT extensions.ok(
  NOT private.valid_selected_values_v1('["Prestige", "Prestige"]'::jsonb),
  'duplicate values are invalid'
);
SELECT extensions.ok(
  private.valid_client_scores_v1(
    (
      SELECT jsonb_agg(
        jsonb_build_object('specialty', specialty_name, 'score', 50)
        ORDER BY position
      )
      FROM unnest(private.specialty_catalog_v1())
        WITH ORDINALITY AS catalog(specialty_name, position)
    )
  ),
  'a complete canonical client ranking is structurally valid'
);

DO $$
BEGIN
  PERFORM set_config(
    'q_project_test.valid_ratings',
    (
      SELECT jsonb_object_agg(question_id, 5)::text
      FROM unnest(private.question_catalog_q81_v1()) AS question_id
    ),
    true
  );
  PERFORM set_config(
    'q_project_test.valid_scores',
    (
      SELECT jsonb_agg(
        jsonb_build_object('specialty', specialty_name, 'score', 50)
        ORDER BY position
      )::text
      FROM unnest(private.specialty_catalog_v1())
        WITH ORDINALITY AS catalog(specialty_name, position)
    ),
    true
  );
END;
$$;

SET LOCAL ROLE anon;

SELECT extensions.is(
  public.submit_student_response_v1(
    '10000000-0000-4000-8000-000000000001'::uuid,
    6,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    current_setting('q_project_test.valid_scores')::jsonb,
    'en',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v1',
    'research-consent-2026-08-26'
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'anon can submit one valid student response'
);

SELECT extensions.is(
  public.submit_student_response_v1(
    '10000000-0000-4000-8000-000000000001'::uuid,
    6,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    current_setting('q_project_test.valid_scores')::jsonb,
    'en',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v1',
    'research-consent-2026-08-26'
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'replaying the same submission id is idempotent'
);

SELECT extensions.is(
  public.submit_specialist_response_v1(
    '20000000-0000-4000-8000-000000000001'::uuid,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    'en',
    10,
    5,
    'yes',
    'probably_not',
    'fully_voluntary',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v1',
    'research-consent-2026-08-26'
  ),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'anon can submit one valid specialist response'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.submit_student_response_v1(
      '10000000-0000-4000-8000-000000000001'::uuid,
      7,
      'Cardiology',
      current_setting('q_project_test.valid_ratings')::jsonb,
      '["Prestige"]'::jsonb,
      current_setting('q_project_test.valid_scores')::jsonb,
      'en',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'client-scoring-v1',
      'research-consent-2026-08-26'
    )
  $$,
  '23505',
  'Submission id already exists with a different payload',
  'a student submission id cannot be replayed with a different payload'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.submit_specialist_response_v1(
      '20000000-0000-4000-8000-000000000001'::uuid,
      'Cardiology',
      current_setting('q_project_test.valid_ratings')::jsonb,
      '["Prestige"]'::jsonb,
      'en',
      11,
      5,
      'yes',
      'probably_not',
      'fully_voluntary',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'calibration-v1',
      'research-consent-2026-08-26'
    )
  $$,
  '23505',
  'Submission id already exists with a different payload',
  'a specialist submission id cannot be replayed with a different payload'
);

SELECT extensions.throws_ok(
  $$
    SELECT public.submit_student_response_v1(
      '10000000-0000-4000-8000-000000000002'::uuid,
      6,
      'Cardiology',
      '{}'::jsonb,
      '["Prestige"]'::jsonb,
      current_setting('q_project_test.valid_scores')::jsonb,
      'en',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'client-scoring-v1',
      'research-consent-2026-08-26'
    )
  $$,
  '22023',
  'Invalid student research submission',
  'invalid anonymous submissions are rejected'
);

RESET ROLE;

SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.student_responses
    WHERE id = '10000000-0000-4000-8000-000000000001'::uuid
  ),
  1::bigint,
  'idempotency leaves one student row'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.specialist_responses
    WHERE id = '20000000-0000-4000-8000-000000000001'::uuid
  ),
  1::bigint,
  'one specialist row was stored'
);

/* A future permissive policy must still be constrained by the restrictive guard. */
CREATE POLICY "test_open_student_read"
ON public.student_responses
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "test_open_specialist_read"
ON public.specialist_responses
FOR SELECT TO authenticated
USING (true);

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
END;
$$;
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.current_user_is_researcher(),
  false,
  'an ordinary authenticated account is not a researcher'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.student_responses),
  0::bigint,
  'RLS hides rows from an ordinary authenticated account'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.specialist_responses),
  0::bigint,
  'the restrictive guard survives a permissive specialist policy'
);

RESET ROLE;

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '40000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'researcher@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

INSERT INTO private.researchers (user_id, display_name)
VALUES (
  '40000000-0000-4000-8000-000000000001'::uuid,
  'Database test researcher'
);

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
END;
$$;
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.current_user_is_researcher(),
  true,
  'an allowlisted account is recognized as a researcher'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.student_responses
    WHERE id = '10000000-0000-4000-8000-000000000001'::uuid
  ),
  1::bigint,
  'an allowlisted researcher can read student rows'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.specialist_responses
    WHERE id = '20000000-0000-4000-8000-000000000001'::uuid
  ),
  1::bigint,
  'an allowlisted researcher can read specialist rows'
);

SELECT extensions.is(
  public.current_user_portal_profile() ->> 'role',
  'researcher'::text,
  'new allowlisted users default to the read-only researcher role'
);
SELECT extensions.is(
  (public.current_user_portal_profile() ->> 'can_edit')::boolean,
  false,
  'a researcher cannot edit the specialty catalog'
);
SELECT extensions.throws_ok(
  $$ SELECT public.get_specialty_catalog_draft() $$,
  '42501',
  'This account is not authorized for this portal action',
  'a researcher cannot read the administrative draft'
);

RESET ROLE;
UPDATE private.researchers
SET portal_role = 'doctor'
WHERE user_id = '40000000-0000-4000-8000-000000000001'::uuid;
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  public.current_user_portal_profile() ->> 'role',
  'doctor'::text,
  'the allowlist role is returned by the portal profile RPC'
);
SELECT extensions.is(
  (
    WITH catalog AS (
      SELECT public.get_specialty_catalog_draft() AS payload
    ), selected_entry AS (
      SELECT catalog.payload, entry.value AS entry
      FROM catalog
      CROSS JOIN LATERAL jsonb_array_elements(catalog.payload -> 'specialties') AS entry
      WHERE entry.value ->> 'name' = 'Cardiology'
    )
    SELECT public.save_specialty_catalog_entry_draft(
      (payload ->> 'version_id')::uuid,
      (payload ->> 'lock_version')::bigint,
      entry ->> 'name',
      entry -> 'descriptions',
      entry -> 'clinical_summaries',
      entry -> 'profile',
      'Database test Doctor draft save'
    ) ->> 'status'
    FROM selected_entry
  ),
  'draft'::text,
  'a Doctor can create and save an optimistic-locking draft'
);
SELECT extensions.throws_ok(
  $$
    WITH catalog AS (
      SELECT public.get_specialty_catalog_draft() AS payload
    ), selected_entry AS (
      SELECT catalog.payload, entry.value AS entry
      FROM catalog
      CROSS JOIN LATERAL jsonb_array_elements(catalog.payload -> 'specialties') AS entry
      WHERE entry.value ->> 'name' = 'Occupational Medicine'
    )
    SELECT public.save_specialty_catalog_entry_draft(
      (payload ->> 'version_id')::uuid,
      (payload ->> 'lock_version')::bigint,
      entry ->> 'name',
      entry -> 'descriptions',
      entry -> 'clinical_summaries',
      jsonb_set(entry -> 'profile', '{prevention_orientation,0}', '80'::jsonb, false),
      'Attempt to change an unmeasured trait'
    )
    FROM selected_entry
  $$,
  '22023',
  'prevention_orientation is unmeasured and cannot be changed',
  'the database prevents changes to prevention orientation'
);
SELECT extensions.throws_ok(
  $$
    WITH catalog AS (
      SELECT public.get_specialty_catalog_draft() AS payload
    )
    SELECT public.publish_specialty_catalog_draft(
      (payload ->> 'version_id')::uuid,
      (payload ->> 'lock_version')::bigint,
      'Doctor must not publish this draft'
    )
    FROM catalog
  $$,
  '42501',
  'This account is not authorized for this portal action',
  'a Doctor cannot publish a draft'
);

RESET ROLE;
UPDATE private.researchers
SET portal_role = 'professor'
WHERE user_id = '40000000-0000-4000-8000-000000000001'::uuid;
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  (
    WITH catalog AS (
      SELECT public.get_specialty_catalog_draft() AS payload
    )
    SELECT
      jsonb_array_length(
        public.publish_specialty_catalog_draft(
          (payload ->> 'version_id')::uuid,
          (payload ->> 'lock_version')::bigint,
          'Database test Professor publication'
        ) -> 'specialties'
      ) = 58
    FROM catalog
  ),
  'a Professor can publish a complete 58-specialty snapshot'
);
SELECT extensions.throws_ok(
  $$
    SELECT public.submit_student_response_v2(
      '10000000-0000-4000-8000-000000000001'::uuid,
      6,
      'Cardiology',
      current_setting('q_project_test.valid_ratings')::jsonb,
      '["Prestige"]'::jsonb,
      current_setting('q_project_test.valid_scores')::jsonb,
      'en',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'client-scoring-v1',
      'research-consent-2026-08-26',
      (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
    )
  $$,
  '23505',
  'Submission id already exists with different specialty catalog provenance',
  'v2 cannot attach provenance retroactively to an existing v1 row'
);
SELECT extensions.is(
  public.submit_student_response_v2(
    '10000000-0000-4000-8000-000000000003'::uuid,
    6,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    current_setting('q_project_test.valid_scores')::jsonb,
    'en',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v1',
    'research-consent-2026-08-26',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '10000000-0000-4000-8000-000000000003'::uuid,
  'student v2 attaches an exact published specialty catalog version'
);
SELECT extensions.is(
  public.submit_specialist_response_v2(
    '20000000-0000-4000-8000-000000000003'::uuid,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    'en',
    10,
    5,
    'yes',
    'probably_not',
    'fully_voluntary',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v1',
    'research-consent-2026-08-26',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '20000000-0000-4000-8000-000000000003'::uuid,
  'specialist v2 attaches an exact published specialty catalog version'
);
SELECT extensions.is(
  (
    SELECT count(*)
    FROM (
      SELECT specialty_config_version_id, specialty_config_revision
      FROM public.student_responses
      WHERE id = '10000000-0000-4000-8000-000000000003'::uuid
      UNION ALL
      SELECT specialty_config_version_id, specialty_config_revision
      FROM public.specialist_responses
      WHERE id = '20000000-0000-4000-8000-000000000003'::uuid
    ) AS provenance
    WHERE provenance.specialty_config_version_id =
      (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
      AND provenance.specialty_config_revision =
      (public.get_active_specialty_catalog() -> 'version' ->> 'revision')::bigint
  ),
  2::bigint,
  'both v2 response kinds retain matching UUID and revision provenance'
);
SELECT extensions.is(
  public.submit_student_response_v3(
    '10000000-0000-4000-8000-000000000004'::uuid,
    6,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    current_setting('q_project_test.valid_scores')::jsonb,
    'en',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v2',
    'research-consent-2026-09-04',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '10000000-0000-4000-8000-000000000004'::uuid,
  'student v3 stores a schema-2 submission with current scoring provenance'
);
SELECT extensions.is(
  public.submit_student_response_v3(
    '10000000-0000-4000-8000-000000000004'::uuid,
    6,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    current_setting('q_project_test.valid_scores')::jsonb,
    'en',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v2',
    'research-consent-2026-09-04',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '10000000-0000-4000-8000-000000000004'::uuid,
  'replaying an identical student v3 payload is idempotent'
);
SELECT extensions.is(
  public.submit_specialist_response_v3(
    '20000000-0000-4000-8000-000000000004'::uuid,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    'en',
    'The specialty now combines longitudinal care with increasingly complex technology.',
    'Multidisciplinary decisions and digital monitoring have become more important.',
    'Sound clinical judgment under uncertainty.',
    'yes',
    NULL,
    'Would I enjoy the daily work and not only the idea of this specialty?',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v2-qualitative',
    'research-consent-2026-09-04',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '20000000-0000-4000-8000-000000000004'::uuid,
  'specialist v3 stores the five post-questionnaire qualitative answers'
);
SELECT extensions.ok(
  (
    SELECT
      response.submission_schema_version = 2
      AND response.years_of_experience IS NULL
      AND response.career_satisfaction IS NULL
      AND response.intention_to_change_code IS NULL
      AND response.voluntary_choice_code IS NULL
      AND response.current_specialty_view =
        'The specialty now combines longitudinal care with increasingly complex technology.'
      AND response.specialty_changes_over_years =
        'Multidisciplinary decisions and digital monitoring have become more important.'
      AND response.most_important_specialty_quality =
        'Sound clinical judgment under uncertainty.'
      AND response.would_choose_again_code = 'yes'
      AND response.would_not_choose_again_reason IS NULL
      AND response.student_self_question =
        'Would I enjoy the daily work and not only the idea of this specialty?'
    FROM public.specialist_responses AS response
    WHERE response.id = '20000000-0000-4000-8000-000000000004'::uuid
  ),
  'schema-2 yes rows preserve qualitative answers and leave retired fields null'
);
SELECT extensions.is(
  public.submit_specialist_response_v3(
    '20000000-0000-4000-8000-000000000005'::uuid,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    'fr',
    'La spécialité reste intellectuellement stimulante mais très exigeante.',
    'La charge administrative et les outils numériques ont fortement augmenté.',
    'Le jugement clinique et la capacité à prioriser.',
    'no',
    'Je choisirais une activité avec un rythme plus soutenable à long terme.',
    'Est-ce que le quotidien réel de cette spécialité correspond à mes priorités ?',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v2-qualitative',
    'research-consent-2026-09-04',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '20000000-0000-4000-8000-000000000005'::uuid,
  'specialist v3 accepts a no answer when its explanation is present'
);
SELECT extensions.ok(
  (
    SELECT response.would_choose_again_code = 'no'
      AND response.would_not_choose_again_reason =
        'Je choisirais une activité avec un rythme plus soutenable à long terme.'
    FROM public.specialist_responses AS response
    WHERE response.id = '20000000-0000-4000-8000-000000000005'::uuid
  ),
  'schema-2 no rows retain the required conditional explanation'
);
SELECT extensions.throws_ok(
  $$
    SELECT public.submit_specialist_response_v3(
      '20000000-0000-4000-8000-000000000006'::uuid,
      'Cardiology',
      current_setting('q_project_test.valid_ratings')::jsonb,
      '["Prestige"]'::jsonb,
      'en',
      'A valid current view.',
      'A valid description of change.',
      'A valid required quality.',
      'yes',
      'This must be null for a yes response.',
      'A valid student self-question?',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'calibration-v2-qualitative',
      'research-consent-2026-09-04',
      (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
    )
  $$,
  '22023',
  'Invalid specialist research submission',
  'specialist v3 rejects a reason attached to a yes response'
);
SELECT extensions.throws_ok(
  $$
    SELECT public.submit_specialist_response_v3(
      '20000000-0000-4000-8000-000000000007'::uuid,
      'Cardiology',
      current_setting('q_project_test.valid_ratings')::jsonb,
      '["Prestige"]'::jsonb,
      'en',
      'A valid current view.',
      'A valid description of change.',
      'A valid required quality.',
      'no',
      NULL,
      'A valid student self-question?',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'calibration-v2-qualitative',
      'research-consent-2026-09-04',
      (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
    )
  $$,
  '22023',
  'Invalid specialist research submission',
  'specialist v3 requires an explanation for a no response'
);
SELECT extensions.is(
  public.submit_specialist_response_v3(
    '20000000-0000-4000-8000-000000000004'::uuid,
    'Cardiology',
    current_setting('q_project_test.valid_ratings')::jsonb,
    '["Prestige"]'::jsonb,
    'en',
    'The specialty now combines longitudinal care with increasingly complex technology.',
    'Multidisciplinary decisions and digital monitoring have become more important.',
    'Sound clinical judgment under uncertainty.',
    'yes',
    NULL,
    'Would I enjoy the daily work and not only the idea of this specialty?',
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v2-qualitative',
    'research-consent-2026-09-04',
    (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
  ),
  '20000000-0000-4000-8000-000000000004'::uuid,
  'replaying an identical specialist v3 payload is idempotent'
);
SELECT extensions.throws_ok(
  $$
    SELECT public.submit_specialist_response_v3(
      '20000000-0000-4000-8000-000000000004'::uuid,
      'Cardiology',
      current_setting('q_project_test.valid_ratings')::jsonb,
      '["Prestige"]'::jsonb,
      'en',
      'A different current specialty view.',
      'Multidisciplinary decisions and digital monitoring have become more important.',
      'Sound clinical judgment under uncertainty.',
      'yes',
      NULL,
      'Would I enjoy the daily work and not only the idea of this specialty?',
      'q81-v1',
      'career-values-v1',
      'medical-specialties-v1',
      'calibration-v2-qualitative',
      'research-consent-2026-09-04',
      (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid
    )
  $$,
  '23505',
  'Submission id already exists with a different payload',
  'a specialist v3 id cannot be replayed with changed qualitative text'
);
SELECT extensions.ok(
  (
    WITH history AS (
      SELECT item.value AS version
      FROM jsonb_array_elements(
        public.list_specialty_catalog_versions(50) -> 'versions'
      ) AS item
      WHERE item.value ->> 'status' = 'archived'
      ORDER BY (item.value ->> 'revision')::bigint
      LIMIT 1
    )
    SELECT jsonb_array_length(
      public.restore_specialty_catalog_version(
        (version ->> 'id')::uuid,
        (public.get_active_specialty_catalog() -> 'version' ->> 'id')::uuid,
        'Database test Professor restoration'
      ) -> 'specialties'
    ) = 58
    FROM history
  ),
  'a Professor can restore a published snapshot as a new active revision'
);
SELECT extensions.is(
  public.get_specialty_catalog_draft() ->> 'status',
  'active'::text,
  'an immediate restore leaves no mutable draft behind'
);

RESET ROLE;

-- Raise on any failed assertion so direct SQL runners fail just like pg_prove.
SELECT * FROM extensions.finish(true);
ROLLBACK;
