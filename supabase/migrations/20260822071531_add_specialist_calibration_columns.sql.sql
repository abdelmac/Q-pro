/*
# Add specialist calibration columns

Adds years_of_experience, career_satisfaction, would_choose_again,
intention_to_change, and voluntary_choice to specialist_responses.
*/

ALTER TABLE specialist_responses
  ADD COLUMN IF NOT EXISTS years_of_experience integer,
  ADD COLUMN IF NOT EXISTS career_satisfaction integer,
  ADD COLUMN IF NOT EXISTS would_choose_again text,
  ADD COLUMN IF NOT EXISTS intention_to_change text,
  ADD COLUMN IF NOT EXISTS voluntary_choice text;
