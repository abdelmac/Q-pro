import countryData from './countries.json';
import type { Language } from './i18n';

export const COUNTRIES = countryData;
export const COUNTRY_CODES = COUNTRIES.map(country => country.code);
export const GEOGRAPHY_REGION_MAX_LENGTH = 100;
const countryCodes = new Set(COUNTRY_CODES);

export interface GeographyDraft {
  countryCode: string;
  region: string;
}

export function isValidCountryCode(value: unknown): value is string {
  return typeof value === 'string' && countryCodes.has(value);
}

export function getCountryName(code: string, language: Language): string {
  return COUNTRIES.find(country => country.code === code)?.[language] ?? code;
}

export function countryOptions(language: Language) {
  return COUNTRIES.map(country => ({ code: country.code, name: country[language] }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
}

/** Explicit, optional country/region only; never infer a location from the browser. */
export function normalizeGeography(draft: GeographyDraft): { countryCode: string | null; region: string | null } {
  const countryCode = draft.countryCode.trim().toUpperCase();
  const region = draft.region.trim();
  if (countryCode && !isValidCountryCode(countryCode)) throw new Error('Invalid country code');
  const containsControlCharacters = [...region].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (region && (!countryCode || region.length > GEOGRAPHY_REGION_MAX_LENGTH || containsControlCharacters)) {
    throw new Error('Invalid region');
  }
  return { countryCode: countryCode || null, region: region || null };
}
