import { parentPort, workerData } from 'node:worker_threads';
import { SPECIALTIES, type Specialty, type TraitProfile } from '@/data/specialties';
import { QUESTION_TRAITS, VALUE_MAPPING } from '@/data/traits';
import { ALL_QUESTION_IDS } from '@/data/questions';
import { SCORING_ENGINE_REVISION } from '@/lib/scoring';
import { DATA_VERSIONS, DASHBOARD_ANALYSIS_VERSION } from '@/lib/researchVersions';
import {
  analyzeSpecialistResponse, analyzeStudentResponse, buildCalibrationSummary, dashboardModelChecksum,
  specialistRawCsv, specialistLongCsv, specialistAnalyticCsv,
  studentRawCsv, studentLongCsv, studentAnalyticCsv,
  CALIBRATION_TRAITS,
  type SpecialistResponseRow, type StudentResponseRow,
} from '@/lib/researchDashboard';
import { buildResearchEvaluation } from '@/lib/researchEvaluation';

type Entry = { respondent_type: 'specialist' | 'student' | 'non_medical'; response: SpecialistResponseRow | StudentResponseRow };
const port = parentPort!;
const entries: Entry[] = workerData.entries;

function candidateCatalog(value: unknown): Specialty[] | null {
  if (value == null) return null;
  const rows = Array.isArray(value) ? value : (value as { specialties?: unknown }).specialties;
  if (!Array.isArray(rows) || rows.length !== SPECIALTIES.length) throw new Error('Invalid candidate model.');
  const names = new Set<string>();
  const profiles = new Map<string, TraitProfile>();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.name !== 'string' || names.has(row.name)
      || !SPECIALTIES.some(specialty => specialty.name === row.name)
      || !row.profile || typeof row.profile !== 'object' || Array.isArray(row.profile)
      || !Object.keys(row.profile).length) throw new Error('Invalid candidate model.');
    names.add(row.name);
    const profile: TraitProfile = {};
    for (const [trait, pair] of Object.entries(row.profile)) {
      if (!CALIBRATION_TRAITS.includes(trait) || !Array.isArray(pair) || pair.length !== 2
        || !Number.isFinite(pair[0]) || pair[0] < 0 || pair[0] > 100
        || !Number.isInteger(pair[1]) || pair[1] < 1 || pair[1] > 3) throw new Error('Invalid candidate profile.');
      profile[trait as keyof TraitProfile] = [pair[0], pair[1]];
    }
    profiles.set(row.name, profile);
  }
  // Only profiles vary; specialty identities, categories and questionnaire stay fixed.
  return SPECIALTIES.map(specialty => ({ ...specialty, profile: profiles.get(specialty.name)! }));
}

// One acknowledged chunk at a time prevents a large CSV-long export flooding RAM.
function send(message: Record<string, unknown>): Promise<void> {
  return new Promise(resolve => {
    port.once('message', () => resolve());
    port.postMessage(message);
  });
}
async function jsonFile(name: string, value: unknown) {
  await send({ type: 'start', name });
  await send({ type: 'chunk', text: JSON.stringify(value, null, 2) });
  await send({ type: 'end' });
}
async function csvFile<T>(name: string, rows: T[], exporter: (rows: T[]) => string) {
  await send({ type: 'start', name });
  await send({ type: 'chunk', text: exporter([]) });
  for (const row of rows) {
    const csv = exporter([row]);
    const newline = csv.indexOf('\r\n');
    if (newline !== -1) await send({ type: 'chunk', text: csv.slice(newline) });
  }
  await send({ type: 'end' });
}

