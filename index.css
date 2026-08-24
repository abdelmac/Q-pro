// ============================================================
// Q PROJECT — Scoring engine
// Translated from the Q Project Python reference implementation.
// Enhanced with dimension sub-scores, trade-offs, opposite-fit,
// and adjustable priority weights.
// ============================================================

import { QUESTION_TRAITS, VALUE_MAPPING, prettyTrait, type Trait } from '@/data/traits';
import { SPECIALTIES, type Specialty, type TraitProfile } from '@/data/specialties';
import { DIMENSIONS, DEFAULT_PRIORITY_WEIGHTS, dimensionForTrait, type Dimension } from '@/data/dimensions';

export interface QuizAnswers {
  ratings: Record<string, number>;
  selectedValues: string[];
  preferredSpecialty: string | null;
}

export type PriorityWeights = Record<Dimension, number>;

export interface TraitContribution {
  trait: Trait;
  student: number;
  target: number;
  importance: number;
  similarity: number;
  contribution: number;
}

export interface DimensionSubScore {
  dimension: Dimension;
  score: number;
  contributions: TraitContribution[];
}

export interface TradeOff {
  trait: Trait;
  student: number;
  target: number;
  gap: number;
  importance: number;
}

export interface SpecialtyScore {
  specialty: Specialty;
  score: number;
  details: TraitContribution[];
  subScores: DimensionSubScore[];
  tradeOffs: TradeOff[];
}

// --------------------------------------------------------
// Normalize a 1–10 answer to 0–100.
// --------------------------------------------------------
function normalizeAnswer(answer: number): number {
  return ((answer - 1) / 9) * 100;
}

