// ============================================================
// Q PROJECT — Trait definitions, question mappings, value mappings
// Translated from the Q Project Python reference implementation.
// ============================================================

export type Trait =
  | 'scientific_curiosity'
  | 'causal_reasoning'
  | 'precision'
  | 'detail_orientation'
  | 'complex_problem_solving'
  | 'intellectual_orientation'
  | 'sustained_concentration'
  | 'practical_orientation'
  | 'theoretical_orientation'
  | 'breadth_orientation'
  | 'specialization_preference'
  | 'ambiguity_tolerance'
  | 'logical_reasoning'
  | 'objectivity'
  | 'quantitative_reasoning'
  | 'visual_reasoning'
  | 'spatial_orientation'
  | 'creativity'
  | 'cognitive_flexibility'
  | 'novelty_seeking'
  | 'routine_tolerance'
  | 'research_interest'
  | 'structure_preference'
  | 'organization'
  | 'flexibility'
  | 'interruption_tolerance'
  | 'long_term_orientation'
  | 'patience'
  | 'deliberation'
  | 'persistence'
  | 'frustration_tolerance'
  | 'action_orientation'
  | 'adaptability'
  | 'initiative'
  | 'leadership'
  | 'short_term_patient_contact'
  | 'teamwork'
  | 'social_energy'
  | 'people_interest'
  | 'listening'
  | 'cognitive_empathy'
  | 'communication'
  | 'coordination'
  | 'long_term_patient_relationship'
  | 'interpersonal_boundaries'
  | 'affective_empathy'
  | 'warmth'
  | 'care_motivation'
  | 'helping_motivation'
  | 'expertise_motivation'
  | 'rapid_feedback_preference'
  | 'rapid_results_preference'
  | 'patient_involvement'
  | 'achievement_orientation'
  | 'curative_orientation'
  | 'incremental_progress_tolerance'
  | 'basic_science_interest'
  | 'academic_orientation'
  | 'external_validation'
  | 'control_preference'
  | 'calmness'
  | 'decisiveness'
  | 'challenge_seeking'
  | 'risk_tolerance'
  | 'energy'
  | 'drive'
  | 'optimism'
  | 'failure_tolerance'
  | 'emotional_resilience'
  | 'self_confidence'
  | 'perfectionism'
  | 'crisis_calmness'
  | 'stress_resistance'
  | 'manual_dexterity'
  | 'observation'
  | 'multitasking'
  | 'care_coordination'
  | 'family_interaction'
  | 'technology_interest'
  | 'mechanical_aptitude'
  | 'technical_orientation'
  | 'teaching_interest'
  | 'lifestyle_priority'
  | 'independence'
  | 'outside_interests'
  | 'long_hours_tolerance'
  | 'physical_endurance'
  | 'income_priority'
  | 'professional_identity'
  | 'mortality_tolerance'
  | 'tolerance_of_others'
  | 'harmony_preference'
  | 'prestige_priority'
  | 'manual_orientation'
  | 'security_priority'
  | 'prevention_orientation';

export interface TraitMapping {
  trait: Trait;
  direction: 1 | -1;
  weight: number;
}