async function main() {
  const candidate = candidateCatalog(workerData.candidate);
  const specialists = entries.filter(entry => entry.respondent_type === 'specialist').map(entry => entry.response as SpecialistResponseRow);
  const participants = entries.filter(entry => entry.respondent_type !== 'specialist').map(entry => entry.response as StudentResponseRow);
  const summary = buildCalibrationSummary(specialists, null, SPECIALTIES);
  const byLanguage = Object.fromEntries(['en', 'ro', 'fr'].map(language => [language,
    buildCalibrationSummary(specialists.filter(row => row.language === language), null, SPECIALTIES)]));
  const bySpecialty = Object.fromEntries([...new Set(specialists.map(row => row.actual_specialty))].sort()
    .map(specialty => [specialty, buildCalibrationSummary(specialists.filter(row => row.actual_specialty === specialty), specialty, SPECIALTIES)]));
  await jsonFile('calibration.json', { summary, byLanguage, bySpecialty,
    warning: 'Descriptive fixed-model evaluation, not a validation study or a model-promotion decision. Student/non-medical preferences are not professional ground truth.' });
  const evaluation = buildResearchEvaluation(specialists, SPECIALTIES);
  await jsonFile('evaluation.json', evaluation);
  if (candidate) {
    await jsonFile('candidate-model.json', { source: 'operator_supplied_frozen_profiles',
      model_checksum: dashboardModelChecksum(candidate), specialties: candidate });
    await jsonFile('candidate-comparison.json', {
      same_cohort: true, trained_in_this_run: false, production_promotion: false,
      warning: 'Same-cohort descriptive comparison only. If these profiles were fitted on this cohort, this is not independent trained-model validation.',
      baseline: evaluation, candidate: buildResearchEvaluation(specialists, candidate),
    });
  }
  await jsonFile('model.json', { source: 'repository_source_catalog_not_live_published_catalog',
    model_checksum: dashboardModelChecksum(SPECIALTIES), engine_revision: SCORING_ENGINE_REVISION,
    dashboard_analysis_version: DASHBOARD_ANALYSIS_VERSION, versions: DATA_VERSIONS,
    question_ids: ALL_QUESTION_IDS, question_traits: QUESTION_TRAITS, value_mapping: VALUE_MAPPING,
    specialties: SPECIALTIES });
  await send({ type: 'start', name: 'responses.json' });
  await send({ type: 'chunk', text: '[\n' });
  for (let index = 0; index < entries.length; index++) {
    await send({ type: 'chunk', text: `${index ? ',\n' : ''}${JSON.stringify(entries[index])}` });
  }
  await send({ type: 'chunk', text: '\n]\n' });
  await send({ type: 'end' });
  const eligibility = { loaded: entries.length, eligible: 0, excluded: 0,
    specialists: specialists.length, students: entries.filter(entry => entry.respondent_type === 'student').length,
    non_medical: entries.filter(entry => entry.respondent_type === 'non_medical').length,
    missing_personalized_settings: 0, reasons: {} as Record<string, number> };
  await send({ type: 'start', name: 'analyses.json' });
  await send({ type: 'chunk', text: '[\n' });
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const analysis = entry.respondent_type === 'specialist'
      ? analyzeSpecialistResponse(entry.response as SpecialistResponseRow, SPECIALTIES)
      : analyzeStudentResponse(entry.response as StudentResponseRow, SPECIALTIES);
    eligibility[analysis.eligible ? 'eligible' : 'excluded']++;
    for (const reason of analysis.exclusionReasons) eligibility.reasons[reason] = (eligibility.reasons[reason] ?? 0) + 1;
    const context = (entry.response as unknown as Record<string, unknown>).scoring_context ?? null;
    if (!context) eligibility.missing_personalized_settings++;
    await send({ type: 'chunk', text: `${index ? ',\n' : ''}${JSON.stringify({ id: entry.response.id,
      respondent_type: entry.respondent_type, analysis,
      ranking_basis: 'current_repository_model_default_priorities_not_historical_reconstruction',
      recorded_scoring_context: context })}` });
    if ((index + 1) % 100 === 0) port.postMessage({ type: 'progress', analyzed: index + 1 });
  }
  await send({ type: 'chunk', text: '\n]\n' });
  await send({ type: 'end' });
  await csvFile('specialists-wide.csv', specialists, specialistRawCsv);
  await csvFile('specialists-long.csv', specialists, specialistLongCsv);
  await csvFile('specialists-analytical.csv', specialists, specialistAnalyticCsv);
  await csvFile('participants-wide.csv', participants, studentRawCsv);
  await csvFile('participants-long.csv', participants, studentLongCsv);
  await csvFile('participants-analytical.csv', participants, studentAnalyticCsv);
  port.postMessage({ type: 'completed', eligibility, modelChecksum: dashboardModelChecksum(SPECIALTIES),
    candidateChecksum: candidate ? dashboardModelChecksum(candidate) : null,
    engineRevision: SCORING_ENGINE_REVISION, analysisVersion: DASHBOARD_ANALYSIS_VERSION });
  port.close();
}
main().catch(() => { port.postMessage({ type: 'failed' }); port.close(); });
