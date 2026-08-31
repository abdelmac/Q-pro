import { useEffect, useMemo, useRef } from 'react';
import { RATING_SECTIONS } from '@/data/questions';
import {
  translateQuestion,
  translateSection,
  translateSpecialtyName,
  translateValue,
  type Language,
} from '@/data/i18n';
import {
  analyzeSpecialistResponse,
  analyzeStudentResponse,
  parseClientScores,
  parseRatings,
  parseSelectedValues,
  type SpecialistResponseRow,
  type StudentResponseRow,
} from '@/lib/researchDashboard';
import { BarChart3, Braces, CheckCircle2, X } from 'lucide-react';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';

export type DetailedResponse =
  | { kind: 'specialist'; row: SpecialistResponseRow }
  | { kind: 'student'; row: StudentResponseRow };

interface ResearchResponseDetailProps {
  response: DetailedResponse;
  lang: Language;
  onClose: () => void;
}

const CODE_LABELS: Record<string, Record<string, string>> = {
  fr: {
    yes: 'Oui', no: 'Non', unsure: 'Incertain',
    definitely: 'Certainement', probably: 'Probablement',
    probably_not: 'Probablement pas', definitely_not: 'Certainement pas',
    fully_voluntary: 'Entièrement volontaire', somewhat_voluntary: 'Partiellement volontaire',
    not_voluntary: 'Non volontaire',
  },
  en: {
    yes: 'Yes', no: 'No', unsure: 'Unsure',
    definitely: 'Definitely', probably: 'Probably',
    probably_not: 'Probably not', definitely_not: 'Definitely not',
    fully_voluntary: 'Fully voluntary', somewhat_voluntary: 'Somewhat voluntary',
    not_voluntary: 'Not voluntary',
  },
};

function codeLabel(code: string | null, lang: Language): string {
  if (code === null) return '—';
  return CODE_LABELS[lang === 'fr' ? 'fr' : 'en'][code] ?? code;
}

function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(1);
}

function formatRank(minimum: number | null, maximum: number | null): string {
  if (minimum === null || maximum === null) return '—';
  return minimum === maximum ? `#${minimum}` : `#${minimum}–${maximum}`;
}

