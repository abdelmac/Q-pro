# Implementation and verification — 25 September 2026

This report concerns repository changes and synthetic local checks, **not a production deployment or native-store release**. No production questionnaire records, credentials or private exports were used. No paid resource was provisioned and no app was published. Existing user changes/commits were preserved.

## Delivered

| Area | Repository implementation |
| --- | --- |
| Architecture | Existing React/Vite, Supabase and shared Capacitor code retained; two hosting options compared; Cloudflare Pages + existing Supabase recommended. Pilot assumptions, current official limits, upgrade triggers and owner approvals documented. Root/subpath builds and Cloudflare security/cache headers prepared. |
| Public map | Default-disabled central database switch; doctor/professor-only changes with actor/old/new/time audit. Public map links, geographic widgets and component hidden on denial/unavailable/offline state. Public RPC checks visibility and denies filtered queries; separate explicitly authorized private map stays usable. Only allowlisted safe settings fields returned. |
| Cache controls | Backend no-store settings/map/research responses; frontend backend fetches no-store; service-worker exact public static allowlist with no protected/map/auth/export fallback. Open public pages recheck every 30 seconds and on lifecycle events. Already downloaded information cannot be remotely erased. |
| Core research UI | Multilingual analytics tab; server counts, monthly/category/language/country/version summaries; explicit denominators/exclusions; named owner-only cohorts and comparison warning; item distributions/summary statistics and Pearson view; recorded checksum-linked runs, export/delete; stale-result invalidation and cancellation. |
| Backend bounds | Keyset research pages ≤100 rows; frozen runs ≤5,000 source rows, 20 retained per owner, 10-second SQL deadline; named filters ≤50. Expensive authorized analytics share 30 successful operations/5 minutes/account. No automatic model updates. |
| Scoring provenance | Additive nullable context columns and versioned idempotent submission RPCs. New complete questionnaires store actual priority settings and engine/mapping/model identifiers; historical and skipped values remain unavailable. Existing consented legacy retries continue on their original protocols. |
| Advanced evaluation | Bounded operator worker reuses shared TypeScript scoring and safe CSV serializers. Top-1/3/5/10 recall, exact ties, MRR, specialty-balanced/stratified results, trait profiles/distributions and quality-review flags. Optional frozen candidate comparison, without fitting or promotion. Private JSON/wide/long/analytical CSV plus provenance manifests. |
| Mobile/PWA | Production offline public shell and EN/FR/RO installation guidance; existing actual Android/iOS Capacitor projects retained. User override respected: unfinished questionnaire answers remain in memory only. Explicit-consent pending submission queue/foreground retries preserved. |
| Operations | Environment examples, encrypted backup/restore/rollback procedures, quota/incident guidance and native release instructions. Private export/backup patterns ignored by Git; operator output refuses repository directories. |

## Commands and results

All commands below used this working checkout. Browser tests intercept backend requests with synthetic fixtures; operator tests inject synthetic HTTP responses.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed for app and build configuration. |
| `npm run lint` | Passed. |
| `npm run test:dashboard` | Passed: eligibility, exact full-precision ties, no specialty-label leakage, denominators, coverage warnings, formula-safe CSV shape, expanded metrics and recorded context. |
| `npm run test:map` | Passed: aggregate-only contract, privacy/counts, roles, filters and translations. |
| `npm run test:portal-data` | Passed: deterministic synthetic 5 specialists + 5 students + 5 explorers; isolation, filters and test-only counts. |
| `npm run test:mobile` | Passed: targeted old-draft cleanup, shared scoring/catalog continuity, explicit-consent queue, retry/expiry/concurrency. Historical draft-codec tests do not mean runtime draft saving is enabled. |
| `npm run test:icons` | Passed: SVG/PNG/ICO/manifest/native assets and transparency rules. |
| `npm run test:specialty-content` | Passed: all 58 specialty narratives in EN/FR/RO and source migration synchronization. |
| `npm run test:browser` | Passed: all 81 real UI answers, optional reflection, new v7/v6 provenance, offline exact-payload retry, no draft persistence, duplicate receipt protection, map/access/settings/analytics/test-mode checks. |
| `npm run test:browser -- --map-auth-only` | Passed combined map/settings/researcher/analytics/synthetic-mode regression. |
| `npm run test:browser -- --map-auth-only --analytics-only` | Passed focused analytics CRUD, filters, cancellation/late response, denied export and stale-result checks; populated 1440px/375px screenshots inspected without horizontal overflow. |
| `npm run test:research-operator` | Passed: keyset bounds, checksums/drift, immutable raw JSON, eligibility, CSV safety, candidate non-promotion, privileged-key refusal, private paths, byte cap, cancellation/timeouts. |
| `npm run test:pwa` | Passed exact allowlist/content version and actual browser tests for `/Q-pro/` and `/`, offline shell, hosted CSP, protected-cache exclusion including poisoned-cache attempts, and no questionnaire persistence. |
| `npm run build` | Passed production web build. |
| `npm run build:mobile` | Passed shared mobile **web asset** build; this is not Android/iOS compilation. |
| `git diff --check` | Passed; Windows line-ending notices are not whitespace failures. |

