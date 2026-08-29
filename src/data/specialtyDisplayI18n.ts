import type { Language } from './i18n';
import {
  prettyTrait,
  type Trait,
} from './traits';
import type {
  CareType,
  PatientContactLevel,
  ProceduralIntensity,
  WorkStyle,
} from './specialtyMetadata';

const TRAITS_RO: Record<Trait, string> = {
  scientific_curiosity: 'Curiozitate științifică',
  causal_reasoning: 'Raționament cauzal',
  precision: 'Precizie',
  detail_orientation: 'Atenție la detalii',
  complex_problem_solving: 'Rezolvarea problemelor complexe',
  intellectual_orientation: 'Orientare intelectuală',
  sustained_concentration: 'Concentrare susținută',
  practical_orientation: 'Orientare practică',
  theoretical_orientation: 'Orientare teoretică',
  breadth_orientation: 'Orientare generalistă',
  specialization_preference: 'Preferință pentru specializare',
  ambiguity_tolerance: 'Toleranță la ambiguitate',
  logical_reasoning: 'Raționament logic',
  objectivity: 'Obiectivitate',
  quantitative_reasoning: 'Raționament cantitativ',
  visual_reasoning: 'Raționament vizual',
  spatial_orientation: 'Orientare spațială',
  creativity: 'Creativitate',
  cognitive_flexibility: 'Flexibilitate cognitivă',
  novelty_seeking: 'Căutarea noutății',
  routine_tolerance: 'Toleranță la rutină',
  research_interest: 'Interes pentru cercetare',
  structure_preference: 'Preferință pentru structură',
  organization: 'Organizare',
  flexibility: 'Flexibilitate',
  interruption_tolerance: 'Toleranță la întreruperi',
  long_term_orientation: 'Orientare pe termen lung',
  patience: 'Răbdare',
  deliberation: 'Chibzuință',
  persistence: 'Perseverență',
  frustration_tolerance: 'Toleranță la frustrare',
  action_orientation: 'Orientare spre acțiune',
  adaptability: 'Adaptabilitate',
  initiative: 'Inițiativă',
  leadership: 'Spirit de conducere',
  short_term_patient_contact: 'Contact de scurtă durată cu pacienții',
  teamwork: 'Muncă în echipă',
  social_energy: 'Energie socială',
  people_interest: 'Interes pentru oameni',
  listening: 'Ascultare activă',
  cognitive_empathy: 'Empatie cognitivă',
  communication: 'Comunicare',
  coordination: 'Coordonare',
  long_term_patient_relationship: 'Relații de lungă durată cu pacienții',
  interpersonal_boundaries: 'Limite interpersonale',
  affective_empathy: 'Empatie afectivă',
  warmth: 'Căldură interpersonală',
  care_motivation: 'Motivația de a îngriji',
  helping_motivation: 'Motivația de a ajuta',
  expertise_motivation: 'Motivația de a dezvolta expertiză',
  rapid_feedback_preference: 'Preferință pentru feedback rapid',
  rapid_results_preference: 'Preferință pentru rezultate rapide',
  patient_involvement: 'Implicarea pacientului',
  achievement_orientation: 'Orientare spre performanță',
  curative_orientation: 'Orientare curativă',
  incremental_progress_tolerance: 'Toleranță la progres treptat',
  basic_science_interest: 'Interes pentru științele fundamentale',
  academic_orientation: 'Orientare academică',
  external_validation: 'Validare externă',
  control_preference: 'Preferință pentru control',
  calmness: 'Calm',
  decisiveness: 'Capacitate de decizie',
  challenge_seeking: 'Căutarea provocărilor',
  risk_tolerance: 'Toleranță la risc',
  energy: 'Energie',
  drive: 'Dinamism',
  optimism: 'Optimism',
  failure_tolerance: 'Toleranță la eșec',
  emotional_resilience: 'Reziliență emoțională',
  self_confidence: 'Încredere în sine',
  perfectionism: 'Perfecționism',
  crisis_calmness: 'Calm în situații de criză',
  stress_resistance: 'Rezistență la stres',
  manual_dexterity: 'Dexteritate manuală',
  observation: 'Spirit de observație',
  multitasking: 'Gestionarea simultană a sarcinilor',
  care_coordination: 'Coordonarea îngrijirii',
  family_interaction: 'Interacțiunea cu familia',
  technology_interest: 'Interes pentru tehnologie',
  mechanical_aptitude: 'Aptitudini mecanice',
  technical_orientation: 'Orientare tehnică',
  teaching_interest: 'Interes pentru predare',
  lifestyle_priority: 'Prioritate acordată stilului de viață',
  independence: 'Independență',
  outside_interests: 'Interese în afara profesiei',
  long_hours_tolerance: 'Toleranță la program prelungit',
  physical_endurance: 'Rezistență fizică',
  income_priority: 'Prioritate acordată venitului',
  professional_identity: 'Identitate profesională',
  mortality_tolerance: 'Toleranță în fața morții',
  tolerance_of_others: 'Toleranță față de ceilalți',
  harmony_preference: 'Preferință pentru armonie',
  prestige_priority: 'Prioritate acordată prestigiului',
  manual_orientation: 'Orientare spre activități manuale',
  security_priority: 'Prioritate acordată siguranței locului de muncă',
  prevention_orientation: 'Orientare spre prevenție',
};

