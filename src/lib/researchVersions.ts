export const DATA_VERSIONS = {
  // Specialist interviews remain on schema 2. Student and curious-participant
  // reflections use their own additive schema so the two protocols are not
  // made artificially incompatible in the dashboard.
  submissionSchema: 2,
  studentSubmissionSchema: 3,
  questionnaire: 'q81-v1',
  valueCatalog: 'career-values-v1',
  specialtyCatalog: 'medical-specialties-v1',
  scoring: 'client-scoring-v2',
  calibration: 'calibration-v2-qualitative',
  consent: 'research-consent-2026-09-04',
  studentConsent: 'research-consent-2026-09-11',
  participantReflection: 'medicine-view-v1',
} as const;

// Identifies calculations produced inside the privileged research dashboard.
// They use the current engine with neutral/default priority weights because
// historical submissions do not store the participant's priority sliders.
export const DASHBOARD_ANALYSIS_VERSION = 'dashboard-canonical-default-v2';
