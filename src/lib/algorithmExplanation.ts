import { DIMENSIONS } from '@/data/dimensions';
import type { Specialty } from '@/data/specialties';
import { QUESTION_TRAITS, VALUE_MAPPING, type Trait } from '@/data/traits';

export const ALGORITHM_FLOW_STEP_IDS = [
  'inputs',
  'traits',
  'values',
  'comparison',
  'score',
  'ranking',
] as const;

export interface AlgorithmCoverage {
  questionCount: number;
  dimensionCount: number;
  totalDictionary: number;
  usedByProfiles: number;
  directlyMeasured: number;
  valueOnly: number;
  unmeasured: number;
  unusedByProfiles: number;
  usedDirectlyMeasured: number;
  usedValueOnly: number;
  usedUnmeasured: number;
  valueOnlyTraits: readonly Trait[];
  unmeasuredTraits: readonly Trait[];
  usedValueOnlyTraits: readonly Trait[];
  usedUnmeasuredTraits: readonly Trait[];
  unusedByProfilesTraits: readonly Trait[];
}

/**
 * Describes two independent coverage axes for the active model:
 * how each dictionary trait can be observed, and whether a published
 * specialty profile currently uses it.
 */
export function getAlgorithmCoverage(specialties: readonly Specialty[]): AlgorithmCoverage {
  const dictionaryTraits = Array.from(new Set<Trait>(
    DIMENSIONS.flatMap(({ traits }) => traits),
  ));
  const directlyMeasuredSet = new Set<Trait>(
    Object.values(QUESTION_TRAITS).flatMap((mappings) => mappings.map(({ trait }) => trait)),
  );
  const valueMappedSet = new Set<Trait>(
    Object.values(VALUE_MAPPING).flatMap((mappings) => mappings.map(({ trait }) => trait)),
  );
  const profileTraitSet = new Set<string>(
    specialties.flatMap(({ profile }) => Object.keys(profile)),
  );

  const directlyMeasuredTraits = dictionaryTraits.filter((trait) => directlyMeasuredSet.has(trait));
  const valueOnlyTraits = dictionaryTraits.filter((trait) => (
    !directlyMeasuredSet.has(trait) && valueMappedSet.has(trait)
  ));
  const unmeasuredTraits = dictionaryTraits.filter((trait) => (
    !directlyMeasuredSet.has(trait) && !valueMappedSet.has(trait)
  ));
  const usedTraits = dictionaryTraits.filter((trait) => profileTraitSet.has(trait));
  const unusedByProfilesTraits = dictionaryTraits.filter((trait) => !profileTraitSet.has(trait));
  const usedValueOnlyTraits = valueOnlyTraits.filter((trait) => profileTraitSet.has(trait));
  const usedUnmeasuredTraits = unmeasuredTraits.filter((trait) => profileTraitSet.has(trait));

  return {
    questionCount: Object.keys(QUESTION_TRAITS).length,
    dimensionCount: DIMENSIONS.length,
    totalDictionary: dictionaryTraits.length,
    usedByProfiles: usedTraits.length,
    directlyMeasured: directlyMeasuredTraits.length,
    valueOnly: valueOnlyTraits.length,
    unmeasured: unmeasuredTraits.length,
    unusedByProfiles: unusedByProfilesTraits.length,
    usedDirectlyMeasured: usedTraits.filter((trait) => directlyMeasuredSet.has(trait)).length,
    usedValueOnly: usedValueOnlyTraits.length,
    usedUnmeasured: usedUnmeasuredTraits.length,
    valueOnlyTraits,
    unmeasuredTraits,
    usedValueOnlyTraits,
    usedUnmeasuredTraits,
    unusedByProfilesTraits,
  };
}
