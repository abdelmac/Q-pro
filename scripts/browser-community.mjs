import assert from 'node:assert/strict';

const FIXTURE_ORIGIN = 'https://community-fixture.supabase.co';
const STORAGE_KEY = 'sb-community-fixture-auth-token';
const PASSWORD = 'Synthetic-Only-Password-42';
const IDS = {
  student: 'c0100000-0000-4000-8000-000000000001',
  specialist: 'c0100000-0000-4000-8000-000000000002',
  admin: 'c0100000-0000-4000-8000-000000000003',
  researcher: 'c0100000-0000-4000-8000-000000000004',
  newcomer: 'c0100000-0000-4000-8000-000000000005',
};
const COMMENT_ID = 'c0200000-0000-4000-8000-000000000001';
const MESSAGE = 'SYNTHETIC perspective: listening and thoughtful teamwork are central to this specialty.';

function sessionFixture(kind, confirmed = true) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = {
    id: IDS[kind], aud: 'authenticated', role: 'authenticated', email: `${kind}@example.invalid`,
    app_metadata: { provider: 'email', providers: ['email'] },
    // Deliberately forged user-editable claims must never unlock administration.
    user_metadata: { role: 'professor', verified: true, can_edit: true, can_publish: true },
    created_at: '2026-10-01T00:00:00Z',
    email_confirmed_at: confirmed ? '2026-10-01T00:01:00Z' : undefined,
    confirmed_at: confirmed ? '2026-10-01T00:01:00Z' : undefined,
  };
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}.${encode('synthetic-not-a-real-signature')}`,
    refresh_token: `synthetic-${kind}-refresh`, expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user,
  };
}

/** All state is synthetic and in memory. No request may reach a remote service. */
async function fixtureContext({ browser, fixtureDefinitions, localOrigin, kind = null, width = 1440, enabled = true, publicMap = false, statusUnavailable = false }) {
  const specialty = fixtureDefinitions.SPECIALTIES[0].name;
  const catalog = {
    version: { id: '8b297aed-b47a-4b58-baa9-848091db8637', revision: 1, label: 'Synthetic community browser catalog', content_hash: 'md5:00000000000000000000000000000000', published_at: '2026-01-01T00:00:00Z' },
    specialties: fixtureDefinitions.SPECIALTIES.map(s => ({ ...s, descriptions: { en: s.blurb, fr: s.blurb, ro: s.blurb }, clinical_summaries: { en: '', fr: '', ro: '' } })),
  };
  const sessions = Object.fromEntries(Object.keys(IDS).map(key => [key, sessionFixture(key)]));
  const profile = role => ({ role, specialty: role === 'specialist' ? specialty : null, verified: false, suspended: false, country_code: null, map_consent: false });
  const profiles = { student: profile('student'), specialist: profile('specialist'), admin: profile('curious'), researcher: profile('curious'), newcomer: null };
  const calls = [];
  const unexpected = [];
  const errors = [];
  const comments = [{ id: COMMENT_ID, specialty, body: MESSAGE, language: 'en', status: 'approved', author_id: IDS.specialist, email: 'DO-NOT-DISPLAY-AUTHOR@example.invalid', verified: true, report_count: 0 }];
  const ownComments = [];
  let delayNextFeed = false;
  let releaseFeed = null;
  let pendingFeed = Promise.resolve();
  let failNextSubmit = false;
  let failNextFeed = false;
  let failNextLogout = false;
  const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
  await context.routeWebSocket('**', socket => socket.close());
  if (kind) await context.addInitScript(({ key, session }) => {
    if (!sessionStorage.getItem('community-fixture-session-initialized')) {
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.setItem('community-fixture-session-initialized', 'yes');
    }
  }, { key: STORAGE_KEY, session: sessions[kind] });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === localOrigin && request.method() === 'GET') return route.continue();
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.abort('blockedbyclient');
    if (url.origin !== FIXTURE_ORIGIN) {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    const rpc = url.pathname.split('/').at(-1);
    const args = request.postDataJSON() ?? {};
    const token = request.headers().authorization?.replace(/^Bearer /, '');
    const identity = Object.keys(sessions).find(key => sessions[key].access_token === token) ?? null;
    calls.push({ rpc, method: request.method(), args, identity, search: Object.fromEntries(url.searchParams) });
    const reply = (json, status = 200) => route.fulfill({ status, json, headers: { 'cache-control': 'no-store, private' } });
    if (url.pathname === '/auth/v1/token') {
      const selected = Object.keys(sessions).find(key => sessions[key].user.email === args.email);
      assert.ok(selected, 'Only known synthetic account emails may sign in');
      assert.equal(args.password, PASSWORD);
      return reply(sessions[selected]);
    }
    if (url.pathname === '/auth/v1/signup') {
      assert.equal(args.email, 'newcomer@example.invalid');
      assert.equal(args.password, PASSWORD);
      return reply(sessionFixture('newcomer', false).user);
    }
    if (url.pathname === '/auth/v1/recover' || url.pathname === '/auth/v1/resend') return reply({});
    if (url.pathname === '/auth/v1/user') {
      assert.ok(identity, 'Identity revalidation requires an authenticated synthetic token');
      if (request.method() === 'PUT') assert.equal(args.password, PASSWORD);
      return reply(sessions[identity].user);
    }
    if (url.pathname === '/auth/v1/logout') {
      if (failNextLogout) { failNextLogout = false; return reply({ message: 'Synthetic logout service unavailable' }, 503); }
      return route.fulfill({ status: 204, body: '' });
    }
    if (rpc === 'get_public_features') return reply({ public_map_enabled: publicMap });
    if (rpc === 'get_site_visit_count') return reply({ total: 420, started_at: '2026-10-18T00:00:00Z' });
    if (rpc === 'get_active_specialty_catalog') return reply(catalog);
    if (rpc === 'community_status') return statusUnavailable ? reply({ message: 'Synthetic unavailable status service' }, 503) : reply({ enabled });
    if (rpc === 'community_map') return reply({ enabled, countries: enabled ? [{ country_code: 'RO', count: 10 }] : [] });
    if (rpc === 'get_participation_map_stats') return reply({ total: 0, countries: 0, students: 0, specialists: 0, nonMedical: 0, groups: [], privacyThreshold: 10, rounding: 5, granularity: 'month', publishedThrough: null });
    if (rpc === 'current_user_portal_profile') return reply(identity === 'admin'
      ? { authorized: true, role: 'professor', can_edit: true, can_publish: true, display_name: 'Synthetic administrator' }
      : identity === 'researcher' ? { authorized: true, role: 'researcher', can_edit: false, can_publish: false, display_name: 'Synthetic researcher' }
        : { authorized: false });
    if (rpc.startsWith('community_') && !identity) return reply({ code: '42501', message: 'Synthetic confirmed membership required' }, 403);
    if (rpc === 'community_profile') return reply(profiles[identity]);
    if (rpc === 'community_save_profile') {
      assert.equal(args.p_terms_version, 'community-membership-v1');
      assert.equal('p_user_id' in args, false, 'Profile writes rely on server identity, not a user-provided ID');
      profiles[identity] = { ...profile(args.p_role), specialty: args.p_specialty, country_code: args.p_country_code, map_consent: args.p_map_consent };
      return reply(profiles[identity]);
    }
    if (rpc === 'community_withdraw_map_consent') {
      profiles[identity].country_code = null;
      profiles[identity].map_consent = false;
      return reply(true);
    }
    if (rpc === 'community_list_comments') {
      assert.ok(profiles[identity] && !profiles[identity].suspended);
      assert.equal(args.p_limit, 20);
      if (failNextFeed) { failNextFeed = false; return reply({ code: '42501', message: 'Synthetic feed access unavailable' }, 403); }
      const result = comments.filter(c => c.status === 'approved' && (!args.p_specialty || c.specialty === args.p_specialty));
      if (delayNextFeed) {
        delayNextFeed = false;
        let finished;
        pendingFeed = new Promise(resolve => { finished = resolve; });
        await new Promise(resolve => { releaseFeed = resolve; });
        try { await reply(result); } catch { /* An identity change may abort this old request. */ }
        finally { finished(); }
        return;
      }
      return reply(result);
    }
    if (rpc === 'community_my_comments') return reply(ownComments);
    if (rpc === 'community_submit_comment') {
      assert.equal(identity, 'specialist');
      assert.equal(args.p_consent, true);
      assert.equal(args.p_consent_version, 'community-publication-v1');
      assert.match(args.p_id, /^[0-9a-f-]{36}$/i);
      let saved = ownComments.find(c => c.id === args.p_id);
      if (!saved) {
        saved = { id: args.p_id, specialty, body: args.p_body, language: args.p_language, status: 'pending' };
        ownComments.push(saved);
      }
      if (failNextSubmit) { failNextSubmit = false; return reply({ code: 'SYNTHETIC_RESPONSE_LOST', message: 'Synthetic lost response after save' }, 503); }
      return reply(saved);
    }
    if (rpc === 'community_withdraw_comment') {
      const saved = ownComments.find(c => c.id === args.p_id);
      assert.ok(saved, 'Only this synthetic specialist’s own message is withdrawn');
      saved.status = 'withdrawn';
      return reply(true);
    }
    if (rpc === 'community_report_comment') return reply(true);
    if (rpc.startsWith('community_admin_')) {
      assert.equal(identity, 'admin', 'Ordinary members and research-only accounts never request moderation APIs');
      if (rpc === 'community_admin_members') return reply([{ id: IDS.specialist, email: sessions.specialist.user.email, ...profiles.specialist }]);
      if (rpc === 'community_admin_comments') return reply(comments.filter(c => c.status === args.p_status));
      if (rpc === 'community_admin_review_member') {
        assert.equal(args.p_id, IDS.specialist);
        assert.ok(args.p_note.length >= 10);
        profiles.specialist.verified = args.p_verified;
        profiles.specialist.suspended = args.p_suspended;
        for (const item of comments.filter(c => c.author_id === IDS.specialist)) item.verified = args.p_verified;
        return reply(true);
      }
      if (rpc === 'community_admin_review_comment') {
        const saved = comments.find(c => c.id === args.p_id);
        assert.ok(saved);
        assert.ok(args.p_note.length >= 10);
        saved.status = args.p_approve ? 'approved' : 'rejected';
        return reply(true);
      }
    }
    if (['student_responses', 'specialist_responses'].includes(rpc)) {
      assert.ok(identity === 'admin' || identity === 'researcher');
      assert.ok(['GET', 'HEAD'].includes(request.method()));
      if (request.method() === 'HEAD') return route.fulfill({ status: 200, body: '', headers: { 'content-range': '*/0', 'access-control-expose-headers': 'content-range' } });
      return route.fulfill({ status: 200, json: [], headers: { 'content-range': '*/0', 'access-control-expose-headers': 'content-range' } });
    }
    if (rpc === 'get_portal_test_dataset') return reply(null);
    if (rpc === 'get_public_feature_settings') return reply({ public_map_enabled: false });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return reply({ message: 'Unexpected operation blocked by synthetic community verification' }, 403);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => void dialog.accept());
  return {
    page, context, calls, profiles, comments, ownComments, sessions, specialty,
    delayFeed() { delayNextFeed = true; },
    async releaseFeed() { releaseFeed?.(); await pendingFeed; },
    failSubmit() { failNextSubmit = true; },
    failFeed() { failNextFeed = true; },
    failLogout() { failNextLogout = true; },
    async assertClean() {
      assert.deepEqual(errors, [], 'No browser runtime errors');
      assert.deepEqual(unexpected, [], 'No unmocked Auth, research, visitor-registration or external request was permitted');
      assert.equal(calls.some(c => c.rpc === 'register_site_visit' || c.rpc.startsWith('submit_student') || c.rpc.startsWith('submit_specialist')), false, 'Community regression creates no visitor or research submissions');
    },
    async close() { releaseFeed?.(); await pendingFeed; await context.close(); },
  };
}

async function language(page, fixtureDefinitions, code) {
  if (code === 'en') return;
  const option = fixtureDefinitions.LANGUAGES.find(item => item.code === code);
  await page.locator('header').getByRole('button', { name: /^(EN|English)$/ }).click();
  await page.getByRole('button', { name: `${option.flag} ${option.label}`, exact: true }).click();
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: ${JSON.stringify(dimensions)}`);
}

