# Recovery rehearsal and warning review — 26 September 2026

## Outcome

An encrypted, **synthetic local** logical backup was restored into a fresh Supabase target without replaying the application migrations. All **19 recovery assertions**, **45 restored Auth/HTTP assertions**, **421 database assertions**, and **10 benchmark checks** passed. SQL lint and advisors reported the same four warnings as the preceding verification; no error-level diagnostic appeared.

This is not a production backup, hosted deployment, off-site transfer, or proof of a production recovery-time objective. No production data, credentials, accounts, configuration, or migrations were accessed or changed. Application code and committed migrations remain unchanged at baseline Git revision `9736fc1`.

## Environment and fixtures

- Supabase CLI `2.115.0`, matching database CI; PostgreSQL `17.6`; pg_cron `1.6.4`.
- Source: `q-pro-backup-source-20260926`, API `127.0.0.1:56321`, database port `56322`. All 18 application migrations applied.
- Successful target: `q-pro-backup-target-20260926-v2`, API `127.0.0.1:57321`, database port `57322`. Application migrations and seeds disabled; only managed platform schemas existed initially.
- An earlier target, `q-pro-backup-target-20260926`, was stopped and retained after identifying the missing cron definition. No existing project was reset to obtain a blank target.
- Configuration/test copies and guarded verification scripts are Git-ignored under `.local/recovery-verification/`. No `.env` or remote linkage was copied. A fresh clone does not contain these disposable harnesses.
- Three synthetic Auth identities: professor, researcher, and an ordinary user whose editable metadata falsely claimed professor access. Random credentials stayed in process memory and local Auth; they were not written to logs or documentation.
- Three responses: student with original scoring context and no optional reflection; curious participant using the legacy submission version; specialist deliberately skipping the questionnaire. Also one private saved cohort and one temporary no-login database role.

## Backup and restore evidence

The successful run lasted from `2026-09-26T12:09:26Z` to `12:10:00Z`, excluding stack startup and later regression tests. The restore command took approximately **0.52 seconds** for this tiny fixture; this is not a meaningful production-capacity estimate.

