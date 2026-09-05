// ============================================================
// Q PROJECT — Specialty profiles built from base archetypes.
// Each trait value is (ideal, importance) where importance is
// 1=relevant, 2=important, 3=very important.
// ============================================================

import type { Trait } from './traits';

export type SpecialtyCategory =
  | 'Surgical'
  | 'Medical'
  | 'Pediatric'
  | 'Psychiatry'
  | 'Diagnostic & Support'
  | 'Public & Preventive';

export type TraitProfile = Partial<Record<Trait, [number, number]>>;

function mergeProfiles(...profiles: Partial<TraitProfile>[]): TraitProfile {
  const result = {} as TraitProfile;
  for (const profile of profiles) {
    for (const [key, value] of Object.entries(profile)) {
      (result as Record<string, [number, number]>)[key] = value as [number, number];
    }
  }
  return result;
}

// --------------------------------------------------------
// Base archetypes
// --------------------------------------------------------

const SURGICAL: Partial<TraitProfile> = {
  manual_dexterity: [90, 3],
  manual_orientation: [90, 3],
  practical_orientation: [85, 2],
  action_orientation: [85, 2],
  precision: [85, 3],
  stress_resistance: [80, 2],
  long_hours_tolerance: [80, 2],
  decisiveness: [80, 2],
};

const HIGH_ACUITY: Partial<TraitProfile> = {
  stress_resistance: [95, 3],
  crisis_calmness: [95, 3],
  decisiveness: [90, 3],
  multitasking: [90, 3],
  adaptability: [90, 2],
  interruption_tolerance: [90, 2],
  rapid_results_preference: [75, 1],
};

const COGNITIVE_CLINICAL: Partial<TraitProfile> = {
  complex_problem_solving: [90, 3],
  scientific_curiosity: [85, 2],
  logical_reasoning: [85, 2],
  ambiguity_tolerance: [80, 2],
  patient_involvement: [65, 1],
};

const LONGITUDINAL: Partial<TraitProfile> = {
  long_term_patient_relationship: [90, 3],
  long_term_orientation: [90, 2],
  patience: [85, 2],
  incremental_progress_tolerance: [90, 3],
  cognitive_empathy: [80, 2],
};

const PEOPLE_ORIENTED: Partial<TraitProfile> = {
  social_energy: [80, 2],
  communication: [85, 2],
  people_interest: [90, 2],
  care_motivation: [85, 2],
};

const TECHNICAL: Partial<TraitProfile> = {
  technology_interest: [90, 3],
  technical_orientation: [90, 3],
  precision: [90, 3],
  observation: [85, 2],
};

const DIAGNOSTIC: Partial<TraitProfile> = {
  observation: [90, 3],
  detail_orientation: [90, 3],
  logical_reasoning: [90, 3],
  complex_problem_solving: [85, 2],
};

const LABORATORY: Partial<TraitProfile> = {
  precision: [95, 3],
  basic_science_interest: [90, 3],
  research_interest: [80, 2],
  sustained_concentration: [90, 3],
  social_energy: [40, 1],
  patient_involvement: [30, 1],
};

const PEDIATRIC: Partial<TraitProfile> = {
  warmth: [90, 3],
  affective_empathy: [90, 3],
  communication: [85, 2],
  family_interaction: [90, 3],
  adaptability: [85, 2],
};

const POPULATION: Partial<TraitProfile> = {
  quantitative_reasoning: [85, 3],
  logical_reasoning: [85, 2],
  organization: [85, 2],
  breadth_orientation: [85, 2],
  patient_involvement: [30, 1],
};

// --------------------------------------------------------
// Specialty interface
// --------------------------------------------------------

export interface Specialty {
  name: string;
  category: SpecialtyCategory;
  profile: TraitProfile;
  blurb: string;
}

// --------------------------------------------------------
// Complete specialty database
// --------------------------------------------------------

