import type { Language } from './i18n';
import part1 from './specialtyNarratives/part1.json';
import part2 from './specialtyNarratives/part2.json';
import part3 from './specialtyNarratives/part3.json';

export type LocalizedNarrativeText = Readonly<Record<Language, string>>;

export interface SpecialtyNarrative {
  overview: LocalizedNarrativeText;
  fitProfile: LocalizedNarrativeText;
  sourceReferences: readonly string[];
}

export const SPECIALIST_SOURCE_DOCUMENT = Object.freeze({
  language: 'ro' as const,
  sha256: '1E4C334306D56EE90CF007D57756860CC7690E301ABC83D768772F96EAB4E9E7',
  localizedPayloadSha256: '5BAB0FAEEF926B14931708368C056184A044C17630AF1C8F76FD563C14FA0854',
  numberedSections: 58,
  uniqueSpecialties: 57,
  mergedSections: Object.freeze({ Pulmonology: Object.freeze([6, 55] as const) }),
  missingSpecialties: Object.freeze(['Pathology'] as const),
});

export const SPECIALTY_NARRATIVES = Object.freeze({
  ...part1,
  ...part2,
  ...part3,
}) as Readonly<Record<string, SpecialtyNarrative>>;

export function getSpecialtyNarrative(
  specialtyName: string,
): SpecialtyNarrative | undefined {
  return SPECIALTY_NARRATIVES[specialtyName];
}

export function hasSpecialistAuthoredNarrative(specialtyName: string): boolean {
  return specialtyName !== 'Pathology' && getSpecialtyNarrative(specialtyName) !== undefined;
}

export function getLocalizedNarrativeText(
  text: LocalizedNarrativeText,
  language: Language,
): string {
  return text[language] || text.en;
}
