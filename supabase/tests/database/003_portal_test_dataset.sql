BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

INSERT INTO auth.users (id, email) VALUES
  ('64000000-0000-4000-8000-000000000001', 'test-dataset-ordinary@example.test'),
  ('64000000-0000-4000-8000-000000000002', 'test-dataset-researcher@example.test'),
  ('64000000-0000-4000-8000-000000000003', 'test-dataset-disabled@example.test'),
  ('64000000-0000-4000-8000-000000000004', 'test-dataset-doctor@example.test'),
  ('64000000-0000-4000-8000-000000000005', 'test-dataset-professor@example.test');
INSERT INTO private.researchers (user_id, display_name, enabled, portal_role) VALUES
  ('64000000-0000-4000-8000-000000000002', 'Dataset researcher', true, 'researcher'),
  ('64000000-0000-4000-8000-000000000003', 'Disabled dataset admin', false, 'professor'),
  ('64000000-0000-4000-8000-000000000004', 'Dataset doctor', true, 'doctor'),
  ('64000000-0000-4000-8000-000000000005', 'Dataset professor', true, 'professor');

CREATE FUNCTION pg_temp.research_fingerprint()
RETURNS jsonb LANGUAGE sql AS $fingerprint$
  SELECT jsonb_build_object(
    'students', (SELECT md5(coalesce(jsonb_agg(to_jsonb(row) ORDER BY id), '[]'::jsonb)::text) FROM public.student_responses row),
    'specialists', (SELECT md5(coalesce(jsonb_agg(to_jsonb(row) ORDER BY id), '[]'::jsonb)::text) FROM public.specialist_responses row),
    'map_cells', (SELECT md5(coalesce(jsonb_agg(to_jsonb(row) ORDER BY month,country_code,respondent_type,language,questionnaire_version,data_version), '[]'::jsonb)::text) FROM private.participation_map_cells row),
    'map_months', (SELECT md5(coalesce(jsonb_agg(to_jsonb(row) ORDER BY month), '[]'::jsonb)::text) FROM private.participation_map_months row)
  );
$fingerprint$;
DO $initial$
BEGIN
  PERFORM set_config('q_dataset_test.fingerprint', pg_temp.research_fingerprint()::text, true);
END;
$initial$;

SELECT extensions.is((SELECT count(*) FROM private.portal_test_dataset), 0::bigint,
  'migration does not automatically create synthetic data');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.portal_test_dataset'::regclass),
  'synthetic recipe table enables RLS'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'private.portal_test_dataset', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.portal_test_dataset', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.portal_test_dataset', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'private.portal_test_dataset', 'DELETE'),
  'no client can directly read or write the synthetic recipe table'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'private.portal_test_dataset'::regclass
      AND conname = 'portal_test_dataset_singleton_key' AND contype = 'u'),
  'a database unique constraint guarantees one recipe even across concurrent sessions'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'private.get_portal_test_dataset()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_portal_test_dataset()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.delete_portal_test_dataset(uuid)', 'EXECUTE'),
  'private CRUD implementations are not directly callable by clients'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$actor$;
