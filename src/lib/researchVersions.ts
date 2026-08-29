export const DATA_VERSIONS = {
  questionnaire: 'q81-v1',
  valueCatalog: 'career-values-v1',
  specialtyCatalog: 'medical-specialties-v1',
  scoring: 'client-scoring-v1',
  calibration: 'calibration-v1',
  consent: 'research-consent-2026-08-26',
} as const;

// Identifies calculations produced inside the privileged research dashboard.
// They use the current engine with neutral/default priority weights because
// historical submissions do not store the participant's priority sliders.
export const DASHBOARD_ANALYSIS_VERSION = 'dashboard-canonical-default-v1';
