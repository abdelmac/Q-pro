# Backend audit and bounded research APIs

Audit date: 25 September 2026. These are repository migrations, not a report of changes applied to production.

## Existing system and decision

The application already uses Supabase Auth/PostgREST/PostgreSQL, explicit research-account allowlisting, RLS, idempotent anonymous submission RPCs, immutable specialty-catalog publications, and immutable, suppressed monthly participation releases. Keep this infrastructure. No new database, paid service, AI API, or continuously running worker is required for the pilot.

The existing research browser downloaded every response before filtering and recalculating. New SQL APIs move filter/aggregation work to PostgreSQL and bound raw page sizes. Existing source responses, their consent, the optional specialist questionnaire, and historical scoring configuration are preserved. SQL does not implement a second specialty scoring engine.

## Permissions and public map

Participant category (`student`, `curious`, specialist submissions) never grants research access. The authoritative identity is `auth.uid()` matched against enabled rows in `private.researchers`. User-editable metadata and client role labels are ignored.

| Endpoint/action | Allowed caller |
| --- | --- |
| `get_public_features()` | Anonymous or authenticated; returns only `public_map_enabled` |
| Unfiltered `get_participation_map_stats()` | Public only when the setting is true |
| Filtered public-map RPC | Nobody; use the separate private endpoint |
| `get_private_participation_map_stats(...)` | Enabled researcher, doctor, professor |
| `set_public_map_enabled(p_enabled)` | Enabled doctor or professor, the existing administrative-editor roles |
| Research summaries, pages, item statistics | Enabled researcher, doctor, professor |
| Saved filters and analysis runs | Same allowlist plus per-record ownership |

Settings and audit tables are in the unexposed `private` schema with RLS and no client table privileges. Audit rows record actor UUID, portal role, timestamp, previous value and new value. Idempotent writes do not add duplicate change events. A database transaction/advisory lock serializes changes, including restoration of a missing settings row. Missing settings fail closed. Disabling a research account takes effect on the next request, independent of stale JWT role metadata.

Successful settings/map/research RPCs return `Cache-Control: no-store, private, max-age=0`, `Pragma: no-cache`, and `Expires: 0`. A disabled public map raises a PostgREST custom 403 carrying those headers in the error itself: ordinary `response.headers` settings would be rolled back with an exception. No public geographic response is usable offline without a fresh server check. Existing data already downloaded by someone cannot be retroactively erased. Requests already completed before a disable commit cannot be recalled.

Public releases retain the existing minimum cell size 10, downward rounding to five, closed UTC months, coarse country geography, and immutable releases. Public counts, groups and tooltip inputs all come from these same releases; raw coordinates, locations, IDs and answers are not added. Geography collection is not deleted or changed by map visibility.

Security-definer API functions follow the repository's existing narrowly granted RPC boundary, lock their search path, and check the allowlist before private research access. The internal SQL filter helper is deliberately security-invoker, has no public execute grant, uses qualified relations, and has no function `SET` clause so PostgreSQL can inline it and push keyset predicates into indexes. All exposed research functions, unlike the safe public-settings endpoint, explicitly authorize the request.

## API contracts

All filters are optional. Omit unused keys; do not send `all`, empty strings or JSON null. Supported keys:

`respondent_type` (`specialist`, `student`, `non_medical`), `language`, `country_code` (ISO code or `missing`), `specialty`, `study_year` (1–6), `date_from`, `date_to` (inclusive UTC dates), `experience_min`, `experience_max`, `satisfaction_min`, `satisfaction_max`, `rechoice`, `intention_to_change`, `questionnaire_version`, `schema_version`, `consent_version`, `scoring_version`, `specialty_config_revision`.

- `research_cohort_summary(p_filters={})`: global and filtered submission totals, eligible/excluded denominators, exclusion reasons, missing geography and scoring context, intentionally skipped questionnaires, grouped category/language/country/questionnaire-version/month counts. Completion/abandonment metrics are null because the necessary events are not collected.
- `research_response_page(p_filters={}, p_limit=50, p_cursor=null, p_sort='newest')`: at most 100 `{respondent_type,response}` records; `next_cursor` is null on the last page. Cursor contains timestamp, UUID and category; equal timestamps cannot duplicate or skip records. Supported sorts are newest and oldest. Counts elsewhere are not estimates derived from the currently loaded page.
- `research_question_summary(p_filters,p_question_id)`: known q81 item only; original 1–10 bins, eligible sample `n`, cohort total, excluded count, genuine missing/invalid item count, mean, median, sample standard deviation, floor/ceiling counts. A filter naming an incompatible questionnaire version is rejected, not silently combined.
- `research_item_correlation(p_filters,p_question_a,p_question_b)`: Pearson correlation on original, complete eligible q81 responses, with actual sample `n`. Method is `pearson-original-complete-questionnaires`, not a pairwise-missingness algorithm. Zero variance yields null. No psychological validation, reverse scoring, automated item removal or respondent exclusion is inferred from a correlation.
- `list_research_cohorts`, `save_research_cohort(p_name,p_filters,p_id=null)`, `delete_research_cohort(p_id)`: owner-only named live filters; maximum 50 per researcher. They are not frozen datasets.

