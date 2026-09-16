import { useEffect, useState } from 'react';
import type { Language } from '@/data/i18n';
import type { usePortalTestDataset } from '@/lib/usePortalTestDataset';

const EN = {
  title: 'Test dataset', live: 'Live research', test: 'Test dataset',
  description: 'A separate, reproducible demonstration: 5 specialists, 5 medical students and 5 medicine explorers. No fake responses are inserted into research tables.',
  create: 'Create test dataset', refresh: 'Check test dataset', loading: 'Checking test dataset…',
  missing: 'No test dataset is available.', error: 'The test dataset could not be verified. Retry before using it.',
  banner: 'TEST — SYNTHETIC DATA ONLY',
  warning: 'These fictional responses and exact counts are for interface testing only. They are not research evidence and must never calibrate the real model.',
  blocked: 'Test view paused: verify or create a test dataset, or explicitly switch to live research.',
  locked: 'Configuration editing and publication are disabled in test mode. Switch to live research to manage the real catalog.',
  delete: 'Delete this test dataset', confirm: 'Type the dataset ID to confirm deletion',
  deleteHelp: 'Only this synthetic recipe will be removed. Real research responses are never deleted.',
  id: 'Dataset ID', created: 'Created', manage: 'Manage / delete test dataset',
};
type Copy = typeof EN;
// eslint-disable-next-line react-refresh/only-export-components -- immutable translations shared with the detail modal
export const PORTAL_TEST_COPY: Record<Language, Copy> = {
  en: EN,
  fr: {
    title: 'Jeu de test', live: 'Recherche réelle', test: 'Jeu de test',
    description: 'Une démonstration séparée et reproductible : 5 spécialistes, 5 étudiants en médecine et 5 personnes découvrant la médecine. Aucune fausse réponse n’est insérée dans les tables de recherche.',
    create: 'Créer le jeu de test', refresh: 'Vérifier le jeu de test', loading: 'Vérification du jeu de test…',
    missing: 'Aucun jeu de test disponible.', error: 'Le jeu de test n’a pas pu être vérifié. Réessayez avant de l’utiliser.',
    banner: 'TEST — DONNÉES UNIQUEMENT SYNTHÉTIQUES',
    warning: 'Ces réponses fictives et effectifs exacts servent uniquement à tester l’interface. Ce ne sont pas des données de recherche et ils ne doivent jamais calibrer le modèle réel.',
    blocked: 'Vue de test suspendue : vérifiez ou créez un jeu de test, ou repassez explicitement à la recherche réelle.',
    locked: 'La modification et la publication du catalogue sont désactivées en mode test. Repassez à la recherche réelle pour gérer le catalogue réel.',
    delete: 'Supprimer ce jeu de test', confirm: 'Saisissez l’identifiant du jeu pour confirmer sa suppression',
    deleteHelp: 'Seule cette recette synthétique sera supprimée. Les réponses réelles de recherche ne sont jamais supprimées.',
    id: 'Identifiant du jeu', created: 'Créé le', manage: 'Gérer / supprimer le jeu de test',
  },
  ro: {
    title: 'Set de test', live: 'Cercetare reală', test: 'Set de test',
    description: 'O demonstrație separată și reproductibilă: 5 specialiști, 5 studenți la medicină și 5 persoane care explorează medicina. Nu sunt introduse răspunsuri fictive în tabelele de cercetare.',
    create: 'Creează setul de test', refresh: 'Verifică setul de test', loading: 'Se verifică setul de test…',
    missing: 'Nu există un set de test disponibil.', error: 'Setul de test nu a putut fi verificat. Reîncearcă înainte de utilizare.',
    banner: 'TEST — NUMAI DATE SINTETICE',
    warning: 'Aceste răspunsuri fictive și numărători exacte servesc numai testării interfeței. Nu sunt dovezi de cercetare și nu trebuie să calibreze niciodată modelul real.',
    blocked: 'Vizualizarea de test este suspendată: verifică sau creează un set de test ori revino explicit la cercetarea reală.',
    locked: 'Editarea și publicarea catalogului sunt dezactivate în modul de test. Revino la cercetarea reală pentru a administra catalogul real.',
    delete: 'Șterge acest set de test', confirm: 'Introdu identificatorul setului pentru a confirma ștergerea',
    deleteHelp: 'Va fi eliminată numai această rețetă sintetică. Răspunsurile reale de cercetare nu sunt niciodată șterse.',
    id: 'Identificatorul setului', created: 'Creat la', manage: 'Administrează / șterge setul de test',
  },
};

