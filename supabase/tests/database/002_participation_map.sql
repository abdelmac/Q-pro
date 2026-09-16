BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- Minimal Auth fixtures; authorization comes from the private allowlist,
-- never from a role string supplied in editable user metadata or JWT claims.
INSERT INTO auth.users (id, email) VALUES
  ('63000000-0000-4000-8000-000000000001', 'map-ordinary@example.test'),
  ('63000000-0000-4000-8000-000000000002', 'map-researcher@example.test'),
  ('63000000-0000-4000-8000-000000000003', 'map-disabled-admin@example.test'),
  ('63000000-0000-4000-8000-000000000004', 'map-doctor@example.test'),
  ('63000000-0000-4000-8000-000000000005', 'map-professor@example.test');
INSERT INTO private.researchers (user_id, display_name, enabled, portal_role) VALUES
  ('63000000-0000-4000-8000-000000000002', 'Map researcher', true, 'researcher'),
  ('63000000-0000-4000-8000-000000000003', 'Disabled map administrator', false, 'professor'),
  ('63000000-0000-4000-8000-000000000004', 'Map doctor', true, 'doctor'),
  ('63000000-0000-4000-8000-000000000005', 'Map professor', true, 'professor');

DO $fixtures$
BEGIN
  PERFORM set_config('q_map_test.ratings', (
    SELECT jsonb_object_agg(question_id, 5)::text
    FROM unnest(private.question_catalog_q81_v1()) AS question_id
  ), true);
  PERFORM set_config('q_map_test.scores', (
    SELECT jsonb_agg(jsonb_build_object('specialty', specialty_name, 'score', 50) ORDER BY position)::text
    FROM unnest(private.specialty_catalog_v1()) WITH ORDINALITY AS catalog(specialty_name, position)
  ), true);
  PERFORM set_config('q_map_test.catalog', (
    SELECT id::text FROM private.specialty_catalog_versions WHERE status = 'active'
  ), true);
END;
$fixtures$;

CREATE FUNCTION pg_temp.participant(
  submission_id uuid,
  country text DEFAULT NULL,
  region text DEFAULT NULL,
  participant text DEFAULT 'student',
  locale text DEFAULT 'en',
  consent text DEFAULT 'research-consent-2026-09-16-geography'
)
RETURNS uuid LANGUAGE sql AS $fixture$
  SELECT public.submit_student_response_v6(
    submission_id, participant, NULL, NULL, NULL,
    current_setting('q_map_test.ratings')::jsonb, '["Prestige"]'::jsonb,
    current_setting('q_map_test.scores')::jsonb, locale,
    'q81-v1', 'career-values-v1', 'medical-specialties-v1', 'client-scoring-v2', consent,
    'medicine-view-optional-v2', current_setting('q_map_test.catalog')::uuid, country, region
  );
$fixture$;
CREATE FUNCTION pg_temp.specialist(
  submission_id uuid,
  country text DEFAULT NULL,
  region text DEFAULT NULL,
  completed boolean DEFAULT true,
  locale text DEFAULT 'en',
  consent text DEFAULT 'research-consent-2026-09-16-geography'
)
RETURNS uuid LANGUAGE sql AS $fixture$
  SELECT public.submit_specialist_response_v5(
    submission_id, 'Cardiology',
    CASE WHEN completed THEN current_setting('q_map_test.ratings')::jsonb ELSE '{}'::jsonb END,
    CASE WHEN completed THEN '["Prestige"]'::jsonb ELSE '[]'::jsonb END,
    completed, locale, 'Current perspective', 'Changes over time', 'Empathy', 'yes', NULL,
    'What kind of work suits me?', 'q81-v1', 'career-values-v1', 'medical-specialties-v1',
    'calibration-v2-qualitative', consent, current_setting('q_map_test.catalog')::uuid, country, region
  );
$fixture$;

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.student_responses', 'SELECT'),
  'anonymous map access does not grant raw participant access'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.specialist_responses', 'SELECT'),
  'anonymous map access does not grant raw specialist access'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.participation_map_cells', 'SELECT'),
  'signed-in clients cannot read the private release table directly'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'private.publish_participation_map_month(date)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.publish_participation_map_month(date)', 'EXECUTE')
  AND has_function_privilege('service_role', 'private.publish_participation_map_month(date)', 'EXECUTE'),
  'only the service role and database owner can publish months'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'private.get_participation_map_stats(text,text,text,date,date,text)', 'EXECUTE')
  AND has_function_privilege('anon', 'public.get_participation_map_stats(text,text,text,date,date,text)', 'EXECUTE'),
  'public map wrapper is callable while its private implementation stays private'
);
SELECT extensions.is(
  (SELECT count(*) FROM pg_class WHERE oid IN (
    'private.participation_map_cells'::regclass, 'private.participation_map_months'::regclass
  ) AND relrowsecurity), 2::bigint, 'both private map tables also enable RLS'
);
SELECT extensions.is(
  (SELECT count(*) FROM generate_series(65,90) a CROSS JOIN generate_series(65,90) b
   WHERE private.participation_country_name(chr(a)||chr(b)) IS NOT NULL),
  249::bigint, 'only the 249 canonical ISO alpha-2 codes are accepted'
);

