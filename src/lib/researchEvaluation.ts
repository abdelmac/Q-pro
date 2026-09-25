import { SPECIALTIES, type Specialty } from '@/data/specialties';
import { ALL_QUESTION_IDS } from '@/data/questions';
import { analyzeSpecialistResponse, parseRatings, CALIBRATION_TRAITS, type SpecialistResponseRow } from './researchDashboard';

export interface RankObservation { rankMin: number; rankMax: number }
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null;
};

/** All rates use rankable submissions, not unique participants, as denominator. */
export function summarizeRanks(observations: RankObservation[]) {
  const n = observations.length;
  return {
    n,
    recall: [1, 3, 5, 10].map(k => ({
      k, n,
      inclusiveHits: observations.filter(row => row.rankMin <= k).length,
      conservativeHits: observations.filter(row => row.rankMax <= k).length,
      inclusive: n ? observations.filter(row => row.rankMin <= k).length / n : null,
      conservative: n ? observations.filter(row => row.rankMax <= k).length / n : null,
    })),
    meanReciprocalRank: {
      inclusive: mean(observations.map(row => 1 / row.rankMin)),
      conservative: mean(observations.map(row => 1 / row.rankMax)),
    },
    medianActualRank: {
      inclusive: median(observations.map(row => row.rankMin)),
      conservative: median(observations.map(row => row.rankMax)),
    },
    tied: observations.filter(row => row.rankMin !== row.rankMax).length,
    uncertaintyIntervals: null,
    uncertaintyReason: 'Independent participant sampling is not established; no population confidence interval is claimed.',
    warning: n < 30 ? 'Very small descriptive sample; not validation.' : 'Descriptive sample only; sample size does not establish validation.',
  };
}

function distribution(values: number[], denominator: number) {
  const average = mean(values);
  return {
    n: values.length, denominator, missing: denominator - values.length,
    mean: average, median: median(values),
    sampleStandardDeviation: values.length < 2 || average === null ? null
      : Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)),
    histogram: Array.from({ length: 10 }, (_, bin) => ({
      from: bin * 10, through: (bin + 1) * 10, upperInclusive: bin === 9,
      count: values.filter(value => value >= bin * 10 && (bin === 9 ? value <= 100 : value < (bin + 1) * 10)).length,
    })),
  };
}

/** Bounded operator-only analysis. Never called by the public app or whole-cohort browser UI. */
export function buildResearchEvaluation(rows: SpecialistResponseRow[], catalog: readonly Specialty[] = SPECIALTIES) {
  const evaluated = rows.map(row => ({ row, analysis: analyzeSpecialistResponse(row, catalog) }));
  const eligible = evaluated.filter(item => item.analysis.eligible);
  const rankable = eligible.filter(item => item.analysis.actualRankMin !== null && item.analysis.actualRankMax !== null);
  const summarize = (items: typeof rankable) => summarizeRanks(items.map(({ analysis }) => ({ rankMin: analysis.actualRankMin!, rankMax: analysis.actualRankMax! })));
  const grouped = (key: (row: SpecialistResponseRow) => string) => {
    const groups = new Map<string, typeof rankable>();
    for (const item of rankable) { const name = key(item.row); groups.set(name, [...(groups.get(name) ?? []), item]); }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => ({ name, ...summarize(items) }));
  };
  const bySpecialty = grouped(row => row.actual_specialty);
  const profiles = (key: (row: SpecialistResponseRow) => string, useTarget: boolean) => {
    const groups = new Map<string, typeof eligible>();
    for (const item of eligible) { const name = key(item.row); groups.set(name, [...(groups.get(name) ?? []), item]); }
    return [...groups].map(([name, items]) => ({ name, n: items.length, traits: CALIBRATION_TRAITS.map(trait => {
      const base = distribution(items.flatMap(item => item.analysis.baseTraits[trait] === undefined ? [] : [item.analysis.baseTraits[trait]]), items.length);
      const adjusted = distribution(items.flatMap(item => item.analysis.adjustedTraits[trait] === undefined ? [] : [item.analysis.adjustedTraits[trait]]), items.length);
      const targetProfile = useTarget ? catalog.find(specialty => specialty.name === name)?.profile : undefined;
      const target = targetProfile?.[trait as keyof typeof targetProfile]?.[0] ?? null;
      return { trait, base, adjusted, target, gap: target !== null && adjusted.mean !== null && adjusted.n === items.length ? adjusted.mean - target : null };
    }) }));
  };
  const fingerprints = new Map<string, string[]>();
  const qualityFlags = rows.flatMap(row => {
    const ratings = parseRatings(row.ratings);
    const values = ALL_QUESTION_IDS.map(id => ratings[id]).filter(value => value !== undefined);
    if (!row.questionnaire_completed || values.length !== ALL_QUESTION_IDS.length) return [];
    const fingerprint = JSON.stringify(ALL_QUESTION_IDS.map(id => ratings[id]));
    fingerprints.set(fingerprint, [...(fingerprints.get(fingerprint) ?? []), row.id]);
    const levels = new Set(values).size;
    return levels <= 2 ? [{ id: row.id, flag: levels === 1 ? 'straight_line' : 'two_response_levels', automaticExclusion: false }] : [];
  });
  return {
    method: 'canonical-default-exact-ties-v3',
    basis: 'Current frozen model, default priorities; not reconstruction of participant results or trained-model validation.',
    total: rows.length, eligible: eligible.length, excluded: rows.length - eligible.length,
    exclusions: evaluated.filter(item => !item.analysis.eligible).map(item => ({ id: item.row.id, reasons: item.analysis.exclusionReasons })),
    personalizedSettingsRecorded: rows.filter(row => row.scoring_context != null).length,
    participantWeighted: summarize(rankable), bySpecialty,
    byLanguage: grouped(row => row.language),
    byCountry: grouped(row => row.country_code ?? 'missing'),
    byRechoice: grouped(row => row.would_choose_again_code ?? 'missing'),
    byExperience: grouped(row => row.years_of_experience === null ? 'missing' : row.years_of_experience < 5 ? '0-4' : row.years_of_experience < 15 ? '5-14' : '15+'),
    specialtyBalanced: {
      nSpecialties: bySpecialty.length,
      definition: 'Arithmetic mean of nonempty specialty-specific metrics; each observed specialty has equal weight.',
      recall: [1, 3, 5, 10].map((k, index) => ({ k,
        inclusive: mean(bySpecialty.map(group => group.recall[index].inclusive!)),
        conservative: mean(bySpecialty.map(group => group.recall[index].conservative!)),
      })),
      meanReciprocalRank: {
        inclusive: mean(bySpecialty.map(group => group.meanReciprocalRank.inclusive!)),
        conservative: mean(bySpecialty.map(group => group.meanReciprocalRank.conservative!)),
      },
    },
    specialtyProfiles: profiles(row => row.actual_specialty, true),
    familyProfiles: profiles(row => catalog.find(specialty => specialty.name === row.actual_specialty)?.category ?? 'unknown', false),
    qualityFlags,
    repeatedAnswerVectors: [...fingerprints.values()].filter(ids => ids.length > 1).map(ids => ({ ids, automaticExclusion: false, note: 'Identical answers do not prove duplicate people.' })),
    interpretation: 'Traits are self-reports, not objectively tested competence. Partial or unmeasured traits are never filled with neutral scores. manual_orientation and prevention_orientation remain structural limitations. No automatic target or weight changes.',
  };
}
