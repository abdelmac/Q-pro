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

export function getLocalizedNarrativeText(
  text: LocalizedNarrativeText,
  language: Language,
): string {
  return text[language] || text.en;
}