SET LOCAL ROLE anon;
SELECT extensions.is(
  public.submit_student_response_v6(
    '61000000-0000-4000-8000-000000000001', 'student', NULL, NULL, NULL,
    current_setting('q_map_test.ratings')::jsonb, '["Prestige"]'::jsonb,
    current_setting('q_map_test.scores')::jsonb, 'en',
    'q81-v1', 'career-values-v1', 'medical-specialties-v1', 'client-scoring-v2',
    'research-consent-2026-09-16-geography', 'medicine-view-optional-v2',
    current_setting('q_map_test.catalog')::uuid, NULL, NULL
  ), '61000000-0000-4000-8000-000000000001'::uuid,
  'anonymous participants can save without medicine text or geography'
);
SELECT extensions.is(
  (public.get_participation_map_stats()->>'total')::bigint,
  0::bigint, 'anonymous visitors can load the unfiltered public overview'
);
SELECT extensions.throws_ok(
  $$SELECT private.publish_participation_map_month('2001-01-01')$$,
  '42501', NULL, 'anonymous clients cannot trigger publication'
);
SELECT extensions.is(
  public.submit_specialist_response_v5(
    '62000000-0000-4000-8000-000000000001', 'Cardiology', '{}'::jsonb, '[]'::jsonb,
    false, 'en', 'Current perspective', 'Changes over time', 'Empathy', 'yes', NULL,
    'What kind of work suits me?', 'q81-v1', 'career-values-v1', 'medical-specialties-v1',
    'calibration-v2-qualitative', 'research-consent-2026-09-16-geography',
    current_setting('q_map_test.catalog')::uuid, 'FR', NULL
  ), '62000000-0000-4000-8000-000000000001'::uuid,
  'anonymous specialist endpoint permits voluntary geography with intentional questionnaire skip'
);
RESET ROLE;

-- Existing aggregation/validation assertions run with an authorized principal.
-- Explicit PostgreSQL-role boundary cases are tested at the end of this file.
DO $doctor_context$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000004', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
END;
$doctor_context$;