export async function verifyBrowserCommunity({ browser, fixtureDefinitions, localOrigin }) {
  const { COMMUNITY_COPY, TRANSLATIONS } = fixtureDefinitions;
  const filter = process.env.COMMUNITY_BROWSER_FILTER ? new RegExp(process.env.COMMUNITY_BROWSER_FILTER) : null;
  let passed = 0;
  const openCommunity = async (page, copy) => {
    await page.locator('[data-navigation-home]').click();
    await page.getByRole('button', { name: copy.community, exact: true }).click();
  };
  const openAccount = async (page, copy) => {
    await page.locator('[data-navigation-home]').click();
    await page.getByRole('button', { name: copy.account, exact: true }).click();
  };
  const signIn = async (page, copy, kind) => {
    await openAccount(page, copy);
    await page.getByLabel(copy.email, { exact: true }).fill(`${kind}@example.invalid`);
    await page.getByLabel(copy.password, { exact: true }).fill(PASSWORD);
    await page.locator('form').getByRole('button', { name: copy.login, exact: true }).click();
    await page.getByRole('heading', { name: copy.profile, exact: true }).waitFor();
  };
  const run = async (label, options, scenario) => {
    if (filter && !filter.test(label)) return;
    const fixture = await fixtureContext({ browser, fixtureDefinitions, localOrigin, ...options });
    try {
      await fixture.page.goto(localOrigin, { waitUntil: 'networkidle' });
      await scenario(fixture);
      await fixture.assertClean();
      passed++;
      console.log(`Community: ${label} passed (synthetic backend only).`);
    } catch (error) {
      console.error(`Community failure ${label}:`, await fixture.page.locator('body').innerText());
      console.error('Synthetic endpoint summary:', fixture.calls.map(({ rpc, method, identity }) => ({ rpc, method, identity })));
      await fixture.page.screenshot({ path: `browser-qa.local/community-failure-${label.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true });
      throw error;
    } finally { await fixture.close(); }
  };

  for (const code of ['en', 'fr', 'ro']) for (const width of [320, 375, 1440]) {
    await run(`guest ${code} ${width}`, { width }, async ({ page, calls }) => {
      const copy = COMMUNITY_COPY[code];
      const questionnaire = TRANSLATIONS[code];
      await language(page, fixtureDefinitions, code);
      await noOverflow(page, `Home ${code}/${width}`);
      await page.locator('[data-participant-role="student"]').click();
      await page.getByRole('button', { name: questionnaire.startButton, exact: true }).click();
      await page.getByRole('heading', { name: questionnaire.specialtyTitle, exact: true }).waitFor();
      assert.equal(calls.some(c => c.rpc === 'token' || c.rpc === 'signup' || c.rpc === 'community_list_comments'), false, 'Guests may start the questionnaire with no account or feed access');
      await openCommunity(page, copy);
      await page.getByText(copy.membersOnly, { exact: true }).waitFor();
      assert.equal(calls.some(c => ['community_list_comments', 'community_my_comments', 'community_map'].includes(c.rpc)), false, 'A guest gate never fetches members-only content');
      assert.equal(await page.getByText(MESSAGE, { exact: true }).count(), 0);
      await noOverflow(page, `Guest gate ${code}/${width}`);
      await page.screenshot({ path: `browser-qa.local/community-guest-${code}-${width}.png`, fullPage: true });
      await openAccount(page, copy);
      await page.getByRole('heading', { name: copy.login, exact: true }).waitFor();
      await noOverflow(page, `Account ${code}/${width}`);
      await page.getByRole('button', { name: copy.signup, exact: true }).click();
      await page.getByRole('checkbox', { name: copy.signupConsent, exact: true }).waitFor();
      assert.equal(await page.getByRole('checkbox', { name: copy.signupConsent, exact: true }).isChecked(), false);
      assert.equal(await page.locator('form button[type="submit"]').isDisabled(), true, 'Account creation needs explicit unchecked consent');
      await noOverflow(page, `Signup ${code}/${width}`);
      await page.screenshot({ path: `browser-qa.local/community-signup-${code}-${width}.png`, fullPage: true });
    });
  }

  await run('signup confirmation recovery', {}, async ({ page, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await openAccount(page, copy);
    await page.getByRole('button', { name: copy.signup, exact: true }).click();
    await page.getByLabel(copy.email, { exact: true }).fill('newcomer@example.invalid');
    await page.getByLabel(copy.password, { exact: true }).fill(PASSWORD);
    await page.getByLabel(copy.confirmPassword, { exact: true }).fill('Synthetic-Mismatch-Password-42');
    await page.getByRole('checkbox', { name: copy.signupConsent, exact: true }).check();
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('alert').filter({ hasText: copy.passwordMismatch }).waitFor();
    assert.equal(calls.some(c => c.rpc === 'signup'), false, 'Password mismatch never sends an Auth request');
    await page.getByLabel(copy.confirmPassword, { exact: true }).fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('status').filter({ hasText: copy.emailSent }).waitFor();
    assert.equal(calls.filter(c => c.rpc === 'signup').length, 1);
    assert.equal(await page.getByLabel(copy.password, { exact: true }).inputValue(), '', 'Signup does not retain the password');
    assert.equal(await page.getByRole('checkbox', { name: copy.signupConsent, exact: true }).isChecked(), false);
    await openCommunity(page, copy);
    await page.getByText(copy.membersOnly, { exact: true }).waitFor();
    assert.equal(calls.some(c => c.rpc === 'community_list_comments'), false, 'Unconfirmed signup is not a signed-in member');
    await openAccount(page, copy);
    await page.getByRole('button', { name: copy.forgot, exact: true }).click();
    await page.getByLabel(copy.email, { exact: true }).fill('newcomer@example.invalid');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('status').filter({ hasText: copy.emailSent }).waitFor();
    const recovery = calls.find(c => c.rpc === 'recover');
    assert.ok(recovery);
    assert.equal(recovery.args.email, 'newcomer@example.invalid');
    const redirect = new URL(recovery.search.redirect_to);
    assert.equal(redirect.origin, localOrigin);
    assert.equal(redirect.searchParams.get('community'), 'account');
    assert.equal(redirect.searchParams.get('recovery'), '1');
    await page.getByRole('button', { name: copy.resend, exact: true }).click();
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('status').filter({ hasText: copy.emailSent }).waitFor();
    assert.equal(calls.filter(c => c.rpc === 'resend').length, 1);
    assert.equal(calls.some(c => c.rpc === 'community_save_profile'), false, 'Signup and recovery do not silently enroll a community profile');
  });

  await run('closed server feature fails safely', { enabled: false, width: 375 }, async ({ page, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByText(copy.unavailable, { exact: true }).waitFor();
    await openAccount(page, copy);
    await page.getByText(copy.unavailable, { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: copy.signup, exact: true }).isDisabled(), true);
    assert.equal(calls.some(c => ['community_list_comments', 'community_my_comments', 'community_admin_members', 'signup'].includes(c.rpc)), false, 'Server release gate never leaks content or allows new registration');
    await noOverflow(page, 'Closed community account 375');
  });

  await run('unavailable status service fails closed', { statusUnavailable: true }, async ({ page, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByText(copy.unavailable, { exact: true }).waitFor();
    await openAccount(page, copy);
    assert.equal(await page.getByRole('button', { name: copy.signup, exact: true }).isDisabled(), true);
    assert.equal(calls.some(c => ['community_profile', 'community_list_comments', 'community_my_comments', 'community_admin_members', 'signup'].includes(c.rpc)), false, 'A failed server release check never defaults to an enabled community');
  });

  await run('public map separate community aggregates', { publicMap: true, width: 375 }, async ({ page, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await page.getByRole('button', { name: TRANSLATIONS.en.navWorldMap, exact: true }).click();
    const map = page.locator('[data-community-map]');
    await map.getByRole('heading', { name: copy.communityMap, exact: true }).waitFor();
    await map.getByRole('img', { name: copy.communityMap, exact: true }).waitFor();
    assert.equal(await map.locator('dl dt').textContent(), 'Romania');
    assert.equal(await map.locator('dl dd').textContent(), '≈ 10');
    assert.ok(calls.some(c => c.rpc === 'community_map' && c.identity === null), 'Only privacy-preserving community aggregates are public');
    assert.ok(calls.some(c => c.rpc === 'get_participation_map_stats'), 'Research and community maps use different aggregate endpoints');
    assert.equal(calls.some(c => ['community_list_comments', 'community_profile', 'student_responses', 'specialist_responses'].includes(c.rpc)), false);
    assert.equal((await map.innerText()).includes('@'), false);
    await noOverflow(page, 'Separate community country map 375');
    await page.screenshot({ path: 'browser-qa.local/community-map-en-375.png', fullPage: true });
  });

  await run('new member profile map opt in', { kind: 'newcomer', width: 375 }, async ({ page, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByText(copy.finishProfile, { exact: true }).waitFor();
    assert.equal(calls.some(c => c.rpc === 'community_list_comments'), false);
    await openAccount(page, copy);
    await page.getByRole('heading', { name: copy.profile, exact: true }).waitFor();
    await page.getByLabel(copy.role).selectOption('student');
    assert.equal(await page.getByRole('checkbox', { name: copy.membership, exact: true }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: copy.mapConsent, exact: true }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: copy.mapConsent, exact: true }).isDisabled(), true);
    assert.equal(await page.getByLabel(copy.country).inputValue(), '');
    await page.getByLabel(copy.country).selectOption('RO');
    assert.equal(await page.getByRole('checkbox', { name: copy.mapConsent, exact: true }).isChecked(), false, 'Choosing a country does not automatically agree to map publication');
    await page.getByRole('checkbox', { name: copy.mapConsent, exact: true }).check();
    await page.getByRole('checkbox', { name: copy.membership, exact: true }).check();
    await page.getByRole('button', { name: copy.saveProfile, exact: true }).click();
    await page.getByRole('status').filter({ hasText: copy.profileSaved }).waitFor();
    assert.deepEqual(calls.find(c => c.rpc === 'community_save_profile').args, { p_role: 'student', p_specialty: null, p_country_code: 'RO', p_map_consent: true, p_terms_version: 'community-membership-v1' });
    await page.getByLabel(copy.country).selectOption('');
    assert.equal(await page.getByRole('checkbox', { name: copy.mapConsent, exact: true }).isChecked(), false);
    await page.getByRole('checkbox', { name: copy.membership, exact: true }).check();
    await page.getByRole('button', { name: copy.saveProfile, exact: true }).click();
    await page.getByRole('status').filter({ hasText: copy.profileSaved }).waitFor();
    assert.equal(calls.filter(c => c.rpc === 'community_save_profile').at(-1).args.p_country_code, null);
    assert.equal(calls.filter(c => c.rpc === 'community_save_profile').at(-1).args.p_map_consent, false, 'Map consent is revocable without touching questionnaire responses');
    await openCommunity(page, copy);
    await page.getByText(MESSAGE, { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: copy.message, exact: true }).count(), 0, 'Students cannot compose specialist messages');
    assert.equal((await page.locator('body').innerText()).includes('DO-NOT-DISPLAY-AUTHOR'), false, 'Unexpected author metadata from a feed response is stripped');
    assert.equal((await page.locator('body').innerText()).includes(IDS.specialist), false, 'Author account IDs are not rendered');
    await noOverflow(page, 'Confirmed student feed 375');
    await page.screenshot({ path: 'browser-qa.local/community-member-en-375.png', fullPage: true });
    await openAccount(page, copy);
    await page.getByRole('button', { name: copy.signout, exact: true }).click();
    await page.getByRole('heading', { name: copy.login, exact: true }).waitFor();
    await openCommunity(page, copy);
    await page.getByText(copy.membersOnly, { exact: true }).waitFor();
    assert.equal(await page.getByText(MESSAGE, { exact: true }).count(), 0, 'Signing out removes member-only comments');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null, 'Signing out removes the local member session');
  });

  for (const state of ['closed', 'suspended']) {
    const kind = state === 'closed' ? 'student' : 'specialist';
    await run(`${state} members retain withdrawal rights`, { kind, enabled: state !== 'closed', width: 375 }, async ({ page, profiles, ownComments, calls, specialty }) => {
      const copy = COMMUNITY_COPY.en;
      profiles[kind].country_code = 'RO';
      profiles[kind].map_consent = true;
      profiles[kind].suspended = state === 'suspended';
      ownComments.push({ id: COMMENT_ID, specialty, body: 'SYNTHETIC previously published specialty comment retained for owner withdrawal.', language: 'en', status: 'approved' });
      await openCommunity(page, copy);
      await page.getByText(state === 'closed' ? copy.unavailable : copy.suspended, { exact: true }).waitFor();
      assert.equal(calls.some(c => c.rpc === 'community_list_comments'), false);
      await openAccount(page, copy);
      await page.getByRole('button', { name: copy.removeCountry, exact: true }).waitFor();
      await page.getByRole('button', { name: copy.withdraw, exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: copy.saveProfile, exact: true }).count(), 0, 'A paused or suspended profile remains read-only');
      await page.getByRole('button', { name: copy.removeCountry, exact: true }).click();
      await page.getByRole('status').filter({ hasText: copy.countryRemoved }).waitFor();
      assert.equal(profiles[kind].country_code, null);
      assert.equal(profiles[kind].map_consent, false);
      assert.equal(calls.filter(c => c.rpc === 'community_withdraw_map_consent').length, 1, 'The dedicated opt-out RPC works without profile edit permission');
      await page.getByRole('button', { name: copy.withdraw, exact: true }).click();
      await page.getByText(copy.withdrawn, { exact: true }).waitFor();
      assert.equal(ownComments[0].status, 'withdrawn', 'Even suspended and former specialists can withdraw an old publication');
      assert.equal(calls.filter(c => c.rpc === 'community_withdraw_comment').length, 1);
      assert.equal(calls.some(c => c.rpc === 'community_save_profile' || c.rpc === 'community_submit_comment'), false);
      await noOverflow(page, `${state} withdrawal controls 375`);
      await page.screenshot({ path: `browser-qa.local/community-${state}-withdrawals-en-375.png`, fullPage: true });
    });
  }

  await run('specialist explicit consent retry and withdrawal', { kind: 'specialist', width: 375 }, async ({ page, calls, ownComments, failSubmit }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByRole('textbox', { name: copy.message, exact: true }).waitFor();
    await page.getByText(copy.awaitingVerification, { exact: false }).waitFor();
    const checkbox = page.getByRole('checkbox', { name: copy.publicationConsent, exact: true });
    assert.equal(await checkbox.isChecked(), false, 'Publication consent always starts unchecked');
    await page.getByRole('textbox', { name: copy.message, exact: true }).fill('SYNTHETIC own specialist message awaiting independent review.');
    assert.equal(await page.getByRole('button', { name: copy.submit, exact: true }).isDisabled(), true);
    assert.equal(calls.some(c => c.rpc === 'community_submit_comment'), false);
    await checkbox.check();
    failSubmit();
    await page.getByRole('button', { name: copy.submit, exact: true }).click();
    await page.getByRole('alert').filter({ hasText: copy.failed }).waitFor();
    await page.getByRole('button', { name: copy.submit, exact: true }).click();
    await page.getByRole('status').filter({ hasText: copy.submitted }).waitFor();
    const submissions = calls.filter(c => c.rpc === 'community_submit_comment');
    assert.equal(submissions.length, 2);
    assert.equal(submissions[0].args.p_id, submissions[1].args.p_id, 'Retry after a lost response reuses the same idempotency ID');
    assert.equal(ownComments.length, 1, 'A retry creates only one pending message');
    assert.equal(ownComments[0].status, 'pending');
    assert.equal(await checkbox.isChecked(), false, 'Success resets publication consent for the next message');
    await page.getByRole('button', { name: copy.withdraw, exact: true }).click();
    await page.getByText(copy.withdrawn, { exact: true }).waitFor();
    assert.equal(ownComments[0].status, 'withdrawn');
    assert.equal(calls.filter(c => c.rpc === 'community_withdraw_comment').length, 1);
    assert.equal(calls.some(c => c.rpc.startsWith('community_admin_')), false, 'Self-declared specialists never gain moderation access');
    await noOverflow(page, 'Specialist composer 375');
    await page.screenshot({ path: 'browser-qa.local/community-specialist-en-375.png', fullPage: true });
  });

  await run('ordinary member denied dashboard keeps login', { kind: 'student' }, async ({ page, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await page.locator('[data-participant-role="curious"]').click();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('main')?.innerText.includes('access') || document.querySelector('input[type="email"]'));
    await page.waitForLoadState('networkidle');
    assert.equal(calls.some(c => c.rpc === 'logout'), false, 'Missing dashboard authorization must not sign a member out of the whole website');
    assert.equal(await page.locator('[data-dashboard-view]').count(), 0);
    const back = page.locator('button').filter({ hasText: /^Back$/ }).first();
    await back.click();
    await openAccount(page, copy);
    await page.getByRole('heading', { name: copy.profile, exact: true }).waitFor();
    assert.ok(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
    await openCommunity(page, copy);
    await page.getByText(MESSAGE, { exact: true }).waitFor();
  });

  // Signing in through the UI also exercises the Auth event bridge, not only preseeded sessions.
  await run('confirmed login reaches member content', {}, async ({ page }) => {
    const copy = COMMUNITY_COPY.en;
    await signIn(page, copy, 'student');
    await openCommunity(page, copy);
    await page.getByText(MESSAGE, { exact: true }).waitFor();
  });

  await run('failed logout stays truthful then retries safely', { kind: 'student', width: 375 }, async ({ page, calls, failLogout }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByText(MESSAGE, { exact: true }).waitFor();
    await openAccount(page, copy);
    await page.getByRole('heading', { name: copy.profile, exact: true }).waitFor();
    const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    assert.ok(before);
    failLogout();
    await page.getByRole('button', { name: copy.signout, exact: true }).click();
    await page.getByRole('alert').filter({ hasText: copy.failed }).waitFor();
    await page.getByText('student@example.invalid', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: copy.login, exact: true }).count(), 0, 'Failed SDK revocation does not falsely display a signed-out account');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), before, 'The retained SDK session is accurately reflected in the UI after logout failure');
    assert.equal(await page.getByRole('button', { name: copy.signout, exact: true }).isEnabled(), true, 'A failed sign-out keeps a usable retry control');
    assert.equal(calls.filter(c => c.rpc === 'logout').length, 1);
    await page.screenshot({ path: 'browser-qa.local/community-logout-error-en-375.png', fullPage: true });
    await page.getByRole('button', { name: copy.signout, exact: true }).click();
    await page.getByRole('heading', { name: copy.login, exact: true }).waitFor();
    assert.equal(calls.filter(c => c.rpc === 'logout').length, 2);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    assert.equal(await page.getByText('student@example.invalid', { exact: true }).count(), 0);
    assert.equal(await page.locator('[data-community-own-comments]').count(), 0, 'Successful sign-out clears identity-keyed owner content');
    const readsBeforeGate = calls.filter(c => c.rpc === 'community_list_comments').length;
    await openCommunity(page, copy);
    await page.getByText(copy.membersOnly, { exact: true }).waitFor();
    assert.equal(await page.getByText(MESSAGE, { exact: true }).count(), 0);
    assert.equal(calls.filter(c => c.rpc === 'community_list_comments').length, readsBeforeGate, 'No member feed request happens after sign-out');
    await page.reload({ waitUntil: 'networkidle' });
    await openCommunity(page, copy);
    await page.getByText(copy.membersOnly, { exact: true }).waitFor();
    assert.equal(await page.getByText(MESSAGE, { exact: true }).count(), 0, 'Reload cannot resurrect the cleared session or member-only content');
  });

  await run('administrator verifies then approves', { kind: 'admin' }, async ({ page, calls, comments, profiles }) => {
    const copy = COMMUNITY_COPY.en;
    comments[0].status = 'pending';
    comments[0].verified = false;
    await page.locator('[data-participant-role="curious"]').click();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.locator('#dashboard-sidebar-desktop').waitFor();
    await page.locator('#dashboard-sidebar-desktop [data-dashboard-view="community"]').click();
    const panel = page.locator('[data-community-moderation]');
    await panel.waitFor();
    await panel.getByRole('heading', { name: 'specialist@example.invalid', exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: copy.verify, exact: true }).isDisabled(), true, 'Specialist verification needs a recorded reason');
    await panel.getByRole('button', { name: copy.comments, exact: true }).click();
    await panel.getByText(MESSAGE, { exact: true }).waitFor();
    await panel.getByLabel(copy.moderationNote, { exact: true }).fill('SYNTHETIC independent content review completed.');
    assert.equal(await panel.getByRole('button', { name: copy.approve, exact: true }).isDisabled(), true, 'An administrator cannot approve an unverified specialist’s comment');
    await panel.getByRole('button', { name: copy.members, exact: true }).click();
    await panel.getByLabel(copy.moderationNote, { exact: true }).fill('SYNTHETIC professional status independently verified.');
    await panel.getByRole('button', { name: copy.verify, exact: true }).click();
    await panel.getByRole('button', { name: copy.revoke, exact: true }).waitFor();
    assert.equal(profiles.specialist.verified, true);
    await panel.getByRole('button', { name: copy.comments, exact: true }).click();
    await panel.getByText(MESSAGE, { exact: true }).waitFor();
    await panel.getByLabel(copy.moderationNote, { exact: true }).fill('SYNTHETIC independent content review completed.');
    await panel.getByRole('button', { name: copy.approve, exact: true }).click();
    await panel.getByText(copy.noComments, { exact: true }).waitFor();
    assert.equal(comments[0].status, 'approved');
    assert.equal(calls.filter(c => c.rpc === 'community_admin_review_member').length, 1);
    assert.equal(calls.filter(c => c.rpc === 'community_admin_review_comment').length, 1);
    await panel.getByLabel(copy.comments).selectOption('approved');
    await panel.getByText(MESSAGE, { exact: true }).waitFor();
    await noOverflow(page, 'Administrator moderation');
    await page.screenshot({ path: 'browser-qa.local/community-admin-en-1440.png', fullPage: true });
  });

  await run('researcher cannot moderate community', { kind: 'researcher' }, async ({ page, calls }) => {
    await page.locator('[data-participant-role="curious"]').click();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.locator('[data-professor-overview]').waitFor();
    assert.equal(await page.locator('[data-dashboard-view="community"], [data-community-moderation]').count(), 0, 'The professor researcher account retains participant-only access');
    assert.equal(calls.some(c => c.rpc.startsWith('community_admin_')), false);
    assert.equal(await page.locator('[data-dashboard-view="algorithm"], [data-dashboard-view="map"], [data-dashboard-view="analytics"]').count(), 0);
  });

  await run('late feed discarded after account change', { kind: 'student' }, async ({ page, delayFeed, releaseFeed, sessions, specialty, calls }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByText(MESSAGE, { exact: true }).waitFor();
    delayFeed();
    await Promise.all([
      page.waitForRequest(request => request.url().endsWith('/rpc/community_list_comments') && request.postDataJSON()?.p_specialty === specialty),
      page.getByLabel(copy.specialty).selectOption(specialty),
    ]);
    // Simulate the same localStorage + BroadcastChannel notification produced
    // by Supabase sign-in in another tab, without exposing a test API in the app.
    await page.evaluate(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: 'SIGNED_IN', session });
      channel.close();
    }, { key: STORAGE_KEY, session: sessions.newcomer });
    await page.getByText(copy.finishProfile, { exact: true }).waitFor();
    await releaseFeed();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByText(MESSAGE, { exact: true }).count(), 0, 'A prior identity’s late member feed cannot appear for a new unenrolled account');
    assert.equal(calls.filter(c => c.rpc === 'community_list_comments' && c.identity === 'newcomer').length, 0);
  });

  await run('denied feed hides old content and permits retry', { kind: 'student' }, async ({ page, failFeed, specialty }) => {
    const copy = COMMUNITY_COPY.en;
    await openCommunity(page, copy);
    await page.getByText(MESSAGE, { exact: true }).waitFor();
    failFeed();
    await page.getByLabel(copy.specialty).selectOption(specialty);
    await page.getByRole('alert').filter({ hasText: copy.failed }).waitFor();
    assert.equal(await page.getByText(MESSAGE, { exact: true }).count(), 0, 'Previously loaded comments are removed when access to a new read is denied');
    await page.getByRole('button', { name: copy.refresh, exact: true }).click();
    await page.getByText(MESSAGE, { exact: true }).waitFor();
  });

  await run('recovery callback password form', {}, async ({ page, sessions, calls }) => {
    const copy = COMMUNITY_COPY.en;
    const session = sessions.student;
    const url = new URL(localOrigin);
    url.searchParams.set('community', 'account');
    url.searchParams.set('recovery', '1');
    url.hash = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: '3600', token_type: 'bearer', type: 'recovery' }).toString();
    await page.goto(url.toString(), { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: copy.newPassword, exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash.includes('access_token'), false, 'Recovery credentials are consumed from the URL');
    await page.getByLabel(copy.password, { exact: true }).fill(PASSWORD);
    await page.getByLabel(copy.confirmPassword, { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: copy.updatePassword, exact: true }).click();
    await page.getByRole('heading', { name: copy.profile, exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: copy.passwordSaved }).waitFor();
    const passwordUpdates = calls.filter(c => c.rpc === 'user' && c.method === 'PUT');
    assert.equal(passwordUpdates.length, 1);
    assert.deepEqual(Object.keys(passwordUpdates[0].args).filter(key => !['code_challenge', 'code_challenge_method'].includes(key)), ['password'], 'Password recovery never changes identity, authorization metadata, role or email');
    assert.equal(await page.getByLabel(copy.password, { exact: true }).count(), 0, 'Saved recovery password is removed from the DOM');
  });

  for (const code of ['fr', 'ro']) for (const width of [320, 1440]) {
    await run(`member ${code} ${width}`, { kind: 'student', width }, async ({ page }) => {
      const copy = COMMUNITY_COPY[code];
      await language(page, fixtureDefinitions, code);
      await openCommunity(page, copy);
      await page.getByText(MESSAGE, { exact: true }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: copy.message, exact: true }).count(), 0);
      await noOverflow(page, `Member feed ${code}/${width}`);
      await page.screenshot({ path: `browser-qa.local/community-member-${code}-${width}.png`, fullPage: true });
      await openAccount(page, copy);
      await page.getByRole('heading', { name: copy.profile, exact: true }).waitFor();
      await noOverflow(page, `Member account ${code}/${width}`);
    });
  }
  assert.ok(passed > 0, 'At least one browser scenario must execute');
  console.log(`${passed} ${filter ? 'filtered ' : ''}community browser scenarios passed. Every Auth, community and research endpoint was intercepted; no account, email, visit or production data was created.`);
}
