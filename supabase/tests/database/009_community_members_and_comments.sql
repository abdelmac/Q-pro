BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- Synthetic identities only, isolated dates and transaction rollback. No real
-- email, credentials, account invitations or research content are involved.
INSERT INTO auth.users(id, email, email_confirmed_at, is_anonymous, raw_user_meta_data)
SELECT ('90000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'community-' || n || '@example.test', CASE WHEN n <> 6 THEN now() END, n = 7,
  '{"role":"professor","verified":true,"can_edit":true,"can_publish":true}'::jsonb
FROM generate_series(1, 9) n;
INSERT INTO auth.sessions(id, user_id, created_at, updated_at, aal)
SELECT ('91000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('90000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now(), now(), 'aal1'
FROM generate_series(1, 9) n;
INSERT INTO private.researchers(user_id, portal_role, enabled) VALUES
  ('90000000-0000-4000-8000-000000000004', 'researcher', true),
  ('90000000-0000-4000-8000-000000000005', 'doctor', true),
  ('90000000-0000-4000-8000-000000000009', 'professor', true);

CREATE FUNCTION pg_temp.community_test_actor(p_number integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-' || lpad(p_number::text, 12, '0'), true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', '90000000-0000-4000-8000-' || lpad(p_number::text, 12, '0'),
    'session_id', '91000000-0000-4000-8000-' || lpad(p_number::text, 12, '0'),
    'role', 'authenticated', 'user_metadata', jsonb_build_object('role', 'professor', 'verified', true)
  )::text, true);
END;
$$;

SELECT extensions.ok(NOT (SELECT enabled FROM community.settings WHERE singleton), 'community launch gate defaults off');
SELECT extensions.is((SELECT count(*) FROM community.members), 0::bigint, 'migration creates no community members from existing accounts');
SELECT extensions.is((SELECT count(*) FROM community.comments), 0::bigint, 'migration publishes no historical research comments');
SELECT extensions.ok(NOT has_schema_privilege('anon', 'private', 'USAGE'), 'community does not expose research private schema to guests');
SELECT extensions.ok(NOT has_schema_privilege('authenticated', 'private', 'USAGE'), 'community does not expose research private schema to members');
SELECT extensions.ok(c.relrowsecurity, format('%s has defense-in-depth RLS', c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'community' AND c.relkind = 'r';
SELECT extensions.ok(NOT has_table_privilege(api_role, c.oid, operation), format('%s cannot %s community.%s directly', api_role, operation, c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) api_role
CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) operation
WHERE n.nspname = 'community' AND c.relkind = 'r';
SELECT extensions.ok(NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""'], format('%s uses an empty-path invoker facade', p.proname))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND left(p.proname, 10) = 'community_';
SELECT extensions.ok(p.proconfig @> ARRAY['search_path=""'], format('community.%s has fixed empty search path', p.proname))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'community';
SELECT extensions.ok(NOT has_function_privilege(api_role, function_name, 'EXECUTE'), format('%s cannot call internal %s', api_role, function_name))
FROM unnest(ARRAY['anon', 'authenticated']) api_role
CROSS JOIN unnest(ARRAY['community.require_user(boolean)', 'community.require_member(boolean,boolean)',
  'community.require_admin()', 'community.no_store()']) function_name;
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'community.audit'::regclass
  AND attname IN ('body', 'email', 'country_code', 'ratings', 'response', 'token')), 'audit schema excludes content, identity text and research data');

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT extensions.is(public.community_status(), '{"enabled":false}'::jsonb, 'anonymous readiness reveals only disabled flag');
SELECT extensions.is(public.community_map(), '{"enabled":false,"countries":[]}'::jsonb, 'community map is empty before launch');
SELECT extensions.throws_ok(statement, '42501', NULL, label) FROM (VALUES
  ('SELECT public.community_profile()', 'guest cannot read account profiles'),
  ('SELECT public.community_list_comments()', 'guest cannot read member comments'),
  ('SELECT public.community_my_comments()', 'guest cannot read own-comments endpoint'),
  ('SELECT public.community_withdraw_map_consent()', 'guest cannot withdraw another member map consent'),
  ($$SELECT public.community_save_profile('student', NULL, NULL, false, 'community-membership-v1')$$, 'guest cannot create membership'),
  ('SELECT public.community_admin_members()', 'guest cannot enumerate member identities'),
  ('SELECT public.community_admin_comments()', 'guest cannot enumerate unpublished comments'),
  ('SELECT * FROM community.comments', 'guest cannot bypass the feed'),
  ('UPDATE community.settings SET enabled = true', 'guest cannot activate signup gate')
) denied(statement, label);
RESET ROLE;

SELECT pg_temp.community_test_actor(1);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_profile(), NULL::jsonb, 'confirmed account without membership has null profile');
SELECT extensions.throws_ok($$SELECT public.community_save_profile('student', NULL, NULL, false, 'community-membership-v1')$$,
  '42501', NULL, 'disabled launch prevents new memberships');
SELECT extensions.throws_ok('SELECT public.community_list_comments()', '42501', NULL, 'disabled launch prevents member browsing');
SELECT extensions.throws_ok('SELECT community.require_admin()', '42501', NULL, 'authenticated API cannot invoke internal staff helper');
RESET ROLE;

SELECT pg_temp.community_test_actor(5);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_admin_members(), '[]'::jsonb, 'existing administrator can prepare moderation while gate is off');
RESET ROLE;
UPDATE community.settings SET enabled = true;

