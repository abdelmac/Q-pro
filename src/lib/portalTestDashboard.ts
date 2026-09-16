import type { SpecialistResponseRow, StudentResponseRow } from '@/lib/researchDashboard';
import { DATA_VERSIONS } from '@/lib/researchVersions';

export interface PortalTestFilters {
  specialty: string; questionnaire: 'all' | 'completed' | 'skipped'; completeness: 'all' | 'complete' | 'partial';
  chooseAgain: string; language: string; dataVersion: 'all' | 'current' | 'legacy';
  participantRole: string; year: string; preferredSpecialty: string; dateFrom: string; dateTo: string;
}
function dateMatches(createdAt: string, filters: PortalTestFilters): boolean {
  const boundary = (date: string, next: boolean) => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day + (next ? 1 : 0)).getTime();
  };
  const instant = Date.parse(createdAt);
  return (!filters.dateFrom || instant >= boundary(filters.dateFrom, false)) && (!filters.dateTo || instant < boundary(filters.dateTo, true));
}
function commonMatches(row: SpecialistResponseRow | StudentResponseRow, filters: PortalTestFilters): boolean {
  return (filters.language === 'all' || row.language === filters.language) && dateMatches(row.created_at, filters);
}
function sortRows<T extends { created_at: string; id: string }>(rows: T[]): T[] {
  return rows.sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
}
export function hasCompleteTestInterview(row: SpecialistResponseRow): boolean {
  if (row.submission_schema_version < DATA_VERSIONS.submissionSchema) return [row.years_of_experience, row.career_satisfaction, row.would_choose_again_code, row.intention_to_change_code, row.voluntary_choice_code].every(value => value !== null);
  return [row.current_specialty_view, row.specialty_changes_over_years, row.most_important_specialty_quality, row.would_choose_again_code, row.student_self_question].every(value => value !== null)
    && (row.would_choose_again_code === 'yes' || (row.would_choose_again_code === 'no' && row.would_not_choose_again_reason !== null));
}
export function filterTestSpecialists(rows: SpecialistResponseRow[], filters: PortalTestFilters): SpecialistResponseRow[] {
  return sortRows(rows.filter(row => {
    if (!commonMatches(row, filters) || (filters.specialty !== 'all' && row.actual_specialty !== filters.specialty)
      || (filters.questionnaire !== 'all' && row.questionnaire_completed !== (filters.questionnaire === 'completed'))
      || (filters.chooseAgain !== 'all' && row.would_choose_again_code !== filters.chooseAgain)) return false;
    if (filters.dataVersion === 'legacy' && row.submission_schema_version >= DATA_VERSIONS.submissionSchema) return false;
    if (filters.dataVersion === 'current' && (!([DATA_VERSIONS.submissionSchema, DATA_VERSIONS.specialistSubmissionSchema] as number[]).includes(row.submission_schema_version)
      || row.questionnaire_version !== DATA_VERSIONS.questionnaire || row.value_catalog_version !== DATA_VERSIONS.valueCatalog
      || row.specialty_catalog_version !== DATA_VERSIONS.specialtyCatalog || row.calibration_version !== DATA_VERSIONS.calibration
      || !([DATA_VERSIONS.consent, DATA_VERSIONS.specialistConsent] as string[]).includes(row.consent_version))) return false;
    return filters.completeness === 'all' || hasCompleteTestInterview(row) === (filters.completeness === 'complete');
  }));
}
export function filterTestStudents(rows: StudentResponseRow[], filters: PortalTestFilters): StudentResponseRow[] {
  return sortRows(rows.filter(row => {
    if (!commonMatches(row, filters) || (filters.participantRole !== 'all' && row.participant_role !== filters.participantRole)
      || (filters.year !== 'all' && row.study_year !== Number(filters.year))
      || (filters.preferredSpecialty !== 'all' && row.preferred_specialty !== filters.preferredSpecialty)) return false;
    if (filters.dataVersion === 'legacy' && row.submission_schema_version >= DATA_VERSIONS.studentSubmissionSchema) return false;
    return filters.dataVersion !== 'current' || (row.submission_schema_version === DATA_VERSIONS.studentSubmissionSchema
      && row.questionnaire_version === DATA_VERSIONS.questionnaire && row.value_catalog_version === DATA_VERSIONS.valueCatalog
      && row.specialty_catalog_version === DATA_VERSIONS.specialtyCatalog && row.scoring_version === DATA_VERSIONS.scoring
      && row.consent_version === DATA_VERSIONS.studentConsent && row.participant_reflection_version === DATA_VERSIONS.participantReflection);
  }));
}

/** Prefix logical CSV records, not physical lines: quoted reflections may contain newlines. */
export function markPortalTestCsv(csv: string, datasetId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(datasetId)) throw new Error('Invalid test dataset ID');
  const source = csv.replace(/^\uFEFF/, '');
  const records: string[] = [];
  let quoted = false;
  let start = 0;
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '"') {
      if (quoted && source[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted && source[index] === '\n') {
      records.push(source.slice(start, source[index - 1] === '\r' ? index - 1 : index));
      start = index + 1;
    }
  }
  if (start < source.length) records.push(source.slice(start));
  return `\uFEFF${records.map((record, index) => index === 0
    ? `"is_test","test_dataset_id","research_consent","test_notice",${record}`
    : `"true","${datasetId}","false","SYNTHETIC TEST DATA - NOT RESEARCH",${record}`).join('\r\n')}`;
}
