import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const narrativeDirectory = path.join(projectDirectory, 'src', 'data', 'specialtyNarratives');
const specialistSourcePath = path.join(
  projectDirectory,
  'docs',
  'sources',
  'specialist-specialty-narratives-ro.txt',
);
const migrationPath = path.join(
  projectDirectory,
  'supabase',
  'migrations',
  '20260905090000_specialist_authored_narratives.sql',
);
const languages = ['en', 'ro', 'fr'];
const specialistSourceSha256 = '1E4C334306D56EE90CF007D57756860CC7690E301ABC83D768772F96EAB4E9E7';
const specialistPayloadSha256 = '5BAB0FAEEF926B14931708368C056184A044C17630AF1C8F76FD563C14FA0854';
const forbiddenTextPatterns = [
  ['replacement character', /�/u],
  ['common UTF-8 mojibake', /Ã|Â/u],
  ['incorrect Romanian breve character', /ǎ/u],
  ['legacy Romanian cedilla', /[şţŞŢ]/u],
];

async function readJson(fileName) {
  const content = await readFile(path.join(narrativeDirectory, fileName), 'utf8');
  return JSON.parse(content);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

async function validateTrackedSpecialistSource() {
  const source = await readFile(specialistSourcePath);
  assert(
    sha256(source) === specialistSourceSha256,
    'The tracked specialist source document differs from the reviewed attachment.',
  );
  return source.byteLength;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/gu, '\n');
}

function validateLocalizedText(value, field, minimumLength, maximumLength) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${field} must be an object`);
  assert(
    Object.keys(value).sort().join(',') === [...languages].sort().join(','),
    `${field} must contain exactly en, ro and fr`,
  );

  for (const language of languages) {
    const text = value[language];
    assert(typeof text === 'string', `${field}.${language} must be a string`);
    assert(text === text.trim(), `${field}.${language} must not have outer whitespace`);
    assert(text === text.normalize('NFC'), `${field}.${language} must use NFC Unicode normalization`);
    assert(
      text.length >= minimumLength && text.length <= maximumLength,
      `${field}.${language} must contain ${minimumLength}–${maximumLength} characters (received ${text.length})`,
    );
    for (const [label, pattern] of forbiddenTextPatterns) {
      assert(!pattern.test(text), `${field}.${language} contains ${label}`);
    }
  }
}

async function loadAndValidateNarratives() {
  const parts = await Promise.all(['part1.json', 'part2.json', 'part3.json'].map(readJson));
  const narratives = {};

  for (const [partIndex, part] of parts.entries()) {
    assert(part && typeof part === 'object' && !Array.isArray(part), `part${partIndex + 1}.json must contain an object`);
    for (const [name, narrative] of Object.entries(part)) {
      assert(!(name in narratives), `Duplicate specialty narrative: ${name}`);
      narratives[name] = narrative;
    }
  }

  const metadataSource = await readFile(
    path.join(projectDirectory, 'src', 'data', 'specialtyMetadata.ts'),
    'utf8',
  );
  const expectedNames = [...metadataSource.matchAll(/^  '([^']+)': \{$/gmu)].map((match) => match[1]);
  assert(expectedNames.length === 58, `Expected 58 canonical specialty names, received ${expectedNames.length}`);

  const actualNames = Object.keys(narratives);
  const missing = expectedNames.filter((name) => !(name in narratives));
  const unknown = actualNames.filter((name) => !expectedNames.includes(name));
  assert(missing.length === 0, `Missing specialty narratives: ${missing.join(', ')}`);
  assert(unknown.length === 0, `Unknown specialty narratives: ${unknown.join(', ')}`);
  assert(actualNames.length === 58, `Expected 58 unique narratives, received ${actualNames.length}`);

  let sourceReferenceCount = 0;
  for (const name of expectedNames) {
    const narrative = narratives[name];
    assert(narrative && typeof narrative === 'object' && !Array.isArray(narrative), `${name} must contain an object`);
    assert(
      Object.keys(narrative).sort().join(',') === ['fitProfile', 'overview', 'sourceReferences'].sort().join(','),
      `${name} must contain exactly overview, fitProfile and sourceReferences`,
    );
    validateLocalizedText(narrative.overview, `${name}.overview`, 20, 2000);
    validateLocalizedText(narrative.fitProfile, `${name}.fitProfile`, 20, 5000);
    assert(Array.isArray(narrative.sourceReferences), `${name}.sourceReferences must be an array`);
    sourceReferenceCount += narrative.sourceReferences.length;
    for (const [referenceIndex, reference] of narrative.sourceReferences.entries()) {
      assert(
        typeof reference === 'string' && reference.trim() === reference && reference.length >= 3,
        `${name}.sourceReferences[${referenceIndex}] must be a non-empty trimmed string`,
      );
    }
  }
  assert(sourceReferenceCount === 33, `Expected the 33 supplied bibliography entries, received ${sourceReferenceCount}`);
  assert(
    narratives.Pathology.sourceReferences.length === 0,
    'Pathology must not claim a bibliography because it is absent from the supplied source',
  );

  return { expectedNames, narratives };
}

function createMigration(expectedNames, narratives) {
  const payload = expectedNames.map((name) => ({
    name,
    descriptions: narratives[name].overview,
    clinical_summaries: narratives[name].fitProfile,
  }));
  const compactPayload = JSON.stringify(payload);
  assert(
    !compactPayload.includes('$specialty_narratives$'),
    'The generated JSON collides with the SQL dollar-quote delimiter',
  );

  return `BEGIN;

