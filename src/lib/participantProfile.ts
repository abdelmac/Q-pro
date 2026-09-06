export const PARTICIPANT_ROLES = ['student', 'specialist'] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const INITIAL_PARTICIPANT_ROLE: ParticipantRole | null = null;

export const STUDENT_STUDY_YEARS = [1, 2, 3, 4, 5, 6] as const;

export type StudentStudyYear = (typeof STUDENT_STUDY_YEARS)[number];

export function isValidStudentStudyYear(value: unknown): value is StudentStudyYear {
  return typeof value === 'number'
    && Number.isInteger(value)
    && STUDENT_STUDY_YEARS.includes(value as StudentStudyYear);
}

export function isValidOptionalStudentStudyYear(value: unknown): value is StudentStudyYear | null | undefined {
  return value == null || isValidStudentStudyYear(value);
}
