BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();
INSERT INTO auth.users(id,email) VALUES
 ('78000000-0000-4000-8000-000000000001','budget-one@example.test'),
 ('78000000-0000-4000-8000-000000000002','budget-two@example.test');
INSERT INTO private.researchers(user_id,enabled,portal_role) VALUES
 ('78000000-0000-4000-8000-000000000001',true,'researcher'),
 ('78000000-0000-4000-8000-000000000002',true,'professor');
SELECT extensions.ok(NOT has_table_privilege('authenticated','private.research_request_windows','UPDATE'),'clients cannot reset their request budget');
SELECT extensions.ok(NOT has_function_privilege('authenticated','private.research_cohort_summary(jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','private.research_question_summary(jsonb,text)','EXECUTE')
 AND NOT has_function_privilege('authenticated','private.research_item_correlation(jsonb,text,text)','EXECUTE'),
 'clients cannot bypass rate limits through private analysis cores');
SELECT set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 PERFORM set_config('budget.q',(private.question_catalog_q81_v1())[1],true);
 PERFORM set_config('budget.qb',(private.question_catalog_q81_v1())[2],true);
END $$;
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok('SELECT public.research_cohort_summary()','summary consumes a permitted expensive operation');
SELECT extensions.lives_ok($$SELECT public.research_question_summary('{}',current_setting('budget.q'))$$,'item summary uses same account budget');
SELECT extensions.lives_ok($$SELECT public.research_item_correlation('{}',current_setting('budget.q'),current_setting('budget.qb'))$$,'correlation uses same account budget');
SELECT extensions.lives_ok($$SELECT public.create_research_analysis_run('{}',jsonb_build_object('question_id',current_setting('budget.q'),'question_a',current_setting('budget.q'),'question_b',current_setting('budget.qb')))$$,
 'analysis with nested summary item and correlation succeeds');
RESET ROLE;
SELECT extensions.is((SELECT operation_count FROM private.research_request_windows WHERE user_id=auth.uid()),4,'nested analysis charges once, not once per internal calculation');
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok($$SELECT public.create_research_analysis_run('{}',jsonb_build_object('question_id',current_setting('budget.q'),'question_a',current_setting('budget.q'),'question_b',current_setting('budget.qb')))$$,
 'cached analysis still counts its snapshot-read work');
DO $$ BEGIN FOR i IN 1..25 LOOP PERFORM public.research_cohort_summary(); END LOOP; END $$;
SELECT extensions.throws_ok('SELECT public.research_cohort_summary()','PGRST',NULL,'31st successful operation in window is denied server-side');
SELECT extensions.throws_ok($$SELECT public.research_question_summary('{}',current_setting('budget.q'))$$,'PGRST',NULL,'switching to another expensive endpoint cannot bypass exhausted quota');
SELECT extensions.throws_ok('SELECT public.create_research_analysis_run()','PGRST',NULL,'analysis creation cannot bypass exhausted quota');
RESET ROLE;
SELECT extensions.is((SELECT operation_count FROM private.research_request_windows WHERE user_id=auth.uid()),30,'denied calls do not mutate successful-operation counter');
DO $$ DECLARE detail text; BEGIN
 BEGIN PERFORM public.research_cohort_summary();
 EXCEPTION WHEN SQLSTATE 'PGRST' THEN GET STACKED DIAGNOSTICS detail=PG_EXCEPTION_DETAIL; END;
 IF detail::jsonb->>'status'<>'429' OR detail::jsonb->'headers'->>'Retry-After'<>'300'
   OR detail::jsonb->'headers'->>'Cache-Control'<>'no-store, private, max-age=0' THEN
   RAISE EXCEPTION 'Invalid rate-limit response headers'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok('SELECT public.research_cohort_summary()','one account cannot exhaust another account budget');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000001',true);
UPDATE private.research_request_windows SET window_started_at=now()-interval '6 minutes' WHERE user_id=auth.uid();
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT public.research_cohort_summary('{"unknown":true}')$$,'22023',NULL,'invalid inputs fail rather than charging successful operations');
RESET ROLE;
SELECT extensions.is((SELECT operation_count FROM private.research_request_windows WHERE user_id=auth.uid()),30,'failed operation rolls back its attempted window reset');
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok('SELECT public.research_cohort_summary()','expired window allows a new successful request');
RESET ROLE;
SELECT extensions.is((SELECT operation_count FROM private.research_request_windows WHERE user_id=auth.uid()),1,'new window starts at one, without preserving exhausted count');
SELECT extensions.is((SELECT count(*) FROM private.research_request_windows),2::bigint,'storage stays one counter per authorized account, not an event log');
SELECT * FROM extensions.finish();
ROLLBACK;
