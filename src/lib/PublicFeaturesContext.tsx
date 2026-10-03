/* eslint-disable react-refresh/only-export-components -- public feature provider and its hook share one contract */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchPublicFeatures, setPublicMapEnabled, PublicFeaturesError, type PublicFeaturesIssue } from '@/lib/supabase';
import { installMobileLifecycle } from '@/lib/mobileRuntime';

interface PublicFeaturesValue {
  publicMapEnabled: boolean;
  status: 'checking' | 'ready' | 'unavailable';
  issue: PublicFeaturesIssue | null;
  checkedAt: number | null;
  saving: boolean;
  saveMapVisibility: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  invalidate: () => void;
}

const PublicFeaturesContext = createContext<PublicFeaturesValue>({
  publicMapEnabled: false, status: 'unavailable', issue: 'unavailable', checkedAt: null,
  saving: false, saveMapVisibility: async () => { throw new PublicFeaturesError('unavailable'); },
  refresh: async () => undefined, invalidate: () => undefined,
});

/** In-memory only. Visibility is a short-lived server decision, never an offline entitlement. */
export function PublicFeaturesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Pick<PublicFeaturesValue, 'publicMapEnabled' | 'status' | 'issue' | 'checkedAt'>>({
    publicMapEnabled: false, status: 'checking', issue: null, checkedAt: null,
  });
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const active = useRef(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const invalidate = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
    if (active.current) setState({ publicMapEnabled: false, status: 'unavailable', issue: 'unavailable', checkedAt: null });
  }, []);

  const refresh = useCallback(async () => {
    invalidate();
    if (!active.current || !navigator.onLine || document.visibilityState === 'hidden') return;
    const requestId = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setState({ publicMapEnabled: false, status: 'checking', issue: null, checkedAt: null });
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const data = await fetchPublicFeatures(controller.signal);
      if (active.current && requestId === generation.current && !controller.signal.aborted && navigator.onLine) {
        setState({ publicMapEnabled: data.public_map_enabled === true, status: 'ready', issue: null, checkedAt: Date.now() });
      }
    } catch (error) {
      if (active.current && requestId === generation.current) {
        setState({ publicMapEnabled: false, status: 'unavailable', issue: error instanceof PublicFeaturesError ? error.issue : 'unavailable', checkedAt: null });
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) pending.current = null;
    }
  }, [invalidate]);

  // Keep the write lock above dashboard navigation and session revalidation.
  const saveMapVisibility = useCallback(async (enabled: boolean) => {
    if (!active.current || savingRef.current) throw new PublicFeaturesError('unavailable');
    savingRef.current = true;
    setSaving(true);
    invalidate();
    try {
      const saved = await setPublicMapEnabled(enabled);
      if (saved.public_map_enabled !== enabled) throw new PublicFeaturesError('unavailable');
    } finally {
      try {
        await refresh();
      } finally {
        savingRef.current = false;
        if (active.current) setSaving(false);
      }
    }
  }, [invalidate, refresh]);

  useEffect(() => {
    active.current = true;
    const check = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') invalidate(); else check(); };
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    window.addEventListener('offline', invalidate);
    window.addEventListener('pageshow', check);
    window.addEventListener('pagehide', invalidate);
    document.addEventListener('visibilitychange', onVisibility);
    // Notice cross-device administrator changes even while this tab stays open.
    const interval = window.setInterval(check, 30_000);
    let disposed = false;
    let stopMobile: (() => void) | undefined;
    void installMobileLifecycle({ onResume: check, onPause: invalidate })
      .then(stop => { if (!disposed) stopMobile = stop; else stop(); })
      .catch(() => { if (!disposed) invalidate(); });
    check();
    return () => {
      active.current = false;
      disposed = true;
      invalidate();
      clearInterval(interval);
      stopMobile?.();
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', invalidate);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('pagehide', invalidate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [invalidate, refresh]);

  const value = useMemo(() => ({ ...state, saving, saveMapVisibility, refresh, invalidate }), [state, saving, saveMapVisibility, refresh, invalidate]);
  return <PublicFeaturesContext.Provider value={value}>{children}</PublicFeaturesContext.Provider>;
}

export function usePublicFeatures() {
  return useContext(PublicFeaturesContext);
}
