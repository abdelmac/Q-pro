# Deployment, recovery and release operations

Reviewed **25 September 2026**. These are owner/operator procedures, not evidence that a new host, a production migration, a backup restore or a signed mobile build has been performed. Use synthetic data for development/previews. Never put production responses, dumps, signing keys, privileged API keys or private exports in Git, issue attachments or CI artifacts.

## Environments and frontend deployment

1. Keep `main` protected by checks and review. Use the committed lockfile with Node 24. Build/test locally or in GitHub using synthetic fixtures, not production exports.
2. Create a Cloudflare **Pages Free** project only after the owner connects the account/repository. Build command: `npm run build -- --base /`; output: `dist`. Set `NODE_VERSION=24`. The normal `npm run build` preserves the GitHub Pages `/Q-pro/` base; `npm run build:mobile` uses relative URLs.
3. Set only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env.example`. These are public identifiers embedded in the bundle; authorization must come from database checks, not secrecy of this key. Never supply a service-role key, database password or admin login as `VITE_*`.
4. Configure preview branches with a separate synthetic-only backend. If no isolated preview backend exists, leave its backend configuration unset and do not test production write flows there. Use the database emulator/test harness for CI.
5. Configure approved auth site/redirect URLs separately in Supabase when introducing a new origin. Do not add wildcard production recovery redirects just to make a preview work. Password-based admin login must still pass the server role check.
6. Before changing the public domain, verify root-path assets, EN/FR/RO flows, the default-disabled public map, role-denied RPCs, admin sessions, queue retries and install/offline behavior on the preview. Release the reviewed database migration before a frontend that depends on it; tolerate missing settings as disabled, not enabled.
7. Record Git SHA, migration versions, frontend deployment ID, base URL, public environment project reference and smoke-test result. Do not include credentials or response content in the release record.

Cloudflare's Git integration supplies deployments/previews; it does not replace GitHub source protection or tests. A root-path build needs no backend rewrite or data migration. [Pages Git deployment](https://developers.cloudflare.com/pages/get-started/git-integration/).

Keep the old frontend accessible during a deliberate transition, but avoid splitting users across origins unnecessarily: browser pending queues and storage belong to one origin and do not automatically migrate. Explain how to finish/retry a pending contribution on the old origin before closing it.

## Everyday monitoring without a mandatory paid subscription

Use provider dashboards and application error/pending states first. Assign one operator to review:

- Database size, largest tables/indexes, storage, egress, Auth MAU and the upcoming invoice weekly; also before recruitment mailings.
- API error rates, RPC timings, failed/expired analysis runs, retry-queue failure reports and fresh backup time. Record counts/error codes, release version and timing only; no raw answers, narrative, email, tokens or full request payloads.
- Supabase health/security advisors and query-performance reports. Add an index only after a reproducible selective query plan demonstrates a need; test on synthetic staging data and monitor write/storage overhead.
- Frontend build errors, resource-loading errors and host availability. A static homepage HTTP 200 does not prove that research submissions can be accepted. Test writes only against synthetic environments unless the owner specifically authorizes a production synthetic receipt test.

Do not enable session replay, body logging, third-party analytics of answers, or a paid logging drain by default. A future client-error collector should scrub events and have an approved retention policy. There is no claim of a new always-on monitoring service in this change.

Use the current Logs Explorer or `logs` Management API, not the removed `logs.all` endpoint. The API now expects ClickHouse SQL; database RPC SQL remains Postgres. [23 September 2026 log endpoint retirement](https://supabase.com/changelog/48235-migration-of-supabase-management-api-logs-all-analytics-endpoint-to-logs-endpoint).

## Quota, outage and incident response

1. Distinguish offline/network failure, a paused project, exhausted capacity, revoked access and an invalid submission. Check provider status/usage without logging payloads.
2. Fail closed for public map visibility and all private research access. Do not “temporarily” grant anonymous reads, relax RLS or distribute a privileged key.
3. Keep explicit submissions in their existing pending state until the database returns the expected durable ID; idempotent retries reuse the original ID and payload. Rejected/expired entries need human action. Do not call a queued item saved to research.
4. Stop large optional exports/analysis first. Do not delete raw responses to recover space without approved retention/deletion authority. Obtain approval for a paid upgrade; activating compute/add-ons can charge outside the Pro spend cap.
5. If access is compromised, revoke the member/session using the established admin process, rotate exposed privileged credentials, preserve a restricted incident record and verify direct RPC denial. Existing tokens and already downloaded exports cannot be remotely erased merely by hiding UI.

## Secure Free-plan backups

Free has no automated backup entitlement. Assign a named operator and an encrypted off-site destination **outside the repository** before collecting consequential research data. Proposed pilot objectives are recovery point at most 24 hours during recruitment and recovery time one business day; they are targets requiring a tested process, not guaranteed service levels. Take another backup before migrations. If daily manual coverage cannot be staffed, obtain approval for an automated private backup system or paid backups.

1. On an approved encrypted workstation, use an up-to-date Supabase CLI, Docker and Postgres client compatible with the source. Discover `supabase db --help` and `supabase db dump --help` before use. Confirm the exact production project reference through the dashboard; do not rely on a stale linked project.
2. Obtain a short-lived/operator-approved database credential through a password manager. Disable terminal transcripts/history capture for secrets; use the client's supported credential-file/prompt facilities. Never paste a credential-bearing URL into a shared shell, ticket, screenshot or GitHub command log.
3. Choose a dedicated encrypted backup directory outside source control with access restricted to the research operator. Follow the official logical export sequence for roles, schema, data and **separate migration history**. Prefer the session pooler on networks without direct IPv6. Do not alter/reset a live database password merely to perform a backup unless required and approved.
4. Record start/end time, source reference/version, Git/migration revision, table counts, byte lengths and SHA-256 file hashes in a private manifest. For a coherent multi-file point in time, quiesce writes in an approved maintenance window or use an operator-reviewed consistent-snapshot strategy; separate commands during active writes are not automatically one snapshot.
5. Encrypt exports before off-site transfer using the institution's approved tool; keep the recovery key separate and verify another authorized operator can retrieve it. Do not upload plaintext dumps to GitHub, a public bucket or consumer sharing links. Encryption of an archive does not justify public publication.
6. Include an inventory of auth settings, roles, SMTP/redirect configuration, secrets/key recovery and any object-storage contents. Database dumps do not include uploaded object bytes. Research CSV/JSON exports alone are not database backups.
7. Verify transfer checksums; restrict access; then apply the institution's approved retention/deletion policy to local and remote copies. A proposed pilot rotation is seven daily and four weekly encrypted copies, subject to ethics/legal approval and deletion obligations. Backups containing deleted submissions expire under that policy; retain a restricted deletion ledger so restored backups cannot silently resurrect deleted data.

The CLI's managed-schema behavior and Auth/Vault restore requirements matter; use the current [Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) instead of an unreviewed generic `pg_dump public` command. Free off-site backup responsibility, paid retention and storage-object exclusions are documented in [database backup coverage](https://supabase.com/docs/guides/platform/backups). No backup is claimed successful until restored and checked.

## Restore drill and real recovery

1. Rehearse monthly, and after major schema changes, in a newly approved **isolated** compatible Supabase target or an approved local environment. Never point a restore command at production to “test” it. A new paid project requires approval first. Keep recipient/invitation email and outbound hooks disabled during rehearsal.
2. Verify archive integrity, decrypt only on the approved workstation, inspect schema/roles before executing them, and follow the official role/schema/data restore order with stop-on-error and a transaction where supported. Reconcile migration history separately; do not replay all migrations on top of an already restored latest schema.
3. Restore needed Auth/Storage configuration and objects, extensions and managed-schema customizations from reviewed records. Follow the official Vault/root-key process if encryption is used. Re-establish role credentials securely; rotate tokens where required. Do not copy a production service-role key into a preview frontend.
4. Verify row counts and canonical checksums, immutable versions, reference integrity, consent/provenance, idempotent retries, RLS, ordinary-user denial, administrator/researcher separation and disabled public geography. Reapply the deletion ledger. Use synthetic sign-ins/submissions for functional checks; never print restored answers into logs.
5. Document duration and recoverable point. For a real incident, obtain a cutover decision, account for accepted writes after the snapshot (do not silently discard them), configure the new public backend identifiers, and release web/native configuration as appropriate. A native bundle with an old backend URL requires a deliberate update plan.
6. Keep the previous system read-only/restricted until the owner accepts recovery and retention obligations permit retirement. Destroy rehearsal private data and decrypted working files through the approved recoverability/retention procedure, not broad scripted deletion.

## Rollback

- **Frontend:** select a previously successful Cloudflare production deployment and roll back in the dashboard, or rebuild the reviewed prior Git SHA. Rollback does not roll back database changes or native applications. Check that the earlier UI understands the current additive schema. [Pages rollback procedure](https://developers.cloudflare.com/pages/platform/rollbacks/).
- **PWA:** cache versions are content-derived and scope-specific. A new worker waits for old windows to close; it must not forcibly reload an in-progress memory-only questionnaire. For a critical issue, advise users to finish/submit or knowingly discard open work, close all app windows, and reopen online. Never cache API/settings/map/export data. Previously downloaded information cannot be clawed back from another device.
- **Database:** prefer a reviewed forward fix that preserves raw data and audit history. Do not casually drop new columns/tables or reset production. Restoring a backup loses later writes unless reconciled; it requires explicit incident approval and the above recovery process.
- **Scoring/configuration:** select or publish an authorized, audited version through the established catalog workflow. Do not rewrite the historical model attached to already accepted submissions. Analysis runs are descriptive and cannot promote themselves.
- **Mobile:** halt a problematic rollout and distribute an owner-signed corrective version; do not assume store installations instantly revert when the website rolls back.

## Research governance release gates

Obtain research-owner review of purpose/consent translations, age/minor participation, lawful basis, processor agreements, actual data region, free-text identification risk, retention/deletion, account recovery, access recertification and breach procedure. A medical-themed app must not imply a validated clinical instrument or objective competence assessment without evidence. Selecting Supabase/Cloudflare does not settle these questions.

Native toolchain, signing, store fees, privacy forms and device testing are described in [MOBILE.md](MOBILE.md). Record separately: source configuration present; web build/tests passed; native sync passed; Android compile passed; iOS compile passed; physical-device tests passed; signed artifact created; store approved/published. Do not collapse these into “mobile app ready.”
