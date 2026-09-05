export type Language = 'en' | 'ro' | 'fr';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'ro', label: 'Română', flag: 'RO' },
  { code: 'fr', label: 'Français', flag: 'FR' },
];

// ============================================================
// UI strings
// ============================================================

export interface UIStrings {
  // Intro
  appName: string;
  forMedicalStudents: string;
  heroTitle1: string;
  heroTitle2: string;
  heroSubtitle: string;
  startButton: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  footerNote: string;
  questionsCount: (n: number) => string;

  // Quiz navigation
  step: (current: number, total: number) => string;
  home: string;
  back: string;
  continue: string;
  seeResults: string;

  // Specialty step
  specialtyTitle: string;
  specialtySubtitle: string;
  searchPlaceholder: string;
  specialtySelected: string;
  specialtyOptional: string;

  // Values step
  valuesTitle: string;
  valuesSubtitle: string;
  valuesSelectUpTo: (n: number) => string;
  valuesMoreToSelect: (n: number) => string;
  valuesAllSelected: string;

  // Rating step
  answeredCount: (answered: number, total: number) => string;
  sliderRarely: string;
  sliderStrongly: string;

  // Results
  resultsRetake: string;
  topMatch: string;
  matchPercent: string;
  whyItFits: string;
  preferredCallout: (name: string, rank: number, percent: number) => string;
  otherMatches: string;
  otherMatchesDesc: string;
  resultsRankLabel: (rank: number) => string;
  resultsSpecialtyOverview: string;
  resultsProfessionalProfile: string;
  resultsInformationDisclaimer: string;
  resultsReferencesDisclaimer: string;
  fullRanking: string;
  fullRankingDesc: (n: number) => string;
  retakeAssessment: string;

  // Specialist mode
  specialistBadge: string;
  specialistTitle: string;
  specialistSubtitle: string;
  specialistSpecialtyTitle: string;
  specialistSpecialtySubtitle: string;
  specialistSpecialtyRequired: string;
  specialistPromptTitle: string;
  specialistPromptDesc: string;
  specialistActualSpecialty: string;
  specialistSelectSpecialty: string;
  specialistChangeSpecialty: string;
  specialistSubmit: string;
  specialistSubmitting: string;
  specialistSuccess: string;
  specialistError: string;
  specialistThankYou: string;
  specialistThankYouDesc: string;
  specialistAnother: string;
  specialistToggleLabel: string;
  specialistToggleDesc: string;
  specialistMode: string;
  studentMode: string;

  // Specialist calibration fields
  specialistYearsExperience: string;
  specialistYearsPlaceholder: string;
  specialistCareerSatisfaction: string;
  specialistWouldChooseAgain: string;
  specialistIntentionToChange: string;
  specialistVoluntaryChoice: string;
  specialistYes: string;
  specialistNo: string;
  specialistNotSure: string;
  specialistVerySatisfied: string;
  specialistVeryDissatisfied: string;
  specialistSatisfied: string;
  specialistDissatisfied: string;
  specialistNeutral: string;
  specialistDefinitely: string;
  specialistProbably: string;
  specialistProbablyNot: string;
  specialistDefinitelyNot: string;
  specialistFullyVoluntary: string;
  specialistSomewhatVoluntary: string;
  specialistNotVoluntary: string;
  specialistCurrentView: string;
  specialistCurrentViewPlaceholder: string;
  specialistChangesOverYears: string;
  specialistChangesOverYearsPlaceholder: string;
  specialistMostImportantQuality: string;
  specialistMostImportantQualityPlaceholder: string;
  specialistWhyNotChooseAgain: string;
  specialistWhyNotChooseAgainPlaceholder: string;
  specialistStudentSelfQuestion: string;
  specialistStudentSelfQuestionPlaceholder: string;
  specialistFreeTextPrivacy: string;
  studentDataTitle: string;
  studentDataDesc: string;
  studentStudyYear: string;
  studentPreferNotToSay: string;
  studentYear: (n: number) => string;
  studentContinue: string;
  studentSkip: string;
  studentSaving: string;

  // Q Profile
  qProfileTitle: string;
  qProfileSubtitle: string;
  qProfileTopTraits: string;
  qProfileBottomTraits: string;
  qProfileContinue: string;

  // Adjustable priorities
  prioritiesTitle: string;
  prioritiesSubtitle: string;
  prioritiesReset: string;
  prioritiesContinue: string;
  priorityThinking: string;
  priorityWorking: string;
  priorityInterpersonal: string;
  priorityTechnical: string;
  priorityLifestyle: string;
  priorityLess: string;
  priorityMore: string;
  priorityNeutral: string;

  // Sub-scores
  subScoreThinking: string;
  subScoreWorking: string;
  subScoreInterpersonal: string;
  subScoreTechnical: string;
  subScoreLifestyle: string;
  subScoresTitle: string;

  // Trade-offs
  tradeOffsTitle: string;
  tradeOffsDesc: string;

  // Opposite-fit
  oppositeFitTitle: string;
  oppositeFitDesc: string;
  oppositeFitExplore: string;
  oppositeFitClose: string;
  oppositeFitLegend: string;
  oppositeFitValues: (student: number, target: number, gap: number) => string;

  // Comparison
  comparisonTitle: string;
  comparisonSubtitle: string;
  comparisonAdd: string;
  comparisonRemove: string;
  comparisonCompare: string;
  comparisonMaxSelected: string;
  comparisonAxisPatientInteraction: string;
  comparisonAxisCrisisWork: string;
  comparisonAxisTechnicalActivity: string;
  comparisonAxisVisualReasoning: string;
  comparisonAxisLongTermCare: string;
  comparisonAxisLifestyleBalance: string;
  comparisonAxisResearch: string;
  comparisonAxisManualActivity: string;
  comparisonYourProfile: string;
  comparisonBack: string;

  // Specialty explorer
  explorerTitle: string;
  explorerSubtitle: string;
  explorerSearchPlaceholder: string;
  explorerAllCategories: string;
  explorerWorkStyle: string;
  explorerPatientContact: string;
  explorerCareType: string;
  explorerProceduralIntensity: string;
  explorerKeyTraits: string;
  explorerReferences: string;
  explorerYourMatch: string;
  explorerViewDetail: string;
  explorerBack: string;
  explorerBackToResults: string;
  explorerBackToExplorer: string;

  // Methodology page
  methodologyTitle: string;
  methodologySubtitle: string;
  methodologyQuestionnaire: string;
  methodologyQuestionnaireDesc: string;
  methodologyTraitModel: string;
  methodologyTraitModelDesc: string;
  methodologyScoring: string;
  methodologyScoringDesc: string;
  methodologyProfiles: string;
  methodologyProfilesDesc: string;
  methodologyCalibration: string;
  methodologyCalibrationDesc: string;
  methodologyValidation: string;
  methodologyValidationDesc: string;
  methodologyAlgorithmVersion: string;
  methodologyLimitations: string;
  methodologyLimitationsDesc: string;
  methodologyBibliography: string;
  methodologyDisclaimer: string;
  methodologyDisclaimerDesc: string;
  methodologyBack: string;
  methodologyOverview: string;
  methodologyOverviewDesc: string;
  methodologyQuestionnaireStructure: string;
  methodologyQuestionnaireStructureDesc: string;
  methodologyTraitModelDetailed: string;
  methodologyTraitModelDetailedDesc: string;
  methodologyScoringFormula: string;
  methodologyScoringFormulaDesc: string;
  methodologySubScoresDesc: string;
  methodologyTradeOffsDesc: string;
  methodologyPriorityWeightsDesc: string;
  methodologyProfilesDetailed: string;
  methodologyProfilesDetailedDesc: string;
  methodologyCalibrationDetailed: string;
  methodologyCalibrationDetailedDesc: string;
  methodologyValidationDetailed: string;
  methodologyValidationDetailedDesc: string;
  methodologyDataPrivacy: string;
  methodologyDataPrivacyDesc: string;
  methodologyTechStack: string;
  methodologyTechStackDesc: string;
  methodologyDimensions: string;
  methodologyDimensionsDesc: string;
  methodologyValuesStep: string;
  methodologyValuesStepDesc: string;

  // Navigation
  navExplorer: string;
  navMethodology: string;
  navResults: string;
  navHome: string;
}

// ============================================================
// English
// ============================================================

