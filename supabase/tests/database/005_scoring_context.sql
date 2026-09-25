BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();
DO $$ BEGIN
 PERFORM set_config('context_test.ratings',(SELECT jsonb_object_agg(q,5)::text FROM unnest(private.question_catalog_q81_v1()) q),true);
 PERFORM set_config('context_test.scores',(SELECT jsonb_agg(jsonb_build_object('specialty',s,'score',50))::text FROM unnest(private.specialty_catalog_v1()) s),true);
 PERFORM set_config('context_test.catalog',(SELECT id::text FROM private.specialty_catalog_versions WHERE status='active'),true);
 PERFORM set_config('context_test.context','{"engine_revision":"scoring-engine-v2","trait_mapping_version":"question-traits-q81-v1","model_checksum":"fnv1a64-1234567890abcdef","priorities":{"thinking":10,"working":25,"interpersonal":50,"technical":75,"lifestyle":100}}',true);
END $$;
CREATE FUNCTION pg_temp.student_context(id uuid,context jsonb)
RETURNS uuid LANGUAGE sql AS $$
 SELECT public.submit_student_response_v7(id,'student',NULL,NULL,NULL,current_setting('context_test.ratings')::jsonb,'["Prestige"]',
 current_setting('context_test.scores')::jsonb,'en','q81-v1','career-values-v1','medical-specialties-v1','client-scoring-v2',
 'research-consent-2026-09-16-geography','medicine-view-optional-v2',current_setting('context_test.catalog')::uuid,NULL,NULL,context);
$$;
CREATE FUNCTION pg_temp.specialist_context(id uuid,completed boolean,context jsonb)
RETURNS uuid LANGUAGE sql AS $$
 SELECT public.submit_specialist_response_v6(id,'Cardiology',CASE WHEN completed THEN current_setting('context_test.ratings')::jsonb ELSE '{}'::jsonb END,
 CASE WHEN completed THEN '["Prestige"]'::jsonb ELSE '[]'::jsonb END,completed,'en','Current perspective','Changes over time','Empathy','yes',NULL,
 'What work suits me?','q81-v1','career-values-v1','medical-specialties-v1','calibration-v2-qualitative',
 'research-consent-2026-09-16-geography',current_setting('context_test.catalog')::uuid,NULL,NULL,context);
$$;
CREATE FUNCTION pg_temp.legacy_student(id uuid)
RETURNS uuid LANGUAGE sql AS $$
 SELECT public.submit_student_response_v6(id,'student',NULL,NULL,NULL,current_setting('context_test.ratings')::jsonb,'["Prestige"]',
 current_setting('context_test.scores')::jsonb,'en','q81-v1','career-values-v1','medical-specialties-v1','client-scoring-v2',
 'research-consent-2026-09-16-geography','medicine-view-optional-v2',current_setting('context_test.catalog')::uuid,NULL,NULL);
