export const DATA_VERSIONS = {
  submissionSchema: 2,
  questionnaire: 'q81-v1',
  valueCatalog: 'career-values-v1',
  specialtyCatalog: 'medical-specialties-v1',
  scoring: 'client-scoring-v2',
  calibration: 'calibration-v2-qualitative',
  consent: 'research-consent-2026-09-04',
} as const;

// Identifies calculations produced inside the privileged research dashboard.
// They use the current engine with neutral/default priority weights because
// historical submissions do not store the participant's priority sliders.
export const DASHBOARD_ANALYSIS_VERSION = 'dashboard-canonical-default-v2';
