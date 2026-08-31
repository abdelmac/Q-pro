BEGIN;

/*
 * Specialist/Admin portal
 *
 * - Keeps every editable catalog object in the non-exposed private schema.
 * - Uses immutable published snapshots plus one optimistic-locking draft.
 * - Gives Doctors and Professors draft access, while only Professors publish
 *   or restore a historical version.
 * - Preserves the exact configuration revision used by new research rows.
 */

ALTER TABLE private.researchers
  ADD COLUMN portal_role text NOT NULL DEFAULT 'researcher';

ALTER TABLE private.researchers
  ADD CONSTRAINT researchers_portal_role_check
  CHECK (portal_role IN ('researcher', 'doctor', 'professor'));

/* A single pre-existing enabled portal account is the supervising Professor. */
DO $$
BEGIN
  IF (SELECT count(*) FROM private.researchers WHERE enabled) = 1 THEN
    UPDATE private.researchers
    SET portal_role = 'professor'
    WHERE enabled;
  END IF;
END;
$$;

CREATE TABLE private.trait_catalog (
  code text PRIMARY KEY,
  dimension text NOT NULL,
  measurement_source text NOT NULL,
  warning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trait_catalog_code_check
    CHECK (code ~ '^[a-z][a-z0-9_]{1,79}$'),
  CONSTRAINT trait_catalog_dimension_check
    CHECK (dimension IN ('thinking', 'working', 'interpersonal', 'technical', 'lifestyle')),
  CONSTRAINT trait_catalog_measurement_source_check
    CHECK (measurement_source IN ('question', 'question_and_value', 'value_only', 'unmeasured')),
  CONSTRAINT trait_catalog_warning_length_check
    CHECK (warning IS NULL OR char_length(warning) BETWEEN 1 AND 1000)
);

CREATE TABLE private.specialty_catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  label text NOT NULL,
  status text NOT NULL,
  lock_version bigint NOT NULL DEFAULT 1,
  parent_version_id uuid REFERENCES private.specialty_catalog_versions(id),
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  published_at timestamptz,
  checksum text,
  CONSTRAINT specialty_catalog_versions_id_revision_unique UNIQUE (id, revision),
  CONSTRAINT specialty_catalog_versions_label_length_check
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  CONSTRAINT specialty_catalog_versions_status_check
    CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT specialty_catalog_versions_lock_version_check
    CHECK (lock_version >= 1),
  CONSTRAINT specialty_catalog_versions_note_length_check
    CHECK (char_length(btrim(note)) BETWEEN 3 AND 1000),
  CONSTRAINT specialty_catalog_versions_publication_check
    CHECK (
      (status = 'draft' AND published_at IS NULL AND published_by IS NULL AND checksum IS NULL)
      OR
      (status IN ('active', 'archived') AND published_at IS NOT NULL AND checksum IS NOT NULL)
    ),
  CONSTRAINT specialty_catalog_versions_checksum_check
    CHECK (checksum IS NULL OR checksum ~ '^md5:[0-9a-f]{32}$')
);

CREATE UNIQUE INDEX specialty_catalog_one_active_idx
ON private.specialty_catalog_versions ((status))
WHERE status = 'active';

CREATE UNIQUE INDEX specialty_catalog_one_draft_idx
ON private.specialty_catalog_versions ((status))
WHERE status = 'draft';

CREATE TABLE private.specialty_catalog_entries (
  version_id uuid NOT NULL REFERENCES private.specialty_catalog_versions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  category text NOT NULL,
  descriptions jsonb NOT NULL,
  clinical_summaries jsonb NOT NULL,
  profile jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, name),
  CONSTRAINT specialty_catalog_entries_name_length_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 180),
  CONSTRAINT specialty_catalog_entries_category_check
    CHECK (category IN (
      'Surgical',
      'Medical',
      'Pediatric',
      'Psychiatry',
      'Diagnostic & Support',
      'Public & Preventive'
    )),
  CONSTRAINT specialty_catalog_entries_descriptions_shape_check
    CHECK (jsonb_typeof(descriptions) = 'object' AND octet_length(descriptions::text) <= 12000),
  CONSTRAINT specialty_catalog_entries_summaries_shape_check
    CHECK (jsonb_typeof(clinical_summaries) = 'object' AND octet_length(clinical_summaries::text) <= 30000),
  CONSTRAINT specialty_catalog_entries_profile_shape_check
    CHECK (jsonb_typeof(profile) = 'object' AND octet_length(profile::text) <= 32768)
);

CREATE INDEX specialty_catalog_entries_version_idx
ON private.specialty_catalog_entries (version_id, name);

CREATE TABLE private.specialty_catalog_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_role text NOT NULL,
  action text NOT NULL,
  version_id uuid NOT NULL REFERENCES private.specialty_catalog_versions(id) ON DELETE RESTRICT,
  version_revision bigint NOT NULL,
  specialty_name text,
  note text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  CONSTRAINT specialty_catalog_audit_role_check
    CHECK (actor_role IN ('system', 'researcher', 'doctor', 'professor')),
  CONSTRAINT specialty_catalog_audit_action_check
    CHECK (action IN (
      'seeded',
      'draft_created',
      'entry_updated',
      'published',
      'restore_requested'
    )),
  CONSTRAINT specialty_catalog_audit_note_length_check
    CHECK (char_length(btrim(note)) BETWEEN 3 AND 1000)
);

CREATE INDEX specialty_catalog_audit_version_idx
ON private.specialty_catalog_audit (version_id, occurred_at DESC);

ALTER TABLE private.trait_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.specialty_catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.specialty_catalog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.specialty_catalog_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.trait_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.specialty_catalog_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.specialty_catalog_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.specialty_catalog_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.specialty_catalog_versions_revision_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.specialty_catalog_audit_id_seq FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.specialty_catalog_versions IS
  'Versioned specialty catalog snapshots. Published snapshots are immutable; at most one draft and one active version exist.';
COMMENT ON TABLE private.specialty_catalog_entries IS
  'Localized editorial content and exact matching profile for every specialty in a catalog snapshot.';
COMMENT ON TABLE private.trait_catalog IS
  'Trait measurement provenance. manual_orientation is value-only and prevention_orientation is currently unmeasured.';
COMMENT ON TABLE private.specialty_catalog_audit IS
  'Append-only audit history for specialty catalog draft edits, publications, and restores.';

CREATE OR REPLACE FUNCTION private.current_portal_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT researcher.portal_role
  FROM private.researchers AS researcher
  WHERE researcher.user_id = (SELECT auth.uid())
    AND researcher.enabled
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.require_portal_role(allowed_roles text[])
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_role text;
BEGIN
  resolved_role := private.current_portal_role();
  IF resolved_role IS NULL OR NOT (resolved_role = ANY(allowed_roles)) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'This account is not authorized for this portal action';
  END IF;
  RETURN resolved_role;
END;
$$;

CREATE OR REPLACE FUNCTION private.add_portal_user_by_email(
  portal_email text,
  portal_display_name text,
  requested_portal_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  portal_user_id uuid;
  normalized_display_name text;
BEGIN
  IF requested_portal_role IS NULL
     OR requested_portal_role NOT IN ('researcher', 'doctor', 'professor') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Portal role must be researcher, doctor, or professor';
  END IF;
  IF portal_email IS NULL OR char_length(btrim(portal_email)) < 3 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid portal email is required';
  END IF;
  normalized_display_name := nullif(btrim(portal_display_name), '');
  IF normalized_display_name IS NOT NULL
     AND char_length(normalized_display_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Portal display name is invalid';
  END IF;

  SELECT auth_user.id INTO portal_user_id
  FROM auth.users AS auth_user
  WHERE lower(auth_user.email) = lower(btrim(portal_email))
  LIMIT 1;

  IF portal_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'No Supabase Auth user exists for this email';
  END IF;

  INSERT INTO private.researchers (user_id, display_name, enabled, portal_role)
  VALUES (portal_user_id, normalized_display_name, true, requested_portal_role)
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      enabled = true,
      portal_role = EXCLUDED.portal_role;

  RETURN portal_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.valid_change_note(note_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(char_length(btrim(note_value)) BETWEEN 3 AND 1000, false);
$$;

CREATE OR REPLACE FUNCTION private.valid_localized_catalog_text(
  payload jsonb,
  minimum_length integer,
  maximum_length integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  language_code text;
  language_value jsonb;
  key_count integer;
  text_value text;
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
     OR minimum_length < 0
     OR maximum_length < minimum_length THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO key_count
  FROM jsonb_object_keys(payload);

  IF key_count <> 3 OR NOT (payload ?& ARRAY['en', 'fr', 'ro']) THEN
    RETURN false;
  END IF;

  FOR language_code, language_value IN
    SELECT item.key, item.value
    FROM jsonb_each(payload) AS item
  LOOP
    IF language_code NOT IN ('en', 'fr', 'ro')
       OR jsonb_typeof(language_value) IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;
    text_value := language_value #>> '{}';
    IF char_length(btrim(text_value)) NOT BETWEEN minimum_length AND maximum_length THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.valid_specialty_profile(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  trait_code text;
  trait_value jsonb;
  target_value numeric;
  importance_value numeric;
  trait_count integer;
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
     OR octet_length(payload::text) > 32768 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO trait_count
  FROM jsonb_object_keys(payload);

  IF trait_count < 1 OR trait_count > 128 THEN
    RETURN false;
  END IF;

  FOR trait_code, trait_value IN
    SELECT item.key, item.value
    FROM jsonb_each(payload) AS item
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM private.trait_catalog AS trait
      WHERE trait.code = trait_code
    )
       OR jsonb_typeof(trait_value) IS DISTINCT FROM 'array'
       OR jsonb_array_length(trait_value) <> 2
       OR jsonb_typeof(trait_value -> 0) IS DISTINCT FROM 'number'
       OR jsonb_typeof(trait_value -> 1) IS DISTINCT FROM 'number' THEN
      RETURN false;
    END IF;

    BEGIN
      target_value := (trait_value ->> 0)::numeric;
      importance_value := (trait_value ->> 1)::numeric;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;

    IF target_value NOT BETWEEN 0 AND 100
       OR target_value <> trunc(target_value)
       OR importance_value NOT BETWEEN 1 AND 3
       OR importance_value <> trunc(importance_value) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.valid_specialty_catalog_entry(
  specialty_name text,
  specialty_category text,
  descriptions_value jsonb,
  clinical_summaries_value jsonb,
  profile_value jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    private.valid_specialty_v1(specialty_name)
    AND specialty_category IN (
      'Surgical', 'Medical', 'Pediatric', 'Psychiatry',
      'Diagnostic & Support', 'Public & Preventive'
    )
    AND private.valid_localized_catalog_text(descriptions_value, 1, 2000)
    AND private.valid_localized_catalog_text(clinical_summaries_value, 20, 5000)
    AND private.valid_specialty_profile(profile_value),
    false
  );
$$;

CREATE OR REPLACE FUNCTION private.specialty_catalog_content_hash(catalog_version_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 'md5:' || md5(
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', entry.name,
          'category', entry.category,
          'descriptions', entry.descriptions,
          'clinical_summaries', entry.clinical_summaries,
          'profile', entry.profile
        ) ORDER BY entry.name
      ),
      '[]'::jsonb
    )::text
  )
  FROM private.specialty_catalog_entries AS entry
  WHERE entry.version_id = catalog_version_id;
$$;

CREATE OR REPLACE FUNCTION private.specialty_catalog_payload(
  catalog_version_id uuid,
  include_admin_fields boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'version',
      jsonb_build_object(
        'id', version.id,
        'revision', version.revision,
        'label', version.label,
        'content_hash', coalesce(
          version.checksum,
          private.specialty_catalog_content_hash(version.id)
        ),
        'published_at', version.published_at
      ) || CASE WHEN include_admin_fields THEN jsonb_build_object(
        'status', version.status,
        'lock_version', version.lock_version,
        'parent_version_id', version.parent_version_id,
        'note', version.note,
        'created_by', version.created_by,
        'created_at', version.created_at,
        'published_by', version.published_by
      ) ELSE '{}'::jsonb END,
    'specialties', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'name', entry.name,
            'category', entry.category,
            'descriptions', entry.descriptions,
            'clinical_summaries', entry.clinical_summaries,
            'profile', entry.profile
          ) ORDER BY entry.name
        ),
        '[]'::jsonb
      )
      FROM private.specialty_catalog_entries AS entry
      WHERE entry.version_id = version.id
    )
  )
  FROM private.specialty_catalog_versions AS version
  WHERE version.id = catalog_version_id;
