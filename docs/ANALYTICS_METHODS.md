# Research analysis methods

Implementation reviewed 25 September 2026. These are exploratory tools, not a validated psychological test or clinical decision system. Nothing in these analyses changes production questions, mappings, target profiles or weights.

## Separate three kinds of result

1. **Recorded participant result:** the student's browser-reported ranking, with the original catalog ID/revision and, for new submissions, `scoring_context`. These reports are not independently attested by the server.
2. **Canonical evaluation:** the shared TypeScript engine recalculates eligible answers against an explicitly frozen catalog using neutral dimension priorities. Selected career values still affect matching according to that engine. This is a new derived analysis, not an invented reconstruction of historical personalized settings.
3. **Database item analysis:** `research-sql-q81-v1` describes original 1–10 answers and recruitment counts. It does not implement a second scoring engine.

Raw rows are retained unchanged by these analyses. New nullable scoring-context columns do not backfill old rows. New completed submissions record five priority settings, engine and trait-mapping revisions, and a model checksum; skipped specialist questionnaires have no scoring context. Existing queued, consented legacy payloads retain their original protocol and retry without invented settings.

The collection disclosure now explicitly mentions these settings. The research owner must approve the revised participant information and decide whether ethics/consent protocol amendments and a new consent identifier are required before production collection. Provider selection does not resolve that governance question.

## Cohorts and denominators

Counts mean **submissions**, not distinct people: submission UUIDs prevent retries from making duplicate rows but do not identify repeat participants. The dashboard reports global counts separately from filtered counts and does not estimate either from the current page. Missing geography has its own count. Missing optional study year, geography, experience or satisfaction is not a quantitative eligibility failure.

Eligibility requires the supported questionnaire, schema, consent, catalog and collection versions, supported language, exact 81 valid item IDs with integer answers 1–10, and 1–4 distinct known values. Explicit specialist skips remain available for qualitative research but are excluded from quantitative evaluation. See [the backend audit](BACKEND_AUDIT.md) for the exact version matrix. SQL groups invalid payload reasons; row-level TypeScript checks provide finer reasons. A row can have multiple failures, so exclusion-reason counts do not necessarily sum to excluded submissions.

Saved cohorts are owner-only named **live filters**. They change when submissions arrive. A recorded analysis is a frozen aggregate result with member IDs/digests retained privately, filters, parameters, method version, model provenance, execution time and dataset checksum. It is not a full duplicate raw-data archive. Retention/deletion of source rows can prevent later reconstruction.

The comparison panel compares frozen A with a live B and displays their timestamps. It warns that overlap may exist; it does not assert disjointness or calculate an overlap estimate. Incompatible question versions are not pooled. Completion duration, abandonment funnels and unique participants remain unavailable because those events/identifiers are not collected. If needed later, approve minimal consented start/finish timing with coarse durations and retention before adding telemetry; do not silently start tracking answers or identities.

## Items and correlations

For a selected item, the database returns original 1–10 frequency bins, eligible n, mean, median, sample SD (n−1 denominator), floor count (1) and ceiling count (10). Distribution statistics use eligible complete q81 questionnaires. Missing/invalid values are counted across the filtered q81 cohort separately from eligibility exclusions; a consent failure is not labelled a missing answer. Fewer than two observations give no sample SD.

Correlation is Pearson's r on **original responses in eligible complete questionnaires**, not pairwise deletion and not reverse-scored trait values. Constant items or insufficient variance give no coefficient. `|r| ≥ 0.8` is only a review prompt; item direction, shared wording, translation, response styles and sampling can explain correlation. This threshold neither validates a trait nor removes an item.

The per-response and CSV-long views preserve original item values. Reverse alignment belongs to the separately labelled trait calculation, using the versioned `QUESTION_TRAITS` mapping. Multiple-testing corrections, factor analysis, reliability estimates and language invariance have not been fabricated; use the research exports and a prespecified Python/R protocol for those analyses.

## Traits and specialty/family profiles

The bounded operator evaluation reuses the exact shared engine. For each observed specialty and family it provides base/adjusted trait n, missingness, mean, median, sample SD and histogram. Specialty target differences are emitted only when that trait is measured for the full contributing eligible group; missing traits are never filled with 50 or included in a fictional denominator. No family target is invented.

The existing calibration summary identifies item-measured traits, item-plus-value relevance, value-only traits and unmeasured traits. In the current engine a chosen career value can increase the **importance** of an already measured trait without increasing its measured score; a value-only trait can be created only when that value is selected. The five dimension sliders separately adjust matching weights. These mechanisms must not be collapsed into one purported measurement.

