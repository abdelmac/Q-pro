/* Store student assessments separately from specialist calibration responses. */

CREATE TABLE IF NOT EXISTS student_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_year integer,
  preferred_specialty text,
  ratings jsonb NOT NULL,
  selected_values jsonb NOT NULL,
  scores jsonb NOT NULL,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_responses_study_year_check CHECK (study_year IS NULL OR study_year BETWEEN 1 AND 12)
);

ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_student_responses" ON student_responses;
CREATE POLICY "anon_insert_student_responses"
ON student_responses FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_student_responses" ON student_responses;
CREATE POLICY "authenticated_read_student_responses"
ON student_responses FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read_specialist_responses" ON specialist_responses;
CREATE POLICY "authenticated_read_specialist_responses"
ON specialist_responses FOR SELECT
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS student_responses_study_year_idx ON student_responses (study_year);
CREATE INDEX IF NOT EXISTS student_responses_created_at_idx ON student_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS specialist_responses_created_at_idx ON specialist_responses (created_at DESC);

NOTIFY pgrst, 'reload schema';
