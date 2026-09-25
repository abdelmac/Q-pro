# Bounded private research evaluation/export

`scripts/research-operator.mjs` is an **operator-run command**, not a public endpoint, background job service, browser whole-database loader or automatic model-calibration system. It uses the same TypeScript scoring and CSV serializers as the dashboard. No production data was used to implement or test it.

## Before running

Use Node 24 and `npm ci` in a reviewed checkout. Apply the reviewed research RPC migration first, through the normal approved deployment procedure. The operator must already have an authorized researcher/doctor/professor account. Specialist participant status is not sufficient.

Provide these through the operator's approved secret-injection/password-manager mechanism, **not command arguments, Git, terminal transcripts or pasted logs**:

- `RESEARCH_SUPABASE_URL`: the standard HTTPS project origin, e.g. `https://your-project.supabase.co`.
- `RESEARCH_SUPABASE_PUBLISHABLE_KEY`: a publishable key beginning `sb_publishable_`.
- `RESEARCH_ACCESS_TOKEN`: the current, unexpired access token of the authorized signed-in user. The CLI does not ask for a password or refresh/store credentials. An expired session requires a new authorized session and restart.

Secret/service-role keys are refused. Decoding the token locally is only an input safety check; Supabase verifies its signature/session and the live server-side role on every RPC. Redirects are refused to avoid forwarding authorization to another origin. Only standard Supabase project domains are supported by this first CLI version.

Prepare a private filter JSON file with the dashboard's existing filter names. Example:

```json
{
  "questionnaire_version": "q81-v1",
  "respondent_type": "specialist",
  "date_from": "2026-09-01",
  "date_to": "2026-09-30"
}
```

`date_to` includes that whole UTC day. Omit an optional filter instead of inventing a metadata value. An empty object is allowed only if the resulting cohort fits all bounds. Country `missing` explicitly selects absent geography. Server-side filter validation remains authoritative.

Choose a **new, nonexisting directory outside the repository**, under an existing approved encrypted parent directory. This prevents overwriting an earlier export or publishing private data accidentally. Restrict Windows ACLs yourself: POSIX file modes do not establish Windows encryption or a complete ACL policy.

```sh
node scripts/research-operator.mjs --help
node scripts/research-operator.mjs --filters /absolute/private/filters.json --out /absolute/private/research-run-2026-09-25
```

On Windows, quote absolute paths containing spaces. No provider account, paid resource or production migration is created by the CLI. Running it **does** read private research responses and create/reuse authorized analysis-run records; obtain research-owner authorization for the chosen cohort and destination.

## Bounded workflow and consistency

1. Create/reuse a server analysis snapshot with `create_research_analysis_run`, using the exact requested filters and empty SQL analysis parameters.
2. Download only that filtered cohort through `research_response_page`, ordered oldest-first with server keyset cursors, at most 100 rows/page. Refuse repeated response identities/nonadvancing cursors, more than 5,000 responses or more than 32 MiB of response JSON. A single RPC response is capped at 8 MiB.
3. Run the shared analysis in a terminable worker with a 512 MiB V8 old-generation heap limit. This is not a hard operating-system process memory limit. Stream CSV chunks with acknowledgements instead of materializing the full long export in memory.
4. Recheck the same server snapshot after processing. Both dataset checksum and count must still match. A changed cohort, lost permission, timeout or cancellation prevents a completed manifest. Checksum comparison is not a long-lived database transaction; it depends on the server's raw-response integrity model and does not freeze future retention/deletions.
5. Write `manifest.json` and mark `RUN_STATUS.json` completed **only after** successful recheck. The server snapshots record SQL summary provenance; the CLI's additional scoring results remain private files, not falsely reported as server-executed jobs.

Default overall deadline is three minutes, with a 20-second per-request timeout and a 128 MiB streamed export cap. Ctrl+C/SIGTERM aborts pending network calls and terminates the analytical worker. Narrow the cohort if limits are reached; there is no automatic silent sampling, unbounded retry, background continuation or paid compute activation. CSV-long repeats metadata for every item and can hit the byte cap well below 5,000 rows.

The database allows at most 20 retained analysis snapshots per researcher. Existing matching snapshots may be reused. If the cap is reached, the operator must review and explicitly delete an old run in the dashboard; the CLI never deletes another run automatically.

