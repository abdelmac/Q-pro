BEGIN;

-- Separate purpose and authorization boundary. No research row is copied,
-- linked to an account, made public, or used as publication consent.
-- This migration does not open Auth signup or enable the community launch gate.
CREATE SCHEMA community;
REVOKE ALL ON SCHEMA community FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE community.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO community.settings(singleton) VALUES (true);

CREATE TABLE community.members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'specialist', 'curious')),
  specialty text,
  verified boolean NOT NULL DEFAULT false,
  suspended boolean NOT NULL DEFAULT false,
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  map_consent boolean NOT NULL DEFAULT false,
  terms_version text NOT NULL CHECK (terms_version = 'community-membership-v1'),
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  map_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'specialist' AND specialty IS NOT NULL) OR
    (role <> 'specialist' AND specialty IS NULL AND NOT verified)),
  CHECK (NOT map_consent OR (country_code IS NOT NULL AND map_consent_at IS NOT NULL))
);
CREATE INDEX community_members_map_idx ON community.members(country_code, user_id)
  WHERE map_consent AND NOT suspended;

CREATE TABLE community.comments (
  -- Client UUID is an idempotency receipt, not a research response identifier.
  id uuid PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES community.members(user_id) ON DELETE CASCADE,
  specialty text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000 AND body = btrim(body)),
  language text NOT NULL CHECK (language IN ('en', 'fr', 'ro')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  consent_version text NOT NULL CHECK (consent_version = 'community-publication-v1'),
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  CHECK ((status = 'withdrawn') = (withdrawn_at IS NOT NULL))
);
CREATE INDEX community_comments_author_created_idx ON community.comments(author_id, created_at, id);
CREATE INDEX community_comments_status_id_idx ON community.comments(status, id);
CREATE INDEX community_comments_specialty_id_idx ON community.comments(specialty, id)
  WHERE status = 'approved';

CREATE TABLE community.reports (
  comment_id uuid NOT NULL REFERENCES community.comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES community.members(user_id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('identifying', 'medical-advice', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, reporter_id)
);
CREATE INDEX community_reports_reporter_created_idx ON community.reports(reporter_id, created_at);

CREATE TABLE community.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_id uuid,
  action text NOT NULL CHECK (action IN ('profile_changed', 'member_reviewed', 'comment_submitted',
    'comment_withdrawn', 'comment_approved', 'comment_rejected', 'map_consent_withdrawn')),
  note text CHECK (note IS NULL OR char_length(note) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_audit_actor_created_idx ON community.audit(actor_id, created_at);
CREATE INDEX community_audit_subject_idx ON community.audit(subject_id, created_at);
COMMENT ON TABLE community.audit IS
  'Restricted moderation actions only; never copies comment bodies, email, location, research responses or authentication tokens.';
COMMENT ON TABLE community.members IS
  'Community membership only, not staff authorization or research participation. Specialist verification is administrator-controlled.';
COMMENT ON TABLE community.comments IS
  'New independently consented member comments only. Pseudonymous to other members, linked to an account for moderation and withdrawal.';

ALTER TABLE community.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA community FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA community FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION community.no_store()
RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT set_config('response.headers',
    '[{"Cache-Control":"no-store, private, max-age=0"},{"Pragma":"no-cache"}]', true)::void;
$$;

-- Called only within the private definer boundary. Membership is not inferred
-- from user_metadata/JWT role labels. A real, unexpired live Auth session is
-- required so revoked sessions and deleted/banned accounts fail immediately.
CREATE FUNCTION community.require_user(p_require_enabled boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); session_text text := auth.jwt()->>'session_id';
BEGIN
  IF actor IS NULL OR session_text IS NULL OR session_text !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A confirmed community account and active session are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id = u.id
    WHERE u.id = actor AND s.id = session_text::uuid AND u.email_confirmed_at IS NOT NULL
      AND coalesce(u.is_anonymous, false) = false
      AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())
      AND (s.not_after IS NULL OR s.not_after > statement_timestamp())) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A confirmed community account and active session are required';
  END IF;
  IF p_require_enabled AND NOT coalesce((SELECT enabled FROM community.settings WHERE singleton), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Community registration and browsing are not enabled';
  END IF;
  RETURN actor;
END;
$$;

CREATE FUNCTION community.require_member(p_require_enabled boolean DEFAULT true, p_allow_suspended boolean DEFAULT false)
RETURNS community.members LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor uuid := community.require_user(p_require_enabled); member community.members%ROWTYPE;
BEGIN
  SELECT * INTO member FROM community.members WHERE user_id = actor;
  IF NOT FOUND OR (member.suspended AND NOT p_allow_suspended) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'An active community membership is required';
  END IF;
  RETURN member;
END;
$$;

CREATE FUNCTION community.require_admin()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor uuid := community.require_user(false);
BEGIN
  PERFORM private.require_portal_role(ARRAY['doctor', 'professor']);
  RETURN actor;
END;
$$;

CREATE FUNCTION community.profile_json(p_member community.members)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('role', p_member.role, 'specialty', p_member.specialty,
    'verified', p_member.verified, 'suspended', p_member.suspended,
    'country_code', p_member.country_code, 'map_consent', p_member.map_consent);
$$;

CREATE FUNCTION community.comment_json(p_comment community.comments)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', p_comment.id, 'specialty', p_comment.specialty,
    'body', p_comment.body, 'language', p_comment.language, 'status', p_comment.status);
