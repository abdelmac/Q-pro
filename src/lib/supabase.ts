import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SpecialistResponse {
  actual_specialty: string;
  ratings: Record<string, number>;
  selected_values: string[];
  language: string;
  years_of_experience?: number | null;
  career_satisfaction?: number | null;
  would_choose_again?: string | null;
  intention_to_change?: string | null;
  voluntary_choice?: string | null;
}

export async function submitSpecialistResponse(data: SpecialistResponse): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('specialist_responses').insert({
    actual_specialty: data.actual_specialty,
    ratings: data.ratings,
    selected_values: data.selected_values,
    language: data.language,
    years_of_experience: data.years_of_experience ?? null,
    career_satisfaction: data.career_satisfaction ?? null,
    would_choose_again: data.would_choose_again ?? null,
    intention_to_change: data.intention_to_change ?? null,
    voluntary_choice: data.voluntary_choice ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
