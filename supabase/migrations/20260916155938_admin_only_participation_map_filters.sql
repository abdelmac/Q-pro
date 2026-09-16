BEGIN;

-- The public overview remains available without login. Any filter requires
-- an enabled doctor/professor entry in the server-owned portal allowlist.
-- Authorize before validating so non-admins cannot probe filtered endpoints.
CREATE OR REPLACE FUNCTION public.get_participation_map_stats(
  p_respondent_type text DEFAULT 'all',
  p_country_code text DEFAULT NULL,
  p_language text DEFAULT 'all',
  p_month_from date DEFAULT NULL,
  p_month_to date DEFAULT NULL,
  p_data_version text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $public_stats$
BEGIN
  IF p_respondent_type IS DISTINCT FROM 'all'
     OR p_country_code IS NOT NULL
     OR p_language IS DISTINCT FROM 'all'
     OR p_month_from IS NOT NULL
     OR p_month_to IS NOT NULL
     OR p_data_version IS DISTINCT FROM 'all' THEN
    PERFORM private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  END IF;

  RETURN private.get_participation_map_stats(
    p_respondent_type, p_country_code, p_language, p_month_from, p_month_to, p_data_version
  );
END;
$public_stats$;

REVOKE ALL ON FUNCTION public.get_participation_map_stats(text, text, text, date, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_participation_map_stats(text, text, text, date, date, text)
  TO anon, authenticated;

COMMENT ON FUNCTION public.get_participation_map_stats(text, text, text, date, date, text) IS
  'Unfiltered public overview of immutable monthly country aggregates. Any non-default filter requires an enabled doctor/professor portal role. Suppression, rounding and raw-row access boundaries remain unchanged.';

NOTIFY pgrst, 'reload schema';
COMMIT;
