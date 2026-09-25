# Deployment architecture and pilot budget

Decision and provider documentation checked **25 September 2026**. USD estimates exclude taxes, domain registration, email delivery, developer memberships and staff time. Recheck the linked terms before activating a paid resource. This document does not provision accounts or certify regulatory compliance.

## Keep the working stack

The repository already uses React 18, TypeScript and Vite 5; a multilingual shared scoring engine; Supabase Postgres/Auth and versioned SQL RPCs; and Capacitor 8 projects for Android and iOS. Do not introduce Next.js, a second scoring implementation, Kubernetes, Redis or a dedicated API server merely to change hosting.

Recommended ownership boundaries:

| Component | Responsibility | Initial hosting |
| --- | --- | --- |
| Git repository and automated checks | Source, reviewed migrations, synthetic fixtures, release provenance | GitHub |
| Public application files | HTML/CSS/JS, translations, static specialty narratives, branding | Cloudflare Pages |
| API, access checks, research storage | Supabase Auth, Postgres RLS and explicitly granted RPCs | Existing Supabase project |
| Bounded analytics | Authorized database aggregation; versioned analysis records | Same database, not a browser download of all responses |
| Private exports/backups | Authorized operator-controlled encrypted storage | Outside Git and outside public frontend hosting |
| Android/iPhone | Same frontend and scoring code bundled by Capacitor | Owner-signed store releases, separately from website deployments |

Keep GitHub Pages as a transition fallback, not a second database or automatic failover system. Changing frontend hosts does not resolve a backend outage. Do not duplicate production submissions across providers.

## Two compatible options

| Option | Pilot cost and fit | Trade-offs |
| --- | --- | --- |
| **Cloudflare Pages + existing Supabase — recommended** | Static files need no application server; preserves current backend/security and normal Vite builds | Provider account and controlled rollout still needed; Pages does not back up research data; frontend edge protection does not protect direct Supabase RPC calls |
| Vercel static Vite deployment + existing Supabase | Technically compatible with the same build; Hobby is free for eligible personal/non-commercial use | Hobby includes 100 GB fast transfer, 10 GB origin transfer and 1 million edge requests/month; exceeding quotas can suspend the feature. Its personal/non-commercial restriction makes it a weaker default for an institution-managed research service. Pro/payment requires explicit approval |

