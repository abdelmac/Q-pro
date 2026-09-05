import { RATING_SECTIONS } from '@/data/questions';
import {
  translateQuestion,
  translateSection,
  translateSpecialtyName,
  translateValue,
  type Language,
} from '@/data/i18n';
import type {
  CalibrationSummary,
  EligibilityReason,
  TraitSource,
} from '@/lib/researchDashboard';
import { AlertTriangle, BarChart3, CheckCircle2, Microscope } from 'lucide-react';

interface CalibrationAnalysisProps {
  summary: CalibrationSummary;
  specialtyFilter: string;
  lang: Language;
  catalogRevision?: number;
  catalogHash?: string;
}

const QUESTION_SECTION = new Map(
  RATING_SECTIONS.flatMap((section) => section.questions.map(({ id }) => [id, section.id] as const)),
);

const REASON_LABELS: Record<EligibilityReason, { fr: string; en: string }> = {
  schema_version: { fr: 'schéma non courant', en: 'non-current schema' },
  questionnaire_version: { fr: 'questionnaire incompatible', en: 'incompatible questionnaire' },
  value_catalog_version: { fr: 'catalogue de valeurs incompatible', en: 'incompatible value catalog' },
  specialty_catalog_version: { fr: 'catalogue de spécialités incompatible', en: 'incompatible specialty catalog' },
  analysis_version: { fr: 'version de calibration incompatible', en: 'incompatible analysis version' },
  consent_version: { fr: 'consentement non courant', en: 'non-current consent' },
  language: { fr: 'langue invalide', en: 'invalid language' },
  specialty: { fr: 'spécialité non reconnue', en: 'unknown specialty' },
  ratings_shape: { fr: 'format des notes invalide', en: 'invalid ratings shape' },
  ratings_count: { fr: 'nombre de notes différent de 81', en: 'rating count differs from 81' },
  ratings_ids: { fr: 'identifiants de questions incompatibles', en: 'incompatible question IDs' },
  ratings_values: { fr: 'notes hors échelle 1–10', en: 'ratings outside the 1–10 scale' },
  selected_values_shape: { fr: 'format des valeurs invalide', en: 'invalid selected-values shape' },
  selected_values_count: { fr: 'nombre de valeurs invalide', en: 'invalid selected-values count' },
  selected_values_duplicates: { fr: 'valeurs dupliquées', en: 'duplicate selected values' },
  selected_values_catalog: { fr: 'valeur hors catalogue', en: 'value outside catalog' },
};