const en: UIStrings = {
  appName: 'Specialty Match',
  forMedicalStudents: 'For medical students',
  heroTitle1: 'Find the medical specialty',
  heroTitle2: 'that fits you.',
  heroSubtitle: 'Answer questions about your tendencies, working style, and values, then explore how closely your answers align with the current specialty profiles.',
  startButton: 'Start the assessment',
  feature1Title: 'Thinking & working style',
  feature1Desc: 'How you solve problems and approach tasks.',
  feature2Title: 'Patient care & people',
  feature2Desc: 'How you relate to patients and colleagues.',
  feature3Title: 'Values & lifestyle',
  feature3Desc: 'What matters to you beyond the work.',
  footerNote: 'A self-reflection tool — results are guidance, not a verdict.',
  questionsCount: (n: number) => `${n} questions · ~8 minutes`,

  step: (current: number, total: number) => `Step ${current} of ${total}`,
  home: 'Home',
  back: 'Back',
  continue: 'Continue',
  seeResults: 'See my results',

  specialtyTitle: 'Which specialty draws you in?',
  specialtySubtitle: 'If a field already calls to you, pick it so you can see where it ranks. This choice does not change the score; skip it if nothing stands out yet.',
  searchPlaceholder: 'Search specialties...',
  specialtySelected: 'selected',
  specialtyOptional: 'Optional — pick one you\'re already drawn to.',

  valuesTitle: 'What do you value most?',
  valuesSubtitle: 'Choose up to four values that matter most to you in your career.',
  valuesSelectUpTo: (n: number) => `Select up to ${n} values.`,
  valuesMoreToSelect: (n: number) => `${n} more to select.`,
  valuesAllSelected: 'All selected — tap one to swap it out.',

  answeredCount: (answered: number, total: number) => `${answered}/${total}`,
  sliderRarely: 'Not at all like me',
  sliderStrongly: 'Very much like me',

  resultsRetake: 'Retake',
  topMatch: 'Highest fit index',
  matchPercent: 'fit index',
  whyItFits: 'What drives this index',
  preferredCallout: (name: string, rank: number, percent: number) =>
    `The specialty you picked — ${name} — ranked #${rank}, with a fit index of ${percent}/100.`,
  otherMatches: 'Your complete Top 10',
  otherMatchesDesc: 'Ranks 2–10 are shown in full below, with no additional click required.',
  resultsRankLabel: (rank: number) => `Rank ${rank}`,
  resultsSpecialtyOverview: 'About the specialty',
  resultsProfessionalProfile: 'Professional environment and useful qualities',
  resultsInformationDisclaimer: 'These specialty portraits are orientation material, not psychological diagnoses or guarantees. Medical practice varies by country, institution, role, and individual career path.',
  resultsReferencesDisclaimer: 'References are shown for traceability and should be checked before academic or clinical use.',
  fullRanking: 'Full ranking',
  fullRankingDesc: (n: number) => `All ${n} specialties, grouped by field.`,
  retakeAssessment: 'Retake the assessment',

  specialistBadge: 'Specialist mode',
  specialistTitle: 'Are you a medical specialist?',
  specialistSubtitle: 'Help us improve the matching algorithm. Data is stored only if you explicitly submit it for research, without your name or email.',
  specialistSpecialtyTitle: 'What specialty do you practice?',
  specialistSpecialtySubtitle: 'Select your current specialty so we can compare your profile with your field.',
  specialistSpecialtyRequired: 'Required — select the specialty you currently practice.',
  specialistPromptTitle: 'Tell us about your practice',
  specialistPromptDesc: 'After the 81-item questionnaire, answer these five questions about your specialty. By submitting, you agree that your specialty, answers, selected values, and qualitative calibration data are stored for research.',
  specialistActualSpecialty: 'Your actual specialty',
  specialistSelectSpecialty: 'Select your specialty',
  specialistChangeSpecialty: 'Change',
  specialistSubmit: 'Consent and submit for research',
  specialistSubmitting: 'Submitting...',
  specialistSuccess: 'Thank you! Your responses have been submitted for research.',
  specialistError: 'Something went wrong. Please try again.',
  specialistThankYou: 'Thank you for contributing',
  specialistThankYouDesc: 'Your responses have been added to the research dataset and are available for reviewed calibration analysis.',
  specialistAnother: 'View my results',
  specialistToggleLabel: 'I am a specialist',
  specialistToggleDesc: 'Specialists answer the same 81 items and five follow-up questions to support reviewed, versioned calibration.',
  specialistMode: 'Specialist',
  studentMode: 'Student',

  specialistYearsExperience: 'Years of experience',
  specialistYearsPlaceholder: 'e.g. 10',
  specialistCareerSatisfaction: 'How satisfied are you with your career?',
  specialistWouldChooseAgain: 'Would you choose the same specialty again?',
  specialistIntentionToChange: 'Do you intend to change specialty?',
  specialistVoluntaryChoice: 'How voluntarily did you choose your specialty?',
  specialistYes: 'Yes',
  specialistNo: 'No',
  specialistNotSure: 'Not sure',
  specialistVerySatisfied: 'Very satisfied',
  specialistSatisfied: 'Satisfied',
  specialistNeutral: 'Neutral',
  specialistDissatisfied: 'Dissatisfied',
  specialistVeryDissatisfied: 'Very dissatisfied',
  specialistDefinitely: 'Definitely',
  specialistProbably: 'Probably',
  specialistProbablyNot: 'Probably not',
  specialistDefinitelyNot: 'Definitely not',
  specialistFullyVoluntary: 'Fully voluntary',
  specialistSomewhatVoluntary: 'Somewhat voluntary',
  specialistNotVoluntary: 'Not voluntary',
  specialistCurrentView: 'How do you see your specialty now?',
  specialistCurrentViewPlaceholder: 'Describe how you currently view the work, its strengths, and its challenges.',
  specialistChangesOverYears: 'What has changed over the years?',
  specialistChangesOverYearsPlaceholder: 'Describe how the specialty or your view of it has evolved.',
  specialistMostImportantQuality: 'What is the most important quality required for your specialty?',
  specialistMostImportantQualityPlaceholder: 'Name the quality and briefly explain why it matters.',
  specialistWhyNotChooseAgain: 'Why would you not choose it again?',
  specialistWhyNotChooseAgainPlaceholder: 'Briefly explain what would lead you to choose differently.',
  specialistStudentSelfQuestion: 'What question do you think a student should ask themselves before choosing this specialty?',
  specialistStudentSelfQuestionPlaceholder: 'Write the most useful self-reflection question for a student.',
  specialistFreeTextPrivacy: 'Required fields. Do not include names, contact details, or any information that could identify a patient or another person.',
  studentDataTitle: 'Help us understand student profiles',
  studentDataDesc: 'If you choose to save, your 81 answers, selected values, preferred specialty, optional study year, and browser-computed ranking are stored without your name or email for research. Saving records your consent; you can skip this step.',
  studentStudyYear: 'Year of study',
  studentPreferNotToSay: 'Prefer not to say',
  studentYear: (n: number) => `Year ${n}`,
  studentContinue: 'Consent, save, and view results',
  studentSkip: 'Skip and view results',
  studentSaving: 'Saving...',

  qProfileTitle: 'Your trait profile',
  qProfileSubtitle: 'This is the trait summary computed from your answers and selected career values.',
  qProfileTopTraits: 'Strongest traits',
  qProfileBottomTraits: 'Areas with less emphasis',
  qProfileContinue: 'See specialty matches',

  prioritiesTitle: 'Dimension weighting',
  prioritiesSubtitle: 'Dimension weights are fixed at the neutral setting in this version; there are no user-adjustable sliders.',
  prioritiesReset: 'Reset to default',
  prioritiesContinue: 'See updated results',
  priorityThinking: 'Thinking Style',
  priorityWorking: 'Working Style',
  priorityInterpersonal: 'Interpersonal Fit',
  priorityTechnical: 'Technical / Practical',
  priorityLifestyle: 'Lifestyle & Values',
  priorityLess: 'Less',
  priorityMore: 'More',
  priorityNeutral: 'Neutral',

  subScoreThinking: 'Thinking Style',
  subScoreWorking: 'Working Style',
  subScoreInterpersonal: 'Interpersonal Fit',
  subScoreTechnical: 'Technical / Practical',
  subScoreLifestyle: 'Lifestyle & Values',
  subScoresTitle: 'Similarity by dimension',

  tradeOffsTitle: 'Potential trade-offs',
  tradeOffsDesc: 'Areas where your profile differs from the typical demands of this specialty.',

  oppositeFitTitle: 'Why this scored lower',
  oppositeFitDesc: 'Explore the key differences between your profile and this specialty.',
  oppositeFitExplore: 'Explore fit',
  oppositeFitClose: 'Close',
  oppositeFitLegend: 'Student profile vs specialty profile',
  oppositeFitValues: (student: number, target: number, gap: number) =>
    `Student profile: ${student}/100; specialty profile: ${target}/100; gap: ${gap}.`,

  comparisonTitle: 'Compare specialties',
  comparisonSubtitle: 'Select 2–3 specialties to compare side-by-side.',
  comparisonAdd: 'Add to compare',
  comparisonRemove: 'Remove',
  comparisonCompare: 'Compare selected',
  comparisonMaxSelected: 'You can compare up to 3 specialties.',
  comparisonAxisPatientInteraction: 'Patient Interaction',
  comparisonAxisCrisisWork: 'Crisis & Acute Work',
  comparisonAxisTechnicalActivity: 'Technical Activity',
  comparisonAxisVisualReasoning: 'Visual Reasoning',
  comparisonAxisLongTermCare: 'Long-term Care',
  comparisonAxisLifestyleBalance: 'Lifestyle Balance',
  comparisonAxisResearch: 'Research Orientation',
  comparisonAxisManualActivity: 'Manual Activity',
  comparisonYourProfile: 'You',
  comparisonBack: 'Back to results',

  explorerTitle: 'Specialty Explorer',
  explorerSubtitle: 'Browse all specialties and explore what each one involves.',
  explorerSearchPlaceholder: 'Search specialties...',
  explorerAllCategories: 'All categories',
  explorerWorkStyle: 'Work style',
  explorerPatientContact: 'Patient contact',
  explorerCareType: 'Care type',
  explorerProceduralIntensity: 'Procedural intensity',
  explorerKeyTraits: 'Key traits',
  explorerReferences: 'References',
  explorerYourMatch: 'Your fit index',
  explorerViewDetail: 'View details',
  explorerBack: 'Back',
  explorerBackToResults: 'Back to results',
  explorerBackToExplorer: 'Back to explorer',

  methodologyTitle: 'Science & Methodology',
  methodologySubtitle: 'How Specialty Match works — transparently.',
  methodologyQuestionnaire: 'The Questionnaire',
  methodologyQuestionnaireDesc: '81 rating items across 7 sections (thinking, working, interpersonal, motivations, personality, skills, values), plus a separate selection of up to 4 career values. Each rating item uses a 1–10 scale with clear anchors.',
  methodologyTraitModel: 'Trait Model',
  methodologyTraitModelDesc: 'Ratings map to latent traits through weighted directional mappings. Selected career values increase the matching importance of mapped traits without changing traits already measured by the 81 ratings; a selected value-only trait receives a 90/100 signal.',
  methodologyScoring: 'Scoring Approach',
  methodologyScoringDesc: 'For each specialty, trait similarity is 100 minus the absolute difference between the participant and target values. The displayed result is an importance-weighted similarity index out of 100, not a probability or a validated success percentage.',
  methodologyProfiles: 'Specialty Profiles',
  methodologyProfilesDesc: 'Each specialty is defined by target trait values and importance weights derived from initial heuristic archetypes. The profiles are versioned and editable by authorized reviewers, but they are not yet clinically validated norms.',
  methodologyCalibration: 'Calibration Process',
  methodologyCalibrationDesc: 'Practicing specialists answer the same 81 items and five qualitative follow-up questions. Authorized reviewers can use these data to inform deliberate, versioned profile changes; responses do not update weights automatically.',
  methodologyValidation: 'Validation Strategy',
  methodologyValidationDesc: 'Specialists’ own-field ranks and top-k recall are tracked as descriptive diagnostics. They do not by themselves establish validity or justify automatic weight changes; test-retest and external validation remain to be established.',
  methodologyAlgorithmVersion: 'Algorithm version',
  methodologyLimitations: 'Limitations',
  methodologyLimitationsDesc: 'This tool captures self-reported tendencies, not fixed traits. Some measured traits are not represented in every current specialty profile, so unavailable evidence is omitted rather than treated as a mismatch. Small specialist samples are descriptive only. The index does not predict success or satisfaction.',
  methodologyBibliography: 'Bibliography',
  methodologyDisclaimer: 'Career-orientation tool, not a diagnosis',
  methodologyDisclaimerDesc: 'Specialty Match is a self-reflection and career-exploration tool. It is not a psychological assessment, personality test, or clinical instrument. Results are guidance, not a verdict.',
  methodologyBack: 'Back',
  methodologyOverview: 'Project Overview',
  methodologyOverviewDesc: 'Specialty Match is a career-orientation tool for medical students. It uses an 81-item questionnaire to build a trait profile, then compares that profile with the specialty profiles in the current catalog. Its purpose is reflection and exploration, not prediction or a career decision.',
  methodologyQuestionnaireStructure: 'Questionnaire Structure',
  methodologyQuestionnaireStructureDesc: 'The questionnaire has 7 sections: Thinking Style (12 items), Working Style (13 items), Interpersonal Skills (11 items), Motivations (12 items), Personality (13 items), Special Skills (9 items), and Values & Lifestyle (11 items). In student mode, a preferred specialty may be selected for rank comparison only; it never changes the score. Participants also select up to 4 career values. Each rating item uses a 1–10 scale anchored at "Not at all like me" and "Very much like me".',
  methodologyTraitModelDetailed: 'Trait Model — How Answers Become Traits',
  methodologyTraitModelDetailedDesc: 'Each rating maps to one or more latent traits through a directional weighted mapping. Direction (+1 or -1) determines whether a high response increases or decreases the trait; the mappings currently use weights from 0.8 to 1.5. Multiple contributions to one trait are combined as a weighted average. The catalog contains 96 traits across five dimensions: 92 are derived from questionnaire ratings, 3 are available only through career-value selection, and prevention orientation is currently unmeasured.',
  methodologyScoringFormula: 'Scoring Formula',
  methodologyScoringFormulaDesc: 'For every trait present in both the participant evidence and the specialty profile, similarity = 100 - |participant_value - target_value|. The index is Σ(similarity × effective importance) / Σ(effective importance). Effective importance combines the profile weight, neutral dimension weight, and any selected-value multiplier. The 0–100 result is a similarity index: 100 means exact agreement on the compared targets; it is not a probability, percentile, or validated cutoff.',
  methodologySubScoresDesc: 'Each specialty is also broken down into 5 dimension indices: Thinking Style, Working Style, Interpersonal Fit, Technical/Practical, and Lifestyle & Values. Each is the effective-importance-weighted average of available trait similarities in that dimension. A dimension with no comparable evidence is shown as unavailable, not as zero.',
  methodologyTradeOffsDesc: 'For every recommended specialty, the algorithm reports up to 5 available traits with a gap of at least 20 points and effective importance of at least 2, ordered by gap × effective importance. They are prompts for reflection, not barriers to success.',
  methodologyPriorityWeightsDesc: 'The current interface applies the neutral 1.0× weight to all five dimensions. User-adjustable dimension sliders are not enabled in this version. Selected career values can still increase the effective importance of their mapped traits.',
  methodologyProfilesDetailed: 'Specialty Profiles — How Fields Are Defined',
  methodologyProfilesDetailedDesc: 'Each specialty in the current catalog has a partial trait profile with targets from 0 to 100 and integer importance weights from 1 to 3 (relevant, important, very important). The starting profiles were assembled from heuristic archetypes such as surgical, cognitive-clinical, longitudinal, people-oriented, technical, diagnostic, laboratory, pediatric, and population. They are versioned calibration hypotheses, not validated clinical norms.',
  methodologyCalibrationDetailed: 'Calibration — Learning from Real Specialists',
  methodologyCalibrationDetailedDesc: 'Practicing specialists submit the same 81 ratings, selected career values, their actual specialty, and five follow-ups: how they see the specialty now; what changed over the years; its most important required quality; whether they would choose it again (and why not, if applicable); and the question a student should ask before choosing it. Authorized reviewers may use the dataset to propose profile edits. Publication is deliberate and versioned; no response changes a target automatically.',
  methodologyValidationDetailed: 'Validation Strategy',
  methodologyValidationDetailedDesc: 'The dashboard tracks each specialist’s self-identified field rank and top-k recall under a named engine and catalog version. These are descriptive diagnostics of the current engine and can be distorted by small or uneven samples, incomplete trait coverage, and profile similarity. They must not alone validate or modify weights. Test-retest reliability, independent cohorts, and outcome-based validation have not yet been established.',
  methodologyDataPrivacy: 'Data Privacy',
  methodologyDataPrivacyDesc: 'Responses are stored only when a participant explicitly submits them for research. The form requests no name, email, or account identifier. Student answers and specialist calibration data are retained in a secured database for analysis and algorithm refinement.',
  methodologyTechStack: 'Technical Implementation',
  methodologyTechStackDesc: 'The scoring engine runs entirely in the browser: trait calculation, similarity scoring, career-value importance weighting, and trade-off detection are client-side. Research submissions are stored in a Supabase PostgreSQL database protected by row-level security. The application is built with React, TypeScript, and Tailwind CSS.',
  methodologyDimensions: 'The Five Dimensions',
  methodologyDimensionsDesc: 'The 96 catalog traits are grouped into 5 dimensions for sub-scores. Thinking has 18 traits; Working, 16; Interpersonal, 18; Technical, 15; and Lifestyle & Values, 29. A specialty uses only a relevant subset, and an unavailable dimension is not scored as zero.',
  methodologyValuesStep: 'Career Values — Preference Weighting',
  methodologyValuesStepDesc: 'Participants select up to 4 career values from 14 options. A selected value does not inflate a trait already measured by the questionnaire; instead, it increases the matching importance of the mapped trait by about 1.21× to 1.50×. If the mapped trait has no questionnaire item, selection creates a fixed 90/100 value-only signal so that choosing it cannot behave like a neutral response.',

  navExplorer: 'Explorer',
  navMethodology: 'Methodology',
  navResults: 'Results',
  navHome: 'Home',
};

// ============================================================
// Romanian
// ============================================================