The build still warns about a public JavaScript chunk above 500 KB (about 897 KB minified / 265 KB gzip in this checkout), largely shared multilingual content/application code. This is a performance follow-up, not a hidden build success claim. Dashboard and map are separately lazy-loaded; further splitting should be measured on real mobile connections.

### Local database checks

The existing `.local/map-db-check/check.mjs` harness applied every migration to isolated PostgreSQL/WASM with Auth/cron/pgTAP shims. New tests are committed under `supabase/tests/database` and run by the existing disposable-Supabase GitHub workflow.

- Participation map suite: 82 assertions passed.
- Synthetic portal data suite: 50 passed.
- Research feature suite: 72 passed.
- Scoring context suite: 29 passed.
- Research rate-limit suite: 18 passed.
- `supabase/benchmarks/research_queries.sql`: 10 checks passed, including keyset plans and explicit refusal of 5,001-row frozen runs.

The original `001_research_security.sql` was also attempted but could not execute in the WASM harness because `extensions.plan(integer)` and other full pgTAP helpers are unavailable. It must pass in the real Supabase CI stack; it is not reported as a local pass.

Example local command: `node .local/map-db-check/check.mjs supabase/tests/database/004_research_features.sql`. The local harness is not a replacement for real Supabase HTTP/Auth/pgTAP/advisor checks.

### Synthetic benchmarks

With 1,000 valid synthetic database rows, representative local measurements were about 376 ms for cohort summary, 12 ms for a 50-row page, 359 ms for one item, 1,007 ms for a frozen summary/item run, and 131 ms for exact cached reuse. Runs varied with workstation activity; the backend audit records ranges. Raw-table heap/TOAST/index footprint was about 2.38 MB; average serialized raw row about 4.6 KB. No production load test was performed.

`node scripts/research-operator.tests.mjs --benchmark` completed 1,000 synthetic responses in 6.751 seconds and wrote about 44.94 MB of private test outputs (CSV-long repeats metadata). This measures local worker/disk work with mocked networking, not hosted transfer speed or future capacity. Test-generated output directories were cleaned by their bounded harnesses; no real response was removed.

## Release gates / manual steps

1. Review the two additive migrations (`20260925145121_research_map_visibility_and_analytics.sql`, `20260925150142_research_scoring_context.sql`). Rehearse an encrypted backup/restore, run real Supabase tests/advisors in CI or Docker staging, and **apply the migrations before publishing the new frontend**. The new submission RPCs otherwise do not exist. Map visibility remains disabled when unavailable; submission failures must not be treated as saved.
2. Docker's local daemon was unavailable; the attempted local database-advisor connection failed. Real Auth/PostgREST response-header propagation, independent-session races and production permissions/performance remain unverified. No production migration or remote publication was performed.
3. Configure an approved Cloudflare account/project and build-time public environment variables, isolated synthetic previews, auth origins and any chosen domain. Keep GitHub for source/CI; do not point preview write tests at production. No provider/account was purchased or activated here.
4. Approve participant-information/consent changes for recording matching-priority provenance, retention/deletion responsibilities, region/processing agreements and any applicable research review. No regulatory compliance is claimed.
5. Add an approved verified CAPTCHA/gateway or equivalent anonymous-submission abuse protection before high-traffic recruitment. The new account-based analytics throttle is not a public Internet abuse firewall. Monitoring currently uses provider dashboards and application errors; no new always-on client error collector is claimed.
6. Compile and device-test Android with the required SDK/JDK and iOS on macOS/Xcode, check secure storage/lifecycle/offline/auth on devices, sign, complete privacy declarations and obtain account approvals. Native Universal/App Links and recovery/OAuth callback handling require an owned domain and are not configured. No signed APK/AAB/IPA or store submission is claimed.
7. Advanced evaluation/candidate comparison is available through the private operator workflow, not a durable server job queue or a complete dashboard job-management UI. Population uncertainty intervals, factor analysis, reliability and language-invariance findings require a research design/data basis; they are intentionally not fabricated.

## Documentation map

- [Architecture, current limits and budget](ARCHITECTURE_AND_BUDGET.md)
- [Backend schema/API, security and benchmarks](BACKEND_AUDIT.md)
- [Analytics methods and interpretation](ANALYTICS_METHODS.md)
- [Private operator exports and candidate comparisons](RESEARCH_OPERATOR.md)
- [Hosting, monitoring, backup, restore and rollback](OPERATIONS.md)
- [PWA and native build/release requirements](MOBILE.md)
