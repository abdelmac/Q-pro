import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, ShieldCheck, UserRound } from 'lucide-react';
import { useCommunityAuth } from '@/lib/CommunityAuthContext';
import { communityApi, COMMUNITY_TERMS_VERSION, type CommunityProfile } from '@/lib/community';
import { useLanguage } from '@/lib/LanguageContext';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import { translateSpecialtyName } from '@/data/i18n';
import { countryOptions } from '@/data/geography';
import { COMMUNITY_COPY } from '@/data/communityI18n';
import CommunityShell, { CARD, FIELD, PRIMARY, SECONDARY } from './CommunityShell';
import OwnComments from './OwnComments';

type AuthMode = 'login' | 'signup' | 'recover' | 'resend';

export default function AccountPage({ onBack, onHome }: { onBack: () => void; onHome: () => void }) {
  const { lang } = useLanguage();
  const auth = useCommunityAuth();
  const copy = COMMUNITY_COPY[lang];
  const [passwordChanged, setPasswordChanged] = useState(false);
  useEffect(() => { setPasswordChanged(false); }, [auth.user?.id]);
  return <CommunityShell title={copy.account} onBack={onBack} onHome={onHome}>
    {passwordChanged && <p role="status" className="mb-5 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">{copy.passwordSaved}</p>}
    <p className="mb-5 max-w-3xl text-xs leading-6 text-ink-500">{copy.sessionPrivacy}</p>
    {auth.loading ? <p role="status">{copy.loading}</p> : <AccountContent key={auth.user?.id ?? 'guest'} onGuest={onBack} onPasswordSaved={() => setPasswordChanged(true)} />}
  </CommunityShell>;
}

function AccountContent({ onGuest, onPasswordSaved }: { onGuest: () => void; onPasswordSaved: () => void }) {
  const auth = useCommunityAuth();
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const active = useRef(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setPassword(''); setConfirmation(''); setConsent(false); setError(null); setMessage(null); setMode('login'); }, [auth.recovery]);

  const changeMode = (next: AuthMode) => {
    setMode(next); setPassword(''); setConfirmation(''); setConsent(false); setError(null); setMessage(null);
  };
  const newPassword = auth.recovery || mode === 'signup';
  const needsPassword = auth.recovery || mode === 'login' || mode === 'signup';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || (mode === 'signup' && (!auth.enabled || !consent))) return;
    if (newPassword && password !== confirmation) { setError(copy.passwordMismatch); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      if (auth.recovery) { await auth.updatePassword(password); if (active.current) onPasswordSaved(); }
      else if (mode === 'login') await auth.signIn(email.trim(), password);
      else if (mode === 'signup') await auth.signUp(email.trim(), password);
      else if (mode === 'recover') await auth.sendRecovery(email.trim());
      else await auth.resendConfirmation(email.trim());
      if (active.current) {
        setPassword(''); setConfirmation(''); setConsent(false);
        if (mode !== 'login' || auth.recovery) setMessage(auth.recovery ? copy.passwordSaved : copy.emailSent);
      }
    } catch {
      if (active.current) { setError(mode === 'login' && !auth.recovery ? copy.signinFailed : copy.failed); setPassword(''); setConfirmation(''); }
    } finally { if (active.current) setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true); setError(null);
    try { await auth.signOut(); } catch { if (active.current) setError(copy.failed); }
    finally { if (active.current) setBusy(false); }
  };

  if (auth.user && !auth.recovery) return <div className="space-y-5">
    <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
      <p className="min-w-0 break-all text-sm text-ink-700"><UserRound className="mr-2 inline h-4 w-4" aria-hidden="true" />{copy.signedIn} <span className="font-semibold">{auth.user.email}</span></p>
      <button type="button" disabled={busy} className={SECONDARY} onClick={() => void signOut()}>{copy.signout}</button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </div>
    {!auth.enabled && <FeatureUnavailable />}
    <ProfileSettings key={auth.user.id} />
    <button type="button" onClick={onGuest} className={SECONDARY}>{copy.back}</button>
  </div>;

  return <div className="mx-auto max-w-xl space-y-5">
    {!auth.enabled && !auth.recovery && <FeatureUnavailable />}
    <section className={CARD}>
      {!auth.recovery && <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" disabled={busy} aria-pressed={mode === 'login'} className={mode === 'login' ? PRIMARY : SECONDARY} onClick={() => changeMode('login')}>{copy.login}</button>
        <button type="button" disabled={busy || !auth.enabled} aria-pressed={mode === 'signup'} className={mode === 'signup' ? PRIMARY : SECONDARY} onClick={() => changeMode('signup')}>{copy.signup}</button>
      </div>}
      <form onSubmit={event => void submit(event)} className="space-y-5">
        <h2 className="text-xl font-semibold text-ink-900">{auth.recovery ? copy.newPassword : copy[mode === 'recover' ? 'recover' : mode === 'resend' ? 'resend' : mode]}</h2>
        {!auth.recovery && <label className="block text-sm font-medium text-ink-700">{copy.email}
          <input className={FIELD} type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
        </label>}
        {needsPassword && <label className="block text-sm font-medium text-ink-700">{copy.password}
          <input className={FIELD} type="password" autoComplete={newPassword ? 'new-password' : 'current-password'} minLength={newPassword ? 12 : 1} maxLength={128} pattern={newPassword ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}' : undefined} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby={newPassword ? 'community-password-help' : undefined} />
        </label>}
        {newPassword && <>
          <p id="community-password-help" className="text-xs leading-5 text-ink-500">{copy.passwordHelp}</p>
          <label className="block text-sm font-medium text-ink-700">{copy.confirmPassword}
            <input className={FIELD} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
          </label>
        </>}
        {mode === 'signup' && !auth.recovery && <label className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-ink-700">
          <input type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-brand-800" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} />{copy.signupConsent}
        </label>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{message}</p>}
        <button type="submit" className={`${PRIMARY} w-full`} disabled={busy || (mode === 'signup' && (!consent || !auth.enabled))}>{busy ? copy.busy : auth.recovery ? copy.updatePassword : copy[mode === 'recover' ? 'recover' : mode === 'resend' ? 'resend' : mode]}</button>
      </form>
      {!auth.recovery && <div className="mt-5 flex flex-col items-start gap-1">
        <button type="button" className="min-h-11 text-left text-sm text-brand-800 underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => changeMode('recover')}>{copy.forgot}</button>
        <button type="button" className="min-h-11 text-left text-sm text-brand-800 underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => changeMode('resend')}>{copy.resend}</button>
      </div>}
    </section>
    <button type="button" className={`${SECONDARY} w-full`} onClick={onGuest} disabled={busy}>{copy.guest}</button>
  </div>;
}

