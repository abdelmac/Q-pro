BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(43);

SELECT extensions.has_schema('private', 'private schema exists');
SELECT extensions.has_table('public', 'student_responses', 'student table exists');
SELECT extensions.has_table('public', 'specialist_responses', 'specialist table exists');

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

RESET ROLE;

-- Raise on any failed assertion so direct SQL runners fail just like pg_prove.
SELECT * FROM extensions.finish(true);
ROLLBACK;