SET LOCAL ROLE anon;
SELECT extensions.throws_ok(
  $$SELECT public.get_portal_test_dataset()$$,
  '42501', NULL,
  'anonymous visitor is denied get_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_portal_test_dataset()$$,
  '42501', NULL,
  'anonymous visitor is denied create_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.delete_portal_test_dataset('64000000-0000-4000-8000-000000000099')$$,
  '42501', NULL,
  'anonymous visitor is denied delete_portal_test_dataset'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"64000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$SELECT public.get_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'ordinary account is denied get_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'ordinary account is denied create_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.delete_portal_test_dataset('64000000-0000-4000-8000-000000000099')$$,
  '42501', 'This account is not authorized for this portal action',
  'ordinary account is denied delete_portal_test_dataset'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"64000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$SELECT public.get_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'researcher is denied get_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'researcher is denied create_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.delete_portal_test_dataset('64000000-0000-4000-8000-000000000099')$$,
  '42501', 'This account is not authorized for this portal action',
  'researcher is denied delete_portal_test_dataset'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000003', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"64000000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$SELECT public.get_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'disabled administrator is denied get_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'disabled administrator is denied create_portal_test_dataset'
);
SELECT extensions.throws_ok(
  $$SELECT public.delete_portal_test_dataset('64000000-0000-4000-8000-000000000099')$$,
  '42501', 'This account is not authorized for this portal action',
  'disabled administrator is denied delete_portal_test_dataset'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000004', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"64000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.get_portal_test_dataset(), NULL::jsonb, 'doctor sees null before test data is created');
SELECT extensions.is(public.delete_portal_test_dataset(gen_random_uuid()), false, 'deleting from an empty test dataset is harmless');
DO $create$
BEGIN
  PERFORM set_config('q_dataset_test.original', public.create_portal_test_dataset()::text, true);
END;
$create$;
SELECT extensions.ok(
  (current_setting('q_dataset_test.original')::jsonb->>'seed')::bigint BETWEEN 1 AND 2147483647,
  'server generates a positive signed-32-bit random seed'
);
SELECT extensions.is(
  current_setting('q_dataset_test.original')::jsonb->>'generator_version',
  'portal-test-v1', 'synthetic generator protocol is explicit'
);
SELECT extensions.ok(
  (current_setting('q_dataset_test.original')::jsonb->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  'server generates a v4 dataset UUID'
);
SELECT extensions.ok(
  (current_setting('q_dataset_test.original')::jsonb->>'created_at')::timestamptz IS NOT NULL,
  'dataset has a server creation timestamp'
);
SELECT extensions.is(
  current_setting('q_dataset_test.original')::jsonb->'catalog',
  public.get_active_specialty_catalog(), 'dataset returns the exact published catalog payload'
);
SELECT extensions.is(
  public.get_portal_test_dataset(), current_setting('q_dataset_test.original')::jsonb,
  'doctor reads the persisted recipe'
);
SELECT extensions.is(
  public.create_portal_test_dataset(), current_setting('q_dataset_test.original')::jsonb,
  'same-session repeated creation is idempotent'
);
SELECT extensions.is(public.delete_portal_test_dataset(gen_random_uuid()), false, 'wrong dataset UUID cannot delete active test data');
SELECT extensions.is(public.delete_portal_test_dataset(NULL), false, 'null dataset UUID cannot delete active test data');

RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM private.portal_test_dataset), 1::bigint, 'there is exactly one test recipe after retries');
SELECT extensions.is(
  (SELECT created_by FROM private.portal_test_dataset),
  '64000000-0000-4000-8000-000000000004'::uuid, 'creation records the authorized actor internally'
);
SELECT extensions.is(pg_temp.research_fingerprint(), current_setting('q_dataset_test.fingerprint')::jsonb,
  'creation and reads leave research responses and map releases byte-equivalent');
SELECT extensions.throws_ok(
  $$INSERT INTO private.portal_test_dataset(seed,catalog_version_id)
    SELECT 123, catalog_version_id FROM private.portal_test_dataset$$,
  '23505', NULL, 'database rejects a second singleton independently of application locks'
);
SELECT extensions.throws_ok(
  $$UPDATE private.portal_test_dataset SET singleton = false$$,
  '23514', NULL, 'singleton cannot be bypassed by setting it false'
);
SELECT extensions.throws_ok(
  $$UPDATE private.portal_test_dataset SET seed = 0$$,
  '23514', NULL, 'zero seed is rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE private.portal_test_dataset SET generator_version = 'unknown'$$,
  '23514', NULL, 'unknown generator versions are rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE private.portal_test_dataset SET catalog_version_id = gen_random_uuid()$$,
  '22023', 'The requested specialty catalog version is not a published snapshot',
  'recipe cannot reference a nonexistent catalog'
);
INSERT INTO private.specialty_catalog_versions (label,status,note)
VALUES ('Test unpublished catalog','draft','Test-only unpublished catalog');
SELECT extensions.throws_ok(
  $$UPDATE private.portal_test_dataset SET catalog_version_id =
    (SELECT id FROM private.specialty_catalog_versions WHERE status = 'draft')$$,
  '22023', 'The requested specialty catalog version is not a published snapshot',
  'recipe cannot reference an unpublished draft'
);