// Each question contributes to one or more latent traits.
// direction: +1 = high answer means MORE of the trait; -1 = less.
// weight: 1.0 normal, 1.5 particularly informative, 2.0 very informative.
export const QUESTION_TRAITS: Record<string, TraitMapping[]> = {
  // --- Thinking Style ---
  T1: [
    { trait: 'scientific_curiosity', direction: 1, weight: 1.2 },
    { trait: 'causal_reasoning', direction: 1, weight: 1.3 },
  ],
  T2: [
    { trait: 'precision', direction: 1, weight: 1.5 },
    { trait: 'detail_orientation', direction: 1, weight: 1.5 },
  ],
  T3: [
    { trait: 'complex_problem_solving', direction: 1, weight: 1.5 },
    { trait: 'intellectual_orientation', direction: 1, weight: 1.2 },
  ],
  T4: [{ trait: 'sustained_concentration', direction: 1, weight: 1.5 }],
  T5: [
    { trait: 'practical_orientation', direction: 1, weight: 1.2 },
    { trait: 'theoretical_orientation', direction: -1, weight: 0.8 },
  ],
  T6: [
    { trait: 'breadth_orientation', direction: 1, weight: 1.2 },
    { trait: 'specialization_preference', direction: -1, weight: 0.8 },
  ],
  T7: [{ trait: 'ambiguity_tolerance', direction: -1, weight: 1.5 }],
  T8: [{ trait: 'logical_reasoning', direction: 1, weight: 1.5 }],
  T9: [{ trait: 'objectivity', direction: 1, weight: 1.3 }],
  T10: [{ trait: 'quantitative_reasoning', direction: 1, weight: 1.5 }],
  T11: [
    { trait: 'visual_reasoning', direction: 1, weight: 1.5 },
    { trait: 'spatial_orientation', direction: 1, weight: 1.0 },
  ],
  T12: [
    { trait: 'creativity', direction: 1, weight: 1.3 },
    { trait: 'cognitive_flexibility', direction: 1, weight: 1.2 },
  ],

  // --- Working Style ---
  W1: [
    { trait: 'novelty_seeking', direction: 1, weight: 1.3 },
    { trait: 'routine_tolerance', direction: -1, weight: 1.0 },
  ],
  W2: [
    { trait: 'research_interest', direction: 1, weight: 1.5 },
    { trait: 'scientific_curiosity', direction: 1, weight: 1.0 },
  ],
  W3: [
    { trait: 'structure_preference', direction: 1, weight: 1.3 },
    { trait: 'organization', direction: 1, weight: 1.0 },
  ],
  W4: [{ trait: 'routine_tolerance', direction: 1, weight: 1.5 }],
  W5: [
    { trait: 'flexibility', direction: 1, weight: 1.4 },
    { trait: 'interruption_tolerance', direction: 1, weight: 1.4 },
  ],
  W6: [
    { trait: 'long_term_orientation', direction: 1, weight: 1.5 },
    { trait: 'patience', direction: 1, weight: 1.1 },
  ],
  W7: [
    { trait: 'theoretical_orientation', direction: 1, weight: 1.3 },
    { trait: 'action_orientation', direction: -1, weight: 1.0 },
  ],
  W8: [
    { trait: 'precision', direction: 1, weight: 1.3 },
    { trait: 'deliberation', direction: 1, weight: 1.3 },
  ],
  W9: [
    { trait: 'persistence', direction: 1, weight: 1.5 },
    { trait: 'frustration_tolerance', direction: 1, weight: 1.0 },
  ],
  W10: [{ trait: 'action_orientation', direction: 1, weight: 1.4 }],
  W11: [
    { trait: 'practical_orientation', direction: 1, weight: 1.5 },
    { trait: 'action_orientation', direction: 1, weight: 1.2 },
  ],
  W12: [
    { trait: 'adaptability', direction: 1, weight: 1.5 },
    { trait: 'flexibility', direction: 1, weight: 1.0 },
  ],
  W13: [
    { trait: 'initiative', direction: 1, weight: 1.5 },
    { trait: 'leadership', direction: 1, weight: 0.8 },
  ],

  // --- Interpersonal Skills ---
  I1: [{ trait: 'short_term_patient_contact', direction: 1, weight: 1.4 }],
  I2: [{ trait: 'teamwork', direction: 1, weight: 1.5 }],
  I3: [{ trait: 'social_energy', direction: 1, weight: 1.5 }],
  I4: [{ trait: 'people_interest', direction: 1, weight: 1.3 }],
  I5: [
    { trait: 'listening', direction: 1, weight: 1.5 },
    { trait: 'cognitive_empathy', direction: 1, weight: 1.0 },
  ],
  I6: [{ trait: 'communication', direction: 1, weight: 1.5 }],
  I7: [{ trait: 'leadership', direction: 1, weight: 1.5 }],
  I8: [
    { trait: 'coordination', direction: 1, weight: 1.3 },
    { trait: 'leadership', direction: 1, weight: 1.0 },
  ],
  I9: [{ trait: 'long_term_patient_relationship', direction: 1, weight: 1.5 }],
  I10: [{ trait: 'interpersonal_boundaries', direction: -1, weight: 1.1 }],
  I11: [
    { trait: 'affective_empathy', direction: 1, weight: 1.5 },
    { trait: 'warmth', direction: 1, weight: 1.3 },
  ],

  // --- Motivations ---
  M1: [{ trait: 'care_motivation', direction: 1, weight: 1.5 }],
  M2: [{ trait: 'helping_motivation', direction: 1, weight: 1.5 }],
  M3: [
    { trait: 'expertise_motivation', direction: 1, weight: 1.4 },
    { trait: 'specialization_preference', direction: 1, weight: 1.0 },
  ],
  M4: [{ trait: 'rapid_feedback_preference', direction: 1, weight: 1.3 }],
  M5: [{ trait: 'rapid_results_preference', direction: 1, weight: 1.5 }],
  M6: [
    { trait: 'patient_involvement', direction: 1, weight: 1.4 },
    { trait: 'long_term_patient_relationship', direction: 1, weight: 1.0 },
  ],
  M7: [{ trait: 'achievement_orientation', direction: 1, weight: 1.5 }],
  M8: [{ trait: 'curative_orientation', direction: 1, weight: 1.2 }],
  M9: [
    { trait: 'incremental_progress_tolerance', direction: 1, weight: 1.4 },
    { trait: 'long_term_orientation', direction: 1, weight: 0.8 },
  ],
  M10: [
    { trait: 'basic_science_interest', direction: 1, weight: 1.5 },
    { trait: 'scientific_curiosity', direction: 1, weight: 1.0 },
  ],
  M11: [{ trait: 'academic_orientation', direction: 1, weight: 1.5 }],
  M12: [{ trait: 'external_validation', direction: 1, weight: 1.2 }],

  // --- Personality ---
  P1: [{ trait: 'control_preference', direction: 1, weight: 1.3 }],
  P2: [{ trait: 'calmness', direction: 1, weight: 1.3 }],
  P3: [{ trait: 'social_energy', direction: 1, weight: 1.3 }],
  P4: [{ trait: 'decisiveness', direction: 1, weight: 1.5 }],
  P5: [
    { trait: 'challenge_seeking', direction: 1, weight: 1.5 },
    { trait: 'risk_tolerance', direction: 1, weight: 1.0 },
  ],
  P6: [{ trait: 'ambiguity_tolerance', direction: 1, weight: 1.5 }],
  P7: [{ trait: 'energy', direction: 1, weight: 1.4 }],
  P8: [
    { trait: 'drive', direction: 1, weight: 1.4 },
    { trait: 'achievement_orientation', direction: 1, weight: 0.8 },
  ],
  P9: [{ trait: 'optimism', direction: 1, weight: 1.2 }],
  P10: [
    { trait: 'failure_tolerance', direction: 1, weight: 1.4 },
    { trait: 'emotional_resilience', direction: 1, weight: 1.2 },
  ],
  P11: [{ trait: 'self_confidence', direction: 1, weight: 1.4 }],
  P12: [
    { trait: 'perfectionism', direction: 1, weight: 1.5 },
    { trait: 'precision', direction: 1, weight: 0.8 },
  ],
  P13: [
    { trait: 'crisis_calmness', direction: 1, weight: 1.5 },
    { trait: 'stress_resistance', direction: 1, weight: 1.5 },
  ],

  // --- Special Skills ---
  S1: [{ trait: 'manual_dexterity', direction: 1, weight: 1.5 }],
  S2: [
    { trait: 'observation', direction: 1, weight: 1.5 },
    { trait: 'detail_orientation', direction: 1, weight: 1.0 },
  ],
  S3: [{ trait: 'multitasking', direction: 1, weight: 1.5 }],
  S4: [
    { trait: 'coordination', direction: 1, weight: 1.4 },
    { trait: 'multitasking', direction: 1, weight: 1.0 },
  ],
  S5: [
    { trait: 'care_coordination', direction: 1, weight: 1.5 },
    { trait: 'family_interaction', direction: 1, weight: 1.2 },
  ],
  S6: [{ trait: 'coordination', direction: 1, weight: 1.4 }],
  S7: [{ trait: 'technology_interest', direction: 1, weight: 1.5 }],
  S8: [
    { trait: 'mechanical_aptitude', direction: 1, weight: 1.5 },
    { trait: 'technical_orientation', direction: 1, weight: 1.2 },
  ],
  S9: [
    { trait: 'teaching_interest', direction: 1, weight: 1.3 },
    { trait: 'communication', direction: 1, weight: 0.8 },
  ],

  // --- Values / Lifestyle ---
  V1: [{ trait: 'lifestyle_priority', direction: 1, weight: 1.5 }],
  V2: [{ trait: 'independence', direction: 1, weight: 1.4 }],
  V3: [
    { trait: 'outside_interests', direction: 1, weight: 1.2 },
    { trait: 'lifestyle_priority', direction: 1, weight: 0.8 },
  ],
  V4: [{ trait: 'breadth_orientation', direction: 1, weight: 1.5 }],
  V5: [
    { trait: 'long_hours_tolerance', direction: 1, weight: 1.5 },
    { trait: 'physical_endurance', direction: 1, weight: 0.8 },
  ],
  V6: [
    { trait: 'organization', direction: 1, weight: 1.4 },
    { trait: 'structure_preference', direction: 1, weight: 0.8 },
  ],
  V7: [{ trait: 'income_priority', direction: 1, weight: 1.4 }],
  V8: [{ trait: 'professional_identity', direction: 1, weight: 1.0 }],
  V9: [
    { trait: 'mortality_tolerance', direction: 1, weight: 1.4 },
    { trait: 'emotional_resilience', direction: 1, weight: 0.8 },
  ],
  V10: [
    { trait: 'tolerance_of_others', direction: 1, weight: 1.4 },
    { trait: 'cognitive_empathy', direction: 1, weight: 0.8 },
  ],
  V11: [{ trait: 'harmony_preference', direction: 1, weight: 1.3 }],
};