const ro: UIStrings = {
  appName: 'Specialty Match',
  forMedicalStudents: 'Pentru studenții la medicină',
  heroTitle1: 'Găsește specialitatea medicală',
  heroTitle2: 'care ți se potrivește.',
  heroSubtitle: 'Răspunde la întrebări despre tendințele, stilul de lucru și valorile tale, apoi explorează cât de bine se aliniază răspunsurile tale cu profilurile actuale ale specialităților.',
  startButton: 'Începe evaluarea',
  feature1Title: 'Gândire și stil de lucru',
  feature1Desc: 'Cum rezolvi probleme și cum abordezi sarcinile.',
  feature2Title: 'Îngrijirea pacienților și oameni',
  feature2Desc: 'Cum te raportezi la pacienți și colegi.',
  feature3Title: 'Valori și stil de viață',
  feature3Desc: 'Ce contează pentru tine dincolo de muncă.',
  footerNote: 'Un instrument de auto-reflecție — rezultatele sunt orientative, nu un verdict.',
  questionsCount: (n: number) => `${n} întrebări · ~8 minute`,

  step: (current: number, total: number) => `Pasul ${current} din ${total}`,
  home: 'Acasă',
  back: 'Înapoi',
  continue: 'Continuă',
  seeResults: 'Vezi rezultatele',

  specialtyTitle: 'Ce specialitate te atrage?',
  specialtySubtitle: 'Dacă un domeniu te atrage deja, alege-l pentru a vedea unde se clasează. Alegerea nu modifică scorul; omite pasul dacă nimic nu iese încă în evidență.',
  searchPlaceholder: 'Caută specialități...',
  specialtySelected: 'selectat',
  specialtyOptional: 'Opțional — alege una care te atrage deja.',

  valuesTitle: 'Ce prețuiești cel mai mult?',
  valuesSubtitle: 'Alege până la patru valori care contează cel mai mult pentru tine în carieră.',
  valuesSelectUpTo: (n: number) => `Selectează până la ${n} valori.`,
  valuesMoreToSelect: (n: number) => `Mai ai ${n} de selectat.`,
  valuesAllSelected: 'Toate selectate — apasă pe una pentru a o înlocui.',

  answeredCount: (answered: number, total: number) => `${answered}/${total}`,
  sliderRarely: 'Deloc ca mine',
  sliderStrongly: 'Foarte mult ca mine',

  resultsRetake: 'Reia',
  topMatch: 'Cel mai mare indice de potrivire',
  matchPercent: 'indice de potrivire',
  whyItFits: 'Ce determină acest indice',
  preferredCallout: (name: string, rank: number, percent: number) =>
    `Specialitatea aleasă — ${name} — s-a clasat pe locul #${rank}, cu un indice de potrivire de ${percent}/100.`,
  otherMatches: 'Top 10 complet',
  otherMatchesDesc: 'Locurile 2–10 sunt afișate integral mai jos, fără să fie necesar un clic suplimentar.',
  resultsRankLabel: (rank: number) => `Locul ${rank}`,
  resultsSpecialtyOverview: 'Despre specialitate',
  resultsProfessionalProfile: 'Mediul profesional și calitățile utile',
  resultsInformationDisclaimer: 'Aceste portrete ale specialităților sunt materiale de orientare, nu diagnostice psihologice și nici garanții. Practica medicală variază în funcție de țară, instituție, rol și parcursul profesional individual.',
  resultsReferencesDisclaimer: 'Referințele sunt afișate pentru trasabilitate și trebuie verificate înainte de utilizarea academică sau clinică.',
  fullRanking: 'Clasament complet',
  fullRankingDesc: (n: number) => `Toate cele ${n} specialități, grupate pe domenii.`,
  retakeAssessment: 'Reia evaluarea',

  specialistBadge: 'Mod specialist',
  specialistTitle: 'Ești specialist medical?',
  specialistSubtitle: 'Ajută-ne să îmbunătățim algoritmul. Datele sunt stocate numai dacă le trimiți explicit pentru cercetare, fără nume sau adresă de e-mail.',
  specialistSpecialtyTitle: 'Ce specialitate practici?',
  specialistSpecialtySubtitle: 'Selectează specialitatea în care profesezi în prezent, pentru a-ți putea compara profilul cu domeniul tău.',
  specialistSpecialtyRequired: 'Obligatoriu — selectează specialitatea pe care o practici în prezent.',
  specialistPromptTitle: 'Spune-ne despre experiența ta profesională',
  specialistPromptDesc: 'După chestionarul cu 81 de itemi, răspunde la aceste cinci întrebări despre specialitatea ta. Prin trimitere, accepți stocarea pentru cercetare a specialității, răspunsurilor, valorilor selectate și datelor calitative de calibrare.',
  specialistActualSpecialty: 'Specialitatea ta reală',
  specialistSelectSpecialty: 'Selectează specialitatea',
  specialistChangeSpecialty: 'Modifică',
  specialistSubmit: 'Acceptă și trimite pentru cercetare',
  specialistSubmitting: 'Se trimite...',
  specialistSuccess: 'Mulțumim! Răspunsurile tale au fost trimise pentru cercetare.',
  specialistError: 'Ceva a mers greșit. Te rugăm să încerci din nou.',
  specialistThankYou: 'Mulțumim pentru contribuție',
  specialistThankYouDesc: 'Răspunsurile tale au fost adăugate la setul de date de cercetare și sunt disponibile pentru o analiză de calibrare revizuită.',
  specialistAnother: 'Vezi rezultatele mele',
  specialistToggleLabel: 'Sunt specialist',
  specialistToggleDesc: 'Specialiștii răspund la aceiași 81 de itemi și la cinci întrebări ulterioare pentru a susține o calibrare revizuită și versionată.',
  specialistMode: 'Specialist',
  studentMode: 'Student',

  specialistYearsExperience: 'Ani de experiență',
  specialistYearsPlaceholder: 'ex. 10',
  specialistCareerSatisfaction: 'Cât de mulțumit ești de cariera ta?',
  specialistWouldChooseAgain: 'Ai alege aceeași specialitate din nou?',
  specialistIntentionToChange: 'Ai intenția să schimbi specialitatea?',
  specialistVoluntaryChoice: 'Cât de voluntar ai ales specialitatea?',
  specialistYes: 'Da',
  specialistNo: 'Nu',
  specialistNotSure: 'Nu sunt sigur',
  specialistVerySatisfied: 'Foarte mulțumit',
  specialistSatisfied: 'Mulțumit',
  specialistNeutral: 'Neutru',
  specialistDissatisfied: 'Nemulțumit',
  specialistVeryDissatisfied: 'Foarte nemulțumit',
  specialistDefinitely: 'Definitiv',
  specialistProbably: 'Probabil',
  specialistProbablyNot: 'Probabil nu',
  specialistDefinitelyNot: 'Definitiv nu',
  specialistFullyVoluntary: 'Pe deplin voluntar',
  specialistSomewhatVoluntary: 'Oarecum voluntar',
  specialistNotVoluntary: 'Nu voluntar',
  specialistCurrentView: 'Cum îți vezi specialitatea în prezent?',
  specialistCurrentViewPlaceholder: 'Descrie cum vezi acum activitatea, punctele forte și dificultățile ei.',
  specialistChangesOverYears: 'Ce s-a schimbat de-a lungul anilor?',
  specialistChangesOverYearsPlaceholder: 'Descrie cum a evoluat specialitatea sau perspectiva ta asupra ei.',
  specialistMostImportantQuality: 'Care este cea mai importantă calitate necesară în specialitatea ta?',
  specialistMostImportantQualityPlaceholder: 'Numește calitatea și explică pe scurt de ce este importantă.',
  specialistWhyNotChooseAgain: 'De ce nu ai alege-o din nou?',
  specialistWhyNotChooseAgainPlaceholder: 'Explică pe scurt ce te-ar determina să alegi altfel.',
  specialistStudentSelfQuestion: 'Ce întrebare crezi că ar trebui să își pună un student înainte de a alege această specialitate?',
  specialistStudentSelfQuestionPlaceholder: 'Scrie cea mai utilă întrebare de reflecție pentru un student.',
  specialistFreeTextPrivacy: 'Câmpuri obligatorii. Nu include nume, date de contact sau informații care ar putea identifica un pacient ori o altă persoană.',
  studentDataTitle: 'Ajută-ne să înțelegem profilurile studenților',
  studentDataDesc: 'Dacă alegi salvarea, cele 81 de răspunsuri, valorile, specialitatea preferată, anul opțional și clasamentul calculat în browser sunt stocate fără nume sau e-mail pentru cercetare. Salvarea înregistrează consimțământul; poți omite acest pas.',
  studentStudyYear: 'Anul de studiu',
  studentPreferNotToSay: 'Prefer să nu spun',
  studentYear: (n: number) => `Anul ${n}`,
  studentContinue: 'Acceptă, salvează și vezi rezultatele',
  studentSkip: 'Omite și vezi rezultatele',
  studentSaving: 'Se salvează...',

  qProfileTitle: 'Profilul tău de trăsături',
  qProfileSubtitle: 'Acesta este rezumatul trăsăturilor calculat din răspunsurile și valorile profesionale selectate.',
  qProfileTopTraits: 'Cele mai puternice trăsături',
  qProfileBottomTraits: 'Zone cu mai puțin accent',
  qProfileContinue: 'Vezi potrivirile de specialitate',

  prioritiesTitle: 'Ponderarea dimensiunilor',
  prioritiesSubtitle: 'Ponderile dimensiunilor sunt fixe la nivelul neutru în această versiune; nu există cursoare ajustabile de utilizator.',
  prioritiesReset: 'Resetează la implicit',
  prioritiesContinue: 'Vezi rezultate actualizate',
  priorityThinking: 'Stil de gândire',
  priorityWorking: 'Stil de lucru',
  priorityInterpersonal: 'Potrivire interpersonală',
  priorityTechnical: 'Tehnic / Practic',
  priorityLifestyle: 'Stil de viață și valori',
  priorityLess: 'Mai puțin',
  priorityMore: 'Mai mult',
  priorityNeutral: 'Neutru',

  subScoreThinking: 'Stil de gândire',
  subScoreWorking: 'Stil de lucru',
  subScoreInterpersonal: 'Potrivire interpersonală',
  subScoreTechnical: 'Tehnic / Practic',
  subScoreLifestyle: 'Stil de viață și valori',
  subScoresTitle: 'Similaritate pe dimensiuni',

  tradeOffsTitle: 'Compromisuri potențiale',
  tradeOffsDesc: 'Zone în care profilul tău diferă de cerințele tipice ale acestei specialități.',

  oppositeFitTitle: 'De ce a scorat mai puțin',
  oppositeFitDesc: 'Explorează diferențele cheie dintre profilul tău și această specialitate.',
  oppositeFitExplore: 'Explorează potrivirea',
  oppositeFitClose: 'Închide',
  oppositeFitLegend: 'Profilul studentului comparat cu profilul specialității',
  oppositeFitValues: (student: number, target: number, gap: number) =>
    `Profilul studentului: ${student}/100; profilul specialității: ${target}/100; diferență: ${gap}.`,

  comparisonTitle: 'Compară specialitățile',
  comparisonSubtitle: 'Selectează 2–3 specialități pentru comparare side-by-side.',
  comparisonAdd: 'Adaugă pentru comparare',
  comparisonRemove: 'Elimină',
  comparisonCompare: 'Compară selectate',
  comparisonMaxSelected: 'Poți compara până la 3 specialități.',
  comparisonAxisPatientInteraction: 'Interacțiune cu pacienți',
  comparisonAxisCrisisWork: 'Muncă de criză',
  comparisonAxisTechnicalActivity: 'Activitate tehnică',
  comparisonAxisVisualReasoning: 'Raționament vizual',
  comparisonAxisLongTermCare: 'Îngrijire pe termen lung',
  comparisonAxisLifestyleBalance: 'Echilibru de viață',
  comparisonAxisResearch: 'Orientare spre cercetare',
  comparisonAxisManualActivity: 'Activitate manuală',
  comparisonYourProfile: 'Tu',
  comparisonBack: 'Înapoi la rezultate',

  explorerTitle: 'Explorator de specialități',
  explorerSubtitle: 'Răsfoiește toate specialitățile și explorează ce implică fiecare.',
  explorerSearchPlaceholder: 'Caută specialități...',
  explorerAllCategories: 'Toate categoriile',
  explorerWorkStyle: 'Stil de lucru',
  explorerPatientContact: 'Contact cu pacienți',
  explorerCareType: 'Tip de îngrijire',
  explorerProceduralIntensity: 'Intensitate procedurală',
  explorerKeyTraits: 'Trăsături cheie',
  explorerReferences: 'Referințe',
  explorerYourMatch: 'Indicele tău de potrivire',
  explorerViewDetail: 'Vezi detalii',
  explorerBack: 'Înapoi',
  explorerBackToResults: 'Înapoi la rezultate',
  explorerBackToExplorer: 'Înapoi la explorator',

  methodologyTitle: 'Știință și Metodologie',
  methodologySubtitle: 'Cum funcționează Specialty Match — transparent.',
  methodologyQuestionnaire: 'Chestionarul',
  methodologyQuestionnaireDesc: '81 de itemi de evaluare în 7 secțiuni (gândire, lucru, interpersonal, motivații, personalitate, abilități, valori), plus o selecție separată de până la 4 valori profesionale. Fiecare item de evaluare folosește o scară 1–10 cu repere clare.',
  methodologyTraitModel: 'Model de trăsături',
  methodologyTraitModelDesc: 'Evaluările se mapează la trăsături latente prin asocieri direcționale ponderate. Valorile profesionale selectate cresc importanța trăsăturilor asociate în calculul potrivirii fără a modifica trăsăturile deja măsurate de cei 81 de itemi; o trăsătură măsurată numai prin selecția unei valori primește un semnal de 90/100.',
  methodologyScoring: 'Abordare de scorare',
  methodologyScoringDesc: 'Pentru fiecare specialitate, similaritatea unei trăsături este 100 minus diferența absolută dintre valoarea participantului și țintă. Rezultatul afișat este un indice de similaritate ponderat, din 100, nu o probabilitate sau un procent validat de succes.',
  methodologyProfiles: 'Profiluri de specialitate',
  methodologyProfilesDesc: 'Fiecare specialitate este definită prin valori țintă și ponderi de importanță derivate din arhetipuri euristice inițiale. Profilurile sunt versionate și editabile de evaluatori autorizați, dar nu sunt încă norme validate clinic.',
  methodologyCalibration: 'Proces de calibrare',
  methodologyCalibrationDesc: 'Specialiștii în exercițiu răspund la aceiași 81 de itemi și la cinci întrebări calitative ulterioare. Evaluatorii autorizați pot folosi datele pentru modificări deliberate și versionate ale profilurilor; răspunsurile nu actualizează automat ponderile.',
  methodologyValidation: 'Strategie de validare',
  methodologyValidationDesc: 'Rangul propriei specialități și rata de regăsire top-k sunt urmărite ca indicatori descriptivi. Ele nu stabilesc singure validitatea și nu justifică modificări automate ale ponderilor; validarea test-retest și externă rămân de realizat.',
  methodologyAlgorithmVersion: 'Versiune algoritm',
  methodologyLimitations: 'Limitări',
  methodologyLimitationsDesc: 'Acest instrument surprinde tendințe auto-raportate, nu trăsături fixe. Unele trăsături măsurate nu sunt reprezentate în toate profilurile actuale, astfel că dovezile indisponibile sunt omise, nu tratate ca nepotriviri. Eșantioanele mici de specialiști sunt doar descriptive. Indicele nu prezice succesul sau satisfacția.',
  methodologyBibliography: 'Bibliografie',
  methodologyDisclaimer: 'Instrument de orientare, nu un diagnostic',
  methodologyDisclaimerDesc: 'Specialty Match este un instrument de auto-reflecție și explorare a carierei. Nu este o evaluare psihologică, un test de personalitate sau un instrument clinic. Rezultatele sunt orientative, nu un verdict.',
  methodologyBack: 'Înapoi',
  methodologyOverview: 'Prezentare generală',
  methodologyOverviewDesc: 'Specialty Match este un instrument de orientare profesională pentru studenții la medicină. Folosește un chestionar cu 81 de itemi pentru a construi un profil de trăsături, apoi îl compară cu profilurile de specialitate din catalogul actual. Scopul său este reflecția și explorarea, nu predicția sau luarea unei decizii de carieră.',
  methodologyQuestionnaireStructure: 'Structura chestionarului',
  methodologyQuestionnaireStructureDesc: 'Chestionarul are 7 secțiuni: Stil de gândire (12 itemi), Stil de lucru (13 itemi), Abilități interpersonale (11 itemi), Motivații (12 itemi), Personalitate (13 itemi), Abilități speciale (9 itemi) și Valori și stil de viață (11 itemi). În modul student, o specialitate preferată poate fi selectată doar pentru compararea rangului; nu modifică niciodată scorul. Participanții selectează și până la 4 valori profesionale. Fiecare item folosește o scară 1–10 ancorată la „Deloc ca mine" și „Foarte mult ca mine".',
  methodologyTraitModelDetailed: 'Model de trăsături — Cum devin răspunsurile trăsături',
  methodologyTraitModelDetailedDesc: 'Fiecare evaluare se mapează la una sau mai multe trăsături latente printr-o asociere direcțională ponderată. Direcția (+1 sau -1) determină dacă un răspuns ridicat crește sau scade trăsătura, iar asocierile actuale folosesc ponderi între 0,8 și 1,5. Contribuțiile multiple la aceeași trăsătură sunt combinate printr-o medie ponderată. Catalogul conține 96 de trăsături în cinci dimensiuni: 92 provin din evaluările chestionarului, 3 sunt disponibile numai prin selecția valorilor profesionale, iar orientarea spre prevenție nu este măsurată în prezent.',
  methodologyScoringFormula: 'Formula de scorare',
  methodologyScoringFormulaDesc: 'Pentru fiecare trăsătură prezentă atât în dovezile participantului, cât și în profilul specialității, similaritatea = 100 - |valoare_participant - valoare_țintă|. Indicele este Σ(similaritate × importanță efectivă) / Σ(importanță efectivă). Importanța efectivă combină ponderea profilului, ponderea neutră a dimensiunii și orice multiplicator al unei valori selectate. Rezultatul 0–100 este un indice de similaritate: 100 înseamnă acord exact cu țintele comparate; nu este probabilitate, percentilă sau prag validat.',
  methodologySubScoresDesc: 'Fiecare specialitate este descompusă și în 5 indici pe dimensiuni: Stil de gândire, Stil de lucru, Potrivire interpersonală, Tehnic/Practic și Stil de viață și valori. Fiecare este media similarităților disponibile din dimensiunea respectivă, ponderată după importanța efectivă. O dimensiune fără dovezi comparabile este afișată ca indisponibilă, nu ca zero.',
  methodologyTradeOffsDesc: 'Pentru fiecare specialitate recomandată, algoritmul raportează până la 5 trăsături disponibile cu o diferență de cel puțin 20 de puncte și o importanță efectivă de cel puțin 2, ordonate după diferență × importanță efectivă. Sunt puncte de reflecție, nu bariere pentru succes.',
  methodologyPriorityWeightsDesc: 'Interfața actuală aplică ponderea neutră de 1,0× tuturor celor cinci dimensiuni. Cursoarele ajustabile de utilizator nu sunt activate în această versiune. Valorile profesionale selectate pot crește totuși importanța efectivă a trăsăturilor asociate.',
  methodologyProfilesDetailed: 'Profiluri de specialitate — Cum sunt definite domeniile',
  methodologyProfilesDetailedDesc: 'Fiecare specialitate din catalogul actual are un profil parțial de trăsături, cu ținte între 0 și 100 și ponderi întregi de importanță între 1 și 3 (relevantă, importantă, foarte importantă). Profilurile inițiale au fost alcătuite din arhetipuri euristice precum chirurgical, cognitiv-clinic, longitudinal, orientat spre oameni, tehnic, diagnostic, laborator, pediatric și populație. Sunt ipoteze de calibrare versionate, nu norme clinice validate.',
  methodologyCalibrationDetailed: 'Calibrare — Învățăm de la specialiști reali',
  methodologyCalibrationDetailedDesc: 'Specialiștii în exercițiu trimit aceleași 81 de evaluări, valorile profesionale selectate, specialitatea reală și cinci răspunsuri ulterioare: cum văd specialitatea acum; ce s-a schimbat în timp; cea mai importantă calitate necesară; dacă ar alege-o din nou (și motivul, dacă nu); și întrebarea pe care un student ar trebui să și-o pună înainte de alegere. Evaluatorii autorizați pot folosi setul de date pentru a propune modificări ale profilurilor. Publicarea este deliberată și versionată; niciun răspuns nu modifică automat o țintă.',
  methodologyValidationDetailed: 'Strategie de validare',
  methodologyValidationDetailedDesc: 'Dashboardul urmărește rangul domeniului auto-identificat al fiecărui specialist și rata de regăsire top-k pentru o versiune numită a motorului și catalogului. Acestea sunt diagnostice descriptive ale motorului actual și pot fi distorsionate de eșantioane mici sau neuniforme, acoperirea incompletă a trăsăturilor și similaritatea profilurilor. Nu trebuie să valideze sau să modifice singure ponderile. Fiabilitatea test-retest, cohortele independente și validarea pe rezultate nu au fost încă stabilite.',
  methodologyDataPrivacy: 'Confidențialitatea datelor',
  methodologyDataPrivacyDesc: 'Răspunsurile sunt stocate numai când participantul le trimite explicit pentru cercetare. Formularul nu solicită nume, e-mail sau identificator de cont. Răspunsurile studenților și datele de calibrare sunt păstrate într-o bază securizată pentru analiză și rafinarea algoritmului.',
  methodologyTechStack: 'Implementare tehnică',
  methodologyTechStackDesc: 'Motorul de scorare rulează integral în browser: calculul trăsăturilor, scorarea similarității, ponderarea importanței prin valorile profesionale și detectarea compromisurilor au loc pe partea clientului. Trimiterile pentru cercetare sunt stocate într-o bază de date PostgreSQL Supabase protejată prin securitate la nivel de rând. Aplicația este construită cu React, TypeScript și Tailwind CSS.',
  methodologyDimensions: 'Cele cinci dimensiuni',
  methodologyDimensionsDesc: 'Cele 96 de trăsături ale catalogului sunt grupate în 5 dimensiuni pentru sub-scoruri: Gândire are 18 trăsături; Lucru, 16; Interpersonal, 18; Tehnic, 15; iar Stil de viață și valori, 29. O specialitate folosește numai un subset relevant, iar o dimensiune indisponibilă nu primește scorul zero.',
  methodologyValuesStep: 'Valori profesionale — Ponderarea preferințelor',
  methodologyValuesStepDesc: 'Participanții selectează până la 4 valori profesionale din 14 opțiuni. O valoare selectată nu mărește artificial o trăsătură deja măsurată de chestionar; în schimb, crește importanța trăsăturii asociate în calculul potrivirii cu aproximativ 1,21×–1,50×. Dacă trăsătura asociată nu are un item în chestionar, selecția creează un semnal fix de 90/100, astfel încât alegerea să nu se comporte ca un răspuns neutru.',

  navExplorer: 'Explorator',
  navMethodology: 'Metodologie',
  navResults: 'Rezultate',
  navHome: 'Acasă',
};

