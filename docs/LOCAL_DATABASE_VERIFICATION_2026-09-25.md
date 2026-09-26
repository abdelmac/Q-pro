# Real local Supabase verification — 25 September 2026

## Outcome and scope

Follow-up: [26 September recovery rehearsal and warning review](RECOVERY_READINESS_2026-09-26.md). The encrypted synthetic restore passed, and the recovery procedure now explicitly includes the scheduled map-publication job. Production remains unverified and unchanged.

The Docker blocker in the original implementation report is resolved. All **421 pgTAP assertions**, **10 synthetic benchmark checks**, and **67 real Auth/PostgREST/concurrency assertions** passed. The existing public catalog/runtime probe also passed. SQL lint and database advisors exited successfully at the error threshold, **with warnings described below**.

This verifies a fresh, isolated local stack built from the repository at Git revision `5be6d2f`; it does not verify the hosted database or constitute a production release. No application code, committed migration, production account, hosted setting or frontend deployment was changed. No production research data or credentials were used.

## Test environment

- Docker Desktop 4.90.0; Docker Engine 29.7.2; Linux containers.
- Supabase CLI **2.115.0**, matching the committed database CI workflow.
- Local PostgreSQL **17.6**, image `supabase/postgres:17.6.1.159`; Auth `gotrue:v2.195.0`; PostgREST `v16.1`.
- Fresh project ID: `q-pro-verify-20260925`.
- API `http://127.0.0.1:55321`; database port `55322`; local mail capture port `55324`.
- Isolated configuration, migration/test copies and HTTP harness: `.local/docker-verification/` (Git-ignored). No `.env` or remote project linkage was copied there.
- All **18 migrations** applied successfully from scratch; seeding remained disabled. Only test project ID, local ports and Auth site URL were changed in the copied configuration. Studio, Postgres Meta and Edge Runtime were excluded from startup; database, gateway, Auth and PostgREST were exercised.
- Existing `q-pro` volumes and the running `orange`/`azula` applications were left untouched.

The pinned CLI reported a newer version, 2.118.0. This run intentionally used the CI baseline, not an unreviewed toolchain upgrade. The local image version is not evidence of the production PostgreSQL version or its patch status.

## Executed checks

| Check | Result |
| --- | --- |
| Fresh migration chain | All 18 applied. |
| `001_research_security.sql` | 170 assertions passed, including the real pgTAP helpers unavailable in the earlier WASM harness. |
| `002_participation_map.sql` | 82 assertions passed. |
| `003_portal_test_dataset.sql` | 50 assertions passed. |
| `004_research_features.sql` | 72 assertions passed. |
| `005_scoring_context.sql` | 29 assertions passed. |
| `006_research_rate_limit.sql` | 18 assertions passed. |
| `supabase/benchmarks/research_queries.sql` | 10 checks passed: synthetic 1,000-row operations, index-plan checks and refusal of a 5,001-row analysis cohort. This is not a hosted load test. |
| SQL lint, `public` and `private` | Exit 0 with `--fail-on error`; three warnings across two functions. |
| Security/performance advisors | Exit 0 with `--fail-on error`; one security warning. |
| `scripts/verify-supabase-runtime.mjs` | Passed against the explicitly overridden local URL/key: active revision 4, 58 specialties, 665 profile/trait assignments, EN/FR/RO narratives, anonymous denials and invalid older submission protocols. |
| Local Auth/PostgREST/concurrency harness | 67 named assertions passed, plus exact-ID cleanup verification. |

### What the real HTTP tests established

- Five synthetic identities signed in through the real Auth password endpoint: ordinary user, researcher, doctor, professor, and a separate quota-test researcher. Spoofed `user_metadata` did not confer staff roles; the server allowlist remained authoritative.
- Anonymous and ordinary users could not access private research; researchers could not change the public-map switch. Doctor/professor changes worked. The filtered private map remained usable by authorized staff while the public map was disabled.
- Actual HTTP responses carried the expected `Cache-Control: no-store, private, max-age=0` headers for public settings, public/private map success, disabled-map HTTP 403, and successful analytics. Map/settings checks also verified `Pragma` and `Expires`.
- Public map filters remained forbidden even when the public map was enabled. Staff could not bypass the disabled public route.
- For both participant v7 and specialist v6 submissions, six concurrent identical requests acknowledged one UUID and produced one row. Changed scoring context returned HTTP 409 without overwriting the original. Conflicting concurrent new inserts produced one winner and one conflict.
- A concurrent legacy/new participant submission preserved one row and did not fabricate or erase scoring provenance. A specialist skipping the questionnaire stored a null context.
- Of 32 parallel analytics requests for one account, exactly 30 succeeded and two received HTTP 429 with `RESEARCH_RATE_LIMIT`, `Retry-After: 300` and no-store headers. The stored counter did not exceed 30; another account remained usable.
- Disabling an allowlisted researcher immediately denied analytics/private-map access with the already-issued JWT; a refreshed token was not required for that denial.