SELECT pg_temp.community_test_actor(6);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'unconfirmed email cannot use community with forged verified metadata');
RESET ROLE;
SELECT pg_temp.community_test_actor(7);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'Supabase anonymous-auth identity is not a confirmed member');
RESET ROLE;
SELECT pg_temp.community_test_actor(8);
UPDATE auth.users SET banned_until = now() + interval '1 day' WHERE id = '90000000-0000-4000-8000-000000000008';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'banned auth account is rejected even with a session');
RESET ROLE;
SELECT pg_temp.community_test_actor(1);
UPDATE auth.sessions SET not_after = now() - interval '1 minute' WHERE id = '91000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'expired live Auth session is rejected');
RESET ROLE;
UPDATE auth.sessions SET not_after = NULL WHERE id = '91000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","session_id":"invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'malformed session identifier fails closed without a cast error');
RESET ROLE;
SELECT pg_temp.community_test_actor(1);
SELECT set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","session_id":"91000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'another account session cannot authorize caller');
RESET ROLE;
SELECT pg_temp.community_test_actor(1);

SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(statement, '22023', NULL, label) FROM (VALUES
  ($$SELECT public.community_save_profile('professor', NULL, NULL, false, 'community-membership-v1')$$, 'staff role cannot be selected through membership'),
  ($$SELECT public.community_save_profile('specialist', 'Invented specialty', NULL, false, 'community-membership-v1')$$, 'unknown specialty is rejected'),
  ($$SELECT public.community_save_profile('specialist', NULL, NULL, false, 'community-membership-v1')$$, 'specialist requires canonical specialty'),
  ($$SELECT public.community_save_profile('student', 'Cardiology', NULL, false, 'community-membership-v1')$$, 'student cannot retain specialist classification'),
  ($$SELECT public.community_save_profile('student', NULL, 'XX', true, 'community-membership-v1')$$, 'unknown country is rejected'),
  ($$SELECT public.community_save_profile('student', NULL, NULL, true, 'community-membership-v1')$$, 'map consent needs voluntarily supplied country'),
  ($$SELECT public.community_save_profile('student', NULL, NULL, false, 'research-consent-2026-09-16-geography')$$, 'research consent is not membership consent')
) denied(statement, label);
SELECT extensions.is(public.community_save_profile('student', NULL, NULL, false, 'community-membership-v1')->>'role', 'student', 'student membership is created without location');
SELECT extensions.is(public.community_profile()->>'verified', 'false', 'forged user metadata cannot verify the member');
SELECT extensions.is(public.community_list_comments(), '[]'::jsonb, 'confirmed student can read empty member feed');
SELECT extensions.is(public.current_user_portal_profile()->>'authorized', 'false', 'membership never grants research portal access');
SELECT extensions.is((SELECT count(*) FROM public.student_responses), 0::bigint, 'ordinary member cannot read student research rows');
SELECT extensions.is((SELECT count(*) FROM public.specialist_responses), 0::bigint, 'ordinary member cannot read specialist research rows');
SELECT extensions.throws_ok(statement, '42501', NULL, label) FROM (VALUES
  ('SELECT public.research_response_page()', 'member cannot export research'),
  ('SELECT public.get_private_participation_map_stats()', 'member cannot access research map filters'),
  ('SELECT public.community_admin_members()', 'member cannot enumerate account emails'),
  ('SELECT public.community_admin_comments()', 'member cannot inspect pending comments'),
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','I enjoy clinical teamwork.','en',true,'community-publication-v1')$$, 'student cannot submit a specialist comment')
) denied(statement, label);
RESET ROLE;

