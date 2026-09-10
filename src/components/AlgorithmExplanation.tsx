import { Fragment } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Brain,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  GitCompare,
  ListOrdered,
  Lock,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { Language } from '@/data/i18n';
import type { Specialty } from '@/data/specialties';
import { ALGORITHM_FLOW_STEP_IDS, getAlgorithmCoverage } from '@/lib/algorithmExplanation';
import { DATA_VERSIONS } from '@/lib/researchVersions';
import { SCORING_ENGINE_REVISION } from '@/lib/scoring';

interface AlgorithmExplanationProps {
  lang: Language;
  catalogRevision: number;
  catalogHash: string;
  specialties: readonly Specialty[];
}

interface StepCopy {
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
}

interface GuideCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  diagramTitle: string;
  diagramDescription: string;
  diagramHint: string;
  steps: StepCopy[];
  formulaTitle: string;
  formulaDescription: string;
  similarityFormula: string;
  dimensionMultiplierFormula: string;
  valueMultiplierFormula: string;
  effectiveWeight: string;
  finalScore: string;
  dimensionsTitle: string;
  dimensionsDescription: string;
  dimensions: string[];
  coverageEyebrow: string;
  coverageTitle: string;
  coverageDescription: string;
  evidenceCoverageTitle: string;
  profileCoverageTitle: string;
  totalDictionaryLabel: string;
  directlyMeasuredLabel: string;
  valueOnlyLabel: string;
  unmeasuredLabel: string;
  usedByProfilesLabel: string;
  unusedByProfilesLabel: string;
  valueOnlyTraitsLabel: string;
  unmeasuredTraitsLabel: string;
  usedBreakdownLabel: string;
  unusedTraitsDisclosure: string;
  excludedTitle: string;
  excludedItems: string[];
  calibrationEyebrow: string;
  calibrationTitle: string;
  calibrationDescription: string;
  calibrationSteps: Array<{ title: string; description: string }>;
  governedTitle: string;
  governedDescription: string;
  limitationsTitle: string;
  limitations: string[];
  interpretationTitle: string;
  interpretationDescription: string;
  provenanceTitle: string;
  revisionLabel: string;
  clientLabel: string;
  catalogLabel: string;
  questionnaireLabel: string;
}

const STEP_ICONS = [ClipboardList, Brain, SlidersHorizontal, GitCompare, Calculator, ListOrdered];

