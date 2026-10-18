import assert from 'node:assert/strict';

/**
 * Real UI and real RPC adapter, but synthetic responses only. Production-looking
 * URLs are fulfilled from the isolated local Vite server, never fetched remotely.
 */
export async function verifyBrowserVisitorCounter({ browser, fixtureDefinitions, localOrigin }) {
  const { LANGUAGES, TRANSLATIONS, SPECIALTIES, VISITOR_COUNTER_COPY, SITE_VISIT_STORAGE_KEY, SITE_VISIT_LIFETIME_MS } = fixtureDefinitions;
  const startedAt = '2026-10-18T00:00:00Z';
  const catalog = {
    version: { id: '8b297aed-b47a-4b58-baa9-848091db8637', revision: 1, label: 'Synthetic visitor test', content_hash: 'md5:00000000000000000000000000000000', published_at: startedAt },
    specialties: SPECIALTIES.map(specialty => ({ ...specialty, descriptions: { en: specialty.blurb, fr: specialty.blurb, ro: specialty.blurb }, clinical_summaries: { en: '', fr: '', ro: '' } })),
  };
  const locale = { en: 'en-GB', fr: 'fr-FR', ro: 'ro-RO' };
  let completedCases = 0;

  async function openFixture({ origin = 'https://medcompass-web.com', width = 375, webdriver = false,
    doNotTrack = null, globalPrivacyControl = false, blockStorage = false, token = null,
    handler = null, total = 12345 } = {}) {
    const context = await browser.newContext({ viewport: { width, height: width >= 768 ? 1000 : 812 }, serviceWorkers: 'block' });
    const requests = [];
    const errors = [];
    const unexpected = [];
    const registered = new Set();
    let count = total;
    await context.addInitScript(({ webdriver, doNotTrack, globalPrivacyControl, blockStorage, token, key }) => {
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => webdriver, configurable: true });
      Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => doNotTrack, configurable: true });
      Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => globalPrivacyControl, configurable: true });
      window.__visitorStorageWrites = [];
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        window.__visitorStorageWrites.push({ storage: this === localStorage ? 'local' : 'session', name, value });
        return originalSetItem.call(this, name, value);
      };
      if (token && !sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(token));
      if (blockStorage) Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Synthetic storage denial', 'SecurityError'); }, configurable: true });
    }, { webdriver, doNotTrack, globalPrivacyControl, blockStorage, token, key: SITE_VISIT_STORAGE_KEY });
    await context.routeWebSocket('**', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname.endsWith('.supabase.co')) {
        const rpc = url.pathname.split('/').at(-1);
        const args = request.postDataJSON() ?? {};
        requests.push({ rpc, args });
        if (rpc === 'get_public_features') return route.fulfill({ json: { public_map_enabled: false } });
        if (rpc === 'get_active_specialty_catalog') return route.fulfill({ json: catalog });
        if (rpc === 'get_site_visit_count' || rpc === 'register_site_visit') {
          if (handler && await handler({ route, rpc, args, requests })) return;
          if (rpc === 'register_site_visit') {
            assert.deepEqual(Object.keys(args), ['p_visit_id'], 'The counter sends only a random identifier, not questionnaire or personal data');
            assert.match(args.p_visit_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            const counted = !registered.has(args.p_visit_id);
            registered.add(args.p_visit_id);
            if (counted) count += 1;
            return route.fulfill({ json: { total: count, started_at: startedAt, counted } });
          }
          return route.fulfill({ json: { total: count, started_at: startedAt } });
        }
        unexpected.push(`Unmocked backend call: ${rpc}`);
        return route.fulfill({ status: 403, json: { message: 'No live backend calls are permitted' } });
      }
      if (url.origin === origin && request.method() === 'GET') {
        // Do not use route.continue()/route.fetch(): these URLs resemble production.
        try {
          const response = await fetch(`${localOrigin}${url.pathname}${url.search}`);
          const headers = Object.fromEntries(response.headers);
          delete headers['content-encoding']; delete headers['content-length'];
          return await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
        } catch (error) {
          unexpected.push(`Local fixture delivery failed: ${error.message} (${error.cause?.code ?? 'unknown'})`);
          await route.abort().catch(() => {});
          return;
        }
      }
      if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) unexpected.push(`Unexpected external request: ${url.origin}${url.pathname}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) errors.push(`Local asset ${response.status()}: ${response.url()}`);
    });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    try { await page.locator('[data-visitor-counter]').waitFor(); }
    catch (error) { throw new Error(`Counter did not mount (${origin}, ${width}px): ${JSON.stringify({ errors, unexpected, requests })}`, { cause: error }); }
    const readRequests = () => requests.filter(request => request.rpc === 'get_site_visit_count');
    const writeRequests = () => requests.filter(request => request.rpc === 'register_site_visit');
    const close = async () => {
      assert.deepEqual(errors, [], 'Visitor counter produces no browser runtime errors');
      assert.deepEqual(unexpected, [], 'All backend calls are synthetic and no unexpected external requests occur');
      assert.equal(requests.some(request => request.rpc.startsWith('submit_')), false, 'Counter tests never submit research answers');
      await context.close();
      completedCases += 1;
      console.log(`Visitor browser fixture ${completedCases} passed.`);
    };
    return { context, page, requests, registered, readRequests, writeRequests, close };
  }

  async function chooseLanguage(page, language) {
    await page.locator('header button').last().click();
    await page.getByRole('button', { name: `${language.flag} ${language.label}`, exact: true }).click();
  }
  async function expectCount(page, count, lang = 'en') {
    const expected = new Intl.NumberFormat(locale[lang]).format(count);
    await page.waitForFunction(value => document.querySelector('[data-visitor-count]')?.textContent === value, expected);
    assert.equal(await page.locator('[data-visitor-count]').innerText(), expected);
  }
  async function noOverflow(page, label) {
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: no horizontal overflow ${JSON.stringify(dimensions)}`);
  }

  // Full localized component, expandable explanation, role choice and back navigation.
  for (const width of [320, 375, 1440]) {
    const fixture = await openFixture({ width });
    const { page } = fixture;
    await expectCount(page, 12346);
    for (const language of LANGUAGES) {
      const copy = VISITOR_COUNTER_COPY[language.code];
      await chooseLanguage(page, language);
      await expectCount(page, 12346, language.code);
      assert.equal(await page.locator('[data-visitor-counter]').getAttribute('aria-label'), copy.label);
      assert.equal(await page.locator('[data-visitor-counter] time').getAttribute('datetime'), startedAt);
      assert.equal(await page.locator('[data-visitor-counter] time').innerText(), new Intl.DateTimeFormat(locale[language.code], { dateStyle: 'medium', timeZone: 'Europe/Paris' }).format(new Date(startedAt)));
      assert.equal(await page.locator('[data-visitor-counter] details').getAttribute('open'), null, 'Detailed counting explanation is collapsed initially');
      await page.locator('[data-visitor-counter] summary').click();
      await page.getByText(copy.explanation, { exact: true }).waitFor();
      await noOverflow(page, `Counter ${language.code} ${width}px expanded`);
      await page.locator('[data-visitor-counter] summary').click();
      assert.deepEqual(await page.locator('[data-participant-role]').evaluateAll(elements => elements.map(element => element.dataset.participantRole)), ['curious', 'student', 'specialist']);
      await page.locator('[data-participant-role="student"]').click();
      await page.getByRole('button', { name: TRANSLATIONS[language.code].startButton, exact: true }).waitFor();
      await page.locator('[data-navigation-back]').click();
      await expectCount(page, 12346, language.code);
      assert.equal(fixture.writeRequests().length, 1, 'Language changes and returning home reuse one registration');
      await noOverflow(page, `Counter ${language.code} ${width}px collapsed`);
      if (language.code === 'fr' || (language.code === 'en' && width === 375)) {
        await page.screenshot({ path: `browser-qa.local/visitor-counter-${language.code}-${width}.png`, fullPage: true, animations: 'disabled' });
      }
    }
    const storage = await page.evaluate(key => ({ session: JSON.parse(sessionStorage.getItem(key)), local: localStorage.getItem(key), writes: window.__visitorStorageWrites }), SITE_VISIT_STORAGE_KEY);
    assert.deepEqual(Object.keys(storage.session).sort(), ['createdAt', 'id']);
    assert.equal(storage.local, null, 'Visitor identifiers never enter localStorage');
    assert.equal(storage.writes.some(write => /questionnaire|autosave/.test(write.name)), false, 'Questionnaire progress remains memory-only');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectCount(page, 12346);
    assert.equal(fixture.writeRequests().length, 2, 'Reload registers the same token with the idempotent endpoint');
    assert.equal(fixture.registered.size, 1, 'Reload does not increase the mocked aggregate');
    assert.equal(fixture.writeRequests()[0].args.p_visit_id, fixture.writeRequests()[1].args.p_visit_id);
    await fixture.close();
  }

  // Privacy signals, automation, development, previews and insecure hosts are read-only.
  for (const settings of [
    { webdriver: true }, { doNotTrack: '1' }, { doNotTrack: 'yes' }, { globalPrivacyControl: true },
    { origin: localOrigin }, { origin: 'https://preview.medcompass.example' },
  ]) {
    const fixture = await openFixture(settings);
    await expectCount(fixture.page, 12345);
    assert.equal(fixture.writeRequests().length, 0, `Read-only policy: ${JSON.stringify(settings)}`);
    assert.equal(fixture.readRequests().length, 1);
    assert.equal(await fixture.page.evaluate(key => sessionStorage.getItem(key), SITE_VISIT_STORAGE_KEY), null, 'Read-only visits do not create a tracking token');
    await fixture.close();
  }

  // Storage restrictions still allow the questionnaire and keep page-lifetime deduplication.
  const blockedStorage = await openFixture({ blockStorage: true });
  await expectCount(blockedStorage.page, 12346);
  await blockedStorage.page.locator('[data-participant-role="curious"]').click();
  await blockedStorage.page.locator('[data-navigation-back]').click();
  await expectCount(blockedStorage.page, 12346);
  assert.equal(blockedStorage.writeRequests().length, 1);
  await blockedStorage.close();

  const expiredId = '9849f7be-7f4d-4f93-8de6-5964b2293aba';
  const expired = await openFixture({ token: { id: expiredId, createdAt: Date.now() - SITE_VISIT_LIFETIME_MS - 60_000 } });
  await expectCount(expired.page, 12346);
  assert.notEqual(expired.writeRequests()[0].args.p_visit_id, expiredId, 'Expired tokens are replaced rather than retained across days');
  await expired.close();

  // Only a valid server-supplied zero is displayed as zero.
  const empty = await openFixture({ webdriver: true, total: 0 });
  await expectCount(empty.page, 0);
  await empty.close();

  // Unavailable/error/malformed data must never look like an actual zero count.
  for (const response of [
    { status: 503, json: { message: 'Synthetic unavailable backend' } },
    { json: null }, { json: [] }, { json: { total: '12345', started_at: startedAt } },
    { json: { total: -1, started_at: startedAt } }, { json: { total: 12, started_at: 'not-a-date' } },
  ]) {
    let fail = true;
    const fixture = await openFixture({ webdriver: true, handler: async ({ route }) => {
      if (!fail) return false;
      await route.fulfill(response); return true;
    } });
    await fixture.page.getByText(VISITOR_COUNTER_COPY.en.unavailable, { exact: true }).waitFor();
    assert.equal(await fixture.page.locator('[data-visitor-count]').innerText(), '—');
    await fixture.page.locator('[data-participant-role="student"]').click();
    await fixture.page.getByRole('button', { name: TRANSLATIONS.en.startButton, exact: true }).waitFor();
    fail = false;
    await fixture.page.locator('[data-navigation-back]').click();
    await expectCount(fixture.page, 12345);
    await fixture.close();
  }

  // A hung count request times out without blocking a participant; retry recovers.
  let heldRoute;
  let hold = true;
  const slow = await openFixture({ webdriver: true, handler: async ({ route }) => {
    if (!hold) return false;
    heldRoute = route; return true;
  } });
  await slow.page.getByText(VISITOR_COUNTER_COPY.en.loading, { exact: true }).waitFor();
  assert.equal(await slow.page.locator('[data-visitor-count]').innerText(), '—');
  await slow.page.locator('[data-participant-role="student"]').click();
  await slow.page.getByRole('button', { name: TRANSLATIONS.en.startButton, exact: true }).waitFor();
  await slow.page.locator('[data-navigation-back]').click();
  await slow.page.getByText(VISITOR_COUNTER_COPY.en.unavailable, { exact: true }).waitFor();
  hold = false;
  await heldRoute.abort().catch(() => {});
  await slow.page.locator('[data-visitor-retry]').click();
  await expectCount(slow.page, 12345);
  await slow.close();

  // Registration errors/retries reuse the same anonymous key, never answer payloads.
  let rejectRegistration = true;
  const retry = await openFixture({ handler: async ({ route, rpc }) => {
    if (!rejectRegistration || rpc !== 'register_site_visit') return false;
    await route.fulfill({ status: 503, json: { message: 'Synthetic registration failure' } }); return true;
  } });
  await retry.page.getByText(VISITOR_COUNTER_COPY.en.unavailable, { exact: true }).waitFor();
  rejectRegistration = false;
  await retry.page.locator('[data-visitor-retry]').click();
  await expectCount(retry.page, 12346);
  assert.equal(retry.writeRequests().length, 2);
  assert.equal(retry.writeRequests()[0].args.p_visit_id, retry.writeRequests()[1].args.p_visit_id, 'Retry does not generate another visit identity');
  await retry.close();

  console.log(`Visitor counter browser checks passed (${completedCases} isolated contexts): EN/RO/FR at 320/375/1440px; anonymous registration/reload deduplication; privacy and automation opt-outs; storage restrictions; expiry; loading, malformed responses, failures and retries; no questionnaire submissions or live backend requests.`);
}