SELECT pg_temp.community_test_actor(1);
SET LOCAL ROLE authenticated;
SELECT public.community_save_profile('student',NULL,CASE WHEN n%2=0 THEN 'FR' ELSE 'RO' END,false,'community-membership-v1')
FROM generate_series(1,29)n;
SELECT extensions.throws_ok($$SELECT public.community_save_profile('student',NULL,'FR',false,'community-membership-v1')$$,
  '54000', NULL, 'thirty changed profiles per rolling day caps audit growth');
SELECT extensions.is(public.community_save_profile('student',NULL,'RO',false,'community-membership-v1')->>'country_code','RO',
  'idempotent no-op profile save is allowed after edit cap');
SELECT extensions.ok(public.community_withdraw_map_consent(),'location opt-out remains available after profile edit cap');
SELECT extensions.is(public.community_profile()->'country_code','null'::jsonb,'uncapped opt-out clears optional private country');
RESET ROLE;

SELECT pg_temp.community_test_actor(2);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_save_profile('specialist', 'Cardiology', 'RO', true, 'community-membership-v1')->>'verified', 'false', 'specialist self-description starts unverified');
SELECT extensions.throws_ok(statement, '22023', NULL, label) FROM (VALUES
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','I enjoy clinical teamwork.','en',false,'community-publication-v1')$$, 'publication consent must be explicit true'),
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','I enjoy clinical teamwork.','en',true,'research-consent-2026-09-16-geography')$$, 'research consent never authorizes member publication'),
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','short','en',true,'community-publication-v1')$$, 'short comment rejected'),
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001',repeat(E'\n\t',10),'en',true,'community-publication-v1')$$, 'whitespace-only comment rejected'),
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001',repeat('a',2001),'en',true,'community-publication-v1')$$, 'oversized comment rejected'),
  ($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','I enjoy clinical teamwork.','de',true,'community-publication-v1')$$, 'unsupported comment language rejected'),
  ($$SELECT public.community_submit_comment(NULL,'I enjoy clinical teamwork.','en',true,'community-publication-v1')$$, 'missing idempotency receipt rejected')
) denied(statement, label);
SELECT extensions.is(public.community_submit_comment('92000000-0000-4000-8000-000000000001', 'I enjoy clinical teamwork.', 'en', true, 'community-publication-v1')->>'status', 'pending', 'new independently consented comment starts pending');
SELECT extensions.is(public.community_submit_comment('92000000-0000-4000-8000-000000000001', 'I enjoy clinical teamwork.', 'en', true, 'community-publication-v1')->>'status', 'pending', 'same receipt and payload is idempotent');
SELECT extensions.is(jsonb_array_length(public.community_my_comments()), 1, 'idempotent retry creates one own comment');
SELECT extensions.throws_ok($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','Changed commentary text.','en',true,'community-publication-v1')$$,
  '22023', NULL, 'same receipt cannot rewrite content or bypass moderation');
SELECT extensions.is(public.community_list_comments(), '[]'::jsonb, 'unapproved specialist comment is hidden');
SELECT extensions.throws_ok($$SELECT public.community_admin_review_member('90000000-0000-4000-8000-000000000002',true,false,'Verified qualification')$$,
  '42501', NULL, 'self-selected specialist cannot verify themselves');
RESET ROLE;

SELECT pg_temp.community_test_actor(3);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_save_profile('specialist', 'Psychiatry', NULL, false, 'community-membership-v1')->>'role', 'specialist', 'second specialist can join without geography');
SELECT extensions.throws_ok($$SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000001','I enjoy clinical teamwork.','en',true,'community-publication-v1')$$,
  '22023', NULL, 'cross-account idempotency ID cannot expose or claim existing comment');