These are bounded test cases, not proof that every possible race is covered. Concurrent missing-setting recovery, analysis/cohort capacity races, and broader contention/load scenarios were not exercised over HTTP in this run.

## Warnings requiring review

1. **Advisor: `private.filtered_research_responses` has a mutable search path.** The migration and `BACKEND_AUDIT.md` deliberately omit a function `SET` clause to permit SQL inlining and indexed keyset pagination. The helper is security-invoker, its relation is qualified, and authorized callers lock their own search paths. Local checks confirmed neither `anon` nor `authenticated` can execute the helper directly. This is a documented design trade-off, not a silently dismissed warning. Review before changing its grants/callers; adding a `SET` clause may change query plans. [Official advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
2. **Lint: `private.research_exclusions` initializes `text[]` from a text literal.** Its empty-array initializer generated a type-cast warning. Functional tests passed; an explicit array type is a future cleanup candidate.
3. **Lint: `private.validate_research_filters` is declared `IMMUTABLE` but uses `STABLE` expressions.** Two warnings concern its date-cast validation/comparison. Review the volatility declaration and callers in a separately tested change.

No SQL was altered merely to make diagnostics quiet. Passing `--fail-on error` does not mean warning-free or production-certified.

## Repeating the verification

The following commands refer to the already-prepared **local-only copy** in this checkout. A fresh clone will not contain `.local/docker-verification`; prepare a new isolated copy of `supabase/config.toml`, migrations, tests and benchmarks with a unique project ID and unused ports first. Do not copy `.env` or `.temp` linkage files; never reset existing volumes just to reproduce this test.

```powershell
npx.cmd --yes supabase@2.115.0 start --workdir .local/docker-verification --exclude studio,postgres-meta,edge-runtime
npx.cmd --yes supabase@2.115.0 test db --local --workdir .local/docker-verification
npx.cmd --yes supabase@2.115.0 db lint --local --schema public,private --fail-on error --workdir .local/docker-verification
npx.cmd --yes supabase@2.115.0 db advisors --local --type all --fail-on error --workdir .local/docker-verification
npx.cmd --yes supabase@2.115.0 test db supabase/benchmarks/research_queries.sql --local --workdir .local/docker-verification
npx.cmd --yes supabase@2.115.0 status --workdir .local/docker-verification --output json | node .local/docker-verification/verify-http.mjs
npx.cmd --yes supabase@2.115.0 stop --project-id q-pro-verify-20260925 --workdir .local/docker-verification
```

CLI startup/status output can contain local keys: do not publish raw output. The HTTP harness receives status JSON in memory, rejects any API other than `127.0.0.1:55321`, verifies the exact project/container/local daemon, and prints only assertion results. It is a local verification artifact, not yet a committed CI test. No credentials are persisted by the harness.

**Important:** the existing `verify-supabase-runtime.mjs` otherwise falls back to the root `.env`. For this run both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` were explicitly replaced in the child process with values from the isolated stack. Do not run that script assuming it automatically chooses the local backend.

## Cleanup and next release gates

All transaction-wrapped SQL fixtures rolled back. The HTTP harness removed its five synthetic Auth identities, six synthetic response rows, role entries, quota counters and map audit entries, and restored the initial map setting. A separate final count query confirmed zero students, specialists, Auth users, researchers, map audit rows and quota rows; the public map was disabled.

Only the verification stack was stopped, **with its volumes retained**. Its images/volumes remain available for later local testing; original volumes were not deleted. The CLI binds local services to `0.0.0.0` by default, so stop this synthetic stack when not in use and never load real research data into it.

The next release step is an approved encrypted backup/restore rehearsal and review/application of the production migrations **before** a dependent frontend release, followed by hosted smoke tests. Production Auth configuration, permissions, SMTP, cache behavior, real data compatibility and performance remain unverified by this local run. Privacy/consent sign-off, public-submission abuse controls and native signing/device/store gates remain as documented in [OPERATIONS.md](OPERATIONS.md), [MOBILE.md](MOBILE.md) and the [original implementation report](IMPLEMENTATION_TEST_REPORT_2026-09-25.md).