$$;

CREATE OR REPLACE FUNCTION private.specialty_catalog_editor_payload(
  catalog_version_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.specialty_catalog_payload(version.id, true) || jsonb_build_object(
    'version_id', version.id,
    'active_version_id', active_version.id,
    'lock_version', version.lock_version,
    'status', version.status
  )
  FROM private.specialty_catalog_versions AS version
  LEFT JOIN private.specialty_catalog_versions AS active_version
    ON active_version.status = 'active'
  WHERE version.id = catalog_version_id;
$$;

CREATE OR REPLACE FUNCTION private.guard_specialty_catalog_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  version_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Specialty catalog snapshot entries cannot be deleted';
  END IF;

  SELECT version.status INTO version_status
  FROM private.specialty_catalog_versions AS version
  WHERE version.id = OLD.version_id;

  IF version_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Only draft specialty catalog entries can be modified';
  END IF;

  IF OLD.version_id IS DISTINCT FROM NEW.version_id
     OR OLD.name IS DISTINCT FROM NEW.name
     OR OLD.category IS DISTINCT FROM NEW.category THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Specialty identity and category are immutable';
  END IF;

  IF (OLD.profile -> 'prevention_orientation')
     IS DISTINCT FROM (NEW.profile -> 'prevention_orientation') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'prevention_orientation is unmeasured and cannot be changed';
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_specialty_catalog_entry_mutation
BEFORE UPDATE OR DELETE ON private.specialty_catalog_entries
FOR EACH ROW
EXECUTE FUNCTION private.guard_specialty_catalog_entry_mutation();

/*
 * Generated with scripts/generate-specialty-catalog-seed.mjs --compact.
 * Keeping the generated payload in this migration makes the deployed seed
 * independent from the local filesystem while leaving its source reproducible.
 */
CREATE TEMP TABLE specialty_catalog_seed_payload (
  payload jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO specialty_catalog_seed_payload (payload)
VALUES ($specialty_catalog_seed$
{"entries":[{"name":"Allergy and Clinical Immunology","category":"Medical","descriptions":{"en":"Diagnosis and management of immune disorders — analytical, methodical, and lifestyle-friendly.","fr":"Diagnostic et prise en charge des troubles immunitaires — analytique, méthodique et équilibré.","ro":"Diagnosticul și managementul tulburărilor imune — analitic, metodic și echilibrat în stil de viață."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Diagnosis and management of immune disorders — analytical, methodical, and lifestyle-friendly. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Diagnostic et prise en charge des troubles immunitaires — analytique, méthodique et équilibré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Diagnosticul și managementul tulburărilor imune — analitic, metodic și echilibrat în stil de viață. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"basic_science_interest":[85,2],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"frustration_tolerance":[85,2],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Anesthesiology and Intensive Care","category":"Surgical","descriptions":{"en":"Perioperative and critical-care physiology — decisive, composed, and hands-on in crisis.","fr":"Physiologie périopératoire et soins intensifs — décisif, calme et pratique en crise.","ro":"Fiziologie perioperatorie și terapie intensivă — decisiv, calm și practic în criză."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Perioperative and critical-care physiology — decisive, composed, and hands-on in crisis. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Physiologie périopératoire et soins intensifs — décisif, calme et pratique en crise. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Fiziologie perioperatorie și terapie intensivă — decisiv, calm și practic în criză. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[90,2],"control_preference":[85,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"long_term_patient_relationship":[30,1],"multitasking":[90,3],"observation":[85,2],"precision":[90,3],"rapid_results_preference":[75,1],"short_term_patient_contact":[85,2],"stress_resistance":[95,3],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Infectious Diseases","category":"Medical","descriptions":{"en":"Diagnosis and treatment of infections — analytical, broad-ranging, and intellectually rich.","fr":"Diagnostic et traitement des infections — analytique, varié et intellectuellement riche.","ro":"Diagnosticul și tratamentul infecțiilor — analitic, variat și bogat intelectual."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Diagnosis and treatment of infections — analytical, broad-ranging, and intellectually rich. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Diagnostic et traitement des infections — analytique, varié et intellectuellement riche. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Diagnosticul și tratamentul infecțiilor — analitic, variat și bogat intelectual. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[90,3],"basic_science_interest":[90,2],"challenge_seeking":[80,2],"complex_problem_solving":[90,3],"logical_reasoning":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Cardiology","category":"Medical","descriptions":{"en":"Heart and circulation — analytical and technology-driven, with acute and chronic dimensions.","fr":"Cœur et circulation — analytique et technologique, avec des dimensions aiguës et chroniques.","ro":"Inima și circulația — analitic și orientat spre tehnologie, cu dimensiuni acute și cronice."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Heart and circulation — analytical and technology-driven, with acute and chronic dimensions. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Cœur et circulation — analytique et technologique, avec des dimensions aiguës et chroniques. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Inima și circulația — analitic și orientat spre tehnologie, cu dimensiuni acute și cronice. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[90,2],"ambiguity_tolerance":[80,2],"complex_problem_solving":[90,3],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"logical_reasoning":[85,2],"multitasking":[90,3],"observation":[85,2],"patient_involvement":[65,1],"precision":[90,3],"quantitative_reasoning":[80,2],"rapid_results_preference":[75,1],"scientific_curiosity":[85,2],"stress_resistance":[95,3],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Pediatric Cardiology","category":"Pediatric","descriptions":{"en":"Heart care for children — meticulous, compassionate, and team-based.","fr":"Soins cardiaques pour enfants — minutieux, compatissants et en équipe.","ro":"Îngrijirea cardiacă a copiilor — meticuloasă, compătimitoare și în echipă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Heart care for children — meticulous, compassionate, and team-based. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins cardiaques pour enfants — minutieux, compatissants et en équipe. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea cardiacă a copiilor — meticuloasă, compătimitoare și în echipă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[80,2],"communication":[85,2],"complex_problem_solving":[90,3],"family_interaction":[90,3],"logical_reasoning":[85,2],"observation":[85,2],"patient_involvement":[65,1],"precision":[90,3],"scientific_curiosity":[85,2],"stress_resistance":[85,2],"technical_orientation":[90,3],"technology_interest":[90,3],"warmth":[90,3]}},{"name":"Dermatology and Venereology","category":"Medical","descriptions":{"en":"Disorders of the skin — visual, detail-driven, and one of the most lifestyle-balanced fields.","fr":"Affections cutanées — visuel, orienté détails et l'un des domaines les plus équilibrés.","ro":"Tulburări ale pielii — vizual, orientat spre detalii și unul dintre cele mai echilibrate domenii."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Disorders of the skin — visual, detail-driven, and one of the most lifestyle-balanced fields. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Affections cutanées — visuel, orienté détails et l'un des domaines les plus équilibrés. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Tulburări ale pielii — vizual, orientat spre detalii și unul dintre cele mai echilibrate domenii. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"complex_problem_solving":[85,2],"creativity":[75,2],"detail_orientation":[90,3],"lifestyle_priority":[70,1],"logical_reasoning":[90,3],"observation":[90,3],"precision":[90,3],"tolerance_of_others":[90,2],"visual_reasoning":[95,3]}},{"name":"Diabetes, Nutrition and Metabolic Diseases","category":"Medical","descriptions":{"en":"Chronic metabolic care — relational, educational, and longitudinal.","fr":"Soins métaboliques chroniques — relationnel, éducatif et longitudinal.","ro":"Îngrijire metabolică cronică — relațională, educativă și longitudinală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Chronic metabolic care — relational, educational, and longitudinal. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins métaboliques chroniques — relationnel, éducatif et longitudinal. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire metabolică cronică — relațională, educativă și longitudinală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"care_motivation":[85,2],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Endocrinology","category":"Medical","descriptions":{"en":"Hormone and gland disorders — analytical, intellectual, and methodical.","fr":"Troubles hormonaux et glandulaires — analytique, intellectuel et méthodique.","ro":"Tulburări hormonale și glandulare — analitic, intelectual și metodic."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Hormone and gland disorders — analytical, intellectual, and methodical. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Troubles hormonaux et glandulaires — analytique, intellectuel et méthodique. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Tulburări hormonale și glandulare — analitic, intelectual și metodic. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"basic_science_interest":[90,3],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[95,3],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Medical Assessment of Work Capacity / Occupational Disability Assessment","category":"Diagnostic & Support","descriptions":{"en":"Evaluating fitness and capacity — structured, autonomous, and well-balanced.","fr":"Évaluation de la capacité et de l'aptitude — structurée, autonome et équilibrée.","ro":"Evaluarea capacității și aptitudinii — structurată, autonomă și echilibrată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Evaluating fitness and capacity — structured, autonomous, and well-balanced. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Évaluation de la capacité et de l'aptitude — structurée, autonome et équilibrée. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Evaluarea capacității și aptitudinii — structurată, autonomă și echilibrată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"logical_reasoning":[90,3],"objectivity":[95,3],"organization":[90,2],"precision":[90,3],"professional_identity":[75,1],"routine_tolerance":[75,2]}},{"name":"Clinical Pharmacology","category":"Medical","descriptions":{"en":"The science of therapeutics and drug action — research-led and intellectual.","fr":"Science des thérapeutiques et de l'action des médicaments — recherche et intellectuelle.","ro":"Știința terapeuticilor și a acțiunii medicamentelor — condusă de cercetare și intelectuală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: The science of therapeutics and drug action — research-led and intellectual. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Science des thérapeutiques et de l'action des médicaments — recherche et intellectuelle. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Știința terapeuticilor și a acțiunii medicamentelor — condusă de cercetare și intelectuală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"academic_orientation":[85,2],"basic_science_interest":[95,3],"logical_reasoning":[90,3],"precision":[90,2],"research_interest":[90,3]}},{"name":"Gastroenterology","category":"Medical","descriptions":{"en":"Digestive system and liver — cognitive plus endoscopic, with broad variety.","fr":"Système digestif et foie — cognitif plus endoscopique, avec une grande variété.","ro":"Sistem digestiv și ficat — cognitiv plus endoscopic, cu varietate largă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Digestive system and liver — cognitive plus endoscopic, with broad variety. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Système digestif et foie — cognitif plus endoscopique, avec une grande variété. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Sistem digestiv și ficat — cognitiv plus endoscopic, cu varietate largă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"complex_problem_solving":[90,3],"logical_reasoning":[85,2],"manual_dexterity":[75,2],"observation":[85,2],"patient_involvement":[70,1],"precision":[90,3],"scientific_curiosity":[85,2],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Pediatric Gastroenterology","category":"Pediatric","descriptions":{"en":"Digestive and liver care for children — compassionate, detailed, and longitudinal.","fr":"Soins digestifs et hépatiques pour enfants — compatissants, détaillés et longitudinaux.","ro":"Îngrijire digestivă și hepatică pentru copii — compătimitoare, detaliată și longitudinală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Digestive and liver care for children — compassionate, detailed, and longitudinal. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins digestifs et hépatiques pour enfants — compatissants, détaillés et longitudinaux. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire digestivă și hepatică pentru copii — compătimitoare, detaliată și longitudinală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[80,2],"communication":[85,2],"complex_problem_solving":[90,3],"family_interaction":[90,3],"logical_reasoning":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2],"technical_orientation":[75,2],"warmth":[90,3]}},{"name":"Medical Genetics","category":"Medical","descriptions":{"en":"Inherited and congenital disease — deeply intellectual, precise, and counseling-oriented.","fr":"Maladies héréditaires et congénitales — profondément intellectuelle, précise et orientée conseil.","ro":"Boli ereditare și congenitale — profund intelectuală, precisă și orientată spre consiliere."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Inherited and congenital disease — deeply intellectual, precise, and counseling-oriented. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Maladies héréditaires et congénitales — profondément intellectuelle, précise et orientée conseil. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Boli ereditare și congenitale — profund intelectuală, precisă și orientată spre consiliere. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"academic_orientation":[90,2],"ambiguity_tolerance":[80,2],"basic_science_interest":[90,3],"complex_problem_solving":[90,3],"logical_reasoning":[85,2],"patient_involvement":[65,1],"precision":[95,3],"research_interest":[80,2],"scientific_curiosity":[85,2],"social_energy":[40,1],"sustained_concentration":[90,3]}},{"name":"Geriatrics and Gerontology","category":"Medical","descriptions":{"en":"Care of older adults — holistic, relational, and team-coordinated.","fr":"Soins aux personnes âgées — holistique, relationnel et coordonné en équipe.","ro":"Îngrijirea adulților în vârstă — holistică, relațională și coordonată în echipă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Care of older adults — holistic, relational, and team-coordinated. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins aux personnes âgées — holistique, relationnel et coordonné en équipe. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea adulților în vârstă — holistică, relațională și coordonată în echipă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"affective_empathy":[95,3],"care_motivation":[85,2],"cognitive_empathy":[80,2],"communication":[85,2],"incremental_progress_tolerance":[95,3],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"people_interest":[90,2],"social_energy":[80,2],"tolerance_of_others":[95,3]}},{"name":"Hematology","category":"Medical","descriptions":{"en":"Blood and marrow disorders — analytical, with lab and clinical breadth.","fr":"Troubles du sang et de la moelle — analytique, avec laboratoire et clinique.","ro":"Tulburări ale sângelui și măduvei — analitic, cu laborator și clinicitate."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Blood and marrow disorders — analytical, with lab and clinical breadth. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Troubles du sang et de la moelle — analytique, avec laboratoire et clinique. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Tulburări ale sângelui și măduvei — analitic, cu laborator și clinicitate. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"basic_science_interest":[90,2],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"precision":[90,2],"scientific_curiosity":[85,2]}},{"name":"Family Medicine","category":"Medical","descriptions":{"en":"Comprehensive longitudinal primary care — relational, broad, and grounded.","fr":"Soins primaires longitudinaux complets — relationnel, large et ancré.","ro":"Îngrijire primară longitudinală cuprinzătoare — relațională, largă și ancorată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Comprehensive longitudinal primary care — relational, broad, and grounded. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins primaires longitudinaux complets — relationnel, large et ancré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire primară longitudinală cuprinzătoare — relațională, largă și ancorată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"breadth_orientation":[95,3],"care_coordination":[90,3],"care_motivation":[85,2],"cognitive_empathy":[80,2],"communication":[85,2],"incremental_progress_tolerance":[90,3],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"people_interest":[90,2],"social_energy":[80,2]}},{"name":"Emergency Medicine","category":"Surgical","descriptions":{"en":"Acute undifferentiated care — fast, adaptive, and composed under chaos.","fr":"Soins aigus non différenciés — rapide, adaptatif et calme dans le chaos.","ro":"Îngrijire acută nediferențiată — rapidă, adaptivă și calmă în haos."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Acute undifferentiated care — fast, adaptive, and composed under chaos. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins aigus non différenciés — rapide, adaptatif et calme dans le chaos. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire acută nediferențiată — rapidă, adaptivă și calmă în haos. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[95,3],"adaptability":[90,2],"care_motivation":[85,2],"challenge_seeking":[90,3],"communication":[85,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"multitasking":[90,3],"people_interest":[90,2],"rapid_results_preference":[75,1],"routine_tolerance":[20,2],"social_energy":[80,2],"stress_resistance":[95,3]}},{"name":"Internal Medicine","category":"Medical","descriptions":{"en":"Adult diagnostic and longitudinal care — the cerebral, broad generalist core.","fr":"Diagnostic adulte et soins longitudinaux — le cœur généraliste cérébral et large.","ro":"Diagnostic adult și îngrijire longitudinală — nucleul generalist cerebral și larg."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Adult diagnostic and longitudinal care — the cerebral, broad generalist core. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Diagnostic adulte et soins longitudinaux — le cœur généraliste cérébral et large. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Diagnostic adult și îngrijire longitudinală — nucleul generalist cerebral și larg. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[90,3],"breadth_orientation":[90,3],"complex_problem_solving":[95,3],"logical_reasoning":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Physical Medicine and Rehabilitation","category":"Medical","descriptions":{"en":"Restoring function after injury or illness — patient, team-led, and longitudinal.","fr":"Restauration de la fonction après lésion ou maladie — patient, en équipe et longitudinal.","ro":"Restabilirea funcției după accidentare sau boală — răbdătoare, în echipă și longitudinală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Restoring function after injury or illness — patient, team-led, and longitudinal. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Restauration de la fonction après lésion ou maladie — patient, en équipe et longitudinal. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Restabilirea funcției după accidentare sau boală — răbdătoare, în echipă și longitudinală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"care_motivation":[85,2],"cognitive_empathy":[80,2],"communication":[85,2],"coordination":[85,2],"incremental_progress_tolerance":[95,3],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"people_interest":[90,2],"social_energy":[80,2]}},{"name":"Occupational Medicine","category":"Diagnostic & Support","descriptions":{"en":"Workplace health and safety — structured, autonomous, and lifestyle-friendly.","fr":"Santé et sécurité au travail — structuré, autonome et équilibré.","ro":"Sănătate și siguranță la locul de muncă — structurată, autonomă și echilibrată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Workplace health and safety — structured, autonomous, and lifestyle-friendly. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Santé et sécurité au travail — structuré, autonome et équilibré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Sănătate și siguranță la locul de muncă — structurată, autonomă și echilibrată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"communication":[75,1],"lifestyle_priority":[75,1],"organization":[90,3],"prevention_orientation":[85,1],"routine_tolerance":[80,2],"structure_preference":[85,2]}},{"name":"Sports Medicine","category":"Medical","descriptions":{"en":"Musculoskeletal care for athletes — active, team-oriented, and people-facing.","fr":"Soins musculosquelettiques pour les athlètes — actif, en équipe et tourné vers les gens.","ro":"Îngrijire musculoscheletală pentru sportivi — activă, orientată spre echipă și oameni."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Musculoskeletal care for athletes — active, team-oriented, and people-facing. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins musculosquelettiques pour les athlètes — actif, en équipe et tourné vers les gens. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire musculoscheletală pentru sportivi — activă, orientată spre echipă și oameni. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"care_motivation":[85,2],"communication":[85,2],"energy":[90,3],"novelty_seeking":[80,2],"people_interest":[90,2],"practical_orientation":[85,2],"social_energy":[90,3]}},{"name":"Nephrology","category":"Medical","descriptions":{"en":"Kidney and dialysis care — analytical, longitudinal, and team-based.","fr":"Soins rénaux et dialyse — analytique, longitudinal et en équipe.","ro":"Îngrijirea rinichilor și dializei — analitică, longitudinală și în echipă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Kidney and dialysis care — analytical, longitudinal, and team-based. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins rénaux et dialyse — analytique, longitudinal et en équipe. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea rinichilor și dializei — analitică, longitudinală și în echipă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"basic_science_interest":[90,2],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"quantitative_reasoning":[90,3],"scientific_curiosity":[85,2]}},{"name":"Pediatric Nephrology","category":"Pediatric","descriptions":{"en":"Kidney care for children — meticulous, compassionate, and longitudinal.","fr":"Soins rénaux pour enfants — minutieux, compatissants et longitudinaux.","ro":"Îngrijirea rinichilor la copii — meticuloasă, compătimitoare și longitudinală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Kidney care for children — meticulous, compassionate, and longitudinal. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins rénaux pour enfants — minutieux, compatissants et longitudinaux. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea rinichilor la copii — meticuloasă, compătimitoare și longitudinală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[80,2],"cognitive_empathy":[80,2],"communication":[85,2],"complex_problem_solving":[90,3],"family_interaction":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"quantitative_reasoning":[85,2],"scientific_curiosity":[85,2],"warmth":[90,3]}},{"name":"Neonatology","category":"Pediatric","descriptions":{"en":"Care of newborns and premature infants — intense, precise, and deeply collaborative.","fr":"Soins aux nouveau-nés et prématurés — intense, précis et profondément collaboratif.","ro":"Îngrijirea nou-născuților și a prematurilor — intensă, precisă și profund colaborativă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Care of newborns and premature infants — intense, precise, and deeply collaborative. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins aux nouveau-nés et prématurés — intense, précis et profondément collaboratif. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea nou-născuților și a prematurilor — intensă, precisă și profund colaborativă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"communication":[85,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"emotional_resilience":[95,3],"family_interaction":[90,3],"interruption_tolerance":[90,2],"multitasking":[90,3],"precision":[95,3],"rapid_results_preference":[75,1],"stress_resistance":[95,3],"warmth":[90,3]}},{"name":"Neurology","category":"Medical","descriptions":{"en":"Disorders of the nervous system — highly analytical, detail-driven, and intellectual.","fr":"Troubles du système nerveux — hautement analytique, orienté détails et intellectuel.","ro":"Tulburări ale sistemului nervos — extrem de analitic, orientat spre detalii și intelectual."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Disorders of the nervous system — highly analytical, detail-driven, and intellectual. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Troubles du système nerveux — hautement analytique, orienté détails et intellectuel. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Tulburări ale sistemului nervos — extrem de analitic, orientat spre detalii și intelectual. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[80,2],"complex_problem_solving":[85,2],"detail_orientation":[90,3],"logical_reasoning":[90,3],"observation":[95,3],"patient_involvement":[65,1],"scientific_curiosity":[85,2],"sustained_concentration":[95,3]}},{"name":"Pediatric Neurology","category":"Pediatric","descriptions":{"en":"Neurological care of children — meticulous, compassionate, and longitudinal.","fr":"Soins neurologiques pour enfants — minutieux, compatissants et longitudinaux.","ro":"Îngrijire neurologică a copiilor — meticuloasă, compătimitoare și longitudinală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Neurological care of children — meticulous, compassionate, and longitudinal. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins neurologiques pour enfants — minutieux, compatissants et longitudinaux. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire neurologică a copiilor — meticuloasă, compătimitoare și longitudinală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[80,2],"communication":[85,2],"complex_problem_solving":[85,2],"detail_orientation":[90,3],"family_interaction":[90,3],"logical_reasoning":[90,3],"observation":[90,3],"patient_involvement":[65,1],"scientific_curiosity":[85,2],"warmth":[90,3]}},{"name":"Medical Oncology","category":"Medical","descriptions":{"en":"Systemic cancer care — emotionally demanding, intellectual, and team-based.","fr":"Soins systémiques du cancer — émotionnellement exigeant, intellectuel et en équipe.","ro":"Îngrijire sistemică a cancerului — emoționant de exigentă, intelectuală și în echipă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Systemic cancer care — emotionally demanding, intellectual, and team-based. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins systémiques du cancer — émotionnellement exigeant, intellectuel et en équipe. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire sistemică a cancerului — emoționant de exigentă, intelectuală și în echipă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"affective_empathy":[85,2],"ambiguity_tolerance":[80,2],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"emotional_resilience":[95,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"mortality_tolerance":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Pediatric Oncology and Hematology","category":"Pediatric","descriptions":{"en":"Cancer and blood care for children — compassionate, rigorous, and deeply collaborative.","fr":"Soins du cancer et du sang chez les enfants — compatissants, rigoureux et profondément collaboratifs.","ro":"Îngrijirea cancerului și a sângelui la copii — compătimitoare, riguroasă și profund colaborativă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Cancer and blood care for children — compassionate, rigorous, and deeply collaborative. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins du cancer et du sang chez les enfants — compatissants, rigoureux et profondément collaboratifs. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea cancerului și a sângelui la copii — compătimitoare, riguroasă și profund colaborativă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[80,2],"cognitive_empathy":[80,2],"communication":[85,2],"complex_problem_solving":[90,3],"emotional_resilience":[95,3],"family_interaction":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"mortality_tolerance":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2],"warmth":[90,3]}},{"name":"Pediatrics","category":"Pediatric","descriptions":{"en":"General care of children — warm, relational, and broad.","fr":"Soins généraux aux enfants — chaleureux, relationnel et large.","ro":"Îngrijirea generală a copiilor — caldă, relațională și largă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: General care of children — warm, relational, and broad. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins généraux aux enfants — chaleureux, relationnel et large. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea generală a copiilor — caldă, relațională și largă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"care_motivation":[85,2],"cognitive_empathy":[80,2],"communication":[85,2],"family_interaction":[90,3],"incremental_progress_tolerance":[90,3],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"people_interest":[90,2],"social_energy":[80,2],"warmth":[90,3]}},{"name":"Pulmonology","category":"Medical","descriptions":{"en":"Lung and airway disease — cognitive with procedural variety.","fr":"Maladies pulmonaires et des voies respiratoires — cognitif avec variété procédurale.","ro":"Boli pulmonare și ale căilor respiratorii — cognitiv cu varietate procedurală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Lung and airway disease — cognitive with procedural variety. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Maladies pulmonaires et des voies respiratoires — cognitif avec variété procédurale. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Boli pulmonare și ale căilor respiratorii — cognitiv cu varietate procedurală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[80,2],"ambiguity_tolerance":[80,2],"complex_problem_solving":[90,3],"logical_reasoning":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2],"technical_orientation":[70,1]}},{"name":"Pediatric Pulmonology","category":"Pediatric","descriptions":{"en":"Respiratory care for children — compassionate, detailed, and longitudinal.","fr":"Soins respiratoires pour enfants — compatissants, détaillés et longitudinaux.","ro":"Îngrijire respiratorie pentru copii — compătimitoare, detaliată și longitudinală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Respiratory care for children — compassionate, detailed, and longitudinal. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins respiratoires pour enfants — compatissants, détaillés et longitudinaux. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire respiratorie pentru copii — compătimitoare, detaliată și longitudinală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[80,2],"cognitive_empathy":[80,2],"communication":[85,2],"complex_problem_solving":[90,3],"family_interaction":[90,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2],"warmth":[90,3]}},{"name":"Psychiatry","category":"Psychiatry","descriptions":{"en":"Mental health and behavior — reflective, relational, and intellectually deep.","fr":"Santé mentale et comportement — réflexif, relationnel et intellectuellement profond.","ro":"Sănătate mintală și comportament — reflexiv, relațional și profund intelectual."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Mental health and behavior — reflective, relational, and intellectually deep. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Santé mentale et comportement — réflexif, relationnel et intellectuellement profond. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Sănătate mintală și comportament — reflexiv, relațional și profund intelectual. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"affective_empathy":[85,2],"ambiguity_tolerance":[95,3],"cognitive_empathy":[95,3],"listening":[95,3],"long_term_patient_relationship":[90,3],"patience":[95,3],"rapid_results_preference":[30,2],"tolerance_of_others":[95,3]}},{"name":"Child and Adolescent Psychiatry","category":"Psychiatry","descriptions":{"en":"Mental health care for young people — empathic, developmental, and team-oriented.","fr":"Soins de santé mentale pour les jeunes — empathique, développemental et en équipe.","ro":"Îngrijire de sănătate mintală pentru tineri — empatic, developmental și orientat spre echipă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Mental health care for young people — empathic, developmental, and team-oriented. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins de santé mentale pour les jeunes — empathique, développemental et en équipe. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire de sănătate mintală pentru tineri — empatic, developmental și orientat spre echipă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"adaptability":[85,2],"affective_empathy":[90,3],"ambiguity_tolerance":[95,3],"cognitive_empathy":[95,3],"communication":[85,2],"family_interaction":[90,3],"listening":[95,3],"patience":[95,3],"warmth":[90,3]}},{"name":"Radiation Oncology","category":"Medical","descriptions":{"en":"Precision radiation treatment of cancer — technology-rich, exacting, and collaborative.","fr":"Traitement du cancer par radiothérapie de précision — riche en technologie, exigeant et collaboratif.","ro":"Tratamentul cancerului prin radioterapie de precizie — bogat în tehnologie, exigent și colaborativ."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Precision radiation treatment of cancer — technology-rich, exacting, and collaborative. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Traitement du cancer par radiothérapie de précision — riche en technologie, exigeant et collaboratif. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Tratamentul cancerului prin radioterapie de precizie — bogat în tehnologie, exigent și colaborativ. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"cognitive_empathy":[80,2],"emotional_resilience":[85,2],"incremental_progress_tolerance":[90,3],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"observation":[85,2],"patience":[85,2],"precision":[95,3],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Rheumatology","category":"Medical","descriptions":{"en":"Autoimmune and joint disease — intellectual, longitudinal, and methodical.","fr":"Maladies auto-immunes et articulaires — intellectuel, longitudinal et méthodique.","ro":"Boli autoimune și articulare — intelectual, longitudinal și metodic."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Autoimmune and joint disease — intellectual, longitudinal, and methodical. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Maladies auto-immunes et articulaires — intellectuel, longitudinal et méthodique. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Boli autoimune și articulare — intelectual, longitudinal și metodic. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"ambiguity_tolerance":[90,3],"cognitive_empathy":[80,2],"complex_problem_solving":[90,3],"frustration_tolerance":[95,3],"incremental_progress_tolerance":[90,3],"logical_reasoning":[85,2],"long_term_orientation":[90,2],"long_term_patient_relationship":[90,3],"patience":[85,2],"patient_involvement":[65,1],"scientific_curiosity":[85,2]}},{"name":"Cardiovascular Surgery","category":"Surgical","descriptions":{"en":"High-stakes operative work on the heart and great vessels — decisive, precise, and intense.","fr":"Chirurgie à haut risque du cœur et des gros vaisseaux — décisif, précis et intense.","ro":"Chirurgie de mare risc pe inimă și vase mari — decisiv, precis și intens."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: High-stakes operative work on the heart and great vessels — decisive, precise, and intense. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Chirurgie à haut risque du cœur et des gros vaisseaux — décisif, précis et intense. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Chirurgie de mare risc pe inimă și vase mari — decisiv, precis și intens. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[90,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"leadership":[90,3],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"physical_endurance":[95,3],"practical_orientation":[85,2],"precision":[95,3],"rapid_results_preference":[75,1],"stress_resistance":[95,3]}},{"name":"General Surgery","category":"Surgical","descriptions":{"en":"Broad operative practice spanning abdomen and trauma — varied, action-driven, and team-based.","fr":"Pratique chirurgicale large, abdomen et traumatisme — variée, orientée action et en équipe.","ro":"Practică chirurgicală largă, abdomen și traumatism — variată, orientată spre acțiune și în echipă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Broad operative practice spanning abdomen and trauma — varied, action-driven, and team-based. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Pratique chirurgicale large, abdomen et traumatisme — variée, orientée action et en équipe. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Practică chirurgicală largă, abdomen și traumatism — variată, orientată spre acțiune și în echipă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[90,2],"breadth_orientation":[85,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"physical_endurance":[95,3],"practical_orientation":[85,2],"precision":[85,3],"rapid_results_preference":[75,1],"stress_resistance":[95,3]}},{"name":"Oral and Maxillofacial Surgery","category":"Surgical","descriptions":{"en":"Surgery of the face, jaws and mouth blending operative craft with structural precision.","fr":"Chirurgie du visage, des mâchoires et de la bouche — artisanat opératoire avec précision structurelle.","ro":"Chirurgia feței, maxilarelor și gurii — meșteșug operator cu precizie structurală."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Surgery of the face, jaws and mouth blending operative craft with structural precision. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Chirurgie du visage, des mâchoires et de la bouche — artisanat opératoire avec précision structurelle. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Chirurgia feței, maxilarelor și gurii — meșteșug operator cu precizie structurală. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"creativity":[80,2],"decisiveness":[80,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"practical_orientation":[85,2],"precision":[85,3],"spatial_orientation":[95,3],"stress_resistance":[80,2],"visual_reasoning":[90,3]}},{"name":"Pediatric Surgery","category":"Surgical","descriptions":{"en":"Operative care for infants and children — meticulous, compassionate, and collaborative.","fr":"Chirurgie des nourrissons et des enfants — minutieuse, compatissante et collaborative.","ro":"Chirurgie pentru sugari și copii — meticuloasă, compătimitoare și colaborativă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Operative care for infants and children — meticulous, compassionate, and collaborative. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Chirurgie des nourrissons et des enfants — minutieuse, compatissante et collaborative. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Chirurgie pentru sugari și copii — meticuloasă, compătimitoare și colaborativă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[85,2],"affective_empathy":[90,3],"communication":[85,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"family_interaction":[90,3],"interruption_tolerance":[90,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"practical_orientation":[85,2],"precision":[85,3],"rapid_results_preference":[75,1],"stress_resistance":[95,3],"warmth":[90,3]}},{"name":"Plastic, Aesthetic and Reconstructive Microsurgery","category":"Surgical","descriptions":{"en":"Restoring form and function through fine technique — creative, detailed, and autonomous.","fr":"Restauration de la forme et de la fonction par technique fine — créative, détaillée et autonome.","ro":"Restabilirea formei și funcției prin tehnică fină — creativă, detaliată și autonomă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Restoring form and function through fine technique — creative, detailed, and autonomous. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Restauration de la forme et de la fonction par technique fine — créative, détaillée et autonome. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Restabilirea formei și funcției prin tehnică fină — creativă, detaliată și autonomă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"creativity":[95,3],"decisiveness":[80,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"perfectionism":[90,3],"practical_orientation":[85,2],"precision":[95,3],"stress_resistance":[80,2],"visual_reasoning":[95,3]}},{"name":"Thoracic Surgery","category":"Surgical","descriptions":{"en":"Surgery of the chest, lungs and mediastinum — composed under pressure and technically demanding.","fr":"Chirurgie du thorax, des poumons et du médiastin — calme sous pression et techniquement exigeante.","ro":"Chirurgia toracelui, plămânilor și mediastinului — calmă sub presiune și tehnic exigentă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Surgery of the chest, lungs and mediastinum — composed under pressure and technically demanding. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Chirurgie du thorax, des poumons et du médiastin — calme sous pression et techniquement exigeante. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Chirurgia toracelui, plămânilor și mediastinului — calmă sub presiune și tehnic exigentă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[90,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"observation":[85,2],"practical_orientation":[85,2],"precision":[90,3],"rapid_results_preference":[75,1],"stress_resistance":[95,3],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Vascular Surgery","category":"Surgical","descriptions":{"en":"Operative and endovascular care of blood vessels — varied, hands-on, and decisive.","fr":"Chirurgie opératoire et endovasculaire des vaisseaux — variée, pratique et décisive.","ro":"Chirurgie operatorie și endovasculară a vaselor de sânge — variată, practică și decisivă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Operative and endovascular care of blood vessels — varied, hands-on, and decisive. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Chirurgie opératoire et endovasculaire des vaisseaux — variée, pratique et décisive. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Chirurgie operatorie și endovasculară a vaselor de sânge — variată, practică și decisivă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[90,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"practical_orientation":[85,2],"precision":[95,3],"rapid_results_preference":[75,1],"spatial_orientation":[90,3],"stress_resistance":[95,3]}},{"name":"Neurosurgery","category":"Surgical","descriptions":{"en":"Surgery of the brain and spine — the pinnacle of precision, composure, and intellectual rigor.","fr":"Chirurgie du cerveau et de la colonne — le sommet de la précision, du calme et de la rigueur intellectuelle.","ro":"Chirurgia creierului și a coloanei — culmea preciziei, calmului și rigoarei intelectuale."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Surgery of the brain and spine — the pinnacle of precision, composure, and intellectual rigor. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Chirurgie du cerveau et de la colonne — le sommet de la précision, du calme et de la rigueur intellectuelle. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Chirurgia creierului și a coloanei — culmea preciziei, calmului și rigoarei intelectuale. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[90,2],"complex_problem_solving":[95,3],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"physical_endurance":[95,3],"practical_orientation":[85,2],"precision":[100,3],"rapid_results_preference":[75,1],"stress_resistance":[95,3],"sustained_concentration":[100,3]}},{"name":"Obstetrics and Gynecology","category":"Surgical","descriptions":{"en":"Care of women across pregnancy, fertility and surgery — relational, procedural, and varied.","fr":"Soins aux femmes pendant la grossesse, la fertilité et la chirurgie — relationnel, procédural et varié.","ro":"Îngrijirea femeilor în sarcină, fertilitate și chirurgie — relațională, procedurală și variată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Care of women across pregnancy, fertility and surgery — relational, procedural, and varied. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins aux femmes pendant la grossesse, la fertilité et la chirurgie — relationnel, procédural et varié. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijirea femeilor în sarcină, fertilitate și chirurgie — relațională, procedurală și variată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[95,3],"care_motivation":[85,2],"communication":[85,2],"crisis_calmness":[95,3],"decisiveness":[90,3],"interruption_tolerance":[90,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"multitasking":[90,3],"people_interest":[90,2],"practical_orientation":[85,2],"precision":[85,3],"rapid_results_preference":[75,1],"social_energy":[80,2],"stress_resistance":[95,3]}},{"name":"Ophthalmology","category":"Surgical","descriptions":{"en":"Microsurgical care of the eye — precise, tech-rich, and often independently practiced.","fr":"Soins microchirurgicaux de l'œil — précis, riche en technologie et souvent indépendant.","ro":"Îngrijire microchirurgicală a ochiului — precisă, bogată în tehnologie și adesea independentă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Microsurgical care of the eye — precise, tech-rich, and often independently practiced. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins microchirurgicaux de l'œil — précis, riche en technologie et souvent indépendant. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire microchirurgicală a ochiului — precisă, bogată în tehnologie și adesea independentă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"decisiveness":[80,2],"long_hours_tolerance":[80,2],"manual_dexterity":[100,3],"manual_orientation":[90,3],"observation":[85,2],"practical_orientation":[85,2],"precision":[100,3],"stress_resistance":[80,2],"sustained_concentration":[95,3],"technical_orientation":[90,3],"technology_interest":[90,3],"visual_reasoning":[95,3]}},{"name":"Pediatric Orthopedics","category":"Pediatric","descriptions":{"en":"Musculoskeletal care for growing children — hands-on, gentle, and collaborative.","fr":"Soins musculosquelettiques pour enfants en croissance — pratique, doux et collaboratif.","ro":"Îngrijire musculoscheletală pentru copii în creștere — practică, blândă și colaborativă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Musculoskeletal care for growing children — hands-on, gentle, and collaborative. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins musculosquelettiques pour enfants en croissance — pratique, doux et collaboratif. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire musculoscheletală pentru copii în creștere — practică, blândă și colaborativă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[85,2],"affective_empathy":[90,3],"communication":[85,2],"decisiveness":[80,2],"family_interaction":[90,3],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"mechanical_aptitude":[90,3],"practical_orientation":[85,2],"precision":[85,3],"spatial_orientation":[90,3],"stress_resistance":[80,2],"warmth":[90,3]}},{"name":"Orthopedics and Traumatology","category":"Surgical","descriptions":{"en":"Bones, joints and trauma — physical, hands-on, and results-driven.","fr":"Os, articulations et traumatisme — physique, pratique et orienté résultats.","ro":"Oase, articulații și traumatism — fizic, practic și orientat spre rezultate."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Bones, joints and trauma — physical, hands-on, and results-driven. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Os, articulations et traumatisme — physique, pratique et orienté résultats. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Oase, articulații și traumatism — fizic, practic și orientat spre rezultate. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[95,3],"decisiveness":[80,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"mechanical_aptitude":[95,3],"physical_endurance":[95,3],"practical_orientation":[85,2],"precision":[85,3],"spatial_orientation":[95,3],"stress_resistance":[80,2]}},{"name":"Otorhinolaryngology (ENT)","category":"Surgical","descriptions":{"en":"Surgical and medical care of the ear, nose and throat — varied and people-facing.","fr":"Soins chirurgicaux et médicaux de l'oreille, du nez et de la gorge — variés et orientés vers les gens.","ro":"Îngrijire chirurgicală și medicală a urechii, nasului și gâtului — variată și orientată spre oameni."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Surgical and medical care of the ear, nose and throat — varied and people-facing. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins chirurgicaux et médicaux de l'oreille, du nez et de la gorge — variés et orientés vers les gens. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire chirurgicală și medicală a urechii, nasului și gâtului — variată și orientată spre oameni. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"complex_problem_solving":[85,2],"decisiveness":[80,2],"detail_orientation":[90,3],"logical_reasoning":[90,3],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"observation":[90,3],"practical_orientation":[85,2],"precision":[85,3],"stress_resistance":[80,2],"technical_orientation":[85,2],"visual_reasoning":[90,2]}},{"name":"Urology","category":"Surgical","descriptions":{"en":"Surgical and medical care of the urinary tract — procedural, tech-forward, and balanced.","fr":"Soins chirurgicaux et médicaux du tractus urinaire — procédural, technologique et équilibré.","ro":"Îngrijire chirurgicală și medicală a tractului urinar — procedurală, orientată spre tehnologie și echilibrată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Surgical and medical care of the urinary tract — procedural, tech-forward, and balanced. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Soins chirurgicaux et médicaux du tractus urinaire — procédural, technologique et équilibré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Îngrijire chirurgicală și medicală a tractului urinar — procedurală, orientată spre tehnologie și echilibrată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"action_orientation":[85,2],"adaptability":[80,2],"decisiveness":[80,2],"long_hours_tolerance":[80,2],"manual_dexterity":[90,3],"manual_orientation":[90,3],"observation":[85,2],"patient_involvement":[70,1],"practical_orientation":[85,2],"precision":[90,3],"stress_resistance":[80,2],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Pathology","category":"Diagnostic & Support","descriptions":{"en":"Diagnosis through tissue and cells — autonomous, precise, and quietly intellectual.","fr":"Diagnostic par tissus et cellules — autonome, précis et discrètement intellectuel.","ro":"Diagnostic prin țesut și celule — autonom, precis și liniștit intelectual."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Diagnosis through tissue and cells — autonomous, precise, and quietly intellectual. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Diagnostic par tissus et cellules — autonome, précis et discrètement intellectuel. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Diagnostic prin țesut și celule — autonom, precis și liniștit intelectual. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"basic_science_interest":[90,3],"complex_problem_solving":[85,2],"detail_orientation":[90,3],"logical_reasoning":[90,3],"observation":[90,3],"patient_involvement":[20,2],"precision":[95,3],"research_interest":[80,2],"social_energy":[40,1],"sustained_concentration":[90,3],"visual_reasoning":[95,3]}},{"name":"Epidemiology","category":"Public & Preventive","descriptions":{"en":"Patterns of disease in populations — data-driven, analytical, and independent.","fr":"Schémas de maladie dans les populations — axé sur les données, analytique et indépendant.","ro":"Tipare de boală în populații — condus de date, analitic și independent."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Patterns of disease in populations — data-driven, analytical, and independent. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Schémas de maladie dans les populations — axé sur les données, analytique et indépendant. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Tipare de boală în populații — condus de date, analitic și independent. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"breadth_orientation":[85,2],"logical_reasoning":[85,2],"organization":[85,2],"patient_involvement":[30,1],"quantitative_reasoning":[95,3],"research_interest":[95,3]}},{"name":"Hygiene","category":"Public & Preventive","descriptions":{"en":"Prevention and public health standards — structured, autonomous, and balanced.","fr":"Prévention et normes de santé publique — structuré, autonome et équilibré.","ro":"Prevenție și standarde de sănătate publică — structurată, autonomă și echilibrată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Prevention and public health standards — structured, autonomous, and balanced. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Prévention et normes de santé publique — structuré, autonome et équilibré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Prevenție și standarde de sănătate publică — structurată, autonomă și echilibrată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"breadth_orientation":[85,2],"logical_reasoning":[85,2],"organization":[90,3],"patient_involvement":[30,1],"quantitative_reasoning":[85,3],"structure_preference":[85,2]}},{"name":"Laboratory Medicine","category":"Diagnostic & Support","descriptions":{"en":"Diagnostic testing and lab science — precise, tech-enabled, and lifestyle-friendly.","fr":"Tests diagnostiques et science de laboratoire — précis, technologique et équilibré.","ro":"Testare diagnostică și știință de laborator — precisă, tehnologică și echilibrată."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Diagnostic testing and lab science — precise, tech-enabled, and lifestyle-friendly. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Tests diagnostiques et science de laboratoire — précis, technologique et équilibré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Testare diagnostică și știință de laborator — precisă, tehnologică și echilibrată. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"basic_science_interest":[90,3],"patient_involvement":[30,1],"precision":[95,3],"research_interest":[80,2],"social_energy":[40,1],"sustained_concentration":[90,3],"technology_interest":[85,2]}},{"name":"Forensic Medicine","category":"Diagnostic & Support","descriptions":{"en":"Medical-legal investigation — exacting, composed, and independent-minded.","fr":"Investigation médico-légale — exigeante, calme et indépendante.","ro":"Investigație medico-legală — exigentă, calmă și independentă."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Medical-legal investigation — exacting, composed, and independent-minded. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Investigation médico-légale — exigeante, calme et indépendante. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Investigație medico-legală — exigentă, calmă și independentă. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"complex_problem_solving":[85,2],"detail_orientation":[90,3],"emotional_resilience":[90,3],"logical_reasoning":[90,3],"mortality_tolerance":[95,3],"objectivity":[100,3],"observation":[90,3],"precision":[95,3]}},{"name":"Nuclear Medicine","category":"Diagnostic & Support","descriptions":{"en":"Imaging and targeted radionuclide therapy — technology-rich and analytical.","fr":"Imagerie et thérapie radionucléique ciblée — riche en technologie et analytique.","ro":"Imagistică și terapie radionuclidică țintită — bogată în tehnologie și analitică."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Imaging and targeted radionuclide therapy — technology-rich and analytical. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Imagerie et thérapie radionucléique ciblée — riche en technologie et analytique. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Imagistică și terapie radionuclidică țintită — bogată în tehnologie și analitică. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"basic_science_interest":[95,3],"observation":[85,2],"precision":[90,3],"quantitative_reasoning":[85,2],"technical_orientation":[90,3],"technology_interest":[90,3]}},{"name":"Medical Microbiology","category":"Diagnostic & Support","descriptions":{"en":"Identification of microbes and infection — rigorous, independent, and lab-based.","fr":"Identification des microbes et des infections — rigoureuse, indépendante et de laboratoire.","ro":"Identificarea microbilor și a infecției — riguroasă, independentă și de laborator."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Identification of microbes and infection — rigorous, independent, and lab-based. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Identification des microbes et des infections — rigoureuse, indépendante et de laboratoire. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Identificarea microbilor și a infecției — riguroasă, independentă și de laborator. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"basic_science_interest":[90,3],"patient_involvement":[30,1],"precision":[95,3],"research_interest":[90,2],"scientific_curiosity":[95,3],"social_energy":[40,1],"sustained_concentration":[90,3]}},{"name":"Radiology and Medical Imaging","category":"Diagnostic & Support","descriptions":{"en":"Diagnosis through imaging — tech-forward, autonomous, and lifestyle-friendly.","fr":"Diagnostic par imagerie — technologique, autonome et équilibré.","ro":"Diagnostic prin imagistică — orientat spre tehnologie, autonom și echilibrat."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Diagnosis through imaging — tech-forward, autonomous, and lifestyle-friendly. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Diagnostic par imagerie — technologique, autonome et équilibré. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Diagnostic prin imagistică — orientat spre tehnologie, autonom și echilibrat. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"complex_problem_solving":[85,2],"detail_orientation":[90,3],"logical_reasoning":[90,3],"observation":[90,3],"patient_involvement":[40,1],"precision":[90,3],"spatial_orientation":[95,3],"technical_orientation":[90,3],"technology_interest":[90,3],"visual_reasoning":[100,3]}},{"name":"Public Health and Healthcare Management","category":"Public & Preventive","descriptions":{"en":"Population health and system leadership — strategic, people-oriented, and broad.","fr":"Santé des populations et direction des systèmes — stratégique, orienté vers les gens et large.","ro":"Sănătate populațională și conducere de sistem — strategic, orientat spre oameni și larg."},"clinical_summaries":{"en":"Initial clinical summary, not yet clinically reviewed: Population health and system leadership — strategic, people-oriented, and broad. An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.","fr":"Résumé clinique initial, pas encore validé cliniquement : Santé des populations et direction des systèmes — stratégique, orienté vers les gens et large. Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.","ro":"Rezumat clinic inițial, care nu a fost încă validat clinic: Sănătate populațională și conducere de sistem — strategic, orientat spre oameni și larg. Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic."},"profile":{"breadth_orientation":[90,2],"coordination":[95,3],"leadership":[90,3],"logical_reasoning":[85,2],"organization":[95,3],"patient_involvement":[30,1],"quantitative_reasoning":[85,3]}}],"traits":[{"code":"academic_orientation","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"achievement_orientation","dimension":"lifestyle","measurement_source":"question_and_value","warning":null},{"code":"action_orientation","dimension":"working","measurement_source":"question","warning":null},{"code":"adaptability","dimension":"working","measurement_source":"question","warning":null},{"code":"affective_empathy","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"ambiguity_tolerance","dimension":"thinking","measurement_source":"question","warning":null},{"code":"basic_science_interest","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"breadth_orientation","dimension":"thinking","measurement_source":"question","warning":null},{"code":"calmness","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"care_coordination","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"care_motivation","dimension":"interpersonal","measurement_source":"question_and_value","warning":null},{"code":"causal_reasoning","dimension":"thinking","measurement_source":"question","warning":null},{"code":"challenge_seeking","dimension":"technical","measurement_source":"question","warning":null},{"code":"cognitive_empathy","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"cognitive_flexibility","dimension":"thinking","measurement_source":"question","warning":null},{"code":"communication","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"complex_problem_solving","dimension":"thinking","measurement_source":"question","warning":null},{"code":"control_preference","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"coordination","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"creativity","dimension":"thinking","measurement_source":"question_and_value","warning":null},{"code":"crisis_calmness","dimension":"technical","measurement_source":"question","warning":null},{"code":"curative_orientation","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"decisiveness","dimension":"technical","measurement_source":"question_and_value","warning":null},{"code":"deliberation","dimension":"working","measurement_source":"question","warning":null},{"code":"detail_orientation","dimension":"thinking","measurement_source":"question","warning":null},{"code":"drive","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"emotional_resilience","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"energy","dimension":"technical","measurement_source":"question","warning":null},{"code":"expertise_motivation","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"external_validation","dimension":"lifestyle","measurement_source":"question_and_value","warning":null},{"code":"failure_tolerance","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"family_interaction","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"flexibility","dimension":"working","measurement_source":"question","warning":null},{"code":"frustration_tolerance","dimension":"working","measurement_source":"question","warning":null},{"code":"harmony_preference","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"helping_motivation","dimension":"interpersonal","measurement_source":"question_and_value","warning":null},{"code":"income_priority","dimension":"lifestyle","measurement_source":"question_and_value","warning":null},{"code":"incremental_progress_tolerance","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"independence","dimension":"lifestyle","measurement_source":"question_and_value","warning":null},{"code":"initiative","dimension":"working","measurement_source":"question","warning":null},{"code":"intellectual_orientation","dimension":"thinking","measurement_source":"question_and_value","warning":null},{"code":"interpersonal_boundaries","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"interruption_tolerance","dimension":"working","measurement_source":"question","warning":null},{"code":"leadership","dimension":"working","measurement_source":"question_and_value","warning":null},{"code":"lifestyle_priority","dimension":"lifestyle","measurement_source":"question_and_value","warning":null},{"code":"listening","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"logical_reasoning","dimension":"thinking","measurement_source":"question","warning":null},{"code":"long_hours_tolerance","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"long_term_orientation","dimension":"working","measurement_source":"question","warning":null},{"code":"long_term_patient_relationship","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"manual_dexterity","dimension":"technical","measurement_source":"question","warning":null},{"code":"manual_orientation","dimension":"technical","measurement_source":"value_only","warning":"Only created when the Manual/hands-on activity value is selected; it is not measured for the full cohort."},{"code":"mechanical_aptitude","dimension":"technical","measurement_source":"question","warning":null},{"code":"mortality_tolerance","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"multitasking","dimension":"technical","measurement_source":"question","warning":null},{"code":"novelty_seeking","dimension":"working","measurement_source":"question_and_value","warning":null},{"code":"objectivity","dimension":"thinking","measurement_source":"question","warning":null},{"code":"observation","dimension":"technical","measurement_source":"question","warning":null},{"code":"optimism","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"organization","dimension":"working","measurement_source":"question","warning":null},{"code":"outside_interests","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"patience","dimension":"working","measurement_source":"question","warning":null},{"code":"patient_involvement","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"people_interest","dimension":"interpersonal","measurement_source":"question_and_value","warning":null},{"code":"perfectionism","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"persistence","dimension":"working","measurement_source":"question","warning":null},{"code":"physical_endurance","dimension":"technical","measurement_source":"question","warning":null},{"code":"practical_orientation","dimension":"technical","measurement_source":"question_and_value","warning":null},{"code":"precision","dimension":"thinking","measurement_source":"question","warning":null},{"code":"prestige_priority","dimension":"lifestyle","measurement_source":"value_only","warning":null},{"code":"prevention_orientation","dimension":"lifestyle","measurement_source":"unmeasured","warning":"Not produced by any current question or selected value; its profile value is locked until the model is corrected and versioned."},{"code":"professional_identity","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"quantitative_reasoning","dimension":"thinking","measurement_source":"question","warning":null},{"code":"rapid_feedback_preference","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"rapid_results_preference","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"research_interest","dimension":"working","measurement_source":"question","warning":null},{"code":"risk_tolerance","dimension":"technical","measurement_source":"question","warning":null},{"code":"routine_tolerance","dimension":"working","measurement_source":"question","warning":null},{"code":"scientific_curiosity","dimension":"thinking","measurement_source":"question_and_value","warning":null},{"code":"security_priority","dimension":"lifestyle","measurement_source":"value_only","warning":null},{"code":"self_confidence","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"short_term_patient_contact","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"social_energy","dimension":"interpersonal","measurement_source":"question_and_value","warning":null},{"code":"spatial_orientation","dimension":"thinking","measurement_source":"question","warning":null},{"code":"specialization_preference","dimension":"thinking","measurement_source":"question","warning":null},{"code":"stress_resistance","dimension":"technical","measurement_source":"question","warning":null},{"code":"structure_preference","dimension":"working","measurement_source":"question","warning":null},{"code":"sustained_concentration","dimension":"thinking","measurement_source":"question","warning":null},{"code":"teaching_interest","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"teamwork","dimension":"interpersonal","measurement_source":"question","warning":null},{"code":"technical_orientation","dimension":"technical","measurement_source":"question","warning":null},{"code":"technology_interest","dimension":"technical","measurement_source":"question","warning":null},{"code":"theoretical_orientation","dimension":"thinking","measurement_source":"question","warning":null},{"code":"tolerance_of_others","dimension":"lifestyle","measurement_source":"question","warning":null},{"code":"visual_reasoning","dimension":"thinking","measurement_source":"question","warning":null},{"code":"warmth","dimension":"interpersonal","measurement_source":"question","warning":null}]}
$specialty_catalog_seed$::jsonb);

INSERT INTO private.trait_catalog (
  code,
  dimension,
  measurement_source,
  warning
)
SELECT
  trait.code,
  trait.dimension,
  trait.measurement_source,
  trait.warning
FROM specialty_catalog_seed_payload AS seed
CROSS JOIN LATERAL jsonb_to_recordset(seed.payload -> 'traits') AS trait(
  code text,
  dimension text,
  measurement_source text,
  warning text
);

INSERT INTO private.specialty_catalog_versions (
  label,
  status,
  lock_version,
  parent_version_id,
  note,
  created_by,
  published_by,
  published_at,
  checksum
)
VALUES (
  'medical-specialties-v1',
  'active',
  1,
  NULL,
  'Initial catalog snapshot generated from the versioned TypeScript model.',
  NULL,
  NULL,
  now(),
  'md5:00000000000000000000000000000000'
);

INSERT INTO private.specialty_catalog_entries (
  version_id,
  name,
  category,
  descriptions,
  clinical_summaries,
  profile,
  updated_by
)
SELECT
  version.id,
  entry.name,
  entry.category,
  entry.descriptions,
  entry.clinical_summaries,
  entry.profile,
  NULL
FROM specialty_catalog_seed_payload AS seed
CROSS JOIN LATERAL jsonb_to_recordset(seed.payload -> 'entries') AS entry(
  name text,
  category text,
  descriptions jsonb,
  clinical_summaries jsonb,
  profile jsonb
)
CROSS JOIN private.specialty_catalog_versions AS version
WHERE version.status = 'active';

UPDATE private.specialty_catalog_versions AS version
SET checksum = private.specialty_catalog_content_hash(version.id)
WHERE version.status = 'active';

INSERT INTO private.specialty_catalog_audit (
  actor_user_id,
  actor_role,
  action,
  version_id,
  version_revision,
  note,
  after_value
)
SELECT
  NULL,
  'system',
  'seeded',
  version.id,
  version.revision,
  version.note,
  private.specialty_catalog_payload(version.id, true)
FROM private.specialty_catalog_versions AS version
WHERE version.status = 'active';

CREATE OR REPLACE FUNCTION public.current_user_portal_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_build_object(
        'authorized', true,
        'display_name', researcher.display_name,
        'role', researcher.portal_role,
        'can_view_research', true,
        'can_edit', researcher.portal_role IN ('doctor', 'professor'),
        'can_publish', researcher.portal_role = 'professor',
        'can_edit_catalog', researcher.portal_role IN ('doctor', 'professor'),
        'can_publish_catalog', researcher.portal_role = 'professor'
      )
      FROM private.researchers AS researcher
      WHERE researcher.user_id = (SELECT auth.uid())
        AND researcher.enabled
      LIMIT 1
    ),
    jsonb_build_object(
      'authorized', false,
      'display_name', NULL,
      'role', NULL,
      'can_view_research', false,
      'can_edit', false,
      'can_publish', false,
      'can_edit_catalog', false,
      'can_publish_catalog', false
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_active_specialty_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.specialty_catalog_payload(version.id, false)
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_specialty_catalog_draft()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_id uuid;
BEGIN
  PERFORM private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  SELECT version.id INTO selected_id
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'draft'
  LIMIT 1;
  IF selected_id IS NULL THEN
    SELECT version.id INTO selected_id
    FROM private.specialty_catalog_versions AS version
    WHERE version.status = 'active'
    LIMIT 1;
  END IF;
  IF selected_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN private.specialty_catalog_editor_payload(selected_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_specialty_catalog_entry_draft(
  p_expected_version_id uuid,
  p_expected_lock_version bigint,
  p_specialty_name text,
  p_descriptions jsonb,
  p_clinical_summaries jsonb,
  p_profile jsonb,
  p_change_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  actor_role text;
  active_version private.specialty_catalog_versions%ROWTYPE;
  draft_version private.specialty_catalog_versions%ROWTYPE;
  old_entry private.specialty_catalog_entries%ROWTYPE;
  new_entry private.specialty_catalog_entries%ROWTYPE;
BEGIN
  actor_role := private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  IF private.valid_change_note(p_change_note) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A change note between 3 and 1000 characters is required';
  END IF;
  IF p_expected_version_id IS NULL
     OR p_expected_lock_version IS NULL
     OR p_expected_lock_version < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Expected version id and lock version are required';
  END IF;

  SELECT version.* INTO draft_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'draft'
  FOR UPDATE;

  IF draft_version.id IS NULL THEN
    SELECT version.* INTO active_version
    FROM private.specialty_catalog_versions AS version
    WHERE version.status = 'active'
    FOR UPDATE;

    IF active_version.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'No active specialty catalog exists';
    END IF;
    IF active_version.id <> p_expected_version_id
       OR active_version.lock_version <> p_expected_lock_version THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'The active catalog changed; reload before editing';
    END IF;

    INSERT INTO private.specialty_catalog_versions (
      label,
      status,
      lock_version,
      parent_version_id,
      note,
      created_by
    ) VALUES (
      'draft-from-r' || active_version.revision::text,
      'draft',
      1,
      active_version.id,
      p_change_note,
      actor_id
    )
    RETURNING * INTO draft_version;

    INSERT INTO private.specialty_catalog_entries (
      version_id,
      name,
      category,
      descriptions,
      clinical_summaries,
      profile,
      updated_by,
      updated_at
    )
    SELECT
      draft_version.id,
      entry.name,
      entry.category,
      entry.descriptions,
      entry.clinical_summaries,
      entry.profile,
      actor_id,
      now()
    FROM private.specialty_catalog_entries AS entry
    WHERE entry.version_id = active_version.id;

    INSERT INTO private.specialty_catalog_audit (
      actor_user_id, actor_role, action, version_id, version_revision, note, after_value
    ) VALUES (
      actor_id,
      actor_role,
      'draft_created',
      draft_version.id,
      draft_version.revision,
      p_change_note,
      jsonb_build_object('parent_version_id', active_version.id, 'parent_revision', active_version.revision)
    );
  ELSIF draft_version.id <> p_expected_version_id
     OR draft_version.lock_version <> p_expected_lock_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'The draft changed; reload before saving';
  END IF;

  SELECT entry.* INTO old_entry
  FROM private.specialty_catalog_entries AS entry
  WHERE entry.version_id = draft_version.id
    AND entry.name = p_specialty_name
  FOR UPDATE;

  IF old_entry.name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Unknown specialty in this draft';
  END IF;
  IF private.valid_specialty_catalog_entry(
    old_entry.name,
    old_entry.category,
    p_descriptions,
    p_clinical_summaries,
    p_profile
  ) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid specialty catalog entry';
  END IF;
  IF (old_entry.profile -> 'prevention_orientation')
     IS DISTINCT FROM (p_profile -> 'prevention_orientation') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'prevention_orientation is unmeasured and cannot be changed';
  END IF;

  UPDATE private.specialty_catalog_entries AS entry
  SET descriptions = p_descriptions,
      clinical_summaries = p_clinical_summaries,
      profile = p_profile
  WHERE entry.version_id = draft_version.id
    AND entry.name = old_entry.name
  RETURNING entry.* INTO new_entry;

  UPDATE private.specialty_catalog_versions AS version
  SET lock_version = version.lock_version + 1,
      note = btrim(p_change_note)
  WHERE version.id = draft_version.id
  RETURNING version.* INTO draft_version;

  INSERT INTO private.specialty_catalog_audit (
    actor_user_id,
    actor_role,
    action,
    version_id,
    version_revision,
    specialty_name,
    note,
    before_value,
    after_value
  ) VALUES (
    actor_id,
    actor_role,
    'entry_updated',
    draft_version.id,
    draft_version.revision,
    old_entry.name,
    btrim(p_change_note),
    to_jsonb(old_entry) - 'version_id' - 'updated_by' - 'updated_at',
    to_jsonb(new_entry) - 'version_id' - 'updated_by' - 'updated_at'
  );

  RETURN private.specialty_catalog_editor_payload(draft_version.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_specialty_catalog_draft(
  p_draft_version_id uuid,
  p_expected_lock_version bigint,
  p_change_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  actor_role text;
  active_version private.specialty_catalog_versions%ROWTYPE;
  draft_version private.specialty_catalog_versions%ROWTYPE;
  resolved_checksum text;
  expected_count integer;
  actual_count integer;
BEGIN
  actor_role := private.require_portal_role(ARRAY['professor']::text[]);
  IF private.valid_change_note(p_change_note) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A publication note between 3 and 1000 characters is required';
  END IF;

  SELECT version.* INTO draft_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'draft'
  FOR UPDATE;

  IF draft_version.id IS NULL OR draft_version.id <> p_draft_version_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No specialty catalog draft exists';
  END IF;
  IF draft_version.lock_version <> p_expected_lock_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'The draft changed; reload before publishing';
  END IF;

  SELECT cardinality(private.specialty_catalog_v1()) INTO expected_count;
  SELECT count(*) INTO actual_count
  FROM private.specialty_catalog_entries AS entry
  WHERE entry.version_id = draft_version.id;

  IF actual_count <> expected_count
     OR EXISTS (
       SELECT expected.name
       FROM unnest(private.specialty_catalog_v1()) AS expected(name)
       EXCEPT
       SELECT entry.name
       FROM private.specialty_catalog_entries AS entry
       WHERE entry.version_id = draft_version.id
     )
     OR EXISTS (
       SELECT entry.name
       FROM private.specialty_catalog_entries AS entry
       WHERE entry.version_id = draft_version.id
       EXCEPT
       SELECT expected.name
       FROM unnest(private.specialty_catalog_v1()) AS expected(name)
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'The draft must contain the exact 58-specialty catalog';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.specialty_catalog_entries AS entry
    WHERE entry.version_id = draft_version.id
      AND private.valid_specialty_catalog_entry(
        entry.name,
        entry.category,
        entry.descriptions,
        entry.clinical_summaries,
        entry.profile
      ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'The draft contains an invalid specialty entry';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.specialty_catalog_entries AS draft_entry
    JOIN private.specialty_catalog_entries AS parent_entry
      ON parent_entry.version_id = draft_version.parent_version_id
     AND parent_entry.name = draft_entry.name
    WHERE draft_entry.version_id = draft_version.id
      AND (draft_entry.profile -> 'prevention_orientation')
          IS DISTINCT FROM (parent_entry.profile -> 'prevention_orientation')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'prevention_orientation is unmeasured and cannot be changed';
  END IF;

  resolved_checksum := private.specialty_catalog_content_hash(draft_version.id);

  SELECT version.* INTO active_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'active'
  FOR UPDATE;

  IF active_version.id IS NOT NULL THEN
    UPDATE private.specialty_catalog_versions AS version
    SET status = 'archived'
    WHERE version.id = active_version.id;
  END IF;

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'active',
      label = 'medical-specialties-r' || version.revision::text,
      lock_version = version.lock_version + 1,
      note = btrim(p_change_note),
      published_by = actor_id,
      published_at = now(),
      checksum = resolved_checksum
  WHERE version.id = draft_version.id
  RETURNING version.* INTO draft_version;

  INSERT INTO private.specialty_catalog_audit (
    actor_user_id,
    actor_role,
    action,
    version_id,
    version_revision,
    note,
    before_value,
    after_value
  ) VALUES (
    actor_id,
    actor_role,
    'published',
    draft_version.id,
    draft_version.revision,
    btrim(p_change_note),
    CASE WHEN active_version.id IS NULL THEN NULL ELSE jsonb_build_object(
      'active_version_id', active_version.id,
      'active_revision', active_version.revision
    ) END,
    jsonb_build_object(
      'active_version_id', draft_version.id,
      'active_revision', draft_version.revision,
      'content_hash', resolved_checksum
    )
  );

  RETURN private.specialty_catalog_payload(draft_version.id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_specialty_catalog_versions(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_portal_role(ARRAY['doctor', 'professor']::text[]);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Version history limit must be between 1 and 200';
  END IF;
  RETURN jsonb_build_object(
    'versions', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', version.id,
            'version_number', version.revision,
            'revision', version.revision,
            'label', version.label,
            'status', version.status,
            'lock_version', version.lock_version,
            'parent_version_id', version.parent_version_id,
            'change_note', version.note,
            'created_at', version.created_at,
            'published_at', version.published_at,
            'actor_display_name', coalesce(creator.display_name, 'System'),
            'checksum', coalesce(
              version.checksum,
              private.specialty_catalog_content_hash(version.id)
            )
          ) ORDER BY version.revision DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT candidate.*
        FROM private.specialty_catalog_versions AS candidate
        ORDER BY candidate.revision DESC
        LIMIT p_limit
      ) AS version
      LEFT JOIN private.researchers AS creator
        ON creator.user_id = version.created_by
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_specialty_catalog_version(
  p_source_version_id uuid,
  p_expected_active_version_id uuid,
  p_change_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  actor_role text;
  active_version private.specialty_catalog_versions%ROWTYPE;
  source_version private.specialty_catalog_versions%ROWTYPE;
  restored_version private.specialty_catalog_versions%ROWTYPE;
  resolved_checksum text;
BEGIN
  actor_role := private.require_portal_role(ARRAY['professor']::text[]);
  IF private.valid_change_note(p_change_note) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A restore note between 3 and 1000 characters is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.specialty_catalog_versions AS version WHERE version.status = 'draft'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'A draft already exists; publish or resolve it before restoring a version';
  END IF;

  SELECT version.* INTO active_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'active'
  FOR UPDATE;

  IF active_version.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'No active specialty catalog exists';
  END IF;
  IF p_expected_active_version_id IS NULL
     OR active_version.id <> p_expected_active_version_id THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'The active catalog changed; reload before restoring';
  END IF;

  SELECT version.* INTO source_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.id = p_source_version_id
    AND version.status IN ('active', 'archived')
    AND version.published_at IS NOT NULL
  LIMIT 1;

  IF source_version.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Published catalog revision not found';
  END IF;

  INSERT INTO private.specialty_catalog_versions (
    label,
    status,
    lock_version,
    parent_version_id,
    note,
    created_by
  ) VALUES (
    'restore-r' || source_version.revision::text,
    'draft',
    1,
    active_version.id,
    btrim(p_change_note),
    actor_id
  )
  RETURNING * INTO restored_version;

  INSERT INTO private.specialty_catalog_entries (
    version_id,
    name,
    category,
    descriptions,
    clinical_summaries,
    profile,
    updated_by,
    updated_at
  )
  SELECT
    restored_version.id,
    entry.name,
    entry.category,
    entry.descriptions,
    entry.clinical_summaries,
    entry.profile,
    actor_id,
    now()
  FROM private.specialty_catalog_entries AS entry
  WHERE entry.version_id = source_version.id;

  resolved_checksum := private.specialty_catalog_content_hash(restored_version.id);

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'archived'
  WHERE version.id = active_version.id;

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'active',
      label = 'medical-specialties-r' || version.revision::text,
      lock_version = version.lock_version + 1,
      note = btrim(p_change_note),
      published_by = actor_id,
      published_at = now(),
      checksum = resolved_checksum
  WHERE version.id = restored_version.id
  RETURNING version.* INTO restored_version;

  INSERT INTO private.specialty_catalog_audit (
    actor_user_id,
    actor_role,
    action,
    version_id,
    version_revision,
    note,
    after_value
  ) VALUES (
    actor_id,
    actor_role,
    'restore_requested',
    restored_version.id,
    restored_version.revision,
    btrim(p_change_note),
    jsonb_build_object(
      'source_version_id', source_version.id,
      'source_revision', source_version.revision,
      'active_parent_version_id', active_version.id,
      'active_parent_revision', active_version.revision,
      'restored_active_version_id', restored_version.id,
      'restored_active_revision', restored_version.revision,
      'content_hash', resolved_checksum
    )
  );

  RETURN private.specialty_catalog_payload(restored_version.id, false);
END;
$$;

ALTER TABLE public.student_responses
  ADD COLUMN specialty_config_version_id uuid,
  ADD COLUMN specialty_config_revision bigint;

ALTER TABLE public.specialist_responses
  ADD COLUMN specialty_config_version_id uuid,
  ADD COLUMN specialty_config_revision bigint;

UPDATE public.student_responses AS response
SET specialty_config_version_id = version.id,
    specialty_config_revision = version.revision
FROM private.specialty_catalog_versions AS version
WHERE version.status = 'active'
  AND response.specialty_config_version_id IS NULL
  AND response.submission_schema_version = 1
  AND response.specialty_catalog_version = 'medical-specialties-v1'
  AND response.scoring_version = 'client-scoring-v1';

UPDATE public.specialist_responses AS response
SET specialty_config_version_id = version.id,
    specialty_config_revision = version.revision
FROM private.specialty_catalog_versions AS version
WHERE version.status = 'active'
  AND response.specialty_config_version_id IS NULL
  AND response.submission_schema_version = 1
  AND response.specialty_catalog_version = 'medical-specialties-v1'
  AND response.calibration_version = 'calibration-v1';

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_specialty_config_pair_check
  CHECK (
    (specialty_config_version_id IS NULL AND specialty_config_revision IS NULL)
    OR
    (specialty_config_version_id IS NOT NULL AND specialty_config_revision IS NOT NULL)
  ),
  ADD CONSTRAINT student_responses_specialty_config_fk
  FOREIGN KEY (specialty_config_version_id, specialty_config_revision)
  REFERENCES private.specialty_catalog_versions (id, revision);

ALTER TABLE public.specialist_responses
  ADD CONSTRAINT specialist_responses_specialty_config_pair_check
  CHECK (
    (specialty_config_version_id IS NULL AND specialty_config_revision IS NULL)
    OR
    (specialty_config_version_id IS NOT NULL AND specialty_config_revision IS NOT NULL)
  ),
  ADD CONSTRAINT specialist_responses_specialty_config_fk
  FOREIGN KEY (specialty_config_version_id, specialty_config_revision)
  REFERENCES private.specialty_catalog_versions (id, revision);

COMMENT ON COLUMN public.student_responses.specialty_config_version_id IS
  'Exact published specialty catalog snapshot claimed by the client submission; legacy schema-0 rows remain NULL.';
COMMENT ON COLUMN public.student_responses.specialty_config_revision IS
  'Human-readable immutable revision paired with specialty_config_version_id.';
COMMENT ON COLUMN public.specialist_responses.specialty_config_version_id IS
  'Exact published specialty catalog snapshot claimed by the client submission; legacy schema-0 rows remain NULL.';
COMMENT ON COLUMN public.specialist_responses.specialty_config_revision IS
  'Human-readable immutable revision paired with specialty_config_version_id.';

CREATE OR REPLACE FUNCTION private.resolve_published_specialty_config_revision(
  requested_version_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_revision bigint;
BEGIN
  SELECT version.revision INTO resolved_revision
  FROM private.specialty_catalog_versions AS version
  WHERE version.id = requested_version_id
    AND version.status IN ('active', 'archived')
    AND version.published_at IS NOT NULL
    AND version.checksum IS NOT NULL
  LIMIT 1;

  IF resolved_revision IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'The requested specialty catalog version is not a published snapshot';
  END IF;
  RETURN resolved_revision;
END;
$$;

CREATE OR REPLACE FUNCTION private.submit_student_response_v2(
  p_submission_id uuid,
  p_study_year integer,
  p_preferred_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_client_scores jsonb,
  p_language text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_scoring_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
  resolved_revision bigint;
  updated_id uuid;
  existing_version_id uuid;
  existing_revision bigint;
BEGIN
  IF p_specialty_config_version_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A specialty catalog version id is required';
  END IF;
  resolved_revision := private.resolve_published_specialty_config_revision(p_specialty_config_version_id);

  SELECT response.specialty_config_version_id, response.specialty_config_revision
  INTO existing_version_id, existing_revision
  FROM public.student_responses AS response
  WHERE response.id = p_submission_id;

  IF FOUND THEN
    IF existing_version_id IS DISTINCT FROM p_specialty_config_version_id
       OR existing_revision IS DISTINCT FROM resolved_revision THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with different specialty catalog provenance';
    END IF;
    RETURN private.submit_student_response_v1(
      p_submission_id,
      p_study_year,
      p_preferred_specialty,
      p_ratings,
      p_selected_values,
      p_client_scores,
      p_language,
      p_questionnaire_version,
      p_value_catalog_version,
      p_specialty_catalog_version,
      p_scoring_version,
      p_consent_version
    );
  END IF;

  inserted_id := private.submit_student_response_v1(
    p_submission_id,
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_scoring_version,
    p_consent_version
  );

  UPDATE public.student_responses AS response
  SET specialty_config_version_id = p_specialty_config_version_id,
      specialty_config_revision = resolved_revision
  WHERE response.id = inserted_id
    AND (
      (response.specialty_config_version_id IS NULL AND response.specialty_config_revision IS NULL)
      OR
      (
        response.specialty_config_version_id = p_specialty_config_version_id
        AND response.specialty_config_revision = resolved_revision
      )
    )
  RETURNING response.id INTO updated_id;

  IF updated_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Submission id already exists with different specialty catalog provenance';
  END IF;
  RETURN updated_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.submit_specialist_response_v2(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_language text,
  p_years_of_experience integer,
  p_career_satisfaction integer,
  p_would_choose_again_code text,
  p_intention_to_change_code text,
  p_voluntary_choice_code text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
  resolved_revision bigint;
  updated_id uuid;
  existing_version_id uuid;
  existing_revision bigint;
BEGIN
  IF p_specialty_config_version_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A specialty catalog version id is required';
  END IF;
  resolved_revision := private.resolve_published_specialty_config_revision(p_specialty_config_version_id);

  SELECT response.specialty_config_version_id, response.specialty_config_revision
  INTO existing_version_id, existing_revision
  FROM public.specialist_responses AS response
  WHERE response.id = p_submission_id;

  IF FOUND THEN
    IF existing_version_id IS DISTINCT FROM p_specialty_config_version_id
       OR existing_revision IS DISTINCT FROM resolved_revision THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with different specialty catalog provenance';
    END IF;
    RETURN private.submit_specialist_response_v1(
      p_submission_id,
      p_actual_specialty,
      p_ratings,
      p_selected_values,
      p_language,
      p_years_of_experience,
      p_career_satisfaction,
      p_would_choose_again_code,
      p_intention_to_change_code,
      p_voluntary_choice_code,
      p_questionnaire_version,
      p_value_catalog_version,
      p_specialty_catalog_version,
      p_calibration_version,
      p_consent_version
    );
  END IF;

  inserted_id := private.submit_specialist_response_v1(
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_language,
    p_years_of_experience,
    p_career_satisfaction,
    p_would_choose_again_code,
    p_intention_to_change_code,
    p_voluntary_choice_code,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_calibration_version,
    p_consent_version
  );

  UPDATE public.specialist_responses AS response
  SET specialty_config_version_id = p_specialty_config_version_id,
      specialty_config_revision = resolved_revision
  WHERE response.id = inserted_id
    AND (
      (response.specialty_config_version_id IS NULL AND response.specialty_config_revision IS NULL)
      OR
      (
        response.specialty_config_version_id = p_specialty_config_version_id
        AND response.specialty_config_revision = resolved_revision
      )
    )
  RETURNING response.id INTO updated_id;

  IF updated_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Submission id already exists with different specialty catalog provenance';
  END IF;
  RETURN updated_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_student_response_v2(
  p_submission_id uuid,
  p_study_year integer,
  p_preferred_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_client_scores jsonb,
  p_language text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_scoring_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_student_response_v2(
    p_submission_id,
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_scoring_version,
    p_consent_version,
    p_specialty_config_version_id
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_specialist_response_v2(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_language text,
  p_years_of_experience integer,
  p_career_satisfaction integer,
  p_would_choose_again_code text,
  p_intention_to_change_code text,
  p_voluntary_choice_code text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_specialist_response_v2(
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_language,
    p_years_of_experience,
    p_career_satisfaction,
    p_would_choose_again_code,
    p_intention_to_change_code,
    p_voluntary_choice_code,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_calibration_version,
    p_consent_version,
    p_specialty_config_version_id
  );
$$;

REVOKE ALL ON FUNCTION private.current_portal_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_portal_role(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.add_portal_user_by_email(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_change_note(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_localized_catalog_text(jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_specialty_profile(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_specialty_catalog_entry(text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.specialty_catalog_content_hash(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.specialty_catalog_payload(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.specialty_catalog_editor_payload(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.resolve_published_specialty_config_revision(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_student_response_v2(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_specialist_response_v2(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.current_user_portal_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_active_specialty_catalog() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_specialty_catalog_draft() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_specialty_catalog_entry_draft(
  uuid, bigint, text, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_specialty_catalog_draft(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_specialty_catalog_versions(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_specialty_catalog_version(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_student_response_v2(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_specialist_response_v2(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_portal_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_specialty_catalog() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_specialty_catalog_draft() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_specialty_catalog_entry_draft(
  uuid, bigint, text, jsonb, jsonb, jsonb, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_specialty_catalog_draft(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_specialty_catalog_versions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_specialty_catalog_version(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.add_portal_user_by_email(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_student_response_v2(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_specialist_response_v2(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text, uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_active_specialty_catalog() IS
  'Returns the single published specialty snapshot used by the public matching engine.';
COMMENT ON FUNCTION public.save_specialty_catalog_entry_draft(uuid, bigint, text, jsonb, jsonb, jsonb, text) IS
  'Doctor/Professor optimistic-locking editor for localized content and matching profiles.';
COMMENT ON FUNCTION public.publish_specialty_catalog_draft(uuid, bigint, text) IS
  'Professor-only atomic publication of the current validated draft.';
COMMENT ON FUNCTION public.restore_specialty_catalog_version(uuid, uuid, text) IS
  'Professor-only atomic restoration of a published historical snapshot as a new active revision.';
COMMENT ON FUNCTION public.submit_student_response_v2(
  uuid, integer, text, jsonb, jsonb, jsonb, text, text, text, text, text, text, uuid
) IS 'Validated student ingestion endpoint with exact specialty catalog provenance.';
COMMENT ON FUNCTION public.submit_specialist_response_v2(
  uuid, text, jsonb, jsonb, text, integer, integer, text, text, text,
  text, text, text, text, text, uuid
) IS 'Validated specialist ingestion endpoint with exact specialty catalog provenance.';

NOTIFY pgrst, 'reload schema';

COMMIT;