// ============================================================
// French
// ============================================================

const fr: UIStrings = {
  appName: 'Specialty Match',
  forMedicalStudents: 'Pour les étudiants en médecine',
  heroTitle1: 'Trouvez la spécialité médicale',
  heroTitle2: 'qui vous correspond.',
  heroSubtitle: 'Répondez à des questions sur vos tendances, votre manière de travailler et vos valeurs, puis explorez dans quelle mesure vos réponses s’alignent avec les profils actuels des spécialités.',
  startButton: "Commencer l'évaluation",
  feature1Title: 'Pensée et style de travail',
  feature1Desc: 'Comment vous abordez les problèmes et les tâches.',
  feature2Title: 'Soins aux patients et relations',
  feature2Desc: 'Comment vous interagissez avec les patients et les collègues.',
  feature3Title: 'Valeurs et mode de vie',
  feature3Desc: 'Ce qui compte pour vous au-delà du travail.',
  footerNote: 'Un outil d\'auto-réflexion — les résultats sont indicatifs, non un verdict.',
  questionsCount: (n: number) => `${n} questions · ~8 minutes`,

  step: (current: number, total: number) => `Étape ${current} sur ${total}`,
  home: 'Accueil',
  back: 'Retour',
  continue: 'Continuer',
  seeResults: 'Voir mes résultats',

  specialtyTitle: 'Quelle spécialité vous attire ?',
  specialtySubtitle: 'Si un domaine vous attire déjà, choisissez-le pour voir son rang. Ce choix ne modifie pas le score ; passez cette étape si rien ne se démarque encore.',
  searchPlaceholder: 'Rechercher des spécialités...',
  specialtySelected: 'sélectionné',
  specialtyOptional: 'Optionnel — choisissez-en une qui vous attire déjà.',

  valuesTitle: 'Qu\'est-ce qui compte le plus pour vous ?',
  valuesSubtitle: 'Choisissez jusqu\'à quatre valeurs qui comptent le plus pour votre carrière.',
  valuesSelectUpTo: (n: number) => `Sélectionnez jusqu'à ${n} valeurs.`,
  valuesMoreToSelect: (n: number) => `${n} de plus à sélectionner.`,
  valuesAllSelected: 'Toutes sélectionnées — appuyez sur une pour la remplacer.',

  answeredCount: (answered: number, total: number) => `${answered}/${total}`,
  sliderRarely: 'Pas du tout moi',
  sliderStrongly: 'Tout à fait moi',

  resultsRetake: 'Recommencer',
  topMatch: 'Indice d’adéquation le plus élevé',
  matchPercent: 'indice d’adéquation',
  whyItFits: 'Ce qui détermine cet indice',
  preferredCallout: (name: string, rank: number, percent: number) =>
    `La spécialité choisie — ${name} — s’est classée au rang #${rank}, avec un indice d’adéquation de ${percent}/100.`,
  otherMatches: 'Votre Top 10 complet',
  otherMatchesDesc: 'Les rangs 2 à 10 sont affichés intégralement ci-dessous, sans clic supplémentaire.',
  resultsRankLabel: (rank: number) => `Rang ${rank}`,
  resultsSpecialtyOverview: 'Présentation de la spécialité',
  resultsProfessionalProfile: 'Environnement professionnel et qualités utiles',
  resultsInformationDisclaimer: 'Ces portraits de spécialités sont des contenus d’orientation, et non des diagnostics psychologiques ou des garanties. La pratique médicale varie selon le pays, l’établissement, le poste et le parcours professionnel individuel.',
  resultsReferencesDisclaimer: 'Les références sont affichées à des fins de traçabilité et doivent être vérifiées avant tout usage universitaire ou clinique.',
  fullRanking: 'Classement complet',
  fullRankingDesc: (n: number) => `Les ${n} spécialités, groupées par domaine.`,
  retakeAssessment: 'Recommencer l\'évaluation',

  specialistBadge: 'Mode spécialiste',
  specialistTitle: 'Êtes-vous un spécialiste médical ?',
  specialistSubtitle: 'Aidez-nous à améliorer l\'algorithme. Les données ne sont conservées que si vous les soumettez explicitement pour la recherche, sans nom ni adresse e-mail.',
  specialistSpecialtyTitle: 'Quelle spécialité exercez-vous ?',
  specialistSpecialtySubtitle: 'Sélectionnez votre spécialité actuelle afin que nous puissions comparer votre profil à votre domaine.',
  specialistSpecialtyRequired: 'Obligatoire — sélectionnez la spécialité que vous exercez actuellement.',
  specialistPromptTitle: 'Parlez-nous de votre pratique',
  specialistPromptDesc: 'Après le questionnaire de 81 items, répondez à ces cinq questions sur votre spécialité. En envoyant, vous acceptez que votre spécialité, vos réponses, vos valeurs et les données qualitatives de calibration soient conservées à des fins de recherche.',
  specialistActualSpecialty: 'Votre spécialité réelle',
  specialistSelectSpecialty: 'Sélectionnez votre spécialité',
  specialistChangeSpecialty: 'Modifier',
  specialistSubmit: 'Consentir et soumettre pour la recherche',
  specialistSubmitting: 'Envoi en cours...',
  specialistSuccess: 'Merci ! Vos réponses ont été soumises pour la recherche.',
  specialistError: 'Une erreur est survenue. Veuillez réessayer.',
  specialistThankYou: 'Merci pour votre contribution',
  specialistThankYouDesc: 'Vos réponses ont été ajoutées au jeu de données de recherche et sont disponibles pour une analyse de calibration contrôlée.',
  specialistAnother: 'Voir mes résultats',
  specialistToggleLabel: 'Je suis spécialiste',
  specialistToggleDesc: 'Les spécialistes répondent aux mêmes 81 items et à cinq questions complémentaires pour soutenir une calibration contrôlée et versionnée.',
  specialistMode: 'Spécialiste',
  studentMode: 'Étudiant',

  specialistYearsExperience: 'Années d\'expérience',
  specialistYearsPlaceholder: 'ex. 10',
  specialistCareerSatisfaction: 'Quel est votre niveau de satisfaction professionnelle ?',
  specialistWouldChooseAgain: 'Choisiriez-vous à nouveau la même spécialité ?',
  specialistIntentionToChange: 'Avez-vous l\'intention de changer de spécialité ?',
  specialistVoluntaryChoice: 'Dans quelle mesure avez-vous choisi votre spécialité volontairement ?',
  specialistYes: 'Oui',
  specialistNo: 'Non',
  specialistNotSure: 'Incertain',
  specialistVerySatisfied: 'Très satisfait',
  specialistSatisfied: 'Satisfait',
  specialistNeutral: 'Neutre',
  specialistDissatisfied: 'Insatisfait',
  specialistVeryDissatisfied: 'Très insatisfait',
  specialistDefinitely: 'Définitivement',
  specialistProbably: 'Probablement',
  specialistProbablyNot: 'Probablement pas',
  specialistDefinitelyNot: 'Définitivement pas',
  specialistFullyVoluntary: 'Totalement volontaire',
  specialistSomewhatVoluntary: 'Plutôt volontaire',
  specialistNotVoluntary: 'Non volontaire',
  specialistCurrentView: 'Comment voyez-vous votre spécialité aujourd’hui ?',
  specialistCurrentViewPlaceholder: 'Décrivez votre vision actuelle du travail, de ses atouts et de ses difficultés.',
  specialistChangesOverYears: 'Qu’est-ce qui a changé au fil des années ?',
  specialistChangesOverYearsPlaceholder: 'Décrivez comment la spécialité ou votre regard sur elle a évolué.',
  specialistMostImportantQuality: 'Quelle est la qualité la plus importante requise dans votre spécialité ?',
  specialistMostImportantQualityPlaceholder: 'Nommez cette qualité et expliquez brièvement pourquoi elle compte.',
  specialistWhyNotChooseAgain: 'Pourquoi ne choisiriez-vous pas à nouveau cette spécialité ?',
  specialistWhyNotChooseAgainPlaceholder: 'Expliquez brièvement ce qui vous conduirait à choisir autrement.',
  specialistStudentSelfQuestion: 'Quelle question un étudiant devrait-il se poser avant de choisir cette spécialité ?',
  specialistStudentSelfQuestionPlaceholder: 'Écrivez la question de réflexion la plus utile pour un étudiant.',
  specialistFreeTextPrivacy: 'Champs obligatoires. N’indiquez aucun nom, aucune coordonnée ni aucune information permettant d’identifier un patient ou une autre personne.',
  studentDataTitle: 'Aidez-nous à comprendre les profils étudiants',
  studentDataDesc: 'Si vous choisissez l’enregistrement, vos 81 réponses, vos valeurs, votre spécialité préférée, votre année facultative et le classement calculé dans le navigateur sont conservés sans nom ni e-mail pour la recherche. Enregistrer vaut consentement ; vous pouvez passer cette étape.',
  studentStudyYear: 'Année d’études',
  studentPreferNotToSay: 'Je préfère ne pas répondre',
  studentYear: (n: number) => `${n}e année`,
  studentContinue: 'Consentir, enregistrer et voir les résultats',
  studentSkip: 'Passer et voir les résultats',
  studentSaving: 'Enregistrement...',

  qProfileTitle: 'Votre profil de traits',
  qProfileSubtitle: 'Voici le résumé des traits calculé à partir de vos réponses et des valeurs professionnelles sélectionnées.',
  qProfileTopTraits: 'Traits les plus forts',
  qProfileBottomTraits: 'Domaines moins marqués',
  qProfileContinue: 'Voir les spécialités correspondantes',

  prioritiesTitle: 'Pondération des dimensions',
  prioritiesSubtitle: 'Les dimensions utilisent une pondération neutre fixe dans cette version ; aucun curseur n’est réglable par l’utilisateur.',
  prioritiesReset: 'Réinitialiser',
  prioritiesContinue: 'Voir les résultats mis à jour',
  priorityThinking: 'Style de pensée',
  priorityWorking: 'Style de travail',
  priorityInterpersonal: 'Adéquation interpersonnelle',
  priorityTechnical: 'Technique / Pratique',
  priorityLifestyle: 'Mode de vie et valeurs',
  priorityLess: 'Moins',
  priorityMore: 'Plus',
  priorityNeutral: 'Neutre',

  subScoreThinking: 'Style de pensée',
  subScoreWorking: 'Style de travail',
  subScoreInterpersonal: 'Adéquation interpersonnelle',
  subScoreTechnical: 'Technique / Pratique',
  subScoreLifestyle: 'Mode de vie et valeurs',
  subScoresTitle: 'Similarité par dimension',

  tradeOffsTitle: 'Compromis potentiels',
  tradeOffsDesc: 'Domaines où votre profil diffère des exigences typiques de cette spécialité.',

  oppositeFitTitle: 'Pourquoi ce score plus bas',
  oppositeFitDesc: 'Explorez les différences clés entre votre profil et cette spécialité.',
  oppositeFitExplore: 'Explorer l\'adéquation',
  oppositeFitClose: 'Fermer',
  oppositeFitLegend: 'Profil étudiant comparé au profil de la spécialité',
  oppositeFitValues: (student: number, target: number, gap: number) =>
    `Profil étudiant : ${student}/100 ; profil de la spécialité : ${target}/100 ; écart : ${gap}.`,

  comparisonTitle: 'Comparer les spécialités',
  comparisonSubtitle: 'Sélectionnez 2–3 spécialités pour les comparer côte à côte.',
  comparisonAdd: 'Ajouter à comparer',
  comparisonRemove: 'Retirer',
  comparisonCompare: 'Comparer la sélection',
  comparisonMaxSelected: 'Vous pouvez comparer jusqu\'à 3 spécialités.',
  comparisonAxisPatientInteraction: 'Interaction avec les patients',
  comparisonAxisCrisisWork: 'Travail de crise',
  comparisonAxisTechnicalActivity: 'Activité technique',
  comparisonAxisVisualReasoning: 'Raisonnement visuel',
  comparisonAxisLongTermCare: 'Soins de long terme',
  comparisonAxisLifestyleBalance: 'Équilibre de vie',
  comparisonAxisResearch: 'Orientation recherche',
  comparisonAxisManualActivity: 'Activité manuelle',
  comparisonYourProfile: 'Vous',
  comparisonBack: 'Retour aux résultats',

  explorerTitle: 'Explorateur de spécialités',
  explorerSubtitle: 'Parcourez toutes les spécialités et explorez ce que chacune implique.',
  explorerSearchPlaceholder: 'Rechercher des spécialités...',
  explorerAllCategories: 'Toutes les catégories',
  explorerWorkStyle: 'Style de travail',
  explorerPatientContact: 'Contact avec patients',
  explorerCareType: 'Type de soins',
  explorerProceduralIntensity: 'Intensité procédurale',
  explorerKeyTraits: 'Traits clés',
  explorerReferences: 'Références',
  explorerYourMatch: 'Votre indice d’adéquation',
  explorerViewDetail: 'Voir les détails',
  explorerBack: 'Retour',
  explorerBackToResults: 'Retour aux résultats',
  explorerBackToExplorer: 'Retour à l\'explorateur',

  methodologyTitle: 'Science et Méthodologie',
  methodologySubtitle: 'Comment fonctionne Specialty Match — en toute transparence.',
  methodologyQuestionnaire: 'Le Questionnaire',
  methodologyQuestionnaireDesc: '81 items d’évaluation répartis en 7 sections (pensée, travail, interpersonnel, motivations, personnalité, compétences, valeurs), plus une sélection séparée de 4 valeurs professionnelles au maximum. Chaque item d’évaluation utilise une échelle de 1 à 10 avec des repères clairs.',
  methodologyTraitModel: 'Modèle de Traits',
  methodologyTraitModelDesc: 'Les évaluations sont associées à des traits latents par des mappages directionnels pondérés. Les valeurs professionnelles sélectionnées augmentent l’importance des traits associés dans le calcul sans modifier ceux déjà mesurés par les 81 évaluations ; un trait mesuré uniquement par une valeur sélectionnée reçoit un signal de 90/100.',
  methodologyScoring: 'Approche de Scoring',
  methodologyScoringDesc: 'Pour chaque spécialité, la similarité d’un trait vaut 100 moins la différence absolue entre la valeur du participant et la cible. Le résultat affiché est un indice de similarité pondéré sur 100, et non une probabilité ou un pourcentage de réussite validé.',
  methodologyProfiles: 'Profils de Spécialités',
  methodologyProfilesDesc: 'Chaque spécialité est définie par des valeurs cibles et des poids d’importance issus d’archétypes heuristiques initiaux. Les profils sont versionnés et modifiables par des évaluateurs autorisés, mais ne constituent pas encore des normes validées cliniquement.',
  methodologyCalibration: 'Processus de Calibration',
  methodologyCalibrationDesc: 'Les spécialistes en exercice répondent aux mêmes 81 items et à cinq questions qualitatives complémentaires. Les évaluateurs autorisés peuvent utiliser ces données pour éclairer des modifications délibérées et versionnées des profils ; les réponses ne changent jamais automatiquement les poids.',
  methodologyValidation: 'Stratégie de Validation',
  methodologyValidationDesc: 'Le rang de la spécialité propre des spécialistes et le rappel top-k sont suivis comme indicateurs descriptifs. Ils ne suffisent ni à établir la validité ni à justifier des changements automatiques de poids ; la validation test-retest et externe reste à établir.',
  methodologyAlgorithmVersion: 'Version de l\'algorithme',
  methodologyLimitations: 'Limites',
  methodologyLimitationsDesc: 'Cet outil décrit des tendances auto-déclarées, pas des traits fixes. Certains traits mesurés ne figurent pas dans tous les profils actuels ; les données indisponibles sont donc omises au lieu d’être traitées comme une incompatibilité. Les petits échantillons de spécialistes restent descriptifs. L’indice ne prédit ni la réussite ni la satisfaction.',
  methodologyBibliography: 'Bibliographie',
  methodologyDisclaimer: 'Outil d\'orientation, non un diagnostic',
  methodologyDisclaimerDesc: 'Specialty Match est un outil d\'auto-réflexion et d\'exploration de carrière. Ce n\'est pas une évaluation psychologique, un test de personnalité ou un instrument clinique. Les résultats sont indicatifs, non un verdict.',
  methodologyBack: 'Retour',
  methodologyOverview: 'Aperçu du projet',
  methodologyOverviewDesc: 'Specialty Match est un outil d’orientation professionnelle pour les étudiants en médecine. Il utilise un questionnaire de 81 items pour construire un profil de traits, puis le compare aux profils de spécialité du catalogue actuel. Sa finalité est la réflexion et l’exploration, et non la prédiction ou la prise d’une décision de carrière.',
  methodologyQuestionnaireStructure: 'Structure du questionnaire',
  methodologyQuestionnaireStructureDesc: 'Le questionnaire comporte 7 sections : Style de pensée (12 items), Style de travail (13 items), Compétences interpersonnelles (11 items), Motivations (12 items), Personnalité (13 items), Compétences spéciales (9 items), Valeurs et mode de vie (11 items). En mode étudiant, une spécialité préférée peut être choisie uniquement pour comparer son rang ; elle ne modifie jamais le score. Les participants sélectionnent aussi jusqu’à 4 valeurs professionnelles. Chaque item utilise une échelle de 1 à 10 allant de « Pas du tout moi » à « Tout à fait moi ».',
  methodologyTraitModelDetailed: 'Modèle de traits — Comment les réponses deviennent des traits',
  methodologyTraitModelDetailedDesc: 'Chaque évaluation est associée à un ou plusieurs traits latents par un mappage directionnel pondéré. La direction (+1 ou -1) détermine si une réponse élevée augmente ou diminue le trait ; les mappages actuels utilisent des poids de 0,8 à 1,5. Plusieurs contributions au même trait sont combinées par moyenne pondérée. Le catalogue contient 96 traits répartis en cinq dimensions : 92 proviennent des évaluations du questionnaire, 3 sont disponibles uniquement par la sélection de valeurs professionnelles, et l’orientation vers la prévention n’est actuellement pas mesurée.',
  methodologyScoringFormula: 'Formule de scoring',
  methodologyScoringFormulaDesc: 'Pour chaque trait présent à la fois dans les données du participant et dans le profil de la spécialité, similarité = 100 - |valeur_participant - valeur_cible|. L’indice vaut Σ(similarité × importance effective) / Σ(importance effective). L’importance effective combine le poids du profil, le poids neutre de la dimension et tout multiplicateur lié à une valeur sélectionnée. Le résultat 0–100 est un indice de similarité : 100 signifie un accord exact avec les cibles comparées ; ce n’est ni une probabilité, ni un percentile, ni un seuil validé.',
  methodologySubScoresDesc: 'Chaque spécialité est aussi décomposée en 5 indices par dimension : Style de pensée, Style de travail, Adéquation interpersonnelle, Technique/Pratique, et Mode de vie et valeurs. Chacun est la moyenne des similarités disponibles de la dimension, pondérée par leur importance effective. Une dimension sans donnée comparable est indiquée comme indisponible, et non comme nulle.',
  methodologyTradeOffsDesc: 'Pour chaque spécialité recommandée, l’algorithme signale jusqu’à 5 traits disponibles avec un écart d’au moins 20 points et une importance effective d’au moins 2, classés par écart × importance effective. Ce sont des pistes de réflexion, pas des obstacles à la réussite.',
  methodologyPriorityWeightsDesc: 'L’interface actuelle applique un poids neutre de 1,0× aux cinq dimensions. Les curseurs réglables par l’utilisateur ne sont pas activés dans cette version. Les valeurs professionnelles sélectionnées peuvent néanmoins augmenter l’importance effective des traits associés.',
  methodologyProfilesDetailed: 'Profils de spécialités — Comment les domaines sont définis',
  methodologyProfilesDetailedDesc: 'Chaque spécialité du catalogue actuel possède un profil partiel de traits, avec des cibles de 0 à 100 et des poids d’importance entiers de 1 à 3 (pertinent, important, très important). Les profils initiaux ont été assemblés à partir d’archétypes heuristiques tels que chirurgical, cognitif-clinique, longitudinal, orienté personnes, technique, diagnostique, laboratoire, pédiatrique et population. Ce sont des hypothèses de calibration versionnées, pas des normes cliniques validées.',
  methodologyCalibrationDetailed: 'Calibration — Apprendre des vrais spécialistes',
  methodologyCalibrationDetailedDesc: 'Les spécialistes en exercice soumettent les mêmes 81 évaluations, leurs valeurs professionnelles, leur spécialité réelle et cinq réponses complémentaires : leur perception actuelle de la spécialité ; ce qui a changé au fil des années ; la qualité requise la plus importante ; s’ils la choisiraient de nouveau (et pourquoi pas, le cas échéant) ; et la question qu’un étudiant devrait se poser avant de la choisir. Les évaluateurs autorisés peuvent utiliser ce jeu de données pour proposer des modifications de profils. La publication est délibérée et versionnée ; aucune réponse ne modifie automatiquement une cible.',
  methodologyValidationDetailed: 'Stratégie de validation',
  methodologyValidationDetailedDesc: 'Le tableau de bord suit le rang du domaine auto-identifié de chaque spécialiste et le rappel top-k sous une version nommée du moteur et du catalogue. Ce sont des diagnostics descriptifs du moteur actuel, susceptibles d’être faussés par des échantillons petits ou inégaux, une couverture incomplète des traits et la similarité des profils. Ils ne doivent pas, à eux seuls, valider ou modifier les poids. La fidélité test-retest, les cohortes indépendantes et la validation fondée sur les résultats ne sont pas encore établies.',
  methodologyDataPrivacy: 'Confidentialité des données',
  methodologyDataPrivacyDesc: 'Les réponses ne sont conservées que lorsqu’une personne les soumet explicitement pour la recherche. Le formulaire ne demande ni nom, ni e-mail, ni identifiant de compte. Les réponses étudiantes et les données de calibration sont conservées dans une base sécurisée pour l’analyse et l’amélioration de l’algorithme.',
  methodologyTechStack: 'Implémentation technique',
  methodologyTechStackDesc: 'Le moteur de scoring fonctionne entièrement dans le navigateur : calcul des traits, scoring de similarité, pondération de l’importance par les valeurs professionnelles et détection des compromis ont lieu côté client. Les soumissions de recherche sont stockées dans une base PostgreSQL Supabase protégée par des règles de sécurité au niveau des lignes. L’application est construite avec React, TypeScript et Tailwind CSS.',
  methodologyDimensions: 'Les cinq dimensions',
  methodologyDimensionsDesc: 'Les 96 traits du catalogue sont regroupés en 5 dimensions pour les sous-scores : Pensée en compte 18 ; Travail, 16 ; Interpersonnel, 18 ; Technique, 15 ; et Mode de vie et valeurs, 29. Une spécialité n’utilise qu’un sous-ensemble pertinent, et une dimension indisponible n’est pas notée zéro.',
  methodologyValuesStep: 'Valeurs professionnelles — Pondération des préférences',
  methodologyValuesStepDesc: 'Les participants sélectionnent jusqu’à 4 valeurs professionnelles parmi 14 options. Une valeur sélectionnée ne gonfle pas un trait déjà mesuré par le questionnaire ; elle augmente plutôt l’importance de son trait associé dans le calcul d’environ 1,21× à 1,50×. Si le trait associé ne possède aucun item dans le questionnaire, la sélection crée un signal fixe de 90/100 afin que ce choix ne se comporte pas comme une réponse neutre.',

  navExplorer: 'Explorateur',
  navMethodology: 'Méthodologie',
  navResults: 'Résultats',
  navHome: 'Accueil',
};

