BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- Local/CI only. All synthetic activity and fixture resets roll back.
DELETE FROM site_metrics.visit_receipts;
UPDATE site_metrics.visit_count SET total = 0, minute_count = 0, day_count = 0,
  minute_started_at = clock_timestamp(), day_started_at = clock_timestamp();
SELECT set_config('visit_test.started_at', (SELECT started_at::text FROM site_metrics.visit_count), true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

SELECT extensions.ok((SELECT bool_and(relrowsecurity) FROM pg_class
  WHERE oid IN ('site_metrics.visit_count'::regclass, 'site_metrics.visit_receipts'::regclass)),
  'both internal metric tables have RLS enabled');
SELECT extensions.ok(NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'visitor counter does not grant anonymous access to the research schema');
SELECT extensions.ok(NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
  'visitor counter does not broaden authenticated access to the research schema');
SELECT extensions.ok(NOT has_table_privilege(role_name, relation_name, privilege_name),
  format('%s cannot %s %s directly', role_name, privilege_name, relation_name))
FROM unnest(ARRAY['anon', 'authenticated']) role_name
CROSS JOIN unnest(ARRAY['site_metrics.visit_count', 'site_metrics.visit_receipts']) relation_name
CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) privilege_name;
SELECT extensions.ok(NOT has_function_privilege(role_name,
  'site_metrics.purge_expired_visit_receipts(integer)', 'EXECUTE'),
  format('%s cannot trigger receipt cleanup', role_name))
FROM unnest(ARRAY['anon', 'authenticated']) role_name;
SELECT extensions.ok(has_function_privilege(role_name, function_name, 'EXECUTE'),
  format('%s may call %s', role_name, function_name))
FROM unnest(ARRAY['anon', 'authenticated']) role_name
CROSS JOIN unnest(ARRAY['public.get_site_visit_count()', 'public.register_site_visit(uuid)']) function_name;
SELECT extensions.ok(NOT prosecdef, format('%s is an invoker API facade', proname))
FROM pg_proc WHERE oid IN ('public.get_site_visit_count()'::regprocedure,
  'public.register_site_visit(uuid)'::regprocedure);
SELECT extensions.ok(prosecdef AND proconfig @> ARRAY['search_path=""'],
  format('%s has an empty search path and deliberate private definer boundary', proname))
FROM pg_proc WHERE oid IN ('site_metrics.read_visit_count()'::regprocedure,
  'site_metrics.record_visit(uuid)'::regprocedure);
SELECT extensions.is((SELECT count(*) FROM pg_attribute
  WHERE attrelid = 'site_metrics.visit_receipts'::regclass AND attnum > 0 AND NOT attisdropped),
  2::bigint, 'receipts contain only an opaque UUID and expiry, with no participant identity');
SELECT extensions.ok(EXISTS (SELECT 1 FROM cron.job
  WHERE jobname = 'medcompass-visit-receipt-cleanup' AND schedule = '17 * * * *'
    AND command = 'SELECT site_metrics.purge_expired_visit_receipts();' AND active),
  'hourly bounded receipt cleanup is scheduled');
SELECT extensions.ok(EXISTS (SELECT 1 FROM pg_index
  WHERE indexrelid = 'site_metrics.visit_receipts_expiry_idx'::regclass AND indisvalid),
  'receipt expiry has a valid cleanup index');

SET LOCAL ROLE anon;
SELECT extensions.is(public.get_site_visit_count()->>'total', '0', 'counter starts at zero, never questionnaire totals');
SELECT extensions.is((SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(public.get_site_visit_count()) key),
  ARRAY['started_at', 'total'], 'public read exposes only total and activation date');
SELECT extensions.is((public.get_site_visit_count()->>'started_at')::timestamptz,
  current_setting('visit_test.started_at')::timestamptz, 'public date is the real activation date');
