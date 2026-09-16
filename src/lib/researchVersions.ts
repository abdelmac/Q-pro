export const DATA_VERSIONS = {
  // Specialist interviews remain on schema 2. Student and curious-participant
  // reflections use their own additive schemas so participant collection
  // changes do not make the specialist protocol artificially incompatible.
  submissionSchema: 2,
  studentSubmissionSchema: 4,
  requiredReflectionSubmissionSchema: 3,
  questionnaire: 'q81-v1',
  valueCatalog: 'career-values-v1',
  specialtyCatalog: 'medical-specialties-v1',
  scoring: 'client-scoring-v2',
  calibration: 'calibration-v2-qualitative',
  consent: 'research-consent-2026-09-04',
  studentConsent: 'research-consent-2026-09-16',
  participantReflection: 'medicine-view-optional-v2',
  requiredReflectionConsent: 'research-consent-2026-09-11',
  requiredParticipantReflection: 'medicine-view-v1',
} as const;

// Identifies calculations produced inside the privileged research dashboard.
// They use the current engine with neutral/default priority weights because
// historical submissions do not store the participant's priority sliders.
export const DASHBOARD_ANALYSIS_VERSION = 'dashboard-canonical-default-v2';