/*
 * Publishes the Romanian narratives supplied by the medical specialist and
 * their faithful French and English translations. Matching profiles and their
 * weights are copied without modification. The previous active snapshot
 * remains archived and auditable.
 * Generated by scripts/generate-specialty-narrative-migration.mjs.
 */
CREATE TEMP TABLE specialty_narrative_seed (
  name text PRIMARY KEY,
  descriptions jsonb NOT NULL,
  clinical_summaries jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO specialty_narrative_seed (name, descriptions, clinical_summaries)
SELECT item.name, item.descriptions, item.clinical_summaries
FROM jsonb_to_recordset($specialty_narratives$
${compactPayload}
$specialty_narratives$::jsonb) AS item(
  name text,
  descriptions jsonb,
  clinical_summaries jsonb
);

DO $publish_specialty_narratives$
DECLARE
  draft_version private.specialty_catalog_versions%ROWTYPE;
  active_version private.specialty_catalog_versions%ROWTYPE;
  narrative_version private.specialty_catalog_versions%ROWTYPE;
  resolved_checksum text;
  expected_count integer;
  actual_count integer;
BEGIN
  /* Match the portal publication lock order: draft first, then active. */
  SELECT version.* INTO draft_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'draft'
  FOR UPDATE;

  IF draft_version.id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Publish or discard the existing specialty catalog draft before applying multilingual narratives';
  END IF;

  SELECT version.* INTO active_version
  FROM private.specialty_catalog_versions AS version
  WHERE version.status = 'active'
  FOR UPDATE;

  IF active_version.id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'No active specialty catalog exists for the multilingual narrative publication';
  END IF;

  SELECT cardinality(private.specialty_catalog_v1()) INTO expected_count;
  SELECT count(*) INTO actual_count FROM specialty_narrative_seed;
  IF actual_count <> expected_count THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'The multilingual narrative seed does not cover the complete specialty catalog';
  END IF;

  INSERT INTO private.specialty_catalog_versions (
    label,
    status,
    lock_version,
    parent_version_id,
    note,
    created_by
  ) VALUES (
    'medical-specialties-specialist-source-pending',
    'draft',
    1,
    active_version.id,
    'Romanian specialty narratives supplied by a medical specialist, with faithful French and English translations',
    NULL
  )
  RETURNING * INTO narrative_version;

  INSERT INTO private.specialty_catalog_entries (
    version_id,
    name,
    category,
    descriptions,
    clinical_summaries,
    profile,
    updated_by,
    updated_at
  )
  SELECT
    narrative_version.id,
    entry.name,
    entry.category,
    seed.descriptions,
    seed.clinical_summaries,
    entry.profile,
    NULL,
    now()
  FROM private.specialty_catalog_entries AS entry
  JOIN specialty_narrative_seed AS seed ON seed.name = entry.name
  WHERE entry.version_id = active_version.id;

  SELECT count(*) INTO actual_count
  FROM private.specialty_catalog_entries AS entry
  WHERE entry.version_id = narrative_version.id;

  IF actual_count <> expected_count
     OR EXISTS (
       SELECT 1
       FROM private.specialty_catalog_entries AS entry
       WHERE entry.version_id = narrative_version.id
         AND private.valid_specialty_catalog_entry(
           entry.name,
           entry.category,
           entry.descriptions,
           entry.clinical_summaries,
           entry.profile
         ) IS NOT TRUE
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'The multilingual specialty catalog is incomplete or invalid';
  END IF;

  resolved_checksum := private.specialty_catalog_content_hash(narrative_version.id);

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'archived'
  WHERE version.id = active_version.id;

  UPDATE private.specialty_catalog_versions AS version
  SET status = 'active',
      label = 'medical-specialties-r' || narrative_version.revision::text,
      lock_version = version.lock_version + 1,
      published_at = now(),
      checksum = resolved_checksum
  WHERE version.id = narrative_version.id
  RETURNING * INTO narrative_version;

  INSERT INTO private.specialty_catalog_audit (
    actor_user_id,
    actor_role,
    action,
    version_id,
    version_revision,
    note,
    before_value,
    after_value
  ) VALUES (
    NULL,
    'system',
    'published',
    narrative_version.id,
    narrative_version.revision,
    narrative_version.note,
    jsonb_build_object(
      'active_version_id', active_version.id,
      'active_revision', active_version.revision
    ),
    jsonb_build_object(
      'active_version_id', narrative_version.id,
      'active_revision', narrative_version.revision,
      'content_hash', resolved_checksum,
      'localized_narratives', expected_count,
      'specialist_source_sha256', '${specialistSourceSha256}'
    )
  );
END;
$publish_specialty_narratives$;

COMMIT;
`;
}

const sourceBytes = await validateTrackedSpecialistSource();
const { expectedNames, narratives } = await loadAndValidateNarratives();
assert(
  sha256(JSON.stringify(narratives)) === specialistPayloadSha256,
  'The canonical localized payload differs from the independently reviewed specialist-source transcription.',
);
const migration = normalizeLineEndings(createMigration(expectedNames, narratives));
const writeRequested = process.argv.includes('--write');
let committedMigration = null;

try {
  committedMigration = normalizeLineEndings(await readFile(migrationPath, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (writeRequested) {
  assert(
    committedMigration === null || committedMigration === migration,
    'Refusing to overwrite a different migration. Create a new timestamped migration instead.',
  );
  await writeFile(migrationPath, migration, 'utf8');
  committedMigration = migration;
}

assert(
  committedMigration !== null,
  'The generated migration is missing. Run npm run generate:specialty-content-migration once.',
);
assert(
  committedMigration === migration,
  'The committed specialty narrative migration is out of sync with the canonical JSON files.',
);

process.stdout.write(`${JSON.stringify({
  specialties: expectedNames.length,
  languages,
  sourceBytes,
  specialistSourceSha256,
  specialistPayloadSha256,
  migrationBytes: Buffer.byteLength(migration),
  wroteMigration: writeRequested,
  migrationInSync: true,
  migrationPath: path.relative(projectDirectory, migrationPath).replaceAll('\\', '/'),
})}\n`);