SELECT extensions.is(current_setting('response.headers')::jsonb,
  '[{"Cache-Control":"no-store, max-age=0"}]'::jsonb, 'counter responses are not cached as stale data');
SELECT extensions.throws_ok('SELECT * FROM site_metrics.visit_receipts', '42501', NULL,
  'anonymous clients cannot enumerate visit receipts');
SELECT extensions.throws_ok('UPDATE site_metrics.visit_count SET total = 99', '42501', NULL,
  'anonymous clients cannot set or reset the total');
SELECT extensions.throws_ok('SELECT site_metrics.purge_expired_visit_receipts()', '42501', NULL,
  'anonymous clients cannot erase deduplication receipts');
SELECT extensions.throws_ok('SELECT public.register_site_visit(NULL)', '22023', NULL, 'null visit IDs are rejected');
SELECT extensions.throws_ok($$SELECT public.register_site_visit('00000000-0000-0000-0000-000000000000')$$,
  '22023', NULL, 'nil visit IDs are rejected');
SELECT extensions.throws_ok($$SELECT public.register_site_visit('81000000-0000-1000-8000-000000000001')$$,
  '22023', NULL, 'non-random UUID versions are rejected');
SELECT extensions.throws_ok($$SELECT public.register_site_visit('81000000-0000-4000-7000-000000000001')$$,
  '22023', NULL, 'invalid UUID variants are rejected');
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000001')->>'total', '1',
  'first anonymous session increments exactly once');
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000001')->>'counted', 'false',
  'replaying a receipt is idempotent');
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000001')->>'rate_limited', 'false',
  'duplicate requests are distinguished from capped requests');
SELECT extensions.is(public.get_site_visit_count()->>'total', '1', 'refresh/read calls do not increment');
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM site_metrics.visit_receipts), 1::bigint,
  'retries retain one receipt, not an event log');
SELECT extensions.is((SELECT minute_count FROM site_metrics.visit_count), 1,
  'retries do not consume the minute write budget');
SELECT extensions.is((SELECT day_count FROM site_metrics.visit_count), 1,
  'retries do not consume the daily write budget');
SELECT extensions.ok((SELECT expires_at > clock_timestamp() + interval '47 hours 59 minutes'
  AND expires_at <= clock_timestamp() + interval '48 hours' FROM site_metrics.visit_receipts),
  'new receipt TTL is 48 hours');

SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.get_site_visit_count()', '42501', NULL,
  'malformed signed-in context cannot bypass the identity check');
SELECT extensions.throws_ok($$SELECT public.register_site_visit('81000000-0000-4000-8000-000000000002')$$,
  '42501', NULL, 'malformed signed-in context cannot register');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000002')->>'total', '2',
  'signed-in visitors may register without a research role');
SELECT extensions.throws_ok('SELECT * FROM site_metrics.visit_receipts', '42501', NULL,
  'signed-in visitors cannot read receipts');
SELECT extensions.throws_ok('SELECT public.research_cohort_summary()', '42501', NULL,
  'public metric permission does not authorize research data');
RESET ROLE;

UPDATE site_metrics.visit_count SET minute_count = 120;
SELECT set_config('visit_test.state', (SELECT to_jsonb(v)::text FROM site_metrics.visit_count v), true);
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000003')->>'rate_limited', 'true',
  'global minute budget refuses a new UUID');
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000001')->>'rate_limited', 'false',
  'existing receipts remain idempotent when the write budget is exhausted');
SELECT extensions.is(public.get_site_visit_count()->>'total', '2', 'capped registration never inflates public total');
RESET ROLE;
SELECT extensions.is((SELECT to_jsonb(v) FROM site_metrics.visit_count v),
  current_setting('visit_test.state')::jsonb, 'capped and duplicate calls do not write aggregate state');
SELECT extensions.is((SELECT count(*) FROM site_metrics.visit_receipts), 2::bigint,
  'capped calls do not retain rejected UUIDs');