// ============================================================
// Translations map
// ============================================================

export const TRANSLATIONS: Record<Language, UIStrings> = { en, ro, fr };

// ============================================================
// Question translations (all 81 questions)
// ============================================================

export const QUESTION_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    T1: 'You pay particular attention to "why" questions.',
    T2: 'You pay close attention to details.',
    T3: 'You prefer solving complex problems.',
    T4: 'You are able to concentrate for prolonged periods.',
    T5: 'You rely more on experience than on theory.',
    T6: 'You are satisfied with knowing "a little about many things".',
    T7: 'You feel uncomfortable when faced with vaguely defined problems.',
    T8: 'You think logically.',
    T9: 'You are objective.',
    T10: 'You have an aptitude for mathematics.',
    T11: 'You are visually oriented.',
    T12: 'You look for alternative possibilities.',
    W1: 'You get bored easily with repetitive activities.',
    W2: 'You enjoy doing research.',
    W3: 'You prefer a well-planned schedule.',
    W4: 'You are comfortable performing the same activity repeatedly.',
    W5: 'You easily accept interruptions to your schedule.',
    W6: 'You are willing to work toward long-term results.',
    W7: 'You are more of a thinker than a "doer".',
    W8: 'You are thorough and deliberate.',
    W9: 'You are persistent.',
    W10: 'You are more of a "doer" than a talker.',
    W11: 'You approach problems through direct, concrete action.',
    W12: 'You adapt easily to change.',
    W13: 'You tend to initiate activities.',
    I1: 'You are comfortable with short-term relationships with patients.',
    I2: 'You are a good team player.',
    I3: 'You feel energized by interacting with people.',
    I4: 'You are interested in people.',
    I5: 'You have good listening skills and enjoy listening to others.',
    I6: 'You communicate well.',
    I7: 'You have leadership qualities.',
    I8: 'You enjoy organizing people.',
    I9: 'You enjoy developing long-term relationships with people.',
    I10: "You find it difficult to say no to other people's requests.",
    I11: 'You are warm and empathetic.',
    M1: 'You enjoy caring for people.',
    M2: 'You want to help people.',
    M3: 'You enjoy being an "expert" in your field.',
    M4: 'You feel a need to see the results of your efforts quickly.',
    M5: 'You want quick results.',
    M6: "You enjoy being involved in your patients' lives.",
    M7: 'You are achievement-oriented.',
    M8: 'You prefer treating curable conditions.',
    M9: 'You find satisfaction in achieving small improvements.',
    M10: 'You are interested in the basic sciences underlying medicine.',
    M11: 'You are studious.',
    M12: 'You seek the approval of others.',
    P1: 'You feel a need to be in control of a situation.',
    P2: 'You are relaxed.',
    P3: 'You are sociable.',
    P4: 'You act decisively.',
    P5: 'You are adventurous or enjoy challenges.',
    P6: 'You are comfortable with uncertainty.',
    P7: 'You are energetic.',
    P8: 'You are serious and driven rather than laid-back.',
    P9: 'You are optimistic.',
    P10: 'You can handle failure gracefully.',
    P11: 'You are self-confident.',
    P12: 'You are a perfectionist.',
    P13: 'You remain calm in a crisis.',
    S1: 'You have good manual dexterity.',
    S2: 'You have good observational skills.',
    S3: 'You are able to perform multiple activities simultaneously.',
    S4: 'You can coordinate different tasks.',
    S5: 'You enjoy coordinating the care of patients and their families.',
    S6: 'You are a good coordinator.',
    S7: 'You enjoy gadgets and technology.',
    S8: 'You have mechanical aptitude.',
    S9: 'You enjoy teaching.',
    V1: 'You value having free time.',
    V2: 'You value independence.',
    V3: 'You have interests outside medicine.',
    V4: 'You want to deal with all aspects of medicine.',
    V5: 'You are willing to work long hours.',
    V6: 'You value organization.',
    V7: 'You want a good income.',
    V8: 'You identify with professional role models.',
    V9: 'You are comfortable with your own mortality.',
    V10: 'You are tolerant of others.',
    V11: 'You value harmony.',
  },

  ro: {
    T1: 'Acordă o atenție deosebită întrebărilor de tip „de ce".',
    T2: 'Acordă o atenție mare detaliilor.',
    T3: 'Preferi rezolvarea problemelor complexe.',
    T4: 'Ești capabil să te concentrezi perioade lungi de timp.',
    T5: 'Te bazezi mai mult pe experiență decât pe teorie.',
    T6: 'Ești mulțumit să știi „puțin despre multe lucruri".',
    T7: 'Te simți inconfortabil când te confrunți cu probleme vag definite.',
    T8: 'Gândești logic.',
    T9: 'Ești obiectiv.',
    T10: 'Ai aptitudini pentru matematică.',
    T11: 'Ești orientat vizual.',
    T12: 'Cauți posibilități alternative.',
    W1: 'Te plictisești ușor cu activitățile repetitive.',
    W2: 'Îți place să faci cercetare.',
    W3: 'Preferi un program bine planificat.',
    W4: 'Ești confortabil să repeți aceeași activitate.',
    W5: 'Acceptă ușor întreruperile programului tău.',
    W6: 'Ești dispus să muncești pentru rezultate pe termen lung.',
    W7: 'Ești mai degrabă un gânditor decât un „om de acțiune".',
    W8: 'Ești minuțios și deliberat.',
    W9: 'Ești perseverent.',
    W10: 'Ești mai degrabă un „om de acțiune" decât un vorbitor.',
    W11: 'Abordezi problemele prin acțiune directă și concretă.',
    W12: 'Te adaptezi ușor la schimbare.',
    W13: 'Tinde să inițiezi activități.',
    I1: 'Ești confortabil cu relații pe termen scurt cu pacienții.',
    I2: 'Ești un bun jucător de echipă.',
    I3: 'Te simți energizat interacționând cu oamenii.',
    I4: 'Ești interesat de oameni.',
    I5: 'Ai abilități bune de ascultare și îți place să asculți pe alții.',
    I6: 'Comunici bine.',
    I7: 'Ai calități de lider.',
    I8: 'Îți place să organizezi oameni.',
    I9: 'Îți place să dezvolți relații pe termen lung cu oamenii.',
    I10: 'Îți este greu să spui nu cererilor altora.',
    I11: 'Ești cald și empatic.',
    M1: 'Îți place să ai grijă de oameni.',
    M2: 'Vrei să ajuți oamenii.',
    M3: 'Îți place să fii un „expert" în domeniul tău.',
    M4: 'Simți nevoia să vezi rezultatele eforturilor tale rapid.',
    M5: 'Vrei rezultate rapide.',
    M6: 'Îți place să fii implicat în viața pacienților tăi.',
    M7: 'Ești orientat spre performanță.',
    M8: 'Preferi tratabilitatea afecțiunilor vindecabile.',
    M9: 'Găsești satisfacție în obținerea unor mici îmbunătățiri.',
    M10: 'Ești interesat de științele de bază care stau la baza medicinei.',
    M11: 'Ești studios.',
    M12: 'Cauți aprobarea celorlalți.',
    P1: 'Simți nevoia să controlezi o situație.',
    P2: 'Ești relaxat.',
    P3: 'Ești sociabil.',
    P4: 'Acționezi decisiv.',
    P5: 'Ești aventuros sau îți plac provocările.',
    P6: 'Ești confortabil cu incertitudinea.',
    P7: 'Ești energic.',
    P8: 'Ești serios și motivat, mai degrabă decât relaxat.',
    P9: 'Ești optimist.',
    P10: 'Poți gestiona eșecul cu grație.',
    P11: 'Ești încrezător în tine.',
    P12: 'Ești perfectionist.',
    P13: 'Rămâi calm într-o criză.',
    S1: 'Ai o dexteritate manuală bună.',
    S2: 'Ai abilități bune de observare.',
    S3: 'Ești capabil să desfășori mai multe activități simultan.',
    S4: 'Poți coordona sarcini diferite.',
    S5: 'Îți place să coordonezi îngrijirea pacienților și a familiilor lor.',
    S6: 'Ești un bun coordonator.',
    S7: 'Îți plac gadgeturile și tehnologia.',
    S8: 'Ai aptitudini mecanice.',
    S9: 'Îți place să predați.',
    V1: 'Prețuiești timpul liber.',
    V2: 'Prețuiești independența.',
    V3: 'Ai interese în afara medicinei.',
    V4: 'Vrei să te ocupi de toate aspectele medicinei.',
    V5: 'Ești dispus să muncești ore lungi.',
    V6: 'Prețuiești organizarea.',
    V7: 'Vrei un venit bun.',
    V8: 'Te identifici cu modele profesionale.',
    V9: 'Ești confortabil cu propria mortalitate.',
    V10: 'Ești tolerant cu ceilalți.',
    V11: 'Prețuiești armonia.',
  },

  fr: {
    T1: 'Vous accordez une attention particulière aux questions « pourquoi ».',
    T2: 'Vous prêtez une grande attention aux détails.',
    T3: 'Vous préférez résoudre des problèmes complexes.',
    T4: 'Vous êtes capable de vous concentrer pendant de longues périodes.',
    T5: 'Vous vous fiez davantage à l\'expérience qu\'à la théorie.',
    T6: 'Vous êtes satisfait de savoir « un peu sur beaucoup de choses ».',
    T7: 'Vous vous sentez mal à l\'aise face à des problèmes vaguement définis.',
    T8: 'Vous pensez logiquement.',
    T9: 'Vous êtes objectif.',
    T10: 'Vous avez des aptitudes en mathématiques.',
    T11: 'Vous êtes orienté visuellement.',
    T12: 'Vous cherchez des possibilités alternatives.',
    W1: 'Vous vous ennuyez facilement avec les activités répétitives.',
    W2: 'Vous aimez faire de la recherche.',
    W3: 'Vous préférez un emploi du temps bien planifié.',
    W4: 'Vous êtes à l\'aise en répétant la même activité.',
    W5: 'Vous acceptez facilement les interruptions de votre emploi du temps.',
    W6: 'Vous êtes prêt à travailler pour des résultats à long terme.',
    W7: 'Vous êtes davantage un penseur qu\'un « homme d\'action ».',
    W8: 'Vous êtes minutieux et réfléchi.',
    W9: 'Vous êtes persévérant.',
    W10: 'Vous êtes davantage un « homme d\'action » qu\'un bavard.',
    W11: 'Vous abordez les problèmes par une action directe et concrète.',
    W12: 'Vous vous adaptez facilement au changement.',
    W13: 'Vous avez tendance à initier des activités.',
    I1: 'Vous êtes à l\'aise avec des relations à court terme avec les patients.',
    I2: 'Vous êtes un bon joueur d\'équipe.',
    I3: 'Vous vous sentez énergisé en interagissant avec les gens.',
    I4: 'Vous êtes intéressé par les gens.',
    I5: 'Vous avez de bonnes compétences d\'écoute et aimez écouter les autres.',
    I6: 'Vous communiquez bien.',
    I7: 'Vous avez des qualités de leader.',
    I8: 'Vous aimez organiser les gens.',
    I9: 'Vous aimez développer des relations à long terme avec les gens.',
    I10: 'Vous avez du mal à dire non aux demandes des autres.',
    I11: 'Vous êtes chaleureux et empathique.',
    M1: 'Vous aimez prendre soin des gens.',
    M2: 'Vous voulez aider les gens.',
    M3: 'Vous aimez être un « expert » dans votre domaine.',
    M4: 'Vous ressentez le besoin de voir les résultats de vos efforts rapidement.',
    M5: 'Vous voulez des résultats rapides.',
    M6: 'Vous aimez être impliqué dans la vie de vos patients.',
    M7: 'Vous êtes orienté vers la performance.',
    M8: 'Vous préférez traiter des affections curables.',
    M9: 'Vous trouvez de la satisfaction dans de petites améliorations.',
    M10: 'Vous êtes intéressé par les sciences fondamentales sous-jacentes à la médecine.',
    M11: 'Vous êtes studieux.',
    M12: 'Vous recherchez l\'approbation des autres.',
    P1: 'Vous ressentez le besoin de contrôler une situation.',
    P2: 'Vous êtes détendu.',
    P3: 'Vous êtes sociable.',
    P4: 'Vous agissez avec décision.',
    P5: 'Vous êtes aventureux ou aimez les défis.',
    P6: 'Vous êtes à l\'aise avec l\'incertitude.',
    P7: 'Vous êtes énergique.',
    P8: 'Vous êtes sérieux et déterminé plutôt que détendu.',
    P9: 'Vous êtes optimiste.',
    P10: 'Vous savez gérer l\'échec avec élégance.',
    P11: 'Vous êtes sûr de vous.',
    P12: 'Vous êtes perfectionniste.',
    P13: 'Vous restez calme dans une crise.',
    S1: 'Vous avez une bonne dextérité manuelle.',
    S2: 'Vous avez de bonnes capacités d\'observation.',
    S3: 'Vous êtes capable d\'effectuer plusieurs activités simultanément.',
    S4: 'Vous pouvez coordonner différentes tâches.',
    S5: 'Vous aimez coordonner les soins des patients et de leurs familles.',
    S6: 'Vous êtes un bon coordinateur.',
    S7: 'Vous aimez les gadgets et la technologie.',
    S8: 'Vous avez des aptitudes mécaniques.',
    S9: 'Vous aimez enseigner.',
    V1: 'Vous valorisez le temps libre.',
    V2: 'Vous valorisez l\'indépendance.',
    V3: 'Vous avez des centres d\'intérêt en dehors de la médecine.',
    V4: 'Vous voulez traiter tous les aspects de la médecine.',
    V5: 'Vous êtes prêt à travailler de longues heures.',
    V6: 'Vous valorisez l\'organisation.',
    V7: 'Vous voulez un bon revenu.',
    V8: 'Vous vous identifiez à des modèles professionnels.',
    V9: 'Vous êtes à l\'aise avec votre propre mortalité.',
    V10: 'Vous êtes tolérant envers les autres.',
    V11: 'Vous valorisez l\'harmonie.',
  },
};

