BEGIN;

/*
 * Romanian medical studies use six study years. Keep the historical 1-12
 * constraint untouched so the one legacy outlier remains auditable, while a
 * NOT VALID constraint blocks every new out-of-range row without rewriting
 * previously collected research data.
 */
ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_study_year_1_to_6_check
  CHECK (study_year IS NULL OR study_year BETWEEN 1 AND 6)
  NOT VALID;

COMMENT ON CONSTRAINT student_responses_study_year_1_to_6_check
  ON public.student_responses IS
  'New student responses accept an optional Romanian medical study year from 1 through 6; the unvalidated state preserves pre-existing legacy data.';

/*
 * The trigger gives all still-executable RPC generations the same controlled
 * SQLSTATE instead of allowing older v1/v2 workers to reach a raw CHECK error.
 */
CREATE OR REPLACE FUNCTION private.enforce_student_study_year_1_to_6()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.study_year IS NOT NULL AND NEW.study_year NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Student study year must be between 1 and 6';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_student_study_year_1_to_6()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_student_study_year_1_to_6
  ON public.student_responses;

CREATE TRIGGER enforce_student_study_year_1_to_6
BEFORE INSERT OR UPDATE OF study_year
ON public.student_responses
FOR EACH ROW
EXECUTE FUNCTION private.enforce_student_study_year_1_to_6();

COMMIT;
