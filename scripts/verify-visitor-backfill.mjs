import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Deliberately local-only. No URL, project reference, credentials or production
// override is accepted. Every fixture (including migration history) rolls back.
assert.equal(process.argv.length, 2, 'Usage: node scripts/verify-visitor-backfill.mjs');
const container = 'supabase_db_q-pro-verify-20260925';
const version = '20261018220832';
const migration = readFileSync(fileURLToPath(new URL(
  `../supabase/migrations/${version}_add_owner_reported_historical_visits.sql`, import.meta.url,
)), 'utf8');
assert.ok(migration.trim(), 'The migration must exist and contain SQL');
assert.ok(!/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im.test(migration),
  'Migration must not commit separately from CLI-managed history');
assert.ok(!migration.includes('$tested_migration$'), 'Unexpected migration delimiter');

function docker(args, input) {
  const result = spawnSync('docker', args, {
    input, encoding: 'utf8', timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Local Docker check failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

const localEndpoint = value => /^(?:npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/)/i.test(value);
assert.ok(!process.env.DOCKER_HOST || localEndpoint(process.env.DOCKER_HOST),
  'Refusing a non-local DOCKER_HOST');
const context = docker(['context', 'show']).stdout.trim();
const contextInfo = JSON.parse(docker(['context', 'inspect', context]).stdout);
assert.ok(localEndpoint(contextInfo[0]?.Endpoints?.docker?.Host ?? ''),
  'Refusing a Docker context that does not use a local socket');
const inspected = JSON.parse(docker(['inspect', container]).stdout)[0];
assert.equal(inspected.Name, `/${container}`, 'Unexpected local container');
assert.equal(inspected.State.Running, true, 'Start the isolated verification database first');

function sql(source) {
  return docker(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '--host=/var/run/postgresql', '--port=5432',
    '--username=postgres', '--dbname=postgres', '--file=-'], source);
}

const snapshotSql = `
SELECT jsonb_build_object(
  'counter', (SELECT to_jsonb(c) FROM site_metrics.visit_count c WHERE singleton),
  'receipts', (SELECT jsonb_build_object('count', count(*), 'digest',
    md5(coalesce(string_agg(visit_id::text || ':' || expires_at::text, ',' ORDER BY visit_id), '')))
    FROM site_metrics.visit_receipts),
  'migration', (SELECT to_jsonb(m) FROM supabase_migrations.schema_migrations m WHERE version = '${version}')
);
`;
const before = JSON.parse(sql(snapshotSql).stdout.trim());
const verification = sql(`
BEGIN;
SET LOCAL statement_timeout = '15s';
DO $local_guard$
BEGIN
  IF inet_server_addr() IS NOT NULL OR current_database() <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Not the expected local socket/database/user';
  END IF;
END;
$local_guard$;

CREATE FUNCTION pg_temp.check_true(p_condition boolean, p_label text)
RETURNS void LANGUAGE plpgsql AS $check$
BEGIN
  IF p_condition IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF;
  RAISE NOTICE 'PASS: %', p_label;
END;
$check$;
CREATE FUNCTION pg_temp.apply_test_migration()
RETURNS void LANGUAGE plpgsql AS $apply$
BEGIN
  EXECUTE $tested_migration$${migration}$tested_migration$;
END;
$apply$;
CREATE FUNCTION pg_temp.expect_error(p_statement text, p_state text, p_label text)
RETURNS void LANGUAGE plpgsql AS $error$
DECLARE actual_state text;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN OTHERS THEN actual_state := SQLSTATE;
  END;
  PERFORM pg_temp.check_true(actual_state = p_state, p_label);
END;
$error$;

-- This history fixture is local, transaction-scoped and restored by ROLLBACK.
DELETE FROM supabase_migrations.schema_migrations WHERE version = '${version}';
SAVEPOINT fresh_counter;
UPDATE site_metrics.visit_count SET total = 7, started_at = timestamptz '2026-10-19 00:00:00+00';
SELECT pg_temp.apply_test_migration();
SELECT pg_temp.check_true((SELECT total = 7 FROM site_metrics.visit_count),
  'different activation does not inherit historical visits');
ROLLBACK TO SAVEPOINT fresh_counter;

SAVEPOINT missing_counter;
DELETE FROM site_metrics.visit_count;
SELECT pg_temp.expect_error('SELECT pg_temp.apply_test_migration()', 'P0002',
  'missing singleton fails instead of silently recording success');
ROLLBACK TO SAVEPOINT missing_counter;

UPDATE site_metrics.visit_count SET total = 7,
  started_at = timestamptz '2026-10-18 20:57:03.455605+00',
  minute_started_at = clock_timestamp(), minute_count = 3,
  day_started_at = clock_timestamp(), day_count = 9;
INSERT INTO site_metrics.visit_receipts(visit_id, expires_at)
VALUES ('83000000-0000-4000-8000-000000000001', clock_timestamp() + interval '12 hours')
ON CONFLICT (visit_id) DO NOTHING;
CREATE TEMP TABLE counter_fixture AS SELECT to_jsonb(c) - 'total' AS unchanged
FROM site_metrics.visit_count c;
CREATE TEMP TABLE receipt_fixture AS SELECT * FROM site_metrics.visit_receipts;
CREATE TEMP TABLE security_fixture AS
SELECT oid, relrowsecurity, relacl FROM pg_class
WHERE oid IN ('site_metrics.visit_count'::regclass, 'site_metrics.visit_receipts'::regclass);

-- A failure after the increment must roll the increment back with the batch.
DO $rollback_test$
BEGIN
  BEGIN
    PERFORM pg_temp.apply_test_migration();
    RAISE EXCEPTION USING ERRCODE = 'P0123', MESSAGE = 'Deliberate local rollback fixture';
  EXCEPTION WHEN SQLSTATE 'P0123' THEN NULL;
  END;
END;
$rollback_test$;
SELECT pg_temp.check_true((SELECT total = 7 FROM site_metrics.visit_count),
  'failure after adjustment rolls total back');
SELECT pg_temp.check_true(NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
  WHERE version = '${version}'), 'failed adjustment leaves no migration-history fixture');

SELECT pg_temp.apply_test_migration();
SELECT pg_temp.check_true((SELECT total = 427 FROM site_metrics.visit_count),
  'eligible counter receives exactly420 in addition to existing visits');
SELECT pg_temp.check_true((SELECT (to_jsonb(c) - 'total') = f.unchanged
  FROM site_metrics.visit_count c CROSS JOIN counter_fixture f),
  'activation and minute/day budgets remain unchanged');
SELECT pg_temp.check_true(NOT EXISTS (
  (SELECT * FROM site_metrics.visit_receipts EXCEPT SELECT * FROM receipt_fixture)
  UNION ALL (SELECT * FROM receipt_fixture EXCEPT SELECT * FROM site_metrics.visit_receipts)
), 'no synthetic receipts are created and existing receipts are preserved');
SELECT pg_temp.check_true(NOT EXISTS (
  SELECT 1 FROM security_fixture f JOIN pg_class c USING (oid)
  WHERE c.relrowsecurity IS DISTINCT FROM f.relrowsecurity OR c.relacl IS DISTINCT FROM f.relacl
), 'RLS and direct table grants remain unchanged');

-- Emulate the runner's history insertion in the same outer transaction.
INSERT INTO supabase_migrations.schema_migrations(version, name)
VALUES ('${version}', 'add_owner_reported_historical_visits');
SELECT pg_temp.apply_test_migration();
SELECT pg_temp.check_true((SELECT total = 427 FROM site_metrics.visit_count),
  'successful-history replay never adds420 twice');

SET LOCAL ROLE anon;
SELECT pg_temp.check_true(public.get_site_visit_count()->>'total' = '427',
  'public getter reads the adjusted aggregate');
SELECT pg_temp.check_true((SELECT array_agg(key ORDER BY key)
  FROM jsonb_object_keys(public.get_site_visit_count()) key) = ARRAY['started_at', 'total'],
  'public getter contract is unchanged');
SELECT pg_temp.check_true(public.register_site_visit('83000000-0000-4000-8000-000000000002')
  @> '{"counted":true,"total":428}'::jsonb, 'future accepted visit increments the adjusted total');
SELECT pg_temp.check_true(public.register_site_visit('83000000-0000-4000-8000-000000000002')
  @> '{"counted":false,"total":428}'::jsonb, 'existing visit replay protection still works');
RESET ROLE;
SELECT pg_temp.apply_test_migration();
SELECT pg_temp.check_true((SELECT total = 428 FROM site_metrics.visit_count),
  'historical replay preserves subsequently counted visits');
SELECT pg_temp.check_true((SELECT minute_count = 4 AND day_count = 10 FROM site_metrics.visit_count),
  'only the genuinely new local visit consumes rate budgets');

SAVEPOINT numeric_boundary;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '${version}';
UPDATE site_metrics.visit_count SET total = 9007199254740991::bigint - 419;
SELECT pg_temp.expect_error('SELECT pg_temp.apply_test_migration()', 'P0001',
  'frontend integer-range overflow fails safely');
SELECT pg_temp.check_true((SELECT total = 9007199254740991::bigint - 419 FROM site_metrics.visit_count),
  'failed integer-range check leaves total unchanged');
UPDATE site_metrics.visit_count SET total = 9007199254740991::bigint - 420;
SELECT pg_temp.apply_test_migration();
SELECT pg_temp.check_true((SELECT total = 9007199254740991::bigint FROM site_metrics.visit_count),
  'largest supported adjusted total is accepted');
ROLLBACK TO SAVEPOINT numeric_boundary;
ROLLBACK;
`);
const checks = (verification.stderr.match(/NOTICE:\s+PASS: /g) ?? []).length;
assert.equal(checks, 18, `Unexpected check count:\n${verification.stderr}`);
const after = JSON.parse(sql(snapshotSql).stdout.trim());
assert.deepEqual(after, before, 'All counter, receipt and migration-history fixtures must roll back');
console.log(JSON.stringify({
  status: 'passed', container, checks,
  fixtures: 'rolled back; original counter, receipts and migration history unchanged',
  productionAccess: false,
}, null, 2));