SELECT extensions.is(
  pg_temp.participant('61000000-0000-4000-8000-000000000001', E' \t ', E' \t '),
  '61000000-0000-4000-8000-000000000001'::uuid,
  'empty normalized geography retries are idempotent with null geography'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.student_responses WHERE id = '61000000-0000-4000-8000-000000000001'
    AND medicine_view IS NULL AND country_code IS NULL AND country_name IS NULL AND region IS NULL
    AND submission_schema_version = 5), 1::bigint,
  'missing optional fields stay null and one schema-5 row is saved'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant('61000000-0000-4000-8000-000000000001', 'RO')$$,
  '23505', 'Submission id already exists with a different payload',
  'same id with newly added geography conflicts rather than silently changing consented data'
);
SELECT extensions.lives_ok(
  $$SELECT pg_temp.participant('61000000-0000-4000-8000-000000000002', ' ro ', ' București ')$$,
  'lowercase country and surrounding spaces are normalized'
);
SELECT extensions.is(
  (SELECT jsonb_build_array(country_code, country_name, region) FROM public.student_responses
   WHERE id = '61000000-0000-4000-8000-000000000002'),
  '["RO","Romania","București"]'::jsonb, 'country name is derived server-side'
);
SELECT extensions.is(
  pg_temp.participant('61000000-0000-4000-8000-000000000002', 'RO', 'București'),
  '61000000-0000-4000-8000-000000000002'::uuid, 'normalized country/region replay is idempotent'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant('61000000-0000-4000-8000-000000000002', 'RO', 'Cluj')$$,
  '23505', 'Submission id already exists with a different payload', 'changed region conflicts'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant(gen_random_uuid(), 'ZZ')$$,
  '22023', 'Invalid voluntary geography', 'unknown country is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant(gen_random_uuid(), 'UK')$$,
  '22023', 'Invalid voluntary geography', 'noncanonical country alias is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant(gen_random_uuid(), NULL, 'Ile-de-France')$$,
  '22023', 'Invalid voluntary geography', 'region cannot be saved without a country'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant(gen_random_uuid(), 'FR', repeat('x', 101))$$,
  '22023', 'Invalid voluntary geography', 'region over 100 characters is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant(gen_random_uuid(), 'FR', E'line\nbreak')$$,
  '22023', 'Invalid voluntary geography', 'embedded control characters in region are rejected'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.participant(gen_random_uuid(), 'FR', NULL, 'student', 'en', 'research-consent-2026-09-16')$$,
  '22023', 'Invalid participant research submission', 'geography RPC requires new participant consent'
);
SELECT extensions.throws_ok(
  $$UPDATE public.student_responses SET country_name = 'Spoofed name'
    WHERE id = '61000000-0000-4000-8000-000000000002'$$,
  '23514', NULL, 'table constraint also rejects country-name spoofing'
);
SELECT extensions.throws_ok(
  $$UPDATE public.student_responses SET region = '   '
    WHERE id = '61000000-0000-4000-8000-000000000002'$$,
  '23514', NULL, 'table constraint rejects blank regions rather than accepting SQL unknown'
);
SELECT extensions.lives_ok(
  $$SELECT pg_temp.specialist('62000000-0000-4000-8000-000000000001', 'FR', NULL, false)$$,
  'specialist can supply voluntary country and deliberately skip questionnaire'
);
SELECT extensions.is(
  pg_temp.specialist('62000000-0000-4000-8000-000000000001', 'fr', '  ', false),
  '62000000-0000-4000-8000-000000000001'::uuid, 'specialist retries normalize absent region'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.specialist('62000000-0000-4000-8000-000000000001', 'RO', NULL, false)$$,
  '23505', 'Submission id already exists with a different payload', 'changed specialist country conflicts'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.specialist(gen_random_uuid(), 'ZZ')$$,
  '22023', 'Invalid voluntary geography', 'specialist RPC rejects invalid geography too'
);
SELECT extensions.throws_ok(
  $$SELECT pg_temp.specialist(gen_random_uuid(), 'RO', NULL, true, 'en', 'research-consent-2026-09-04')$$,
  '22023', 'Invalid specialist research submission', 'geography RPC requires new specialist consent'
);

-- Synthetic disjoint cells: RO students en 14 -> 10, RO specialists en 11 -> 10,
-- RO explorers fr 19 -> 15, RO students ro 9 -> suppressed, FR students en 10 -> 10.
-- Both FR skipped specialists and missing-geography participants must contribute zero.
DO $population$
DECLARE sample_id uuid;
BEGIN
  FOR i IN 1..14 LOOP
    sample_id := pg_temp.participant(gen_random_uuid(), 'RO');
    UPDATE public.student_responses SET created_at = '2001-01-10T12:00:00Z' WHERE student_responses.id = sample_id;
  END LOOP;
  FOR i IN 1..11 LOOP
    sample_id := pg_temp.specialist(gen_random_uuid(), 'RO');
    UPDATE public.specialist_responses SET created_at = '2001-01-10T12:00:00Z' WHERE specialist_responses.id = sample_id;
  END LOOP;
  FOR i IN 1..19 LOOP
    sample_id := pg_temp.participant(gen_random_uuid(), 'RO', NULL, 'curious', 'fr');
    UPDATE public.student_responses SET created_at = '2001-01-10T12:00:00Z' WHERE student_responses.id = sample_id;
  END LOOP;
  FOR i IN 1..9 LOOP
    sample_id := pg_temp.participant(gen_random_uuid(), 'RO', NULL, 'student', 'ro');
    UPDATE public.student_responses SET created_at = '2001-01-10T12:00:00Z' WHERE student_responses.id = sample_id;
  END LOOP;
  FOR i IN 1..10 LOOP
    sample_id := pg_temp.participant(gen_random_uuid(), 'FR');
    UPDATE public.student_responses SET created_at = '2001-01-10T12:00:00Z' WHERE student_responses.id = sample_id;
    sample_id := pg_temp.specialist(gen_random_uuid(), 'FR', NULL, false);
    UPDATE public.specialist_responses SET created_at = '2001-01-10T12:00:00Z' WHERE specialist_responses.id = sample_id;
    sample_id := pg_temp.participant(gen_random_uuid());
    UPDATE public.student_responses SET created_at = '2001-01-10T12:00:00Z' WHERE student_responses.id = sample_id;
  END LOOP;
END;
$population$;

SELECT extensions.is(private.publish_participation_map_month('2001-01-01'), 4,
  'only four complete disjoint cells meet the threshold');