// --------------------------------------------------------
// Calculate latent traits from questionnaire answers
// and selected values.
// --------------------------------------------------------
export function calculateTraits(
  answers: Record<string, number>,
  selectedValues: string[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  const weights: Record<string, number> = {};

  for (const [questionId, mappings] of Object.entries(QUESTION_TRAITS)) {
    const answer = answers[questionId];
    if (answer === undefined) continue;

    const normalized = normalizeAnswer(answer);

    for (const { trait, direction, weight } of mappings) {
      const alignedScore = direction === 1 ? normalized : 100 - normalized;
      scores[trait] = (scores[trait] ?? 0) + alignedScore * weight;
      weights[trait] = (weights[trait] ?? 0) + weight;
    }
  }

  const traits: Record<string, number> = {};
  for (const trait of Object.keys(scores)) {
    traits[trait] = scores[trait] / weights[trait];
  }

  for (const selected of selectedValues) {
    const mapping = VALUE_MAPPING[selected];
    if (!mapping) continue;

    for (const { trait, bonus } of mapping) {
      const current = traits[trait] ?? 50;
      traits[trait] = Math.min(100, current + bonus);
    }
  }

  return traits;
}

// --------------------------------------------------------
// Trait similarity: 100 = perfect match, 0 = max mismatch.
// --------------------------------------------------------
function traitSimilarity(studentValue: number, targetValue: number): number {
  const difference = Math.abs(studentValue - targetValue);
  return Math.max(0, 100 - difference);
}

// --------------------------------------------------------
// Convert priority weight (0-100, 50=neutral) to a multiplier.
// 0 → 0.5x, 50 → 1.0x, 100 → 1.5x
// --------------------------------------------------------
function priorityMultiplier(weight: number): number {
  return 0.5 + (weight / 100);
}

// --------------------------------------------------------
// Calculate a single specialty's compatibility score
// with optional priority weights.
// --------------------------------------------------------
function calculateSpecialtyScore(
  studentTraits: Record<string, number>,
  specialtyProfile: TraitProfile,
  priorities?: PriorityWeights
): { score: number; details: TraitContribution[]; subScores: DimensionSubScore[]; tradeOffs: TradeOff[] } {
  let weightedTotal = 0;
  let totalWeight = 0;
  const contributions: TraitContribution[] = [];

  for (const [trait, [target, importance]] of Object.entries(specialtyProfile) as [Trait, [number, number]][]) {
    const studentValue = studentTraits[trait];
    if (studentValue === undefined) continue;

    const similarity = traitSimilarity(studentValue, target);

    // Apply priority weight multiplier based on the trait's dimension
    const dim = dimensionForTrait(trait);
    const mult = priorities ? priorityMultiplier(priorities[dim]) : 1;
    const effectiveImportance = importance * mult;

    const contribution = similarity * effectiveImportance;

    weightedTotal += contribution;
    totalWeight += effectiveImportance;

    contributions.push({
      trait,
      student: studentValue,
      target,
      importance,
      similarity,
      contribution,
    });
  }

  if (totalWeight === 0) return { score: 0, details: [], subScores: [], tradeOffs: [] };

  const finalScore = weightedTotal / totalWeight;

  // Compute sub-scores per dimension
  const subScores: DimensionSubScore[] = DIMENSIONS.map((dim) => {
    const dimContributions = contributions.filter((c) => dimensionForTrait(c.trait) === dim.key);
    let dimTotal = 0;
    let dimWeight = 0;
    for (const c of dimContributions) {
      dimTotal += c.similarity * c.importance;
      dimWeight += c.importance;
    }
    return {
      dimension: dim.key,
      score: dimWeight > 0 ? dimTotal / dimWeight : 0,
      contributions: dimContributions,
    };
  });

  // Compute trade-offs: traits with largest gaps (student far from target, high importance)
  const tradeOffs: TradeOff[] = contributions
    .map((c) => ({
      trait: c.trait,
      student: c.student,
      target: c.target,
      gap: Math.abs(c.student - c.target),
      importance: c.importance,
    }))
    .filter((t) => t.gap >= 20 && t.importance >= 2)
    .sort((a, b) => b.gap * b.importance - a.gap * a.importance)
    .slice(0, 5);

  return { score: finalScore, details: contributions, subScores, tradeOffs };
}

// --------------------------------------------------------
// Rank every specialty, optionally with priority weights.
// --------------------------------------------------------
export function rankSpecialties(answers: QuizAnswers, priorities?: PriorityWeights): SpecialtyScore[] {
  const studentTraits = calculateTraits(answers.ratings, answers.selectedValues);

  const results: SpecialtyScore[] = SPECIALTIES.map((specialty) => {
    const { score, details, subScores, tradeOffs } = calculateSpecialtyScore(
      studentTraits,
      specialty.profile,
      priorities
    );
    return { specialty, score, details, subScores, tradeOffs };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

// --------------------------------------------------------
// Re-rank with new priority weights (keeps existing traits).
// --------------------------------------------------------
export function reRankWithPriorities(
  answers: QuizAnswers,
  priorities: PriorityWeights
): SpecialtyScore[] {
  return rankSpecialties(answers, priorities);
}

// --------------------------------------------------------
// Find the strongest matching traits for a result.
// --------------------------------------------------------
export function strongestMatches(result: SpecialtyScore, number = 4): TraitContribution[] {
  return [...result.details]
    .sort((a, b) => b.similarity * b.importance - a.similarity * a.importance)
    .slice(0, number);
}

// --------------------------------------------------------
// Find the weakest matching traits (for opposite-fit explanations).
// --------------------------------------------------------
export function weakestMatches(result: SpecialtyScore, number = 4): TraitContribution[] {
  return [...result.details]
    .sort((a, b) => a.similarity * a.importance - b.similarity * b.importance)
    .slice(0, number);
}

// --------------------------------------------------------
// Generate a human-readable explanation for a match.
// Uses ONLY traits produced by the scoring engine.
// --------------------------------------------------------
export function generateExplanation(result: SpecialtyScore): string {
  const strongest = strongestMatches(result, 4);
  const traitNames = strongest.map((x) => prettyTrait(x.trait));

  if (traitNames.length === 0) return 'Not enough data.';

  let traitsText: string;
  if (traitNames.length === 1) {
    traitsText = traitNames[0];
  } else {
    traitsText = traitNames.slice(0, -1).join(', ') + ' and ' + traitNames[traitNames.length - 1];
  }

  return `${result.specialty.name} aligns with several characteristics in your profile, particularly ${traitsText}. These traits overlap with important working demands represented in the Q Project profile for this specialty.`;
}

// --------------------------------------------------------
// Generate trade-off explanation (potential mismatches).
// Uses ONLY traits from the scoring engine — no invention.
// --------------------------------------------------------
export function generateTradeOffExplanation(result: SpecialtyScore): string {
  const tradeOffs = result.tradeOffs;
  if (tradeOffs.length === 0) return '';

  const parts = tradeOffs.slice(0, 3).map((t) => {
    const traitName = prettyTrait(t.trait);
    const studentDesc = t.student < t.target ? 'lower' : 'higher';
    return `your ${traitName.toLowerCase()} score is ${studentDesc} than the typical profile for this specialty`;
  });

  if (parts.length === 0) return '';
  const text = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  return `Some areas of potential friction: ${text}. This does not mean you cannot succeed — it means these aspects of the work may feel less natural to you.`;
}

// --------------------------------------------------------
// Generate opposite-fit explanation for low-ranked specialties.
// Uses ONLY the largest trait gaps from the scoring engine.
// --------------------------------------------------------
export function generateOppositeFitExplanation(result: SpecialtyScore): string {
  const weakest = weakestMatches(result, 4);
  if (weakest.length === 0) return '';

  const parts = weakest.map((w) => {
    const traitName = prettyTrait(w.trait);
    const studentDesc = w.student < w.target ? 'less' : 'more';
    return `you tend toward ${studentDesc} ${traitName.toLowerCase()} than this specialty typically involves`;
  });

  const text = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  return `This specialty scored lower because ${text}. These are differences in fit, not personal weaknesses — they reflect where your natural tendencies and the demands of this field diverge.`;
}

// --------------------------------------------------------
// Get the student's top traits for display.
// --------------------------------------------------------
export function getTopTraits(traits: Record<string, number>, topN = 15): { trait: Trait; score: number }[] {
  return (Object.entries(traits) as [Trait, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([trait, score]) => ({ trait, score }));
}

// --------------------------------------------------------
// Get the student's bottom traits for display.
// --------------------------------------------------------
export function getBottomTraits(traits: Record<string, number>, bottomN = 8): { trait: Trait; score: number }[] {
  return (Object.entries(traits) as [Trait, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, bottomN)
    .map(([trait, score]) => ({ trait, score }));
}

// --------------------------------------------------------
// Compute a comparison axis value for a specialty.
// Returns 0-100 based on the specialty's profile traits.
// --------------------------------------------------------
export function getSpecialtyAxisValue(specialty: Specialty, axisTraits: Trait[], positive: boolean): number {
  let total = 0;
  let count = 0;
  for (const trait of axisTraits) {
    const entry = specialty.profile[trait];
    if (entry) {
      total += entry[0];
      count++;
    }
  }
  if (count === 0) return 50;
  const avg = total / count;
  return positive ? avg : 100 - avg;
}

// --------------------------------------------------------
// Get student's axis value from computed traits.
// --------------------------------------------------------
export function getStudentAxisValue(traits: Record<string, number>, axisTraits: Trait[], positive: boolean): number {
  let total = 0;
  let count = 0;
  for (const trait of axisTraits) {
    const val = traits[trait];
    if (val !== undefined) {
      total += val;
      count++;
    }
  }
  if (count === 0) return 50;
  const avg = total / count;
  return positive ? avg : 100 - avg;
}

export { DEFAULT_PRIORITY_WEIGHTS, type Dimension };
