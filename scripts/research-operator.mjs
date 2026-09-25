import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, open, realpath, rm, rmdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep, parse } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { Worker } from 'node:worker_threads';
import { execFileSync } from 'node:child_process';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowedFilters = new Set(['respondent_type', 'language', 'country_code', 'specialty', 'study_year', 'date_from', 'date_to',
  'experience_min', 'experience_max', 'satisfaction_min', 'satisfaction_max', 'rechoice', 'intention_to_change',
  'questionnaire_version', 'schema_version', 'consent_version', 'scoring_version', 'specialty_config_revision']);
const MAX_ROWS = 5000;
const PAGE_LIMIT = 100;
const MAX_DATASET_BYTES = 32 * 1024 * 1024;
const MAX_EXPORT_BYTES = 128 * 1024 * 1024;
const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;

export function validateOperatorConfiguration({ filters, outputDirectory, environment = process.env }) {
  if (!filters || Array.isArray(filters) || typeof filters !== 'object' || Buffer.byteLength(JSON.stringify(filters)) > 4096
      || Object.entries(filters).some(([key, value]) => !allowedFilters.has(key)
        || !['string', 'number'].includes(typeof value) || !String(value).length || String(value).length > 180
        || (typeof value === 'number' && !Number.isFinite(value)))) throw new Error('Invalid filters; use the documented research filter fields.');
  if (!isAbsolute(outputDirectory || '') || resolve(outputDirectory) === parse(resolve(outputDirectory)).root) {
    throw new Error('Choose an explicit absolute private output directory, not a filesystem root.');
  }
  const url = new URL(environment.RESEARCH_SUPABASE_URL || 'https://invalid.example');
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port) {
    throw new Error('RESEARCH_SUPABASE_URL must be a standard HTTPS Supabase project origin.');
  }
  const key = environment.RESEARCH_SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Use a publishable key, never a service-role/secret key.');
  const token = environment.RESEARCH_ACCESS_TOKEN || '';
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { /* reject below */ }
  // This local guard is NOT authorization; the server validates the JWT and live role.
  if (token.split('.').length !== 3 || claims?.role !== 'authenticated' || typeof claims?.sub !== 'string'
      || !Number.isFinite(claims?.exp) || claims.exp * 1000 <= Date.now()) {
    throw new Error('Use an unexpired signed-in user access token; privileged tokens are refused.');
  }
  return { origin: url.origin, key, token };
}

async function readBoundedJson(response, limit = 8 * 1024 * 1024) {
  if (!response.body) throw new Error('Missing RPC response body.');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('RPC response exceeded its byte limit; narrow the cohort.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid RPC JSON.'); }
}

async function privateOutputDirectory(outputDirectory) {
  const requested = resolve(outputDirectory);
  const existingParent = await realpath(dirname(requested));
  const candidate = join(existingParent, requested.split(sep).at(-1));
  const withinRepository = path => {
    const difference = relative(repositoryRoot, path);
    return difference === '' || (difference !== '..' && !difference.startsWith(`..${sep}`) && !isAbsolute(difference));
  };
  if (withinRepository(candidate)) throw new Error('Private exports must be outside the repository.');
  await mkdir(candidate, { mode: 0o700 });
  return candidate;
}

async function executeWorker(entries, directory, signal, onProgress, maxBytes, candidate) {
  const buildDirectory = await mkdtemp(join(tmpdir(), 'qpro-research-code-'));
  const bundlePath = join(buildDirectory, 'operator-worker.mjs');
  let worker; let activeFile; let activeName; let hash; let bytes = 0; let total = 0;
  const files = [];
  try {
    await build({ entryPoints: [join(repositoryRoot, 'scripts/research-operator-worker.ts')],
      bundle: true, platform: 'node', format: 'esm', outfile: bundlePath,
      tsconfig: join(repositoryRoot, 'tsconfig.app.json'), logLevel: 'silent' });
    signal.throwIfAborted();
    const bundledSource = await readFile(bundlePath);
    const codeChecksum = sha256(bundledSource);
    await writeFile(join(directory, 'shared-analysis-worker.mjs'), bundledSource, { mode: 0o600, flag: 'wx' });
    files.push({ name: 'shared-analysis-worker.mjs', bytes: bundledSource.length, checksum: codeChecksum });
    signal.throwIfAborted();
    worker = new Worker(pathToFileURL(bundlePath), { workerData: { entries, candidate }, env: {}, resourceLimits: { maxOldGenerationSizeMb: 512 } });
    const result = await new Promise((resolveRun, rejectRun) => {
      const stop = () => { void worker.terminate(); rejectRun(new Error('Analysis cancelled or timed out.')); };
      signal.addEventListener('abort', stop, { once: true });
      let finished = false;
      worker.on('error', () => rejectRun(new Error('Analysis worker failed.')));
      worker.on('exit', code => { signal.removeEventListener('abort', stop); if (!finished) rejectRun(new Error(`Analysis worker stopped (code ${code}).`)); });
      worker.on('message', async message => {
        try {
          if (message.type === 'progress') { onProgress({ phase: 'analyzing', loaded: message.analyzed }); return; }
          if (message.type === 'start') {
            if (activeFile || !/^[a-z-]+\.(csv|json)$/.test(message.name)) throw new Error('Invalid export stream.');
            activeName = message.name; bytes = 0; hash = createHash('sha256');
            activeFile = await open(join(directory, activeName), 'wx', 0o600);
          } else if (message.type === 'chunk') {
            if (!activeFile || typeof message.text !== 'string') throw new Error('Invalid export chunk.');
            const chunk = Buffer.from(message.text); total += chunk.length; bytes += chunk.length;
            if (total > maxBytes) throw new Error('Export exceeded 128 MiB limit; narrow the cohort.');
            hash.update(chunk); await activeFile.writeFile(chunk);
          } else if (message.type === 'end') {
            await activeFile.close(); activeFile = null;
            files.push({ name: activeName, bytes, checksum: `sha256:${hash.digest('hex')}` });
          } else if (message.type === 'completed') {
            finished = true; resolveRun({ ...message, files, codeChecksum }); return;
          } else { throw new Error('Analysis worker failed.'); }
          worker.postMessage({ acknowledged: true });
        } catch (error) { void worker.terminate(); rejectRun(error); }
      });
    });
    return result;
  } finally {
    await worker?.terminate();
    await activeFile?.close();
    await rm(bundlePath, { force: true });
    // This unique temporary directory contains only bundled public source code.
    await rmdir(buildDirectory);
  }
}

