BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- Local/CI regression fixtures only; every row and session setting rolls back.
-- A professor's research-only account uses the existing researcher role.
-- The historical professor role remains an administrator/publisher.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('78000000-0000-4000-8000-000000000001', 'portal-ordinary@example.test', '{}'),
  ('78000000-0000-4000-8000-000000000002', 'portal-research-professor@example.test', '{"role":"professor","can_edit":true}'),
  ('78000000-0000-4000-8000-000000000003', 'portal-existing-admin@example.test', '{}');
INSERT INTO private.researchers (user_id, display_name, enabled, portal_role) VALUES
  ('78000000-0000-4000-8000-000000000002', 'Synthetic research professor', true, 'researcher'),
  ('78000000-0000-4000-8000-000000000003', 'Synthetic existing administrator', true, 'professor');

DO $fixtures$
DECLARE ratings jsonb; scores jsonb; catalog uuid;
BEGIN
  SELECT jsonb_object_agg(question_id, 5) INTO ratings
    FROM unnest(private.question_catalog_q81_v1()) question_id;
  SELECT jsonb_agg(jsonb_build_object('specialty', name, 'score', 50)) INTO scores
    FROM unnest(private.specialty_catalog_v1()) name;
  SELECT id INTO catalog FROM private.specialty_catalog_versions WHERE status = 'active';
  PERFORM public.submit_student_response_v6(
    '79000000-0000-4000-8000-000000000001', 'student', 'Synthetic student reflection', 3, 'Cardiology',
    ratings, '["Prestige"]', scores, 'en', 'q81-v1', 'career-values-v1', 'medical-specialties-v1',
    'client-scoring-v2', 'research-consent-2026-09-16-geography', 'medicine-view-optional-v2', catalog, 'RO', NULL);
  PERFORM public.submit_student_response_v6(
    '79000000-0000-4000-8000-000000000002', 'curious', 'Synthetic explorer reflection', NULL, NULL,
    ratings, '["Prestige"]', scores, 'en', 'q81-v1', 'career-values-v1', 'medical-specialties-v1',
    'client-scoring-v2', 'research-consent-2026-09-16-geography', 'medicine-view-optional-v2', catalog, 'FR', NULL);
  PERFORM public.submit_specialist_response_v5(
    '79000000-0000-4000-8000-000000000003', 'Cardiology', ratings, '["Prestige"]', true, 'en',
    'Synthetic current perspective', 'Synthetic changes over time', 'Empathy', 'yes', NULL, 'What work suits me?',
    'q81-v1', 'career-values-v1', 'medical-specialties-v1', 'calibration-v2-qualitative',
    'research-consent-2026-09-16-geography', catalog, 'RO', NULL);
END;
$fixtures$;

-- Deliberately isolated dates identify only this transactional test cohort.
UPDATE public.student_responses SET created_at = '2098-06-15 12:00:00+00'
  WHERE id IN ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000002');
UPDATE public.specialist_responses SET created_at = '2098-06-15 12:00:00+00'
  WHERE id = '79000000-0000-4000-8000-000000000003';
SELECT set_config('professor_portal_test.filters', '{"date_from":"2098-06-15","date_to":"2098-06-15"}', true);

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT extensions.throws_ok(statement, '42501', NULL, label)
FROM (VALUES
  ('SELECT public.current_user_portal_profile()', 'anonymous visitor cannot obtain a staff profile'),
  ('SELECT public.research_response_page()', 'anonymous visitor cannot export responses'),
  ('SELECT public.research_cohort_summary()', 'anonymous visitor cannot read research summaries'),
  ('SELECT public.get_private_participation_map_stats()', 'anonymous visitor cannot read the private map'),
  ('SELECT * FROM public.student_responses', 'anonymous visitor cannot select student responses'),
  ('SELECT * FROM public.specialist_responses', 'anonymous visitor cannot select specialist responses')
) AS denied(statement, label);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '78000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"78000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.current_user_portal_profile()->>'authorized', 'false', 'ordinary login is not a portal account');
SELECT extensions.is((SELECT count(*) FROM public.student_responses), 0::bigint, 'ordinary login cannot read or export student rows');
SELECT extensions.is((SELECT count(*) FROM public.specialist_responses), 0::bigint, 'ordinary login cannot read or export specialist rows');
SELECT extensions.throws_ok(statement, '42501', NULL, label)
FROM (VALUES
  ('SELECT public.research_response_page()', 'ordinary login cannot page research responses'),
  ('SELECT public.research_cohort_summary()', 'ordinary login cannot read research summaries'),
  ('SELECT public.get_private_participation_map_stats()', 'ordinary login cannot read the private map')
) AS denied(statement, label);
RESET ROLE;

