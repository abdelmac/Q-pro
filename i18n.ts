import type { Trait } from './traits';

// ============================================================
// Q PROJECT — Dimension definitions
// Groups traits into major dimensions used for sub-scores,
// comparison, and adjustable priorities.
// ============================================================

export type Dimension =
  | 'thinking'
  | 'working'
  | 'interpersonal'
  | 'technical'
  | 'lifestyle';

export interface DimensionDef {
  key: Dimension;
  traits: Trait[];
}

export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'thinking',
    traits: [
      'scientific_curiosity', 'causal_reasoning', 'precision', 'detail_orientation',
      'complex_problem_solving', 'intellectual_orientation', 'sustained_concentration',
      'theoretical_orientation', 'breadth_orientation', 'specialization_preference',
      'ambiguity_tolerance', 'logical_reasoning', 'objectivity', 'quantitative_reasoning',
      'visual_reasoning', 'spatial_orientation', 'creativity', 'cognitive_flexibility',
    ],
  },
  {
    key: 'working',
    traits: [
      'novelty_seeking', 'routine_tolerance', 'research_interest', 'structure_preference',
      'organization', 'flexibility', 'interruption_tolerance', 'long_term_orientation',
      'patience', 'deliberation', 'persistence', 'frustration_tolerance',
      'action_orientation', 'adaptability', 'initiative', 'leadership',
    ],
  },
  {
    key: 'interpersonal',
    traits: [
      'short_term_patient_contact', 'teamwork', 'social_energy', 'people_interest',
      'listening', 'cognitive_empathy', 'communication', 'coordination',
      'long_term_patient_relationship', 'interpersonal_boundaries', 'affective_empathy',
      'warmth', 'care_motivation', 'helping_motivation', 'patient_involvement',
      'care_coordination', 'family_interaction', 'teaching_interest',
    ],
  },
  {
    key: 'technical',
    traits: [
      'manual_dexterity', 'manual_orientation', 'observation', 'multitasking',
      'technology_interest', 'mechanical_aptitude', 'technical_orientation',
      'practical_orientation', 'energy', 'physical_endurance', 'crisis_calmness',
      'stress_resistance', 'decisiveness', 'challenge_seeking', 'risk_tolerance',
    ],
  },
  {
    key: 'lifestyle',
    traits: [
      'lifestyle_priority', 'independence', 'outside_interests', 'long_hours_tolerance',
      'income_priority', 'professional_identity', 'mortality_tolerance',
      'tolerance_of_others', 'harmony_preference', 'prestige_priority',
      'security_priority', 'prevention_orientation', 'control_preference',
      'calmness', 'drive', 'optimism', 'failure_tolerance', 'emotional_resilience',
      'self_confidence', 'perfectionism', 'expertise_motivation', 'rapid_feedback_preference',
      'rapid_results_preference', 'achievement_orientation', 'curative_orientation',
      'incremental_progress_tolerance', 'basic_science_interest', 'academic_orientation',
      'external_validation',
    ],
  },
];

export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key);

export function traitsForDimension(dim: Dimension): Set<Trait> {
  const def = DIMENSIONS.find((d) => d.key === dim);
  return new Set(def?.traits ?? []);
}

export function dimensionForTrait(trait: Trait): Dimension {
  for (const d of DIMENSIONS) {
    if (d.traits.includes(trait)) return d.key;
  }
  return 'lifestyle';
}

// Default weights for adjustable priorities (0-100 scale, 50 = neutral)
export const DEFAULT_PRIORITY_WEIGHTS: Record<Dimension, number> = {
  thinking: 50,
  working: 50,
  interpersonal: 50,
  technical: 50,
  lifestyle: 50,
};

// Comparison axes for specialty comparison
export interface ComparisonAxis {
  key: string;
  label: string;
  traits: Trait[];
  // Whether higher trait values = more of this axis
  positive: boolean;
}

export const COMPARISON_AXES: ComparisonAxis[] = [
  { key: 'patient_interaction', label: 'Patient Interaction', traits: ['social_energy', 'people_interest', 'patient_involvement', 'long_term_patient_relationship', 'care_motivation'], positive: true },
  { key: 'crisis_work', label: 'Crisis & Acute Work', traits: ['crisis_calmness', 'stress_resistance', 'decisiveness', 'multitasking', 'adaptability'], positive: true },
  { key: 'technical_activity', label: 'Technical Activity', traits: ['technology_interest', 'technical_orientation', 'mechanical_aptitude'], positive: true },
  { key: 'visual_reasoning', label: 'Visual Reasoning', traits: ['visual_reasoning', 'spatial_orientation', 'observation'], positive: true },
  { key: 'long_term_care', label: 'Long-term Care', traits: ['long_term_patient_relationship', 'long_term_orientation', 'patience', 'incremental_progress_tolerance'], positive: true },
  { key: 'lifestyle_balance', label: 'Lifestyle Balance', traits: ['lifestyle_priority', 'outside_interests', 'independence'], positive: true },
  { key: 'research', label: 'Research Orientation', traits: ['research_interest', 'basic_science_interest', 'academic_orientation', 'scientific_curiosity'], positive: true },
  { key: 'manual_activity', label: 'Manual Activity', traits: ['manual_dexterity', 'manual_orientation', 'practical_orientation', 'action_orientation'], positive: true },
];