// ============================================================
// Section title translations
// ============================================================

export const SECTION_TRANSLATIONS: Record<Language, Record<string, { title: string; subtitle: string }>> = {
  en: {
    thinking: { title: 'Thinking Style', subtitle: 'How your mind approaches problems and information.' },
    working: { title: 'Working Style', subtitle: 'How you approach tasks, planning, and follow-through.' },
    interpersonal: { title: 'Interpersonal Skills', subtitle: 'How you relate to, communicate with, and lead people.' },
    motivations: { title: 'Motivations', subtitle: 'What drives you in medicine and patient care.' },
    personality: { title: 'Personality', subtitle: 'Your temperament under pressure and in everyday life.' },
    skills: { title: 'Special Skills and Interests', subtitle: 'Your aptitudes and hands-on or technical interests.' },
    values: { title: 'Values and Lifestyle', subtitle: 'What matters to you outside and around the work itself.' },
  },
  ro: {
    thinking: { title: 'Stil de gândire', subtitle: 'Cum abordează mintea ta problemele și informațiile.' },
    working: { title: 'Stil de lucru', subtitle: 'Cum abordezi sarcinile, planificarea și finalizarea.' },
    interpersonal: { title: 'Abilități interpersonale', subtitle: 'Cum te raportezi, comunici și conduci oamenii.' },
    motivations: { title: 'Motivații', subtitle: 'Ce te motivează în medicină și îngrijirea pacienților.' },
    personality: { title: 'Personalitate', subtitle: 'Temperamentul tău sub presiune și în viața de zi cu zi.' },
    skills: { title: 'Abilități și interese speciale', subtitle: 'Aptitudinile și interesele tale practice sau tehnice.' },
    values: { title: 'Valori și stil de viață', subtitle: 'Ce contează pentru tine dincolo de muncă.' },
  },
  fr: {
    thinking: { title: 'Style de pensée', subtitle: 'Comment votre esprit aborde les problèmes et l\'information.' },
    working: { title: 'Style de travail', subtitle: 'Comment vous abordez les tâches, la planification et le suivi.' },
    interpersonal: { title: 'Compétences interpersonnelles', subtitle: 'Comment vous interagissez, communiquez et dirigez.' },
    motivations: { title: 'Motivations', subtitle: 'Ce qui vous motive en médecine et dans les soins.' },
    personality: { title: 'Personnalité', subtitle: 'Votre tempérament sous pression et au quotidien.' },
    skills: { title: 'Compétences et intérêts spéciaux', subtitle: 'Vos aptitudes et intérêts manuels ou techniques.' },
    values: { title: 'Valeurs et mode de vie', subtitle: 'Ce qui compte pour vous au-delà du travail.' },
  },
};