SELECT extensions.throws_ok($$SELECT public.community_withdraw_comment('92000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'another member cannot withdraw comment');
SELECT extensions.is(public.community_my_comments(), '[]'::jsonb, 'own comments never include another author');
RESET ROLE;

SELECT pg_temp.community_test_actor(4);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_admin_members()', '42501', NULL, 'read-only professor researcher cannot moderate community members');
SELECT extensions.throws_ok('SELECT public.community_admin_comments()', '42501', NULL, 'read-only professor researcher cannot inspect moderation queue');
RESET ROLE;

SELECT pg_temp.community_test_actor(5);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT public.community_admin_review_comment('92000000-0000-4000-8000-000000000001',true,'Reviewed specialist narrative')$$,
  '42501', NULL, 'admin cannot publish an unverified specialist');
SELECT extensions.throws_ok($$SELECT public.community_admin_review_member('90000000-0000-4000-8000-000000000002',true,false,'short')$$,
  '22023', NULL, 'verification requires an audit note');
SELECT extensions.ok(public.community_admin_review_member('90000000-0000-4000-8000-000000000002', true, false, 'Qualification independently checked'), 'existing doctor administrator can verify specialist');
SELECT extensions.ok(public.community_admin_review_comment('92000000-0000-4000-8000-000000000001', true, 'Publication consent and narrative reviewed'), 'verified consented comment may be approved');
SELECT extensions.is(jsonb_array_length(public.community_admin_comments(NULL,20,'approved')), 1, 'admin can filter approved moderation queue');
RESET ROLE;

SELECT pg_temp.community_test_actor(1);
SET LOCAL ROLE authenticated;
SELECT extensions.is(jsonb_array_length(public.community_list_comments()), 1, 'student sees approved specialist comments');
SELECT extensions.is((SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(public.community_list_comments()->0) key),
  ARRAY['body','id','language','specialty'], 'member feed excludes author IDs, emails, geography, dates and moderation metadata');
SELECT extensions.is(public.community_list_comments('92000000-0000-4000-8000-000000000001'), '[]'::jsonb, 'UUID keyset cursor avoids repeating the last row');
SELECT extensions.is(public.community_list_comments(NULL,20,'Psychiatry'), '[]'::jsonb, 'canonical specialty filter is honored');
SELECT extensions.throws_ok('SELECT public.community_list_comments(NULL,21)', '22023', NULL, 'feed page maximum is twenty');
SELECT extensions.throws_ok($$SELECT public.community_list_comments(NULL,20,'made up')$$, '22023', NULL, 'unrecognized specialty filter rejected');
SELECT extensions.ok(public.community_report_comment('92000000-0000-4000-8000-000000000001','identifying'), 'member can report identifying text');
SELECT extensions.ok(public.community_report_comment('92000000-0000-4000-8000-000000000001','other'), 'repeated reporter and comment are deduplicated');
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM community.reports), 1::bigint, 'one report per member per comment');

SELECT pg_temp.community_test_actor(2);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_save_profile('specialist','Psychiatry','RO',true,'community-membership-v1')->>'verified', 'false', 'specialty change revokes verification immediately');
SELECT extensions.is(public.community_list_comments(), '[]'::jsonb, 'specialty change immediately hides formerly approved comment');
RESET ROLE;
SELECT pg_temp.community_test_actor(5);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(public.community_admin_review_member('90000000-0000-4000-8000-000000000002',true,false,'New qualification reviewed'), 'new specialty needs independent reverification');
SELECT extensions.throws_ok($$SELECT public.community_admin_review_comment('92000000-0000-4000-8000-000000000001',true,'Narrative reviewed again')$$,
  '42501', NULL, 'old specialty narrative cannot masquerade as new specialty');
RESET ROLE;
SELECT pg_temp.community_test_actor(2);
SET LOCAL ROLE authenticated;
SELECT public.community_save_profile('specialist','Cardiology','RO',true,'community-membership-v1');
RESET ROLE;
SELECT pg_temp.community_test_actor(5);
SET LOCAL ROLE authenticated;
SELECT public.community_admin_review_member('90000000-0000-4000-8000-000000000002',true,false,'Cardiology independently verified');
SELECT public.community_admin_review_comment('92000000-0000-4000-8000-000000000001',true,'Narrative approved after reverification');
SELECT extensions.ok(public.community_admin_review_member('90000000-0000-4000-8000-000000000002',true,true,'Suspended while investigating report'), 'administrator may suspend a verified member');
RESET ROLE;
SELECT pg_temp.community_test_actor(1);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_list_comments(), '[]'::jsonb, 'suspension immediately hides author comments');
RESET ROLE;
SELECT pg_temp.community_test_actor(2);
SET LOCAL ROLE authenticated;
SELECT extensions.is(public.community_profile()->>'suspended','true','suspended member can see their restriction');
SELECT extensions.throws_ok('SELECT public.community_list_comments()', '42501', NULL, 'suspended member cannot read feed');
SELECT extensions.throws_ok($$SELECT public.community_save_profile('student',NULL,NULL,false,'community-membership-v1')$$,
  '42501', NULL, 'profile editing cannot clear suspension');
