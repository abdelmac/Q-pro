/*
# Create specialist_responses table for research data collection

1. Purpose
   Stores questionnaire responses submitted by medical specialists who
   complete the quiz. This data is used to calibrate the Q Project matching
   algorithm — comparing a specialist's actual specialty against their
   personality profile answers.

2. New Tables
   - `specialist_responses`
     - `id` (uuid, primary key, auto-generated)
     - `actual_specialty` (text, not null) — the specialty the specialist actually practices
     - `ratings` (jsonb, not null) — map of question IDs (T1, W1, ...) to 1–10 answers
     - `selected_values` (jsonb, not null) — array of up to 4 selected value strings
     - `language` (text, not null) — language code the quiz was taken in ('en', 'ro', 'fr')
     - `created_at` (timestamptz, default now())

3. Security
   - Enable RLS on `specialist_responses`.
   - Allow anon + authenticated INSERT only (responses are submitted, never read from the client).
   - No SELECT/UPDATE/DELETE from the client — researchers access data through the Supabase dashboard.

4. Notes
   - This is a no-auth app: the frontend uses the anon key, so policies must include `anon`.
   - Only INSERT is exposed; reading collected data is done server-side via the Supabase dashboard.
*/

CREATE TABLE IF NOT EXISTS specialist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actual_specialty text NOT NULL,
  ratings jsonb NOT NULL,
  selected_values jsonb NOT NULL,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE specialist_responses ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to INSERT responses for research
DROP POLICY IF EXISTS "anon_insert_specialist_responses" ON specialist_responses;
CREATE POLICY "anon_insert_specialist_responses"
ON specialist_responses FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- No SELECT/UPDATE/DELETE policies — data is accessed only via Supabase dashboard by researchers