const COPY: Record<Language, Omit<GuideCopy, 'steps'> & { steps: Array<Omit<StepCopy, 'icon'>> }> = {
  en: {
    eyebrow: 'Transparent scoring model',
    title: 'How the matching algorithm works',
    subtitle: 'The engine is a versioned weighted-similarity model. It compares a participant profile with specialty target profiles; it is not a diagnostic or a machine-learning prediction.',
    diagramTitle: 'Q-Pro scoring pipeline',
    diagramDescription: 'Six stages transform 81 ratings and selected values into comparable traits, specialty fit indices, and a descending ranking.',
    diagramHint: 'Scroll horizontally to inspect the full diagram.',
    steps: [
      { title: 'Questionnaire inputs', short: '81 items · scale 1–10', description: 'The engine receives all 81 ratings and up to four selected career values. A preferred specialty is retained only for comparison and never changes the score.' },
      { title: 'Traits on a 0–100 scale', short: 'Normalize · align · average', description: 'Each rating is normalized with ((answer − 1) / 9) × 100. Reverse-coded mappings are inverted, then question evidence is averaged by trait using mapping weights.' },
      { title: 'Career-value importance', short: 'Importance, not inflation', description: 'A selected value increases the importance of its mapped traits during matching. It never rewrites a trait already measured by the 81 items; an otherwise unmeasured selected-value trait receives the explicit 90/100 value-only signal.' },
      { title: 'Specialty comparison', short: 'Participant ↔ target', description: 'For each specialty, only traits available in both the participant profile and the versioned target profile are compared. Missing evidence is omitted rather than treated as a zero.' },
      { title: 'Weighted fit index', short: 'Similarity · effective weight', description: 'Trait similarity is combined with the profile importance, the dimension multiplier, and any selected-value multiplier. The result is a weighted mean from 0 to 100.' },
      { title: 'Ranking and explanations', short: 'Highest index first', description: 'All specialty indices are sorted from highest to lowest. Dimension sub-scores and largest weighted gaps support the displayed explanations and trade-offs.' },
    ],
    formulaTitle: 'The calculation used for each specialty',
    formulaDescription: 'Only overlapping traits enter the denominator, so an unavailable trait cannot silently become a mismatch.',
    similarityFormula: 'similarity = max(0, 100 − |participant trait − specialty target|)',
    dimensionMultiplierFormula: 'dimension multiplier = 0.5 + priority / 100 (or 1.0 when neutral)',
    valueMultiplierFormula: 'value multiplier = 1 + mapped bonus / 24 (strongest selected value retained)',
    effectiveWeight: 'effective weight = profile importance × dimension multiplier × value multiplier',
    finalScore: 'fit index = Σ(similarity × effective weight) / Σ(effective weight)',
    dimensionsTitle: 'Five interpretation dimensions',
    dimensionsDescription: 'Traits are grouped for sub-scores and weighting. The current canonical dashboard calculation keeps every dimension at its neutral 1.0× multiplier.',
    dimensions: ['Thinking', 'Working style', 'Interpersonal', 'Technical', 'Lifestyle'],
    coverageEyebrow: 'Current model coverage',
    coverageTitle: 'Which traits are observed and which traits affect a score?',
    coverageDescription: 'These are two views of the same trait dictionary: the evidence source available for each trait, and whether at least one currently published specialty profile uses it.',
    evidenceCoverageTitle: 'Evidence coverage',
    profileCoverageTitle: 'Published-profile coverage',
    totalDictionaryLabel: 'Traits in dictionary',
    directlyMeasuredLabel: 'Measured by ratings',
    valueOnlyLabel: 'Available only through values',
    unmeasuredLabel: 'Not measured',
    usedByProfilesLabel: 'Used by profiles',
    unusedByProfilesLabel: 'Unused by profiles',
    valueOnlyTraitsLabel: 'Value-only traits',
    unmeasuredTraitsLabel: 'Unmeasured traits',
    usedBreakdownLabel: 'Among traits used by profiles',
    unusedTraitsDisclosure: 'Show traits that do not currently affect a score',
    excludedTitle: 'Context that does not affect the score',
    excludedItems: ['Preferred specialty choice', 'Study year and participant status (student, specialist, or curious)', 'Specialist free-text narratives'],
    calibrationEyebrow: 'Reviewed calibration loop',
    calibrationTitle: 'How specialist data can improve a future version',
    calibrationDescription: 'Calibration is a governed research workflow outside the participant score. It produces evidence for human review, not automatic model changes.',
    calibrationSteps: [
      { title: 'Specialist responses', description: 'Actual specialty and the qualitative interview are required. The 81 ratings and selected career values are optional.' },
      { title: 'Eligibility and provenance', description: 'Only specialists who completed a compatible quantitative payload (81 ratings and valid selected values) enter ranks, traits, and Top-k indicators. Skipped questionnaires remain available for qualitative review.' },
      { title: 'Descriptive diagnostics', description: 'Tie-aware rank, target gaps, and Top-k recall describe current behavior.' },
      { title: 'Expert review', description: 'Professor and Doctor examine evidence, coverage, and possible profile changes.' },
      { title: 'Versioned publication', description: 'A reviewed complete catalog is published as a new auditable revision.' },
    ],
    governedTitle: 'No automatic learning from submissions',
    governedDescription: 'Neither a student answer nor a specialist answer directly modifies target profiles or weights. A change requires authorized review, an explicit justification, and a newly published catalog revision.',
    limitationsTitle: 'Structural limitations to keep visible',
    limitations: [
      'Some traits used by specialty profiles are not measured for the full cohort. manual_orientation is currently available only through selected-value evidence, while prevention_orientation is not measured.',
      'Top-k recall describes the current engine and must not, by itself, validate or trigger a change in target profiles or weights.',
      'Very small eligible samples are descriptive only; they are not reliable automatic calibration signals.',
    ],
    interpretationTitle: 'How to interpret the output',
    interpretationDescription: 'A fit index is a relative orientation indicator, not a probability of success, a psychological diagnosis, or a guarantee that a specialty will suit an individual.',
    provenanceTitle: 'Active calculation provenance',
    revisionLabel: 'Engine revision',
    clientLabel: 'Stored scoring protocol',
    catalogLabel: 'Published catalog',
    questionnaireLabel: 'Questionnaire',
  },
  fr: {
    eyebrow: 'Modèle de calcul transparent',
    title: 'Comment fonctionne l’algorithme de correspondance',
    subtitle: 'Le moteur est un modèle versionné de similarité pondérée. Il compare le profil d’un participant aux profils cibles des spécialités ; ce n’est ni un diagnostic ni une prédiction par apprentissage automatique.',
    diagramTitle: 'Chaîne de calcul Q-Pro',
    diagramDescription: 'Six étapes transforment 81 notes et les valeurs choisies en traits comparables, indices d’adéquation par spécialité et classement décroissant.',
    diagramHint: 'Faites défiler horizontalement pour consulter tout le schéma.',
    steps: [
      { title: 'Entrées du questionnaire', short: '81 items · échelle 1–10', description: 'Le moteur reçoit les 81 notes et jusqu’à quatre valeurs professionnelles. La spécialité préférée est conservée uniquement pour comparaison et ne modifie jamais le score.' },
      { title: 'Traits sur une échelle 0–100', short: 'Normaliser · aligner · moyenner', description: 'Chaque note est normalisée avec ((réponse − 1) / 9) × 100. Les associations inversées sont retournées, puis les preuves sont moyennées par trait selon leurs poids.' },
      { title: 'Importance des valeurs', short: 'Importance, pas inflation', description: 'Une valeur sélectionnée augmente l’importance de ses traits pendant la comparaison. Elle ne réécrit jamais un trait déjà mesuré par les 81 items ; un trait autrement absent reçoit le signal explicite « valeur seule » de 90/100.' },
      { title: 'Comparaison aux spécialités', short: 'Participant ↔ cible', description: 'Pour chaque spécialité, seuls les traits disponibles à la fois chez le participant et dans le profil cible versionné sont comparés. Une preuve absente est omise, jamais transformée en zéro.' },
      { title: 'Indice pondéré', short: 'Similarité · poids effectif', description: 'La similarité d’un trait est combinée à son importance dans le profil, au multiplicateur de dimension et au multiplicateur éventuel d’une valeur. Le résultat est une moyenne pondérée de 0 à 100.' },
      { title: 'Classement et explications', short: 'Indice le plus élevé d’abord', description: 'Tous les indices sont triés du plus élevé au plus faible. Les sous-scores par dimension et les écarts pondérés les plus grands alimentent les explications et compromis affichés.' },
    ],
    formulaTitle: 'Le calcul appliqué à chaque spécialité',
    formulaDescription: 'Seuls les traits communs entrent dans le dénominateur : un trait indisponible ne devient donc pas silencieusement une incompatibilité.',
    similarityFormula: 'similarité = max(0, 100 − |trait du participant − cible de la spécialité|)',
    dimensionMultiplierFormula: 'multiplicateur de dimension = 0,5 + priorité / 100 (ou 1,0 si neutre)',
    valueMultiplierFormula: 'multiplicateur de valeur = 1 + bonus associé / 24 (la valeur sélectionnée la plus forte est retenue)',
    effectiveWeight: 'poids effectif = importance du profil × multiplicateur de dimension × multiplicateur de valeur',
    finalScore: 'indice d’adéquation = Σ(similarité × poids effectif) / Σ(poids effectif)',
    dimensionsTitle: 'Cinq dimensions d’interprétation',
    dimensionsDescription: 'Les traits sont regroupés pour les sous-scores et la pondération. Le calcul canonique actuel du dashboard conserve chaque dimension au multiplicateur neutre de 1,0×.',
    dimensions: ['Réflexion', 'Style de travail', 'Interpersonnel', 'Technique', 'Mode de vie'],
    coverageEyebrow: 'Couverture du modèle actuel',
    coverageTitle: 'Quels traits sont observés et lesquels influencent un score ?',
    coverageDescription: 'Voici deux lectures du même dictionnaire de traits : la source de preuve disponible pour chaque trait et son utilisation par au moins un profil de spécialité actuellement publié.',
    evidenceCoverageTitle: 'Couverture des preuves',
    profileCoverageTitle: 'Couverture des profils publiés',
    totalDictionaryLabel: 'Traits du dictionnaire',
    directlyMeasuredLabel: 'Mesurés par les notes',
    valueOnlyLabel: 'Disponibles uniquement par les valeurs',
    unmeasuredLabel: 'Non mesurés',
    usedByProfilesLabel: 'Utilisés par les profils',
    unusedByProfilesLabel: 'Non utilisés par les profils',
    valueOnlyTraitsLabel: 'Traits issus uniquement des valeurs',
    unmeasuredTraitsLabel: 'Traits non mesurés',
    usedBreakdownLabel: 'Parmi les traits utilisés par les profils',
    unusedTraitsDisclosure: 'Afficher les traits qui n’influencent actuellement aucun score',
    excludedTitle: 'Contexte sans effet sur le score',
    excludedItems: ['Choix de spécialité préférée', 'Année d’étude et statut du participant (étudiant, spécialiste ou curieux)', 'Verbatim qualitatif des spécialistes'],
    calibrationEyebrow: 'Boucle de calibration contrôlée',
    calibrationTitle: 'Comment les données spécialistes peuvent améliorer une future version',
    calibrationDescription: 'La calibration est un processus de recherche gouverné, distinct du score du participant. Elle produit des éléments pour une revue humaine, jamais des modifications automatiques.',
    calibrationSteps: [
      { title: 'Réponses spécialistes', description: 'La spécialité réelle et l’entretien qualitatif sont obligatoires. Les 81 notes et les valeurs professionnelles sont facultatives.' },
      { title: 'Éligibilité et provenance', description: 'Seuls les spécialistes ayant rempli un dossier quantitatif compatible (81 notes et valeurs valides) entrent dans les rangs, traits et indicateurs Top-k. Les questionnaires passés restent disponibles pour l’analyse qualitative.' },
      { title: 'Diagnostics descriptifs', description: 'Rang avec ex æquo, écarts aux cibles et rappels Top-k décrivent le moteur actuel.' },
      { title: 'Revue experte', description: 'Professeur et Docteur examinent les preuves, la couverture et les changements possibles.' },
      { title: 'Publication versionnée', description: 'Un catalogue complet validé est publié comme nouvelle révision auditable.' },
    ],
    governedTitle: 'Aucun apprentissage automatique depuis les réponses',
    governedDescription: 'Ni une réponse étudiante ni une réponse spécialiste ne modifie directement les profils cibles ou leurs poids. Toute évolution exige une revue autorisée, une justification explicite et la publication d’une nouvelle révision du catalogue.',
    limitationsTitle: 'Limites structurelles à garder visibles',
    limitations: [
      'Certains traits utilisés par les profils ne sont pas mesurés pour toute la cohorte. manual_orientation dépend actuellement d’une valeur sélectionnée, tandis que prevention_orientation n’est pas mesuré.',
      'Les rappels Top-k décrivent le moteur actuel et ne doivent pas, à eux seuls, valider ou déclencher une modification des profils cibles ou des poids.',
      'Les très petits échantillons éligibles restent descriptifs ; ils ne constituent pas un signal fiable de calibration automatique.',
    ],
    interpretationTitle: 'Comment interpréter le résultat',
    interpretationDescription: 'Un indice d’adéquation est un repère relatif d’orientation, et non une probabilité de réussite, un diagnostic psychologique ou la garantie qu’une spécialité conviendra à une personne.',
    provenanceTitle: 'Provenance du calcul actif',
    revisionLabel: 'Révision du moteur',
    clientLabel: 'Protocole de score enregistré',
    catalogLabel: 'Catalogue publié',
    questionnaireLabel: 'Questionnaire',
  },
  ro: {
    eyebrow: 'Model de calcul transparent',
    title: 'Cum funcționează algoritmul de potrivire',
    subtitle: 'Motorul este un model versionat de similaritate ponderată. Compară profilul participantului cu profilurile-țintă ale specialităților; nu este un diagnostic și nici o predicție bazată pe învățare automată.',
    diagramTitle: 'Fluxul de calcul Q-Pro',
    diagramDescription: 'Șase etape transformă 81 de evaluări și valorile selectate în trăsături comparabile, indici de potrivire și un clasament descrescător.',
    diagramHint: 'Derulează orizontal pentru a vedea întreaga diagramă.',
    steps: [
      { title: 'Datele chestionarului', short: '81 itemi · scală 1–10', description: 'Motorul primește toate cele 81 de evaluări și până la patru valori profesionale. Specialitatea preferată este păstrată doar pentru comparație și nu modifică scorul.' },
      { title: 'Trăsături pe scala 0–100', short: 'Normalizare · aliniere · medie', description: 'Fiecare răspuns este normalizat cu ((răspuns − 1) / 9) × 100. Asocierile inverse sunt întoarse, apoi dovezile sunt mediate ponderat pentru fiecare trăsătură.' },
      { title: 'Importanța valorilor', short: 'Importanță, nu inflație', description: 'O valoare selectată mărește importanța trăsăturilor asociate. Nu rescrie o trăsătură deja măsurată; o trăsătură altfel nemăsurată primește semnalul explicit de 90/100 bazat doar pe valoare.' },
      { title: 'Comparația cu specialitățile', short: 'Participant ↔ țintă', description: 'Pentru fiecare specialitate sunt comparate numai trăsăturile disponibile în ambele profiluri. Dovezile lipsă sunt omise, nu tratate drept zero.' },
      { title: 'Indice ponderat', short: 'Similaritate · pondere efectivă', description: 'Similaritatea este combinată cu importanța din profil, multiplicatorul dimensiunii și multiplicatorul valorii. Rezultatul este o medie ponderată între 0 și 100.' },
      { title: 'Clasament și explicații', short: 'Indicele cel mai mare primul', description: 'Indicii sunt sortați descrescător. Subscorurile pe dimensiuni și cele mai mari diferențe ponderate susțin explicațiile afișate.' },
    ],
    formulaTitle: 'Calculul aplicat fiecărei specialități',
    formulaDescription: 'Numai trăsăturile comune intră în numitor, astfel încât o trăsătură indisponibilă nu devine automat o nepotrivire.',
    similarityFormula: 'similaritate = max(0, 100 − |trăsătura participantului − ținta specialității|)',
    dimensionMultiplierFormula: 'multiplicator de dimensiune = 0,5 + prioritate / 100 (sau 1,0 când este neutru)',
    valueMultiplierFormula: 'multiplicator de valoare = 1 + bonus asociat / 24 (se păstrează cea mai puternică valoare selectată)',
    effectiveWeight: 'pondere efectivă = importanța profilului × multiplicatorul dimensiunii × multiplicatorul valorii',
    finalScore: 'indice de potrivire = Σ(similaritate × pondere efectivă) / Σ(pondere efectivă)',
    dimensionsTitle: 'Cinci dimensiuni de interpretare',
    dimensionsDescription: 'Trăsăturile sunt grupate pentru subscoruri și ponderare. Calculul canonic actual păstrează fiecare dimensiune la multiplicatorul neutru 1,0×.',
    dimensions: ['Gândire', 'Stil de lucru', 'Interpersonal', 'Tehnic', 'Stil de viață'],
    coverageEyebrow: 'Acoperirea modelului actual',
    coverageTitle: 'Ce trăsături sunt observate și care influențează scorul?',
    coverageDescription: 'Acestea sunt două perspective asupra aceluiași dicționar de trăsături: sursa dovezii pentru fiecare trăsătură și utilizarea ei de cel puțin un profil de specialitate publicat în prezent.',
    evidenceCoverageTitle: 'Acoperirea dovezilor',
    profileCoverageTitle: 'Acoperirea profilurilor publicate',
    totalDictionaryLabel: 'Trăsături în dicționar',
    directlyMeasuredLabel: 'Măsurate prin evaluări',
    valueOnlyLabel: 'Disponibile numai prin valori',
    unmeasuredLabel: 'Nemăsurate',
    usedByProfilesLabel: 'Folosite de profiluri',
    unusedByProfilesLabel: 'Nefolosite de profiluri',
    valueOnlyTraitsLabel: 'Trăsături bazate numai pe valori',
    unmeasuredTraitsLabel: 'Trăsături nemăsurate',
    usedBreakdownLabel: 'Dintre trăsăturile folosite de profiluri',
    unusedTraitsDisclosure: 'Arată trăsăturile care nu influențează în prezent niciun scor',
    excludedTitle: 'Context care nu influențează scorul',
    excludedItems: ['Specialitatea preferată', 'Anul de studiu și statutul participantului (student, specialist sau curios)', 'Răspunsurile calitative ale specialiștilor'],
    calibrationEyebrow: 'Buclă de calibrare controlată',
    calibrationTitle: 'Cum pot datele specialiștilor îmbunătăți o versiune viitoare',
    calibrationDescription: 'Calibrarea este un proces de cercetare guvernat, separat de scorul participantului. Produce dovezi pentru revizuire umană, nu schimbări automate.',
    calibrationSteps: [
      { title: 'Răspunsuri de la specialiști', description: 'Specialitatea reală și interviul calitativ sunt obligatorii. Cele 81 de evaluări și valorile profesionale sunt opționale.' },
      { title: 'Eligibilitate și proveniență', description: 'Doar specialiștii cu un set cantitativ compatibil și complet (81 de evaluări și valori valide) intră în ranguri, trăsături și indicatorii Top-k. Chestionarele omise rămân disponibile pentru analiza calitativă.' },
      { title: 'Indicatori descriptivi', description: 'Rangul cu egalități, diferențele și Top-k descriu comportamentul actual.' },
      { title: 'Revizuire de specialitate', description: 'Profesorul și Doctorul examinează dovezile, acoperirea și schimbările posibile.' },
      { title: 'Publicare versionată', description: 'Un catalog complet revizuit este publicat ca o nouă versiune auditabilă.' },
    ],
    governedTitle: 'Nicio învățare automată din răspunsuri',
    governedDescription: 'Niciun răspuns al unui student sau specialist nu modifică direct profilurile-țintă ori ponderile. Orice schimbare necesită revizuire autorizată, justificare explicită și publicarea unei noi versiuni.',
    limitationsTitle: 'Limitări structurale care trebuie păstrate vizibile',
    limitations: [
      'Unele trăsături folosite de profiluri nu sunt măsurate pentru întreaga cohortă. manual_orientation depinde acum de o valoare selectată, iar prevention_orientation nu este măsurată.',
      'Indicatorii Top-k descriu motorul actual și nu trebuie să valideze sau să declanșeze singuri modificări ale profilurilor ori ponderilor.',
      'Eșantioanele eligibile foarte mici sunt doar descriptive și nu reprezintă semnale fiabile de calibrare automată.',
    ],
    interpretationTitle: 'Cum se interpretează rezultatul',
    interpretationDescription: 'Indicele de potrivire este un reper relativ de orientare, nu o probabilitate de succes, un diagnostic psihologic sau o garanție că o specialitate se potrivește unei persoane.',
    provenanceTitle: 'Proveniența calculului activ',
    revisionLabel: 'Versiunea motorului',
    clientLabel: 'Protocolul de scor salvat',
    catalogLabel: 'Catalogul publicat',
    questionnaireLabel: 'Chestionar',
  },
};