// Question 2: Four most important values.
// Each value adds a flat bonus to one or more traits.
export const VALUE_MAPPING: Record<string, { trait: Trait; bonus: number }[]> = {
  'Sufficient free time': [{ trait: 'lifestyle_priority', bonus: 12 }],
  'Personal achievement': [{ trait: 'achievement_orientation', bonus: 12 }],
  Prestige: [{ trait: 'prestige_priority', bonus: 12 }],
  'Decision-making': [
    { trait: 'decisiveness', bonus: 10 },
    { trait: 'leadership', bonus: 5 },
  ],
  Independence: [{ trait: 'independence', bonus: 12 }],
  'Intellectual activity': [
    { trait: 'intellectual_orientation', bonus: 12 },
    { trait: 'scientific_curiosity', bonus: 5 },
  ],
  'Manual/hands-on activity': [
    { trait: 'manual_orientation', bonus: 12 },
    { trait: 'practical_orientation', bonus: 5 },
  ],
  'Working with people': [
    { trait: 'social_energy', bonus: 10 },
    { trait: 'people_interest', bonus: 8 },
  ],
  'Job security': [{ trait: 'security_priority', bonus: 12 }],
  'Variety in your work': [{ trait: 'novelty_seeking', bonus: 12 }],
  'Satisfactory income': [{ trait: 'income_priority', bonus: 12 }],
  Creativity: [{ trait: 'creativity', bonus: 12 }],
  'Feedback from others': [{ trait: 'external_validation', bonus: 10 }],
  'Caring for people': [
    { trait: 'care_motivation', bonus: 12 },
    { trait: 'helping_motivation', bonus: 8 },
  ],
};

export const VALUE_OPTIONS: string[] = Object.keys(VALUE_MAPPING);

export function prettyTrait(trait: Trait): string {
  return trait.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
