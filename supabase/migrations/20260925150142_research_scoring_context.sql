BEGIN;

-- Additive only: null means not recorded. Do not invent sliders or engine
-- details for any historical submission, including retries from old clients.
ALTER TABLE public.student_responses ADD COLUMN scoring_context jsonb;
ALTER TABLE public.specialist_responses ADD COLUMN scoring_context jsonb;

CREATE FUNCTION private.valid_research_scoring_context(context jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item record; priorities jsonb;
BEGIN
  IF context IS NULL OR jsonb_typeof(context)<>'object' OR octet_length(context::text)>2048
    OR NOT(context ?& ARRAY['engine_revision','trait_mapping_version','priorities','model_checksum'])
    OR (SELECT count(*) FROM jsonb_object_keys(context))<>4
    OR context->>'engine_revision' IS DISTINCT FROM 'scoring-engine-v2'
    OR context->>'trait_mapping_version' IS DISTINCT FROM 'question-traits-q81-v1'
    OR jsonb_typeof(context->'model_checksum') IS DISTINCT FROM 'string'
    OR coalesce(context->>'model_checksum','') !~ '^fnv1a64-[0-9a-f]{16}$' THEN RETURN false; END IF;
  priorities:=context->'priorities';
  IF jsonb_typeof(priorities) IS DISTINCT FROM 'object'
    OR NOT(priorities ?& ARRAY['thinking','working','interpersonal','technical','lifestyle'])
    OR (SELECT count(*) FROM jsonb_object_keys(priorities))<>5 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_each(priorities) LOOP
    IF jsonb_typeof(item.value)<>'number' THEN RETURN false; END IF;
    IF (item.value #>> '{}')::numeric NOT BETWEEN 0 AND 100 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.valid_research_scoring_context(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.valid_research_scoring_context(jsonb) TO service_role;
ALTER TABLE public.student_responses ADD CONSTRAINT student_scoring_context_check
  CHECK(scoring_context IS NULL OR private.valid_research_scoring_context(scoring_context));
ALTER TABLE public.specialist_responses ADD CONSTRAINT specialist_scoring_context_check
  CHECK(scoring_context IS NULL OR (questionnaire_completed AND private.valid_research_scoring_context(scoring_context)));
COMMENT ON COLUMN public.student_responses.scoring_context IS
 'Client-reported, versioned engine/mapping/checksum and exact personalized priority sliders. NULL is unavailable, never defaulted. Catalog revision is independently validated by submission RPC. Checksum is not proof of client integrity.';
COMMENT ON COLUMN public.specialist_responses.scoring_context IS
 'Client-reported q81 scoring context. NULL for historical or skipped questionnaires; no retrospective reconstruction.';

-- The BEFORE INSERT trigger writes context only to a row actually offered by
-- the new RPC. ON CONFLICT never updates an existing row. A post-call equality
-- check rejects a collision with legacy clients even under concurrency.
CREATE FUNCTION private.attach_research_scoring_context()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE context jsonb:=nullif(current_setting('qpro.submission_scoring_context',true),'')::jsonb;
BEGIN
  IF context IS NOT NULL THEN
    IF NOT private.valid_research_scoring_context(context) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid scoring provenance';
    END IF;
    NEW.scoring_context:=context;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.attach_research_scoring_context() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER attach_student_scoring_context BEFORE INSERT ON public.student_responses
  FOR EACH ROW EXECUTE FUNCTION private.attach_research_scoring_context();
CREATE TRIGGER attach_specialist_scoring_context BEFORE INSERT ON public.specialist_responses
  FOR EACH ROW EXECUTE FUNCTION private.attach_research_scoring_context();

CREATE FUNCTION public.submit_student_response_v7(
  p_submission_id uuid,p_participant_role text,p_medicine_view text,p_study_year integer,
  p_preferred_specialty text,p_ratings jsonb,p_selected_values jsonb,p_client_scores jsonb,p_language text,
  p_questionnaire_version text,p_value_catalog_version text,p_specialty_catalog_version text,p_scoring_version text,
  p_consent_version text,p_participant_reflection_version text,p_specialty_config_version_id uuid,
  p_country_code text,p_region text,p_scoring_context jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved_id uuid; previous_context text:=current_setting('qpro.submission_scoring_context',true);
BEGIN
  IF NOT private.valid_research_scoring_context(p_scoring_context) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid scoring provenance';
  END IF;
  PERFORM pg_advisory_xact_lock(184205927,hashtext(p_submission_id::text));
  PERFORM set_config('qpro.submission_scoring_context',p_scoring_context::text,true);
  saved_id:=private.submit_student_response_v6(p_submission_id,p_participant_role,p_medicine_view,p_study_year,
    p_preferred_specialty,p_ratings,p_selected_values,p_client_scores,p_language,p_questionnaire_version,
    p_value_catalog_version,p_specialty_catalog_version,p_scoring_version,p_consent_version,p_participant_reflection_version,
    p_specialty_config_version_id,p_country_code,p_region);
  PERFORM set_config('qpro.submission_scoring_context',coalesce(previous_context,''),true);
  IF (SELECT scoring_context FROM public.student_responses WHERE id=saved_id) IS DISTINCT FROM p_scoring_context THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Submission id already exists with a different scoring context';
  END IF;
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.submit_specialist_response_v6(
  p_submission_id uuid,p_actual_specialty text,p_ratings jsonb,p_selected_values jsonb,p_questionnaire_completed boolean,
  p_language text,p_current_specialty_view text,p_specialty_changes_over_years text,p_most_important_specialty_quality text,
  p_would_choose_again_code text,p_would_not_choose_again_reason text,p_student_self_question text,
  p_questionnaire_version text,p_value_catalog_version text,p_specialty_catalog_version text,p_calibration_version text,
  p_consent_version text,p_specialty_config_version_id uuid,p_country_code text,p_region text,p_scoring_context jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved_id uuid; previous_context text:=current_setting('qpro.submission_scoring_context',true);
BEGIN
  IF (p_questionnaire_completed AND NOT private.valid_research_scoring_context(p_scoring_context))
    OR (NOT p_questionnaire_completed AND p_scoring_context IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid scoring provenance';
  END IF;
  PERFORM pg_advisory_xact_lock(184205928,hashtext(p_submission_id::text));
  PERFORM set_config('qpro.submission_scoring_context',coalesce(p_scoring_context::text,''),true);
  saved_id:=private.submit_specialist_response_v5(p_submission_id,p_actual_specialty,p_ratings,p_selected_values,
    p_questionnaire_completed,p_language,p_current_specialty_view,p_specialty_changes_over_years,p_most_important_specialty_quality,
    p_would_choose_again_code,p_would_not_choose_again_reason,p_student_self_question,p_questionnaire_version,
    p_value_catalog_version,p_specialty_catalog_version,p_calibration_version,p_consent_version,p_specialty_config_version_id,
    p_country_code,p_region);
  PERFORM set_config('qpro.submission_scoring_context',coalesce(previous_context,''),true);
  IF (SELECT scoring_context FROM public.specialist_responses WHERE id=saved_id) IS DISTINCT FROM p_scoring_context THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Submission id already exists with a different scoring context';
  END IF;
  RETURN saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_student_response_v7(uuid,text,text,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_response_v7(uuid,text,text,integer,text,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  TO anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_specialist_response_v6(uuid,text,jsonb,jsonb,boolean,text,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_specialist_response_v6(uuid,text,jsonb,jsonb,boolean,text,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text,jsonb)
  TO anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