function FeatureUnavailable() {
  const { lang } = useLanguage();
  const { statusLoading, refreshStatus } = useCommunityAuth();
  const copy = COMMUNITY_COPY[lang];
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
    <p>{copy.unavailable}</p><button type="button" className={`${SECONDARY} mt-3`} disabled={statusLoading} onClick={() => void refreshStatus().catch(() => undefined)}>{statusLoading ? copy.loading : copy.refresh}</button>
  </div>;
}

function ProfileSettings() {
  const { lang } = useLanguage();
  const { enabled } = useCommunityAuth();
  const copy = COMMUNITY_COPY[lang];
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [mapRemoved, setMapRemoved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false); setFailed(false);
    void communityApi.profile(controller.signal).then(value => { if (!controller.signal.aborted) { setProfile(value); setLoaded(true); } })
      .catch(() => { if (!controller.signal.aborted) { setFailed(true); setLoaded(true); } });
    return () => controller.abort();
  }, [revision]);
  if (!loaded) return <p role="status">{copy.loading}</p>;
  if (failed) return <div className={CARD}><p role="alert">{copy.failed}</p><button className={`${SECONDARY} mt-3`} onClick={() => setRevision(value => value + 1)}>{copy.refresh}</button></div>;
  if (!profile && !enabled) return null;
  return <>
    {profile?.suspended && <p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{copy.suspended}</p>}
    {!enabled || profile?.suspended ? <section className={CARD}>
      <h2 className="text-xl font-semibold text-ink-900">{copy.profile}</h2>
      {profile && <p className="mt-3 text-sm text-ink-600">{copy[profile.role]}{profile.specialty ? ` · ${translateSpecialtyName(profile.specialty, lang)}` : ''}</p>}
    </section> : <ProfileForm key={revision} initial={profile} onSaved={setProfile} />}
    {profile && (profile.country_code !== null || profile.map_consent) && <MapWithdrawal onWithdrawn={() => { setMapRemoved(true); setRevision(value => value + 1); }} />}
    {mapRemoved && <p role="status" className="mt-4 text-sm text-brand-800">{copy.countryRemoved}</p>}
    {profile && <OwnComments />}
  </>;
}

