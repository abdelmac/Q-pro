-- LOCAL SYNTHETIC BENCHMARK ONLY. Never point this at a production database.
-- All inserted rows roll back. The test harness must already provide Auth roles,
-- apply every migration, and run this as the local database owner.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();
INSERT INTO auth.users(id,email) VALUES('77000000-0000-4000-8000-000000000001','benchmark-only@example.test');
INSERT INTO private.researchers(user_id,enabled,portal_role) VALUES('77000000-0000-4000-8000-000000000001',true,'researcher');
SELECT set_config('request.jwt.claim.sub','77000000-0000-4000-8000-000000000001',true);

DO $$ DECLARE ratings jsonb; scores jsonb; catalog uuid; first_id uuid;
BEGIN
 SELECT jsonb_object_agg(q,5) INTO ratings FROM unnest(private.question_catalog_q81_v1()) q;
 SELECT jsonb_agg(jsonb_build_object('specialty',s,'score',50)) INTO scores FROM unnest(private.specialty_catalog_v1()) s;
 SELECT id INTO catalog FROM private.specialty_catalog_versions WHERE status='active';
 first_id:=public.submit_student_response_v6(gen_random_uuid(),'student',NULL,NULL,NULL,ratings,'["Prestige"]',scores,'en',
 'q81-v1','career-values-v1','medical-specialties-v1','client-scoring-v2','research-consent-2026-09-16-geography',
 'medicine-view-optional-v2',catalog,NULL,NULL);
 -- Copy synthetic valid rows only. The benchmark never reads real submissions.
 INSERT INTO public.student_responses(id,created_at,study_year,preferred_specialty,ratings,selected_values,client_scores,
   language,submission_schema_version,questionnaire_version,value_catalog_version,specialty_catalog_version,scoring_version,
   consent_version,specialty_config_version_id,specialty_config_revision,participant_role,medicine_view,participant_reflection_version)
 SELECT gen_random_uuid(),'2025-01-01'::timestamptz+n*interval '1 minute',NULL,NULL,s.ratings,s.selected_values,s.client_scores,
   CASE n%3 WHEN 0 THEN 'fr' WHEN 1 THEN 'ro' ELSE 'en' END,s.submission_schema_version,s.questionnaire_version,
   s.value_catalog_version,s.specialty_catalog_version,s.scoring_version,s.consent_version,s.specialty_config_version_id,
   s.specialty_config_revision,CASE WHEN n%2=0 THEN 'curious' ELSE 'student' END,NULL,s.participant_reflection_version
 FROM public.student_responses s CROSS JOIN generate_series(1,999) n WHERE s.id=first_id;
END $$;
ANALYZE public.student_responses;

CREATE TEMP TABLE timings(label text,milliseconds numeric,returned_bytes integer);
DO $$ DECLARE started timestamptz; result jsonb; q text:=(private.question_catalog_q81_v1())[1];
BEGIN
 started:=clock_timestamp();result:=public.research_cohort_summary();
 INSERT INTO timings VALUES('summary_1000',extract(epoch FROM clock_timestamp()-started)*1000,octet_length(result::text));
 started:=clock_timestamp();result:=public.research_response_page('{}',50);
 INSERT INTO timings VALUES('page_50_of_1000',extract(epoch FROM clock_timestamp()-started)*1000,octet_length(result::text));
 started:=clock_timestamp();result:=public.research_question_summary('{}',q);
 INSERT INTO timings VALUES('one_question_1000',extract(epoch FROM clock_timestamp()-started)*1000,octet_length(result::text));
 started:=clock_timestamp();result:=public.create_research_analysis_run('{}',jsonb_build_object('question_id',q));
 INSERT INTO timings VALUES('frozen_run_1000',extract(epoch FROM clock_timestamp()-started)*1000,octet_length(result::text));
 started:=clock_timestamp();result:=public.create_research_analysis_run('{}',jsonb_build_object('question_id',q));
 INSERT INTO timings VALUES('cached_run_1000',extract(epoch FROM clock_timestamp()-started)*1000,octet_length(result::text));
END $$;
SELECT extensions.ok(true,'BENCHMARK '||label||' '||round(milliseconds,1)||' ms, '||returned_bytes||' returned JSON bytes') FROM timings;
SELECT extensions.ok(true,'SIZE synthetic students heap+toast+indexes '||pg_total_relation_size('public.student_responses')||' bytes');
SELECT extensions.ok(true,'SIZE average synthetic response JSON '||round(avg(octet_length(to_jsonb(s)::text)))||' bytes') FROM public.student_responses s;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
 SELECT id,created_at FROM private.filtered_research_responses('{}')
 WHERE (created_at,id)<('2025-01-01 16:00Z','ffffffff-ffff-ffff-ffff-ffffffffffff')
 ORDER BY created_at DESC,id DESC LIMIT 50;
CREATE FUNCTION pg_temp.page_plan(direction text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 IF direction='newest' THEN
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,created_at FROM private.filtered_research_responses(''{}'')
   WHERE (created_at,id)<(''2025-01-01 16:00Z'',''ffffffff-ffff-ffff-ffff-ffffffffffff'') ORDER BY created_at DESC,id DESC LIMIT 50' INTO result;
 ELSE
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,created_at FROM private.filtered_research_responses(''{}'')
   WHERE (created_at,id)>(''2025-01-01 01:00Z'',''00000000-0000-0000-0000-000000000000'') ORDER BY created_at,id LIMIT 50' INTO result;
 END IF;
 RETURN result;
END;
$$;
SELECT extensions.ok(pg_temp.page_plan('newest')::text ~ 'student_responses_created_(id|at)_idx',
 'newest keyset plan uses a submission timestamp index');
SELECT extensions.ok(pg_temp.page_plan('oldest')::text ~ 'student_responses_created_(id|at)_idx',
 'oldest keyset plan uses a submission timestamp index');

-- Exercise the hard job boundary without running a costly unbounded analysis.
INSERT INTO public.student_responses(id,created_at,study_year,preferred_specialty,ratings,selected_values,client_scores,
 language,submission_schema_version,questionnaire_version,value_catalog_version,specialty_catalog_version,scoring_version,
 consent_version,specialty_config_version_id,specialty_config_revision,participant_role,medicine_view,participant_reflection_version)
SELECT gen_random_uuid(),'2024-01-01'::timestamptz+n*interval '1 minute',NULL,NULL,s.ratings,s.selected_values,s.client_scores,
 s.language,s.submission_schema_version,s.questionnaire_version,s.value_catalog_version,s.specialty_catalog_version,s.scoring_version,
 s.consent_version,s.specialty_config_version_id,s.specialty_config_revision,s.participant_role,NULL,s.participant_reflection_version
FROM (SELECT * FROM public.student_responses ORDER BY id LIMIT 1) s CROSS JOIN generate_series(1,4001) n;
SELECT extensions.throws_ok($$SELECT public.create_research_analysis_run()$$,'54000',
 'Analysis cohort exceeds 5000 submissions; narrow the filters or use the offline research workflow',
 '5001-submission cohort is refused, never silently truncated or sampled');
SELECT * FROM extensions.finish();
ROLLBACK;
