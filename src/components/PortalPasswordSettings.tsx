import { useEffect, useRef, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { supabase } from '@/lib/supabase';

const COPY = {
  en: {
    title: 'Change my password',
    help: 'Replace your initial password with your own. Use at least 12 characters. After saving, sign in again with the new password. This changes only your account.',
    password: 'New password', confirm: 'Confirm new password', save: 'Save password and sign out',
    saving: 'Saving…', mismatch: 'Enter the same password in both fields.',
    failed: 'The password could not be changed. Sign in again and retry, or contact the project administrator.',
  },
  fr: {
    title: 'Changer mon mot de passe',
    help: 'Remplacez votre mot de passe initial par un mot de passe personnel d’au moins 12 caractères. Après l’enregistrement, reconnectez-vous avec le nouveau mot de passe. Seul votre compte est modifié.',
    password: 'Nouveau mot de passe', confirm: 'Confirmer le nouveau mot de passe', save: 'Enregistrer et se déconnecter',
    saving: 'Enregistrement…', mismatch: 'Saisissez le même mot de passe dans les deux champs.',
    failed: 'Le mot de passe n’a pas pu être modifié. Reconnectez-vous et réessayez, ou contactez l’administrateur du projet.',
  },
  ro: {
    title: 'Schimbă parola mea',
    help: 'Înlocuiți parola inițială cu una personală de cel puțin 12 caractere. După salvare, autentificați-vă din nou cu noua parolă. Se modifică doar contul dumneavoastră.',
    password: 'Parolă nouă', confirm: 'Confirmați parola nouă', save: 'Salvează parola și deconectează-te',
    saving: 'Se salvează…', mismatch: 'Introduceți aceeași parolă în ambele câmpuri.',
    failed: 'Parola nu a putut fi schimbată. Autentificați-vă din nou și reîncercați sau contactați administratorul proiectului.',
  },
};

export default function PortalPasswordSettings({ identity }: { identity: string }) {
  const { lang } = useLanguage();
  const copy = COPY[lang];
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !supabase || password.length < 12) return;
    if (password !== confirmation) { setError(copy.mismatch); return; }
    const client = supabase;
    setBusy(true);
    setError(null);
    try {
      // Revalidate the authenticated identity; never accept an email/user id from the form.
      const { data, error: identityError } = await client.auth.getUser();
      if (!active.current) return;
      if (identityError || data.user?.id !== identity) throw new Error('Identity changed');
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      // USER_UPDATED can remount the workspace during the profile recheck.
      // Complete the intended sign-out, but never sign out a different account.
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session?.user.id === identity) await client.auth.signOut({ scope: 'local' });
    } catch {
      if (active.current) setError(copy.failed);
    } finally {
      if (active.current) { setPassword(''); setConfirmation(''); setBusy(false); }
    }
  };

  return <details data-portal-password-settings className="mt-5 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-ink-800">
      <KeyRound className="mr-2 inline h-4 w-4" aria-hidden="true" />{copy.title}
    </summary>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">{copy.help}</p>
    <form onSubmit={event => void submit(event)} className="mt-4 grid max-w-xl gap-4">
      <label className="text-sm font-medium text-ink-700">{copy.password}
        <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}
          value={password} onChange={event => setPassword(event.target.value)}
          className="mt-1 block min-h-12 w-full rounded-xl border border-ink-200 px-3 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label className="text-sm font-medium text-ink-700">{copy.confirm}
        <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}
          value={confirmation} onChange={event => setConfirmation(event.target.value)}
          className="mt-1 block min-h-12 w-full rounded-xl border border-ink-200 px-3 focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-brand-800 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50">
        {busy ? copy.saving : copy.save}
      </button>
    </form>
  </details>;
}
