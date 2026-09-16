import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Globe2, Loader2, Minus, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { countryOptions, getCountryName } from '@/data/geography';
import { MAP_TRANSLATIONS, type MapStrings } from '@/data/mapI18n';
import world from '@/data/worldMapPaths.json';
import {
  areValidMapDates, DEFAULT_MAP_FILTERS, fetchParticipationMapStats, latestClosedMonth,
  type ParticipationMapFilters, type ParticipationMapStats,
} from '@/lib/participationMap';
import PageBackButton from './PageBackButton';
import LanguageSwitcher from './LanguageSwitcher';

interface ParticipationMapProps { onBack: () => void }
interface View { x: number; y: number; scale: number }
const INITIAL_VIEW: View = { x: 0, y: 0, scale: 1 };
const BUTTON = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40';
const COLORS = ['#d2e2f2', '#a2c1e1', '#6295c4', '#356fa6', '#163e6d'];

function boundedView(view: View): View {
  const scale = Math.max(1, Math.min(8, view.scale));
  return { scale, x: Math.max(0, Math.min(world.width - world.width / scale, view.x)), y: Math.max(0, Math.min(world.height - world.height / scale, view.y)) };
}

function MapFilters({ value, onChange, onApply, onReset, copy, prefix }: {
  value: ParticipationMapFilters; onChange: (next: ParticipationMapFilters) => void;
  onApply: () => void; onReset: () => void; copy: MapStrings; prefix: string;
}) {
  const { lang } = useLanguage();
  const options = useMemo(() => countryOptions(lang), [lang]);
  const invalidDates = !areValidMapDates(value);
  const fields = 'min-h-12 w-full min-w-0 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400';
  const update = (patch: Partial<ParticipationMapFilters>) => onChange({ ...value, ...patch });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!invalidDates) onApply(); };
  return <form onSubmit={submit} className="space-y-5">
    <div>
      <label htmlFor={`${prefix}-country`} className="mb-1.5 block text-sm font-medium text-ink-700">{copy.country}</label>
      <select id={`${prefix}-country`} value={value.countryCode} onChange={event => update({ countryCode: event.target.value })} className={fields}>
        <option value="">{copy.allCountries}</option>
        {options.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor={`${prefix}-language`} className="mb-1.5 block text-sm font-medium text-ink-700">{copy.language}</label>
      <select id={`${prefix}-language`} value={value.language} onChange={event => update({ language: event.target.value as ParticipationMapFilters['language'] })} className={fields}>
        <option value="all">{copy.allLanguages}</option><option value="en">{copy.english}</option><option value="fr">{copy.french}</option><option value="ro">{copy.romanian}</option>
      </select>
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
      {(['monthFrom', 'monthTo'] as const).map(key => <div key={key} className="min-w-0">
        <label htmlFor={`${prefix}-${key}`} className="mb-1.5 block text-sm font-medium text-ink-700">{copy[key]}</label>
        <input id={`${prefix}-${key}`} type="month" min="1900-01" max={latestClosedMonth()} value={value[key]} onChange={event => update({ [key]: event.target.value })} className={fields} aria-invalid={invalidDates} aria-describedby={invalidDates ? `${prefix}-date-error` : undefined} />
      </div>)}
    </div>
    {invalidDates && <p id={`${prefix}-date-error`} role="alert" className="text-sm text-red-700">{copy.invalidDates}</p>}
    <div>
      <label htmlFor={`${prefix}-version`} className="mb-1.5 block text-sm font-medium text-ink-700">{copy.version}</label>
      <select id={`${prefix}-version`} value={value.dataVersion} onChange={event => update({ dataVersion: event.target.value as ParticipationMapFilters['dataVersion'] })} className={fields}>
        <option value="all">{copy.allVersions}</option><option value="current">{copy.currentVersion}</option>
      </select>
    </div>
    <button type="submit" disabled={invalidDates} className="min-h-12 w-full rounded-full bg-brand-800 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-40">{copy.applyFilters}</button>
    <button type="button" onClick={onReset} className="min-h-11 w-full text-sm font-medium text-ink-600 hover:text-brand-800">{copy.resetFilters}</button>
  </form>;
}