// ============================================================
// Value option translations
// ============================================================

export const VALUE_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'Sufficient free time': 'Sufficient free time',
    'Personal achievement': 'Personal achievement',
    'Prestige': 'Prestige',
    'Decision-making': 'Decision-making',
    'Independence': 'Independence',
    'Intellectual activity': 'Intellectual activity',
    'Manual/hands-on activity': 'Manual / hands-on activity',
    'Working with people': 'Working with people',
    'Job security': 'Job security',
    'Variety in your work': 'Variety in your work',
    'Satisfactory income': 'Satisfactory income',
    'Creativity': 'Creativity',
    'Feedback from others': 'Feedback from others',
    'Caring for people': 'Caring for people',
  },
  ro: {
    'Sufficient free time': 'Timp liber suficient',
    'Personal achievement': 'Realizare personală',
    'Prestige': 'Prestigiu',
    'Decision-making': 'Luarea deciziilor',
    'Independence': 'Independență',
    'Intellectual activity': 'Activitate intelectuală',
    'Manual/hands-on activity': 'Activitate manuală / practică',
    'Working with people': 'Lucrul cu oamenii',
    'Job security': 'Securitatea locului de muncă',
    'Variety in your work': 'Varitate în muncă',
    'Satisfactory income': 'Venit satisfăcător',
    'Creativity': 'Creativitate',
    'Feedback from others': 'Feedback de la alții',
    'Caring for people': 'Îngrijirea oamenilor',
  },
  fr: {
    'Sufficient free time': 'Temps libre suffisant',
    'Personal achievement': 'Accomplissement personnel',
    'Prestige': 'Prestige',
    'Decision-making': 'Prise de décision',
    'Independence': 'Indépendance',
    'Intellectual activity': 'Activité intellectuelle',
    'Manual/hands-on activity': 'Activité manuelle / pratique',
    'Working with people': 'Travailler avec les gens',
    'Job security': 'Sécurité de l\'emploi',
    'Variety in your work': 'Variété dans votre travail',
    'Satisfactory income': 'Revenu satisfaisant',
    'Creativity': 'Créativité',
    'Feedback from others': 'Retour des autres',
    'Caring for people': 'Prendre soin des gens',
  },
};

// ============================================================
// Specialty name translations
// ============================================================

export const SPECIALTY_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {},
  ro: {
    'Allergy and Clinical Immunology': 'Alergologie și Imunologie Clinică',
    'Anesthesiology and Intensive Care': 'Anestezie și Terapie Intensivă',
    'Infectious Diseases': 'Boli Infecțioase',
    'Cardiology': 'Cardiologie',
    'Pediatric Cardiology': 'Cardiologie Pediatrică',
    'Dermatology and Venereology': 'Dermatologie și Venerologie',
    'Diabetes, Nutrition and Metabolic Diseases': 'Diabet, Nutriție și Boli Metabolice',
    'Endocrinology': 'Endocrinologie',
    'Medical Assessment of Work Capacity / Occupational Disability Assessment': 'Evaluarea Capacității de Muncă / Evaluarea Inaptitudinii Profesionale',
    'Clinical Pharmacology': 'Farmacologie Clinică',
    'Gastroenterology': 'Gastroenterologie',
    'Pediatric Gastroenterology': 'Gastroenterologie Pediatrică',
    'Medical Genetics': 'Genetică Medicală',
    'Geriatrics and Gerontology': 'Geriatrie și Gerontologie',
    'Hematology': 'Hematologie',
    'Family Medicine': 'Medicină de Familie',
    'Emergency Medicine': 'Medicină de Urgență',
    'Internal Medicine': 'Medicină Internă',
    'Physical Medicine and Rehabilitation': 'Medicină Fizică și Reabilitare',
    'Occupational Medicine': 'Medicina Muncii',
    'Sports Medicine': 'Medicină Sportivă',
    'Nephrology': 'Nefrologie',
    'Pediatric Nephrology': 'Nefrologie Pediatrică',
    'Neonatology': 'Neonatologie',
    'Neurology': 'Neurologie',
    'Pediatric Neurology': 'Neurologie Pediatrică',
    'Medical Oncology': 'Oncologie Medicală',
    'Pediatric Oncology and Hematology': 'Oncologie și Hematologie Pediatrică',
    'Pediatrics': 'Pediatrie',
    'Pulmonology': 'Pneumologie',
    'Pediatric Pulmonology': 'Pneumologie Pediatrică',
    'Psychiatry': 'Psihiatrie',
    'Child and Adolescent Psychiatry': 'Psihiatrie a Copilului și Adolescentului',
    'Radiation Oncology': 'Oncologie prin Radioterapie',
    'Rheumatology': 'Reumatologie',
    'Cardiovascular Surgery': 'Chirurgie Cardiovasculară',
    'General Surgery': 'Chirurgie Generală',
    'Oral and Maxillofacial Surgery': 'Chirurgie Orală și Maxilofacială',
    'Pediatric Surgery': 'Chirurgie Pediatrică',
    'Plastic, Aesthetic and Reconstructive Microsurgery': 'Microchirurgie Plastică, Estetică și Reconstructivă',
    'Thoracic Surgery': 'Chirurgie Toracică',
    'Vascular Surgery': 'Chirurgie Vasculară',
    'Neurosurgery': 'Neurochirurgie',
    'Obstetrics and Gynecology': 'Obstetrică și Ginecologie',
    'Ophthalmology': 'Oftalmologie',
    'Pediatric Orthopedics': 'Ortopedie Pediatrică',
    'Orthopedics and Traumatology': 'Ortopedie și Traumatologie',
    'Otorhinolaryngology (ENT)': 'Otorinolaringologie (ORL)',
    'Urology': 'Urologie',
    'Pathology': 'Anatomie Patologică',
    'Epidemiology': 'Epidemiologie',
    'Hygiene': 'Igienă',
    'Laboratory Medicine': 'Medicină de Laborator',
    'Forensic Medicine': 'Medicină Legală',
    'Nuclear Medicine': 'Medicină Nucleară',
    'Medical Microbiology': 'Microbiologie Medicală',
    'Radiology and Medical Imaging': 'Radiologie și Imagistică Medicală',
    'Public Health and Healthcare Management': 'Sănătate Publică și Managementul Asistenței Medicale',
  },
  fr: {
    'Allergy and Clinical Immunology': 'Allergologie et Immunologie Clinique',
    'Anesthesiology and Intensive Care': 'Anesthésiologie et Soins Intensifs',
    'Infectious Diseases': 'Maladies Infectieuses',
    'Cardiology': 'Cardiologie',
    'Pediatric Cardiology': 'Cardiologie Pédiatrique',
    'Dermatology and Venereology': 'Dermatologie et Vénéréologie',
    'Diabetes, Nutrition and Metabolic Diseases': 'Diabète, Nutrition et Maladies Métaboliques',
    'Endocrinology': 'Endocrinologie',
    'Medical Assessment of Work Capacity / Occupational Disability Assessment': 'Évaluation de la Capacité de Travail / Évaluation de l\'Inaptitude Professionnelle',
    'Clinical Pharmacology': 'Pharmacologie Clinique',
    'Gastroenterology': 'Gastroentérologie',
    'Pediatric Gastroenterology': 'Gastroentérologie Pédiatrique',
    'Medical Genetics': 'Génétique Médicale',
    'Geriatrics and Gerontology': 'Gériatrie et Gérontologie',
    'Hematology': 'Hématologie',
    'Family Medicine': 'Médecine Familiale',
    'Emergency Medicine': 'Médecine d\'Urgence',
    'Internal Medicine': 'Médecine Interne',
    'Physical Medicine and Rehabilitation': 'Médecine Physique et Réadaptation',
    'Occupational Medicine': 'Médecine du Travail',
    'Sports Medicine': 'Médecine du Sport',
    'Nephrology': 'Néphrologie',
    'Pediatric Nephrology': 'Néphrologie Pédiatrique',
    'Neonatology': 'Néonatologie',
    'Neurology': 'Neurologie',
    'Pediatric Neurology': 'Neurologie Pédiatrique',
    'Medical Oncology': 'Oncologie Médicale',
    'Pediatric Oncology and Hematology': 'Oncologie et Hématologie Pédiatriques',
    'Pediatrics': 'Pédiatrie',
    'Pulmonology': 'Pneumologie',
    'Pediatric Pulmonology': 'Pneumologie Pédiatrique',
    'Psychiatry': 'Psychiatrie',
    'Child and Adolescent Psychiatry': 'Psychiatrie de l\'Enfant et de l\'Adolescent',
    'Radiation Oncology': 'Radiothérapie Oncologique',
    'Rheumatology': 'Rhumatologie',
    'Cardiovascular Surgery': 'Chirurgie Cardiovasculaire',
    'General Surgery': 'Chirurgie Générale',
    'Oral and Maxillofacial Surgery': 'Chirurgie Orale et Maxillo-Faciale',
    'Pediatric Surgery': 'Chirurgie Pédiatrique',
    'Plastic, Aesthetic and Reconstructive Microsurgery': 'Microchirurgie Plastique, Esthétique et Reconstructrice',
    'Thoracic Surgery': 'Chirurgie Thoracique',
    'Vascular Surgery': 'Chirurgie Vasculaire',
    'Neurosurgery': 'Neurochirurgie',
    'Obstetrics and Gynecology': 'Obstétrique et Gynécologie',
    'Ophthalmology': 'Ophtalmologie',
    'Pediatric Orthopedics': 'Orthopédie Pédiatrique',
    'Orthopedics and Traumatology': 'Orthopédie et Traumatologie',
    'Otorhinolaryngology (ENT)': 'Oto-Rhino-Laryngologie (ORL)',
    'Urology': 'Urologie',
    'Pathology': 'Anatomie Pathologique',
    'Epidemiology': 'Épidémiologie',
    'Hygiene': 'Hygiène',
    'Laboratory Medicine': 'Médecine de Laboratoire',
    'Forensic Medicine': 'Médecine Légale',
    'Nuclear Medicine': 'Médecine Nucléaire',
    'Medical Microbiology': 'Microbiologie Médicale',
    'Radiology and Medical Imaging': 'Radiologie et Imagerie Médicale',
    'Public Health and Healthcare Management': 'Santé Publique et Gestion des Soins de Santé',
  },
};

// ============================================================
// Specialty blurb translations
// ============================================================

