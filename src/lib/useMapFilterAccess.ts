import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Only the server's enabled portal profile grants access, never participant selection or JWT metadata. */
export function canUseMapFilters(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const role = profile.portal_role ?? profile.role;
  return profile.authorized === true
    && (role === 'researcher' || role === 'doctor' || role === 'professor');
}

export function useMapFilterAccess(enabled = true) {
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const recheckAccess = useCallback(() => {
    generation.current += 1;
    setAccessKey(null);
    setRevision(value => value + 1);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const invalidate = () => {
      generation.current += 1;
      controller?.abort();
      setAccessKey(null);
      return generation.current;
    };
    const verify = async () => {
      const request = invalidate();
      const abort = new AbortController();
      controller = abort;
      const timeout = setTimeout(() => abort.abort(), 10_000);
      try {
        // The session only determines whether to ask the server; it is not proof of a role.
        const { data, error } = await client.auth.getSession();
        if (!active || request !== generation.current || abort.signal.aborted || error || !data.session) return;
        const profile = await client.rpc('current_user_portal_profile').abortSignal(abort.signal);
        if (active && request === generation.current && !abort.signal.aborted
          && !profile.error && canUseMapFilters(profile.data)) {
          setAccessKey(`${data.session.user.id}:${request}`);
        }
      } catch {
        // Fail closed: private aggregates must never fall back to a public route.
      } finally {
        clearTimeout(timeout);
      }
    };
    const scheduleVerification = () => {
      invalidate();
      clearTimeout(timer);
      // Supabase RPCs must run outside the auth callback's session lock.
      timer = setTimeout(() => { if (active) void verify(); }, 0);
    };
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        clearTimeout(timer);
        invalidate();
      } else {
        scheduleVerification();
      }
    });
    void verify();
    window.addEventListener('focus', scheduleVerification);
    return () => {
      active = false;
      generation.current += 1;
      controller?.abort();
      clearTimeout(timer);
      listener.subscription.unsubscribe();
      window.removeEventListener('focus', scheduleVerification);
    };
  }, [revision, enabled]);

  return { accessKey, recheckAccess };
}