export async function runResearchOperator({ filters, outputDirectory, environment = process.env,
  fetchImpl = fetch, signal: suppliedSignal, onProgress = () => {}, timeoutMs = 180_000,
  requestTimeoutMs = 20_000, maxExportBytes = MAX_EXPORT_BYTES, candidate = null }) {
  const config = validateOperatorConfiguration({ filters, outputDirectory, environment });
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) throw new Error('Invalid analysis timeout.');
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000
      || !Number.isInteger(maxExportBytes) || maxExportBytes < 1 || maxExportBytes > MAX_EXPORT_BYTES) {
    throw new Error('Invalid request timeout or export byte limit.');
  }
  if (candidate != null && (typeof candidate !== 'object' || Buffer.byteLength(JSON.stringify(candidate)) > 512 * 1024)) {
    throw new Error('Candidate model must be JSON under 512 KiB.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = suppliedSignal ? AbortSignal.any([suppliedSignal, controller.signal]) : controller.signal;
  const startedAt = new Date().toISOString();
  let directory;
  const rpc = async (name, args) => {
    signal.throwIfAborted();
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]);
    let response;
    try {
      response = await fetchImpl(`${config.origin}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', cache: 'no-store',
        headers: { apikey: config.key, Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: requestSignal });
    } catch { throw new Error(`Network failure, cancellation or timeout during ${name}.`); }
    if (!response.ok) throw new Error(`${name} refused (HTTP ${response.status}); verify access, quota and filters.`);
    return readBoundedJson(response);
  };
  try {
    onProgress({ phase: 'snapshot', loaded: 0 });
    const first = await rpc('create_research_analysis_run', { p_filters: filters, p_parameters: {} });
    if (first.status !== 'completed' || !/^[0-9a-f-]{36}$/i.test(first.id)
        || typeof first.created_at !== 'string' || !Number.isFinite(Date.parse(first.created_at))
        || !/^md5:[0-9a-f]{32}$/.test(first.dataset_checksum)
        || !Number.isInteger(first.snapshot_count) || first.snapshot_count < 0 || first.snapshot_count > MAX_ROWS) {
      throw new Error('Invalid or oversized server snapshot.');
    }
    const entries = []; const identities = new Set(); const cursors = new Set();
    let cursor = null; let payloadBytes = 0;
    do {
      const page = await rpc('research_response_page', { p_filters: filters, p_limit: PAGE_LIMIT, p_cursor: cursor, p_sort: 'oldest' });
      if (!Array.isArray(page.rows) || page.rows.length > PAGE_LIMIT) throw new Error('Invalid bounded page.');
      for (const entry of page.rows) {
        if (!['specialist', 'student', 'non_medical'].includes(entry.respondent_type)
            || typeof entry.response?.id !== 'string' || typeof entry.response.created_at !== 'string') throw new Error('Invalid response identity.');
        const id = `${entry.respondent_type}:${entry.response.id}`;
        if (identities.has(id)) throw new Error('Duplicate response identity in paginated cohort.');
        identities.add(id); entries.push(entry); payloadBytes += Buffer.byteLength(JSON.stringify(entry));
        if (entries.length > MAX_ROWS || payloadBytes > MAX_DATASET_BYTES) throw new Error('Cohort exceeds 5000 rows or 32 MiB; narrow filters.');
      }
      cursor = page.next_cursor;
      if (cursor != null) {
        const key = canonical(cursor);
        if (cursors.has(key) || page.rows.length === 0) throw new Error('Pagination cursor did not advance.');
        cursors.add(key);
      }
      onProgress({ phase: 'download', loaded: entries.length, total: first.snapshot_count });
    } while (cursor != null);
    if (entries.length !== first.snapshot_count) throw new Error('Cohort count changed during download; no completed export.');
    signal.throwIfAborted();
    directory = await privateOutputDirectory(outputDirectory);
    await writeFile(join(directory, 'RUN_STATUS.json'), JSON.stringify({ status: 'in_progress', started_at: startedAt }), { mode: 0o600, flag: 'wx' });
    const generated = await executeWorker(entries, directory, signal, onProgress, Math.min(maxExportBytes, MAX_EXPORT_BYTES), candidate);
    onProgress({ phase: 'recheck', loaded: entries.length });
    const final = await rpc('create_research_analysis_run', { p_filters: filters, p_parameters: {} });
    if (final.status !== 'completed' || first.dataset_checksum !== final.dataset_checksum || first.snapshot_count !== final.snapshot_count) {
      throw new Error('Cohort checksum changed; discard this partial export and retry.');
    }
    let revision = 'unavailable';
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }).trim(); } catch { /* checksum remains authoritative for local source */ }
    const manifest = {
      status: 'completed', operator_version: 'research-operator-v1', started_at: startedAt,
      completed_at: new Date().toISOString(), elapsed_ms: Date.now() - Date.parse(startedAt),
      filters, server_run_id: first.id, recheck_run_id: final.id, snapshot_created_at: first.created_at,
      source_backend_origin: config.origin,
      server_dataset_checksum: first.dataset_checksum, downloaded_content_checksum: sha256(canonical(entries)),
      server_model_versions: first.model_versions, counts: generated.eligibility,
      server_summary: first.results?.summary ?? null,
      model_checksum: generated.modelChecksum, engine_revision: generated.engineRevision,
      candidate_model_checksum: generated.candidateChecksum,
      candidate_input_checksum: candidate == null ? null : sha256(canonical(candidate)),
      analysis_version: generated.analysisVersion, operator_bundle_checksum: generated.codeChecksum, git_revision: revision,
      ranking_basis: 'repository_source_catalog_default_priorities_not_original_personalized_ranking',
      historical_missing_settings: 'unavailable_not_reconstructed',
      cutoff: { date_filters: { from: filters.date_from ?? null, through_inclusive_utc_day: filters.date_to ?? null },
        earliest_loaded: entries[0]?.response.created_at ?? null, latest_loaded: entries.at(-1)?.response.created_at ?? null,
        consistency: 'before_and_after_server_checksum_and_count_match_not_a_long_lived_database_snapshot' },
      files: generated.files,
    };
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
    await writeFile(join(directory, 'RUN_STATUS.json'), JSON.stringify({ status: 'completed', completed_at: manifest.completed_at }), { mode: 0o600 });
    onProgress({ phase: 'completed', loaded: entries.length });
    return { outputDirectory: directory, manifest };
  } catch (error) {
    if (directory) await writeFile(join(directory, 'RUN_STATUS.json'), JSON.stringify({ status: 'failed', started_at: startedAt,
      instruction: 'Partial private output. Not a completed reproducible export; review securely before removal.' }), { mode: 0o600 }).catch(() => {});
    throw error;
  } finally { clearTimeout(timer); }
}

async function cli() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/research-operator.mjs --filters /absolute/filters.json --out /absolute/private/new-run-directory [--candidate-catalog /absolute/frozen-model.json]\nRequires RESEARCH_SUPABASE_URL, RESEARCH_SUPABASE_PUBLISHABLE_KEY and RESEARCH_ACCESS_TOKEN environment variables. No credentials in arguments. Ctrl+C cancels.');
    return;
  }
  if (![4, 6].includes(args.length) || args[0] !== '--filters' || args[2] !== '--out'
      || (args.length === 6 && args[4] !== '--candidate-catalog')) throw new Error('Use --help for required explicit inputs.');
  const content = await readFile(args[1], 'utf8');
  if (Buffer.byteLength(content) > 4096) throw new Error('Filters file exceeds 4096 bytes.');
  const parseInput = (value, label) => {
    try { return JSON.parse(value); } catch { throw new Error(`Invalid ${label} JSON; file contents are not logged.`); }
  };
  let candidate = null;
  if (args.length === 6) {
    const model = await readFile(args[5], 'utf8');
    if (Buffer.byteLength(model) > 512 * 1024) throw new Error('Candidate model exceeds 512 KiB.');
    candidate = parseInput(model, 'candidate');
  }
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  const result = await runResearchOperator({ filters: parseInput(content, 'filter'), outputDirectory: args[3], candidate, signal: controller.signal,
    onProgress: progress => console.log(`${progress.phase}: ${progress.loaded ?? 0} submissions${progress.total == null ? '' : ` / ${progress.total}`}`) });
  console.log(`Completed private export: ${result.outputDirectory}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => { console.error(error instanceof Error ? error.message : 'Research operator failed.'); process.exitCode = 1; });
}
