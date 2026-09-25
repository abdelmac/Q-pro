BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();
INSERT INTO auth.users(id,email) VALUES
 ('74000000-0000-4000-8000-000000000001','ordinary-features@example.test'),
 ('74000000-0000-4000-8000-000000000002','researcher-features@example.test'),
 ('74000000-0000-4000-8000-000000000003','doctor-features@example.test'),
 ('74000000-0000-4000-8000-000000000004','professor-features@example.test');
INSERT INTO private.researchers(user_id,enabled,portal_role) VALUES
 ('74000000-0000-4000-8000-000000000002',true,'researcher'),
 ('74000000-0000-4000-8000-000000000003',true,'doctor'),
 ('74000000-0000-4000-8000-000000000004',true,'professor');

SELECT extensions.ok(NOT has_table_privilege('anon','private.public_features','SELECT')
 AND NOT has_table_privilege('authenticated','private.public_features','UPDATE'),'settings have no direct client grants');
SELECT extensions.ok(NOT has_table_privilege('authenticated','private.public_features_audit','INSERT')
 AND NOT has_table_privilege('authenticated','private.research_analysis_runs','SELECT'),'audits and snapshots are not directly exposed');
SET LOCAL ROLE anon;
SELECT extensions.is(public.get_public_features(),'{"public_map_enabled":false}'::jsonb,'public setting defaults to disabled and exposes exactly one field');
SELECT extensions.ok(current_setting('response.headers')::jsonb @> '[{"Cache-Control":"no-store, private, max-age=0"}]'::jsonb,'public settings disallow caching');
SELECT extensions.throws_ok('SELECT public.get_participation_map_stats()','PGRST',NULL,'anonymous public geography denied while disabled');
SELECT extensions.throws_ok('SELECT public.set_public_map_enabled(true)','42501',NULL,'anonymous setting mutation denied');
SELECT extensions.throws_ok('SELECT public.research_cohort_summary()','42501',NULL,'anonymous analytics denied');
SELECT extensions.throws_ok('SELECT public.get_private_participation_map_stats()','42501',NULL,'anonymous private map denied');
RESET ROLE;

-- Check the disabled error contains explicit no-store headers, even though
-- a raised exception rolls back ordinary response-header session settings.
DO $$ DECLARE detail text; BEGIN
  BEGIN PERFORM public.get_participation_map_stats();
  EXCEPTION WHEN SQLSTATE 'PGRST' THEN GET STACKED DIAGNOSTICS detail=PG_EXCEPTION_DETAIL; END;
  IF detail::jsonb->'headers'->>'Cache-Control' <> 'no-store, private, max-age=0' THEN RAISE EXCEPTION 'Missing denial cache headers'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.set_public_map_enabled(true)','42501',NULL,'ordinary account cannot enable map');
SELECT extensions.throws_ok('SELECT public.research_response_page()','42501',NULL,'ordinary account cannot page research responses');
SELECT extensions.throws_ok('SELECT public.get_participation_map_stats()','PGRST',NULL,'ordinary authenticated map access denied');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.set_public_map_enabled(true)','42501',NULL,'researcher cannot change administrative public feature');
SELECT extensions.lives_ok('SELECT public.get_private_participation_map_stats()','allowlisted researcher keeps private map while public disabled');
SELECT extensions.throws_ok('SELECT public.get_participation_map_stats()','PGRST',NULL,'public route is blocked even for allowlisted researcher');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.set_public_map_enabled(true),'{"public_map_enabled":true}'::jsonb,'doctor can enable public map');
SELECT extensions.is(public.set_public_map_enabled(true),'{"public_map_enabled":true}'::jsonb,'repeated enable is idempotent');
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM private.public_features_audit),1::bigint,'audit records changes, not idempotent repeats');
SELECT extensions.ok((SELECT actor_user_id='74000000-0000-4000-8000-000000000003' AND actor_role='doctor'
 AND previous_value=false AND new_value=true AND occurred_at IS NOT NULL FROM private.public_features_audit),'audit retains actor timestamp old and new value');
SET LOCAL ROLE anon;
SELECT extensions.lives_ok('SELECT public.get_participation_map_stats()','public overview works after enabling');
SELECT extensions.ok(current_setting('response.headers')::jsonb @> '[{"Cache-Control":"no-store, private, max-age=0"}]'::jsonb,'enabled public map is not cacheable');
SELECT extensions.throws_ok($$SELECT public.get_participation_map_stats('student')$$,'42501',NULL,'enabled public map cannot probe filtered small cells');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.set_public_map_enabled(false),'{"public_map_enabled":false}'::jsonb,'professor can disable again');
SELECT extensions.throws_ok('SELECT public.get_participation_map_stats()','PGRST',NULL,'even administrators cannot bypass disabled public endpoint');
SELECT extensions.lives_ok('SELECT public.get_private_participation_map_stats()','private map unaffected by disable');
RESET ROLE;
DELETE FROM private.public_features WHERE singleton;
SET LOCAL ROLE anon;
SELECT extensions.is(public.get_public_features(),'{"public_map_enabled":false}'::jsonb,'missing configuration fails closed');
SELECT extensions.throws_ok('SELECT public.get_participation_map_stats()','PGRST',NULL,'missing configuration blocks direct public map API');
RESET ROLE;