const TRAITS_FR: Record<Trait, string> = {
  scientific_curiosity: 'Curiosité scientifique',
  causal_reasoning: 'Raisonnement causal',
  precision: 'Précision',
  detail_orientation: 'Souci du détail',
  complex_problem_solving: 'Résolution de problèmes complexes',
  intellectual_orientation: 'Orientation intellectuelle',
  sustained_concentration: 'Concentration soutenue',
  practical_orientation: 'Orientation pratique',
  theoretical_orientation: 'Orientation théorique',
  breadth_orientation: 'Orientation généraliste',
  specialization_preference: 'Préférence pour la spécialisation',
  ambiguity_tolerance: 'Tolérance à l’ambiguïté',
  logical_reasoning: 'Raisonnement logique',
  objectivity: 'Objectivité',
  quantitative_reasoning: 'Raisonnement quantitatif',
  visual_reasoning: 'Raisonnement visuel',
  spatial_orientation: 'Orientation spatiale',
  creativity: 'Créativité',
  cognitive_flexibility: 'Flexibilité cognitive',
  novelty_seeking: 'Recherche de nouveauté',
  routine_tolerance: 'Tolérance à la routine',
  research_interest: 'Intérêt pour la recherche',
  structure_preference: 'Préférence pour un cadre structuré',
  organization: 'Organisation',
  flexibility: 'Flexibilité',
  interruption_tolerance: 'Tolérance aux interruptions',
  long_term_orientation: 'Orientation à long terme',
  patience: 'Patience',
  deliberation: 'Réflexion',
  persistence: 'Persévérance',
  frustration_tolerance: 'Tolérance à la frustration',
  action_orientation: 'Orientation vers l’action',
  adaptability: 'Adaptabilité',
  initiative: 'Initiative',
  leadership: 'Aptitude au leadership',
  short_term_patient_contact: 'Contact de courte durée avec les patients',
  teamwork: 'Travail en équipe',
  social_energy: 'Énergie sociale',
  people_interest: 'Intérêt pour les autres',
  listening: 'Écoute active',
  cognitive_empathy: 'Empathie cognitive',
  communication: 'Communication',
  coordination: 'Coordination',
  long_term_patient_relationship: 'Relations à long terme avec les patients',
  interpersonal_boundaries: 'Limites interpersonnelles',
  affective_empathy: 'Empathie affective',
  warmth: 'Chaleur humaine',
  care_motivation: 'Motivation à prendre soin d’autrui',
  helping_motivation: 'Motivation à aider',
  expertise_motivation: 'Motivation à développer son expertise',
  rapid_feedback_preference: 'Préférence pour un retour rapide',
  rapid_results_preference: 'Préférence pour des résultats rapides',
  patient_involvement: 'Implication du patient',
  achievement_orientation: 'Orientation vers la réussite',
  curative_orientation: 'Orientation curative',
  incremental_progress_tolerance: 'Tolérance aux progrès graduels',
  basic_science_interest: 'Intérêt pour les sciences fondamentales',
  academic_orientation: 'Orientation universitaire',
  external_validation: 'Validation externe',
  control_preference: 'Préférence pour le contrôle',
  calmness: 'Calme',
  decisiveness: 'Esprit de décision',
  challenge_seeking: 'Recherche de défis',
  risk_tolerance: 'Tolérance au risque',
  energy: 'Énergie',
  drive: 'Dynamisme',
  optimism: 'Optimisme',
  failure_tolerance: 'Tolérance à l’échec',
  emotional_resilience: 'Résilience émotionnelle',
  self_confidence: 'Confiance en soi',
  perfectionism: 'Perfectionnisme',
  crisis_calmness: 'Calme en situation de crise',
  stress_resistance: 'Résistance au stress',
  manual_dexterity: 'Dextérité manuelle',
  observation: 'Sens de l’observation',
  multitasking: 'Gestion simultanée de plusieurs tâches',
  care_coordination: 'Coordination des soins',
  family_interaction: 'Interaction avec les familles',
  technology_interest: 'Intérêt pour la technologie',
  mechanical_aptitude: 'Aptitude mécanique',
  technical_orientation: 'Orientation technique',
  teaching_interest: 'Intérêt pour l’enseignement',
  lifestyle_priority: 'Priorité accordée au mode de vie',
  independence: 'Indépendance',
  outside_interests: 'Intérêts extraprofessionnels',
  long_hours_tolerance: 'Tolérance aux longues journées de travail',
  physical_endurance: 'Endurance physique',
  income_priority: 'Priorité accordée au revenu',
  professional_identity: 'Identité professionnelle',
  mortality_tolerance: 'Aisance face à la mort',
  tolerance_of_others: 'Tolérance envers autrui',
  harmony_preference: 'Préférence pour l’harmonie',
  prestige_priority: 'Priorité accordée au prestige',
  manual_orientation: 'Orientation vers les activités manuelles',
  security_priority: 'Priorité accordée à la sécurité de l’emploi',
  prevention_orientation: 'Orientation vers la prévention',
};

