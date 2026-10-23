import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { communityApi, CommunityError, COMMUNITY_FEATURE_ENABLED } from './community';
import { communityAccountRedirect } from './communityAuthRedirect';

interface CommunityAuth {
  user: User | null; loading: boolean; recovery: boolean; enabled: boolean;
  statusLoading: boolean; error: string | null;
  refreshStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<CommunityAuth | null>(null);
function client() {
  if (!supabase || !COMMUNITY_FEATURE_ENABLED) throw new CommunityError('setup');
  return supabase;
}
function authError(error: { code?: string } | null): void {
  if (!error) return;
  // Never expose raw provider messages/emails or account-existence details.
  throw new CommunityError(error.code?.includes('rate_limit') ? 'limit' : 'access');
}
function validatePassword(password: string) {
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) throw new CommunityError('invalid');
}
export function CommunityAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(COMMUNITY_FEATURE_ENABLED);
  const [recovery, setRecovery] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [statusLoading, setStatusLoading] = useState(COMMUNITY_FEATURE_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const statusGeneration = useRef(0);
  const identity = useRef<string | null>(null);
  const identityGeneration = useRef(0);
  const invalidateStatus = useCallback(() => { statusGeneration.current++; }, []);
  const refreshStatus = useCallback(async () => {
    if (!COMMUNITY_FEATURE_ENABLED) return;
    const generation = ++statusGeneration.current;
    setStatusLoading(true);
    try {
      const status = await communityApi.status();
      if (generation === statusGeneration.current) { setEnabled(status.enabled); setError(null); }
    } catch {
      if (generation === statusGeneration.current) { setEnabled(false); setError('community:unavailable'); }
    } finally { if (generation === statusGeneration.current) setStatusLoading(false); }
  }, []);
  useEffect(() => {
    if (!COMMUNITY_FEATURE_ENABLED) return;
    void refreshStatus();
    return invalidateStatus;
  }, [refreshStatus, invalidateStatus]);
  useEffect(() => {
    if (!COMMUNITY_FEATURE_ENABLED || !supabase) { setLoading(false); return; }
    let active = true;
    let revision = 0;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      revision++;
      const nextIdentity = session?.user.id ?? null;
      if (identity.current !== nextIdentity) {
        identity.current = nextIdentity;
        identityGeneration.current++;
        setRecovery(false);
      }
      // This is presentation state only. Every community RPC rechecks the real
      // user/session and permissions in Postgres; client metadata grants nothing.
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setLoading(false);
    });
    const initialRevision = revision;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && revision === initialRevision) {
        identity.current = data.user?.id ?? null;
        identityGeneration.current++;
        setUser(data.user); setLoading(false);
      }
    }).catch(() => { if (active && revision === initialRevision) { setUser(null); setLoading(false); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const requireEnabled = () => { if (!enabled) throw new CommunityError('setup'); };
  const value: CommunityAuth = {
    user, loading, recovery, enabled, statusLoading, error, refreshStatus,
    signIn: async (email, password) => {
      const { error: failure } = await client().auth.signInWithPassword({ email: email.trim(), password });
      authError(failure);
    },
    signUp: async (email, password) => {
      requireEnabled(); validatePassword(password);
      const { error: failure } = await client().auth.signUp({ email: email.trim(), password,
        options: { emailRedirectTo: communityAccountRedirect() } });
      authError(failure);
    },
    sendRecovery: async email => {
      const { error: failure } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: communityAccountRedirect(true) });
      authError(failure);
    },
    resendConfirmation: async email => {
      requireEnabled();
      const { error: failure } = await client().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: communityAccountRedirect() } });
      authError(failure);
    },
    updatePassword: async password => {
      validatePassword(password);
      const expectedIdentity = user?.id;
      const generation = identityGeneration.current;
      const { data, error: checkError } = await client().auth.getUser();
      if (checkError || !expectedIdentity || data.user?.id !== expectedIdentity
        || identity.current !== expectedIdentity || identityGeneration.current !== generation) throw new CommunityError('access');
      const { error: failure } = await client().auth.updateUser({ password });
      authError(failure);
      if (identity.current !== expectedIdentity || identityGeneration.current !== generation) throw new CommunityError('access');
      setRecovery(false);
    },
    signOut: async () => {
      // Do not pretend sign-out succeeded if revocation fails: the SDK may
      // retain its persisted session on a network error. Keep the error/retry
      // visible; successful SIGNED_OUT clears all identity-keyed content.
      const { error: failure } = await client().auth.signOut({ scope: 'local' });
      authError(failure);
      setUser(null); setRecovery(false);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCommunityAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('CommunityAuthProvider is required');
  return value;
}