All aggregation/pagination/item/run calls declare a 10-second database statement timeout. PostgREST's hoisted function settings apply it to the HTTP transaction. Browser cancellation does not guarantee immediate cancellation of an already-running database statement; the timeout remains the server-side limit.

Expensive summary/item/correlation/run APIs additionally share a server-enforced budget of **30 successful operations per five-minute window per allowlisted account**. A single private row per account is atomically incremented; there is no raw-answer, IP or event log. Direct clients cannot reset counters or call unmetered private calculation cores. Nested calculations inside one frozen run count once; cached-run requests still count their snapshot-read work. Exceeding the limit returns HTTP 429, `RESEARCH_RATE_LIMIT`, `Retry-After: 300` and no-store headers. Invalid/failed/rolled-back calls do not consume successful-operation quota. This is conservative authorized-research protection, not an Internet abuse firewall. Before opening high-traffic anonymous submission collection, approve and deploy an appropriate gateway/verified CAPTCHA/anti-abuse mechanism; publishable API keys and invented client IP values are not sufficient protection. No such public gateway is claimed as implemented here.

## Eligibility compatibility

The analysis/eligibility version is `research-sql-q81-v1`. It follows the current TypeScript dashboard's supported q81 collection protocols; this is not a newly validated psychological model. Invalid ratings/selected values are grouped under payload exclusion reasons in SQL, while the existing detailed TypeScript view can break those reasons down further.

All included questionnaires require `q81-v1`, `career-values-v1`, `medical-specialties-v1`, supported English/Romanian/French language, the exact 81 item IDs, integer answers 1–10, and one to four distinct known selected values. Specialists require a known actual specialty and `calibration-v2-qualitative`. Participants require `client-scoring-v2` and, when specified, a known preferred specialty.

| Category/schema | Required consent | Additional protocol |
| --- | --- | --- |
| Specialist 2 | `research-consent-2026-09-04` | Completed questionnaire for quantitative analysis |
| Specialist 3 | `research-consent-2026-09-16-geography` | Same item set; geography optional |
| Participant 2 | `research-consent-2026-09-04` | Historical participant protocol |
| Participant 3 | `research-consent-2026-09-11` | `medicine-view-v1` |
| Participant 4 | `research-consent-2026-09-16` | `medicine-view-optional-v2` |
| Participant 5 | `research-consent-2026-09-16-geography` | `medicine-view-optional-v2` |

The specialist skip is an explicit quantitative exclusion, not a missing-consent inference. Missing study year, geography, experience, satisfaction or qualitative optional fields do not invalidate usable questionnaires. Historical unsupported/schema-zero rows are retained and counted as submissions but excluded from current quantitative analysis. Exclusion reasons can overlap, so their sum is not the excluded-row denominator. Student preferences are not specialist ground-truth labels.

## Frozen bounded analyses

`create_research_analysis_run(p_filters={},p_parameters={})` supports optional `question_id` and/or paired `question_a`/`question_b`. Runs contain the exact filters/parameters, method version, source-data checksum, member count, recorded questionnaire/schema/consent/language/model versions, execution milliseconds, timestamps, completed status and derived results. `list_research_analysis_runs` returns metadata only; `get_research_analysis_run(p_id)` returns results; `delete_research_analysis_run(p_id)` removes an owner's retained run.

Limits: 5,000 source submissions per run, 20 retained runs per owner, 10 seconds per HTTP transaction. Exceeding the cohort bound returns an explicit error asking for narrower filters or the offline workflow; no silent sampling occurs. Runs are bounded synchronous SQL work, not a durable asynchronous queue. A failed/cancelled/expired transaction does not create a false completed run. UI progress can describe pending work but cannot claim measured server percentage progress.

Raw answers are not duplicated in a run. The private snapshot keeps source category/UUID and row digests, while results keep aggregates. Pre/post cohort digests reject concurrent source changes (SQLSTATE 40001). Exact filters, parameters, method version and dataset digest determine cache reuse. A new source record or changed source metadata creates a different checksum; old results remain explicitly frozen. Cached global totals are totals at the original run time, not a live global counter. Historical missing model fields remain null. Deletion/retention of source rows can prevent exact reconstruction; retained aggregates and memberships also need the research retention policy. MD5 here is an integrity/cache identifier, not a security signature or anonymization method.

There is no SQL scoring-engine fork, trained-model fitting, automatic production calibration, durable worker scheduler, factor analysis, reliability estimate or language-invariance claim in these APIs. Production model publication remains the separate authorized and audited catalog workflow. Large model evaluation should use the existing shared TypeScript engine in a controlled worker/offline environment, with training-split isolation where relevant.

