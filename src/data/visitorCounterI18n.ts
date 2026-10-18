import type { Language } from '@/data/i18n';

interface VisitorCounterCopy {
  label: string;
  loading: string;
  unavailable: string;
  retry: string;
}

export const VISITOR_COUNTER_COPY: Record<Language, VisitorCounterCopy> = {
  en: {
    label: 'Recorded visits',
    loading: 'Loading count…',
    unavailable: 'Count unavailable',
    retry: 'Try again',
  },
  fr: {
    label: 'Visites enregistrées',
    loading: 'Chargement du compteur…',
    unavailable: 'Compteur indisponible',
    retry: 'Réessayer',
  },
  ro: {
    label: 'Vizite înregistrate',
    loading: 'Se încarcă numărul de vizite…',
    unavailable: 'Număr indisponibil',
    retry: 'Încercați din nou',
  },
};