export default function ResearchResponseDetail({ response, lang, onClose }: ResearchResponseDetailProps) {
  const french = lang === 'fr';
  const { specialties, version: activeCatalogVersion } = useSpecialtyCatalog();
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const row = response.row;
  const ratings = useMemo(() => parseRatings(row.ratings), [row.ratings]);
  const selectedValues = useMemo(() => parseSelectedValues(row.selected_values), [row.selected_values]);
  const analysis = useMemo(() => response.kind === 'specialist'
    ? analyzeSpecialistResponse(response.row, specialties)
    : analyzeStudentResponse(response.row, specialties), [response, specialties]);
  const targetProfile = useMemo(() => response.kind === 'specialist'
    ? specialties.find(({ name }) => name === response.row.actual_specialty)?.profile
    : undefined, [response, specialties]);
  const sortedTraits = useMemo(() => Array.from(new Set([
    ...Object.keys(analysis.baseTraits),
    ...Object.keys(analysis.adjustedTraits),
    ...Object.keys(targetProfile ?? {}),
  ])).sort((left, right) => (
    (analysis.adjustedTraits[right] ?? Number.NEGATIVE_INFINITY)
    - (analysis.adjustedTraits[left] ?? Number.NEGATIVE_INFINITY)
  )), [analysis.adjustedTraits, analysis.baseTraits, targetProfile]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const displayedRanking = analysis.ranking.filter(({ rankMin }) => rankMin <= 10);
  const actualOutsideTopTen = response.kind === 'specialist'
    ? analysis.ranking.find(({ name, rankMin }) => name === response.row.actual_specialty && rankMin > 10)
    : undefined;

  const title = response.kind === 'specialist'
    ? translateSpecialtyName(response.row.actual_specialty, lang)
    : response.row.preferred_specialty
      ? translateSpecialtyName(response.row.preferred_specialty, lang)
      : (french ? 'Étudiant sans préférence' : 'Student without preference');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/45 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-detail-title"
        tabIndex={-1}
        className="h-full w-full max-w-4xl overflow-y-auto bg-ink-50 shadow-2xl animate-fade-in"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              {response.kind === 'specialist'
                ? (french ? 'Réponse spécialiste' : 'Specialist response')
                : (french ? 'Réponse étudiante' : 'Student response')}
            </p>
            <h2 id="response-detail-title" className="mt-1 font-display text-2xl font-semibold text-ink-900">{title}</h2>
            <p className="mt-1 break-all font-mono text-[11px] text-ink-400">{row.id}</p>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label={french ? 'Fermer' : 'Close'} className="rounded-full border border-ink-200 bg-white p-2 text-ink-600 hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-6 p-5 sm:p-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Info label={french ? 'Date' : 'Date'} value={new Date(row.created_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} />
            <Info label={french ? 'Langue' : 'Language'} value={row.language.toUpperCase()} />
            <Info label={french ? 'Schéma' : 'Schema'} value={`v${row.submission_schema_version}`} />
            <Info label={french ? 'Questionnaire' : 'Questionnaire'} value={row.questionnaire_version} />
          </div>

          {response.kind === 'specialist' ? (
            <SpecialistMetadata response={response.row} lang={lang} analysis={analysis as ReturnType<typeof analyzeSpecialistResponse>} />
          ) : (
            <StudentMetadata response={response.row} lang={lang} analysis={analysis as ReturnType<typeof analyzeStudentResponse>} />
          )}

          {!analysis.eligible && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
              <p className="font-semibold">{french ? 'Réponse exclue du calcul analytique' : 'Response excluded from analytical calculations'}</p>
              <p className="mt-1 text-xs">
                {french
                  ? 'Elle reste entièrement consultable et exportable. Motifs : '
                  : 'It remains fully viewable and exportable. Reasons: '}
                <span className="font-mono">{analysis.exclusionReasons.join(', ')}</span>
              </p>
            </div>
          )}

          {row.specialty_config_version_id && row.specialty_config_version_id !== activeCatalogVersion.id && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
              <p className="font-semibold">
                {french ? 'Analyse recalculée avec la configuration active' : 'Analysis recomputed with the active configuration'}
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                {french
                  ? `Cette réponse a été recueillie avec la révision ${row.specialty_config_revision ?? 'inconnue'}. Les données brutes et son UUID restent enregistrés pour une reconstruction historique exacte.`
                  : `This response was collected under revision ${row.specialty_config_revision ?? 'unknown'}. Raw data and its UUID remain recorded for exact historical reconstruction.`}
              </p>
            </div>
          )}

          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-brand-600" />
              <h3 className="font-semibold text-ink-900">{french ? 'Valeurs sélectionnées' : 'Selected values'}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedValues.map((value) => (
                <span key={value} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                  {translateValue(value, lang)}
                </span>
              ))}
              {selectedValues.length === 0 && <span className="text-sm text-ink-500">—</span>}
            </div>
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white shadow-soft">
            <div className="border-b border-ink-100 p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand-600" />
                <h3 className="font-semibold text-ink-900">{french ? 'Classement canonique recalculé' : 'Recomputed canonical ranking'}</h3>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {french
                  ? 'Calculé depuis les réponses brutes avec le moteur courant et les priorités neutres par défaut. Les scores sont des indices de similarité sur 100, pas des probabilités.'
                  : 'Computed from raw answers with the current engine and neutral default priorities. Scores are similarity indices out of 100, not probabilities.'}
              </p>
            </div>
            <div className="divide-y divide-ink-100">
              {displayedRanking.map((item) => {
                const actual = response.kind === 'specialist' && item.name === response.row.actual_specialty;
                const preferred = response.kind === 'student' && item.name === response.row.preferred_specialty;
                return (
                  <div key={item.name} className={`flex items-center gap-4 px-5 py-3 ${actual ? 'bg-brand-50' : ''}`}>
                    <span className="w-14 text-sm font-semibold tabular-nums text-ink-400">{formatRank(item.rankMin, item.rankMax)}</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink-800">{translateSpecialtyName(item.name, lang)}</span>
                    {actual && <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-bold uppercase text-brand-800">{french ? 'réelle' : 'actual'}</span>}
                    {preferred && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">{french ? 'préférée' : 'preferred'}</span>}
                    <span className="text-sm font-semibold tabular-nums text-ink-900">{item.score.toFixed(1)}/100</span>
                  </div>
                );
              })}
              {actualOutsideTopTen && (
                <div className="flex items-center gap-4 border-t-4 border-ink-100 bg-brand-50 px-5 py-3">
                  <span className="w-14 text-sm font-semibold tabular-nums text-ink-400">{formatRank(actualOutsideTopTen.rankMin, actualOutsideTopTen.rankMax)}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-800">{translateSpecialtyName(actualOutsideTopTen.name, lang)}</span>
                  <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-bold uppercase text-brand-800">{french ? 'réelle' : 'actual'}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink-900">{actualOutsideTopTen.score.toFixed(1)}/100</span>
                </div>
              )}
              {!analysis.eligible && (
                <p className="px-5 py-4 text-sm text-ink-500">{french ? 'Aucun classement n’est produit pour une réponse incompatible.' : 'No ranking is produced for an incompatible response.'}</p>
              )}
            </div>
          </section>

          {response.kind === 'student' && (
            <StoredStudentScores response={response.row} lang={lang} />
          )}

          <details className="rounded-2xl border border-ink-100 bg-white shadow-soft">
            <summary className="cursor-pointer list-none p-5 font-semibold text-ink-900">
              {french ? `Profil complet des traits (${sortedTraits.length})` : `Full trait profile (${sortedTraits.length})`}
            </summary>
            <div className="max-h-[560px] overflow-auto border-t border-ink-100">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-ink-50 text-xs text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Trait</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">{french ? 'Avec valeurs' : 'With values'}</th>
                    {response.kind === 'specialist' && <th className="px-4 py-3">{french ? 'Cible (poids)' : 'Target (weight)'}</th>}
                    {response.kind === 'specialist' && <th className="px-4 py-3">{french ? 'Écart' : 'Gap'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedTraits.map((trait) => {
                    const adjusted = analysis.adjustedTraits[trait];
                    const target = targetProfile?.[trait as keyof typeof targetProfile];
                    const gap = adjusted === undefined || !target ? null : adjusted - target[0];
                    return (
                      <tr key={trait} className={`border-t border-ink-100 ${target && adjusted === undefined ? 'bg-amber-50/60' : ''}`}>
                        <td className="px-5 py-3 font-mono text-xs">{trait}</td>
                        <td className="px-4 py-3 tabular-nums">{formatScore(analysis.baseTraits[trait])}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">{formatScore(adjusted)}</td>
                        {response.kind === 'specialist' && <td className="px-4 py-3 tabular-nums">{target ? `${target[0]} (${target[1]})` : '—'}</td>}
                        {response.kind === 'specialist' && <td className="px-4 py-3 tabular-nums">{gap === null ? '—' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)}`}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>

          <section className="space-y-4">
            <div>
              <h3 className="font-semibold text-ink-900">{french ? 'Réponses aux 81 items' : 'Responses to all 81 items'}</h3>
              <p className="mt-1 text-xs text-ink-500">{french ? 'Échelle brute de 1 à 10.' : 'Raw 1–10 scale.'}</p>
            </div>
            {RATING_SECTIONS.map((section) => (
              <details key={section.id} className="rounded-2xl border border-ink-100 bg-white shadow-soft" open={section.id === 'thinking'}>
                <summary className="cursor-pointer list-none p-5 font-semibold text-ink-900">
                  {translateSection(section.id, lang).title}
                  <span className="ml-2 text-xs font-normal text-ink-400">({section.questions.length})</span>
                </summary>
                <div className="divide-y divide-ink-100 border-t border-ink-100">
                  {section.questions.map(({ id }) => {
                    const rating = ratings[id];
                    return (
                      <div key={id} className="grid gap-2 px-5 py-3 sm:grid-cols-[42px_minmax(0,1fr)_150px] sm:items-center">
                        <span className="font-mono text-xs font-semibold text-brand-700">{id}</span>
                        <span className="text-sm text-ink-700">{translateQuestion(id, lang)}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${rating === undefined ? 0 : Math.max(0, Math.min(100, rating * 10))}%` }} />
                          </div>
                          <span className="w-10 text-right text-sm font-semibold tabular-nums text-ink-900">{rating ?? '—'}/10</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <h3 className="font-semibold text-ink-900">{french ? 'Versions enregistrées' : 'Recorded versions'}</h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Version label="questionnaire" value={row.questionnaire_version} />
              <Version label="value_catalog" value={row.value_catalog_version} />
              <Version label="specialty_catalog" value={row.specialty_catalog_version} />
              <Version label="specialty_config_id" value={row.specialty_config_version_id ?? (french ? 'legacy / non enregistrée' : 'legacy / not recorded')} />
              <Version label="specialty_config_revision" value={row.specialty_config_revision?.toString() ?? (french ? 'legacy / non enregistrée' : 'legacy / not recorded')} />
              <Version label={response.kind === 'specialist' ? 'calibration' : 'scoring'} value={response.kind === 'specialist' ? response.row.calibration_version : response.row.scoring_version} />
              <Version label="consent" value={row.consent_version} />
              <Version label="dashboard_analysis" value={analysis.analysisVersion} />
              <Version label="scoring_engine" value={analysis.engineRevision} />
              <Version label="model_checksum" value={analysis.modelChecksum} />
            </dl>
          </section>

          <details className="rounded-2xl border border-ink-100 bg-white shadow-soft">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold text-ink-900">
              <Braces className="h-5 w-5 text-brand-600" />{french ? 'JSON brut fidèle' : 'Exact raw JSON'}
            </summary>
            <pre className="max-h-[520px] overflow-auto border-t border-ink-100 bg-ink-950 p-5 text-xs leading-relaxed text-ink-100">{JSON.stringify(row, null, 2)}</pre>
          </details>
        </div>
      </section>
    </div>
  );
}

function SpecialistMetadata({
  response,
  lang,
  analysis,
}: {
  response: SpecialistResponseRow;
  lang: Language;
  analysis: ReturnType<typeof analyzeSpecialistResponse>;
}) {
  const french = lang === 'fr';
  const actualRank = formatRank(analysis.actualRankMin, analysis.actualRankMax);
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
      <h3 className="font-semibold text-ink-900">{french ? 'Métadonnées de calibration' : 'Calibration metadata'}</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label={french ? 'Spécialité réelle' : 'Actual specialty'} value={translateSpecialtyName(response.actual_specialty, lang)} />
        <Info label={french ? 'Expérience' : 'Experience'} value={response.years_of_experience === null ? '—' : `${response.years_of_experience} ${french ? 'an(s)' : 'year(s)'}`} />
        <Info label={french ? 'Satisfaction' : 'Satisfaction'} value={response.career_satisfaction === null ? '—' : `${response.career_satisfaction}/5`} />
        <Info label={french ? 'Rechoisirait' : 'Would choose again'} value={codeLabel(response.would_choose_again_code, lang)} />
        <Info label={french ? 'Intention de changer' : 'Intention to change'} value={codeLabel(response.intention_to_change_code, lang)} />
        <Info label={french ? 'Choix volontaire' : 'Voluntary choice'} value={codeLabel(response.voluntary_choice_code, lang)} />
        <Info label={french ? 'Rang canonique réel' : 'Canonical actual rank'} value={actualRank === '—' ? '—' : `${actualRank} / ${analysis.ranking.length}`} />
        <Info label={french ? 'Ex æquo' : 'Tied specialties'} value={analysis.actualTieCount ?? '—'} />
        <Info label={french ? 'Indice de similarité réel' : 'Actual similarity index'} value={analysis.actualScore === null ? '—' : `${analysis.actualScore.toFixed(1)}/100`} />
      </dl>
    </section>
  );
}

function StudentMetadata({
  response,
  lang,
  analysis,
}: {
  response: StudentResponseRow;
  lang: Language;
  analysis: ReturnType<typeof analyzeStudentResponse>;
}) {
  const french = lang === 'fr';
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
      <h3 className="font-semibold text-ink-900">{french ? 'Métadonnées étudiantes' : 'Student metadata'}</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info label={french ? 'Année d’étude' : 'Study year'} value={response.study_year ?? '—'} />
        <Info label={french ? 'Spécialité préférée' : 'Preferred specialty'} value={response.preferred_specialty ? translateSpecialtyName(response.preferred_specialty, lang) : '—'} />
        <Info label={french ? 'Rang canonique de la préférence' : 'Canonical preferred rank'} value={formatRank(analysis.preferredRankMin, analysis.preferredRankMax)} />
        <Info label={french ? 'Indice de similarité' : 'Similarity index'} value={analysis.preferredScore === null ? '—' : `${analysis.preferredScore.toFixed(1)}/100`} />
      </dl>
    </section>
  );
}

function StoredStudentScores({ response, lang }: { response: StudentResponseRow; lang: Language }) {
  const french = lang === 'fr';
  const scores = parseClientScores(response.client_scores).slice(0, 10);
  return (
    <details className="rounded-2xl border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer list-none p-5 font-semibold text-amber-950">
        {french ? 'Classement navigateur enregistré (non vérifié)' : 'Stored browser ranking (unverified)'}
      </summary>
      <p className="border-t border-amber-200 px-5 py-3 text-xs leading-relaxed text-amber-900">
        {french
          ? 'Les poids de priorité personnalisés n’ont pas été enregistrés. Ce classement historique ne doit donc pas être comparé directement au classement canonique recalculé.'
          : 'Personalized priority weights were not stored. This historical ranking must therefore not be compared directly with the recomputed canonical ranking.'}
      </p>
      <div className="divide-y divide-amber-100 border-t border-amber-200">
        {scores.map((item, index) => (
          <div key={item.specialty} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className="w-7 text-amber-700">#{index + 1}</span>
            <span className="flex-1 text-ink-800">{translateSpecialtyName(item.specialty, lang)}</span>
            <span className="font-semibold tabular-nums">{item.score.toFixed(1)}/100</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-ink-50 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-800">{value}</dd>
    </div>
  );
}

function Version({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3">
      <dt className="font-mono text-xs text-ink-500">{label}</dt>
      <dd className="break-all text-right font-mono text-xs font-semibold text-ink-800">{value}</dd>
    </div>
  );
}