const STAGE_COLORS = [
  'border-brand-200 bg-brand-50 text-brand-700',
  'border-blue-200 bg-blue-50 text-blue-700',
  'border-amber-200 bg-amber-50 text-amber-700',
  'border-violet-200 bg-violet-50 text-violet-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
  'border-accent-200 bg-accent-50 text-accent-700',
];

function AlgorithmFlowDiagram({ copy }: { copy: GuideCopy }) {
  const shortLabels = copy.steps.map((step) => step.short);
  const titles = copy.steps.map((step) => step.title);

  return (
    <figure className="mt-8 overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
      <div className="border-b border-brand-100 bg-gradient-to-r from-brand-950 via-brand-800 to-brand-700 px-6 py-5 text-white sm:px-8">
        <h2 className="font-display text-xl font-semibold">{copy.diagramTitle}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-brand-100">{copy.diagramDescription}</p>
      </div>
      <div className="overflow-x-auto p-4 scrollbar-thin sm:p-6">
        <svg
          role="img"
          aria-labelledby="algorithm-diagram-title algorithm-diagram-description"
          viewBox="0 0 1280 220"
          className="h-auto min-w-[980px]"
        >
          <title id="algorithm-diagram-title">{copy.diagramTitle}</title>
          <desc id="algorithm-diagram-description">{copy.diagramDescription}</desc>
          <defs>
            <marker id="algorithm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8c70bc" />
            </marker>
          </defs>
          {copy.steps.map((step, index) => {
            const x = 15 + index * 210;
            return (
              <g key={ALGORITHM_FLOW_STEP_IDS[index]}>
                {index < copy.steps.length - 1 && (
                  <line x1={x + 180} y1="110" x2={x + 205} y2="110" stroke="#b39fd4" strokeWidth="3" markerEnd="url(#algorithm-arrow)" />
                )}
                <rect x={x} y="35" width="180" height="150" rx="22" fill={index % 2 === 0 ? '#f5f3fa' : '#fbf8f5'} stroke={index % 2 === 0 ? '#d5cbe6' : '#e8d9cd'} strokeWidth="2" />
                <circle cx={x + 27} cy="63" r="14" fill="#250e62" />
                <text x={x + 27} y="68" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">{index + 1}</text>
                <text x={x + 16} y="105" fontSize="15" fontWeight="700" fill="#1a212c">
                  {titles[index].length > 24 ? `${titles[index].slice(0, 23)}…` : titles[index]}
                </text>
                <text x={x + 16} y="135" fontSize="12" fill="#5b6a80">
                  {shortLabels[index].length > 27 ? `${shortLabels[index].slice(0, 26)}…` : shortLabels[index]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="border-t border-ink-100 px-6 py-3 text-xs text-ink-500 sm:hidden">{copy.diagramHint}</figcaption>
    </figure>
  );
}

function ProvenanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="mt-1 break-all text-sm font-semibold text-ink-800">{value}</dd>
    </div>
  );
}

function CoverageMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <p className="font-display text-3xl font-semibold tabular-nums text-brand-700">{value}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-ink-500">{label}</p>
    </div>
  );
}

export default function AlgorithmExplanation({
  lang,
  catalogRevision,
  catalogHash,
  specialties,
}: AlgorithmExplanationProps) {
  const rawCopy = COPY[lang];
  const copy: GuideCopy = {
    ...rawCopy,
    steps: rawCopy.steps.map((step, index) => ({ ...step, icon: STEP_ICONS[index] })),
  };
  const coverage = getAlgorithmCoverage(specialties);

  return (
    <article data-algorithm-explanation className="animate-fade-up pb-10">
      <header className="rounded-3xl border border-brand-100 bg-gradient-to-br from-white via-brand-50/50 to-accent-50 p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          <Scale className="h-4 w-4" aria-hidden="true" />
          {copy.eyebrow}
        </div>
        <h2 className="mt-4 max-w-4xl font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{copy.title}</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-ink-600 sm:text-base">{copy.subtitle}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(coverage.questionCount), lang === 'fr' ? 'items notés' : lang === 'ro' ? 'itemi evaluați' : 'rated items'],
            [String(specialties.length), lang === 'fr' ? 'spécialités' : lang === 'ro' ? 'specialități' : 'specialties'],
            [String(coverage.dimensionCount), lang === 'fr' ? 'dimensions' : lang === 'ro' ? 'dimensiuni' : 'dimensions'],
            ['0–100', lang === 'fr' ? 'indice relatif' : lang === 'ro' ? 'indice relativ' : 'relative index'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-white bg-white/80 p-4 shadow-soft">
              <p className="font-display text-2xl font-semibold text-brand-700">{value}</p>
              <p className="mt-1 text-xs font-medium text-ink-500">{label}</p>
            </div>
          ))}
        </div>
      </header>

      <AlgorithmFlowDiagram copy={copy} />

      <section
        data-algorithm-coverage
        className="mt-8 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-blue-50/60 p-6 shadow-soft sm:p-8"
        aria-labelledby="algorithm-coverage-title"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
          <GitCompare className="h-4 w-4" aria-hidden="true" />
          {copy.coverageEyebrow}
        </div>
        <h2 id="algorithm-coverage-title" className="mt-3 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
          {copy.coverageTitle}
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-ink-600">{copy.coverageDescription}</p>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-ink-100 bg-white/70 p-4 sm:p-5" aria-labelledby="evidence-coverage-title">
            <h3 id="evidence-coverage-title" className="font-semibold text-ink-900">{copy.evidenceCoverageTitle}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div data-coverage-metric="total-dictionary"><CoverageMetric value={coverage.totalDictionary} label={copy.totalDictionaryLabel} /></div>
              <div data-coverage-metric="directly-measured"><CoverageMetric value={coverage.directlyMeasured} label={copy.directlyMeasuredLabel} /></div>
              <div data-coverage-metric="value-only"><CoverageMetric value={coverage.valueOnly} label={copy.valueOnlyLabel} /></div>
              <div data-coverage-metric="unmeasured"><CoverageMetric value={coverage.unmeasured} label={copy.unmeasuredLabel} /></div>
            </div>
            <dl className="mt-4 space-y-2 rounded-xl border border-ink-100 bg-white p-4 text-xs leading-5 text-ink-600">
              <div>
                <dt className="font-semibold text-ink-800">{copy.valueOnlyTraitsLabel}</dt>
                <dd className="mt-0.5 break-words font-mono">{coverage.valueOnlyTraits.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-800">{copy.unmeasuredTraitsLabel}</dt>
                <dd className="mt-0.5 break-words font-mono">{coverage.unmeasuredTraits.join(', ') || '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white/70 p-4 sm:p-5" aria-labelledby="profile-coverage-title">
            <h3 id="profile-coverage-title" className="font-semibold text-ink-900">{copy.profileCoverageTitle}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div data-coverage-metric="used-by-profiles"><CoverageMetric value={coverage.usedByProfiles} label={copy.usedByProfilesLabel} /></div>
              <div data-coverage-metric="unused-by-profiles"><CoverageMetric value={coverage.unusedByProfiles} label={copy.unusedByProfilesLabel} /></div>
            </div>
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
              <p className="text-xs font-semibold text-brand-900">{copy.usedBreakdownLabel}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  [coverage.usedDirectlyMeasured, copy.directlyMeasuredLabel],
                  [coverage.usedValueOnly, copy.valueOnlyLabel],
                  [coverage.usedUnmeasured, copy.unmeasuredLabel],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-white px-2 py-3">
                    <dt className="text-[10px] leading-4 text-ink-500">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-brand-800">{value}</dd>
                  </div>
                ))}
              </dl>
              {(coverage.usedValueOnlyTraits.length > 0 || coverage.usedUnmeasuredTraits.length > 0) && (
                <p className="mt-3 break-words font-mono text-[11px] leading-5 text-brand-900">
                  {[...coverage.usedValueOnlyTraits, ...coverage.usedUnmeasuredTraits].join(', ')}
                </p>
              )}
            </div>
            <details className="mt-4 rounded-xl border border-ink-100 bg-white p-4 text-xs text-ink-600">
              <summary className="cursor-pointer font-semibold text-ink-800">
                {copy.unusedTraitsDisclosure} ({coverage.unusedByProfiles})
              </summary>
              <p className="mt-3 break-words font-mono leading-5">{coverage.unusedByProfilesTraits.join(', ') || '—'}</p>
            </details>
          </section>
        </div>
      </section>

      <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {copy.steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={ALGORITHM_FLOW_STEP_IDS[index]}
              data-algorithm-step={ALGORITHM_FLOW_STEP_IDS[index]}
              className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft"
            >
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${STAGE_COLORS[index]}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{String(index + 1).padStart(2, '0')}</p>
                  <h2 className="mt-1 text-base font-semibold text-ink-900">{step.title}</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-600">{step.description}</p>
            </li>
          );
        })}
      </ol>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-3xl border border-brand-200 bg-brand-950 p-6 text-white shadow-lift sm:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-200">
            <Calculator className="h-5 w-5" aria-hidden="true" />
            {copy.formulaTitle}
          </div>
          <p className="mt-3 text-sm leading-6 text-brand-100">{copy.formulaDescription}</p>
          <div className="mt-6 space-y-3 font-mono text-xs sm:text-sm">
            <code className="block overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-4 text-brand-50 scrollbar-thin">
              {copy.similarityFormula}
            </code>
            <code className="block overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-4 text-brand-50 scrollbar-thin">
              {copy.dimensionMultiplierFormula}
            </code>
            <code className="block overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-4 text-brand-50 scrollbar-thin">
              {copy.valueMultiplierFormula}
            </code>
            <code className="block overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-4 text-brand-50 scrollbar-thin">
              {copy.effectiveWeight}
            </code>
            <code className="block overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-4 text-brand-50 scrollbar-thin">
              {copy.finalScore}
            </code>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-ink-100 bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-semibold text-ink-900">
              <SlidersHorizontal className="h-5 w-5 text-brand-600" aria-hidden="true" />
              {copy.dimensionsTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">{copy.dimensionsDescription}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {copy.dimensions.map((dimension) => (
                <span key={dimension} className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">{dimension}</span>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-ink-100 bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-semibold text-ink-900">
              <Lock className="h-5 w-5 text-ink-500" aria-hidden="true" />
              {copy.excludedTitle}
            </h2>
            <ul className="mt-4 space-y-2">
              {copy.excludedItems.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-ink-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-accent-200 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-700">{copy.calibrationEyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{copy.calibrationTitle}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-ink-600">{copy.calibrationDescription}</p>
        <div role="list" className="mt-7 flex flex-col items-stretch gap-2 xl:flex-row xl:items-center">
          {copy.calibrationSteps.map((step, index) => (
            <Fragment key={step.title}>
              <div role="listitem" className="min-w-0 flex-1 rounded-2xl border border-accent-200 bg-accent-50 p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-700 text-xs font-bold text-white">{index + 1}</span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-ink-600">{step.description}</p>
              </div>
              {index < copy.calibrationSteps.length - 1 && (
                <span aria-hidden="true" className="flex shrink-0 items-center justify-center text-accent-400">
                  <ArrowDown className="h-5 w-5 xl:hidden" />
                  <ArrowRight className="hidden h-5 w-5 xl:block" />
                </span>
              )}
            </Fragment>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-900">{copy.governedTitle}</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-800">{copy.governedDescription}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-amber-950">
            <TriangleAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
            {copy.limitationsTitle}
          </h2>
          <ul className="mt-4 space-y-3">
            {copy.limitations.map((limitation) => (
              <li key={limitation} className="flex gap-3 text-sm leading-6 text-amber-900">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden="true" />
                {limitation}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-blue-950">
            <Database className="h-5 w-5 text-blue-700" aria-hidden="true" />
            {copy.interpretationTitle}
          </h2>
          <p className="mt-4 text-sm leading-6 text-blue-900">{copy.interpretationDescription}</p>
          <div className="mt-6 border-t border-blue-200 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800">{copy.provenanceTitle}</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <ProvenanceItem label={copy.revisionLabel} value={SCORING_ENGINE_REVISION} />
              <ProvenanceItem label={copy.clientLabel} value={DATA_VERSIONS.scoring} />
              <ProvenanceItem label={copy.catalogLabel} value={`r${catalogRevision} · ${catalogHash ? catalogHash.slice(0, 12) : '—'}`} />
              <ProvenanceItem label={copy.questionnaireLabel} value={DATA_VERSIONS.questionnaire} />
            </dl>
          </div>
        </div>
      </section>
    </article>
  );
}
