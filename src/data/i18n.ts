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
  fullRanking: string;
  fullRankingDesc: (n: number) => string;
  retakeAssessment: string;

  // Specialist mode
  specialistBadge: string;
  specialistTitle: string;
  specialistSubtitle: string;
  specialistPromptTitle: string;
  specialistPromptDesc: string;
  specialistActualSpecialty: string;
  specialistSelectSpecialty: string;
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
  heroSubtitle: 'Answer a series of questions about your personality, working style, and values. We\'ll match you to the specialties where you\'re most likely to thrive.',
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
  specialtySubtitle: 'If a field already calls to you, pick it — we\'ll factor it into your match. Skip ahead if nothing stands out yet.',
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
  topMatch: 'Your top match',
  matchPercent: '% match',
  whyItFits: 'Why it fits you',
  preferredCallout: (name: string, rank: number, percent: number) =>
    `The specialty you picked — ${name} — ranked #${rank} for you, at a ${percent}% match.`,
  otherMatches: 'Other strong matches',
  otherMatchesDesc: 'Specialties that also align well with your profile.',
  fullRanking: 'Full ranking',
  fullRankingDesc: (n: number) => `All ${n} specialties, grouped by field.`,
  retakeAssessment: 'Retake the assessment',

  specialistBadge: 'Specialist mode',
  specialistTitle: 'Are you a medical specialist?',
  specialistSubtitle: 'Help us improve the matching algorithm. Data is stored only if you explicitly submit it for research, without your name or email.',
  specialistPromptTitle: 'Tell us your specialty',
  specialistPromptDesc: 'Select the specialty you practice. By submitting, you agree that your 81 answers, selected values, and optional calibration data are stored without direct identifiers for research.',
  specialistActualSpecialty: 'Your actual specialty',
  specialistSelectSpecialty: 'Select your specialty',
  specialistSubmit: 'Consent and submit for research',
  specialistSubmitting: 'Submitting...',
  specialistSuccess: 'Thank you! Your responses have been submitted for research.',
  specialistError: 'Something went wrong. Please try again.',
  specialistThankYou: 'Thank you for contributing',
  specialistThankYouDesc: 'Your responses have been added to our research dataset. This helps future medical students find their path.',
  specialistAnother: 'Submit another response',
  specialistToggleLabel: 'I am a specialist',
  specialistToggleDesc: 'Specialists answer the same questions to help calibrate the algorithm.',
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
  studentDataTitle: 'Help us understand student profiles',
  studentDataDesc: 'If you choose to save, your 81 answers, selected values, preferred specialty, optional study year, and browser-computed ranking are stored without your name or email for research. Saving records your consent; you can skip this step.',
  studentStudyYear: 'Year of study',
  studentPreferNotToSay: 'Prefer not to say',
  studentYear: (n: number) => `Year ${n}`,
  studentContinue: 'Consent, save, and view results',
  studentSkip: 'Skip and view results',
  studentSaving: 'Saving...',

  qProfileTitle: 'Your trait profile',
  qProfileSubtitle: 'Here\'s what your answers reveal about your strongest tendencies and preferences.',
  qProfileTopTraits: 'Strongest traits',
  qProfileBottomTraits: 'Areas with less emphasis',
  qProfileContinue: 'See specialty matches',

  prioritiesTitle: 'Adjust your priorities',
  prioritiesSubtitle: 'Slide to emphasize what matters most to you. Results update instantly.',
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
  subScoresTitle: 'Compatibility breakdown',

  tradeOffsTitle: 'Potential trade-offs',
  tradeOffsDesc: 'Areas where your profile differs from the typical demands of this specialty.',

  oppositeFitTitle: 'Why this scored lower',
  oppositeFitDesc: 'Explore the key differences between your profile and this specialty.',
  oppositeFitExplore: 'Explore fit',
  oppositeFitClose: 'Close',

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
  explorerYourMatch: 'Your match',
  explorerViewDetail: 'View details',
  explorerBack: 'Back',
  explorerBackToResults: 'Back to results',
  explorerBackToExplorer: 'Back to explorer',

  methodologyTitle: 'Science & Methodology',
  methodologySubtitle: 'How Specialty Match works — transparently.',
  methodologyQuestionnaire: 'The Questionnaire',
  methodologyQuestionnaireDesc: '81 items across 7 sections (thinking, working, interpersonal, motivations, personality, skills, values) plus 4 priority values. Each item is rated on a 1–10 scale with clear anchors.',
  methodologyTraitModel: 'Trait Model',
  methodologyTraitModelDesc: 'Answers map to latent traits via weighted directional mappings. Each question contributes to one or more traits with a direction (+1 or -1) and a weight (1.0–2.0). Value selections add flat bonuses.',
  methodologyScoring: 'Scoring Approach',
  methodologyScoringDesc: 'For each specialty, trait similarity is computed as 100 minus the absolute difference between student and target values, weighted by trait importance. The overall score is the importance-weighted average of all trait similarities.',
  methodologyProfiles: 'Specialty Profiles',
  methodologyProfilesDesc: 'Each specialty is defined by target trait values and importance weights, built from validated base archetypes (surgical, cognitive-clinical, longitudinal, people-oriented, technical, diagnostic, laboratory, pediatric, population).',
  methodologyCalibration: 'Calibration Process',
  methodologyCalibrationDesc: 'Practicing specialists answer the same questionnaire and provide calibration data (actual specialty, years of experience, satisfaction, would-choose-again, intention to change, voluntariness). This data is used to refine target profiles.',
  methodologyValidation: 'Validation Strategy',
  methodologyValidationDesc: 'Convergent validity is assessed by comparing specialist self-placements to algorithm rankings. Test-retest reliability is measured by repeat administrations. Calibration improves as the specialist dataset grows.',
  methodologyAlgorithmVersion: 'Algorithm version',
  methodologyLimitations: 'Limitations',
  methodologyLimitationsDesc: 'This tool captures tendencies, not fixed traits. Results are influenced by self-perception and current mood. Small calibration samples may bias profiles. It does not predict success or satisfaction — it suggests areas of natural alignment.',
  methodologyBibliography: 'Bibliography',
  methodologyDisclaimer: 'Career-orientation tool, not a diagnosis',
  methodologyDisclaimerDesc: 'Specialty Match is a self-reflection and career-exploration tool. It is not a psychological assessment, personality test, or clinical instrument. Results are guidance, not a verdict.',
  methodologyBack: 'Back',
  methodologyOverview: 'Project Overview',
  methodologyOverviewDesc: 'Specialty Match is a career-orientation tool for medical students. It uses a 81-item questionnaire to build a trait profile, then compares that profile against the demands of 40+ medical specialties. The goal is to help students reflect on their natural tendencies and explore which fields align with who they are — not to tell them what to do.',
  methodologyQuestionnaireStructure: 'Questionnaire Structure',
  methodologyQuestionnaireStructureDesc: 'The questionnaire has 7 sections, each targeting a different facet of the medical personality: Thinking Style (12 items), Working Style (13 items), Interpersonal Skills (11 items), Motivations (12 items), Personality (13 items), Special Skills (9 items), and Values & Lifestyle (11 items). Before the rating sections, students optionally pick a preferred specialty and select up to 4 career values. Each rating item uses a 1–10 scale anchored at "Not at all like me" and "Very much like me".',
  methodologyTraitModelDetailed: 'Trait Model — How Answers Become Traits',
  methodologyTraitModelDetailedDesc: 'Each question maps to one or more latent traits via a directional weighted mapping. Direction (+1 or -1) determines whether a high answer increases or decreases the trait. Weight (1.0–2.0) reflects how informative the question is for that trait. When multiple questions contribute to the same trait, the weighted average is used. The model tracks 97 distinct traits across all sections, from scientific curiosity to mortality tolerance.',
  methodologyScoringFormula: 'Scoring Formula',
  methodologyScoringFormulaDesc: 'For each specialty and each trait, similarity = 100 - |student_value - target_value|. This similarity is multiplied by the trait importance weight (defined per specialty), then summed and divided by total importance to produce the overall match percentage. The formula: Score = Σ(similarity × importance) / Σ(importance). A score of 100 means perfect alignment; 50 means neutral.',
  methodologySubScoresDesc: 'Beyond the overall score, each specialty is broken down into 5 dimension sub-scores: Thinking Style, Working Style, Interpersonal Fit, Technical/Practical, and Lifestyle & Values. Each sub-score is the importance-weighted average of trait similarities within that dimension. This lets students see not just how well they match overall, but where the match is strongest and weakest.',
  methodologyTradeOffsDesc: 'For every recommended specialty, the algorithm identifies the top 3–5 traits where the student profile differs most from the specialty demands (gap ≥ 20 points and importance ≥ 2). These are presented as potential trade-offs — areas where the work may feel less natural, not barriers to success.',
  methodologyPriorityWeightsDesc: 'After seeing their trait profile, students can adjust 5 sliders (one per dimension) to emphasize what matters most to them. Each slider maps to a multiplier: 0 → 0.5×, 50 (neutral) → 1.0×, 100 → 1.5×. The multiplier scales the importance of all traits in that dimension, reweighting the entire ranking in real time.',
  methodologyProfilesDetailed: 'Specialty Profiles — How Fields Are Defined',
  methodologyProfilesDetailedDesc: 'Each of the 40+ specialties is defined by a trait profile: a set of target trait values (0–100) and importance weights (0–5) for each relevant trait. Profiles are built from validated base archetypes — surgical, cognitive-clinical, longitudinal, people-oriented, technical, diagnostic, laboratory, pediatric, and population — then adjusted using clinical practice guidelines and specialist calibration data. For example, Neurosurgery demands high manual dexterity (importance 5), while Psychiatry demands high affective empathy (importance 5).',
  methodologyCalibrationDetailed: 'Calibration — Learning from Real Specialists',
  methodologyCalibrationDetailedDesc: 'Practicing specialists answer the same 81 questions and provide calibration metadata: their actual specialty, years of experience, career satisfaction (1–5), whether they would choose the same specialty again, intention to change, and how voluntarily they chose it. This data is stored anonymously and used to refine target trait profiles. If specialists in a field consistently score higher on a trait than the current target suggests, the target is adjusted.',
  methodologyValidationDetailed: 'Validation Strategy',
  methodologyValidationDetailedDesc: 'Convergent validity: if the algorithm ranks a specialist own field highly for them, the model is working. We track the rank position of each specialist self-identified field. Test-retest reliability: the same student taking the questionnaire twice should get similar rankings. As the specialist dataset grows, profiles converge toward real-world distributions.',
  methodologyDataPrivacy: 'Data Privacy',
  methodologyDataPrivacyDesc: 'Responses are stored only when a participant explicitly submits them for research. The form requests no name, email, or account identifier. Student answers and specialist calibration data are retained in a secured database for analysis and algorithm refinement.',
  methodologyTechStack: 'Technical Implementation',
  methodologyTechStackDesc: 'The scoring engine runs entirely in the browser — no server-side computation. Trait calculation, similarity scoring, priority weighting, and trade-off detection are all performed client-side. Specialist calibration data is stored in a Supabase PostgreSQL database with row-level security. The application is built with React, TypeScript, and Tailwind CSS.',
  methodologyDimensions: 'The Five Dimensions',
  methodologyDimensionsDesc: 'Traits are grouped into 5 dimensions for sub-scores and priority adjustment. Thinking (18 traits): curiosity, precision, logic, reasoning. Working (16 traits): structure, flexibility, persistence, initiative. Interpersonal (18 traits): empathy, communication, teamwork, care motivation. Technical (15 traits): dexterity, observation, crisis calmness, stress resistance. Lifestyle (29 traits): income, independence, achievement, resilience, values.',
  methodologyValuesStep: 'Value Selection — The Bonus System',
  methodologyValuesStepDesc: 'Before the rating sections, students pick up to 4 career values from 14 options (free time, achievement, prestige, independence, intellectual activity, manual work, people, security, variety, income, creativity, feedback, caring, decision-making). Each selected value adds a flat bonus (8–12 points) to one or two related traits, boosting them beyond what the questionnaire alone captures.',

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
  heroSubtitle: 'Răspunde la o serie de întrebări despre personalitatea, stilul de lucru și valorile tale. Te vom potrivi cu specialitățile în care ai cele mai mari șanse să prosperezi.',
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
  specialtySubtitle: 'Dacă un domeniu te atrage deja, alege-l — îl vom folosi în potrivirea ta. Treci mai departe dacă nimic nu iese în evidență încă.',
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
  topMatch: 'Cea mai bună potrivire',
  matchPercent: '% potrivire',
  whyItFits: 'De ce ți se potrivește',
  preferredCallout: (name: string, rank: number, percent: number) =>
    `Specialitatea pe care ai ales-o — ${name} — s-a clasat pe locul #${rank}, cu ${percent}% potrivire.`,
  otherMatches: 'Alte potriviri bune',
  otherMatchesDesc: 'Specialități care se aliniază bine cu profilul tău.',
  fullRanking: 'Clasament complet',
  fullRankingDesc: (n: number) => `Toate cele ${n} specialități, grupate pe domenii.`,
  retakeAssessment: 'Reia evaluarea',

  specialistBadge: 'Mod specialist',
  specialistTitle: 'Ești specialist medical?',
  specialistSubtitle: 'Ajută-ne să îmbunătățim algoritmul. Datele sunt stocate numai dacă le trimiți explicit pentru cercetare, fără nume sau adresă de e-mail.',
  specialistPromptTitle: 'Spune-ne specialitatea ta',
  specialistPromptDesc: 'Selectează specialitatea pe care o practici. Prin trimitere, accepți stocarea pentru cercetare a celor 81 de răspunsuri, a valorilor și a datelor opționale de calibrare, fără identificatori direcți.',
  specialistActualSpecialty: 'Specialitatea ta reală',
  specialistSelectSpecialty: 'Selectează specialitatea',
  specialistSubmit: 'Acceptă și trimite pentru cercetare',
  specialistSubmitting: 'Se trimite...',
  specialistSuccess: 'Mulțumim! Răspunsurile tale au fost trimise pentru cercetare.',
  specialistError: 'Ceva a mers greșit. Te rugăm să încerci din nou.',
  specialistThankYou: 'Mulțumim pentru contribuție',
  specialistThankYouDesc: 'Răspunsurile tale au fost adăugate la setul nostru de date de cercetare. Asta ajută viitorii studenți la medicină să-și găsească drumul.',
  specialistAnother: 'Trimite alt răspuns',
  specialistToggleLabel: 'Sunt specialist',
  specialistToggleDesc: 'Specialiștii răspund la aceleași întrebări pentru a ajuta la calibrarea algoritmului.',
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
  studentDataTitle: 'Ajută-ne să înțelegem profilurile studenților',
  studentDataDesc: 'Dacă alegi salvarea, cele 81 de răspunsuri, valorile, specialitatea preferată, anul opțional și clasamentul calculat în browser sunt stocate fără nume sau e-mail pentru cercetare. Salvarea înregistrează consimțământul; poți omite acest pas.',
  studentStudyYear: 'Anul de studiu',
  studentPreferNotToSay: 'Prefer să nu spun',
  studentYear: (n: number) => `Anul ${n}`,
  studentContinue: 'Acceptă, salvează și vezi rezultatele',
  studentSkip: 'Omite și vezi rezultatele',
  studentSaving: 'Se salvează...',

  qProfileTitle: 'Profilul tău de trăsături',
  qProfileSubtitle: 'Iată ce relevă răspunsurile tale despre cele mai puternice tendințe și preferințe.',
  qProfileTopTraits: 'Cele mai puternice trăsături',
  qProfileBottomTraits: 'Zone cu mai puțin accent',
  qProfileContinue: 'Vezi potrivirile de specialitate',

  prioritiesTitle: 'Ajustează-ți prioritățile',
  prioritiesSubtitle: 'Glisează pentru a accentua ce contează cel mai mult. Rezultatele se actualizează instant.',
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
  subScoresTitle: 'Defalcare compatibilitate',

  tradeOffsTitle: 'Compromisuri potențiale',
  tradeOffsDesc: 'Zone în care profilul tău diferă de cerințele tipice ale acestei specialități.',

  oppositeFitTitle: 'De ce a scorat mai puțin',
  oppositeFitDesc: 'Explorează diferențele cheie dintre profilul tău și această specialitate.',
  oppositeFitExplore: 'Explorează potrivirea',
  oppositeFitClose: 'Închide',

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
  explorerYourMatch: 'Potrivirea ta',
  explorerViewDetail: 'Vezi detalii',
  explorerBack: 'Înapoi',
  explorerBackToResults: 'Înapoi la rezultate',
  explorerBackToExplorer: 'Înapoi la explorator',

  methodologyTitle: 'Știință și Metodologie',
  methodologySubtitle: 'Cum funcționează Specialty Match — transparent.',
  methodologyQuestionnaire: 'Chestionarul',
  methodologyQuestionnaireDesc: '81 de itemi în 7 secțiuni (gândire, lucru, interpersonal, motivații, personalitate, abilități, valori) plus 4 valori prioritare. Fiecare item se evaluează pe o scară 1–10 cu repere clare.',
  methodologyTraitModel: 'Model de trăsături',
  methodologyTraitModelDesc: 'Răspunsurile se mapăază la trăsături latente prin mapări direcționale ponderate. Fiecare întrebare contribuie la una sau mai multe trăsături cu o direcție (+1 sau -1) și o pondere (1.0–2.0). Selecțiile de valori adaugă bonusuri.',
  methodologyScoring: 'Abordare de scorare',
  methodologyScoringDesc: 'Pentru fiecare specialitate, similaritatea trăsăturilor se calculează ca 100 minus diferența absolută dintre valorile studentului și țintă, ponderată după importanța trăsăturii. Scorul general este media ponderată după importanță a tuturor similarităților.',
  methodologyProfiles: 'Profiluri de specialitate',
  methodologyProfilesDesc: 'Fiecare specialitate este definită prin valori țintă și ponderi de importanță, construite din arhetipuri de bază validate (chirurgical, cognitiv-clinic, longitudinal, orientat spre oameni, tehnic, diagnostic, laborator, pediatric, populație).',
  methodologyCalibration: 'Proces de calibrare',
  methodologyCalibrationDesc: 'Specialiștii în exercițiu răspund la același chestionar și furnizează date de calibrare (specialitate reală, ani de experiență, satisfacție, realegere, intenție de schimbare, voluntaritate). Aceste date rafinează profilurile țintă.',
  methodologyValidation: 'Strategie de validare',
  methodologyValidationDesc: 'Validitatea convergentă se evaluează comparând auto-plasarea specialiștilor cu clasamentele algoritmului. Fiabilitatea test-retest se măsoară prin administrări repetate. Calibrarea se îmbunătățește pe măsură ce setul de date crește.',
  methodologyAlgorithmVersion: 'Versiune algoritm',
  methodologyLimitations: 'Limitări',
  methodologyLimitationsDesc: 'Acest instrument captează tendințe, nu trăsături fixe. Rezultatele sunt influențate de auto-percepție și dispoziția curentă. Eșantioane mici de calibrare pot biasa profilurile. Nu prezice succesul sau satisfacția — sugerează zone de aliniere naturală.',
  methodologyBibliography: 'Bibliografie',
  methodologyDisclaimer: 'Instrument de orientare, nu un diagnostic',
  methodologyDisclaimerDesc: 'Specialty Match este un instrument de auto-reflecție și explorare a carierei. Nu este o evaluare psihologică, un test de personalitate sau un instrument clinic. Rezultatele sunt orientative, nu un verdict.',
  methodologyBack: 'Înapoi',
  methodologyOverview: 'Prezentare generală',
  methodologyOverviewDesc: 'Specialty Match este un instrument de orientare profesională pentru studenții la medicină. Folosește un chestionar de 81 de itemi pentru a construi un profil de trăsături, apoi compară acel profil cu cerințele a peste 40 de specialități medicale. Scopul este să ajute studenții să reflecteze asupra tendințelor lor naturale și să exploreze ce domenii se aliniază cu ceea ce sunt — nu să le spună ce să facă.',
  methodologyQuestionnaireStructure: 'Structura chestionarului',
  methodologyQuestionnaireStructureDesc: 'Chestionarul are 7 secțiuni, fiecare vizând o altă fațetă a personalității medicale: Stil de gândire (12 itemi), Stil de lucru (13 itemi), Abilități interpersonale (11 itemi), Motivații (12 itemi), Personalitate (13 itemi), Abilități speciale (9 itemi), Valori și stil de viață (11 itemi). Înainte de secțiunile de evaluare, studenții aleg opțional o specialitate preferată și selectează până la 4 valori profesionale. Fiecare item folosește o scară 1–10 ancorată la „Deloc ca mine" și „Foarte mult ca mine".',
  methodologyTraitModelDetailed: 'Model de trăsături — Cum devin răspunsurile trăsături',
  methodologyTraitModelDetailedDesc: 'Fiecare întrebare se mapăază la una sau mai multe trăsături latente printr-o mapare direcțională ponderată. Direcția (+1 sau -1) determină dacă un răspuns ridicat crește sau scade trăsătura. Pondere (1.0–2.0) reflectă cât de informativă este întrebarea pentru acea trăsătură. Când mai multe întrebări contribuie la aceeași trăsătură, se folosește media ponderată. Modelul urmărește 97 de trăsături distincte, de la curiozitate științifică la toleranța la mortalitate.',
  methodologyScoringFormula: 'Formula de scorare',
  methodologyScoringFormulaDesc: 'Pentru fiecare specialitate și fiecare trăsătură, similaritatea = 100 - |valoare_student - valoare_țintă|. Această similaritate se înmulțește cu ponderea de importanță a trăsăturii (definită per specialitate), apoi se însumează și se împarte la importanța totală pentru a produce procentul general de potrivire. Formula: Scor = Σ(similaritate × importanță) / Σ(importanță). Un scor de 100 înseamnă aliniere perfectă; 50 înseamnă neutru.',
  methodologySubScoresDesc: 'Dincolo de scorul general, fiecare specialitate se descompune în 5 sub-scoruri pe dimensiuni: Stil de gândire, Stil de lucru, Potrivire interpersonală, Tehnic/Practic și Stil de viață și valori. Fiecare sub-scor este media ponderată după importanță a similarităților trăsăturilor din acea dimensiune. Astfel, studenții pot vedea nu doar cât de bine se potrivesc overall, ci unde potrivirea este cea mai puternică și cea mai slabă.',
  methodologyTradeOffsDesc: 'Pentru fiecare specialitate recomandată, algoritmul identifică primele 3–5 trăsături unde profilul studentului diferă cel mai mult de cerințele specialității (diferență ≥ 20 puncte și importanță ≥ 2). Acestea sunt prezentate ca compromisuri potențiale — zone unde munca poate părea mai puțin naturală, nu bariere pentru succes.',
  methodologyPriorityWeightsDesc: 'După ce își văd profilul de trăsături, studenții pot ajusta 5 cursoare (unul per dimensiune) pentru a accentua ce contează cel mai mult. Fiecursor se mapăază la un multiplicator: 0 → 0.5×, 50 (neutru) → 1.0×, 100 → 1.5×. Multiplicatorul scalează importanța tuturor trăsăturilor din acea dimensiune, recalculând întregul clasament în timp real.',
  methodologyProfilesDetailed: 'Profiluri de specialitate — Cum sunt definite domeniile',
  methodologyProfilesDetailedDesc: 'Fiecare dintre cele 40+ specialități este definită printr-un profil de trăsături: un set de valori țintă (0–100) și ponderi de importanță (0–5) pentru fiecare trăsătură relevantă. Profilurile sunt construite din arhetipuri de bază validate — chirurgical, cognitiv-clinic, longitudinal, orientat spre oameni, tehnic, diagnostic, laborator, pediatric și populație — apoi ajustate folosind ghiduri clinice și date de calibrare de la specialiști. De exemplu, Neurochirurgia necesită dexteritate manuală ridicată (importanță 5), în timp ce Psihiatria necesită empatie afectivă ridicată (importanță 5).',
  methodologyCalibrationDetailed: 'Calibrare — Învățăm de la specialiști reali',
  methodologyCalibrationDetailedDesc: 'Specialiștii în exercițiu răspund la aceleași 81 de întrebări și furnizează metadate de calibrare: specialitatea reală, ani de experiență, satisfacție în carieră (1–5), dacă ar alege aceeași specialitate din nou, intenția de a schimba și cât de voluntar au ales-o. Aceste date se stochează anonim și se folosesc pentru a rafina profilurile țintă. Dacă specialiștii dintr-un domeniu au constant scoruri mai mari la o trăsătură decât sugerează ținta actuală, ținta se ajustează.',
  methodologyValidationDetailed: 'Strategie de validare',
  methodologyValidationDetailedDesc: 'Validitate convergentă: dacă algoritmul clasează domeniul propriu al unui specialist ridicat pentru el, modelul funcționează. Urmărim poziția în clasament a domeniului auto-identificat al fiecărui specialist. Fiabilitate test-retest: același student care parcurge chestionarul de două ori ar trebui să obțină clasamente similare. Pe măsură ce setul de date al specialiștilor crește, profilurile converg spre distribuțiile din lumea reală.',
  methodologyDataPrivacy: 'Confidențialitatea datelor',
  methodologyDataPrivacyDesc: 'Răspunsurile sunt stocate numai când participantul le trimite explicit pentru cercetare. Formularul nu solicită nume, e-mail sau identificator de cont. Răspunsurile studenților și datele de calibrare sunt păstrate într-o bază securizată pentru analiză și rafinarea algoritmului.',
  methodologyTechStack: 'Implementare tehnică',
  methodologyTechStackDesc: 'Motorul de scorare rulează integral în browser — fără calcul pe server. Calculul trăsăturilor, scorarea similarității, ponderarea priorităților și detectarea compromisurilor se efectuează toate pe partea clientului. Datele de calibrare ale specialiștilor sunt stocate într-o bază de date PostgreSQL Supabase cu securitate la nivel de rând. Aplicația este construită cu React, TypeScript și Tailwind CSS.',
  methodologyDimensions: 'Cele cinci dimensiuni',
  methodologyDimensionsDesc: 'Trăsăturile sunt grupate în 5 dimensiuni pentru sub-scoruri și ajustarea priorităților. Gândire (18 trăsături): curiozitate, precizie, logică, raționament. Lucru (16 trăsături): structură, flexibilitate, perseverență, inițiativă. Interpersonal (18 trăsături): empatie, comunicare, lucru în echipă, motivație de îngrijire. Tehnic (15 trăsături): dexteritate, observație, calm în criză, rezistență la stres. Stil de viață (29 trăsături): venit, independență, performanță, reziliență, valori.',
  methodologyValuesStep: 'Selecția valorilor — Sistemul de bonus',
  methodologyValuesStepDesc: 'Înainte de secțiunile de evaluare, studenții aleg până la 4 valori profesionale din 14 opțiuni (timp liber, performanță, prestigiu, independență, activitate intelectuală, muncă manuală, oameni, securitate, varietate, venit, creativitate, feedback, îngrijire, luarea deciziilor). Fiecare valoare selectată adaugă un bonus fix (8–12 puncte) la una sau două trăsături corelate, crescându-le dincolo de ce captează chestionarul singur.',

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
  heroSubtitle: 'Répondez à une série de questions sur votre personnalité, votre style de travail et vos valeurs. Nous vous orienterons vers les spécialités où vous êtes le plus susceptible de vous épanouir.',
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
  specialtySubtitle: 'Si un domaine vous attire déjà, choisissez-le — nous l\'intégrerons à votre correspondance. Passez à la suite si rien ne se démarque encore.',
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
  sliderStrongly: 'Très beaucoup moi',

  resultsRetake: 'Recommencer',
  topMatch: 'Votre meilleure correspondance',
  matchPercent: '% correspondance',
  whyItFits: 'Pourquoi cela vous correspond',
  preferredCallout: (name: string, rank: number, percent: number) =>
    `La spécialité que vous avez choisie — ${name} — s'est classée #${rank}, avec ${percent}% de correspondance.`,
  otherMatches: 'Autres bonnes correspondances',
  otherMatchesDesc: 'Spécialités qui correspondent également bien à votre profil.',
  fullRanking: 'Classement complet',
  fullRankingDesc: (n: number) => `Les ${n} spécialités, groupées par domaine.`,
  retakeAssessment: 'Recommencer l\'évaluation',

  specialistBadge: 'Mode spécialiste',
  specialistTitle: 'Êtes-vous un spécialiste médical ?',
  specialistSubtitle: 'Aidez-nous à améliorer l\'algorithme. Les données ne sont conservées que si vous les soumettez explicitement pour la recherche, sans nom ni adresse e-mail.',
  specialistPromptTitle: 'Indiquez-nous votre spécialité',
  specialistPromptDesc: 'Sélectionnez la spécialité que vous pratiquez. En envoyant, vous acceptez que vos 81 réponses, vos valeurs et les données facultatives de calibration soient conservées sans identifiant direct à des fins de recherche.',
  specialistActualSpecialty: 'Votre spécialité réelle',
  specialistSelectSpecialty: 'Sélectionnez votre spécialité',
  specialistSubmit: 'Consentir et soumettre pour la recherche',
  specialistSubmitting: 'Envoi en cours...',
  specialistSuccess: 'Merci ! Vos réponses ont été soumises pour la recherche.',
  specialistError: 'Une erreur est survenue. Veuillez réessayer.',
  specialistThankYou: 'Merci pour votre contribution',
  specialistThankYouDesc: 'Vos réponses ont été ajoutées à notre jeu de données de recherche. Cela aide les futurs étudiants en médecine à trouver leur voie.',
  specialistAnother: 'Soumettre une autre réponse',
  specialistToggleLabel: 'Je suis spécialiste',
  specialistToggleDesc: 'Les spécialistes répondent aux mêmes questions pour aider à calibrer l\'algorithme.',
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
  studentDataTitle: 'Aidez-nous à comprendre les profils étudiants',
  studentDataDesc: 'Si vous choisissez l’enregistrement, vos 81 réponses, vos valeurs, votre spécialité préférée, votre année facultative et le classement calculé dans le navigateur sont conservés sans nom ni e-mail pour la recherche. Enregistrer vaut consentement ; vous pouvez passer cette étape.',
  studentStudyYear: 'Année d’études',
  studentPreferNotToSay: 'Je préfère ne pas répondre',
  studentYear: (n: number) => `${n}e année`,
  studentContinue: 'Consentir, enregistrer et voir les résultats',
  studentSkip: 'Passer et voir les résultats',
  studentSaving: 'Enregistrement...',

  qProfileTitle: 'Votre profil de traits',
  qProfileSubtitle: 'Voici ce que vos réponses révèlent sur vos tendances et préférences les plus fortes.',
  qProfileTopTraits: 'Traits les plus forts',
  qProfileBottomTraits: 'Domaines moins marqués',
  qProfileContinue: 'Voir les spécialités correspondantes',

  prioritiesTitle: 'Ajustez vos priorités',
  prioritiesSubtitle: 'Glissez pour mettre l\'accent sur ce qui compte le plus. Les résultats se mettent à jour instantanément.',
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
  subScoresTitle: 'Détail de compatibilité',

  tradeOffsTitle: 'Compromis potentiels',
  tradeOffsDesc: 'Domaines où votre profil diffère des exigences typiques de cette spécialité.',

  oppositeFitTitle: 'Pourquoi ce score plus bas',
  oppositeFitDesc: 'Explorez les différences clés entre votre profil et cette spécialité.',
  oppositeFitExplore: 'Explorer l\'adéquation',
  oppositeFitClose: 'Fermer',

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
  explorerYourMatch: 'Votre correspondance',
  explorerViewDetail: 'Voir les détails',
  explorerBack: 'Retour',
  explorerBackToResults: 'Retour aux résultats',
  explorerBackToExplorer: 'Retour à l\'explorateur',

  methodologyTitle: 'Science et Méthodologie',
  methodologySubtitle: 'Comment fonctionne Specialty Match — en toute transparence.',
  methodologyQuestionnaire: 'Le Questionnaire',
  methodologyQuestionnaireDesc: '81 items répartis en 7 sections (pensée, travail, interpersonnel, motivations, personnalité, compétences, valeurs) plus 4 valeurs prioritaires. Chaque item est évalué sur une échelle de 1 à 10 avec des repères clairs.',
  methodologyTraitModel: 'Modèle de Traits',
  methodologyTraitModelDesc: 'Les réponses sont mappées à des traits latents via des mappages directionnels pondérés. Chaque question contribue à un ou plusieurs traits avec une direction (+1 ou -1) et un poids (1.0–2.0). Les sélections de valeurs ajoutent des bonus forfaitaires.',
  methodologyScoring: 'Approche de Scoring',
  methodologyScoringDesc: 'Pour chaque spécialité, la similarité des traits est calculée comme 100 moins la différence absolue entre les valeurs de l\'étudiant et de la cible, pondérée par l\'importance du trait. Le score global est la moyenne pondérée de toutes les similarités.',
  methodologyProfiles: 'Profils de Spécialités',
  methodologyProfilesDesc: 'Chaque spécialité est définie par des valeurs cibles et des poids d\'importance, construits à partir d\'archétypes de base validés (chirurgical, cognitif-clinique, longitudinal, orienté personnes, technique, diagnostique, laboratoire, pédiatrique, population).',
  methodologyCalibration: 'Processus de Calibration',
  methodologyCalibrationDesc: 'Les spécialistes en exercice répondent au même questionnaire et fournissent des données de calibration (spécialité réelle, années d\'expérience, satisfaction, rechoisirait, intention de changer, volontariat). Ces données affinent les profils cibles.',
  methodologyValidation: 'Stratégie de Validation',
  methodologyValidationDesc: 'La validité convergente est évaluée en comparant l\'auto-placement des spécialistes aux classements de l\'algorithme. La fiabilité test-retest est mesurée par des administrations répétées. La calibration s\'améliore avec la croissance du jeu de données.',
  methodologyAlgorithmVersion: 'Version de l\'algorithme',
  methodologyLimitations: 'Limites',
  methodologyLimitationsDesc: 'Cet outil capture des tendances, pas des traits fixes. Les résultats sont influencés par l\'auto-perception et l\'humeur du moment. De petits échantillons de calibration peuvent biaiser les profils. Il ne prédit pas le succès ou la satisfaction — il suggère des domaines d\'alignement naturel.',
  methodologyBibliography: 'Bibliographie',
  methodologyDisclaimer: 'Outil d\'orientation, non un diagnostic',
  methodologyDisclaimerDesc: 'Specialty Match est un outil d\'auto-réflexion et d\'exploration de carrière. Ce n\'est pas une évaluation psychologique, un test de personnalité ou un instrument clinique. Les résultats sont indicatifs, non un verdict.',
  methodologyBack: 'Retour',
  methodologyOverview: 'Aperçu du projet',
  methodologyOverviewDesc: 'Specialty Match est un outil d\'orientation professionnelle pour les étudiants en médecine. Il utilise un questionnaire de 81 items pour construire un profil de traits, puis compare ce profil aux exigences de plus de 40 spécialités médicales. L\'objectif est d\'aider les étudiants à réfléchir à leurs tendances naturelles et à explorer quels domaines s\'alignent avec qui ils sont — pas à leur dire quoi faire.',
  methodologyQuestionnaireStructure: 'Structure du questionnaire',
  methodologyQuestionnaireStructureDesc: 'Le questionnaire comporte 7 sections, chacune ciblant un aspect différent de la personnalité médicale : Style de pensée (12 items), Style de travail (13 items), Compétences interpersonnelles (11 items), Motivations (12 items), Personnalité (13 items), Compétences spéciales (9 items), Valeurs et mode de vie (11 items). Avant les sections d\'évaluation, les étudiants choisissent optionnellement une spécialité préférée et sélectionnent jusqu\'à 4 valeurs professionnelles. Chaque item utilise une échelle de 1 à 10 ancrée à « Pas du tout moi » et « Très beaucoup moi ».',
  methodologyTraitModelDetailed: 'Modèle de traits — Comment les réponses deviennent des traits',
  methodologyTraitModelDetailedDesc: 'Chaque question est mappée à un ou plusieurs traits latents via un mappage directionnel pondéré. La direction (+1 ou -1) détermine si une réponse élevée augmente ou diminue le trait. Le poids (1.0–2.0) reflète le caractère informatif de la question pour ce trait. Lorsque plusieurs questions contribuent au même trait, la moyenne pondérée est utilisée. Le modèle suit 97 traits distincts, de la curiosité scientifique à la tolérance à la mortalité.',
  methodologyScoringFormula: 'Formule de scoring',
  methodologyScoringFormulaDesc: 'Pour chaque spécialité et chaque trait, similarité = 100 - |valeur_étudiant - valeur_cible|. Cette similarité est multipliée par le poids d\'importance du trait (défini par spécialité), puis sommée et divisée par l\'importance totale pour produire le pourcentage global de correspondance. Formule : Score = Σ(similarité × importance) / Σ(importance). Un score de 100 signifie un alignement parfait ; 50 signifie neutre.',
  methodologySubScoresDesc: 'Au-delà du score global, chaque spécialité est décomposée en 5 sous-scores par dimension : Style de pensée, Style de travail, Adéquation interpersonnelle, Technique/Pratique et Mode de vie et valeurs. Chaque sous-score est la moyenne pondérée par l\'importance des similarités de traits dans cette dimension. Cela permet aux étudiants de voir non seulement leur correspondance globale, mais aussi où la correspondance est la plus forte et la plus faible.',
  methodologyTradeOffsDesc: 'Pour chaque spécialité recommandée, l\'algorithme identifie les 3–5 traits où le profil de l\'étudiant diffère le plus des exigences de la spécialité (écart ≥ 20 points et importance ≥ 2). Ils sont présentés comme des compromis potentiels — des domaines où le travail peut sembler moins naturel, pas des barrières au succès.',
  methodologyPriorityWeightsDesc: 'Après avoir vu leur profil de traits, les étudiants peuvent ajuster 5 curseurs (un par dimension) pour souligner ce qui compte le plus. Chaque curseur correspond à un multiplicateur : 0 → 0.5×, 50 (neutre) → 1.0×, 100 → 1.5×. Le multiplicateur pondère l\'importance de tous les traits de cette dimension, recalculant tout le classement en temps réel.',
  methodologyProfilesDetailed: 'Profils de spécialités — Comment les domaines sont définis',
  methodologyProfilesDetailedDesc: 'Chacune des 40+ spécialités est définie par un profil de traits : un ensemble de valeurs cibles (0–100) et de poids d\'importance (0–5) pour chaque trait pertinent. Les profils sont construits à partir d\'archétypes de base validés — chirurgical, cognitif-clinique, longitudinal, orienté personnes, technique, diagnostique, laboratoire, pédiatrique et population — puis ajustés avec des guides de pratique clinique et des données de calibration de spécialistes. Par exemple, la neurochirurgie exige une dextérité manuelle élevée (importance 5), tandis que la psychiatrie exige une empathie affective élevée (importance 5).',
  methodologyCalibrationDetailed: 'Calibration — Apprendre des vrais spécialistes',
  methodologyCalibrationDetailedDesc: 'Les spécialistes en exercice répondent aux mêmes 81 questions et fournissent des métadonnées de calibration : leur spécialité réelle, années d\'expérience, satisfaction professionnelle (1–5), s\'ils choisiraient à nouveau la même spécialité, intention de changer, et le caractère volontaire de leur choix. Ces données sont stockées anonymement et utilisées pour affiner les profils de traits cibles. Si les spécialistes d\'un domaine obtiennent systématiquement des scores plus élevés sur un trait que ne le suggère la cible actuelle, la cible est ajustée.',
  methodologyValidationDetailed: 'Stratégie de validation',
  methodologyValidationDetailedDesc: 'Validité convergente : si l\'algorithme classe le domaine propre d\'un spécialiste haut pour lui, le modèle fonctionne. Nous suivons la position au classement du domaine auto-identifié de chaque spécialiste. Fiabilité test-retest : le même étudiant passant le questionnaire deux fois devrait obtenir des classements similaires. À mesure que le jeu de données de spécialistes grandit, les profils convergent vers les distributions du monde réel.',
  methodologyDataPrivacy: 'Confidentialité des données',
  methodologyDataPrivacyDesc: 'Les réponses ne sont conservées que lorsqu’une personne les soumet explicitement pour la recherche. Le formulaire ne demande ni nom, ni e-mail, ni identifiant de compte. Les réponses étudiantes et les données de calibration sont conservées dans une base sécurisée pour l’analyse et l’amélioration de l’algorithme.',
  methodologyTechStack: 'Implémentation technique',
  methodologyTechStackDesc: 'Le moteur de scoring fonctionne entièrement dans le navigateur — aucun calcul côté serveur. Le calcul des traits, le scoring de similarité, la pondération des priorités et la détection des compromis sont tous effectués côté client. Les données de calibration des spécialistes sont stockées dans une base de données PostgreSQL Supabase avec sécurité au niveau des lignes. L\'application est construite avec React, TypeScript et Tailwind CSS.',
  methodologyDimensions: 'Les cinq dimensions',
  methodologyDimensionsDesc: 'Les traits sont regroupés en 5 dimensions pour les sous-scores et l\'ajustement des priorités. Pensée (18 traits) : curiosité, précision, logique, raisonnement. Travail (16 traits) : structure, flexibilité, persévérance, initiative. Interpersonnel (18 traits) : empathie, communication, travail en équipe, motivation de soin. Technique (15 traits) : dextérité, observation, calme en crise, résistance au stress. Mode de vie (29 traits) : revenu, indépendance, performance, résilience, valeurs.',
  methodologyValuesStep: 'Sélection des valeurs — Le système de bonus',
  methodologyValuesStepDesc: 'Avant les sections d\'évaluation, les étudiants choisissent jusqu\'à 4 valeurs professionnelles parmi 14 options (temps libre, performance, prestige, indépendance, activité intellectuelle, travail manuel, personnes, sécurité, variété, revenu, créativité, feedback, soin, prise de décision). Chaque valeur sélectionnée ajoute un bonus fixe (8–12 points) à un ou deux traits corrélés, les renforçant au-delà de ce que le questionnaire seul capture.',

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
