-- One-time, owner-authorized data adjustment requested on 19 October 2026
-- (Europe/Paris): add 420 missing visits reported for the previous week.
-- Source: the project owner's supplied figure, NOT independently verified
-- Cloudflare analytics, unique people, synthetic receipts or research rows.
--
-- Run ONLY through the Supabase migration runner, which commits this update
-- and its migration-history entry in one transaction. Do not run this file
-- directly as standalone SQL or repair/remove its applied history entry.
-- No explicit COMMIT here: history must remain atomic with the increment.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

DO $historical_visits$
DECLARE
  current_counter site_metrics.visit_count%ROWTYPE;
  updated_total bigint;
BEGIN
  -- Same lock as normal registration: no visits are lost during the addition.
  SELECT * INTO STRICT current_counter
  FROM site_metrics.visit_count WHERE singleton FOR UPDATE;

  -- Recheck after acquiring the lock, so concurrent/repeated CLI execution
  -- cannot add the same historical figure again after a successful commit.
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20261018220832'
  ) THEN
    RAISE NOTICE 'Historical visit adjustment already recorded; no change.';
    RETURN;
  END IF;

  -- Only the existing live counter (or its faithful restored copy) is eligible.
  -- A fresh installation/test database must never inherit fabricated visits.
  IF current_counter.started_at <> timestamptz '2026-10-18 20:57:03.455605+00' THEN
    RAISE NOTICE 'Different counter activation; historical adjustment skipped.';
    RETURN;
  END IF;

  -- Preserve the live counter's exact integer range supported by the frontend.
  IF current_counter.total > 9007199254740991::bigint - 420 THEN
    RAISE EXCEPTION 'Historical adjustment would exceed the supported counter range';
  END IF;

  UPDATE site_metrics.visit_count
  SET total = total + 420
  WHERE singleton
  RETURNING total INTO STRICT updated_total;

  RAISE NOTICE 'Added 420 owner-reported historical visits: % -> %.',
    current_counter.total, updated_total;
END;
$historical_visits$;
