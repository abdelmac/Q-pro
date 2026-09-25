import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_QUESTION_IDS } from '@/data/questions';
import { translateQuestion } from '@/data/i18n';
import { useLanguage } from '@/lib/LanguageContext';
import { normalizedResearchFilters, researchRequest, downloadResearchJson, type AnalysisRun, type SavedCohort, type CohortSummary } from '@/lib/researchAnalytics';

export default function ResearchAnalytics({ testMode, refreshToken = 0 }: { testMode: boolean; refreshToken?: number }) {
  const { lang } = useLanguage();
  const tr = (en: string, fr: string, ro: string) => lang === 'fr' ? fr : lang === 'ro' ? ro : en;
  const [values, setValues] = useState<Record<string, string>>({ questionnaire_version: 'q81-v1' });
  const [question, setQuestion] = useState(ALL_QUESTION_IDS[0]);
  const [otherQuestion, setOtherQuestion] = useState(ALL_QUESTION_IDS[1]);
  const [cohorts, setCohorts] = useState<SavedCohort[]>([]);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [comparison, setComparison] = useState<CohortSummary | null>(null);
  const [cohortName, setCohortName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const filters = useMemo(() => normalizedResearchFilters(values), [values]);
  const serializedFilters = JSON.stringify(filters);
  useEffect(() => {
    generation.current++; abort.current?.abort(); setRun(null); setComparison(null); setBusy(false);
    return () => {
      // This ref is the request epoch, not a DOM ref; advance it on invalidation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++; abort.current?.abort();
    };
  }, [serializedFilters, question, otherQuestion, testMode, refreshToken]);
  useEffect(() => {
    if (testMode) return;
    const controller = new AbortController();
    void Promise.all([
      researchRequest<SavedCohort[]>('list_research_cohorts', undefined as never, controller.signal),
      researchRequest<AnalysisRun[]>('list_research_analysis_runs', undefined as never, controller.signal),
    ]).then(([saved, history]) => { if (!controller.signal.aborted) { setCohorts(saved); setRuns(history); } })
      .catch(() => { if (!controller.signal.aborted) setError('Research analytics requires the latest database migration and an authorized session.'); });
    return () => controller.abort();
  }, [testMode, refreshToken]);
  const execute = async (operation: (signal: AbortSignal) => Promise<void>) => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const request = ++generation.current; setBusy(true); setError(null);
    const timer = setTimeout(() => controller.abort(), 20_000);
    try { await operation(controller.signal); }
    catch (cause) { if (request === generation.current) setError(controller.signal.aborted ? tr('Request cancelled or timed out. No production model changed.', 'Requête annulée ou expirée. Aucun modèle de production modifié.', 'Cerere anulată sau expirată. Modelul de producție nu a fost modificat.') : cause instanceof Error ? cause.message : 'Analysis unavailable'); }
    finally { clearTimeout(timer); if (request === generation.current) setBusy(false); }
  };
  const loadRun = () => execute(async signal => {
    setRun(null); setComparison(null);
    const next = await researchRequest<AnalysisRun>('create_research_analysis_run', { p_filters: filters, p_parameters: { question_id: question, question_a: question, question_b: otherQuestion } }, signal);
    if (!signal.aborted) { setRun(next); setComparison(null); setRuns(previous => [next, ...previous.filter(item => item.id !== next.id)].slice(0, 20)); }
  });
  const setFilter = (key: string, value: string) => setValues(previous => ({ ...previous, [key]: value }));
  const saveCohort = () => execute(async signal => {
    await researchRequest('save_research_cohort', { p_name: cohortName.trim(), p_filters: filters }, signal);
    const next = await researchRequest<SavedCohort[]>('list_research_cohorts', undefined as never, signal);
    if (!signal.aborted) { setCohorts(next); setCohortName(''); }
  });
  const summary = run?.results?.summary;
  const item = run?.results?.question;
  const correlation = run?.results?.correlation;
  const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat(lang, { maximumFractionDigits: 3 }).format(value);
  const inputClass = 'min-h-11 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm';
  const buttonClass = 'min-h-11 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-800 disabled:opacity-40';
  const dimensions = [
    ['respondent_type', tr('Respondent category', 'Public', 'Categoria respondentului')],
    ['language', tr('Language', 'Langue', 'Limbă')], ['country', tr('Country (missing is separate)', 'Pays (absence séparée)', 'Țară (lipsă separat)')],
    ['questionnaire_version', tr('Questionnaire version', 'Version du questionnaire', 'Versiunea chestionarului')],
    ['month', tr('Submissions by month (UTC)', 'Soumissions par mois (UTC)', 'Trimiteri pe lună (UTC)')],
  ];
  const select = (key: string, label: string, options: string[]) => <label className="text-xs font-semibold text-ink-600">{label}<select aria-label={label} className={inputClass} value={values[key] ?? ''} onChange={event => setFilter(key, event.target.value)}><option value="">{tr('All', 'Tous', 'Toate')}</option>{options.map(value => <option key={value} value={value}>{value}</option>)}</select></label>;
  const textFilter = (key: string, label: string, type = 'text') => <label className="text-xs font-semibold text-ink-600">{label}<input className={inputClass} type={type} value={values[key] ?? ''} onChange={event => setFilter(key, event.target.value)} /></label>;
  if (testMode) return <p data-analytics-test-blocked className="rounded-xl bg-amber-50 p-5">{tr('Server analyses are disabled in synthetic test mode. Return to live research to run an authorized analysis.', 'Analyses serveur désactivées en mode synthétique. Revenez aux données réelles pour lancer une analyse autorisée.', 'Analizele server sunt dezactivate în modul sintetic. Revino la cercetare pentru o analiză autorizată.')}</p>;
  return <section data-research-analytics className="space-y-6">
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{tr('Exploratory analyses only. No automatic changes to questions, targets or matching weights. Counts are submissions, not unique people. Missing optional metadata does not invalidate a questionnaire.', 'Analyses exploratoires uniquement. Aucune modification automatique des questions, profils cibles ou poids. Les effectifs sont des soumissions, pas des personnes uniques. Les métadonnées facultatives absentes ne rendent pas un questionnaire invalide.', 'Doar analize exploratorii. Fără modificarea automată a întrebărilor, profilurilor sau ponderilor. Numerele reprezintă trimiteri, nu persoane unice. Metadatele opționale lipsă nu invalidează chestionarul.')}</p>
    <fieldset disabled={busy} className="grid gap-3 rounded-2xl border border-ink-100 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
      <legend className="font-semibold">{tr('Cohort filters', 'Filtres de cohorte', 'Filtre de cohortă')}</legend>
      {select('respondent_type', tr('Category', 'Public', 'Categorie'), ['specialist', 'student', 'non_medical'])}
      {select('language', tr('Language', 'Langue', 'Limbă'), ['en', 'fr', 'ro'])}
      {textFilter('country_code', tr('Country code / missing', 'Code pays / missing', 'Cod țară / missing'))}
      {select('study_year', tr('Study year', 'Année d’étude', 'An de studiu'), ['1', '2', '3', '4', '5', '6'])}
      {textFilter('specialty', tr('Specialty (canonical name)', 'Spécialité (nom canonique)', 'Specialitate (nume canonic)'))}
      {textFilter('date_from', tr('From', 'Depuis', 'De la'), 'date')}{textFilter('date_to', tr('Through', 'Jusqu’au', 'Până la'), 'date')}
      {select('rechoice', tr('Choose again', 'Rechoisirait', 'Ar alege din nou'), ['yes', 'no', 'unsure'])}
      {select('intention_to_change', tr('Intention to change', 'Intention de changer', 'Intenție de schimbare'), ['definitely', 'probably', 'probably_not', 'definitely_not'])}
      {textFilter('experience_min', tr('Minimum experience', 'Expérience minimum', 'Experiență minimă'), 'number')}
      {textFilter('experience_max', tr('Maximum experience', 'Expérience maximum', 'Experiență maximă'), 'number')}
      {textFilter('satisfaction_min', tr('Minimum satisfaction', 'Satisfaction minimum', 'Satisfacție minimă'), 'number')}
      {textFilter('satisfaction_max', tr('Maximum satisfaction', 'Satisfaction maximum', 'Satisfacție maximă'), 'number')}
      {textFilter('questionnaire_version', tr('Questionnaire version', 'Version questionnaire', 'Versiune chestionar'))}
      {textFilter('schema_version', tr('Schema version', 'Version du schéma', 'Versiune schemă'), 'number')}
      {textFilter('consent_version', tr('Consent version', 'Version consentement', 'Versiune consimțământ'))}
      {textFilter('scoring_version', tr('Scoring version', 'Version calcul', 'Versiune calcul'))}
      {textFilter('specialty_config_revision', tr('Profile revision', 'Révision des profils', 'Revizie profiluri'), 'number')}
      <label className="text-xs font-semibold">{tr('Original item', 'Item original', 'Item original')}<select aria-label={tr('Original item', 'Item original', 'Item original')} className={inputClass} value={question} onChange={event => setQuestion(event.target.value)}>{ALL_QUESTION_IDS.map(id => <option key={id}>{id}</option>)}</select></label>
      <label className="text-xs font-semibold">{tr('Correlate with item', 'Corréler avec l’item', 'Corelație cu itemul')}<select aria-label={tr('Correlate with item', 'Corréler avec l’item', 'Corelație cu itemul')} className={inputClass} value={otherQuestion} onChange={event => setOtherQuestion(event.target.value)}>{ALL_QUESTION_IDS.map(id => <option key={id}>{id}</option>)}</select></label>
    </fieldset>
    <p className="rounded-xl bg-white p-4 text-sm">{question}: {translateQuestion(question, lang)}<br />{otherQuestion}: {translateQuestion(otherQuestion, lang)}</p>
    <div className="flex flex-wrap items-center gap-3"><button className={buttonClass} disabled={busy} onClick={() => void loadRun()}>{tr('Run / refresh analysis', 'Lancer / actualiser l’analyse', 'Rulează / actualizează analiza')}</button>{busy && <><span role="status">{tr('Processing on server…', 'Traitement serveur…', 'Procesare pe server…')}</span><button className={buttonClass} onClick={() => abort.current?.abort()}>{tr('Cancel request', 'Annuler la requête', 'Anulează cererea')}</button></>}</div>
    <p className="text-xs text-ink-500">{tr('Pilot limit: 5,000 submissions per frozen analysis; server timeout 10 seconds. Cancellation stops waiting; a server transaction may finish. No raw cohort is downloaded for these statistics.', 'Limite pilote : 5 000 soumissions par analyse figée ; délai serveur de 10 secondes. L’annulation arrête l’attente ; la transaction serveur peut se terminer. Aucune cohorte brute téléchargée pour ces statistiques.', 'Limită pilot: 5.000 de trimiteri per analiză; limită server 10 secunde. Anularea oprește așteptarea; tranzacția server poate continua. Statisticile nu descarcă cohorta brută.')}</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="rounded-2xl border border-ink-100 bg-white p-5"><h3 className="font-semibold">{tr('Saved filters (dynamic cohorts)', 'Filtres enregistrés (cohortes dynamiques)', 'Filtre salvate (cohorte dinamice)')}</h3><p className="my-2 text-xs text-ink-500">{tr('New submissions can change these cohorts. A recorded analysis is a frozen result, not a saved filter.', 'Les nouvelles soumissions peuvent modifier ces cohortes. Une analyse enregistrée est un résultat figé, pas un filtre enregistré.', 'Noile trimiteri pot schimba cohortele. O analiză înregistrată este un rezultat fix, nu un filtru salvat.')}</p><div className="flex flex-wrap gap-2"><input aria-label={tr('Cohort name', 'Nom de cohorte', 'Numele cohortei')} className="min-h-11 rounded-lg border px-3" maxLength={100} value={cohortName} onChange={event => setCohortName(event.target.value)} /><button className={buttonClass} disabled={busy || !cohortName.trim()} onClick={() => void saveCohort()}>{tr('Save filters', 'Enregistrer les filtres', 'Salvează filtrele')}</button></div><ul className="mt-4 space-y-2">{cohorts.map(cohort => <li key={cohort.id} className="flex flex-wrap items-center gap-2"><span className="mr-auto">{cohort.name}</span><button disabled={busy} className={buttonClass} onClick={() => setValues(Object.fromEntries(Object.entries(cohort.filters).map(([key, value]) => [key, String(value)])))}>{tr('Load', 'Charger', 'Încarcă')}</button><button disabled={busy || !summary} className={buttonClass} onClick={() => void execute(async signal => { const next = await researchRequest<CohortSummary>('research_cohort_summary', { p_filters: cohort.filters }, signal); if (!signal.aborted) setComparison(next); })}>{tr('Compare', 'Comparer', 'Compară')}</button><button disabled={busy} className={buttonClass} onClick={() => void execute(async signal => { await researchRequest('delete_research_cohort', { p_id: cohort.id }, signal); if (!signal.aborted) setCohorts(previous => previous.filter(item => item.id !== cohort.id)); })}>{tr('Delete filter', 'Supprimer le filtre', 'Șterge filtrul')}</button></li>)}</ul></section>
    {summary && <>
      <div className="grid gap-3 sm:grid-cols-3">{[[tr('Global submissions', 'Soumissions globales', 'Trimiteri globale'), summary.global_total], [tr('Filtered submissions', 'Soumissions filtrées', 'Trimiteri filtrate'), summary.total], [tr('Eligible / excluded', 'Admissibles / exclues', 'Eligibile / excluse'), `${summary.eligible} / ${summary.excluded}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-5"><p className="text-xs text-ink-500">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div>
      <p className="text-sm">{tr('Missing geography', 'Géographie absente', 'Geografie lipsă')}: {summary.missing_geography}/{summary.total}. {tr('Completion time, abandonment and unique participants: unavailable (events not collected). Historical personalized settings: unavailable; never reconstructed.', 'Durée, abandon et participants uniques : indisponibles (événements non collectés). Réglages personnalisés historiques : indisponibles, jamais reconstruits.', 'Durată, abandon și participanți unici: indisponibile (evenimente necolectate). Setări personalizate istorice: indisponibile; niciodată reconstruite.')}</p>
      <ul className="text-sm">{summary.exclusions.map(reason => <li key={reason.reason}>{reason.reason}: {reason.count}/{summary.total}</li>)}</ul>
      <div className="grid gap-4 lg:grid-cols-2">{dimensions.map(([dimension, label]) => <section key={dimension} className="rounded-xl bg-white p-5"><h3 className="mb-3 font-semibold">{label}</h3>{(summary.counts[dimension] ?? []).map((group, index) => <div key={`${group.key}-${index}`} className="mb-2"><div className="flex justify-between text-xs"><span>{group.key ?? 'missing'}</span><span>{group.count}/{summary.total}</span></div><div className="mt-1 h-2 rounded bg-ink-100"><div className="h-2 rounded bg-brand-600" style={{ width: `${summary.total ? group.count / summary.total * 100 : 0}%` }} /></div></div>)}</section>)}</div>
      {comparison && <section className="rounded-xl border bg-white p-5"><h3 className="font-semibold">{tr('Cohort comparison', 'Comparaison de cohortes', 'Comparație cohorte')}</h3><p className="my-2 text-sm text-amber-800">{tr('Cohorts may overlap; they are not independent samples. The comparison cohort is a live summary, not the frozen analysis snapshot. Do not pool incompatible versions.', 'Les cohortes peuvent se chevaucher ; elles ne sont pas indépendantes. La cohorte comparée est un résumé actuel, pas l’instantané figé. Ne regroupez pas les versions incompatibles.', 'Cohortele se pot suprapune; nu sunt independente. Cohorta comparată este un rezumat curent, nu instantaneul fix. Nu combina versiuni incompatibile.')}</p><table className="w-full text-left text-sm"><thead><tr><th>{tr('Metric', 'Indicateur', 'Indicator')}</th><th>A ({summary.generated_at})</th><th>B ({comparison.generated_at})</th></tr></thead><tbody>{(['total', 'eligible', 'excluded', 'missing_geography'] as const).map(key => <tr key={key}><th className="py-2">{key}</th><td>{summary[key]}/{summary.total}</td><td>{comparison[key]}/{comparison.total}</td></tr>)}</tbody></table></section>}
      {item && <section className="rounded-xl bg-white p-5"><h3 className="font-semibold">{item.question_id} · {tr('Original responses (not reverse-scored)', 'Réponses originales (non inversées)', 'Răspunsuri originale (neinversate)')}</h3><p className="my-3 text-sm">n={item.n}/{item.cohort_total} · {tr('Missing', 'Absents', 'Lipsă')}={item.missing} · {tr('Excluded', 'Exclus', 'Excluse')}={item.excluded} · {tr('Mean / median / sample SD', 'Moyenne / médiane / écart-type', 'Medie / mediană / abatere standard')}={number(item.mean)} / {number(item.median)} / {number(item.stddev)}</p><div className="grid grid-cols-10 gap-1">{item.distribution.map(bin => <div key={bin.value} className="text-center"><div className="flex h-24 items-end rounded bg-brand-50"><div className="w-full rounded bg-brand-500" style={{ height: `${item.n ? bin.count / item.n * 100 : 0}%` }} /></div><p className="text-xs">{bin.value}: {bin.count}</p></div>)}</div><p className="mt-3 text-xs">{tr('Floor / ceiling', 'Plancher / plafond', 'Minim / maxim')}: {item.floor}/{item.n} · {item.ceiling}/{item.n}. {tr('Distribution denominator = eligible complete questionnaires; missingness uses all filtered q81 submissions.', 'Dénominateur = questionnaires complets admissibles ; les absences concernent toutes les soumissions q81 filtrées.', 'Numitor = chestionare complete eligibile; lipsa se referă la toate trimiterile q81 filtrate.')}</p></section>}
      {correlation && <section className="rounded-xl bg-white p-5"><h3 className="font-semibold">{question} × {otherQuestion}</h3><p>r={number(correlation.r)} · n={correlation.n} · {correlation.method}</p><p className="mt-2 text-xs text-ink-600">{tr('Pearson correlation of original responses in eligible complete questionnaires. Exploratory only; not psychological validation. Constant items return no coefficient. |r| ≥ 0.8 is a review flag, never automatic item removal.', 'Corrélation de Pearson des réponses originales admissibles. Exploration uniquement, pas une validation psychologique. Un item constant ne produit pas de coefficient. |r| ≥ 0,8 appelle une revue, jamais une suppression automatique.', 'Corelație Pearson a răspunsurilor originale eligibile. Doar explorare, nu validare psihologică. Itemii constanți nu produc coeficient. |r| ≥ 0,8 indică necesitatea revizuirii, niciodată eliminare automată.')}</p>{correlation.r !== null && Math.abs(correlation.r) >= 0.8 && <p className="text-sm text-amber-800">{tr('Review possible redundancy or shared response effects.', 'Examiner une redondance possible ou des effets de réponse communs.', 'Revizuiește posibila redundanță sau efecte comune de răspuns.')}</p>}</section>}
    </>}
    <section className="rounded-xl bg-white p-5"><h3 className="font-semibold">{tr('Recorded analyses', 'Analyses enregistrées', 'Analize înregistrate')}</h3>{run && <p className="my-3 break-all text-xs">{run.id} · {run.dataset_checksum} · n={run.snapshot_count} · {run.execution_ms}ms · {run.analysis_version} · {run.cache_hit ? 'cached exact snapshot' : run.status}</p>}<ul className="space-y-2">{runs.map(record => <li key={record.id} className="flex flex-wrap items-center gap-2"><span className="mr-auto text-xs">{record.created_at} · n={record.snapshot_count} · {record.status}</span><button disabled={busy} className={buttonClass} onClick={() => void execute(async signal => { const full = await researchRequest<AnalysisRun>('get_research_analysis_run', { p_id: record.id }, signal); if (!signal.aborted) downloadResearchJson(`analysis-${record.id}.json`, full); })}>{tr('Export snapshot JSON', 'Exporter l’instantané JSON', 'Exportă instantaneu JSON')}</button><button disabled={busy} className={buttonClass} onClick={() => void execute(async signal => { await researchRequest('delete_research_analysis_run', { p_id: record.id }, signal); if (!signal.aborted) { setRuns(previous => previous.filter(item => item.id !== record.id)); if (run?.id === record.id) setRun(null); } })}>{tr('Delete result', 'Supprimer le résultat', 'Șterge rezultatul')}</button></li>)}</ul></section>
  </section>;
}