SELECT extensions.is(
  (public.get_participation_map_stats('all', NULL, 'all', '2001-01-01', '2001-01-01')->>'total')::bigint,
  45::bigint, 'all counters exclude suppressed, skipped and unknown-country responses and round downward'
);
SELECT extensions.is(
  public.get_participation_map_stats('all', NULL, 'all', '2001-01-01', '2001-01-01')->'groups',
  '[{"countryCode":"FR","country":"France","count":10,"students":10,"specialists":0,"nonMedical":0},
    {"countryCode":"RO","country":"Romania","count":35,"students":10,"specialists":10,"nonMedical":15}]'::jsonb,
  'country output has only rounded country totals and role counters'
);
SELECT extensions.is(
  (public.get_participation_map_stats('student', NULL, 'all', '2001-01-01', '2001-01-01')->>'total')::bigint,
  20::bigint, 'student filter aggregates only students'
);
SELECT extensions.is(
  (public.get_participation_map_stats('specialist', NULL, 'all', '2001-01-01', '2001-01-01')->>'total')::bigint,
  10::bigint, 'specialist filter excludes skipped questionnaires'
);
SELECT extensions.is(
  (public.get_participation_map_stats('non_medical', NULL, 'all', '2001-01-01', '2001-01-01')->>'total')::bigint,
  15::bigint, 'curious population maps to public non_medical'
);
SELECT extensions.is(
  (public.get_participation_map_stats('all', 'ro', 'all', '2001-01-01', '2001-01-01')->>'total')::bigint,
  35::bigint, 'country filter returns the corresponding released total'
);
SELECT extensions.is(
  (public.get_participation_map_stats('all', NULL, 'ro', '2001-01-01', '2001-01-01')->>'total')::bigint,
  0::bigint, 'small language cell contributes no public count'
);
SELECT extensions.is(
  (public.get_participation_map_stats('all', NULL, 'all', '2001-01-01', '2001-01-01')->>'total')::bigint
  - (public.get_participation_map_stats('all', NULL, 'en', '2001-01-01', '2001-01-01')->>'total')::bigint
  - (public.get_participation_map_stats('all', NULL, 'fr', '2001-01-01', '2001-01-01')->>'total')::bigint,
  0::bigint, 'subtracting released language totals cannot recover nine suppressed Romanian responses'
);
SELECT extensions.is(
  public.get_participation_map_stats('all', NULL, 'all', '2001-01-01', '2001-01-01', 'current'),
  public.get_participation_map_stats('all', NULL, 'all', '2001-01-01', '2001-01-01', 'all'),
  'current protocol filter reuses the same released cells'
);
SELECT extensions.is(
  (public.get_participation_map_stats('all', NULL, 'all', '2001-02-01', '2001-02-01')->>'total')::bigint,
  0::bigint, 'inclusive full-month filter excludes other months'
);

-- Crossing a threshold or rounding boundary after publication must not leak a
-- new small difference: January is sealed forever, not recalculated on request.
DO $late_arrival$
DECLARE sample_id uuid;
BEGIN
  sample_id := pg_temp.participant(gen_random_uuid(), 'RO');
  UPDATE public.student_responses SET created_at = '2001-01-12T00:00:00Z' WHERE student_responses.id = sample_id;
  sample_id := pg_temp.participant(gen_random_uuid(), 'RO', NULL, 'student', 'ro');
  UPDATE public.student_responses SET created_at = '2001-01-12T00:00:00Z' WHERE student_responses.id = sample_id;
END;
$late_arrival$;
SELECT extensions.is(private.publish_participation_map_month('2001-01-01'), 0,
  'republishing a sealed month is an idempotent no-op');