-- Synthetic valid submissions use existing idempotent write RPCs, no production
-- data, no fabricated provenance or recovered historical preferences.
DO $$ DECLARE ratings jsonb; scores jsonb; catalog uuid; q text;
BEGIN
  SELECT jsonb_object_agg(question_id,5) INTO ratings FROM unnest(private.question_catalog_q81_v1()) question_id;
  SELECT jsonb_agg(jsonb_build_object('specialty',name,'score',50)) INTO scores FROM unnest(private.specialty_catalog_v1()) name;
  SELECT id INTO catalog FROM private.specialty_catalog_versions WHERE status='active';
  q:=(private.question_catalog_q81_v1())[1];
  PERFORM set_config('test.question',q,true);
  PERFORM set_config('test.question_b',(private.question_catalog_q81_v1())[2],true);
  PERFORM public.submit_student_response_v6('75000000-0000-4000-8000-000000000001','student',NULL,NULL,NULL,ratings,'["Prestige"]',scores,'en',
    'q81-v1','career-values-v1','medical-specialties-v1','client-scoring-v2','research-consent-2026-09-16-geography','medicine-view-optional-v2',catalog,NULL,NULL);
  PERFORM public.submit_student_response_v6('75000000-0000-4000-8000-000000000001','student',NULL,NULL,NULL,ratings,'["Prestige"]',scores,'en',
    'q81-v1','career-values-v1','medical-specialties-v1','client-scoring-v2','research-consent-2026-09-16-geography','medicine-view-optional-v2',catalog,NULL,NULL);
  PERFORM public.submit_student_response_v6('75000000-0000-4000-8000-000000000002','curious',NULL,NULL,NULL,
    jsonb_set(ratings,ARRAY[q],'10'),'["Prestige"]',scores,'fr',
    'q81-v1','career-values-v1','medical-specialties-v1','client-scoring-v2','research-consent-2026-09-16-geography','medicine-view-optional-v2',catalog,'FR',NULL);
  PERFORM public.submit_specialist_response_v5('75000000-0000-4000-8000-000000000003','Cardiology','{}','[]',false,'ro',
    'Current perspective','Changes over time','Empathy','yes',NULL,'What work suits me?',
    'q81-v1','career-values-v1','medical-specialties-v1','calibration-v2-qualitative','research-consent-2026-09-16-geography',catalog,'RO',NULL);
END $$;
UPDATE public.student_responses SET created_at='2026-01-02 12:00Z' WHERE id::text LIKE '75000000%';
UPDATE public.specialist_responses SET created_at='2026-01-02 12:00Z' WHERE id::text LIKE '75000000%';

SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.research_cohort_summary()->>'total','3','submission retry creates no duplicate');
SELECT extensions.is(public.research_cohort_summary()->>'eligible','2','missing optional year and geography do not invalidate questionnaires');
SELECT extensions.is(public.research_cohort_summary()->>'excluded','1','deliberate specialist questionnaire skip is excluded from quantitative denominator');
SELECT extensions.is(public.research_cohort_summary()->>'missing_geography','1','missing geography counted separately');
SELECT extensions.is(public.research_cohort_summary('{"respondent_type":"non_medical"}')->>'total','1','curious participant category normalizes to non-medical');
SELECT extensions.is(public.research_cohort_summary('{"language":"fr"}')->>'global_total','3','global denominator remains explicit under filters');
SELECT extensions.is(public.research_cohort_summary('{"language":"fr"}')->>'total','1','filtered denominator only contains selected language');
SELECT extensions.is(public.research_cohort_summary('{"country_code":"missing"}')->>'eligible','1','missing geography can be selected without exclusion');
SELECT extensions.throws_ok($$SELECT public.research_cohort_summary('{"role":"professor"}')$$,'22023',NULL,'unknown client filter cannot become an authorization claim');
SELECT extensions.throws_ok($$SELECT public.research_cohort_summary('{"study_year":12}')$$,'22023',NULL,'invalid study years rejected');
SELECT extensions.throws_ok($$SELECT public.research_cohort_summary('{"date_from":"2026-02-01","date_to":"2026-01-01"}')$$,'22023',NULL,'inverted periods rejected');
SELECT extensions.throws_ok($$SELECT public.research_response_page('{}',101)$$,'22023',NULL,'server enforces maximum page size');
SELECT set_config('test.page',public.research_response_page('{}',2)::text,true);
SELECT extensions.is(jsonb_array_length(current_setting('test.page')::jsonb->'rows'),2,'bounded response page contains requested size');
SELECT extensions.ok(current_setting('test.page')::jsonb->'next_cursor'<>'null'::jsonb,'cursor present when another page exists');
SELECT extensions.is(jsonb_array_length(public.research_response_page('{}',2,current_setting('test.page')::jsonb->'next_cursor')->'rows'),1,'cursor with timestamp id and role prevents duplicates at equal timestamps');
SELECT extensions.is(public.research_response_page('{}',2,current_setting('test.page')::jsonb->'next_cursor')->'next_cursor','null'::jsonb,'last page terminates pagination');
SELECT extensions.is(public.research_question_summary('{}',current_setting('test.question'))->>'n','2','question denominator counts only eligible q81 submissions');
SELECT extensions.is((public.research_question_summary('{}',current_setting('test.question'))->>'mean')::numeric,7.5::numeric,'server question mean matches known original ratings');
SELECT extensions.is((public.research_question_summary('{}',current_setting('test.question'))->>'median')::numeric,7.5::numeric,'server median handles an even sample');
SELECT extensions.is(public.research_question_summary('{}',current_setting('test.question'))->>'ceiling','1','ceiling count uses original ten-point scale');
SELECT extensions.is(public.research_question_summary('{}',current_setting('test.question'))->>'missing','1','missing item is distinguished from completed questionnaires');
SELECT extensions.is(public.research_question_summary('{}',current_setting('test.question'))->>'excluded','1','excluded rows have an explicit separate count');
SELECT extensions.is(jsonb_array_length(public.research_question_summary('{}',current_setting('test.question'))->'distribution'),10,'all ten original-value bins are returned including zeros');
SELECT extensions.throws_ok($$SELECT public.research_question_summary('{"questionnaire_version":"q82-v2"}',current_setting('test.question'))$$,'22023',NULL,'incompatible questionnaire versions cannot silently mix');
SELECT extensions.is(public.research_item_correlation('{}',current_setting('test.question'),current_setting('test.question_b'))->'r','null'::jsonb,'zero variance correlation is undefined, not fabricated');
SELECT extensions.is(public.research_item_correlation('{}',current_setting('test.question'),current_setting('test.question_b'))->>'n','2','correlation reports its actual eligible sample');

SELECT set_config('test.cohort',public.save_research_cohort('French participants','{"language":"fr"}')::text,true);
SELECT extensions.is(jsonb_array_length(public.list_research_cohorts()),1,'researcher can persist a named live filter');
SELECT extensions.is(public.save_research_cohort('French q81','{"language":"fr","questionnaire_version":"q81-v1"}',(current_setting('test.cohort')::jsonb->>'id')::uuid)->>'name','French q81','owner can update saved filter');
SELECT set_config('test.run',public.create_research_analysis_run('{}',jsonb_build_object('question_id',current_setting('test.question')))::text,true);
SELECT extensions.is(current_setting('test.run')::jsonb->>'snapshot_count','3','analysis stores exact bounded snapshot size');
SELECT extensions.is(current_setting('test.run')::jsonb->>'cache_hit','false','first analysis is calculated');
SELECT extensions.is(public.create_research_analysis_run('{}',jsonb_build_object('question_id',current_setting('test.question')))->>'cache_hit','true','unchanged exact cohort and parameters reuse completed analysis');
SELECT extensions.ok(NOT current_setting('test.run')::jsonb ? 'snapshot_members','analysis response does not leak internal membership records');
SELECT extensions.is(jsonb_array_length(public.list_research_analysis_runs()),1,'cached retry does not duplicate run');
SELECT extensions.ok(NOT (public.list_research_analysis_runs()->0) ? 'results','run list is a bounded metadata response');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.list_research_cohorts(),'[]'::jsonb,'researchers do not list another owner private cohorts');
SELECT extensions.is(public.delete_research_cohort((current_setting('test.cohort')::jsonb->>'id')::uuid),false,'another researcher cannot delete cohort');
SELECT extensions.throws_ok($$SELECT public.get_research_analysis_run((current_setting('test.run')::jsonb->>'id')::uuid)$$,'42501',NULL,'another researcher cannot retrieve private run');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','74000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.delete_research_cohort((current_setting('test.cohort')::jsonb->>'id')::uuid),true,'owner can remove saved filter');
SELECT extensions.is(public.delete_research_analysis_run((current_setting('test.run')::jsonb->>'id')::uuid),true,'owner can remove retained derived analysis');
RESET ROLE;
UPDATE private.researchers SET enabled=false WHERE user_id='74000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.research_cohort_summary()','42501',NULL,'allowlist revocation takes effect immediately without refreshing claims');
SELECT extensions.throws_ok('SELECT public.get_private_participation_map_stats()','42501',NULL,'revoked researcher loses private map immediately');
RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