export const SPECIALTIES: Specialty[] = [
  // --- Medical / Clinical ---
  {
    name: 'Allergy and Clinical Immunology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, LONGITUDINAL, {
      basic_science_interest: [85, 2],
      frustration_tolerance: [85, 2],
    }),
    blurb: 'Diagnosis and management of immune disorders — analytical, methodical, and lifestyle-friendly.',
  },
  {
    name: 'Anesthesiology and Intensive Care',
    category: 'Surgical',
    profile: mergeProfiles(HIGH_ACUITY, TECHNICAL, {
      control_preference: [85, 2],
      short_term_patient_contact: [85, 2],
      long_term_patient_relationship: [30, 1],
    }),
    blurb: 'Perioperative and critical-care physiology — decisive, composed, and hands-on in crisis.',
  },
  {
    name: 'Infectious Diseases',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, {
      challenge_seeking: [80, 2],
      ambiguity_tolerance: [90, 3],
      basic_science_interest: [90, 2],
    }),
    blurb: 'Diagnosis and treatment of infections — analytical, broad-ranging, and intellectually rich.',
  },
  {
    name: 'Cardiology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, HIGH_ACUITY, TECHNICAL, {
      quantitative_reasoning: [80, 2],
    }),
    blurb: 'Heart and circulation — analytical and technology-driven, with acute and chronic dimensions.',
  },
  {
    name: 'Pediatric Cardiology',
    category: 'Pediatric',
    profile: mergeProfiles(COGNITIVE_CLINICAL, PEDIATRIC, TECHNICAL, {
      stress_resistance: [85, 2],
    }),
    blurb: 'Heart care for children — meticulous, compassionate, and team-based.',
  },
  {
    name: 'Dermatology and Venereology',
    category: 'Medical',
    profile: mergeProfiles(DIAGNOSTIC, {
      visual_reasoning: [95, 3],
      precision: [90, 3],
      creativity: [75, 2],
      lifestyle_priority: [70, 1],
      tolerance_of_others: [90, 2],
    }),
    blurb: 'Disorders of the skin — visual, detail-driven, and one of the most lifestyle-balanced fields.',
  },
  {
    name: 'Diabetes, Nutrition and Metabolic Diseases',
    category: 'Medical',
    profile: mergeProfiles(LONGITUDINAL, COGNITIVE_CLINICAL, {
      care_motivation: [85, 2],
      communication: [85, 2],
    }),
    blurb: 'Chronic metabolic care — relational, educational, and longitudinal.',
  },
  {
    name: 'Endocrinology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, LONGITUDINAL, {
      logical_reasoning: [95, 3],
      basic_science_interest: [90, 3],
      precision: [90, 2],
    }),
    blurb: 'Hormone and gland disorders — analytical, intellectual, and methodical.',
  },
  {
    name: 'Medical Assessment of Work Capacity / Occupational Disability Assessment',
    category: 'Diagnostic & Support',
    profile: {
      objectivity: [95, 3],
      precision: [90, 3],
      organization: [90, 2],
      logical_reasoning: [90, 3],
      routine_tolerance: [75, 2],
      professional_identity: [75, 1],
    } as TraitProfile,
    blurb: 'Evaluating fitness and capacity — structured, autonomous, and well-balanced.',
  },
  {
    name: 'Clinical Pharmacology',
    category: 'Medical',
    profile: {
      basic_science_interest: [95, 3],
      research_interest: [90, 3],
      logical_reasoning: [90, 3],
      precision: [90, 2],
      academic_orientation: [85, 2],
    } as TraitProfile,
    blurb: 'The science of therapeutics and drug action — research-led and intellectual.',
  },
  {
    name: 'Gastroenterology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, TECHNICAL, {
      manual_dexterity: [75, 2],
      patient_involvement: [70, 1],
    }),
    blurb: 'Digestive system and liver — cognitive plus endoscopic, with broad variety.',
  },
  {
    name: 'Pediatric Gastroenterology',
    category: 'Pediatric',
    profile: mergeProfiles(COGNITIVE_CLINICAL, PEDIATRIC, {
      technical_orientation: [75, 2],
      detail_orientation: [90, 3],
      long_term_orientation: [90, 2],
    }),
    blurb: 'Digestive and liver care for children — compassionate, detailed, and longitudinal.',
  },
  {
    name: 'Medical Genetics',
    category: 'Medical',
    profile: mergeProfiles(LABORATORY, COGNITIVE_CLINICAL, {
      precision: [95, 3],
      academic_orientation: [90, 2],
      cognitive_empathy: [80, 2],
    }),
    blurb: 'Inherited and congenital disease — deeply intellectual, precise, and counseling-oriented.',
  },
  {
    name: 'Geriatrics and Gerontology',
    category: 'Medical',
    profile: mergeProfiles(LONGITUDINAL, PEOPLE_ORIENTED, {
      affective_empathy: [95, 3],
      tolerance_of_others: [95, 3],
      incremental_progress_tolerance: [95, 3],
      care_coordination: [90, 3],
    }),
    blurb: 'Care of older adults — holistic, relational, and team-coordinated.',
  },
  {
    name: 'Hematology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, LONGITUDINAL, {
      basic_science_interest: [90, 2],
      precision: [90, 2],
    }),
    blurb: 'Blood and marrow disorders — analytical, with lab and clinical breadth.',
  },
  {
    name: 'Family Medicine',
    category: 'Medical',
    profile: mergeProfiles(LONGITUDINAL, PEOPLE_ORIENTED, {
      breadth_orientation: [95, 3],
      care_coordination: [90, 3],
      adaptability: [85, 2],
    }),
    blurb: 'Comprehensive longitudinal primary care — relational, broad, and grounded.',
  },
  {
    name: 'Emergency Medicine',
    category: 'Surgical',
    profile: mergeProfiles(HIGH_ACUITY, PEOPLE_ORIENTED, {
      action_orientation: [95, 3],
      challenge_seeking: [90, 3],
      routine_tolerance: [20, 2],
    }),
    blurb: 'Acute undifferentiated care — fast, adaptive, and composed under chaos.',
  },
  {
    name: 'Internal Medicine',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, {
      breadth_orientation: [90, 3],
      complex_problem_solving: [95, 3],
      ambiguity_tolerance: [90, 3],
    }),
    blurb: 'Adult diagnostic and longitudinal care — the cerebral, broad generalist core.',
  },
  {
    name: 'Physical Medicine and Rehabilitation',
    category: 'Medical',
    profile: mergeProfiles(LONGITUDINAL, PEOPLE_ORIENTED, {
      incremental_progress_tolerance: [95, 3],
      coordination: [85, 2],
    }),
    blurb: 'Restoring function after injury or illness — patient, team-led, and longitudinal.',
  },
  {
    name: 'Occupational Medicine',
    category: 'Diagnostic & Support',
    profile: {
      organization: [90, 3],
      structure_preference: [85, 2],
      routine_tolerance: [80, 2],
      prevention_orientation: [85, 1],
      communication: [75, 1],
      lifestyle_priority: [75, 1],
    } as TraitProfile,
    blurb: 'Workplace health and safety — structured, autonomous, and lifestyle-friendly.',
  },
  {
    name: 'Sports Medicine',
    category: 'Medical',
    profile: mergeProfiles(PEOPLE_ORIENTED, {
      energy: [90, 3],
      social_energy: [90, 3],
      practical_orientation: [85, 2],
      novelty_seeking: [80, 2],
    }),
    blurb: 'Musculoskeletal care for athletes — active, team-oriented, and people-facing.',
  },
  {
    name: 'Nephrology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, LONGITUDINAL, {
      quantitative_reasoning: [90, 3],
      basic_science_interest: [90, 2],
      teamwork: [85, 2],
    }),
    blurb: 'Kidney and dialysis care — analytical, longitudinal, and team-based.',
  },
  {
    name: 'Pediatric Nephrology',
    category: 'Pediatric',
    profile: mergeProfiles(COGNITIVE_CLINICAL, LONGITUDINAL, PEDIATRIC, {
      quantitative_reasoning: [85, 2],
    }),
    blurb: 'Kidney care for children — meticulous, compassionate, and longitudinal.',
  },
  {
    name: 'Neonatology',
    category: 'Pediatric',
    profile: mergeProfiles(HIGH_ACUITY, PEDIATRIC, {
      precision: [95, 3],
      emotional_resilience: [95, 3],
    }),
    blurb: 'Care of newborns and premature infants — intense, precise, and deeply collaborative.',
  },
  {
    name: 'Neurology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, DIAGNOSTIC, {
      sustained_concentration: [95, 3],
      observation: [95, 3],
    }),
    blurb: 'Disorders of the nervous system — highly analytical, detail-driven, and intellectual.',
  },
  {
    name: 'Pediatric Neurology',
    category: 'Pediatric',
    profile: mergeProfiles(COGNITIVE_CLINICAL, DIAGNOSTIC, PEDIATRIC, {
      patience: [85, 2],
    }),
    blurb: 'Neurological care of children — meticulous, compassionate, and longitudinal.',
  },
  {
    name: 'Medical Oncology',
    category: 'Medical',
    profile: mergeProfiles(LONGITUDINAL, COGNITIVE_CLINICAL, {
      emotional_resilience: [95, 3],
      mortality_tolerance: [90, 3],
      affective_empathy: [85, 2],
    }),
    blurb: 'Systemic cancer care — emotionally demanding, intellectual, and team-based.',
  },
  {
    name: 'Pediatric Oncology and Hematology',
    category: 'Pediatric',
    profile: mergeProfiles(LONGITUDINAL, PEDIATRIC, COGNITIVE_CLINICAL, {
      emotional_resilience: [95, 3],
      mortality_tolerance: [90, 3],
    }),
    blurb: 'Cancer and blood care for children — compassionate, rigorous, and deeply collaborative.',
  },
  {
    name: 'Pediatrics',
    category: 'Pediatric',
    profile: mergeProfiles(PEDIATRIC, LONGITUDINAL, PEOPLE_ORIENTED),
    blurb: 'General care of children — warm, relational, and broad.',
  },
  {
    name: 'Pulmonology',
    category: 'Medical',
    profile: mergeProfiles(COGNITIVE_CLINICAL, {
      adaptability: [80, 2],
      technical_orientation: [70, 1],
      technology_interest: [90, 3],
    }),
    blurb: 'Lung and airway disease — cognitive with procedural variety.',
  },
  {
    name: 'Pediatric Pulmonology',
    category: 'Pediatric',
    profile: mergeProfiles(COGNITIVE_CLINICAL, PEDIATRIC, LONGITUDINAL, {
      detail_orientation: [90, 3],
    }),
    blurb: 'Respiratory care for children — compassionate, detailed, and longitudinal.',
  },
  {
    name: 'Psychiatry',
    category: 'Psychiatry',
    profile: {
      listening: [95, 3],
      cognitive_empathy: [95, 3],
      affective_empathy: [85, 2],
      ambiguity_tolerance: [95, 3],
      long_term_patient_relationship: [90, 3],
      tolerance_of_others: [95, 3],
      patience: [95, 3],
      rapid_results_preference: [30, 2],
    } as TraitProfile,
    blurb: 'Mental health and behavior — reflective, relational, and intellectually deep.',
  },
  {
    name: 'Child and Adolescent Psychiatry',
    category: 'Psychiatry',
    profile: mergeProfiles(PEDIATRIC, {
      listening: [95, 3],
      cognitive_empathy: [95, 3],
      ambiguity_tolerance: [95, 3],
      patience: [95, 3],
    }),
    blurb: 'Mental health care for young people — empathic, developmental, and team-oriented.',
  },
  {
    name: 'Radiation Oncology',
    category: 'Medical',
    profile: mergeProfiles(TECHNICAL, LONGITUDINAL, {
      precision: [95, 3],
      emotional_resilience: [85, 2],
    }),
    blurb: 'Precision radiation treatment of cancer — technology-rich, exacting, and collaborative.',
  },
  {
    name: 'Rheumatology',
    category: 'Medical',
    profile: mergeProfiles(LONGITUDINAL, COGNITIVE_CLINICAL, {
      frustration_tolerance: [95, 3],
      ambiguity_tolerance: [90, 3],
    }),
    blurb: 'Autoimmune and joint disease — intellectual, longitudinal, and methodical.',
  },

  // --- Surgical ---
  {
    name: 'Cardiovascular Surgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, {
      leadership: [90, 3],
      precision: [95, 3],
      physical_endurance: [95, 3],
    }),
    blurb: 'High-stakes operative work on the heart and great vessels — decisive, precise, and intense.',
  },
  {
    name: 'General Surgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, {
      breadth_orientation: [85, 2],
      physical_endurance: [95, 3],
    }),
    blurb: 'Broad operative practice spanning abdomen and trauma — varied, action-driven, and team-based.',
  },
  {
    name: 'Oral and Maxillofacial Surgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, {
      spatial_orientation: [95, 3],
      visual_reasoning: [90, 3],
      creativity: [80, 2],
    }),
    blurb: 'Surgery of the face, jaws and mouth blending operative craft with structural precision.',
  },
  {
    name: 'Pediatric Surgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, PEDIATRIC),
    blurb: 'Operative care for infants and children — meticulous, compassionate, and collaborative.',
  },
  {
    name: 'Plastic, Aesthetic and Reconstructive Microsurgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, {
      creativity: [95, 3],
      visual_reasoning: [95, 3],
      perfectionism: [90, 3],
      precision: [95, 3],
    }),
    blurb: 'Restoring form and function through fine technique — creative, detailed, and autonomous.',
  },
  {
    name: 'Thoracic Surgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, TECHNICAL),
    blurb: 'Surgery of the chest, lungs and mediastinum — composed under pressure and technically demanding.',
  },
  {
    name: 'Vascular Surgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, {
      spatial_orientation: [90, 3],
      precision: [95, 3],
    }),
    blurb: 'Operative and endovascular care of blood vessels — varied, hands-on, and decisive.',
  },
  {
    name: 'Neurosurgery',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, {
      precision: [100, 3],
      sustained_concentration: [100, 3],
      complex_problem_solving: [95, 3],
      physical_endurance: [95, 3],
    }),
    blurb: 'Surgery of the brain and spine — the pinnacle of precision, composure, and intellectual rigor.',
  },
  {
    name: 'Obstetrics and Gynecology',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, HIGH_ACUITY, PEOPLE_ORIENTED, {
      adaptability: [95, 3],
    }),
    blurb: 'Care of women across pregnancy, fertility and surgery — relational, procedural, and varied.',
  },
  {
    name: 'Ophthalmology',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, TECHNICAL, {
      manual_dexterity: [100, 3],
      precision: [100, 3],
      visual_reasoning: [95, 3],
      sustained_concentration: [95, 3],
    }),
    blurb: 'Microsurgical care of the eye — precise, tech-rich, and often independently practiced.',
  },
  {
    name: 'Pediatric Orthopedics',
    category: 'Pediatric',
    profile: mergeProfiles(SURGICAL, PEDIATRIC, {
      mechanical_aptitude: [90, 3],
      spatial_orientation: [90, 3],
    }),
    blurb: 'Musculoskeletal care for growing children — hands-on, gentle, and collaborative.',
  },
  {
    name: 'Orthopedics and Traumatology',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, {
      mechanical_aptitude: [95, 3],
      spatial_orientation: [95, 3],
      physical_endurance: [95, 3],
      action_orientation: [95, 3],
    }),
    blurb: 'Bones, joints and trauma — physical, hands-on, and results-driven.',
  },
  {
    name: 'Otorhinolaryngology (ENT)',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, DIAGNOSTIC, {
      visual_reasoning: [90, 2],
      technical_orientation: [85, 2],
      social_energy: [80, 2],
    }),
    blurb: 'Surgical and medical care of the ear, nose and throat — varied and people-facing.',
  },
  {
    name: 'Urology',
    category: 'Surgical',
    profile: mergeProfiles(SURGICAL, TECHNICAL, {
      adaptability: [80, 2],
      patient_involvement: [70, 1],
    }),
    blurb: 'Surgical and medical care of the urinary tract — procedural, tech-forward, and balanced.',
  },

  // --- Paraclinical / Population ---
  {
    name: 'Pathology',
    category: 'Diagnostic & Support',
    profile: mergeProfiles(LABORATORY, DIAGNOSTIC, {
      visual_reasoning: [95, 3],
      patient_involvement: [20, 2],
      independence: [85, 2],
    }),
    blurb: 'Diagnosis through tissue and cells — autonomous, precise, and quietly intellectual.',
  },
  {
    name: 'Epidemiology',
    category: 'Public & Preventive',
    profile: mergeProfiles(POPULATION, {
      research_interest: [95, 3],
      quantitative_reasoning: [95, 3],
      independence: [85, 2],
    }),
    blurb: 'Patterns of disease in populations — data-driven, analytical, and independent.',
  },
  {
    name: 'Hygiene',
    category: 'Public & Preventive',
    profile: mergeProfiles(POPULATION, {
      organization: [90, 3],
      structure_preference: [85, 2],
      independence: [85, 2],
    }),
    blurb: 'Prevention and public health standards — structured, autonomous, and balanced.',
  },
  {
    name: 'Laboratory Medicine',
    category: 'Diagnostic & Support',
    profile: mergeProfiles(LABORATORY, {
      technology_interest: [85, 2],
      lifestyle_priority: [75, 1],
    }),
    blurb: 'Diagnostic testing and lab science — precise, tech-enabled, and lifestyle-friendly.',
  },
  {
    name: 'Forensic Medicine',
    category: 'Diagnostic & Support',
    profile: mergeProfiles(DIAGNOSTIC, {
      objectivity: [100, 3],
      mortality_tolerance: [95, 3],
      emotional_resilience: [90, 3],
      precision: [95, 3],
      independence: [85, 2],
    }),
    blurb: 'Medical-legal investigation — exacting, composed, and independent-minded.',
  },
  {
    name: 'Nuclear Medicine',
    category: 'Diagnostic & Support',
    profile: mergeProfiles(TECHNICAL, {
      basic_science_interest: [95, 3],
      quantitative_reasoning: [85, 2],
    }),
    blurb: 'Imaging and targeted radionuclide therapy — technology-rich and analytical.',
  },
  {
    name: 'Medical Microbiology',
    category: 'Diagnostic & Support',
    profile: mergeProfiles(LABORATORY, {
      scientific_curiosity: [95, 3],
      research_interest: [90, 2],
      independence: [85, 2],
    }),
    blurb: 'Identification of microbes and infection — rigorous, independent, and lab-based.',
  },
  {
    name: 'Radiology and Medical Imaging',
    category: 'Diagnostic & Support',
    profile: mergeProfiles(TECHNICAL, DIAGNOSTIC, {
      visual_reasoning: [100, 3],
      spatial_orientation: [95, 3],
      patient_involvement: [40, 1],
      independence: [85, 2],
    }),
    blurb: 'Diagnosis through imaging — tech-forward, autonomous, and lifestyle-friendly.',
  },
  {
    name: 'Public Health and Healthcare Management',
    category: 'Public & Preventive',
    profile: mergeProfiles(POPULATION, {
      leadership: [90, 3],
      coordination: [95, 3],
      organization: [95, 3],
      breadth_orientation: [90, 2],
    }),
    blurb: 'Population health and system leadership — strategic, people-oriented, and broad.',
  },
];

export const CATEGORY_ORDER: SpecialtyCategory[] = [
  'Surgical',
  'Medical',
  'Pediatric',
  'Psychiatry',
  'Diagnostic & Support',
  'Public & Preventive',
];
