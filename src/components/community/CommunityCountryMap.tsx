import { useEffect, useMemo, useState } from 'react';
import { communityApi } from '@/lib/community';
import { useLanguage } from '@/lib/LanguageContext';
import { getCountryName } from '@/data/geography';
import { COMMUNITY_COPY } from '@/data/communityI18n';
import world from '@/data/worldMapPaths.json';
import { CARD, SECONDARY } from './CommunityShell';

/** Independent community-country aggregates: never mixed with research participation. */
export default function CommunityCountryMap() {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [countries, setCountries] = useState<{ country_code: string; count: number }[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailed(false); setCountries([]); setEnabled(false);
    void communityApi.map(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setEnabled(value.enabled);
      // The API enforces the protocol. These checks fail closed if a response changes.
      if (value.countries.some(country => !Number.isSafeInteger(country.count) || country.count < 10 || country.count % 5 !== 0)) throw new Error('Invalid aggregate');
      if (value.enabled) setCountries(value.countries);
    }).catch(() => { if (!controller.signal.aborted) { setCountries([]); setFailed(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const byCountry = useMemo(() => new Map(countries.map(item => [item.country_code, item.count])), [countries]);
  const format = new Intl.NumberFormat(lang);
  if (!loading && !failed && !enabled) return null;
  return <section className={`${CARD} mt-7`} aria-labelledby="community-map-title" data-community-map>
    <h2 id="community-map-title" className="text-2xl font-semibold text-ink-900">{copy.communityMap}</h2>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-600">{copy.communityMapHelp}</p>
    {loading && <p role="status" className="mt-4 text-sm">{copy.loading}</p>}
    {failed && <div className="mt-4"><p role="alert" className="text-sm text-red-700">{copy.failed}</p><button className={`${SECONDARY} mt-3`} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button></div>}
    {!loading && !failed && enabled && <>
      <svg viewBox={`0 0 ${world.width} ${world.height}`} role="img" aria-label={copy.communityMap} className="mt-5 block w-full rounded-xl bg-[#edf3f8]">
        {world.paths.map(country => <path key={country.id} d={country.d} fill={country.code && byCountry.has(country.code) ? '#356fa6' : '#dce4eb'} fillRule="evenodd" stroke="#fff" strokeWidth={0.6} vectorEffect="non-scaling-stroke"><title>{country.code ? `${getCountryName(country.code, lang)}${byCountry.has(country.code) ? `: ≈ ${format.format(byCountry.get(country.code)!)}` : ''}` : ''}</title></path>)}
      </svg>
      {countries.length ? <dl className="mt-5 grid gap-3 sm:grid-cols-2">{countries.map(country => <div key={country.country_code} className="flex justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3 text-sm"><dt>{getCountryName(country.country_code, lang)}</dt><dd className="font-semibold tabular-nums text-brand-800">≈ {format.format(country.count)}</dd></div>)}</dl> : <p className="mt-4 text-sm text-ink-500">{copy.noCountries}</p>}
      <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs text-ink-500 underline underline-offset-4">{copy.mapAttribution}</a>
    </>}
  </section>;
}