-- Simulate a newer active snapshot in this rolled-back test transaction.
-- The dataset must continue referencing its original archived publication.
DO $new_catalog$
DECLARE old_catalog uuid; new_catalog uuid;
BEGIN
  SELECT catalog_version_id INTO old_catalog FROM private.portal_test_dataset;
  UPDATE private.specialty_catalog_versions SET status = 'archived' WHERE id = old_catalog;
  INSERT INTO private.specialty_catalog_versions(label,status,note,published_at,checksum)
    SELECT label || '-new-test', 'active', 'Test-only later publication', now(), checksum
    FROM private.specialty_catalog_versions WHERE id = old_catalog RETURNING id INTO new_catalog;
  INSERT INTO private.specialty_catalog_entries(version_id,name,category,descriptions,clinical_summaries,profile)
    SELECT new_catalog,name,category,descriptions,clinical_summaries,profile
    FROM private.specialty_catalog_entries WHERE version_id = old_catalog;
END;
$new_catalog$;
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000005', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"64000000-0000-4000-8000-000000000005","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  public.get_portal_test_dataset(), current_setting('q_dataset_test.original')::jsonb,
  'professor receives the same frozen catalog after another catalog becomes active'
);
SELECT extensions.is(
  public.create_portal_test_dataset(), current_setting('q_dataset_test.original')::jsonb,
  'another administrator retry does not replace the active synthetic recipe'
);
SELECT extensions.is(
  public.delete_portal_test_dataset((current_setting('q_dataset_test.original')::jsonb->>'id')::uuid),
  true, 'professor can delete the exact synthetic dataset'
);
SELECT extensions.is(public.get_portal_test_dataset(), NULL::jsonb, 'successful deletion returns dataset to empty state');
SELECT extensions.is(
  public.delete_portal_test_dataset((current_setting('q_dataset_test.original')::jsonb->>'id')::uuid),
  false, 'repeated deletion is idempotent'
);
DO $recreate$
BEGIN
  PERFORM set_config('q_dataset_test.recreated', public.create_portal_test_dataset()::text, true);
END;
$recreate$;
SELECT extensions.ok(
  current_setting('q_dataset_test.recreated')::jsonb->>'id'
    <> current_setting('q_dataset_test.original')::jsonb->>'id',
  'explicit recreation produces a new dataset identity'
);
SELECT extensions.is(
  current_setting('q_dataset_test.recreated')::jsonb->'catalog',
  public.get_active_specialty_catalog(), 'new recipe uses the newly active published catalog'
);
SELECT extensions.is(
  public.delete_portal_test_dataset((current_setting('q_dataset_test.original')::jsonb->>'id')::uuid),
  false, 'stale deletion from an old tab cannot remove a newly created dataset'
);
SELECT extensions.is(
  public.get_portal_test_dataset(), current_setting('q_dataset_test.recreated')::jsonb,
  'new recipe survives the stale deletion request'
);
RESET ROLE;
UPDATE private.researchers SET enabled = false
WHERE user_id = '64000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$SELECT public.get_portal_test_dataset()$$,
  '42501', 'This account is not authorized for this portal action',
  'disabling an administrator immediately revokes synthetic-data access'
);
RESET ROLE;
DO $actor$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000004', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"64000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"professor"}}', true);
END;
$actor$;
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  public.delete_portal_test_dataset((current_setting('q_dataset_test.recreated')::jsonb->>'id')::uuid),
  true, 'doctor can also delete a dataset created by another administrator'
);
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM private.portal_test_dataset), 0::bigint, 'deletion removes only the test recipe');
SELECT extensions.is(pg_temp.research_fingerprint(), current_setting('q_dataset_test.fingerprint')::jsonb,
  'all synthetic CRUD operations leave real responses, consent data and public-map snapshots untouched');

SELECT * FROM extensions.finish();
ROLLBACK;
