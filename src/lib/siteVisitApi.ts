import { supabase } from '@/lib/supabase';
import { createSiteVisitCounter } from '@/lib/siteVisitCounter';

export const siteVisitCounter = createSiteVisitCounter({
  environment: () => ({
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    webdriver: navigator.webdriver,
    globalPrivacyControl: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
    doNotTrack: navigator.doNotTrack,
    windowDoNotTrack: (window as Window & { doNotTrack?: string }).doNotTrack,
  }),
  storage: () => window.sessionStorage,
  randomUUID: () => globalThis.crypto?.randomUUID?.() ?? null,
  now: Date.now,
  read: async signal => {
    if (!supabase) throw new Error('Visit count unavailable');
    const { data, error } = await supabase.rpc('get_site_visit_count').abortSignal(signal);
    if (error) throw new Error('Visit count unavailable');
    return data;
  },
  register: async (visitId, signal) => {
    if (!supabase) throw new Error('Visit count unavailable');
    const { data, error } = await supabase.rpc('register_site_visit', { p_visit_id: visitId }).abortSignal(signal);
    if (error) throw new Error('Visit count unavailable');
    return data;
  },
});
