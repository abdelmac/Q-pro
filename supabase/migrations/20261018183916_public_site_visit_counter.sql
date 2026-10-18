BEGIN;

-- This is a count of accepted browser visit sessions since activation, not
-- unique people, verified humans, historical traffic or research submissions.
-- Keep this feature separate from the existing private research/auth schema.
CREATE SCHEMA site_metrics;
REVOKE ALL ON SCHEMA site_metrics FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE site_metrics.visit_count (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  total bigint NOT NULL DEFAULT 0 CHECK (total >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  minute_started_at timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count BETWEEN 0 AND 120),
  day_started_at timestamptz NOT NULL DEFAULT now(),
  day_count integer NOT NULL DEFAULT 0 CHECK (day_count BETWEEN 0 AND 5000)
);
CREATE TABLE site_metrics.visit_receipts (
  visit_id uuid PRIMARY KEY CHECK (
    visit_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  expires_at timestamptz NOT NULL
);
CREATE INDEX visit_receipts_expiry_idx ON site_metrics.visit_receipts (expires_at, visit_id);
ALTER TABLE site_metrics.visit_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_metrics.visit_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON site_metrics.visit_count, site_metrics.visit_receipts
  FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO site_metrics.visit_count(singleton) VALUES (true);

COMMENT ON TABLE site_metrics.visit_count IS
  'Aggregate recorded browser visits only. No research linkage or visitor identity. Starts at zero; new receipts capped at 120/minute and 5000/24-hour window.';
COMMENT ON TABLE site_metrics.visit_receipts IS
  'Opaque random UUIDv4 replay receipts only, with 48-hour expiry. No IP, email, account ID, device fingerprint, referrer, answers or geographic information.';

-- Invoker, owner/cron only. Normal hourly cleanup deletes at most 10,000 rows;
-- accepted registrations also remove at most 100 expired receipts. Expiry
-- stops deduplication after 48h; physical deletion normally occurs within 49h,
-- but cannot be guaranteed while the database or scheduler is unavailable.
CREATE FUNCTION site_metrics.purge_expired_visit_receipts(p_limit integer DEFAULT 10000)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE removed integer;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid cleanup batch size';
  END IF;
  WITH expired AS (
    SELECT visit_id FROM site_metrics.visit_receipts
    WHERE expires_at <= statement_timestamp()
    ORDER BY expires_at, visit_id LIMIT p_limit FOR UPDATE SKIP LOCKED
  )
  DELETE FROM site_metrics.visit_receipts r USING expired e WHERE r.visit_id = e.visit_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION site_metrics.purge_expired_visit_receipts(integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION site_metrics.read_visit_count()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- This metric is explicitly public: an anonymous request is legitimate.
  -- Check signed-in contexts without persisting or using the caller identity.
  IF current_setting('role', true) = 'authenticated' AND (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invalid authenticated context';
  END IF;
  RETURN (
    SELECT jsonb_build_object('total', total, 'started_at', started_at)
    FROM site_metrics.visit_count WHERE singleton
  );
END;
$$;
REVOKE ALL ON FUNCTION site_metrics.read_visit_count() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION site_metrics.record_visit(p_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  state site_metrics.visit_count%ROWTYPE;
  checked_at timestamptz;
  resolved_minute_count integer;
  resolved_day_count integer;
BEGIN
  IF current_setting('role', true) = 'authenticated' AND (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invalid authenticated context';
  END IF;
  IF p_visit_id IS NULL OR p_visit_id::text !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A random UUIDv4 visit ID is required';
  END IF;

  -- One short critical section makes deduplication, both global budgets and
  -- the increment atomic, including simultaneous retries of the same UUID.
  SELECT * INTO STRICT state FROM site_metrics.visit_count WHERE singleton FOR UPDATE;
  checked_at := clock_timestamp();
  IF EXISTS (SELECT 1 FROM site_metrics.visit_receipts
    WHERE visit_id = p_visit_id AND expires_at > checked_at) THEN
    RETURN jsonb_build_object('total', state.total, 'started_at', state.started_at,
      'counted', false, 'rate_limited', false);
  END IF;
  resolved_minute_count := CASE WHEN state.minute_started_at <= checked_at - interval '1 minute'
    THEN 0 ELSE state.minute_count END;
  resolved_day_count := CASE WHEN state.day_started_at <= checked_at - interval '24 hours'
    THEN 0 ELSE state.day_count END;
  IF resolved_minute_count >= 120 OR resolved_day_count >= 5000
    OR state.total = 9223372036854775807 THEN
    -- Do not retain denied UUIDs, mutate counters, or create an abuse log.
    -- These are global write/storage safeguards, NOT human/bot verification
    -- or a gateway-level request rate limiter. Abuse can cause undercounting.
    RETURN jsonb_build_object('total', state.total, 'started_at', state.started_at,
      'counted', false, 'rate_limited', true);
  END IF;

  INSERT INTO site_metrics.visit_receipts(visit_id, expires_at)
  VALUES (p_visit_id, checked_at + interval '48 hours')
  ON CONFLICT (visit_id) DO UPDATE SET expires_at = EXCLUDED.expires_at;
  UPDATE site_metrics.visit_count SET
    total = state.total + 1,
    minute_started_at = CASE WHEN resolved_minute_count = 0 THEN checked_at ELSE state.minute_started_at END,
    minute_count = resolved_minute_count + 1,
    day_started_at = CASE WHEN resolved_day_count = 0 THEN checked_at ELSE state.day_started_at END,
    day_count = resolved_day_count + 1
  WHERE singleton;
  PERFORM site_metrics.purge_expired_visit_receipts(100);
  RETURN jsonb_build_object('total', state.total + 1, 'started_at', state.started_at,
    'counted', true, 'rate_limited', false);
END;
$$;
REVOKE ALL ON FUNCTION site_metrics.record_visit(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Only these public invoker facades are exposed through PostgREST. The two
-- definer helpers have exactly the same public-safe contract and no broader
-- powers; no table, receipt enumeration, cleanup or research grant is given.
CREATE FUNCTION public.get_site_visit_count()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('response.headers', '[{"Cache-Control":"no-store, max-age=0"}]', true);
  RETURN site_metrics.read_visit_count();
END;
$$;
CREATE FUNCTION public.register_site_visit(p_visit_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('response.headers', '[{"Cache-Control":"no-store, max-age=0"}]', true);
  RETURN site_metrics.record_visit(p_visit_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_visit_count(), public.register_site_visit(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA site_metrics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION site_metrics.read_visit_count(), site_metrics.record_visit(uuid)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_visit_count(), public.register_site_visit(uuid)
  TO anon, authenticated;

-- pg_cron already exists from the geography migration. Its owner runs this
-- bounded cleanup; API roles cannot call cleanup or alter the schedule.
SELECT cron.schedule('medcompass-visit-receipt-cleanup', '17 * * * *',
  $cron$SELECT site_metrics.purge_expired_visit_receipts();$cron$);

NOTIFY pgrst, 'reload schema';
COMMIT;
