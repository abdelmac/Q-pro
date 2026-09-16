import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { countryOptions, GEOGRAPHY_REGION_MAX_LENGTH, type GeographyDraft } from '@/data/geography';
import { MAP_TRANSLATIONS } from '@/data/mapI18n';

interface GeographyFieldsProps {
  value: GeographyDraft;
  onChange: (value: GeographyDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
}

export default function GeographyFields({ value, onChange, disabled = false, idPrefix = 'geography' }: GeographyFieldsProps) {
  const { lang } = useLanguage();
  const copy = MAP_TRANSLATIONS[lang];
  const options = useMemo(() => countryOptions(lang), [lang]);
  const fieldClass = 'min-h-12 w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50';

  return (
    <fieldset disabled={disabled} className="my-7 rounded-2xl border border-brand-100 bg-brand-50/40 p-5">
      <legend className="px-1 text-sm font-semibold text-ink-800">
        <MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" />{copy.geographyTitle}{' '}
        <span className="font-normal text-ink-500">({copy.optional})</span>
      </legend>
      <p id={`${idPrefix}-help`} className="mb-5 text-xs leading-relaxed text-ink-600">{copy.geographyHelp}</p>
      <label htmlFor={`${idPrefix}-country`} className="mb-1.5 block text-sm font-medium text-ink-700">{copy.country}</label>
      <select
        id={`${idPrefix}-country`}
        value={value.countryCode}
        aria-describedby={`${idPrefix}-help`}
        onChange={event => onChange({ countryCode: event.target.value, region: '' })}
        className={fieldClass}
      >
        <option value="">{copy.countryPlaceholder}</option>
        {options.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
      </select>
      <label htmlFor={`${idPrefix}-region`} className="mb-1.5 mt-5 block text-sm font-medium text-ink-700">{copy.region}</label>
      <input
        id={`${idPrefix}-region`}
        value={value.region}
        onChange={event => onChange({ ...value, region: event.target.value })}
        disabled={disabled || !value.countryCode}
        type="text"
        maxLength={GEOGRAPHY_REGION_MAX_LENGTH}
        autoComplete="off"
        placeholder={copy.regionPlaceholder}
        aria-describedby={`${idPrefix}-region-help`}
        className={fieldClass}
      />
      <p id={`${idPrefix}-region-help`} className="mt-2 text-xs leading-relaxed text-ink-500">
        {value.countryCode ? copy.regionHelp : copy.regionUnavailable}
      </p>
    </fieldset>
  );
}