export default function ParticipationMap({ onBack }: ParticipationMapProps) {
  const { lang } = useLanguage();
  const copy = MAP_TRANSLATIONS[lang];
  const [filters, setFilters] = useState<ParticipationMapFilters>({ ...DEFAULT_MAP_FILTERS });
  const [draft, setDraft] = useState<ParticipationMapFilters>({ ...DEFAULT_MAP_FILTERS });
  const [stats, setStats] = useState<ParticipationMapStats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number; originX: number; originY: number; code: string | null; moved: boolean }>());
  const numbers = useMemo(() => new Intl.NumberFormat(lang), [lang]);
  const approximate = (value: number) => value === 0 ? '0' : `≈ ${numbers.format(value)}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setStats(null); setError(false); setSelectedCode(null);
    fetchParticipationMapStats(filters, controller.signal).then(result => {
      if (!controller.signal.aborted) setStats(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, retry]);

  const byCountry = useMemo(() => new Map(stats?.groups.map(group => [group.countryCode, group]) ?? []), [stats]);
  const maxCount = Math.max(10, ...(stats?.groups.map(group => group.count) ?? []));
  const selected = selectedCode ? byCountry.get(selectedCode) : undefined;
  const sortedGroups = useMemo(() => [...(stats?.groups ?? [])].sort((a, b) => b.count - a.count || getCountryName(a.countryCode, lang).localeCompare(getCountryName(b.countryCode, lang), lang)), [stats, lang]);

  const selectCountry = (code: string) => {
    setSelectedCode(code);
    // The persistent details panel also makes the interaction usable without hover.
    requestAnimationFrame(() => detailsRef.current?.focus({ preventScroll: false }));
  };
  const zoom = (factor: number) => setView(previous => {
    const scale = Math.max(1, Math.min(8, previous.scale * factor));
    return boundedView({ scale, x: previous.x + world.width / previous.scale / 2 - world.width / scale / 2, y: previous.y + world.height / previous.scale / 2 - world.height / scale / 2 });
  });
  const pan = (x: number, y: number) => setView(previous => boundedView({ ...previous, x: previous.x + x * world.width / previous.scale, y: previous.y + y * world.height / previous.scale }));
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Mobile browsers may retarget tiny SVG regions to a neighbouring country
    // using touch-radius heuristics. Hit-test the actual finger coordinate.
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const code = hit?.closest('[data-country]')?.getAttribute('data-country') ?? null;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, code, moved: pointers.current.size > 0 });
    if (pointers.current.size > 1) for (const pointer of pointers.current.values()) pointer.moved = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (Math.hypot(event.clientX - previous.originX, event.clientY - previous.originY) > 5) previous.moved = true;
    const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 5 && after > 5) zoom(after / before);
    } else if (previous.moved) {
      const bounds = event.currentTarget.getBoundingClientRect();
      setView(current => boundedView({ ...current, x: current.x - dx * world.width / bounds.width / current.scale, y: current.y - dy * world.height / bounds.height / current.scale }));
    }
    previous.x = event.clientX; previous.y = event.clientY;
  };
  const pointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pointer = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && pointer?.code && !pointer.moved) selectCountry(pointer.code);
  };

  const applyFilters = () => { setFilters({ ...draft }); dialogRef.current?.close(); };
  const resetFilters = () => { setDraft({ ...DEFAULT_MAP_FILTERS }); setFilters({ ...DEFAULT_MAP_FILTERS }); dialogRef.current?.close(); };
  const respondentOptions = [
    ['all', copy.all], ['non_medical', copy.nonMedical], ['student', copy.students], ['specialist', copy.specialists],
  ] as const;
  const counters = [
    [copy.total, stats?.total], [copy.countries, stats?.countries], [copy.students, stats?.students], [copy.specialists, stats?.specialists], [copy.nonMedical, stats?.nonMedical],
  ] as const;

  return <div className="min-h-screen bg-[#f6f8fb]">
    <header className="border-b border-ink-100 bg-white px-4 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <PageBackButton label={copy.back} onClick={onBack} />
        <div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs font-medium text-brand-800 sm:flex"><Globe2 className="h-4 w-4" aria-hidden="true" />{copy.publicLabel}</span><LanguageSwitcher /></div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-500">{copy.subtitle}</p>

      <div className="mt-7 rounded-2xl border border-brand-100 bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" /><div className="text-xs leading-relaxed text-ink-600"><p>{copy.privacy}</p><p className="mt-1">{copy.privacyRegion}</p></div></div>
        {stats && <p className="mt-3 text-xs font-medium text-brand-800">{stats.publishedThrough ? `${copy.publishedThrough} ${new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${stats.publishedThrough}T00:00:00Z`))}` : copy.pending}</p>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy={loading}>
        {counters.map(([label, value], index) => <div key={label} className={`rounded-2xl border p-4 sm:p-5 ${index === 0 ? 'col-span-2 border-brand-800 bg-brand-800 text-white sm:col-span-1' : 'border-ink-100 bg-white text-ink-900'}`}>
          <p className={`text-xs font-medium ${index === 0 ? 'text-blue-100' : 'text-ink-500'}`}>{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{value === undefined ? '—' : index === 1 ? numbers.format(value) : approximate(value)}</p>
        </div>)}
      </div>

      <div className="mb-6 mt-7 flex flex-wrap items-center gap-2" aria-label={copy.filters}>
        {respondentOptions.map(([type, label]) => <button key={type} type="button" aria-pressed={filters.respondentType === type} onClick={() => { setFilters(previous => ({ ...previous, respondentType: type })); setDraft(previous => ({ ...previous, respondentType: type })); }} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition ${filters.respondentType === type ? 'border-brand-800 bg-brand-800 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-400'}`}>{label}</button>)}
        <button type="button" className={`${BUTTON} ml-auto gap-2 lg:hidden`} onClick={() => dialogRef.current?.showModal()}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{copy.filters}</button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-ink-100 bg-white p-5 lg:block">
          <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-ink-800"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{copy.filters}</h2>
          <MapFilters value={draft} onChange={setDraft} onApply={applyFilters} onReset={resetFilters} copy={copy} prefix="desktop-map" />
        </aside>
        <div className="min-w-0">
          <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white" aria-label={copy.mapLabel} aria-busy={loading}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 p-3">
              <div className="flex gap-1">
                <button type="button" className={BUTTON} onClick={() => zoom(1.5)} disabled={view.scale >= 8} aria-label={copy.zoomIn}><Plus className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className={BUTTON} onClick={() => zoom(1 / 1.5)} disabled={view.scale <= 1} aria-label={copy.zoomOut}><Minus className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className={BUTTON} onClick={() => setView(INITIAL_VIEW)} aria-label={copy.resetView}><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
              </div>
              <div className="flex gap-1">
                {([[copy.panLeft, ArrowLeft, -0.2, 0], [copy.panUp, ArrowUp, 0, -0.2], [copy.panDown, ArrowDown, 0, 0.2], [copy.panRight, ArrowRight, 0.2, 0]] as const).map(([label, Icon, dx, dy]) => <button key={label} type="button" className={BUTTON} disabled={view.scale <= 1} onClick={() => pan(dx, dy)} aria-label={label}><Icon className="h-4 w-4" aria-hidden="true" /></button>)}
              </div>
            </div>
            <div className="relative bg-[#edf3f8]">
              <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${world.width / view.scale} ${world.height / view.scale}`} className="block w-full cursor-grab touch-none active:cursor-grabbing" style={{ aspectRatio: `${world.width} / ${world.height}` }} role="group" aria-label={copy.mapLabel} aria-describedby="participation-map-help" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
                {world.paths.map(country => {
                  const group = country.code ? byCountry.get(country.code) : undefined;
                  const label = country.code ? `${getCountryName(country.code, lang)}: ${group ? `${copy.total} ${approximate(group.count)}` : copy.noPublished}` : undefined;
                  const fill = group ? COLORS[Math.min(4, Math.floor(Math.sqrt(group.count / maxCount) * 4))] : '#dce4eb';
                  return <path key={country.id} d={country.d} fill={fill} fillRule="evenodd" stroke={selectedCode && selectedCode === country.code ? '#c68c2f' : '#ffffff'} strokeWidth={selectedCode === country.code && country.code ? 2 : 0.6} vectorEffect="non-scaling-stroke" data-country={country.code ?? undefined} role={country.code ? 'button' : undefined} tabIndex={country.code && group ? 0 : undefined} aria-label={label} aria-pressed={country.code ? selectedCode === country.code : undefined} onKeyDown={event => { if (country.code && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectCountry(country.code); } }} className={country.code ? 'cursor-pointer outline-none hover:brightness-90 focus:stroke-amber-600 focus:stroke-[2px]' : undefined}><title>{label}</title></path>;
                })}
              </svg>
              {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/65" role="status"><span className="flex items-center gap-2 rounded-xl bg-white p-4 text-sm text-brand-800 shadow-sm"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{copy.loading}</span></div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px] text-ink-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#dce4eb]" />{copy.noPublished}</span>
              <span className="inline-flex items-center gap-2">{copy.fewer}<span className="inline-flex">{COLORS.map(color => <span key={color} className="h-3 w-4" style={{ backgroundColor: color }} />)}</span>{copy.more}</span>
            </div>
            <p id="participation-map-help" className="border-t border-ink-100 px-4 py-3 text-xs leading-relaxed text-ink-500">{copy.mapHelp}</p>
          </section>

          <div aria-live="polite" className="mt-4">
            {error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p>{copy.error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className={`${BUTTON} mt-3`}>{copy.retry}</button></div>}
            {!loading && !error && stats?.total === 0 && <div className="rounded-2xl border border-ink-200 bg-white p-5"><p className="font-medium text-ink-800">{copy.empty}</p><p className="mt-2 text-sm leading-relaxed text-ink-500">{copy.emptyDetail}</p></div>}
          </div>

          <section ref={detailsRef} tabIndex={-1} aria-label={copy.details} className="mt-5 rounded-2xl border border-brand-100 bg-white p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {selectedCode ? <>
              <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold text-ink-900">{getCountryName(selectedCode, lang)}</h2><button type="button" className={BUTTON} onClick={() => setSelectedCode(null)} aria-label={copy.close}><X className="h-4 w-4" aria-hidden="true" /></button></div>
              {selected ? <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">{([[copy.total, selected.count], [copy.students, selected.students], [copy.specialists, selected.specialists], [copy.nonMedical, selected.nonMedical]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-ink-500">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-brand-800">{approximate(value)}</dd></div>)}</dl> : <p className="text-sm text-ink-500">{copy.noCountryData}</p>}
            </> : <p className="text-sm leading-relaxed text-ink-500">{copy.selectCountry}</p>}
          </section>

          {sortedGroups.length > 0 && <section className="mt-7"><h2 className="mb-3 text-base font-semibold text-ink-800">{copy.countryList}</h2><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{sortedGroups.map(group => <button key={group.countryCode} type="button" onClick={() => selectCountry(group.countryCode)} aria-pressed={selectedCode === group.countryCode} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left text-sm hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><span>{getCountryName(group.countryCode, lang)}</span><span className="shrink-0 font-semibold tabular-nums text-brand-800">{approximate(group.count)}</span></button>)}</div></section>}
          <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs text-ink-500 underline decoration-ink-200 underline-offset-4">{copy.attribution}</a>
        </div>
      </div>
    </main>
    <dialog ref={dialogRef} aria-labelledby="map-filter-title" className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl backdrop:bg-ink-900/50 sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-3xl" onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
      <div className="mb-6 flex items-center justify-between"><h2 id="map-filter-title" className="text-xl font-semibold text-ink-900">{copy.filters}</h2><button type="button" className={BUTTON} onClick={() => dialogRef.current?.close()} aria-label={copy.close}><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <MapFilters value={draft} onChange={setDraft} onApply={applyFilters} onReset={resetFilters} copy={copy} prefix="mobile-map" />
    </dialog>
  </div>;
}