`manual_orientation` and `prevention_orientation` remain structural limitations where not measured across the full cohort. Self-reported ability is not objectively tested competence. Recruitment imbalance and self-selection limit interpretation regardless of sample size.

## Recommendation evaluation

Only eligible specialists' actual specialties are evaluation labels. The actual specialty is looked up **after** calculating a ranking; it never enters the scoring call. Student/explorer preferences are not professional ground truth.

Dashboard analysis version `dashboard-canonical-default-v3` changes research tie handling from the old 1e−9 tolerance to **exact full-precision equality**. The participant scoring equations remain `scoring-engine-v2`. Display rounding does not make ties. Historical saved runs retain their own version/checksum.

For each actual specialty, `rankMin` is the best position in its exact-score tie and `rankMax` the worst. The operator report supplies:

- Top-1/3/5/10 inclusive recall: proportion with `rankMin ≤ k`.
- Conservative recall: proportion with `rankMax ≤ k`.
- Inclusive/conservative MRR: mean of `1/rankMin` and `1/rankMax` respectively.
- Inclusive/conservative median rank: separate medians of minimum and maximum ranks.
- Rankable denominator, exact tie count, and descriptive small-sample warning.

Participant-weighted results give every rankable submission equal weight (the name does not establish unique participants). Specialty-balanced results average nonempty specialty-specific recalls/MRR, giving each observed specialty equal weight. Reports also stratify by language, country, rechoice and experience with missing values explicit. Each stratum uses its own rankable denominator.

Population confidence intervals are intentionally null: independent participant sampling has not been established and repeated submissions cannot be ruled out. A numerical interval would not cure this design limitation. No threshold, including n=30, establishes validation. A future registered analysis may add a justified participant-cluster bootstrap or another appropriate interval after the sampling unit is established.

Frozen candidate catalogs can be evaluated by the operator on the same frozen rows without fitting or publishing anything. This is a **descriptive comparison**, not held-out performance. Any later model fitting must keep target estimation and parameter tuning within training folds, with untouched test data and an explicit analysis plan. Promotion remains the separate role-authorized, audited catalog publication workflow.

## Quality review and exports

Confirmed eligibility failures remain distinct from review-only flags. The operator flags straight-line/two-level answers and repeated full answer vectors without exclusion: identical answers do not prove duplicate people. UUID uniqueness and immutable-payload retries prevent duplicate receipt creation, not human deduplication.

The browser keeps existing raw-wide, long, analytical CSV and JSON exports but caps interactive exports at 1,000 submissions with cancellation and a 20-second network deadline. SHA-256 identifies the exact exported ordered JSON rows; metadata records filters, model checksum, exclusions and time. The created-at cutoff/keyset collection is **not** a database transaction snapshot and can reflect concurrent retention changes. Use the operator's pre/post checksum-verified workflow for reproducible larger exports (maximum 5,000); no partial cohort is silently accepted.

SQL MD5 membership digests and the legacy dual-FNV model identifiers are cache/provenance labels, not cryptographic attestations or anonymization. Export SHA-256 is also an integrity digest, not encryption. CSV strings neutralize leading formula characters; JSON preserves original values. All private exports require an authorized session and belong on controlled encrypted storage outside Git/public hosting. CSV companions may be blocked by browser multiple-download controls; JSON and operator manifests are the single-bundle metadata alternatives.

## Execution limits and remaining boundaries

Core database runs are bounded synchronous transactions: maximum 5,000 submissions, 20 retained results per owner, 10-second server timeout. Browser requests have a 20-second deadline. Cancellation stops waiting; a server transaction may still complete. Failed transactions do not create false successful results. Exact snapshots/parameters/method versions determine cache hits; refreshing or changing filters/items clears old displayed results before another request.

The expensive summary/item/correlation/run endpoints additionally share 30 successful operations per five-minute window per authorized account. A nested run counts once; a cached run still incurs its snapshot-read work and counts. HTTP 429 includes a retry delay. Failed transactions roll back their charge, so this protects routine researcher workloads but is not anonymous-submission or malicious-traffic prevention.

The operator worker has its own row/byte/time limits, progress and termination; see [operator usage](RESEARCH_OPERATOR.md). There is no durable asynchronous worker queue, automatic model training, new public dataset, or production promotion hidden in an analysis action. Large advanced evaluations are currently operator-run rather than a fully integrated dashboard job-management UI.
