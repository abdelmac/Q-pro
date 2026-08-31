import { readFileSync } from 'node:fs';

function readLocalEnv() {
  const values = {};
  for (const rawLine of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const fileEnv = readLocalEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

assert(supabaseUrl, 'VITE_SUPABASE_URL is missing.');
assert(publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY is missing.');

const headers = {
  apikey: publishableKey,
  'Content-Type': 'application/json',
};

const catalogResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_active_specialty_catalog`, {
  method: 'POST',
  headers,
  body: '{}',
});
assert(catalogResponse.ok, `Public catalog RPC failed with HTTP ${catalogResponse.status}.`);

const catalog = await catalogResponse.json();
assert(isRecord(catalog), 'The public catalog payload is not an object.');
assert(isRecord(catalog.version), 'The public catalog has no version object.');
assert(Number.isInteger(catalog.version.revision) && catalog.version.revision >= 1, 'Invalid catalog revision.');
assert(typeof catalog.version.id === 'string' && catalog.version.id.length > 0, 'Invalid catalog UUID.');
assert(typeof catalog.version.content_hash === 'string' && /^md5:[0-9a-f]{32}$/u.test(catalog.version.content_hash), 'Invalid catalog checksum.');
assert(Array.isArray(catalog.specialties) && catalog.specialties.length === 58, 'The active catalog must contain exactly 58 specialties.');

const names = new Set();
let profileTraitAssignments = 0;
for (const specialty of catalog.specialties) {
  assert(isRecord(specialty), 'A specialty payload is invalid.');
  assert(typeof specialty.name === 'string' && specialty.name.length > 0, 'A specialty name is missing.');
  assert(!names.has(specialty.name), `Duplicate specialty: ${specialty.name}.`);
  names.add(specialty.name);
  assert(isRecord(specialty.descriptions), `Descriptions are missing for ${specialty.name}.`);
  assert(isRecord(specialty.clinical_summaries), `Clinical summaries are missing for ${specialty.name}.`);
  for (const language of ['en', 'fr', 'ro']) {
    assert(typeof specialty.descriptions[language] === 'string' && specialty.descriptions[language].length > 0, `Missing ${language} description for ${specialty.name}.`);
    assert(typeof specialty.clinical_summaries[language] === 'string' && specialty.clinical_summaries[language].length > 0, `Missing ${language} clinical summary for ${specialty.name}.`);
  }
  assert(isRecord(specialty.profile) && Object.keys(specialty.profile).length > 0, `Profile is empty for ${specialty.name}.`);
  for (const [trait, pair] of Object.entries(specialty.profile)) {
    assert(Array.isArray(pair) && pair.length === 2, `Invalid pair for ${specialty.name}.${trait}.`);
    const [target, importance] = pair;
    assert(Number.isFinite(target) && target >= 0 && target <= 100, `Invalid target for ${specialty.name}.${trait}.`);
    assert(Number.isInteger(importance) && importance >= 1 && importance <= 3, `Invalid importance for ${specialty.name}.${trait}.`);
    profileTraitAssignments += 1;
  }
}

const cardiology = catalog.specialties.find(({ name }) => name === 'Cardiology');
assert(cardiology?.descriptions?.fr?.includes('Cœur'), 'The French catalog text is not UTF-8 clean.');
const pediatricCardiology = catalog.specialties.find(({ name }) => name === 'Pediatric Cardiology');
assert(pediatricCardiology?.descriptions?.ro?.includes('Îngrijirea'), 'The Romanian catalog text is not UTF-8 clean.');

const directTableResponse = await fetch(`${supabaseUrl}/rest/v1/student_responses?select=id&limit=1`, { headers });
assert([401, 403].includes(directTableResponse.status), `Anonymous direct table access was not rejected (HTTP ${directTableResponse.status}).`);

const anonymousEditorResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_specialty_catalog_draft`, {
  method: 'POST',
  headers,
  body: '{}',
});
assert([401, 403].includes(anonymousEditorResponse.status), `Anonymous editor access was not rejected (HTTP ${anonymousEditorResponse.status}).`);

console.log(JSON.stringify({
  catalogRpc: true,
  revision: catalog.version.revision,
  specialties: catalog.specialties.length,
  uniqueSpecialties: names.size,
  profileTraitAssignments,
  multilingualEncoding: true,
  anonymousDirectTableAccessRejected: true,
  anonymousEditorAccessRejected: true,
}));