const WORK_STYLES_RO: Record<WorkStyle, string> = {
  'primarily clinical': 'predominant clinic',
  'clinical + procedural': 'clinic + procedural',
  'clinical + surgical': 'clinic + chirurgical',
  'primarily surgical': 'predominant chirurgical',
  'primarily diagnostic': 'predominant diagnostic',
  'primarily laboratory': 'predominant de laborator',
  'primarily administrative': 'predominant administrativ',
  'mixed clinical and public health': 'mixt: clinic și sănătate publică',
};

const WORK_STYLES_FR: Record<WorkStyle, string> = {
  'primarily clinical': 'principalement clinique',
  'clinical + procedural': 'clinique + interventionnel',
  'clinical + surgical': 'clinique + chirurgical',
  'primarily surgical': 'principalement chirurgical',
  'primarily diagnostic': 'principalement diagnostique',
  'primarily laboratory': 'principalement en laboratoire',
  'primarily administrative': 'principalement administratif',
  'mixed clinical and public health': 'mixte : clinique et santé publique',
};

const PATIENT_CONTACT_RO: Record<PatientContactLevel, string> = {
  'very high': 'foarte ridicat',
  high: 'ridicat',
  moderate: 'moderat',
  low: 'scăzut',
  minimal: 'minim',
};

const PATIENT_CONTACT_FR: Record<PatientContactLevel, string> = {
  'very high': 'très élevé',
  high: 'élevé',
  moderate: 'modéré',
  low: 'faible',
  minimal: 'minimal',
};

const CARE_TYPES_RO: Record<CareType, string> = {
  acute: 'acută',
  'acute + longitudinal': 'acută + longitudinală',
  longitudinal: 'longitudinală',
  episodic: 'episodică',
};

const CARE_TYPES_FR: Record<CareType, string> = {
  acute: 'aigu',
  'acute + longitudinal': 'aigu + longitudinal',
  longitudinal: 'longitudinal',
  episodic: 'épisodique',
};

const PROCEDURAL_INTENSITIES_RO: Record<ProceduralIntensity, string> = {
  high: 'ridicată',
  moderate: 'moderată',
  low: 'scăzută',
  minimal: 'minimă',
};

const PROCEDURAL_INTENSITIES_FR: Record<ProceduralIntensity, string> = {
  high: 'élevée',
  moderate: 'modérée',
  low: 'faible',
  minimal: 'minimale',
};

export function translateTrait(trait: Trait, lang: Language): string {
  if (lang === 'ro') return TRAITS_RO[trait];
  if (lang === 'fr') return TRAITS_FR[trait];
  return prettyTrait(trait);
}

export function translateWorkStyle(value: WorkStyle, lang: Language): string {
  if (lang === 'ro') return WORK_STYLES_RO[value];
  if (lang === 'fr') return WORK_STYLES_FR[value];
  return value;
}

export function translatePatientContact(value: PatientContactLevel, lang: Language): string {
  if (lang === 'ro') return PATIENT_CONTACT_RO[value];
  if (lang === 'fr') return PATIENT_CONTACT_FR[value];
  return value;
}

export function translateCareType(value: CareType, lang: Language): string {
  if (lang === 'ro') return CARE_TYPES_RO[value];
  if (lang === 'fr') return CARE_TYPES_FR[value];
  return value;
}

export function translateProceduralIntensity(value: ProceduralIntensity, lang: Language): string {
  if (lang === 'ro') return PROCEDURAL_INTENSITIES_RO[value];
  if (lang === 'fr') return PROCEDURAL_INTENSITIES_FR[value];
  return value;
}