The encrypted archive contained roles, application schema, data, separate migration-history schema/data, and a reviewed cron-definition/environment manifest. Role/schema/data and migration-history handling followed the [Supabase logical backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

- Archive size: **2,029,163 bytes**.
- Encryption: AES-256-GCM with random key/nonce and authenticated format context. File integrity and decrypted-content SHA-256 checks passed. A modified ciphertext and a wrong key were both rejected before restore.
- Ciphertext SHA-256: `799ea4edd3fc5fdbeeb075475cc98725f10c09fba0542ce0fa562a268ee14946`.
- Plaintext dumps stayed in process memory. Only the encrypted archive was written to a dedicated temporary directory outside the repository; it was removed afterward. This tested same-process recovery, not independent key custody or off-site retrieval.
- Stop-on-error, single-transaction restoration preserved all **18 checked tables'** row counts and canonical row hashes: every `public`/`private` table, `auth.users`, `auth.identities`, and `supabase_migrations.schema_migrations`.
- Compared content included all four catalog versions, 232 versioned specialty entries, 96 traits, 18 migration-history rows, stored scoring provenance, consent metadata, and the synthetic accounts/responses/cohort. The active public catalog still exposed 58 specialties.
- The temporary no-login role and its schema grant survived restoration.

The source was isolated and quiescent; before/after fingerprints agreed across all dump parts. This is not a consistent-snapshot guarantee for separate dump commands against a live, concurrently written database.

### Recovery gap found: scheduled map publication

The initial default CLI export restored application data successfully but omitted the scheduled map-publication job. Restored migration history does **not** replay scheduling statements. The procedure now explicitly archives and restores the known job's name, schedule, command, database, owner and active flag, with reviewed routing and extension settings. Supabase documents this separation of extension intent from ordinary schema/data in its [extension recovery design](https://github.com/supabase/pg-toolbelt/blob/main/docs/architecture/extension-intent.md).

The restored job is `q-pro-publish-participation-map`, schedule `15 1 1 * *`, owned by `postgres` in database `postgres`. Its command, owner, local routing and execution settings matched the source. Its original active flag was preserved in the encrypted manifest, but the restored job was deliberately **inactive**. No scheduled job ran on the target. This tests definition recovery, not background execution.

Recreation used `cron.schedule_in_database` with `username := NULL` after confirming that the captured owner matched `current_user`. An explicit username failed without superuser privileges, even for the same role; that attempt rolled back. Do not silently change ownership or assume Supabase `postgres` is a superuser. Review target database, role and routing before using the [pg_cron scheduling API](https://github.com/citusdata/pg_cron#creating-a-cron-job-in-a-different-database).

Do not rerun the geography migration to recover this job: it also invokes the publisher immediately. Real recovery needs a separate approved activation decision after data/deletion-ledger checks.

## Restored behavior and regression results

| Verification | Result |
| --- | --- |
| Guarded backup, encryption, restore and cleanup harness | 19 assertions passed |
| Restored Auth/PostgREST probe | 45 assertions, 27 requests; three synthetic sessions logged out |
| Database suites | 421 assertions across six files passed |
| Synthetic query-plan benchmark | 10 checks passed |
| SQL lint | Three existing warnings; no error-level finding |
| Database advisors | One existing mutable-search-path warning; no error-level finding |

HTTP checks covered password sign-in with preserved identities; server-owned roles despite spoofed user metadata; ordinary/anonymous denial and known-row RLS isolation; disabled public geography and no-store headers; authorized filtered private geography; saved-cohort ownership; published catalog version; exact receipt retries; and HTTP 409 for altered scoring context without overwrite or duplication.

The copied geography test suite temporarily enabled the restored cron job **inside its existing transaction**, solely to exercise the original active-job assertion. The transaction rolled back, so no background worker could observe that temporary active state. No committed test or migration was modified. Final checks confirmed the job remained inactive and its run history empty.

The query-plan benchmark exercises the existing synthetic workload, not production-scale capacity. The earlier 67 HTTP/concurrency checks are documented in [the 25 September report](LOCAL_DATABASE_VERIFICATION_2026-09-25.md); they were not all repeated by this narrower 45-assertion recovery probe.

## Review of the four warnings

These represent three underlying issues in `20260925145121_research_map_visibility_and_analytics.sql`.

1. **Mutable search path on `private.filtered_research_responses`: retain the documented exception pending a measured redesign.** The helper is security-invoker, its relation is qualified, clients cannot execute it directly, and authorized wrappers lock their paths and check staff membership. Adding a function `SET` clause disables SQL-function inlining in PostgreSQL 17 and can disrupt indexed pagination. Review grants/callers whenever this helper changes; a schema name alone is not a security boundary. See [optimizer implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/optimizer/util/clauses.c) and [BACKEND_AUDIT.md](BACKEND_AUDIT.md).
2. **Implicit empty-array conversion in `private.research_exclusions`: low-risk cleanup candidate.** Its `text[]` initializer works in the passing suites; an explicitly typed empty array would make the intent clearer.
3. **Two volatility warnings in `private.validate_research_filters`: review declaration in a new migration.** Text-to-date conversion is STABLE while this validator is marked IMMUTABLE. Its strict `YYYY-MM-DD` input restriction prevents the usual ambiguous/relative-date cases, so these warnings did not demonstrate an incorrect date result. A conservative future change is STABLE, followed by ISO/calendar/date-range, prepared-call and benchmark regression tests. See [PostgreSQL date input](https://www.postgresql.org/docs/17/datatype-datetime.html) and [function volatility](https://www.postgresql.org/docs/17/xfunc-volatility.html).

No historical migration was edited just to suppress warnings. The two cleanup candidates remain outstanding and should be separately tested; the application is not claimed warning-free or security-certified.

## Cleanup and limits

Synthetic users, response rows, role entries, the saved cohort and temporary no-login role were removed from source and target. Final target counts were zero for Auth users, students, specialists, researchers, cohorts, quota windows, map audit entries and analysis runs. The public map remained disabled. The generated encrypted archive and its empty temporary directory were removed; they are not a retained backup. Test fixture deletion was intentional and can be reproduced by creating new synthetic fixtures.

Only the recovery-test stacks were stopped, with their volumes retained. Other applications and pre-existing volumes were not targeted. Retained volumes are local development state, not approved backup media; CLI services should stay stopped when unused because their default bindings are not restricted to loopback.

Not verified here: off-site delivery, separately recoverable encryption keys, all Auth/session tables, production-sized data, historical deletion-ledger application, object-storage bytes, Vault/root-key recovery, hosted secrets/settings/SMTP/redirects, actual scheduled execution, or cutover under concurrent writes. Empty application tables were checked for equality but do not establish recovery of every possible populated state. Toolchain versions describe this local drill, not production patch status.

## Next owner decisions

1. Choose an institution-approved encrypted off-site backup destination, named operator and separately recoverable key custody. Test retrieval by another authorized operator.
2. Approve the exact production project and maintenance scope before a real backup or migration. Review installed migrations and existing data read-only first; never substitute this synthetic archive for a production backup.
3. Complete an approved real-backup restore/verification, including cron review and non-database configuration. Then review/apply only outstanding production migrations before releasing the dependent frontend.
4. Run hosted smoke tests and complete the privacy/retention and mobile release gates in [OPERATIONS.md](OPERATIONS.md). No hosted release was performed in this session.