SELECT extensions.is(
  (public.get_participation_map_stats('all', NULL, 'all', '2001-01-01', '2001-01-01')->>'total')::bigint,
  45::bigint, 'late arrivals cannot change a published month or expose a difference of one'
);
SELECT extensions.throws_ok(
  $$UPDATE private.participation_map_cells SET response_count = 15 WHERE month = '2001-01-01'$$,
  '55000', 'Published participation map months are immutable', 'published cells cannot be updated'
);
SELECT extensions.throws_ok(
  $$DELETE FROM private.participation_map_cells WHERE month = '2001-01-01'$$,
  '55000', 'Published participation map months are immutable', 'published cells cannot be deleted'
);
SELECT extensions.throws_ok(
  $$INSERT INTO private.participation_map_cells VALUES ('2001-01-01','DE','student','en','q81-v1','participant-v5',10)$$,
  '55000', 'Published participation map months are immutable', 'published months cannot gain extra cells'
);
SELECT extensions.throws_ok(
  $$DELETE FROM private.participation_map_months WHERE month = '2001-01-01'$$,
  '55000', 'Published participation map months are immutable', 'release metadata cannot be deleted'
);
SELECT extensions.throws_ok(
  $$SELECT private.publish_participation_map_month(date_trunc('month', now() AT TIME ZONE 'UTC')::date)$$,
  '22023', 'Only a complete closed UTC month can be published', 'current month cannot be published'
);
SELECT extensions.throws_ok(
  $$SELECT private.publish_participation_map_month('2001-01-02')$$,
  '22023', 'Only a complete closed UTC month can be published', 'publication requires an exact month boundary'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('curious')$$,
  '22023', 'Invalid participation map filters', 'public role filter only accepts the documented types'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', 'ZZ')$$,
  '22023', 'Invalid participation map filters', 'invalid map country is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'de')$$,
  '22023', 'Invalid participation map filters', 'invalid map language is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'all', '2001-01-02')$$,
  '22023', 'Invalid participation map filters', 'arbitrary daily windows are forbidden'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'all', '2001-02-01', '2001-01-01')$$,
  '22023', 'Invalid participation map filters', 'inverted date ranges are rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'all', NULL, NULL, 'unknown')$$,
  '22023', 'Invalid participation map filters', 'arbitrary version filters are rejected'
);
SELECT extensions.is(
  public.get_participation_map_stats()->>'privacyThreshold', '10', 'API describes its minimum cell size'
);
SELECT extensions.is(public.get_participation_map_stats()->>'rounding', '5', 'API describes downward rounding');
SELECT extensions.is(public.get_participation_map_stats()->>'granularity', 'month', 'API describes month granularity');
SELECT extensions.ok(
  NOT (public.get_participation_map_stats()::text ~ '(submission_id|created_at|region|actual_specialty|preferred_specialty)'),
  'public response excludes respondent identifiers, raw dates, regions and specialty data'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'q-pro-publish-participation-map' AND active),
  'a monthly closed-month publication job is installed'
);

-- Filters are administrative even though their data remains aggregated.
-- Default totals stay public for every account class.
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$actor$;
SET LOCAL ROLE anon;
SELECT extensions.is(
  public.get_participation_map_stats(),
  public.get_participation_map_stats('all', NULL, 'all', NULL, NULL, 'all'),
  'anonymous omitted arguments and explicit defaults return the same public overview'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('student')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous respondent-type filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', 'RO')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous country filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'fr')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous language filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'all', '2001-01-01')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous start month filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'all', NULL, '2001-01-01')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous end month filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', NULL, 'all', NULL, NULL, 'current')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous data version filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats(NULL)$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous null type filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', '')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous empty country filtering is denied server-side'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', 'ZZ')$$,
  '42501', 'This account is not authorized for this portal action',
  'anonymous invalid country before payload validation filtering is denied server-side'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok(
  $$SELECT public.get_participation_map_stats()$$,
  'ordinary authenticated can still view the unfiltered overview'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('student')$$,
  '42501', 'This account is not authorized for this portal action',
  'ordinary authenticated cannot access filters even with professor in user metadata'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok(
  $$SELECT public.get_participation_map_stats()$$,
  'researcher can still view the unfiltered overview'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('student')$$,
  '42501', 'This account is not authorized for this portal action',
  'researcher cannot access filters even with professor in user metadata'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000003', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok(
  $$SELECT public.get_participation_map_stats()$$,
  'disabled administrator can still view the unfiltered overview'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('student')$$,
  '42501', 'This account is not authorized for this portal action',
  'disabled administrator cannot access filters even with professor in user metadata'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000004', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (public.get_participation_map_stats('student', 'RO', 'en', '2001-01-01', '2001-01-01', 'current')->>'total')::bigint,
  10::bigint, 'enabled doctor can combine all map filters'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', 'ZZ')$$,
  '22023', 'Invalid participation map filters',
  'enabled doctor still receives validated filter errors'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000005', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000005","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (public.get_participation_map_stats('student', 'RO', 'en', '2001-01-01', '2001-01-01', 'current')->>'total')::bigint,
  10::bigint, 'enabled professor can combine all map filters'
);
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('all', 'ZZ')$$,
  '22023', 'Invalid participation map filters',
  'enabled professor still receives validated filter errors'
);
RESET ROLE;
-- Disabling a portal account takes effect on the next request; a still-valid
-- authenticated JWT and its stale metadata cannot preserve filter access.
UPDATE private.researchers SET enabled = false
WHERE user_id = '63000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$SELECT public.get_participation_map_stats('student')$$,
  '42501', 'This account is not authorized for this portal action',
  'revoking professor access immediately removes map filtering permission'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
