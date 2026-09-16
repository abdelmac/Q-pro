# Participation map: API, geography and release policy

The map reuses `student_responses` for students and explorers (`participant_role = curious`) and `specialist_responses` for specialists. The public API translates `curious` to `non_medical`. No third response table or parallel scoring system is introduced.

## Filter access

The unfiltered map remains public, including zoom, panning and selecting a country to inspect its already-published counts. All filter controls (participant type, country, language, period and version) require an enabled `doctor` or `professor` portal account. Sign in to the dashboard, then open **Administration → Participation map** in its sidebar (or mobile menu). The map stays inside the portal, with its existing Back and Refresh controls; Refresh keeps the applied filters. Selecting “specialist” in the questionnaire does not grant administrative access; read-only `researcher` accounts do not have this permission either. Returning to the questionnaire signs out of the portal as before.

The embedded view shares the public map component and aggregate API, without duplicating its page header or navigation. It includes all six filter arguments: respondent type, country, questionnaire language, first month, last month and data version. Month validation, reset, zoom, country details and mobile filter drawer are unchanged. The map is loaded on demand and requires no additional database migration.

The UI checks `current_user_portal_profile` and clears filters and displayed filtered data when the session changes or access is denied. The SQL facade independently checks `private.require_portal_role` before accepting any non-default filter. Anonymous users, ordinary signed-in users and disabled accounts receive SQLSTATE `42501` if they call filtered queries directly. No additional raw data or table grants are introduced.

## Collection and provenance

`submit_student_response_v6` keeps all v5 parameters and adds nullable `p_country_code` and `p_region`. It creates participant schema 5. `submit_specialist_response_v5` keeps all v4 parameters and adds the same two fields; it creates specialist schema 3. Both require `research-consent-2026-09-16-geography`. The optional medicine prompt remains `medicine-view-optional-v2`; the scoring, questionnaire and calibration versions are unchanged.

Country is voluntary. Whitespace-only country/region inputs become `NULL`, ISO alpha-2 codes are normalized to uppercase, and the country name is derived on the server from a fixed list of 249 ISO codes matching `src/data/countries.json`. Unknown aliases and codes are rejected. Region is optional, trimmed, limited to 100 characters / 400 UTF-8 bytes, and cannot contain control characters or exist without a country. Region is available only through the existing researcher access controls. No city, address, IP or GPS is collected by these changes.

Same-ID retries with an identical normalized payload return the original ID. Changing country or region on that ID produces conflict `23505` instead of modifying the submitted record. Missing country remains unknown. Legacy endpoints, schema rows and consent records retain their contracts; no geography is inferred or backfilled.

## Public API

Call Supabase RPC `get_participation_map_stats`, available to `anon` and `authenticated` **without filters**:

```ts
await supabase.rpc('get_participation_map_stats', {
  p_respondent_type: 'all', // all | student | specialist | non_medical
  p_country_code: null,    // optional ISO alpha-2
  p_language: 'all',       // all | en | ro | fr
  p_month_from: null,      // inclusive YYYY-MM-01
  p_month_to: null,        // inclusive YYYY-MM-01
  p_data_version: 'all',   // all | current
});
```

Date filters accept full closed UTC months only. There are no arbitrary day windows, regional filters or specialty filters. `current` selects q81-v1, participant schema 5 and specialist schema 3. The endpoint returns `total`, `countries`, `students`, `specialists`, `nonMedical`, and `groups` of `{countryCode, country, count, students, specialists, nonMedical}`. Privacy metadata is `privacyThreshold: 10`, `rounding: 5`, `granularity: "month"`, and `publishedThrough` (last published month's final ISO date, or null).

The totals describe the published subset, not every recorded questionnaire. They must be presented as approximate, privacy-protected published counts. Geography omission, small cells, unfinished questionnaires, skipped specialist questionnaires and the current month contribute no public count. A newly launched map can therefore be empty even when the private research dashboard has responses.

## Privacy release mechanism

`private.publish_participation_map_month(date)` publishes one closed UTC month. It groups consented, complete, valid 81-answer questionnaires into disjoint cells of month, country, respondent type, language, questionnaire version and submission data version. Every cell must contain at least 10 responses. Accepted cell counts are rounded **down** to a multiple of 5; rejected counts are omitted completely. Neither hidden cells nor their raw totals are stored in the release tables.

The public endpoint reads only `private.participation_map_cells`. It never counts individual rows at request time. Every supported filter computes sums of exactly the same published cells. Subtracting broader and narrower totals can recover at most already-published rounded cells; it cannot reveal a suppressed cell, as those cells contribute zero even to the broadest total.

Each monthly snapshot is sealed in `private.participation_map_months`. A transaction advisory lock serializes concurrent publishers. Publication is idempotent and includes empty months. Triggers forbid changing/removing released cells or metadata and forbid inserting a cell into a sealed month. Late-arriving/backdated records therefore cannot change a previously published count and reveal a difference of one. The release tables use RLS without public policies and no public table privileges. The public wrapper has an empty search path and explicitly limited execute grants; private publication is executable by the service role/database owner only.

This is threshold suppression and rounding, not a formal differential-privacy guarantee. It reduces disclosure through the published aggregates, including administrator-only filtered views. It does not prove respondents are unique people or prevent dishonest questionnaire submissions; the map counts submitted questionnaires, not verified individuals.

## Operations and verification

The migration installs pg_cron job `q-pro-publish-participation-map` at 01:15 on day 1 of each month. The SQL explicitly calculates UTC month boundaries. The migration also seals the most recent closed month, normally empty when the feature is introduced. If pg_cron is unavailable, migration fails rather than silently installing a non-updating map; enable the Supabase Cron extension before retrying.

A database operator can recover an unpublished closed month with:

```sql
select private.publish_participation_map_month(date '2026-09-01');
```

Calling it again returns zero and leaves the snapshot unchanged. Monitor the scheduled job through Supabase Cron and its run history. Do not edit released snapshots, publish an open month, or expose raw submission tables to repair a map display.

`supabase/tests/database/002_participation_map.sql` verifies normalization, invalid country/region rejection, consent enforcement, unchanged idempotency semantics, access boundaries, role mapping, complete-questionnaire eligibility, threshold suppression, round-down totals, filter subtraction safety, immutable releases, invalid date filters, metadata and cron installation. The earlier research-security suite remains applicable to all legacy endpoints.

Supabase documentation consulted: [database functions](https://supabase.com/docs/guides/database/functions), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart), and [Data API access changes](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). Explicit grants and private RLS follow the Supabase/PostgreSQL skills used for this change.