UPDATE auth.users SET raw_user_meta_data = '{"role":"professor","portal_role":"professor","authorized":true,"can_view_research":true}'
  WHERE id = '78000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claims', '{"sub":"78000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"professor","portal_role":"professor","authorized":true,"can_view_research":true}}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.current_user_portal_profile()->>'authorized', 'false', 'forged user metadata does not authorize a portal account');
SELECT extensions.is((SELECT count(*) FROM public.student_responses), 0::bigint, 'forged metadata cannot bypass student RLS');
SELECT extensions.is((SELECT count(*) FROM public.specialist_responses), 0::bigint, 'forged metadata cannot bypass specialist RLS');
SELECT extensions.throws_ok(statement, '42501', NULL, label)
FROM (VALUES
  ('SELECT public.research_response_page()', 'forged professor metadata cannot export research'),
  ('SELECT public.research_cohort_summary()', 'forged professor metadata cannot read research summaries'),
  ('SELECT public.get_private_participation_map_stats()', 'forged professor metadata cannot read private geography'),
  ('SELECT public.set_public_map_enabled(true)', 'forged professor metadata cannot change public settings')
) AS denied(statement, label);
RESET ROLE;

-- Reuse the same forged metadata on a real researcher: it must not escalate.
SELECT set_config('request.jwt.claim.sub', '78000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"78000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"professor","portal_role":"professor","can_edit":true,"can_publish":true}}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.current_user_portal_profile()->>'role', 'researcher', 'research professor retains the server-side researcher role');
SELECT extensions.is(public.current_user_portal_profile()->>'can_view_research', 'true', 'research professor can view research');
SELECT extensions.is(public.current_user_portal_profile()->>'can_edit', 'false', 'research professor cannot edit the catalog');
SELECT extensions.is(public.current_user_portal_profile()->>'can_publish', 'false', 'research professor cannot publish the catalog');
SELECT extensions.is((SELECT count(*) FROM public.student_responses
  WHERE id IN ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000002')),
  2::bigint, 'research professor can read both student and explorer rows for export');
SELECT extensions.is((SELECT count(*) FROM public.specialist_responses
  WHERE id = '79000000-0000-4000-8000-000000000003'), 1::bigint, 'research professor can read specialist responses for export');
SELECT extensions.is(public.research_cohort_summary(current_setting('professor_portal_test.filters')::jsonb)->>'total',
  '3', 'research professor can retrieve the full synthetic cohort summary');
SELECT extensions.is(jsonb_array_length(public.research_response_page(current_setting('professor_portal_test.filters')::jsonb)->'rows'),
  3, 'research professor can extract all three synthetic participant categories');
SELECT extensions.ok(current_setting('response.headers')::jsonb @> '[{"Cache-Control":"no-store, private, max-age=0"}]'::jsonb,
  'research responses are marked private and non-cacheable');
SELECT extensions.lives_ok(
  $$SELECT public.get_private_participation_map_stats('student', 'RO', 'en', '2026-01-01', '2026-02-01', 'current')$$,
  'research professor can combine all private-map filters');
SELECT extensions.ok(current_setting('response.headers')::jsonb @> '[{"Cache-Control":"no-store, private, max-age=0"}]'::jsonb,
  'private-map responses remain non-cacheable');

-- Authorization must fail before payload validation, even through direct RPCs.
SELECT extensions.throws_ok(statement, '42501', NULL, label)
FROM (VALUES
  ('SELECT public.get_specialty_catalog_draft()', 'research professor cannot read administrative catalog drafts'),
  ($$SELECT public.save_specialty_catalog_entry_draft(NULL, NULL, 'Cardiology', '{}', '{}', '{}', 'Denied researcher edit')$$,
    'research professor cannot save specialty descriptions or weights'),
  ($$SELECT public.publish_specialty_catalog_draft(NULL, NULL, 'Denied researcher publication')$$,
    'research professor cannot publish catalog drafts'),
  ('SELECT public.list_specialty_catalog_versions()', 'research professor cannot read administrative version history'),
  ($$SELECT public.restore_specialty_catalog_version(NULL, NULL, 'Denied researcher restore')$$,
    'research professor cannot restore catalog versions'),
  ('SELECT public.set_public_map_enabled(true)', 'research professor cannot expose the public map'),
  ('SELECT public.set_public_map_enabled(false)', 'research professor cannot hide the public map'),
  ('SELECT public.get_portal_test_dataset()', 'research professor cannot access administrator test datasets'),
  ('SELECT public.create_portal_test_dataset()', 'research professor cannot create test datasets'),
  ($$SELECT public.delete_portal_test_dataset('79000000-0000-4000-8000-000000000099')$$,
    'research professor cannot delete test datasets'),
  ($$INSERT INTO public.student_responses(id) VALUES ('79000000-0000-4000-8000-000000000099')$$,
    'research professor cannot directly insert student responses'),
  ($$UPDATE public.student_responses SET study_year = 6 WHERE id = '79000000-0000-4000-8000-000000000001'$$,
    'research professor cannot alter student responses'),
  ($$DELETE FROM public.student_responses WHERE id = '79000000-0000-4000-8000-000000000001'$$,
    'research professor cannot delete student responses'),
  ($$INSERT INTO public.specialist_responses(id) VALUES ('79000000-0000-4000-8000-000000000099')$$,
    'research professor cannot directly insert specialist responses'),
  ($$UPDATE public.specialist_responses SET actual_specialty = 'Neurology' WHERE id = '79000000-0000-4000-8000-000000000003'$$,
    'research professor cannot alter specialist responses'),
  ($$DELETE FROM public.specialist_responses WHERE id = '79000000-0000-4000-8000-000000000003'$$,
    'research professor cannot delete specialist responses'),
  ($$INSERT INTO private.researchers(user_id, portal_role) VALUES ('78000000-0000-4000-8000-000000000001', 'professor')$$,
    'research professor cannot authorize new staff directly'),
  ($$UPDATE private.researchers SET portal_role = 'professor' WHERE user_id = '78000000-0000-4000-8000-000000000002'$$,
    'research professor cannot promote their own account'),
  ($$DELETE FROM private.researchers WHERE user_id = '78000000-0000-4000-8000-000000000003'$$,
    'research professor cannot remove another administrator'),
  ($$SELECT private.add_portal_user_by_email('portal-ordinary@example.test', 'Denied grant', 'professor')$$,
    'research professor cannot invoke the privileged staff provisioning helper')
) AS denied(statement, label);
RESET ROLE;

-- No JWT refresh: server revocation must immediately block old credentials.
UPDATE private.researchers SET enabled = false
  WHERE user_id = '78000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.current_user_portal_profile()->>'authorized', 'false', 'disabling the research account invalidates its existing profile immediately');
SELECT extensions.is((SELECT count(*) FROM public.student_responses), 0::bigint, 'disabled research account immediately loses student export access');
SELECT extensions.is((SELECT count(*) FROM public.specialist_responses), 0::bigint, 'disabled research account immediately loses specialist export access');
SELECT extensions.throws_ok(statement, '42501', NULL, label)
FROM (VALUES
  ('SELECT public.research_response_page()', 'disabled research account cannot page responses with old claims'),
  ('SELECT public.research_cohort_summary()', 'disabled research account cannot read summaries with old claims'),
  ('SELECT public.get_private_participation_map_stats()', 'disabled research account cannot read private geography with old claims')
) AS denied(statement, label);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '78000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"78000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.current_user_portal_profile()->>'role', 'professor', 'existing administrator role is not redefined');
SELECT extensions.is(public.current_user_portal_profile()->>'can_edit', 'true', 'existing administrator retains edit permission');
SELECT extensions.is(public.current_user_portal_profile()->>'can_publish', 'true', 'existing administrator retains publication permission');
SELECT extensions.lives_ok('SELECT public.get_specialty_catalog_draft()', 'existing administrator still accesses catalog drafts');
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