$$;

CREATE FUNCTION community.status()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM community.no_store();
  RETURN jsonb_build_object('enabled', coalesce((SELECT enabled FROM community.settings WHERE singleton), false));
END;
$$;

CREATE FUNCTION community.profile()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := community.require_user(false); member community.members%ROWTYPE;
BEGIN
  PERFORM community.no_store();
  SELECT * INTO member FROM community.members WHERE user_id = actor;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN community.profile_json(member);
END;
$$;

CREATE FUNCTION community.save_profile(p_role text, p_specialty text, p_country_code text,
  p_map_consent boolean, p_terms_version text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := community.require_user(); member community.members%ROWTYPE; changed boolean;
BEGIN
  PERFORM community.no_store();
  IF p_role IS NULL OR p_role NOT IN ('student', 'specialist', 'curious')
    OR p_terms_version IS DISTINCT FROM 'community-membership-v1' OR p_map_consent IS NULL
    OR (p_role = 'specialist' AND NOT private.valid_specialty_v1(p_specialty))
    OR (p_role <> 'specialist' AND p_specialty IS NOT NULL)
    OR (p_country_code IS NOT NULL AND private.participation_country_name(p_country_code) IS NULL)
    OR (p_map_consent AND p_country_code IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid community profile or consent';
  END IF;
  -- Lock the account before its member/comments rows on every mutation; this
  -- serializes first-time upserts, publication caps and moderation races.
  PERFORM 1 FROM auth.users WHERE id = actor FOR UPDATE;
  SELECT * INTO member FROM community.members WHERE user_id = actor FOR UPDATE;
  IF FOUND AND member.suspended THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'This community account is suspended';
  END IF;
  IF member.user_id IS NOT NULL AND member.role = p_role
    AND member.specialty IS NOT DISTINCT FROM p_specialty
    AND member.country_code IS NOT DISTINCT FROM p_country_code
    AND member.map_consent = p_map_consent AND member.terms_version = p_terms_version THEN
    RETURN community.profile_json(member);
  END IF;
  IF (SELECT count(*) FROM community.audit WHERE actor_id = actor AND action = 'profile_changed'
    AND created_at > statement_timestamp() - interval '24 hours') >= 30 THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Community profile change limit reached';
  END IF;
  changed := member.user_id IS NOT NULL AND
    (member.role IS DISTINCT FROM p_role OR member.specialty IS DISTINCT FROM p_specialty);
  INSERT INTO community.members(user_id, role, specialty, country_code, map_consent,
    map_consent_at, terms_version)
  VALUES (actor, p_role, p_specialty, p_country_code, p_map_consent,
    CASE WHEN p_map_consent THEN now() END, p_terms_version)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, specialty = EXCLUDED.specialty,
    country_code = EXCLUDED.country_code, map_consent = EXCLUDED.map_consent,
    map_consent_at = EXCLUDED.map_consent_at, terms_version = EXCLUDED.terms_version,
    terms_accepted_at = now(), updated_at = now(),
    verified = CASE WHEN changed THEN false ELSE community.members.verified END
  RETURNING * INTO member;
  IF changed THEN
    UPDATE community.comments SET status = 'pending', updated_at = now()
      WHERE author_id = actor AND status = 'approved';
  END IF;
  INSERT INTO community.audit(actor_id, subject_id, action) VALUES (actor, actor, 'profile_changed');
  RETURN community.profile_json(member);
END;
$$;

CREATE FUNCTION community.list_comments(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 20, p_specialty text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM community.no_store();
  PERFORM community.require_member();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20
    OR (p_specialty IS NOT NULL AND NOT private.valid_specialty_v1(p_specialty)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid community feed filters';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'specialty', c.specialty,
    'body', c.body, 'language', c.language) ORDER BY c.id), '[]'::jsonb) FROM (
    SELECT c.id, c.specialty, c.body, c.language FROM community.comments c
    JOIN community.members m ON m.user_id = c.author_id JOIN auth.users u ON u.id = m.user_id
    WHERE c.status = 'approved' AND c.consent_version = 'community-publication-v1'
      AND m.role = 'specialist' AND m.verified AND NOT m.suspended AND m.specialty = c.specialty
      AND u.email_confirmed_at IS NOT NULL AND coalesce(u.is_anonymous, false) = false
      AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())
      AND (p_after IS NULL OR c.id > p_after) AND (p_specialty IS NULL OR c.specialty = p_specialty)
    ORDER BY c.id LIMIT p_limit
  ) c);
