// LOCAL SYNTHETIC TEST ONLY. Never reads .env or accepts a hosted URL.
// supabase status --workdir .local/docker-verification --output json |
//   node supabase/tests/community-http.mjs
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const API = 'http://127.0.0.1:55321';
const CONTAINER = 'supabase_db_q-pro-verify-20260925';
const accounts = [];
const commentIds = [];
let checks = 0;
let originalEnabled;
let admin;
let publicKey;
let phase = 'isolated local configuration';
let failed = false;

function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log(`ok ${checks} - ${label}`);
}

function literalUuid(id) {
  assert.match(id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u);
  return `'${id}'::uuid`;
}

function sql(statement) {
  const result = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-X', '-qAt',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
    input: `SET statement_timeout='15s'; SET lock_timeout='5s';\n${statement}\n`,
    encoding: 'utf8', windowsHide: true, timeout: 25_000, maxBuffer: 512 * 1024,
  });
  // Do not print SQL error bodies or account details into shared logs.
  assert.ok(!result.error && result.status === 0, 'isolated SQL completed');
  return result.stdout.trim();
}

async function localFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert.equal(url.origin, API, 'HTTP must stay on isolated local API');
  assert.ok(!url.username && !url.password, 'URL must not contain credentials');
  return fetch(input, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
}