RESET ROLE;
UPDATE community.settings SET enabled = false;
SET LOCAL ROLE authenticated;
SELECT extensions.ok(public.community_withdraw_comment('92000000-0000-4000-8000-000000000001'), 'suspended author can withdraw even while launch gate is off');
SELECT extensions.ok(public.community_withdraw_comment('92000000-0000-4000-8000-000000000001'), 'withdrawal is safely idempotent');
SELECT extensions.is(public.community_my_comments()->0->>'status','withdrawn','author can inspect own withdrawn status while disabled');
SELECT extensions.ok(public.community_withdraw_map_consent(), 'suspended member can withdraw map consent while launch is disabled');
SELECT extensions.is(public.community_profile()->'country_code', 'null'::jsonb, 'map withdrawal erases optional country');
SELECT extensions.is(public.community_profile()->>'map_consent','false','map withdrawal clears consent without changing suspension');
SELECT extensions.is(public.community_profile()->>'suspended','true','map withdrawal cannot bypass suspension');
SELECT extensions.ok(public.community_withdraw_map_consent(), 'map withdrawal is safely idempotent');
RESET ROLE;
SELECT pg_temp.community_test_actor(5);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT public.community_admin_review_comment('92000000-0000-4000-8000-000000000001',true,'Cannot override withdrawal')$$,
  '22023', NULL, 'administrator cannot republish withdrawn content');
RESET ROLE;
UPDATE community.settings SET enabled = true;

SELECT pg_temp.community_test_actor(9);
SET LOCAL ROLE authenticated;
SELECT public.community_save_profile('specialist','Psychiatry',NULL,false,'community-membership-v1');
SELECT extensions.throws_ok($$SELECT public.community_admin_review_member('90000000-0000-4000-8000-000000000009',true,false,'My own qualifications checked')$$,
  '42501', NULL, 'even staff cannot self-verify');
SELECT public.community_submit_comment('92000000-0000-4000-8000-000000000009','Synthetic administrator narrative.','en',true,'community-publication-v1');
SELECT extensions.throws_ok($$SELECT public.community_admin_review_comment('92000000-0000-4000-8000-000000000009',true,'My own commentary reviewed')$$,
  '42501', NULL, 'even staff cannot approve their own comments');
RESET ROLE;