Vercel has no necessary runtime role in the recommended architecture. Hosting migration remains simple: rebuild the public directory for the new base URL and change the domain; there are no host-specific API functions. [Vercel Hobby limits and permitted use](https://vercel.com/docs/plans/hobby).

## Verified limits and failure modes

### Cloudflare Pages static hosting

The Free plan permits 500 builds/month, one concurrent build, a 20-minute build timeout, 20,000 files/site and 25 MiB per file. These are deployment limits, not database capacity. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

Static asset requests which do not invoke Functions are free and unmetered under the documented pricing. Pages Functions would consume the separate Workers allowance (100,000 requests/day on Free); **no Functions are needed or budgeted here**. Unmetered static delivery does not make backend compute, research data or service availability unlimited. [Pages request pricing](https://developers.cloudflare.com/pages/functions/pricing/).

Cloudflare advertises free onboarding without a credit card. Stay on Free, do not activate chargeable Workers, R2 or add-ons, and use the free `pages.dev` address initially. Static hosting has no inactivity-paused database process; no availability SLA is assumed. Public assets use a global CDN, not an EU-only storage guarantee. [Cloudflare plans](https://www.cloudflare.com/plans/).

### Shared Supabase backend

| Resource | Free pilot | First paid step: Pro |
| --- | --- | --- |
| Database | 500 MB/project; shared CPU, 500 MB RAM | 8 GB included; $0.125/GB additional |
| Uncached egress | 5 GB/month | 250 GB; then $0.09/GB |
| Cached egress | Separate 5 GB/month | Separate 250 GB; then $0.03/GB |
| Object storage | 1 GB | 100 GB; then $0.0213/GB |
| Auth MAU | 50,000 | 100,000; then $0.00325/MAU |
| Edge invocations | 500,000/month | 2 million; then $2/million |
| API requests | No count-based limit; compute/egress still apply | Same distinction |
| Inactivity | Pause after one week; two active Free projects | No inactivity pausing |
| Subscription | $0 | From $25/month, one Micro covered by compute credit |

These allowances are not independent promises per frontend deployment; inspect organization-level billing and project usage. [Supabase pricing](https://supabase.com/pricing).

Free has no automatic database backups. Pro daily backups retain seven days; database backups do **not** include stored object bytes. Off-site encrypted backups and a restore drill remain necessary. [Backup coverage](https://supabase.com/docs/guides/platform/backups).

The Free plan does not charge overages; quota exhaustion may restrict service. Pro's spend cap is enabled by default and covers selected usage items, **not** explicitly provisioned compute, replicas, branching, custom domains, IPv4, PITR or other excluded add-ons. It is not a configurable all-inclusive dollar ceiling. Review the upcoming invoice weekly and require owner approval before any upgrade. The public docs reviewed do not establish a universal current card-on-signup rule for every Supabase/Vercel verification flow: if asked for payment details, stop for owner confirmation, rather than accepting a trial. [Supabase cost controls](https://supabase.com/docs/guides/platform/cost-control).

Default Supabase email is unsuitable for production invitations/recovery: it only sends to preauthorized project-team addresses and currently allows two messages/hour. Use owner-approved SMTP before relying on account recovery; SMTP/domain charges are outside this estimate. Public questionnaire users need not create Auth accounts, so visits/submissions are not Auth MAU. [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp). New Free projects using default SMTP also cannot customize email templates; this changed on 3 June 2026. [Email-template change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

The frontend is static/browser JavaScript, not a Node server. Build using Node 24 and the lockfile. SQL RPCs run in Postgres. If a measured workload later requires Edge Functions, they use a separate constrained runtime: 256 MB memory, two CPU-seconds/request, 150-second Free wall clock (400 seconds paid), and a 150-second request-idle limit. Do not move a long correlation/export loop into an Edge Function and assume its wall-clock allowance is CPU time. [Edge runtime limits](https://supabase.com/docs/guides/functions/limits).

### Region and exit strategy

Retain the existing project until its actual region, processing agreement and research requirements are reviewed by the owner. For new EU-resident research storage, select an explicit approved region such as Frankfurt, Paris or Ireland; the general “Europe” group can include non-EU countries. Region selection alone is not GDPR/medical-research compliance. [Supabase regions](https://supabase.com/docs/guides/platform/regions).

Postgres data/schema can be logically exported. A full migration also requires Auth configuration, custom roles/RLS, migration history, storage objects, extension compatibility and secrets to be handled separately. Moving to another Supabase project is moderate operational work; leaving its Auth/Storage/RPC contracts is more work than moving static hosting. Rehearse restore before retiring the old project. [Supabase logical migration guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Explicit pilot workload assumptions

These are planning assumptions, **not measured production usage or an unlimited-free guarantee**. Use real size measurements after the pilot. GB/MB here are decimal estimates.

| Quantity | Initial assumption | Consequence |
| --- | --- | --- |
| New submissions | 500/month | 6,000 stored submissions after 12 months if none deleted |
| Raw record including responses, narrative and provenance | Average 12 KB, high variance for specialist text | ~72 MB raw after a year |
| Indexes, derived summaries, versions and audit overhead | Budget another 12 KB/submission + 60 MB baseline | ~204 MB total after a year; not a measured compression ratio |
| Visitors | 2,000 active browsers/month; three sessions each | 6,000 monthly sessions; not 6,000 participants |
| Public static assets | Assume 3 MB/cold visit; browser cache reuse not relied on | Up to 18 GB/month on frontend host |
| Backend public requests | Six/session averaging 10 KB response | 36,000 requests, ~360 MB/month egress |
| Dashboard users/queries | Five researchers; 20 bounded requests/day each × 22 days; average 20 KB | 2,200 requests, ~44 MB/month |
| Research exports | Two full 6,000-row exports/month at 12 KB/row | ~144 MB/month additional backend egress; authorize and track them |
| Submitted files | None | 0 research object-storage bytes; do not quietly add attachments |
| Operational headroom | 2× the ~0.55 GB/month backend estimate | ~1.1 GB/month planning envelope, below 5 GB but vulnerable to abuse/full scans |
| Active authenticated staff | Five/month | Five Auth MAU, not all visitors |
| Frontend releases | 40/month including previews | Below 500-build limit |

Stored rows accumulate even in a month with zero traffic. Repeated exports increase traffic without adding stored rows. Derived jobs/snapshots can outgrow raw data if every run duplicates responses; bound caches and remove expired derived results only under a reviewed retention policy. This estimate reserves no storage for full duplicate datasets.

## Upgrade triggers and ownership

Review usage weekly in the pilot; daily during recruitment campaigns. Application thresholds below are operator warning thresholds, not provider limits:

1. At **300 MB database size or 60%** of the actual included capacity, measure table/index/analysis sizes and forecast 90 days. Approve a retention policy and paid plan before **400 MB/80%**, not after inserts fail.
2. At **3 GB monthly egress forecast**, find repeated map reads/full exports and fix them. At **4 GB**, obtain a budget decision or explicitly reduce nonessential analytics/export usage.
3. Persistent p95 research RPC time over **2 seconds**, repeated database timeouts, or an analytical run that cannot meet its bounded timeout: inspect plans using synthetic/staging cohorts, then optimize/index measured predicates. Increase compute only after evidence.
4. Before planned public recruitment with a real availability expectation, budget Pro even if data is tiny: inactivity pauses and manual recovery are not an operational guarantee. Do not use artificial keepalive traffic to disguise inactivity.
5. Owner approval is required for extra projects/compute, custom SMTP, domain purchase, native store accounts, or paid exports/storage. Start with **$0 frontend + $0 pilot backend**; the first backend production step is approximately **$25/month**, excluding all extras and taxes.

Provider quota exhaustion must produce a visible failure/pending state, never “saved” without a durable database receipt. Do not discard pending explicitly consented submissions or retry indefinitely. See [operations and recovery](OPERATIONS.md) and [native/PWA guidance](MOBILE.md).

## Confirmed product deviation

The owner explicitly chose to keep questionnaire progress **in memory only** after reviewing this expansion request. This overrides the attachment's draft-persistence requirement. The PWA may cache public application code; it must not silently restore answers after closing/reloading. Explicitly consented pending submissions use the existing, separate disclosed retry queue.
