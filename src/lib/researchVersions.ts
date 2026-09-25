export const DATA_VERSIONS = {
  // Keep the original quantitative baseline stable for historic eligibility
  // and checksums; optional geography adds collection schemas, not new scores.
  submissionSchema: 2,
  specialistSubmissionSchema: 3,
  studentSubmissionSchema: 5,
  optionalReflectionSubmissionSchema: 4,
  requiredReflectionSubmissionSchema: 3,
  questionnaire: 'q81-v1',
  valueCatalog: 'career-values-v1',
  specialtyCatalog: 'medical-specialties-v1',
  scoring: 'client-scoring-v2',
  calibration: 'calibration-v2-qualitative',
  consent: 'research-consent-2026-09-04',
  specialistConsent: 'research-consent-2026-09-16-geography',
  studentConsent: 'research-consent-2026-09-16-geography',
  optionalReflectionConsent: 'research-consent-2026-09-16',
  participantReflection: 'medicine-view-optional-v2',
  requiredReflectionConsent: 'research-consent-2026-09-11',
  requiredParticipantReflection: 'medicine-view-v1',
} as const;

// Identifies calculations produced inside the privileged research dashboard.
// They use the current engine with neutral/default priority weights because
// historical submissions do not store the participant's priority sliders.
// v3 uses exact full-precision ties, not the v2 1e-9 tolerance. Participant
// equations are unchanged; historical analyses retain their own recorded version.
export const DASHBOARD_ANALYSIS_VERSION = 'dashboard-canonical-default-v3';