$$;
SELECT extensions.ok(private.valid_research_scoring_context(current_setting('context_test.context')::jsonb),'known versioned priority context is valid');
SELECT extensions.ok(NOT private.valid_research_scoring_context(NULL),'null is unavailable, never fabricated valid context');
SELECT extensions.ok(NOT private.valid_research_scoring_context(current_setting('context_test.context')::jsonb||'{"extra":true}'),'unexpected context keys rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(current_setting('context_test.context')::jsonb||'{"engine_revision":"unknown"}'),'unknown scoring engines rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(current_setting('context_test.context')::jsonb||'{"trait_mapping_version":"q99"}'),'unknown trait mapping rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(current_setting('context_test.context')::jsonb||'{"model_checksum":"invalid"}'),'invalid model checksum shape rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(jsonb_set(current_setting('context_test.context')::jsonb,'{priorities,thinking}','101')),'priority above 100 rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(jsonb_set(current_setting('context_test.context')::jsonb,'{priorities,thinking}','-1')),'negative priority rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(jsonb_set(current_setting('context_test.context')::jsonb,'{priorities,thinking}','"50"')),'numeric-looking priority strings rejected');
SELECT extensions.ok(NOT private.valid_research_scoring_context(current_setting('context_test.context')::jsonb#-'{priorities,thinking}'),'all five dimensions must be recorded explicitly');
SELECT extensions.ok(NOT private.valid_research_scoring_context(jsonb_set(current_setting('context_test.context')::jsonb,'{priorities,unknown}','50')),'extra priority dimensions rejected');

SET LOCAL ROLE anon;
SELECT extensions.is(pg_temp.student_context('76000000-0000-4000-8000-000000000001',current_setting('context_test.context')::jsonb),
 '76000000-0000-4000-8000-000000000001'::uuid,'anonymous consented student submission with context succeeds');
SELECT extensions.is(pg_temp.student_context('76000000-0000-4000-8000-000000000001',current_setting('context_test.context')::jsonb),
 '76000000-0000-4000-8000-000000000001'::uuid,'same exact id and context retry returns original acknowledgement');
SELECT extensions.throws_ok($$SELECT pg_temp.student_context('76000000-0000-4000-8000-000000000001',jsonb_set(current_setting('context_test.context')::jsonb,'{priorities,thinking}','50'))$$,
 '23505','Submission id already exists with a different scoring context','different sliders cannot overwrite existing response under same id');
SELECT extensions.throws_ok($$SELECT pg_temp.student_context('76000000-0000-4000-8000-000000000002',NULL)$$,
 '22023','Invalid scoring provenance','new student protocol requires explicit context');
SELECT extensions.lives_ok($$SELECT pg_temp.legacy_student('76000000-0000-4000-8000-000000000003')$$,'older consented client protocol remains supported');
SELECT extensions.throws_ok($$SELECT pg_temp.student_context('76000000-0000-4000-8000-000000000003',current_setting('context_test.context')::jsonb)$$,
 '23505','Submission id already exists with a different scoring context','historical missing sliders cannot be invented by a new-client retry');
SELECT extensions.lives_ok($$SELECT pg_temp.legacy_student('76000000-0000-4000-8000-000000000001')$$,'legacy retry does not overwrite new provenance');
SELECT extensions.is(pg_temp.specialist_context('76000000-0000-4000-8000-000000000004',true,current_setting('context_test.context')::jsonb),
 '76000000-0000-4000-8000-000000000004'::uuid,'completed specialist stores scoring context');
SELECT extensions.is(pg_temp.specialist_context('76000000-0000-4000-8000-000000000004',true,current_setting('context_test.context')::jsonb),
 '76000000-0000-4000-8000-000000000004'::uuid,'specialist same-payload retry remains idempotent');
SELECT extensions.throws_ok($$SELECT pg_temp.specialist_context('76000000-0000-4000-8000-000000000004',true,jsonb_set(current_setting('context_test.context')::jsonb,'{priorities,thinking}','50'))$$,
 '23505','Submission id already exists with a different scoring context','specialist context collision rejected');
SELECT extensions.lives_ok($$SELECT pg_temp.specialist_context('76000000-0000-4000-8000-000000000005',false,NULL)$$,'skipped specialist questionnaire has no invented scoring context');
SELECT extensions.throws_ok($$SELECT pg_temp.specialist_context('76000000-0000-4000-8000-000000000006',false,current_setting('context_test.context')::jsonb)$$,
 '22023','Invalid scoring provenance','skipped specialist cannot submit a spurious computed context');
RESET ROLE;
SELECT extensions.is((SELECT scoring_context FROM public.student_responses WHERE id='76000000-0000-4000-8000-000000000001'),
 current_setting('context_test.context')::jsonb,'exact personalized values survive every replay and conflict');
SELECT extensions.is((SELECT scoring_context FROM public.student_responses WHERE id='76000000-0000-4000-8000-000000000003'),NULL::jsonb,
 'legacy context stays SQL null with no backfill');
SELECT extensions.is((SELECT response->'scoring_context' FROM private.research_response_index WHERE id='76000000-0000-4000-8000-000000000001'),
 current_setting('context_test.context')::jsonb,'bounded research page source preserves new provenance');
SELECT extensions.is((SELECT count(*) FROM public.student_responses WHERE id::text LIKE '76000000%'),2::bigint,'invalid payloads and retries create no extra students');
SELECT extensions.is((SELECT count(*) FROM public.specialist_responses WHERE id::text LIKE '76000000%'),2::bigint,'invalid payloads and retries create no extra specialists');
SELECT extensions.is(nullif(current_setting('qpro.submission_scoring_context',true),''),NULL::text,'transaction local context restored after calls');
SELECT * FROM extensions.finish();
ROLLBACK;