export default function PortalTestDataPanel({ lang, manager }: { lang: Language; manager: ReturnType<typeof usePortalTestDataset> }) {
  const copy = PORTAL_TEST_COPY[lang];
  const [confirmation, setConfirmation] = useState('');
  const { dataset, mode, busy, error } = manager;
  useEffect(() => setConfirmation(''), [dataset?.id]);
  return <section data-portal-test-panel className="mb-6 min-w-0 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
    <h2 className="text-base font-semibold text-ink-900">{copy.title}</h2>
    <p className="mt-2 text-sm leading-6 text-ink-600">{copy.description}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" data-portal-data-mode="live" aria-pressed={mode === 'live'} disabled={busy} onClick={() => manager.selectMode('live')} className="min-h-11 rounded-full border border-ink-200 bg-white px-4 text-sm font-semibold disabled:opacity-40">{copy.live}</button>
      <button type="button" data-portal-data-mode="test" aria-pressed={mode === 'test'} disabled={!dataset || busy} onClick={() => manager.selectMode('test')} className="min-h-11 rounded-full border border-amber-300 bg-white px-4 text-sm font-semibold disabled:opacity-40">{copy.test}</button>
      <button type="button" disabled={busy} onClick={() => void manager.refresh()} className="min-h-11 rounded-full px-4 text-sm font-semibold text-ink-600 disabled:opacity-40">{copy.refresh}</button>
      {!dataset && <button type="button" disabled={busy} onClick={() => void manager.create()} className="min-h-11 rounded-full bg-brand-800 px-4 text-sm font-semibold text-white disabled:opacity-40">{copy.create}</button>}
    </div>
    {busy && <p role="status" className="mt-3 text-sm text-ink-600">{copy.loading}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{copy.error}</p>}
    {!dataset && !busy && !error && <p className="mt-3 text-sm text-ink-600">{copy.missing}</p>}
    {dataset && <details className="mt-4 min-w-0 text-sm">
      <summary className="cursor-pointer font-medium">{copy.manage}</summary>
      <p className="mt-2 break-all">{copy.id}: {dataset.id}</p>
      <p className="mt-2">{copy.created}: {new Date(dataset.created_at).toLocaleString(lang)}</p>
      <p className="mt-3 text-ink-600">{copy.deleteHelp}</p>
      <label htmlFor="portal-test-delete-confirmation" className="mt-3 block font-medium">{copy.confirm}</label>
      <input id="portal-test-delete-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-ink-200 bg-white px-3" />
      <button type="button" data-delete-portal-test-dataset disabled={busy || confirmation !== dataset.id} onClick={() => void manager.remove(confirmation)} className="mt-3 min-h-11 rounded-full border border-red-200 bg-white px-4 font-semibold text-red-700 disabled:opacity-40">{copy.delete}</button>
    </details>}
    {mode === 'test' && <div data-portal-test-banner role="status" className="mt-4 rounded-xl border-2 border-amber-500 bg-amber-100 p-4 text-amber-950"><p className="font-bold">{copy.banner}</p><p className="mt-1 text-sm leading-6">{copy.warning}</p>{!dataset && <p className="mt-2 font-medium">{copy.blocked}</p>}</div>}
  </section>;
}
