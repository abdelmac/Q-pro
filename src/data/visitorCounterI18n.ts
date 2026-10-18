import type { Language } from '@/data/i18n';

interface VisitorCounterCopy {
  label: string;
  since: string;
  loading: string;
  unavailable: string;
  retry: string;
  details: string;
  explanation: string;
}

export const VISITOR_COUNTER_COPY: Record<Language, VisitorCounterCopy> = {
  en: {
    label: 'Recorded visits',
    since: 'Since',
    loading: 'Loading count…',
    unavailable: 'Count unavailable',
    retry: 'Try again',
    details: 'About this count',
    explanation: 'This is an approximate count of browser visits, not unique people or completed questionnaires. It starts when the counter is activated; earlier visits are not included. A temporary random identifier helps avoid counting refreshes again in the same tab for up to 24 hours. No questionnaire answers are sent by this counter. Visits with Do Not Track or Global Privacy Control enabled are not counted.',
  },
  fr: {
    label: 'Visites enregistrées',
    since: 'Depuis le',
    loading: 'Chargement du compteur…',
    unavailable: 'Compteur indisponible',
    retry: 'Réessayer',
    details: 'À propos du compteur',
    explanation: 'Il s’agit d’un nombre approximatif de visites du navigateur, et non de personnes uniques ou de questionnaires remplis. Le décompte commence à l’activation du compteur ; les visites antérieures ne sont pas incluses. Un identifiant aléatoire temporaire aide à ne pas recompter les actualisations dans le même onglet pendant 24 heures au maximum. Ce compteur n’envoie aucune réponse au questionnaire. Les visites avec Do Not Track ou Global Privacy Control activé ne sont pas comptées.',
  },
  ro: {
    label: 'Vizite înregistrate',
    since: 'Din',
    loading: 'Se încarcă numărul de vizite…',
    unavailable: 'Număr indisponibil',
    retry: 'Încercați din nou',
    details: 'Despre acest număr',
    explanation: 'Acesta este un număr aproximativ de vizite în browser, nu de persoane distincte sau de chestionare completate. Numărătoarea începe la activarea contorului; vizitele anterioare nu sunt incluse. Un identificator aleatoriu temporar ajută la evitarea renumărării reîncărcărilor în aceeași filă, timp de cel mult 24 de ore. Acest contor nu trimite răspunsuri la chestionar. Vizitele cu Do Not Track sau Global Privacy Control activat nu sunt numărate.',
  },
};