function formatNumber(value: number | null, digits = 1): string {
  return value === null ? '—' : value.toFixed(digits);
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} %`;
}

function withN(value: string, count: number): string {
  return `${value} · n=${count}`;
}

function ratePair(inclusive: number | null, conservative: number | null, count: number): string {
  return `${formatPercent(inclusive)} / ${formatPercent(conservative)} · n=${count}`;
}

function sourceLabel(source: TraitSource, french: boolean): string {
  const labels: Record<TraitSource, [string, string]> = {
    question: ['questions', 'questions'],
    question_and_value: ['questions + valeurs', 'questions + values'],
    value_only: ['valeurs seulement', 'values only'],
    unmeasured: ['non mesuré', 'unmeasured'],
  };
  return labels[source][french ? 0 : 1];
}

export default function CalibrationAnalysis({
  summary,
  specialtyFilter,
  lang,
  catalogRevision,
  catalogHash,
}: CalibrationAnalysisProps) {
  const french = lang === 'fr';
  const selectedSpecialty = specialtyFilter === 'all'
    ? null
    : translateSpecialtyName(specialtyFilter, lang);
  const structurallyPartialTraits = summary.traitAggregates.filter((item) => (
    item.usedInCurrentModel && (item.source === 'value_only' || item.source === 'unmeasured')
  ));

  if (summary.total === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/70 p-6" aria-labelledby="calibration-analysis-title">
        <div className="flex items-start gap-3">
          <Microscope className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
          <div>
            <h2 id="calibration-analysis-title" className="font-display text-xl font-semibold text-ink-900">
              {french ? 'Analyse de calibration' : 'Calibration analysis'}
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              {french ? 'Aucune réponse spécialiste ne correspond aux filtres actuels.' : 'No specialist response matches the current filters.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-6" aria-labelledby="calibration-analysis-title">
      <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Microscope className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
          <div>
            <h2 id="calibration-analysis-title" className="font-display text-xl font-semibold text-ink-900">
              {french ? 'Analyse de calibration' : 'Calibration analysis'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {french
                ? `${summary.eligibleCount} réponse(s) éligible(s) sur ${summary.total} chargée(s). Les résultats sont recalculés avec le moteur courant et les priorités neutres par défaut.`
                : `${summary.eligibleCount} eligible response(s) out of ${summary.total} loaded. Results are recomputed with the current engine and neutral default priorities.`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {french
                ? 'Les priorités personnalisées historiques n’étant pas enregistrées, ce classement canonique ne reproduit pas nécessairement le classement vu par le participant.'
                : 'Historical personalized priorities were not stored, so this canonical ranking may differ from what the participant saw.'}
            </p>
            {catalogRevision !== undefined && (
              <p className="mt-2 break-all font-mono text-[11px] text-ink-500">
                specialty config r{catalogRevision}{catalogHash ? ` · ${catalogHash}` : ''}
              </p>
            )}
            {selectedSpecialty && (
              <p className="mt-2 text-sm font-semibold text-brand-800">
                {french ? 'Profil cible comparé :' : 'Target profile compared:'} {selectedSpecialty}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <Metric label={french ? 'Éligibles / chargées' : 'Eligible / loaded'} value={`${summary.eligibleCount}/${summary.total}`} />
        <Metric label={french ? 'Exclues du calcul' : 'Excluded from analysis'} value={String(summary.excludedCount)} />
        <Metric label={french ? 'Entretiens qualitatifs complets' : 'Complete qualitative interviews'} value={`${summary.completeCount}/${summary.eligibleCount}`} />
        <Metric label={french ? 'Rechoisirait' : 'Would choose again'} value={withN(formatPercent(summary.chooseAgainRate), summary.chooseAgainCount)} />
        <Metric label={french ? 'Rappel Top 1 incl. / cons.' : 'Top-1 recall incl. / cons.'} value={ratePair(summary.top1Rate, summary.top1ConservativeRate, summary.rankableCount)} />
        <Metric label={french ? 'Rappel Top 3 incl. / cons.' : 'Top-3 recall incl. / cons.'} value={ratePair(summary.top3Rate, summary.top3ConservativeRate, summary.rankableCount)} />
        <Metric label={french ? 'Rappel Top 5 incl. / cons.' : 'Top-5 recall incl. / cons.'} value={ratePair(summary.top5Rate, summary.top5ConservativeRate, summary.rankableCount)} />
        <Metric label={french ? 'Rang min. médian' : 'Median minimum rank'} value={withN(formatNumber(summary.medianActualRank), summary.rankableCount)} />
      </div>

      {summary.excludedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {french ? 'Les lignes incompatibles restent exportables, mais sont exclues des indicateurs de calibration.' : 'Incompatible rows remain exportable but are excluded from calibration indicators.'}
              </p>
              <p className="mt-1 text-xs">{french ? 'Une même ligne peut cumuler plusieurs motifs; leur somme peut donc dépasser le nombre de lignes exclues.' : 'One row may have several reasons, so their sum can exceed the number of excluded rows.'}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {summary.exclusionReasons.map(({ reason, count }) => (
                  <li key={reason}>{REASON_LABELS[reason][french ? 'fr' : 'en']}: {count}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {structurallyPartialTraits.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {french ? 'Limite structurelle du moteur actuel' : 'Structural limitation in the current engine'}
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              {french
                ? 'Certains traits utilisés par les profils ne sont pas mesurés pour toute la cohorte. Les rappels Top-k décrivent donc le moteur actuel, mais ne doivent pas servir seuls à valider ou modifier ces poids avant correction/versionnement du modèle.'
                : 'Some traits used by profiles are not measured for the full cohort. Top-k recalls describe the current engine, but must not alone validate or modify those weights before the model is corrected and versioned.'}
            </p>
            <p className="mt-2 font-mono text-xs">{structurallyPartialTraits.map(({ trait }) => trait).join(', ')}</p>
          </div>
        </div>
      )}

      {summary.eligibleCount > 0 && summary.eligibleCount < 10 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {french
              ? 'Échantillon éligible très faible : ces indicateurs sont descriptifs et ne doivent pas modifier automatiquement les profils cibles.'
              : 'Very small eligible sample: these indicators are descriptive and should not automatically change target profiles.'}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white shadow-soft">
        <div className="border-b border-ink-100 p-5">
          <h3 className="font-semibold text-ink-900">{french ? 'Cohortes par spécialité' : 'Cohorts by specialty'}</h3>
          <p className="mt-1 text-xs text-ink-500">
            {french
              ? 'Inclusif = rang minimum ≤ 3; conservateur = rang maximum ≤ 3. La différence quantifie l’effet des ex æquo à la frontière.'
              : 'Inclusive means minimum rank ≤ 3; conservative means maximum rank ≤ 3. Their difference quantifies boundary ties.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-ink-50 text-xs text-ink-500">
              <tr>
                <th className="px-5 py-3 font-semibold">{french ? 'Spécialité' : 'Specialty'}</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Éligibles / chargées' : 'Eligible / loaded'}</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Entretiens complets' : 'Complete interviews'}</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Rechoisirait' : 'Choose again'}</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Rang min. médian' : 'Median minimum rank'}</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Top 3 incl. / cons.' : 'Top 3 incl. / cons.'}</th>
              </tr>
            </thead>
            <tbody>
              {summary.specialtyAggregates.map((item) => (
                <tr key={item.specialty} className="border-t border-ink-100">
                  <td className="px-5 py-3 font-medium text-ink-900">{translateSpecialtyName(item.specialty, lang)}</td>
                  <td className={`px-4 py-3 tabular-nums ${item.eligibleCount > 0 && item.eligibleCount < 10 ? 'font-semibold text-amber-700' : ''}`}>{item.eligibleCount}/{item.count}</td>
                  <td className="px-4 py-3 tabular-nums">{item.completeCount}/{item.eligibleCount}</td>
                  <td className="px-4 py-3 tabular-nums">{withN(formatPercent(item.chooseAgainRate), item.chooseAgainCount)}</td>
                  <td className="px-4 py-3 tabular-nums">{withN(formatNumber(item.medianActualRank), item.rankableCount)}</td>
                  <td className="px-4 py-3 tabular-nums">{ratePair(item.top3Rate, item.top3ConservativeRate, item.rankableCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="border-b border-ink-100 p-5">
            <h3 className="font-semibold text-ink-900">{french ? 'Profil de traits observé' : 'Observed trait profile'}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {french
                ? 'Base = profil issu des 81 notes. Avec valeurs = mêmes mesures, complétées uniquement par les signaux de valeurs sans question directe. Les valeurs augmentent aussi l’importance des traits correspondants dans le classement, sans gonfler une mesure existante. Un écart n’est affiché que si le trait est mesuré pour toute la cohorte éligible.'
                : 'Base is the profile derived from the 81 ratings. With values keeps those measures and only fills value signals that have no direct question. Values also increase the matching importance of corresponding traits without inflating an existing measurement. A gap is shown only when the trait is measured for the full eligible cohort.'}
            </p>
          </div>
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 bg-ink-50 text-xs text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Trait</th>
                  <th className="px-4 py-3 font-semibold">{french ? 'Source' : 'Source'}</th>
                  <th className="px-4 py-3 font-semibold">n base</th>
                  <th className="px-4 py-3 font-semibold">n {french ? 'avec valeurs' : 'with values'}</th>
                  <th className="px-4 py-3 font-semibold">Base</th>
                  <th className="px-4 py-3 font-semibold">{french ? 'Avec valeurs' : 'With values'}</th>
                  <th className="px-4 py-3 font-semibold">{french ? 'Cible' : 'Target'}</th>
                  <th className="px-4 py-3 font-semibold">{french ? 'Écart' : 'Gap'}</th>
                  <th className="px-4 py-3 font-semibold">{french ? 'Poids' : 'Weight'}</th>
                </tr>
              </thead>
              <tbody>
                {summary.traitAggregates.map((item) => (
                  <tr key={item.trait} className={`border-t border-ink-100 ${item.target !== null && item.source === 'unmeasured' ? 'bg-amber-50/70' : ''}`}>
                    <td className="px-5 py-3 font-mono text-xs text-ink-800">
                      {item.trait}{!item.usedInCurrentModel && <span className="ml-2 text-[10px] text-ink-400">{french ? 'hors score' : 'not scored'}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{sourceLabel(item.source, french)}</td>
                    <td className="px-4 py-3 tabular-nums">{item.baseCount}</td>
                    <td className="px-4 py-3 tabular-nums">{item.adjustedCount}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(item.baseMean)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-ink-900">{formatNumber(item.adjustedMean)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(item.target)}</td>
                    <td className={`px-4 py-3 tabular-nums ${item.gap !== null && Math.abs(item.gap) >= 15 ? 'font-semibold text-amber-700' : ''}`}>
                      {item.gap === null ? '—' : `${item.gap > 0 ? '+' : ''}${item.gap.toFixed(1)}`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{item.importance ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-ink-900">{french ? 'Valeurs sélectionnées' : 'Selected values'}</h3>
          </div>
          <div className="space-y-3">
            {summary.valueAggregates.map((item) => (
              <div key={item.value}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-ink-700">{translateValue(item.value, lang)}</span>
                  <span className="tabular-nums text-ink-500">{item.count} · {item.percentage.toFixed(1)} %</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
              </div>
            ))}
            {summary.valueAggregates.length === 0 && (
              <p className="text-sm text-ink-500">{french ? 'Aucune valeur dans la cohorte éligible.' : 'No values in the eligible cohort.'}</p>
            )}
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-ink-100 bg-white shadow-soft">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold text-ink-900">
          <BarChart3 className="h-5 w-5 text-brand-600" />
          {french ? 'Moyennes détaillées des 81 items' : 'Detailed averages for all 81 items'}
        </summary>
        <div className="max-h-[620px] overflow-auto border-t border-ink-100">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-ink-50 text-xs text-ink-500">
              <tr>
                <th className="px-5 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Section' : 'Section'}</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Question' : 'Question'}</th>
                <th className="px-4 py-3 font-semibold">n</th>
                <th className="px-4 py-3 font-semibold">{french ? 'Moyenne' : 'Mean'}</th>
                <th className="px-4 py-3 font-semibold">Min–Max</th>
              </tr>
            </thead>
            <tbody>
              {summary.questionAggregates.map((item) => {
                const sectionId = QUESTION_SECTION.get(item.id) ?? 'thinking';
                return (
                  <tr key={item.id} className="border-t border-ink-100">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-brand-700">{item.id}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{translateSection(sectionId, lang).title}</td>
                    <td className="max-w-xl px-4 py-3 text-ink-700">{translateQuestion(item.id, lang)}</td>
                    <td className="px-4 py-3 tabular-nums">{item.count}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{formatNumber(item.mean, 2)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {item.minimum === null || item.maximum === null ? '—' : `${item.minimum}–${item.maximum}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-soft">
      <p className="text-lg font-semibold tabular-nums text-ink-900">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-ink-500">{label}</p>
    </div>
  );
}
