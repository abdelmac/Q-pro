import { DIMENSION_KEYS } from '@/data/dimensions';
import type { Specialty } from '@/data/specialties';
import { dashboardModelChecksum } from './researchDashboard';
import { SCORING_ENGINE_REVISION, type PriorityWeights } from './scoring';

export const TRAIT_MAPPING_VERSION = 'question-traits-q81-v1';
export const SCORING_CONTEXT_DISCLOSURE = {
  en: 'Saving also records your five matching-priority settings and the algorithm, mapping and model identifiers used, so the calculation can be traced. These settings are not sent before you choose Save.',
  fr: 'L’enregistrement conserve aussi vos cinq réglages de priorités et les identifiants de l’algorithme, de la correspondance des traits et du modèle, pour assurer la traçabilité du calcul. Ces réglages ne sont pas envoyés avant votre choix d’enregistrer.',
  ro: 'Salvarea înregistrează și cele cinci priorități de potrivire, împreună cu identificatorii algoritmului, mapării trăsăturilor și modelului, pentru trasabilitatea calculului. Aceste setări nu sunt trimise înainte de a alege Salvare.',
};
export interface ScoringContext {
  engine_revision: string;
  trait_mapping_version: string;
  model_checksum: string;
  priorities: PriorityWeights;
}

/** Captured at explicit submission, never synthesized for historic submissions. */
export function createScoringContext(priorities: PriorityWeights, specialties: readonly Specialty[]): ScoringContext {
  return {
    engine_revision: SCORING_ENGINE_REVISION,
    trait_mapping_version: TRAIT_MAPPING_VERSION,
    model_checksum: dashboardModelChecksum(specialties),
    priorities: { ...priorities },
  };
}

export function isValidScoringContext(context: ScoringContext | null | undefined): context is ScoringContext {
  return !!context && context.engine_revision === SCORING_ENGINE_REVISION
    && context.trait_mapping_version === TRAIT_MAPPING_VERSION
    && /^fnv1a64-[0-9a-f]{16}$/.test(context.model_checksum)
    && Object.keys(context.priorities ?? {}).length === DIMENSION_KEYS.length
    && DIMENSION_KEYS.every(dimension => typeof context.priorities[dimension] === 'number'
      && Number.isFinite(context.priorities[dimension])
      && context.priorities[dimension] >= 0 && context.priorities[dimension] <= 100);
}
