/* eslint-disable react-refresh/only-export-components -- public feature provider and its hook share one contract */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchPublicFeatures } from '@/lib/supabase';
import { installMobileLifecycle } from '@/lib/mobileRuntime';

interface PublicFeaturesValue {
  publicMapEnabled: boolean;
  status: 'checking' | 'ready' | 'unavailable';
  checkedAt: number | null;
  refresh: () => Promise<void>;
  invalidate: () => void;
}

const PublicFeaturesContext = createContext<PublicFeaturesValue>({
  publicMapEnabled: false, status: 'unavailable', checkedAt: null,
  refresh: async () => undefined, invalidate: () => undefined,
});

/** In-memory only. Visibility is a short-lived server decision, never an offline entitlement. */
export function PublicFeaturesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Pick<PublicFeaturesValue, 'publicMapEnabled' | 'status' | 'checkedAt'>>({
    publicMapEnabled: false, status: 'checking', checkedAt: null,
  });
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const active = useRef(false);

  const invalidate = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
    if (active.current) setState({ publicMapEnabled: false, status: 'unavailable', checkedAt: null });
  }, []);

  const refresh = useCallback(async () => {
    invalidate();
    if (!active.current || !navigator.onLine || document.visibilityState === 'hidden') return;
    const requestId = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setState({ publicMapEnabled: false, status: 'checking', checkedAt: null });
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const data = await fetchPublicFeatures(controller.signal);
      if (active.current && requestId === generation.current && !controller.signal.aborted && navigator.onLine) {
        setState({ publicMapEnabled: data.public_map_enabled === true, status: 'ready', checkedAt: Date.now() });
      }
    } catch {
      if (active.current && requestId === generation.current) {
        setState({ publicMapEnabled: false, status: 'unavailable', checkedAt: null });
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) pending.current = null;
    }
  }, [invalidate]);

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
    let stopMobile: (() => void) | undefined;
    void installMobileLifecycle({ onResume: check, onPause: invalidate })
      .then(stop => { if (active.current) stopMobile = stop; else stop(); })
      .catch(invalidate);
    check();
    return () => {
      active.current = false;
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

  const value = useMemo(() => ({ ...state, refresh, invalidate }), [state, refresh, invalidate]);
  return <PublicFeaturesContext.Provider value={value}>{children}</PublicFeaturesContext.Provider>;
}

export function usePublicFeatures() {
  return useContext(PublicFeaturesContext);
}