UPDATE site_metrics.visit_count SET minute_started_at = clock_timestamp() - interval '61 seconds';
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000003')->>'counted', 'true',
  'minute window expiry allows a new visit');
RESET ROLE;
SELECT extensions.is((SELECT minute_count FROM site_metrics.visit_count), 1, 'minute budget restarts at one');
SELECT extensions.is((SELECT day_count FROM site_metrics.visit_count), 3, 'minute reset preserves daily budget');
UPDATE site_metrics.visit_count SET day_count = 5000;
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000004')->>'rate_limited', 'true',
  'daily cap applies independently of minute capacity');
RESET ROLE;
UPDATE site_metrics.visit_count SET day_started_at = clock_timestamp() - interval '24 hours 1 second';
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000004')->>'counted', 'true',
  'expired daily window admits a new visit');
RESET ROLE;
SELECT extensions.is((SELECT day_count FROM site_metrics.visit_count), 1, 'daily budget restarts at one');
SELECT extensions.is((SELECT total FROM site_metrics.visit_count), 4::bigint, 'budget resets do not reset lifetime total');

-- Expiry and erasure do not erase aggregate history. A logically expired ID
-- can be counted again even if the hourly cleanup has not run yet.
UPDATE site_metrics.visit_receipts SET expires_at = clock_timestamp() - interval '1 second'
  WHERE visit_id = '81000000-0000-4000-8000-000000000001';
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000001')->>'counted', 'true',
  'receipt expiry ends deduplication even before physical cleanup');
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM site_metrics.visit_receipts), 4::bigint,
  'expired receipt renewal is an upsert, not a duplicate row');
INSERT INTO site_metrics.visit_receipts(visit_id, expires_at)
SELECT ('83000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  clock_timestamp() - interval '1 hour' FROM generate_series(1, 103) n;
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000005')->>'counted', 'true',
  'new registrations perform bounded opportunistic expiry cleanup');
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM site_metrics.visit_receipts WHERE expires_at <= clock_timestamp()),
  3::bigint, 'one registration deletes no more than 100 expired receipts');
SELECT extensions.is(site_metrics.purge_expired_visit_receipts(2), 2, 'owner cleanup respects its batch limit');
SELECT extensions.is(site_metrics.purge_expired_visit_receipts(), 1, 'scheduled-size cleanup removes remaining expired receipt');
SELECT extensions.is(site_metrics.purge_expired_visit_receipts(), 0, 'cleanup is idempotent with nothing expired');
SELECT extensions.is((SELECT count(*) FROM site_metrics.visit_receipts), 5::bigint, 'cleanup retains all live receipts');
SELECT extensions.is((SELECT total FROM site_metrics.visit_count), 6::bigint, 'cleanup never subtracts historic visits');
SELECT extensions.throws_ok('SELECT site_metrics.purge_expired_visit_receipts(10001)', '22023', NULL,
  'oversized cleanup batches are refused even for operators');
SELECT extensions.throws_ok('SELECT site_metrics.purge_expired_visit_receipts(NULL)', '22023', NULL,
  'null cleanup batch is refused');

-- PostgreSQL and browser serialization boundaries cannot produce wraparound.
UPDATE site_metrics.visit_count SET total = 9223372036854775807;
SET LOCAL ROLE anon;
SELECT extensions.is(public.register_site_visit('81000000-0000-4000-8000-000000000006')->>'rate_limited', 'true',
  'bigint saturation is safe and never wraps into a negative count');
RESET ROLE;
SELECT extensions.is((SELECT total FROM site_metrics.visit_count), 9223372036854775807::bigint,
  'saturated aggregate remains unchanged');
SELECT extensions.is((SELECT started_at FROM site_metrics.visit_count),
  current_setting('visit_test.started_at')::timestamptz, 'registration, resets and cleanup preserve activation date');

SELECT * FROM extensions.finish();
ROLLBACK;
