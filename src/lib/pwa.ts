import { Capacitor } from '@capacitor/core';

/** Optional public-shell caching. No questionnaire or research data is stored here. */
export async function registerPublicAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD || import.meta.env.BASE_URL === './' || Capacitor.isNativePlatform()
      || typeof window === 'undefined' || !window.isSecureContext
      || !('serviceWorker' in navigator)) return null;
  try {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin);
    return await navigator.serviceWorker.register(new URL('sw.js', base).href, {
      scope: base.pathname,
      updateViaCache: 'none',
    });
  } catch {
    // Unsupported/private-storage modes must not stop the questionnaire or login.
    return null;
  }
}