END;
$$;

CREATE FUNCTION community.my_comments()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE member community.members%ROWTYPE := community.require_member(false, true);
BEGIN
  PERFORM community.no_store();
  -- Bounded by the lifetime cap; available during suspension/launch shutdown
  -- so an author can still see and withdraw their own publication.
  RETURN (SELECT coalesce(jsonb_agg(community.comment_json(c) ORDER BY c.id), '[]'::jsonb)
    FROM community.comments c WHERE author_id = member.user_id);
END;
$$;

CREATE FUNCTION community.submit_comment(p_id uuid, p_body text, p_language text,
  p_consent boolean, p_consent_version text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE member community.members%ROWTYPE := community.require_member(); existing community.comments%ROWTYPE;
  normalized text := regexp_replace(p_body, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  lifetime_count bigint; active_count bigint; daily_count bigint;
BEGIN
  PERFORM community.no_store();
  IF p_id IS NULL OR p_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR normalized IS NULL OR char_length(normalized) NOT BETWEEN 10 AND 2000
    OR p_language IS NULL OR p_language NOT IN ('en', 'fr', 'ro')
    OR p_consent IS DISTINCT FROM true OR p_consent_version IS DISTINCT FROM 'community-publication-v1' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid new comment and explicit publication consent are required';
  END IF;
  PERFORM 1 FROM auth.users WHERE id = member.user_id FOR UPDATE;
  SELECT * INTO member FROM community.members WHERE user_id = member.user_id FOR UPDATE;
  IF member.role <> 'specialist' OR member.suspended THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only active specialist members can submit comments';
  END IF;
  SELECT * INTO existing FROM community.comments WHERE id = p_id;
  IF FOUND THEN
    IF existing.author_id = member.user_id AND existing.specialty = member.specialty
      AND existing.body = normalized AND existing.language = p_language
      AND existing.consent_version = p_consent_version THEN RETURN community.comment_json(existing); END IF;
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Comment identifier is already in use';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE status IN ('pending', 'approved')),
    count(*) FILTER (WHERE created_at > statement_timestamp() - interval '24 hours')
    INTO lifetime_count, active_count, daily_count FROM community.comments WHERE author_id = member.user_id;
  IF lifetime_count >= 100 OR active_count >= 20 OR daily_count >= 5 THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Community comment limit reached';
  END IF;
  INSERT INTO community.comments(id, author_id, specialty, body, language, consent_version)
    VALUES (p_id, member.user_id, member.specialty, normalized, p_language, p_consent_version)
    RETURNING * INTO existing;
  INSERT INTO community.audit(actor_id, subject_id, action) VALUES (member.user_id, p_id, 'comment_submitted');
  RETURN community.comment_json(existing);
END;
$$;

CREATE FUNCTION community.withdraw_comment(p_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE member community.members%ROWTYPE := community.require_member(false, true); target community.comments%ROWTYPE;
BEGIN
  PERFORM community.no_store();
  PERFORM 1 FROM auth.users WHERE id = member.user_id FOR UPDATE;
  SELECT * INTO target FROM community.comments WHERE id = p_id AND author_id = member.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Comment not available for withdrawal'; END IF;
  IF target.status = 'withdrawn' THEN RETURN true; END IF;
  UPDATE community.comments SET status = 'withdrawn', withdrawn_at = now(), updated_at = now() WHERE id = p_id;
  INSERT INTO community.audit(actor_id, subject_id, action) VALUES (member.user_id, p_id, 'comment_withdrawn');
  RETURN true;
END;
$$;

CREATE FUNCTION community.report_comment(p_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE member community.members%ROWTYPE := community.require_member();
BEGIN
  PERFORM community.no_store();
  IF p_reason IS NULL OR p_reason NOT IN ('identifying', 'medical-advice', 'other') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid report category';
  END IF;
  PERFORM 1 FROM auth.users WHERE id = member.user_id FOR UPDATE;
  member := community.require_member();
  IF NOT EXISTS (SELECT 1 FROM community.comments c JOIN community.members m ON m.user_id = c.author_id
    JOIN auth.users u ON u.id = m.user_id
    WHERE c.id = p_id AND c.status = 'approved' AND c.author_id <> member.user_id
      AND c.consent_version = 'community-publication-v1'
      AND m.verified AND NOT m.suspended AND m.role = 'specialist' AND m.specialty = c.specialty
      AND u.email_confirmed_at IS NOT NULL AND NOT coalesce(u.is_anonymous, false)
      AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Comment is not available for reporting';
  END IF;
  IF EXISTS (SELECT 1 FROM community.reports WHERE comment_id = p_id AND reporter_id = member.user_id) THEN RETURN true; END IF;
  IF (SELECT count(*) FROM community.reports WHERE reporter_id = member.user_id
    AND created_at > statement_timestamp() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Community report limit reached';
  END IF;
  INSERT INTO community.reports(comment_id, reporter_id, reason) VALUES (p_id, member.user_id, p_reason);
  RETURN true;
END;
$$;

CREATE FUNCTION community.withdraw_map_consent()
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE member community.members%ROWTYPE := community.require_member(false, true);
BEGIN
  PERFORM community.no_store();
  PERFORM 1 FROM auth.users WHERE id = member.user_id FOR UPDATE;
  UPDATE community.members SET country_code = NULL, map_consent = false,
    map_consent_at = NULL, updated_at = now()
    WHERE user_id = member.user_id AND (country_code IS NOT NULL OR map_consent);
  IF FOUND THEN
    INSERT INTO community.audit(actor_id, subject_id, action)
      VALUES (member.user_id, member.user_id, 'map_consent_withdrawn');
  END IF;
  RETURN true;
END;
$$;

CREATE FUNCTION community.admin_members(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM community.no_store();
  PERFORM community.require_admin();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid moderation page size';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'email', m.email,
    'role', m.role, 'specialty', m.specialty, 'verified', m.verified, 'suspended', m.suspended)
    ORDER BY m.user_id), '[]'::jsonb) FROM (
    SELECT m.*, u.email FROM community.members m JOIN auth.users u ON u.id = m.user_id
    WHERE p_after IS NULL OR m.user_id > p_after ORDER BY m.user_id LIMIT p_limit
  ) m);
END;
$$;

CREATE FUNCTION community.admin_review_member(p_id uuid, p_verified boolean, p_suspended boolean, p_note text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := community.require_admin(); member community.members%ROWTYPE;
BEGIN
  PERFORM community.no_store();
  IF p_id IS NULL OR p_verified IS NULL OR p_suspended IS NULL OR p_note IS NULL
    OR char_length(btrim(p_note)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A moderation decision and note of 10 to 500 characters are required';
  END IF;
  IF p_id = actor AND p_verified THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Administrators cannot verify themselves';
  END IF;
  PERFORM 1 FROM auth.users WHERE id = p_id FOR UPDATE;
  SELECT * INTO member FROM community.members WHERE user_id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Community member not found'; END IF;
  IF p_verified AND (member.role <> 'specialist' OR NOT EXISTS (SELECT 1 FROM auth.users
    WHERE id = p_id AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous, false)
      AND (banned_until IS NULL OR banned_until <= statement_timestamp()))) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Only confirmed specialist accounts may be verified';
  END IF;
  UPDATE community.members SET verified = p_verified, suspended = p_suspended, updated_at = now() WHERE user_id = p_id;
  IF NOT p_verified OR p_suspended THEN
    UPDATE community.comments SET status = 'pending', updated_at = now() WHERE author_id = p_id AND status = 'approved';
  END IF;
  INSERT INTO community.audit(actor_id, subject_id, action, note) VALUES (actor, p_id, 'member_reviewed', btrim(p_note));
  RETURN true;
END;
$$;

CREATE FUNCTION community.admin_comments(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 20, p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM community.no_store();
  PERFORM community.require_admin();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR p_status IS NULL
    OR p_status NOT IN ('all', 'pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid moderation filters';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'author_id', c.author_id,
    'email', c.email, 'specialty', c.specialty, 'body', c.body, 'language', c.language,
    'status', c.status, 'verified', c.verified, 'report_count',
    (SELECT count(*) FROM community.reports r WHERE r.comment_id = c.id)) ORDER BY c.id), '[]'::jsonb)
    FROM (SELECT c.*, u.email, m.verified FROM community.comments c
      JOIN community.members m ON m.user_id = c.author_id JOIN auth.users u ON u.id = m.user_id
      WHERE (p_after IS NULL OR c.id > p_after) AND (p_status = 'all' OR c.status = p_status)
      ORDER BY c.id LIMIT p_limit) c);
END;
$$;

CREATE FUNCTION community.admin_review_comment(p_id uuid, p_approve boolean, p_note text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := community.require_admin(); target community.comments%ROWTYPE; member community.members%ROWTYPE; owner_id uuid;
BEGIN
  PERFORM community.no_store();
  IF p_id IS NULL OR p_approve IS NULL OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A moderation decision and note of 10 to 500 characters are required';
  END IF;
  SELECT author_id INTO owner_id FROM community.comments WHERE id = p_id;
  IF owner_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Community comment not found'; END IF;
  IF owner_id = actor THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Administrators cannot moderate their own comments'; END IF;
  PERFORM 1 FROM auth.users WHERE id = owner_id FOR UPDATE;
  SELECT * INTO member FROM community.members WHERE user_id = owner_id FOR UPDATE;
  SELECT * INTO target FROM community.comments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR target.status = 'withdrawn' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Withdrawn or missing comments cannot be moderated';
  END IF;
  IF p_approve AND (NOT member.verified OR member.suspended OR member.role <> 'specialist'
    OR member.specialty IS DISTINCT FROM target.specialty OR target.consent_version <> 'community-publication-v1'
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = owner_id AND email_confirmed_at IS NOT NULL
      AND NOT coalesce(is_anonymous, false) AND (banned_until IS NULL OR banned_until <= statement_timestamp()))) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Publication requires a verified active specialist and current consent';
  END IF;
  UPDATE community.comments SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, updated_at = now() WHERE id = p_id;
  INSERT INTO community.audit(actor_id, subject_id, action, note)
    VALUES (actor, p_id, CASE WHEN p_approve THEN 'comment_approved' ELSE 'comment_rejected' END, btrim(p_note));
  RETURN true;
END;
$$;

CREATE FUNCTION community.map()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE visible boolean;
BEGIN
  PERFORM community.no_store();
  visible := coalesce((SELECT enabled FROM community.settings WHERE singleton), false)
    AND coalesce((SELECT public_map_enabled FROM private.public_features WHERE singleton), false);
  IF NOT visible THEN RETURN jsonb_build_object('enabled', false, 'countries', '[]'::jsonb); END IF;
  -- A distinct member-country layer, never added to questionnaire totals.
  -- Suppression/rounding reduces disclosure but repeated live snapshots can be
  -- differenced; no exact totals, dates, role/specialty filters or person pins.
  RETURN jsonb_build_object('enabled', true, 'countries', (SELECT coalesce(jsonb_agg(
    jsonb_build_object('country_code', country_code, 'count', released_count) ORDER BY country_code), '[]'::jsonb)
    FROM (SELECT m.country_code, (count(*) / 5) * 5 AS released_count FROM community.members m
      JOIN auth.users u ON u.id = m.user_id WHERE m.map_consent AND NOT m.suspended
        AND m.country_code IS NOT NULL AND u.email_confirmed_at IS NOT NULL
        AND NOT coalesce(u.is_anonymous, false)
        AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())
      GROUP BY m.country_code HAVING count(*) >= 10) countries));
END;
$$;

-- Explicit API facades. Private endpoint functions have the same guarded
-- contract; low-level helpers/tables/settings are never granted to API roles.
CREATE FUNCTION public.community_status() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.status(); $$;
CREATE FUNCTION public.community_profile() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.profile(); $$;
CREATE FUNCTION public.community_save_profile(p_role text, p_specialty text, p_country_code text, p_map_consent boolean, p_terms_version text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.save_profile(p_role, p_specialty, p_country_code, p_map_consent, p_terms_version); $$;
CREATE FUNCTION public.community_list_comments(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 20, p_specialty text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.list_comments(p_after, p_limit, p_specialty); $$;
CREATE FUNCTION public.community_my_comments() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.my_comments(); $$;
CREATE FUNCTION public.community_submit_comment(p_id uuid, p_body text, p_language text, p_consent boolean, p_consent_version text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.submit_comment(p_id, p_body, p_language, p_consent, p_consent_version); $$;
CREATE FUNCTION public.community_withdraw_comment(p_id uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.withdraw_comment(p_id); $$;
CREATE FUNCTION public.community_report_comment(p_id uuid, p_reason text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.report_comment(p_id, p_reason); $$;
CREATE FUNCTION public.community_withdraw_map_consent() RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.withdraw_map_consent(); $$;
CREATE FUNCTION public.community_admin_members(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.admin_members(p_after, p_limit); $$;
CREATE FUNCTION public.community_admin_review_member(p_id uuid, p_verified boolean, p_suspended boolean, p_note text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.admin_review_member(p_id, p_verified, p_suspended, p_note); $$;
CREATE FUNCTION public.community_admin_comments(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 20, p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.admin_comments(p_after, p_limit, p_status); $$;
CREATE FUNCTION public.community_admin_review_comment(p_id uuid, p_approve boolean, p_note text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.admin_review_comment(p_id, p_approve, p_note); $$;
CREATE FUNCTION public.community_map() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT community.map(); $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA community FROM PUBLIC, anon, authenticated, service_role;
DO $grants$
DECLARE api record;
BEGIN
  FOR api IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND left(p.proname, 10) = 'community_'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', api.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', api.signature);
  END LOOP;
END;
$grants$;
GRANT USAGE ON SCHEMA community TO anon, authenticated;
GRANT EXECUTE ON FUNCTION community.status(), community.map(), public.community_status(), public.community_map() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION community.profile(), community.save_profile(text,text,text,boolean,text),
  community.list_comments(uuid,integer,text), community.my_comments(), community.submit_comment(uuid,text,text,boolean,text),
  community.withdraw_comment(uuid), community.withdraw_map_consent(), community.report_comment(uuid,text), community.admin_members(uuid,integer),
  community.admin_review_member(uuid,boolean,boolean,text), community.admin_comments(uuid,integer,text),
  community.admin_review_comment(uuid,boolean,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
