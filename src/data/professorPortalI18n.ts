import type { Language } from './i18n';

interface ProfessorPortalStrings {
  loginTitle: string;
  loginDescription: string;
  password: string;
  signIn: string;
  checking: string;
  unauthorized: string;
  portalTitle: string;
  overview: string;
  overviewDescription: string;
  analytics: string;
  analyticsDescription: string;
  researchAccess: string;
  accessNotice: string;
  countsNotice: string;
  total: string;
  students: string;
  explorers: string;
  specialists: string;
  studentsCard: string;
  studentsDescription: string;
  specialistsCard: string;
  specialistsDescription: string;
  mapCard: string;
  mapDescription: string;
  mapNotice: string;
  open: string;
  exportsTitle: string;
  exportsDescription: string;
  exportLimit: string;
  spreadsheet: string;
  otherFormats: string;
  exportStudents: string;
  exportSpecialists: string;
  exportSafety: string;
  loading: string;
}

export const PROFESSOR_PORTAL_COPY: Record<Language, ProfessorPortalStrings> = {
  en: {
    loginTitle: 'Professor & admin sign in',
    loginDescription: 'Use your own authorized account. Professor research accounts open the research dashboard; administrative accounts open the management dashboard automatically.',
    password: 'Password', signIn: 'Sign in', checking: 'Checking access…',
    unauthorized: 'This account is not authorized to access research data.',
    portalTitle: 'Professor portal',
    overview: 'Overview',
    overviewDescription: 'Read responses, view the map or download data.',
    analytics: 'Statistics',
    analyticsDescription: 'Compare groups and explore questionnaire answers.',
    researchAccess: 'Research access',
    accessNotice: 'You can read responses, download data and save analyses. Website settings are managed by the administrator.',
    countsNotice: 'Saved responses, not unique people. Unsaved questionnaires are not counted. All versions are included by default.',
    total: 'Saved submissions', students: 'Medical students', explorers: 'Medicine explorers', specialists: 'Specialists',
    studentsCard: 'Students & explorers',
    studentsDescription: 'Read answers, views of medicine and specialty preferences. Filter by participant type.',
    specialistsCard: 'Specialists',
    specialistsDescription: 'Read specialists’ experiences and answers, including those who skipped the questionnaire.',
    mapCard: 'Participation map',
    mapDescription: 'See where participants are from. Filter by group, country, language or date.',
    mapNotice: 'Map counts protect privacy and may be delayed, so they can differ from response totals.',
    open: 'Open',
    exportsTitle: 'Download data',
    exportsDescription: 'Choose a group below, filter the responses, then download a CSV spreadsheet.',
    exportLimit: 'Up to 1,000 responses per download. Add filters if there are more.',
    spreadsheet: 'Download spreadsheet (CSV)',
    otherFormats: 'Other formats',
    exportStudents: 'Students & explorers', exportSpecialists: 'Specialists',
    exportSafety: 'Written answers may be sensitive. Keep downloads in approved, access-controlled research storage; do not share them publicly.',
    loading: 'Loading submission counts…',
  },
  fr: {
    loginTitle: 'Connexion professeur & administration',
    loginDescription: 'Utilisez votre propre compte autorisé. Les comptes de recherche ouvrent le tableau de bord du professeur ; les comptes administratifs ouvrent automatiquement l’espace de gestion.',
    password: 'Mot de passe', signIn: 'Se connecter', checking: 'Vérification de l’accès…',
    unauthorized: 'Ce compte n’est pas autorisé à accéder aux données de recherche.',
    portalTitle: 'Portail du professeur',
    overview: 'Vue d’ensemble',
    overviewDescription: 'Consultez les réponses, la carte ou téléchargez les données.',
    analytics: 'Statistiques',
    analyticsDescription: 'Comparez les groupes et explorez les réponses au questionnaire.',
    researchAccess: 'Accès recherche',
    accessNotice: 'Vous pouvez lire les réponses, télécharger les données et enregistrer des analyses. Les réglages du site sont réservés à l’administrateur.',
    countsNotice: 'Réponses enregistrées, pas personnes uniques. Les questionnaires non enregistrés ne sont pas comptés. Toutes les versions sont incluses par défaut.',
    total: 'Contributions enregistrées', students: 'Étudiants en médecine', explorers: 'Explorateurs de la médecine', specialists: 'Spécialistes',
    studentsCard: 'Étudiants & explorateurs',
    studentsDescription: 'Lisez les réponses, les regards sur la médecine et les préférences de spécialité. Filtrez par public.',
    specialistsCard: 'Spécialistes',
    specialistsDescription: 'Lisez les expériences et les réponses des spécialistes, même s’ils n’ont pas rempli le questionnaire.',
    mapCard: 'Carte de participation',
    mapDescription: 'Découvrez d’où viennent les participants. Filtrez par public, pays, langue ou date.',
    mapNotice: 'La carte protège la confidentialité et peut être mise à jour avec un délai : ses effectifs peuvent différer du total des réponses.',
    open: 'Ouvrir',
    exportsTitle: 'Télécharger les données',
    exportsDescription: 'Choisissez un groupe ci-dessous, filtrez les réponses, puis téléchargez un tableau CSV.',
    exportLimit: 'Jusqu’à 1 000 réponses par téléchargement. Ajoutez des filtres au-delà de cette limite.',
    spreadsheet: 'Télécharger le tableau (CSV)',
    otherFormats: 'Autres formats',
    exportStudents: 'Étudiants & explorateurs', exportSpecialists: 'Spécialistes',
    exportSafety: 'Les réponses écrites peuvent être sensibles. Conservez les fichiers dans un espace de recherche approuvé à accès limité, sans partage public.',
    loading: 'Chargement des effectifs…',
  },
  ro: {
    loginTitle: 'Autentificare profesor și administrator',
    loginDescription: 'Folosiți propriul cont autorizat. Conturile de cercetare deschid tabloul de bord al profesorului, iar conturile administrative deschid automat spațiul de administrare.',
    password: 'Parolă', signIn: 'Autentificare', checking: 'Se verifică accesul…',
    unauthorized: 'Acest cont nu este autorizat să acceseze datele de cercetare.',
    portalTitle: 'Portalul profesorului',
    overview: 'Prezentare generală',
    overviewDescription: 'Citiți răspunsurile, consultați harta sau descărcați datele.',
    analytics: 'Statistici',
    analyticsDescription: 'Comparați grupurile și explorați răspunsurile la chestionar.',
    researchAccess: 'Acces pentru cercetare',
    accessNotice: 'Puteți citi răspunsurile, descărca datele și salva analize. Setările site-ului sunt gestionate de administrator.',
    countsNotice: 'Sunt numărate răspunsurile salvate, nu persoanele unice. Chestionarele nesalvate nu sunt incluse. Toate versiunile sunt incluse implicit.',
    total: 'Contribuții salvate', students: 'Studenți la medicină', explorers: 'Persoane care explorează medicina', specialists: 'Specialiști',
    studentsCard: 'Studenți și exploratori',
    studentsDescription: 'Citiți răspunsurile, opiniile despre medicină și preferințele de specialitate. Filtrați după tipul participantului.',
    specialistsCard: 'Specialiști',
    specialistsDescription: 'Citiți experiențele și răspunsurile specialiștilor, inclusiv ale celor care au omis chestionarul.',
    mapCard: 'Harta participării',
    mapDescription: 'Vedeți de unde provin participanții. Filtrați după grup, țară, limbă sau dată.',
    mapNotice: 'Harta protejează confidențialitatea și poate fi actualizată cu întârziere, astfel că numerele pot diferi de totalul răspunsurilor.',
    open: 'Deschideți',
    exportsTitle: 'Descărcați datele',
    exportsDescription: 'Alegeți un grup de mai jos, filtrați răspunsurile, apoi descărcați un tabel CSV.',
    exportLimit: 'Maximum 1.000 de răspunsuri per descărcare. Adăugați filtre dacă sunt mai multe.',
    spreadsheet: 'Descărcați tabelul (CSV)',
    otherFormats: 'Alte formate',
    exportStudents: 'Studenți și exploratori', exportSpecialists: 'Specialiști',
    exportSafety: 'Răspunsurile scrise pot fi sensibile. Păstrați fișierele într-un spațiu de cercetare aprobat, cu acces controlat; nu le distribuiți public.',
    loading: 'Se încarcă numărul contribuțiilor…',
  },
};