export const BLURB_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {},
  ro: {
    'Allergy and Clinical Immunology': 'Diagnosticul și managementul tulburărilor imune — analitic, metodic și echilibrat în stil de viață.',
    'Anesthesiology and Intensive Care': 'Fiziologie perioperatorie și terapie intensivă — decisiv, calm și practic în criză.',
    'Infectious Diseases': 'Diagnosticul și tratamentul infecțiilor — analitic, variat și bogat intelectual.',
    'Cardiology': 'Inima și circulația — analitic și orientat spre tehnologie, cu dimensiuni acute și cronice.',
    'Pediatric Cardiology': 'Îngrijirea cardiacă a copiilor — meticuloasă, compătimitoare și în echipă.',
    'Dermatology and Venereology': 'Tulburări ale pielii — vizual, orientat spre detalii și unul dintre cele mai echilibrate domenii.',
    'Diabetes, Nutrition and Metabolic Diseases': 'Îngrijire metabolică cronică — relațională, educativă și longitudinală.',
    'Endocrinology': 'Tulburări hormonale și glandulare — analitic, intelectual și metodic.',
    'Medical Assessment of Work Capacity / Occupational Disability Assessment': 'Evaluarea capacității și aptitudinii — structurată, autonomă și echilibrată.',
    'Clinical Pharmacology': 'Știința terapeuticilor și a acțiunii medicamentelor — condusă de cercetare și intelectuală.',
    'Gastroenterology': 'Sistem digestiv și ficat — cognitiv plus endoscopic, cu varietate largă.',
    'Pediatric Gastroenterology': 'Îngrijire digestivă și hepatică pentru copii — compătimitoare, detaliată și longitudinală.',
    'Medical Genetics': 'Boli ereditare și congenitale — profund intelectuală, precisă și orientată spre consiliere.',
    'Geriatrics and Gerontology': 'Îngrijirea adulților în vârstă — holistică, relațională și coordonată în echipă.',
    'Hematology': 'Tulburări ale sângelui și măduvei — analitic, cu laborator și clinicitate.',
    'Family Medicine': 'Îngrijire primară longitudinală cuprinzătoare — relațională, largă și ancorată.',
    'Emergency Medicine': 'Îngrijire acută nediferențiată — rapidă, adaptivă și calmă în haos.',
    'Internal Medicine': 'Diagnostic adult și îngrijire longitudinală — nucleul generalist cerebral și larg.',
    'Physical Medicine and Rehabilitation': 'Restabilirea funcției după accidentare sau boală — răbdătoare, în echipă și longitudinală.',
    'Occupational Medicine': 'Sănătate și siguranță la locul de muncă — structurată, autonomă și echilibrată.',
    'Sports Medicine': 'Îngrijire musculoscheletală pentru sportivi — activă, orientată spre echipă și oameni.',
    'Nephrology': 'Îngrijirea rinichilor și dializei — analitică, longitudinală și în echipă.',
    'Pediatric Nephrology': 'Îngrijirea rinichilor la copii — meticuloasă, compătimitoare și longitudinală.',
    'Neonatology': 'Îngrijirea nou-născuților și a prematurilor — intensă, precisă și profund colaborativă.',
    'Neurology': 'Tulburări ale sistemului nervos — extrem de analitic, orientat spre detalii și intelectual.',
    'Pediatric Neurology': 'Îngrijire neurologică a copiilor — meticuloasă, compătimitoare și longitudinală.',
    'Medical Oncology': 'Îngrijire sistemică a cancerului — emoționant de exigentă, intelectuală și în echipă.',
    'Pediatric Oncology and Hematology': 'Îngrijirea cancerului și a sângelui la copii — compătimitoare, riguroasă și profund colaborativă.',
    'Pediatrics': 'Îngrijirea generală a copiilor — caldă, relațională și largă.',
    'Pulmonology': 'Boli pulmonare și ale căilor respiratorii — cognitiv cu varietate procedurală.',
    'Pediatric Pulmonology': 'Îngrijire respiratorie pentru copii — compătimitoare, detaliată și longitudinală.',
    'Psychiatry': 'Sănătate mintală și comportament — reflexiv, relațional și profund intelectual.',
    'Child and Adolescent Psychiatry': 'Îngrijire de sănătate mintală pentru tineri — empatic, developmental și orientat spre echipă.',
    'Radiation Oncology': 'Tratamentul cancerului prin radioterapie de precizie — bogat în tehnologie, exigent și colaborativ.',
    'Rheumatology': 'Boli autoimune și articulare — intelectual, longitudinal și metodic.',
    'Cardiovascular Surgery': 'Chirurgie de mare risc pe inimă și vase mari — decisiv, precis și intens.',
    'General Surgery': 'Practică chirurgicală largă, abdomen și traumatism — variată, orientată spre acțiune și în echipă.',
    'Oral and Maxillofacial Surgery': 'Chirurgia feței, maxilarelor și gurii — meșteșug operator cu precizie structurală.',
    'Pediatric Surgery': 'Chirurgie pentru sugari și copii — meticuloasă, compătimitoare și colaborativă.',
    'Plastic, Aesthetic and Reconstructive Microsurgery': 'Restabilirea formei și funcției prin tehnică fină — creativă, detaliată și autonomă.',
    'Thoracic Surgery': 'Chirurgia toracelui, plămânilor și mediastinului — calmă sub presiune și tehnic exigentă.',
    'Vascular Surgery': 'Chirurgie operatorie și endovasculară a vaselor de sânge — variată, practică și decisivă.',
    'Neurosurgery': 'Chirurgia creierului și a coloanei — culmea preciziei, calmului și rigoarei intelectuale.',
    'Obstetrics and Gynecology': 'Îngrijirea femeilor în sarcină, fertilitate și chirurgie — relațională, procedurală și variată.',
    'Ophthalmology': 'Îngrijire microchirurgicală a ochiului — precisă, bogată în tehnologie și adesea independentă.',
    'Pediatric Orthopedics': 'Îngrijire musculoscheletală pentru copii în creștere — practică, blândă și colaborativă.',
    'Orthopedics and Traumatology': 'Oase, articulații și traumatism — fizic, practic și orientat spre rezultate.',
    'Otorhinolaryngology (ENT)': 'Îngrijire chirurgicală și medicală a urechii, nasului și gâtului — variată și orientată spre oameni.',
    'Urology': 'Îngrijire chirurgicală și medicală a tractului urinar — procedurală, orientată spre tehnologie și echilibrată.',
    'Pathology': 'Diagnostic prin țesut și celule — autonom, precis și liniștit intelectual.',
    'Epidemiology': 'Tipare de boală în populații — condus de date, analitic și independent.',
    'Hygiene': 'Prevenție și standarde de sănătate publică — structurată, autonomă și echilibrată.',
    'Laboratory Medicine': 'Testare diagnostică și știință de laborator — precisă, tehnologică și echilibrată.',
    'Forensic Medicine': 'Investigație medico-legală — exigentă, calmă și independentă.',
    'Nuclear Medicine': 'Imagistică și terapie radionuclidică țintită — bogată în tehnologie și analitică.',
    'Medical Microbiology': 'Identificarea microbilor și a infecției — riguroasă, independentă și de laborator.',
    'Radiology and Medical Imaging': 'Diagnostic prin imagistică — orientat spre tehnologie, autonom și echilibrat.',
    'Public Health and Healthcare Management': 'Sănătate populațională și conducere de sistem — strategic, orientat spre oameni și larg.',
  },
  fr: {
    'Allergy and Clinical Immunology': 'Diagnostic et prise en charge des troubles immunitaires — analytique, méthodique et équilibré.',
    'Anesthesiology and Intensive Care': 'Physiologie périopératoire et soins intensifs — décisif, calme et pratique en crise.',
    'Infectious Diseases': 'Diagnostic et traitement des infections — analytique, varié et intellectuellement riche.',
    'Cardiology': 'Cœur et circulation — analytique et technologique, avec des dimensions aiguës et chroniques.',
    'Pediatric Cardiology': 'Soins cardiaques pour enfants — minutieux, compatissants et en équipe.',
    'Dermatology and Venereology': 'Affections cutanées — visuel, orienté détails et l\'un des domaines les plus équilibrés.',
    'Diabetes, Nutrition and Metabolic Diseases': 'Soins métaboliques chroniques — relationnel, éducatif et longitudinal.',
    'Endocrinology': 'Troubles hormonaux et glandulaires — analytique, intellectuel et méthodique.',
    'Medical Assessment of Work Capacity / Occupational Disability Assessment': 'Évaluation de la capacité et de l\'aptitude — structurée, autonome et équilibrée.',
    'Clinical Pharmacology': 'Science des thérapeutiques et de l\'action des médicaments — recherche et intellectuelle.',
    'Gastroenterology': 'Système digestif et foie — cognitif plus endoscopique, avec une grande variété.',
    'Pediatric Gastroenterology': 'Soins digestifs et hépatiques pour enfants — compatissants, détaillés et longitudinaux.',
    'Medical Genetics': 'Maladies héréditaires et congénitales — profondément intellectuelle, précise et orientée conseil.',
    'Geriatrics and Gerontology': 'Soins aux personnes âgées — holistique, relationnel et coordonné en équipe.',
    'Hematology': 'Troubles du sang et de la moelle — analytique, avec laboratoire et clinique.',
    'Family Medicine': 'Soins primaires longitudinaux complets — relationnel, large et ancré.',
    'Emergency Medicine': 'Soins aigus non différenciés — rapide, adaptatif et calme dans le chaos.',
    'Internal Medicine': 'Diagnostic adulte et soins longitudinaux — le cœur généraliste cérébral et large.',
    'Physical Medicine and Rehabilitation': 'Restauration de la fonction après lésion ou maladie — patient, en équipe et longitudinal.',
    'Occupational Medicine': 'Santé et sécurité au travail — structuré, autonome et équilibré.',
    'Sports Medicine': 'Soins musculosquelettiques pour les athlètes — actif, en équipe et tourné vers les gens.',
    'Nephrology': 'Soins rénaux et dialyse — analytique, longitudinal et en équipe.',
    'Pediatric Nephrology': 'Soins rénaux pour enfants — minutieux, compatissants et longitudinaux.',
    'Neonatology': 'Soins aux nouveau-nés et prématurés — intense, précis et profondément collaboratif.',
    'Neurology': 'Troubles du système nerveux — hautement analytique, orienté détails et intellectuel.',
    'Pediatric Neurology': 'Soins neurologiques pour enfants — minutieux, compatissants et longitudinaux.',
    'Medical Oncology': 'Soins systémiques du cancer — émotionnellement exigeant, intellectuel et en équipe.',
    'Pediatric Oncology and Hematology': 'Soins du cancer et du sang chez les enfants — compatissants, rigoureux et profondément collaboratifs.',
    'Pediatrics': 'Soins généraux aux enfants — chaleureux, relationnel et large.',
    'Pulmonology': 'Maladies pulmonaires et des voies respiratoires — cognitif avec variété procédurale.',
    'Pediatric Pulmonology': 'Soins respiratoires pour enfants — compatissants, détaillés et longitudinaux.',
    'Psychiatry': 'Santé mentale et comportement — réflexif, relationnel et intellectuellement profond.',
    'Child and Adolescent Psychiatry': 'Soins de santé mentale pour les jeunes — empathique, développemental et en équipe.',
    'Radiation Oncology': 'Traitement du cancer par radiothérapie de précision — riche en technologie, exigeant et collaboratif.',
    'Rheumatology': 'Maladies auto-immunes et articulaires — intellectuel, longitudinal et méthodique.',
    'Cardiovascular Surgery': 'Chirurgie à haut risque du cœur et des gros vaisseaux — décisif, précis et intense.',
    'General Surgery': 'Pratique chirurgicale large, abdomen et traumatisme — variée, orientée action et en équipe.',
    'Oral and Maxillofacial Surgery': 'Chirurgie du visage, des mâchoires et de la bouche — artisanat opératoire avec précision structurelle.',
    'Pediatric Surgery': 'Chirurgie des nourrissons et des enfants — minutieuse, compatissante et collaborative.',
    'Plastic, Aesthetic and Reconstructive Microsurgery': 'Restauration de la forme et de la fonction par technique fine — créative, détaillée et autonome.',
    'Thoracic Surgery': 'Chirurgie du thorax, des poumons et du médiastin — calme sous pression et techniquement exigeante.',
    'Vascular Surgery': 'Chirurgie opératoire et endovasculaire des vaisseaux — variée, pratique et décisive.',
    'Neurosurgery': 'Chirurgie du cerveau et de la colonne — le sommet de la précision, du calme et de la rigueur intellectuelle.',
    'Obstetrics and Gynecology': 'Soins aux femmes pendant la grossesse, la fertilité et la chirurgie — relationnel, procédural et varié.',
    'Ophthalmology': 'Soins microchirurgicaux de l\'œil — précis, riche en technologie et souvent indépendant.',
    'Pediatric Orthopedics': 'Soins musculosquelettiques pour enfants en croissance — pratique, doux et collaboratif.',
    'Orthopedics and Traumatology': 'Os, articulations et traumatisme — physique, pratique et orienté résultats.',
    'Otorhinolaryngology (ENT)': 'Soins chirurgicaux et médicaux de l\'oreille, du nez et de la gorge — variés et orientés vers les gens.',
    'Urology': 'Soins chirurgicaux et médicaux du tractus urinaire — procédural, technologique et équilibré.',
    'Pathology': 'Diagnostic par tissus et cellules — autonome, précis et discrètement intellectuel.',
    'Epidemiology': 'Schémas de maladie dans les populations — axé sur les données, analytique et indépendant.',
    'Hygiene': 'Prévention et normes de santé publique — structuré, autonome et équilibré.',
    'Laboratory Medicine': 'Tests diagnostiques et science de laboratoire — précis, technologique et équilibré.',
    'Forensic Medicine': 'Investigation médico-légale — exigeante, calme et indépendante.',
    'Nuclear Medicine': 'Imagerie et thérapie radionucléique ciblée — riche en technologie et analytique.',
    'Medical Microbiology': 'Identification des microbes et des infections — rigoureuse, indépendante et de laboratoire.',
    'Radiology and Medical Imaging': 'Diagnostic par imagerie — technologique, autonome et équilibré.',
    'Public Health and Healthcare Management': 'Santé des populations et direction des systèmes — stratégique, orienté vers les gens et large.',
  },
};

// ============================================================
// Category translations
// ============================================================

export const CATEGORY_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    Surgical: 'Surgical',
    Medical: 'Medical',
    Pediatric: 'Pediatric',
    Psychiatry: 'Psychiatry',
    'Diagnostic & Support': 'Diagnostic & Support',
    'Public & Preventive': 'Public & Preventive',
  },
  ro: {
    Surgical: 'Chirurgical',
    Medical: 'Medical',
    Pediatric: 'Pediatric',
    Psychiatry: 'Psihiatrie',
    'Diagnostic & Support': 'Diagnostic și Suport',
    'Public & Preventive': 'Public și Preventiv',
  },
  fr: {
    Surgical: 'Chirurgical',
    Medical: 'Médical',
    Pediatric: 'Pédiatrique',
    Psychiatry: 'Psychiatrie',
    'Diagnostic & Support': 'Diagnostic et Soutien',
    'Public & Preventive': 'Public et Préventif',
  },
};

// ============================================================
// Helper: translate specialty name
// ============================================================

export function translateSpecialtyName(name: string, lang: Language): string {
  return SPECIALTY_TRANSLATIONS[lang][name] ?? name;
}

// ============================================================
// Helper: translate blurb
// ============================================================

export function translateBlurb(name: string, lang: Language): string {
  return BLURB_TRANSLATIONS[lang][name] ?? '';
}

// ============================================================
// Helper: translate category
// ============================================================

export function translateCategory(category: string, lang: Language): string {
  return CATEGORY_TRANSLATIONS[lang][category] ?? category;
}

// ============================================================
// Helper: translate question text
// ============================================================

export function translateQuestion(id: string, lang: Language): string {
  return QUESTION_TRANSLATIONS[lang][id] ?? QUESTION_TRANSLATIONS.en[id] ?? id;
}

// ============================================================
// Helper: translate section title/subtitle
// ============================================================

export function translateSection(sectionId: string, lang: Language): { title: string; subtitle: string } {
  return SECTION_TRANSLATIONS[lang][sectionId] ?? SECTION_TRANSLATIONS.en[sectionId] ?? { title: sectionId, subtitle: '' };
}

// ============================================================
// Helper: translate value option
// ============================================================

export function translateValue(value: string, lang: Language): string {
  return VALUE_TRANSLATIONS[lang][value] ?? value;
}