-- Caps are per author and include hidden/withdrawn rows in lifetime counting.
SELECT pg_temp.community_test_actor(3);
SET LOCAL ROLE authenticated;
SELECT public.community_submit_comment(('93000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'Synthetic specialist comment number '||n,'fr',true,'community-publication-v1') FROM generate_series(1,5)n;
SELECT extensions.throws_ok($$SELECT public.community_submit_comment('93000000-0000-4000-8000-000000000006','Another synthetic specialist comment.','fr',true,'community-publication-v1')$$,
  '54000', NULL, 'sixth accepted comment in rolling twenty-four hours is refused');
SELECT extensions.is(public.community_submit_comment('93000000-0000-4000-8000-000000000001','Synthetic specialist comment number 1','fr',true,'community-publication-v1')->>'status',
  'pending', 'idempotent retry still works after daily limit');
RESET ROLE;
UPDATE community.comments SET created_at = now() - interval '2 days' WHERE author_id = '90000000-0000-4000-8000-000000000003';
INSERT INTO community.comments(id,author_id,specialty,body,language,consent_version,created_at)
SELECT ('93000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'90000000-0000-4000-8000-000000000003',
  'Psychiatry','Synthetic capacity fixture '||n,'en','community-publication-v1',now()-interval '2 days' FROM generate_series(6,20)n;
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT public.community_submit_comment('93000000-0000-4000-8000-000000000021','Another synthetic specialist comment.','fr',true,'community-publication-v1')$$,
  '54000', NULL, 'twenty active-comment cap enforced independently of daily cap');
RESET ROLE;
UPDATE community.comments SET status='rejected' WHERE author_id='90000000-0000-4000-8000-000000000003';
INSERT INTO community.comments(id,author_id,specialty,body,language,consent_version,created_at,status)
SELECT ('93000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'90000000-0000-4000-8000-000000000003',
  'Psychiatry','Synthetic lifetime fixture '||n,'en','community-publication-v1',now()-interval '2 days','rejected'
FROM generate_series(21,100)n;
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT public.community_submit_comment('93000000-0000-4000-8000-000000000101','Another synthetic specialist comment.','fr',true,'community-publication-v1')$$,
  '54000', NULL, 'one hundred lifetime-comment cap includes rejected content');
RESET ROLE;

-- Country aggregates are a distinct voluntary account layer. No questionnaire
-- or research row is manufactured for these membership-map fixtures.
INSERT INTO auth.users(id,email,email_confirmed_at,is_anonymous)
SELECT ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'community-map-'||n||'@example.test',now(),false FROM generate_series(20,42)n;
INSERT INTO community.members(user_id,role,country_code,map_consent,map_consent_at,terms_version)
SELECT ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'curious',
  CASE WHEN n<34 THEN 'RO' ELSE 'FR' END,n<>33,CASE WHEN n<>33 THEN now() END,
  'community-membership-v1' FROM generate_series(20,42)n;
UPDATE private.public_features SET public_map_enabled=false WHERE singleton;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE anon;
SELECT extensions.is(public.community_map(),'{"enabled":false,"countries":[]}'::jsonb,'existing public-map switch also gates member-country layer');
RESET ROLE;
UPDATE private.public_features SET public_map_enabled=true WHERE singleton;
SET LOCAL ROLE anon;
SELECT extensions.is(public.community_map(),'{"enabled":true,"countries":[{"country_code":"RO","count":10}]}'::jsonb,
  'thirteen consented RO accounts round down to ten; nine FR accounts are fully suppressed');
SELECT extensions.is((SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(public.community_map())key),
  ARRAY['countries','enabled'],'public member map exposes no exact total or filter breakdown');
SELECT extensions.is(current_setting('response.headers')::jsonb,
  '[{"Cache-Control":"no-store, private, max-age=0"},{"Pragma":"no-cache"}]'::jsonb,'member map sends no-store headers');
SELECT extensions.throws_ok('SELECT public.community_list_comments()', '42501',NULL,'public map access never grants comment access');
RESET ROLE;
UPDATE community.members SET suspended=true WHERE user_id='90000000-0000-4000-8000-000000000020';
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='90000000-0000-4000-8000-000000000021';
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='90000000-0000-4000-8000-000000000022';
SET LOCAL ROLE anon;
SELECT extensions.is(public.community_map()->'countries','[{"country_code":"RO","count":10}]'::jsonb,
  'country aggregation excludes suspended, banned and unconfirmed users');
RESET ROLE;
UPDATE community.members SET map_consent=false,map_consent_at=NULL WHERE user_id='90000000-0000-4000-8000-000000000023';
SET LOCAL ROLE anon;
SELECT extensions.is(public.community_map()->'countries','[]'::jsonb,'withdrawing map consent removes member and suppresses group below ten');
RESET ROLE;
UPDATE community.settings SET enabled=false;
SET LOCAL ROLE anon;
SELECT extensions.is(public.community_map(),'{"enabled":false,"countries":[]}'::jsonb,'launch shutdown hides the separate country layer');
RESET ROLE;
UPDATE community.settings SET enabled=true;

-- Revocation is checked against live auth.sessions, not a cached JWT role.
SELECT pg_temp.community_test_actor(1);
DELETE FROM auth.sessions WHERE id='91000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'revoked live session immediately blocks stale-token account reads');
SELECT extensions.throws_ok('SELECT public.community_list_comments()', '42501', NULL, 'revoked session cannot continue reading member feed');
RESET ROLE;
SELECT pg_temp.community_test_actor(3);
DELETE FROM auth.users WHERE id='90000000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_profile()', '42501', NULL, 'deleted auth account cannot use its old token');
RESET ROLE;
SELECT extensions.is((SELECT count(*) FROM community.members WHERE user_id='90000000-0000-4000-8000-000000000003'),0::bigint,'account deletion cascades membership');
SELECT extensions.is((SELECT count(*) FROM community.comments WHERE author_id='90000000-0000-4000-8000-000000000003'),0::bigint,'account deletion cascades private and published comments');
SELECT extensions.ok(NOT EXISTS(SELECT 1 FROM community.audit WHERE actor_id='90000000-0000-4000-8000-000000000003'),'audit actor foreign key is cleared on account deletion');

SELECT pg_temp.community_test_actor(5);
UPDATE private.researchers SET enabled=false WHERE user_id='90000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT public.community_admin_members()', '42501',NULL,'revoked staff role is checked live, not from metadata');
RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
