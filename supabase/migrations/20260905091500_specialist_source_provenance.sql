BEGIN;

DO $specialist_source_provenance$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE private.specialty_catalog_audit AS audit
  SET after_value = coalesce(audit.after_value, '{}'::jsonb) || jsonb_build_object(
    'specialist_source_numbered_sections', 58,
    'specialist_source_unique_specialties', 57,
    'specialist_authored_specialties', 57,
    'application_placeholder_specialties', jsonb_build_array('Pathology'),
    'merged_source_sections', jsonb_build_object('Pulmonology', jsonb_build_array(6, 55)),
    'localized_payload_sha256', '5BAB0FAEEF926B14931708368C056184A044C17630AF1C8F76FD563C14FA0854'
  )
  FROM private.specialty_catalog_versions AS version
  WHERE audit.version_id = version.id
    AND audit.action = 'published'
    AND audit.note = 'Romanian specialty narratives supplied by a medical specialist, with faithful French and English translations'
    AND audit.after_value ->> 'specialist_source_sha256' = '1E4C334306D56EE90CF007D57756860CC7690E301ABC83D768772F96EAB4E9E7'
    AND version.status = 'active'
    AND version.checksum = private.specialty_catalog_content_hash(version.id);

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Expected exactly one active, checksum-verified specialist narrative publication audit row';
  END IF;
END;
$specialist_source_provenance$;

COMMIT;
