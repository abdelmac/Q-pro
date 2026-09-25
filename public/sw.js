/* Public code cache only. No background research upload and no answer storage. */
const PRECACHE = null; // Replaced only by the production build.
const scopeUrl = new URL(self.registration.scope);
const cachePrefix = `qpro-public-shell:${scopeUrl.pathname}:`;
const cacheName = `${cachePrefix}${PRECACHE?.version ?? 'unbuilt'}`;
const assetUrls = new Set((PRECACHE?.files ?? []).map(path => new URL(path, scopeUrl).href));
const shellUrl = new URL('index.html', scopeUrl).href;

self.addEventListener('install', event => {
  if (!PRECACHE) return; // Development/template files must not cache unbuilt source.
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    try {
      // Requests are restricted to exact build outputs; credentials are unnecessary.
      for (const url of assetUrls) {
        const response = await fetch(new Request(url, { cache: 'reload', credentials: 'omit' }));
        if (!response.ok || response.redirected || response.type === 'opaque') {
          throw new Error('Public app cache installation failed');
        }
        await cache.put(url, response);
      }
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  })());
  // Deliberately no skipWaiting: do not replace an open memory-only questionnaire.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === scopeUrl.origin;
  const hasCredentialsHeader = request.headers.has('authorization');
  const isPublicNavigation = request.method === 'GET' && request.mode === 'navigate'
    && isSameOrigin && !url.search && !hasCredentialsHeader
    && (url.href === scopeUrl.href || url.href === shellUrl);
  const isExactAsset = request.method === 'GET' && isSameOrigin && !hasCredentialsHeader
    && !url.search && assetUrls.has(url.href) && url.href !== shellUrl;

  if (!PRECACHE || (!isPublicNavigation && !isExactAsset)) {
    // Including Supabase, settings, maps, dashboard APIs, exports, auth, POST,
    // unknown paths and query-string variants. No Cache Storage or HTTP fallback.
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      event.respondWith(fetch(new Request(request, { cache: 'no-store' })));
    }
    return;
  }

  if (isPublicNavigation) {
    event.respondWith((async () => {
      try {
        // Keep online HTML fresh. It is never a server-rendered private dashboard.
        const response = await fetch(new Request(request, { cache: 'no-store' }));
        if (response.ok) return response;
        return response; // Do not disguise server errors as successful navigation.
      } catch {
        return (await caches.open(cacheName)).match(shellUrl)
          .then(response => response ?? Response.error());
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await (await caches.open(cacheName)).match(url.href);
    return cached ?? fetch(new Request(request, { cache: 'no-store' }));
  })());
});