## Outputs and interpretation

- `manifest.json`: run IDs, start/finish/execution time, exact filters, loaded/eligible/excluded counts and reasons, server model versions, server MD5 dataset checksum, a separate local canonical-content SHA-256, model/engine/analysis versions, candidate digest if used, source bundle digest, Git revision and per-file byte lengths/SHA-256 checksums. These digests serve different purposes; they are not interchangeable or participant anonymization.
- `responses.json`: unmodified raw rows, their respondent category and original provenance. Historical null/missing scoring settings remain null/missing.
- `analyses.json`: shared per-response canonical ranking and exclusions, plus any actually recorded scoring context. Students/non-medical preferences are not professional ground-truth labels.
- `calibration.json`: existing calibration summaries, languages and specialty profiles, preserving measurement coverage/unmeasured-trait limitations.
- `evaluation.json`: shared research evaluation with Top-1/3/5/10 recall, exact-tie inclusive/conservative handling, MRR/rank summaries, specialty-balanced summaries, metadata groups, trait distributions and human-review quality flags. Read its method/denominator/uncertainty warnings; it does not validate a psychological instrument.
- Six CSV files: specialist and participant wide, long and analytical versions. They reuse the existing formula-neutralizing CSV serializers. “Participants” CSVs retain `participant_role` to distinguish students and people outside medicine.
- `model.json` and `shared-analysis-worker.mjs`: the frozen **repository-source catalog**, trait/value mappings and bundled shared analysis implementation used in this run. It is not silently substituted with the currently published production catalog. The bundle contains public implementation code, not tokens. Recording the bundle makes dirty-checkout changes distinguishable even when the Git revision alone is insufficient.

All canonical scores use the explicit default-priority comparison model. Original personalized settings, when recorded, are exported as provenance but are not applied to this canonical evaluation; historical settings are never reconstructed from a stored ranking. CSVs should be distributed only together with their manifest/model files. The JSON originals remain the non-lossy source if a spreadsheet changes types or formatting.

## Optional frozen candidate comparison

Supply a JSON array of `{ "name": "exact known specialty", "profile": { "known_trait": [target, importance] } }` entries for **every** specialty, or an object with that array under `specialties` (e.g. a previous `model.json`). Maximum input is 512 KiB. Names must match the source catalog exactly; profiles cannot be empty; targets must be finite 0–100 and importance an integer 1–3; unknown traits/duplicates are rejected. Other specialty attributes are taken from the source catalog, so candidates vary only their explicit profiles.

```sh
node scripts/research-operator.mjs --filters /absolute/private/filters.json --out /absolute/private/candidate-comparison --candidate-catalog /absolute/private/frozen-model.json
```

This adds `candidate-model.json` and `candidate-comparison.json`, with both models evaluated on the same unchanged cohort. It fits no parameters and promotes nothing. If a supplied candidate was trained on that cohort elsewhere, the comparison is not independent validation; proper training-split estimation remains a separate research procedure.

## Private-file lifecycle and failures

These outputs contain research responses, narratives and submission IDs. They are not anonymous/public aggregates. Keep them encrypted, access-controlled and within the research retention/deletion policy. Do not use public storage URLs, GitHub artifacts/issues, or a frontend `public/` folder. Follow [operations and backup procedures](OPERATIONS.md).

A failed/interrupted run may leave partial private files. `RUN_STATUS.json` says `failed` when graceful cleanup is possible; an abrupt power/process loss can leave `in_progress`. Neither is a completed dataset, even if individual CSV files open. No successful manifest is written on checksum drift. Review/delete only the exact failed output directory through the approved retention process; rerun to a new directory. Never delete raw database responses to make an export succeed.

## Verification

Run `node scripts/research-operator.tests.mjs`. It uses synthetic fixtures and injected HTTP responses only; it tests permission rejection, refusal of privileged tokens, page/count/byte bounds, duplicate-page handling, cancellation/timeouts, cohort drift, formula neutralization, exclusions, raw JSON preservation and candidate non-promotion. It does not prove current production role configuration, network performance, disk encryption or a real backup/restore.

Use `node scripts/research-operator.tests.mjs --benchmark` for an additional 1,000-response synthetic end-to-end operator benchmark. It reports local processing/output size, not production API capacity, and cleans up only its own temporary synthetic directory.