function MapWithdrawal({ onWithdrawn }: { onWithdrawn: () => void }) {
  const { lang } = useLanguage();
  const copy = COMMUNITY_COPY[lang];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const withdraw = async () => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try { await communityApi.withdrawMapConsent(); if (active.current) onWithdrawn(); }
    catch { if (active.current) setFailed(true); }
    finally { if (active.current) setBusy(false); }
  };
  return <div className="mt-4"><button type="button" className={SECONDARY} disabled={busy} onClick={() => void withdraw()}>{busy ? copy.busy : copy.removeCountry}</button>{failed && <p role="alert" className="mt-3 text-sm text-red-700">{copy.failed}</p>}</div>;
}

function ProfileForm({ initial, onSaved }: { initial: CommunityProfile | null; onSaved: (value: CommunityProfile) => void }) {
  const { lang } = useLanguage();
  const { specialties } = useSpecialtyCatalog();
  const copy = COMMUNITY_COPY[lang];
  const active = useRef(true);
  const [role, setRole] = useState<CommunityProfile['role']>(initial?.role ?? 'curious');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [country, setCountry] = useState(initial?.country_code ?? '');
  const [mapConsent, setMapConsent] = useState(initial?.map_consent ?? false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !consent || (role === 'specialist' && !specialty)) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      await communityApi.saveProfile({ role, specialty: role === 'specialist' ? specialty : null, country_code: country || null, map_consent: Boolean(country && mapConsent), terms_version: COMMUNITY_TERMS_VERSION });
      if (!active.current) return;
      const fresh = await communityApi.profile();
      if (!fresh) throw new Error('Profile unavailable');
      if (active.current && fresh) { onSaved(fresh); setSaved(true); setConsent(false); }
    } catch { if (active.current) setError(true); }
    finally { if (active.current) setBusy(false); }
  };
  return <section className={CARD}>
    <h2 className="text-xl font-semibold text-ink-900">{copy.profile}</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">{copy.profileHelp}</p>
    {initial?.role === 'specialist' && <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-800"><ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />{initial.verified ? copy.verified : copy.awaitingVerification}</p>}
    <form onSubmit={event => void submit(event)} className="mt-6 space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        <label className="block text-sm font-medium text-ink-700">{copy.role}
          <select className={FIELD} value={role} onChange={event => { setRole(event.target.value as CommunityProfile['role']); setSpecialty(''); setSaved(false); }}>
            <option value="curious">{copy.curious}</option><option value="student">{copy.student}</option><option value="specialist">{copy.specialist}</option>
          </select>
        </label>
        {role === 'specialist' && <><label className="block text-sm font-medium text-ink-700">{copy.specialty}
          <select className={FIELD} required value={specialty} onChange={event => setSpecialty(event.target.value)}><option value="">{copy.chooseSpecialty}</option>{specialties.map(item => <option key={item.name} value={item.name}>{translateSpecialtyName(item.name, lang)}</option>)}</select>
        </label><p className="text-xs leading-5 text-ink-500">{copy.verificationHelp}</p></>}
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <label className="block text-sm font-medium text-ink-700">{copy.country}
            <select className={FIELD} value={country} onChange={event => { setCountry(event.target.value); setMapConsent(false); }}><option value="">{copy.noCountry}</option>{countryOptions(lang).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
          </label>
          <p className="mt-3 text-xs leading-5 text-ink-600">{copy.mapHelp}</p>
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-ink-700"><input className="mt-1 h-5 w-5 shrink-0 accent-brand-800" type="checkbox" checked={mapConsent} disabled={!country || busy} onChange={event => setMapConsent(event.target.checked)} />{copy.mapConsent}</label>
        </div>
        <label className="flex items-start gap-3 text-sm leading-6 text-ink-700"><input className="mt-1 h-5 w-5 shrink-0 accent-brand-800" type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />{copy.membership}</label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{copy.failed}</p>}
      {saved && <p role="status" className="flex items-center gap-2 text-sm text-brand-800"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />{copy.profileSaved}</p>}
      <button type="submit" className={PRIMARY} disabled={busy || !consent || (role === 'specialist' && !specialty)}>{busy ? copy.busy : copy.saveProfile}</button>
    </form>
  </section>;
}