## New scoring provenance

`submit_student_response_v7` and `submit_specialist_response_v6` preserve every argument of the previous latest submission RPC and add `p_scoring_context`. Completed questionnaires require:

```json
{
  "engine_revision": "scoring-engine-v2",
  "trait_mapping_version": "question-traits-q81-v1",
  "model_checksum": "fnv1a64-1234567890abcdef",
  "priorities": {"thinking": 50, "working": 50, "interpersonal": 50, "technical": 50, "lifestyle": 50}
}
```

All five dimensions must be numeric 0–100; unknown/extra fields or versions are rejected. This example is illustrative, never a backfill. A skipped specialist questionnaire requires SQL null. Raw `scoring_context` columns are nullable; older rows remain null. The specialty catalog UUID/revision is independently checked by the existing submission RPC. Engine/mapping/checksum are attributed client-reported provenance, not a server attestation that the client calculated scores honestly.

New wrappers serialize same-ID attempts. A scoped INSERT trigger attaches validated context only to an inserted candidate; the existing `ON CONFLICT` path never overwrites a row. After the base RPC returns, exact context equality is checked. A colliding legacy insert or altered priority retry produces 23505 rather than retroactively inventing context. Transaction-local context is restored on successful return, and failed calls roll back. Existing legacy APIs remain available for older clients and cannot clear a new row's provenance.

## Verification and performance

Local-only tests were run with the repository's existing `.local/map-db-check/check.mjs` PostgreSQL/WASM harness. It applies every migration to an isolated in-memory database and shims Auth identity, cron and pgTAP assertions. It does **not** test the live Auth/PostgREST HTTP stack, independent concurrent database sessions, or production resources.

```powershell
node .local/map-db-check/check.mjs supabase/tests/database/002_participation_map.sql
node .local/map-db-check/check.mjs supabase/tests/database/003_portal_test_dataset.sql
node .local/map-db-check/check.mjs supabase/tests/database/004_research_features.sql
node .local/map-db-check/check.mjs supabase/tests/database/005_scoring_context.sql
node .local/map-db-check/check.mjs supabase/tests/database/006_research_rate_limit.sql
node .local/map-db-check/check.mjs supabase/benchmarks/research_queries.sql
```

Local results: existing map 82 assertions; isolated test-data suite 50; new feature suite 72; scoring-context suite 29; rate-limit suite 18. The committed benchmark rolls back all synthetic data, checks both keyset directions, and verifies that a 5,001-submission run is refused rather than silently truncated. Across local runs with 1,000 synthetic valid submissions, observed times were summary 371–719 ms (about 0.8 KB JSON), 50-row page 12–17 ms (232 KB), one question 356–942 ms (501 bytes), frozen summary+question 995–2,938 ms, exact cached run 133–158 ms. Synthetic table heap/TOAST/index size was 2,383,872 bytes; mean serialized raw row 4,596 bytes. These are local WASM observations with varying concurrent workstation activity, not hosted-service capacity promises or sustained-load estimates. PostgreSQL chose the existing student timestamp index plus the specialist timestamp/UUID index for the representative keyset plans; no assertion depends on forcing a particular planner choice. Production indexing should follow observed query plans instead of adding an index for every optional filter.

Docker Desktop's Linux daemon was unavailable. `supabase db advisors --local --type all --fail-on error` was attempted and could not connect to 127.0.0.1:54322. Therefore real Supabase pgTAP, database lint/advisors, HTTP response-header propagation, independent-session races, and deployment verification remain release gates. Existing GitHub database CI runs an actual disposable Supabase stack and all SQL tests. No production responses, backups, credentials or exports were read, written or committed by this backend work.

Before applying migrations: export an encrypted database backup outside the repository, rehearse restore in an isolated instance, run the real local/CI test suite, inspect migration diff, and authorize deployment. Safe operational rollback is disabling the public map and rolling back the frontend; retain additive tables/columns and raw research data. Do not drop them to undo the UI. If a previous frontend version predates the map setting, keep the database endpoint fail-closed, not the older public-access function.

## Primary documentation checked

- [Supabase changelog](https://supabase.com/changelog): current relevant changes include explicit grants for newly exposed API objects; no migration depends on new default exposure.
- [Database functions](https://supabase.com/docs/guides/database/functions): search paths and explicit execution grants.
- [PostgREST transaction settings](https://docs.postgrest.org/en/stable/references/transactions.html): no-store response headers and hoisted function timeout.
- [PostgREST 14 custom errors](https://docs.postgrest.org/en/v14/references/errors.html): explicit HTTP status and headers on a raised exception.
- [Supabase observability](https://supabase.com/docs/guides/observability): advisor and performance verification guidance.
