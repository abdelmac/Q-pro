BEGIN;

-- One removable, reproducible recipe for a synthetic 5/5/5 portal preview.
-- This table has no relationship to response or participation-map tables.
-- The application derives the fifteen examples from seed + frozen catalog;
-- neither creation nor deletion writes research contributions or consent.
CREATE TABLE private.portal_test_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true CHECK (singleton),
  seed integer NOT NULL CHECK (seed > 0),
  generator_version text NOT NULL DEFAULT 'portal-test-v1'
    CHECK (generator_version = 'portal-test-v1'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  catalog_version_id uuid NOT NULL REFERENCES private.specialty_catalog_versions(id) ON DELETE RESTRICT,
  CONSTRAINT portal_test_dataset_singleton_key UNIQUE (singleton)
);
ALTER TABLE private.portal_test_dataset ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.portal_test_dataset FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE private.portal_test_dataset IS
  'Administrator-only synthetic preview recipe, physically isolated from research and public-map data. Seed and immutable published catalog reproduce five specialists, five students and five explorers. At most one recipe exists.';

CREATE FUNCTION private.validate_portal_test_dataset_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $validate$
BEGIN
  PERFORM private.resolve_published_specialty_config_revision(NEW.catalog_version_id);
  RETURN NEW;
END;
$validate$;
REVOKE ALL ON FUNCTION private.validate_portal_test_dataset_catalog() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_portal_test_dataset_catalog
  BEFORE INSERT OR UPDATE OF catalog_version_id ON private.portal_test_dataset
  FOR EACH ROW EXECUTE FUNCTION private.validate_portal_test_dataset_catalog();

CREATE FUNCTION private.get_portal_test_dataset()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $get$
DECLARE dataset_payload jsonb;
BEGIN
  PERFORM private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  SELECT jsonb_build_object(
    'id', dataset.id,
    'seed', dataset.seed,
    'created_at', dataset.created_at,
    'generator_version', dataset.generator_version,
    'catalog', private.specialty_catalog_payload(dataset.catalog_version_id, false)
  ) INTO dataset_payload
  FROM private.portal_test_dataset AS dataset
  WHERE dataset.singleton;
  RETURN dataset_payload;
END;
$get$;

CREATE FUNCTION private.create_portal_test_dataset()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $create$
DECLARE published_catalog_id uuid;
BEGIN
  PERFORM private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  -- Shared with delete: a concurrent/retried create returns the existing recipe
  -- and an old delete request cannot remove a newly generated dataset.
  PERFORM pg_advisory_xact_lock(hashtextextended('q-pro-portal-test-dataset', 0));
  IF EXISTS (SELECT 1 FROM private.portal_test_dataset WHERE singleton) THEN
    RETURN private.get_portal_test_dataset();
  END IF;

  SELECT id INTO published_catalog_id
  FROM private.specialty_catalog_versions
  WHERE status = 'active';
  IF published_catalog_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A published specialty catalog is required for test data';
  END IF;

  INSERT INTO private.portal_test_dataset(seed, created_by, catalog_version_id)
  VALUES (
    (floor(random() * 2147483647) + 1)::integer,
    (SELECT auth.uid()),
    published_catalog_id
  );
  RETURN private.get_portal_test_dataset();
END;
$create$;

CREATE FUNCTION private.delete_portal_test_dataset(p_dataset_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $delete$
DECLARE removed_count integer;
BEGIN
  PERFORM private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  PERFORM pg_advisory_xact_lock(hashtextextended('q-pro-portal-test-dataset', 0));
  DELETE FROM private.portal_test_dataset WHERE id = p_dataset_id;
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count = 1;
END;
$delete$;

CREATE FUNCTION public.get_portal_test_dataset()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $get$ SELECT private.get_portal_test_dataset(); $get$;
CREATE FUNCTION public.create_portal_test_dataset()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $create$ SELECT private.create_portal_test_dataset(); $create$;
CREATE FUNCTION public.delete_portal_test_dataset(p_dataset_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $delete$ SELECT private.delete_portal_test_dataset(p_dataset_id); $delete$;

REVOKE ALL ON FUNCTION private.get_portal_test_dataset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_portal_test_dataset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.delete_portal_test_dataset(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_portal_test_dataset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_portal_test_dataset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_portal_test_dataset(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_test_dataset() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_portal_test_dataset() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_portal_test_dataset(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_portal_test_dataset() IS
  'Enabled doctor/professor only. Returns the isolated synthetic recipe and its immutable published catalog, or NULL. Does not read research responses.';
COMMENT ON FUNCTION public.create_portal_test_dataset() IS
  'Enabled doctor/professor only. Creates one random synthetic recipe or returns the same existing recipe on retry; never inserts questionnaire responses.';
COMMENT ON FUNCTION public.delete_portal_test_dataset(uuid) IS
  'Enabled doctor/professor only. Deletes only the matching isolated recipe; false for absent or stale IDs. Never deletes research data.';

-- Deliberately do not create a recipe during migration.
NOTIFY pgrst, 'reload schema';
COMMIT;