async function rpc(name, body = {}, account) {
  const response = await localFetch(`${API}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json',
      ...(account ? { Authorization: `Bearer ${account.token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, headers: response.headers, data: await response.json() };
}

async function account() {
  const email = `community-local-${randomUUID()}@example.test`;
  const password = `LocalOnlyA1!${randomBytes(24).toString('base64url')}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { verified: true, role: 'professor', can_edit: true } });
  assert.ok(!created.error && created.data.user?.id, 'synthetic local Auth account created');
  const identity = { id: created.data.user.id, token: null, sessionId: null };
  accounts.push(identity); // Track before subsequent calls so failures clean up.
  const client = createClient(API, publicKey, { global: { fetch: localFetch },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ok(!signedIn.error && signedIn.data.session?.access_token, 'synthetic local Auth login succeeded');
  identity.token = signedIn.data.session.access_token;
  const claims = JSON.parse(Buffer.from(identity.token.split('.')[1], 'base64url').toString('utf8'));
  identity.sessionId = claims.session_id;
  literalUuid(identity.sessionId);
  return identity;
}

async function profile(identity, role, specialty, country = null) {
  return rpc('community_save_profile', { p_role: role, p_specialty: specialty,
    p_country_code: country, p_map_consent: country !== null,
    p_terms_version: 'community-membership-v1' }, identity);
}

try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString('utf8');
    assert.ok(input.length < 128 * 1024, 'bounded local status input');
  }
  const config = JSON.parse(input);
  assert.equal(config.API_URL, API, 'only isolated verification project accepted');
  assert.ok(config.DB_URL?.includes('127.0.0.1:55322/'), 'only isolated verification database accepted');
  publicKey = config.PUBLISHABLE_KEY ?? config.ANON_KEY;
  const adminKey = config.SECRET_KEY ?? config.SERVICE_ROLE_KEY;
  assert.ok(publicKey && adminKey, 'local API keys available only in memory');
  originalEnabled = sql('SELECT enabled FROM community.settings WHERE singleton;');
  assert.equal(originalEnabled, 'f', 'local feature starts disabled');
  assert.equal(sql('SELECT count(*) FROM community.members;'), '0', 'community test schema must be empty');
  admin = createClient(API, adminKey, { global: { fetch: localFetch },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const ready = await rpc('community_status');
  check(ready.status === 200 && ready.data.enabled === false, 'guest can read disabled launch state');
  check(ready.headers.get('cache-control')?.includes('no-store'), 'readiness sends HTTP no-store');
  const guest = await rpc('community_list_comments');
  check(guest.status === 401 || guest.status === 403, 'guest feed access denied at real HTTP API');
  const hiddenSchema = await localFetch(`${API}/rest/v1/rpc/community_status`, {
    method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json',
      'Content-Profile': 'community' }, body: '{}',
  });
  check(hiddenSchema.status === 406, 'community schema is not directly exposed through PostgREST');

  phase = 'real local authentication and guarded profile setup';
  const student = await account();
  const specialist = await account();
  const moderator = await account();
  sql(`INSERT INTO private.researchers(user_id,portal_role,enabled) VALUES (${literalUuid(moderator.id)},'doctor',true);`);
  const beforeProfile = await rpc('community_profile', {}, student);
  check(beforeProfile.status === 200 && beforeProfile.data === null, 'real GoTrue session_id passes identity guard before membership');
  const deniedSetup = await profile(student, 'student', null);
  check(deniedSetup.status === 403, 'valid account cannot join while database gate is closed');
  const pendingModeration = await rpc('community_admin_members', {}, moderator);
  check(pendingModeration.status === 200, 'staff moderation setup works while community remains closed');
  sql('UPDATE community.settings SET enabled=true WHERE singleton;');
  const studentProfile = await profile(student, 'student', null);
  check(studentProfile.status === 200 && !studentProfile.data.verified, 'ordinary confirmed account becomes unprivileged member');
  const specialistProfile = await profile(specialist, 'specialist', 'Cardiology', 'RO');
  check(specialistProfile.status === 200 && !specialistProfile.data.verified, 'self-declared specialist starts unverified despite forged metadata');
  const forbiddenAdmin = await rpc('community_admin_members', {}, student);
  check(forbiddenAdmin.status === 403, 'ordinary member cannot enumerate identities');
  const research = await rpc('research_response_page', {}, student);
  check(research.status === 403, 'member cannot access research exports');

  phase = 'concurrent idempotency and bounded submission';
  const id = randomUUID();
  commentIds.push(id);
  const payload = { p_id: id, p_body: 'Synthetic local specialist perspective, not a real contribution.',
    p_language: 'en', p_consent: true, p_consent_version: 'community-publication-v1' };
  const retries = await Promise.all(Array.from({ length: 24 }, () => rpc('community_submit_comment', payload, specialist)));
  check(retries.every(result => result.status === 200 && result.data.id === id && result.data.status === 'pending'),
    'twenty-four concurrent identical receipts all return the same pending comment');
  check(sql(`SELECT count(*) FROM community.comments WHERE author_id=${literalUuid(specialist.id)};`) === '1',
    'concurrent retries create exactly one database row');
  const many = Array.from({ length: 12 }, () => randomUUID());
  commentIds.push(...many);
  const distinct = await Promise.all(many.map(p_id => rpc('community_submit_comment', { ...payload, p_id }, specialist)));
  check(distinct.filter(result => result.status === 200).length === 4 &&
    distinct.filter(result => result.status !== 200 && result.data.code === '54000').length === 8,
  'concurrent distinct submissions stop atomically at five accepted per day');
  check(sql(`SELECT count(*) FROM community.comments WHERE author_id=${literalUuid(specialist.id)};`) === '5',
    'daily cap cannot be bypassed by parallel requests');
  const pendingFeed = await rpc('community_list_comments', {}, student);
  check(pendingFeed.status === 200 && pendingFeed.data.length === 0, 'unapproved posts remain absent from the real member feed');

  phase = 'verification, consent, moderation and withdrawal';
  const approveBeforeVerification = await rpc('community_admin_review_comment',
    { p_id: id, p_approve: true, p_note: 'Synthetic local moderation decision' }, moderator);
  check(approveBeforeVerification.status === 403, 'moderation cannot bypass specialist verification');
  const verify = await rpc('community_admin_review_member', { p_id: specialist.id, p_verified: true,
    p_suspended: false, p_note: 'Synthetic qualification verification' }, moderator);
  check(verify.status === 200 && verify.data === true, 'server-authorized moderator can verify specialist');
  const approve = await rpc('community_admin_review_comment',
    { p_id: id, p_approve: true, p_note: 'Synthetic local moderation decision' }, moderator);
  check(approve.status === 200 && approve.data === true, 'verified consented post can be approved');
  const feed = await rpc('community_list_comments', {}, student);
  check(feed.status === 200 && feed.data.length === 1, 'member feed shows exactly the approved post');
  check(Object.keys(feed.data[0]).sort().join(',') === 'body,id,language,specialty',
    'feed projection contains no identity, geography or internal fields');
  check(feed.headers.get('cache-control')?.includes('no-store'), 'member feed HTTP response is not cacheable');
  const reports = await Promise.all(Array.from({ length: 8 }, () => rpc('community_report_comment',
    { p_id: id, p_reason: 'other' }, student)));
  check(reports.every(result => result.status === 200 && result.data === true), 'parallel report retries are idempotent');
  check(sql(`SELECT count(*) FROM community.reports WHERE comment_id=${literalUuid(id)};`) === '1',
    'parallel repeated reporter produces one report');
  const deniedWithdrawal = await rpc('community_withdraw_comment', { p_id: id }, student);
  check(deniedWithdrawal.status === 403, 'other members cannot withdraw a specialist post');
  const suspend = await rpc('community_admin_review_member', { p_id: specialist.id, p_verified: true,
    p_suspended: true, p_note: 'Synthetic suspended account test' }, moderator);
  check(suspend.status === 200, 'moderator can suspend member');
  sql('UPDATE community.settings SET enabled=false WHERE singleton;');
  const optOut = await rpc('community_withdraw_map_consent', {}, specialist);
  check(optOut.status === 200 && optOut.data === true, 'map opt-out works for suspended member during shutdown');
  const self = await rpc('community_profile', {}, specialist);
  check(self.status === 200 && self.data.country_code === null && self.data.map_consent === false && self.data.suspended,
    'location opt-out erases country without lifting suspension');
  const withdraw = await rpc('community_withdraw_comment', { p_id: id }, specialist);
  check(withdraw.status === 200 && withdraw.data === true, 'author can withdraw comment while suspended and closed');
  const cannotRestore = await rpc('community_admin_review_comment',
    { p_id: id, p_approve: true, p_note: 'Synthetic forbidden restoration' }, moderator);
  check(cannotRestore.status === 400, 'moderator cannot resurrect withdrawn comment');

  phase = 'live session revocation';
  sql(`DELETE FROM auth.sessions WHERE id=${literalUuid(student.sessionId)} AND user_id=${literalUuid(student.id)};`);
  const revoked = await rpc('community_profile', {}, student);
  check(revoked.status === 403, 'real previously valid access token fails immediately after session revocation');
} catch (error) {
  failed = true;
  // Error data can contain tokens, request bodies or credentials. Print only
  // a known operation label and assertion text from this controlled harness.
  console.error(`Community local HTTP test failed during: ${phase}`);
  if (error instanceof assert.AssertionError) console.error(error.message.split('\n')[0]);
} finally {
  try {
    if (originalEnabled === 'f' || originalEnabled === 't') {
      sql(`UPDATE community.settings SET enabled=${originalEnabled === 't'} WHERE singleton;`);
    }
    if (accounts.length) {
      const ids = accounts.map(value => literalUuid(value.id)).join(',');
      const subjects = [...accounts.map(value => value.id), ...commentIds].map(literalUuid).join(',');
      // Exact synthetic identifiers only; never truncate or delete by date.
      sql(`DELETE FROM community.audit WHERE actor_id IN (${ids}) OR subject_id IN (${subjects});`);
      for (const identity of accounts) {
        const result = await admin.auth.admin.deleteUser(identity.id);
        assert.ok(!result.error, 'exact synthetic Auth account removed');
      }
      check(sql(`SELECT count(*) FROM auth.users WHERE id IN (${ids});`) === '0', 'synthetic local Auth accounts removed');
      check(sql('SELECT count(*) FROM community.members;') === '0', 'synthetic community memberships and comments cascaded away');
      check(sql('SELECT enabled FROM community.settings WHERE singleton;') === originalEnabled, 'original closed launch state restored');
    }
  } catch {
    failed = true;
    console.error('Cleanup did not fully complete; inspect isolated local test database before rerunning.');
  }
}
console.log(`Community local HTTP verification: ${checks} checks, ${failed ? 'FAILED' : 'PASSED'}.`);
process.exitCode = failed ? 1 : 0;
