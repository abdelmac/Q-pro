BEGIN;

-- Settings and audits are deliberately outside the exposed Data API schema.
-- Participant category is never a source of administrative authorization.
CREATE TABLE private.public_features (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  public_map_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE TABLE private.public_features_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('doctor', 'professor')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  previous_value boolean NOT NULL,
  new_value boolean NOT NULL
);
ALTER TABLE private.public_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.public_features_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.public_features, private.public_features_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.public_features_audit_id_seq FROM PUBLIC, anon, authenticated;
INSERT INTO private.public_features(singleton) VALUES (true);

CREATE FUNCTION private.research_no_store()
RETURNS void LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT set_config('response.headers',
    '[{"Cache-Control":"no-store, private, max-age=0"},{"Pragma":"no-cache"},{"Expires":"0"}]', true)::void;
$$;
REVOKE ALL ON FUNCTION private.research_no_store() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_public_features()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.research_no_store();
  RETURN jsonb_build_object('public_map_enabled', coalesce((
    SELECT public_map_enabled FROM private.public_features WHERE singleton
  ), false));
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_features() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_features() TO anon, authenticated;

CREATE FUNCTION public.set_public_map_enabled(p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous boolean; actor_role text;
BEGIN
  actor_role := private.require_portal_role(ARRAY['doctor', 'professor']);
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A boolean setting is required';
  END IF;
  -- Serialize even a first write after a missing configuration row.
  PERFORM pg_advisory_xact_lock(184205925, 1);
  SELECT public_map_enabled INTO previous FROM private.public_features WHERE singleton FOR UPDATE;
  previous := coalesce(previous, false);
  INSERT INTO private.public_features(singleton, public_map_enabled, updated_by, updated_at)
  VALUES (true, p_enabled, auth.uid(), now())
  ON CONFLICT (singleton) DO UPDATE SET public_map_enabled = EXCLUDED.public_map_enabled,
    updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  IF previous IS DISTINCT FROM p_enabled THEN
    INSERT INTO private.public_features_audit(actor_user_id, actor_role, previous_value, new_value)
    VALUES (auth.uid(), actor_role, previous, p_enabled);
  END IF;
  RETURN public.get_public_features();
END;
$$;
REVOKE ALL ON FUNCTION public.set_public_map_enabled(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_public_map_enabled(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_participation_map_stats(
  p_respondent_type text DEFAULT 'all', p_country_code text DEFAULT NULL,
  p_language text DEFAULT 'all', p_month_from date DEFAULT NULL,
  p_month_to date DEFAULT NULL, p_data_version text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.research_no_store();
  IF NOT coalesce((SELECT public_map_enabled FROM private.public_features WHERE singleton), false) THEN
    -- A raised exception rolls back response.headers; carry denial headers in
    -- PostgREST's documented custom-error payload as well.
    RAISE SQLSTATE 'PGRST' USING
      MESSAGE = '{"code":"42501","message":"The public participation map is disabled"}',
      DETAIL = '{"status":403,"headers":{"Cache-Control":"no-store, private, max-age=0","Pragma":"no-cache","Expires":"0"}}';
  END IF;
  -- Preserve compatibility for existing authorized editor clients while public
  -- visitors still receive only the single, immutable unfiltered release.
  IF p_respondent_type IS DISTINCT FROM 'all' OR p_country_code IS NOT NULL
     OR p_language IS DISTINCT FROM 'all' OR p_month_from IS NOT NULL
     OR p_month_to IS NOT NULL OR p_data_version IS DISTINCT FROM 'all' THEN
    PERFORM private.require_portal_role(ARRAY['doctor', 'professor']);
  END IF;
  RETURN private.get_participation_map_stats(p_respondent_type, p_country_code,
    p_language, p_month_from, p_month_to, p_data_version);
END;
$$;

CREATE FUNCTION public.get_private_participation_map_stats(
  p_respondent_type text DEFAULT 'all', p_country_code text DEFAULT NULL,
  p_language text DEFAULT 'all', p_month_from date DEFAULT NULL,
  p_month_to date DEFAULT NULL, p_data_version text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher', 'doctor', 'professor']);
  PERFORM private.research_no_store();
  RETURN private.get_participation_map_stats(p_respondent_type, p_country_code,
    p_language, p_month_from, p_month_to, p_data_version);
END;
$$;
REVOKE ALL ON FUNCTION public.get_private_participation_map_stats(text,text,text,date,date,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_participation_map_stats(text,text,text,date,date,text) TO authenticated;

-- Query-sized indexes for stable pagination, not duplicated questionnaire data.
CREATE INDEX IF NOT EXISTS student_responses_created_id_idx ON public.student_responses(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS specialist_responses_created_id_idx ON public.specialist_responses(created_at DESC, id DESC);

CREATE VIEW private.research_response_index WITH (security_invoker = true) AS
  SELECT id, created_at, 'specialist'::text AS respondent_type, language, country_code,
    actual_specialty AS specialty, NULL::integer AS study_year, years_of_experience,
    career_satisfaction, would_choose_again_code AS rechoice, intention_to_change_code AS intention_to_change,
    questionnaire_version, submission_schema_version, consent_version,
    calibration_version AS scoring_version, specialty_config_revision, to_jsonb(s) AS response
  FROM public.specialist_responses s
  UNION ALL
  SELECT id, created_at, CASE WHEN participant_role = 'curious' THEN 'non_medical' ELSE 'student' END,
    language, country_code, preferred_specialty, study_year, NULL::integer, NULL::integer, NULL::text, NULL::text,
    questionnaire_version, submission_schema_version, consent_version,
    scoring_version, specialty_config_revision, to_jsonb(s)
  FROM public.student_responses s;
REVOKE ALL ON private.research_response_index FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.validate_research_filters(p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; v jsonb; numeric_value integer;
BEGIN
  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'object' OR octet_length(p_filters::text) > 4096 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid research filters';
  END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p_filters) LOOP
    IF NOT (k = ANY(ARRAY['respondent_type','language','country_code','specialty','study_year','date_from','date_to',
      'experience_min','experience_max','satisfaction_min','satisfaction_max','rechoice','intention_to_change',
      'questionnaire_version','schema_version','consent_version','scoring_version','specialty_config_revision']))
      OR jsonb_typeof(v) NOT IN ('string','number') OR length(v #>> '{}') NOT BETWEEN 1 AND 180 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unknown or invalid research filter';
    END IF;
    IF k IN ('study_year','experience_min','experience_max','satisfaction_min','satisfaction_max','schema_version','specialty_config_revision') THEN
      IF (v #>> '{}') !~ '^[0-9]{1,9}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid numeric research filter';
      END IF;
      numeric_value := (v #>> '{}')::integer;
      IF (k = 'study_year' AND numeric_value NOT BETWEEN 1 AND 6)
        OR (k IN ('experience_min','experience_max') AND numeric_value NOT BETWEEN 0 AND 60)
        OR (k IN ('satisfaction_min','satisfaction_max') AND numeric_value NOT BETWEEN 1 AND 5) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Research filter is outside its allowed range';
      END IF;
    END IF;
    IF k IN ('date_from','date_to') THEN
      IF (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Research dates must use YYYY-MM-DD';
      END IF;
      PERFORM (v #>> '{}')::date;
    END IF;
  END LOOP;
  IF (p_filters ? 'respondent_type' AND p_filters->>'respondent_type' NOT IN ('specialist','student','non_medical'))
    OR (p_filters ? 'language' AND p_filters->>'language' NOT IN ('en','ro','fr'))
    OR (p_filters ? 'country_code' AND p_filters->>'country_code' <> 'missing'
      AND private.participation_country_name(p_filters->>'country_code') IS NULL)
    OR (p_filters ? 'rechoice' AND p_filters->>'rechoice' NOT IN ('yes','no','unsure'))
    OR (p_filters ? 'intention_to_change' AND p_filters->>'intention_to_change' NOT IN ('definitely','probably','probably_not','definitely_not'))
    OR (p_filters ? 'specialty' AND NOT private.valid_specialty_v1(p_filters->>'specialty'))
    OR ((p_filters->>'date_from')::date > (p_filters->>'date_to')::date)
    OR ((p_filters->>'experience_min')::int > (p_filters->>'experience_max')::int)
    OR ((p_filters->>'satisfaction_min')::int > (p_filters->>'satisfaction_max')::int) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid research filter combination';
  END IF;
  RETURN p_filters;
END;
$$;

CREATE FUNCTION private.filtered_research_responses(f jsonb)
RETURNS SETOF private.research_response_index LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT r.* FROM private.research_response_index r
  WHERE (NOT f ? 'respondent_type' OR r.respondent_type = f->>'respondent_type')
    AND (NOT f ? 'language' OR r.language = f->>'language')
    AND (NOT f ? 'country_code' OR coalesce(r.country_code,'missing') = f->>'country_code')
    AND (NOT f ? 'specialty' OR r.specialty = f->>'specialty')
    AND (NOT f ? 'study_year' OR r.study_year = (f->>'study_year')::integer)
    AND (NOT f ? 'date_from' OR r.created_at >= ((f->>'date_from')::date::timestamp AT TIME ZONE 'UTC'))
    AND (NOT f ? 'date_to' OR r.created_at < (((f->>'date_to')::date + 1)::timestamp AT TIME ZONE 'UTC'))
    AND (NOT f ? 'experience_min' OR r.years_of_experience >= (f->>'experience_min')::integer)
    AND (NOT f ? 'experience_max' OR r.years_of_experience <= (f->>'experience_max')::integer)
    AND (NOT f ? 'satisfaction_min' OR r.career_satisfaction >= (f->>'satisfaction_min')::integer)
    AND (NOT f ? 'satisfaction_max' OR r.career_satisfaction <= (f->>'satisfaction_max')::integer)
    AND (NOT f ? 'rechoice' OR r.rechoice = f->>'rechoice')
    AND (NOT f ? 'intention_to_change' OR r.intention_to_change = f->>'intention_to_change')
    AND (NOT f ? 'questionnaire_version' OR r.questionnaire_version = f->>'questionnaire_version')
    AND (NOT f ? 'schema_version' OR r.submission_schema_version = (f->>'schema_version')::integer)
    AND (NOT f ? 'consent_version' OR r.consent_version = f->>'consent_version')
    AND (NOT f ? 'scoring_version' OR r.scoring_version = f->>'scoring_version')
    AND (NOT f ? 'specialty_config_revision' OR r.specialty_config_revision = (f->>'specialty_config_revision')::bigint);
$$;

-- Explicitly versioned eligibility, matching the existing q81-v1 dashboard's
-- supported collection protocols. Missing optional metadata never excludes.
CREATE FUNCTION private.research_exclusions(r jsonb, respondent text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE reasons text[] := '{}'; schema_version integer := (r->>'submission_schema_version')::integer;
  expected_consent text; skipped boolean := respondent = 'specialist' AND r->>'questionnaire_completed' = 'false';
BEGIN
  IF r->>'questionnaire_version' IS DISTINCT FROM 'q81-v1' THEN reasons := array_append(reasons,'questionnaire_version'); END IF;
  IF r->>'value_catalog_version' IS DISTINCT FROM 'career-values-v1' THEN reasons := array_append(reasons,'value_catalog_version'); END IF;
  IF r->>'specialty_catalog_version' IS DISTINCT FROM 'medical-specialties-v1' THEN reasons := array_append(reasons,'specialty_catalog_version'); END IF;
  IF coalesce(r->>'language','') NOT IN ('en','ro','fr') THEN reasons := array_append(reasons,'language'); END IF;
  IF skipped THEN
    reasons := array_append(reasons,'questionnaire_skipped');
  ELSE
    IF NOT private.valid_ratings_q81_v1(r->'ratings') THEN reasons := array_append(reasons,'ratings_payload'); END IF;
    IF NOT private.valid_selected_values_v1(r->'selected_values') THEN reasons := array_append(reasons,'selected_values_payload'); END IF;
  END IF;
  IF respondent = 'specialist' THEN
    expected_consent := CASE schema_version WHEN 2 THEN 'research-consent-2026-09-04' WHEN 3 THEN 'research-consent-2026-09-16-geography' END;
    IF r->>'calibration_version' IS DISTINCT FROM 'calibration-v2-qualitative' THEN reasons := array_append(reasons,'analysis_version'); END IF;
    IF NOT private.valid_specialty_v1(r->>'actual_specialty') THEN reasons := array_append(reasons,'specialty'); END IF;
  ELSE
    expected_consent := CASE schema_version WHEN 2 THEN 'research-consent-2026-09-04'
      WHEN 3 THEN 'research-consent-2026-09-11' WHEN 4 THEN 'research-consent-2026-09-16' WHEN 5 THEN 'research-consent-2026-09-16-geography' END;
    IF r->>'scoring_version' IS DISTINCT FROM 'client-scoring-v2'
      OR (schema_version = 3 AND r->>'participant_reflection_version' IS DISTINCT FROM 'medicine-view-v1')
      OR (schema_version IN (4,5) AND r->>'participant_reflection_version' IS DISTINCT FROM 'medicine-view-optional-v2')
      THEN reasons := array_append(reasons,'analysis_version'); END IF;
    IF r->>'preferred_specialty' IS NOT NULL AND NOT private.valid_specialty_v1(r->>'preferred_specialty') THEN reasons := array_append(reasons,'specialty'); END IF;
  END IF;
  IF expected_consent IS NULL THEN reasons := array_append(reasons,'schema_version');
  ELSIF r->>'consent_version' IS DISTINCT FROM expected_consent THEN reasons := array_append(reasons,'consent_version'); END IF;
  RETURN reasons;
END;
$$;

CREATE FUNCTION public.research_cohort_summary(p_filters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET statement_timeout = '10s' AS $$
DECLARE f jsonb; result jsonb;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  f := private.validate_research_filters(p_filters);
  WITH cohort AS MATERIALIZED (
    SELECT r.*, private.research_exclusions(response,respondent_type) AS reasons FROM private.filtered_research_responses(f) r
  ), groups AS (
    SELECT 'respondent_type' dimension, respondent_type AS key, count(*) count FROM cohort GROUP BY respondent_type
    UNION ALL SELECT 'language', language, count(*) FROM cohort GROUP BY language
    UNION ALL SELECT 'country', coalesce(country_code,'missing'), count(*) FROM cohort GROUP BY country_code
    UNION ALL SELECT 'questionnaire_version', questionnaire_version, count(*) FROM cohort GROUP BY questionnaire_version
    UNION ALL SELECT 'month', to_char(created_at AT TIME ZONE 'UTC','YYYY-MM'), count(*) FROM cohort GROUP BY 2
  ), grouped AS (SELECT dimension, jsonb_agg(jsonb_build_object('key',key,'count',count) ORDER BY key) entries FROM groups GROUP BY dimension),
  exclusions AS (SELECT reason,count(*) count FROM cohort CROSS JOIN LATERAL unnest(reasons) reason GROUP BY reason)
  SELECT jsonb_build_object('global_total',(SELECT count(*) FROM private.research_response_index),
    'total',count(*),'eligible',count(*) FILTER(WHERE cardinality(reasons)=0),
    'excluded',count(*) FILTER(WHERE cardinality(reasons)>0),
    'missing_geography',count(*) FILTER(WHERE country_code IS NULL),
    'questionnaire_skipped',count(*) FILTER(WHERE 'questionnaire_skipped'=ANY(reasons)),
    'counts',coalesce((SELECT jsonb_object_agg(dimension,entries) FROM grouped),'{}'::jsonb),
    'exclusions',coalesce((SELECT jsonb_agg(jsonb_build_object('reason',reason,'count',count) ORDER BY reason) FROM exclusions),'[]'::jsonb),
    'filters',f,'generated_at',now(),'analysis_version','research-sql-q81-v1',
    'completion_metrics',NULL,'personalized_settings','unavailable_for_historical_submissions') INTO result FROM cohort;
  RETURN result;
END;
$$;

CREATE FUNCTION public.research_response_page(p_filters jsonb DEFAULT '{}',p_limit integer DEFAULT 50,p_cursor jsonb DEFAULT NULL,p_sort text DEFAULT 'newest')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET statement_timeout = '10s' AS $$
DECLARE f jsonb; result jsonb; cursor_time timestamptz; cursor_id uuid; cursor_type text;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  f := private.validate_research_filters(p_filters);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_sort IS NULL OR p_sort NOT IN ('newest','oldest') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid page size or sort order';
  END IF;
  IF p_cursor IS NOT NULL THEN
    IF jsonb_typeof(p_cursor) <> 'object' OR NOT (p_cursor ?& ARRAY['created_at','id','respondent_type']) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid research cursor';
    END IF;
    cursor_time := (p_cursor->>'created_at')::timestamptz; cursor_id := (p_cursor->>'id')::uuid; cursor_type := p_cursor->>'respondent_type';
    IF cursor_time IS NULL OR cursor_id IS NULL OR cursor_type NOT IN ('specialist','student','non_medical') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid research cursor';
    END IF;
  END IF;
  WITH page_plus AS MATERIALIZED (
    SELECT * FROM private.filtered_research_responses(f) r
    WHERE p_cursor IS NULL OR (p_sort='newest' AND (r.created_at,r.id,r.respondent_type)<(cursor_time,cursor_id,cursor_type))
      OR (p_sort='oldest' AND (r.created_at,r.id,r.respondent_type)>(cursor_time,cursor_id,cursor_type))
    ORDER BY CASE WHEN p_sort='newest' THEN r.created_at END DESC,CASE WHEN p_sort='newest' THEN r.id END DESC,
      CASE WHEN p_sort='newest' THEN r.respondent_type END DESC,
      CASE WHEN p_sort='oldest' THEN r.created_at END ASC,CASE WHEN p_sort='oldest' THEN r.id END ASC,
      CASE WHEN p_sort='oldest' THEN r.respondent_type END ASC LIMIT p_limit+1
  ), numbered AS (SELECT *, row_number() OVER () ordinal FROM page_plus),
  page AS (SELECT * FROM numbered WHERE ordinal<=p_limit)
  SELECT jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object('respondent_type',respondent_type,'response',response) ORDER BY ordinal),'[]'::jsonb),
    'next_cursor',CASE WHEN (SELECT count(*) FROM page_plus)>p_limit THEN
      (SELECT jsonb_build_object('created_at',created_at,'id',id,'respondent_type',respondent_type) FROM page ORDER BY ordinal DESC LIMIT 1) ELSE NULL END)
    INTO result FROM page;
  RETURN result;
END;
$$;

CREATE FUNCTION public.research_question_summary(p_filters jsonb,p_question_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET statement_timeout = '10s' AS $$
DECLARE f jsonb; result jsonb;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  f := private.validate_research_filters(p_filters);
  IF p_question_id IS NULL OR NOT p_question_id=ANY(private.question_catalog_q81_v1())
    OR (f ? 'questionnaire_version' AND f->>'questionnaire_version'<>'q81-v1') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Question analysis requires a known q81-v1 item';
  END IF;
  -- Separate incompatible item definitions instead of silently merging versions.
  f := f || '{"questionnaire_version":"q81-v1"}'::jsonb;
  WITH cohort AS MATERIALIZED (SELECT response, private.research_exclusions(response,respondent_type) reasons FROM private.filtered_research_responses(f)),
  values AS (SELECT CASE WHEN cardinality(reasons)=0 THEN (response->'ratings'->>p_question_id)::numeric END value,
    NOT coalesce(jsonb_typeof(response->'ratings'->p_question_id)='number'
      AND (response->'ratings'->>p_question_id) ~ '^(10|[1-9])$',false) AS missing FROM cohort),
  bins AS (SELECT n value,count(v.value) count FROM generate_series(1,10) n LEFT JOIN values v ON v.value=n GROUP BY n)
  SELECT jsonb_build_object('question_id',p_question_id,'questionnaire_version','q81-v1','n',count(value),
    'cohort_total',count(*),'excluded',count(*)-count(value),'missing',count(*) FILTER(WHERE missing),
    'mean',avg(value),'median',percentile_cont(0.5) WITHIN GROUP(ORDER BY value),
    'stddev',stddev_samp(value),'floor',count(*) FILTER(WHERE value=1),'ceiling',count(*) FILTER(WHERE value=10),
    'distribution',(SELECT jsonb_agg(jsonb_build_object('value',value,'count',count) ORDER BY value) FROM bins),'scale','original') INTO result FROM values;
  RETURN result;
END;
$$;

CREATE FUNCTION public.research_item_correlation(p_filters jsonb,p_question_a text,p_question_b text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET statement_timeout = '10s' AS $$
DECLARE f jsonb; result jsonb;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  f := private.validate_research_filters(p_filters);
  IF p_question_a IS NULL OR p_question_b IS NULL OR NOT p_question_a=ANY(private.question_catalog_q81_v1())
    OR NOT p_question_b=ANY(private.question_catalog_q81_v1()) OR p_question_a=p_question_b
    OR (f ? 'questionnaire_version' AND f->>'questionnaire_version'<>'q81-v1') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Correlation requires two distinct q81-v1 items';
  END IF;
  f := f || '{"questionnaire_version":"q81-v1"}'::jsonb;
  WITH eligible AS MATERIALIZED (SELECT response FROM private.filtered_research_responses(f)
    WHERE cardinality(private.research_exclusions(response,respondent_type))=0)
  SELECT jsonb_build_object('n',count(*),'r',corr((response->'ratings'->>p_question_a)::float8,(response->'ratings'->>p_question_b)::float8),
    'method','pearson-original-complete-questionnaires','question_a',p_question_a,'question_b',p_question_b,
    'questionnaire_version','q81-v1','exploratory',true) INTO result FROM eligible;
  RETURN result;
END;
$$;

CREATE TABLE private.research_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120), filters jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,name)
);
ALTER TABLE private.research_cohorts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.research_cohorts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.list_research_cohorts()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(c)-'owner_id' ORDER BY updated_at DESC) FROM private.research_cohorts c WHERE owner_id=auth.uid()),'[]'::jsonb);
END;
$$;
CREATE FUNCTION public.save_research_cohort(p_name text,p_filters jsonb,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE f jsonb; saved private.research_cohorts;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  f:=private.validate_research_filters(p_filters);
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid cohort name'; END IF;
  PERFORM pg_advisory_xact_lock(184205925,hashtext(auth.uid()::text));
  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM private.research_cohorts WHERE owner_id=auth.uid())>=50 THEN
      RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='At most 50 saved cohorts per researcher';
    END IF;
    INSERT INTO private.research_cohorts(owner_id,name,filters) VALUES(auth.uid(),btrim(p_name),f) RETURNING * INTO saved;
  ELSE
    UPDATE private.research_cohorts SET name=btrim(p_name),filters=f,updated_at=now() WHERE id=p_id AND owner_id=auth.uid() RETURNING * INTO saved;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cohort not available'; END IF;
  END IF;
  RETURN to_jsonb(saved)-'owner_id';
END;
$$;
CREATE FUNCTION public.delete_research_cohort(p_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  DELETE FROM private.research_cohorts WHERE id=p_id AND owner_id=auth.uid();
  RETURN FOUND;
END;
$$;

CREATE TABLE private.research_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status='completed'), execution_ms integer NOT NULL CHECK(execution_ms>=0),
  filters jsonb NOT NULL, parameters jsonb NOT NULL, analysis_version text NOT NULL,
  dataset_checksum text NOT NULL, snapshot_count integer NOT NULL CHECK(snapshot_count BETWEEN 0 AND 5000),
  -- Store identities and integrity digests, not a second copy of raw responses.
  -- Deletion invalidates reconstruction; it must not secretly preserve raw data.
  snapshot_members jsonb NOT NULL, model_versions jsonb NOT NULL, results jsonb NOT NULL
);
CREATE INDEX research_analysis_runs_owner_created_idx ON private.research_analysis_runs(owner_id,created_at DESC);
ALTER TABLE private.research_analysis_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.research_analysis_runs FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.research_snapshot(f jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE result jsonb; n integer;
BEGIN
  -- Refuse oversized cohorts rather than silently sampling/truncating them.
  SELECT count(*) INTO n FROM (SELECT 1 FROM private.filtered_research_responses(f) LIMIT 5001) limited;
  IF n>5000 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Analysis cohort exceeds 5000 submissions; narrow the filters or use the offline research workflow'; END IF;
  WITH cohort AS MATERIALIZED(SELECT * FROM private.filtered_research_responses(f)),
  versions AS (SELECT DISTINCT jsonb_build_object('questionnaire_version',questionnaire_version,
    'schema_version',submission_schema_version,'scoring_version',scoring_version,
    'specialty_config_revision',specialty_config_revision,'value_catalog_version',response->>'value_catalog_version',
    'specialty_catalog_version',response->>'specialty_catalog_version') version FROM cohort)
  SELECT jsonb_build_object('count',count(*),'checksum','md5:'||md5(coalesce(string_agg(
    respondent_type||':'||id||':'||md5(response::text),'|' ORDER BY respondent_type,id),'')),
    'members',coalesce(jsonb_agg(jsonb_build_object('id',id,'respondent_type',respondent_type,'checksum','md5:'||md5(response::text)) ORDER BY respondent_type,id),'[]'::jsonb),
    'model_versions',coalesce((SELECT jsonb_agg(version ORDER BY version::text) FROM versions),'[]'::jsonb)) INTO result FROM cohort;
  RETURN result;
END;
$$;

CREATE FUNCTION public.create_research_analysis_run(p_filters jsonb DEFAULT '{}',p_parameters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET statement_timeout = '10s' AS $$
DECLARE f jsonb; snapshot jsonb; rechecked jsonb; payload jsonb; saved private.research_analysis_runs;
  started timestamptz:=clock_timestamp(); key text;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  f:=private.validate_research_filters(p_filters);
  IF p_parameters IS NULL OR jsonb_typeof(p_parameters)<>'object' OR octet_length(p_parameters::text)>1024 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid analysis parameters';
  END IF;
  FOR key IN SELECT jsonb_object_keys(p_parameters) LOOP
    IF key NOT IN ('question_id','question_a','question_b') OR jsonb_typeof(p_parameters->key)<>'string' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unknown analysis parameter';
    END IF;
  END LOOP;
  IF (p_parameters ? 'question_a') IS DISTINCT FROM (p_parameters ? 'question_b') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Both correlation items are required';
  END IF;
  snapshot:=private.research_snapshot(f);
  SELECT * INTO saved FROM private.research_analysis_runs WHERE owner_id=auth.uid() AND filters=f
    AND parameters=p_parameters AND dataset_checksum=snapshot->>'checksum' AND analysis_version='research-sql-q81-v1'
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN (to_jsonb(saved)-'owner_id'-'snapshot_members')||'{"cache_hit":true}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(184205926,hashtext(auth.uid()::text));
  IF (SELECT count(*) FROM private.research_analysis_runs WHERE owner_id=auth.uid())>=20 THEN
    RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='At most 20 retained analysis runs per researcher; delete an old run first';
  END IF;
  payload:=jsonb_build_object('summary',public.research_cohort_summary(f));
  IF p_parameters ? 'question_id' THEN
    payload:=payload||jsonb_build_object('question',public.research_question_summary(f,p_parameters->>'question_id'));
  END IF;
  IF p_parameters ? 'question_a' THEN
    payload:=payload||jsonb_build_object('correlation',public.research_item_correlation(f,p_parameters->>'question_a',p_parameters->>'question_b'));
  END IF;
  -- Volatile PostgREST functions can observe concurrent commits across SQL
  -- statements: reject instead of attaching an old digest to newer statistics.
  rechecked:=private.research_snapshot(f);
  IF snapshot->>'checksum' IS DISTINCT FROM rechecked->>'checksum' THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='The research cohort changed during analysis; retry with the same filters';
  END IF;
  INSERT INTO private.research_analysis_runs(owner_id,completed_at,status,execution_ms,filters,parameters,analysis_version,
    dataset_checksum,snapshot_count,snapshot_members,model_versions,results)
  VALUES(auth.uid(),clock_timestamp(),'completed',ceil(extract(epoch FROM clock_timestamp()-started)*1000)::integer,
    f,p_parameters,'research-sql-q81-v1',snapshot->>'checksum',(snapshot->>'count')::integer,
    snapshot->'members',snapshot->'model_versions',payload) RETURNING * INTO saved;
  RETURN (to_jsonb(saved)-'owner_id'-'snapshot_members')||'{"cache_hit":false}'::jsonb;
END;
$$;
CREATE FUNCTION public.list_research_analysis_runs()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)-'owner_id'-'snapshot_members'-'results' ORDER BY created_at DESC)
    FROM private.research_analysis_runs r WHERE owner_id=auth.uid()),'[]'::jsonb);
END;
$$;
CREATE FUNCTION public.get_research_analysis_run(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  SELECT to_jsonb(r)-'owner_id'-'snapshot_members' INTO result FROM private.research_analysis_runs r WHERE id=p_id AND owner_id=auth.uid();
  IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Analysis run not available'; END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION public.delete_research_analysis_run(p_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_portal_role(ARRAY['researcher','doctor','professor']);
  PERFORM private.research_no_store();
  DELETE FROM private.research_analysis_runs WHERE id=p_id AND owner_id=auth.uid();
  RETURN FOUND;
END;
$$;

-- Revoke PostgreSQL's implicit PUBLIC execution on every new helper/API.
REVOKE ALL ON FUNCTION private.validate_research_filters(jsonb),private.filtered_research_responses(jsonb),private.research_exclusions(jsonb,text),private.research_snapshot(jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.research_cohort_summary(jsonb),public.research_response_page(jsonb,integer,jsonb,text),
  public.research_question_summary(jsonb,text),public.research_item_correlation(jsonb,text,text),
  public.create_research_analysis_run(jsonb,jsonb),public.list_research_analysis_runs(),public.get_research_analysis_run(uuid),public.delete_research_analysis_run(uuid),
  public.list_research_cohorts(),public.save_research_cohort(text,jsonb,uuid),public.delete_research_cohort(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.research_cohort_summary(jsonb),public.research_response_page(jsonb,integer,jsonb,text),
  public.research_question_summary(jsonb,text),public.research_item_correlation(jsonb,text,text),
  public.create_research_analysis_run(jsonb,jsonb),public.list_research_analysis_runs(),public.get_research_analysis_run(uuid),public.delete_research_analysis_run(uuid),
  public.list_research_cohorts(),public.save_research_cohort(text,jsonb,uuid),public.delete_research_cohort(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
