# Specialty Match on iOS and Android

Release guidance and official requirements checked **25 September 2026**. Account creation, payment, signing and store publication remain explicit owner actions.

The native projects in `android/` and `ios/` run the existing React/TypeScript application through Capacitor 8. The questionnaire, specialist interview, results, explorer, comparison, map, methodology, credits, dashboard, translations and scoring engine are the same source files as the website. No second algorithm or copied specialty database is maintained. The generated app identifier is `ro.qpro.specialtymatch`; choose the final owned identifier before creating store records.

This is a Capacitor implementation, not an Expo/React Native rewrite. It preserves the existing interface and all shared calculations inside a native web view, with native lifecycle and encrypted storage integration.

## Build and run

Use Node.js 22 or later (this repository was checked with Node 24). Native requirements are described in the [official Capacitor environment guide](https://capacitorjs.com/docs/getting-started/environment-setup): Android Studio 2025.2.1 or newer with JDK 21 and Android SDK 36; macOS and Xcode 26 or newer for iOS. The generated projects target Android API 24+ and iOS 15+.

Install the lockfile dependencies and provide the same public Supabase URL/publishable key used by the web app. Never include a service-role key, administrator password, or signing secret in a Vite variable.

```sh
npm ci
npm run typecheck
npm run test:mobile
npm run build:mobile
npm run mobile:sync
```

`build:mobile` builds into `dist-mobile/` with relative asset URLs, independently of the GitHub Pages base path. `mobile:sync` rebuilds and copies the assets and native plugins into both projects. The native configuration has no remote `server.url`: the questionnaire, narratives and engine are bundled and can load without a connection. Fetching a published configuration for the first assessment, sending contributions, the public map's live counts and administrator functions still require the backend. Once downloaded, a published configuration can be retained with an assessment for offline continuation.

For Android:

```sh
npm run mobile:android
```

Choose an emulator or USB device in Android Studio, then run the `app` target. A development APK can also be built with `android/gradlew assembleDebug` on macOS/Linux or `android\gradlew.bat assembleDebug` on Windows when the Android SDK and JDK are configured. Production uses **Build → Generate Signed App Bundle / APK** and an owner-controlled signing key. Keystore files are ignored by Git.

For iOS, run on a Mac:

```sh
npm run mobile:sync
npm run mobile:ios
```

Select the App project, configure the signing team and bundle identifier, resolve Swift Package Manager dependencies, and run on a simulator or device. App Store distribution requires an Apple Developer account, an archive, signing and the store's review process. Neither `cap add` nor `cap sync` produces a signed application or proves device compatibility.

## Questionnaire progress stays in memory

This is an explicit owner decision reconfirmed for the September 2026 expansion. It overrides the attached specification's request to restore questionnaire drafts across restarts. Installing a PWA or a native wrapper must not silently re-enable draft saving.

Questionnaire answers and written reflections are kept only in React state while the page is open. Back/forward navigation within the app retains them; reloading, closing the page, or terminating the native app starts a new questionnaire. There is no local auto-save, saved-draft prompt, or resume control. The browser's leave-page warning remains available for unfinished answers.

On startup, `clearLegacyQuestionnaireProgress` removes only the retired `qpro.questionnaire.v1` draft and `qpro.autosave-enabled.v1` preference when storage is accessible. It does not read or restore the old draft, and it does not remove consented contributions, language preferences, or authentication data. The historical draft codec remains covered by unit tests but is no longer wired into the application.

## Encrypted native storage and research queue

`src/lib/mobileRuntime.ts` selects [@aparajita/capacitor-secure-storage](https://github.com/aparajita/capacitor-secure-storage) only on native platforms. Android uses AES-GCM with an Android Keystore key; iOS uses the Keychain. iCloud synchronization is disabled and iOS entries use `whenUnlockedThisDeviceOnly`. Android backup is disabled. Storage errors do not trigger a plaintext native fallback. Keychain data may survive an iOS uninstall; use the app's clear-data control before removing the app when deletion is required.

In a web browser, the research queue uses ordinary localStorage, which is not encrypted. Only explicitly saved research contributions are queued. The save step explains this storage; a pending-contributions notice provides retry and removal controls when needed, and disappears when the queue is empty. The retired draft-saving panel is not displayed.

`src/lib/submissionQueue.ts` only accepts a contribution after explicit save consent. Its payload is copied at enqueue time and retains the same UUID, published configuration ID, collection/consent versions and exact RPC parameters throughout retries. A conflicting payload with the same UUID is rejected. The queue never stores administrator sessions, access tokens, refresh tokens or passwords; the client sender authenticates when the request is actually made.

Queue operations and network flushes are serialized through one native application instance. Browser localStorage is marked as shared: enqueue, individual-entry removal and sending require an origin-wide Web Lock, coordinating independent tabs as well as one tab's client. If Web Locks are unavailable, these operations fail before reading or changing pending data; they do not fall back to unsafe per-tab locking. Read-only inspection and explicitly clearing the entire queue remain available for recovery. Use an up-to-date browser in a secure HTTPS context (or localhost during development), or the native app, to save/send contributions. Database idempotency remains authoritative if the same UUID is resent after a crash. Transport failures, HTTP 408/429 and server failures retry with bounded exponential backoff; validation/authentication failures are marked rejected and need user action. The queue permits at most ten entries and 1 million JSON characters, and stops automatic retries after seven days. Expired/rejected entries remain visible for explicit deletion. Accepted entries are removed locally immediately. Pending submission payloads are never recomputed against a newer catalog.

The native app uses foreground/reconnect retries. It does not schedule background uploads after the operating system suspends or terminates the app. Reopen it with a connection to retry. No GPS or location permission is requested; country and optional region are entered manually.

## Verification and release status

`npm run test:mobile` checks targeted legacy-draft cleanup, the historical draft codec, explicit consent, immutable submission IDs/payloads, retries, permanent validation errors, expiry, queue limits, concurrent flushes, two independent queue instances sharing storage under Web Locks, and fail-safe behavior without those locks. `npm run test:browser` exercises the responsive web interface, in-memory answers without auto-save, and offline submission/retry flows with Playwright; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chrome/Edge executable if needed.

The native projects can be scaffolded and synchronized on Windows. This environment has no Android Studio/JDK or macOS/Xcode, so a compiled APK/AAB/IPA, native-device keychain round-trip, simulator/device interaction, signing, store screenshots/privacy declarations and store publication remain release tasks. Before release, test airplane-mode continuation in the open app, questionnaire reset after force-close, reconnect submission, the Android back button, device text scaling, keyboard/safe-area behavior, and clearing pending contributions on both platforms. Use test submissions in a non-production backend for native end-to-end research tests.

## Installable web app and offline boundary

The production web build generates `sw.js` with an exact allowlist and content-derived version of public HTML, compiled JS/CSS, icons and manifest. The browser registers it only on secure production web origins, at the configured root or `/Q-pro/` scope. Development and Capacitor builds do not register it. This is optional enhancement: a storage failure must not block the online app.

After the first successful online installation, the root shell can open offline. This caches **public application code, not research responses**. Supabase requests, authentication, public-feature settings, public/private map responses, dashboard APIs, exports, unknown paths and query-string requests are network-only with no cache fallback. Compiled dashboard UI code is public; authorized research data is not. A new assessment still needs the current published catalog from the backend; an already-open assessment retains its locked model in memory during a temporary outage. No public geography is available offline. Previously downloaded information cannot be remotely erased.

The worker does not force-refresh tabs or upload in the background. A new version waits until old windows close, avoiding loss of an in-progress questionnaire. Close all app tabs/windows and reopen online after a release when ready to discard or after finishing open answers. Existing consented submissions continue using the separate foreground retry queue, never the service-worker cache. Browser storage can be evicted; this is not a backup or delivery guarantee. [Service-worker lifecycle and scope](https://web.dev/learn/pwa/service-workers).

The homepage includes EN/FR/RO installation guidance:

- iPhone/iPad: open in Safari, use Share → Add to Home Screen, and enable “Open as Web App” if offered. [Apple home-screen guidance](https://support.apple.com/en-euro/guide/iphone/iph42ab2f3a7/ios).
- Android: in Chrome, use its menu → Install app/Add to Home screen; wording and availability vary.
- Desktop Chrome/Edge: use the install affordance/menu if available. Do not assume every browser exposes a programmable install prompt. Installation is optional; the normal website remains usable. [Chrome web-app installation](https://support.google.com/chrome/answer/9658361).

`node scripts/verify-pwa.mjs` builds isolated synthetic sites at both `/Q-pro/` and `/`, checks offline shell loading, and confirms private/map/auth/settings/export requests cannot fall back to injected stale cache entries. It does not use a production backend or prove physical iOS/Android behavior.

## Native release checklist

1. Choose the institution/person owning `ro.qpro.specialtymatch` before making store records. Keep signing/upload keys and recovery codes in owner-controlled secure storage; never in `.env`, Git or frontend bundles. Increase Android `versionCode` and iOS build number for releases. Preserve a manifest of Git SHA, backend environment, questionnaire/scoring versions and signed-artifact checksum.
2. Build `dist-mobile` and sync on a clean lockfile install. The same TypeScript engine is bundled on web and native; do not implement a second Java/Kotlin/Swift scoring algorithm. Run common scoring fixtures and compare full-precision results on both devices before publication. A successful web test is not a native-device equivalence test.
3. Android: configure SDK 36/JDK 21, run debug build and instrumented/manual tests, then generate a signed Android App Bundle with owner-controlled upload signing. Repository minSdk is 24 and target/compile SDK is 36. Google Play has required API 36 for ordinary new apps/updates since 31 August 2026; recheck before uploading. [Target API policy](https://support.google.com/googleplay/android-developer/answer/11926878).
4. iPhone/iPad: build on macOS with Xcode 26+ and the command-line tools, select the signing team and resolve the existing Swift Package Manager dependencies. Test on simulator and physical hardware, archive, validate and distribute to TestFlight before review. The app deployment minimum (iOS 15) differs from the build SDK: Apple requires iOS/iPadOS 26 SDK or later for uploads from 28 April 2026. [Apple SDK requirement](https://developer.apple.com/news/?id=ueeok6yw).
5. Verify keyboard avoidance, safe areas, large text, screen readers, rotation, Android back, suspend/resume, no-draft force-close behavior, session expiry/revocation, secure-store round-trips, airplane mode and same-ID retries. Test both map-switch states against an isolated backend, including direct API attempts. Never use screenshots containing real responses for store material.
6. Current authentication is password-based. Native session storage uses Keychain/Keystore through `getAppStorage`; do not add a plaintext fallback. **Universal/App Links and OAuth/password-recovery callback deep links are not configured in the native manifests.** Before adding them, choose an owned HTTPS domain, configure verified Android asset links/iOS associated domains and an allowlisted callback handler with PKCE/state validation. No unvalidated URL may select a research route or inject a token. The map's backend guard must remain authoritative regardless of route.
7. Inventory app and plugin data access and required-reason APIs; verify the final archive's privacy manifest rather than guessing declarations from the web source. Complete Apple's App Privacy details, Google Play Data safety, a public privacy/support URL and any applicable health-app declarations. Report research answers, manually entered coarse geography, staff authentication and backend diagnostic processing accurately; “no names requested” is not automatically “no data collected.” [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469).

### Accounts and unavoidable distribution costs

Google Play developer registration is **US$25 one time**, with identity and applicable device verification; the owner chooses personal or organization registration. [Google registration](https://support.google.com/googleplay/android-developer/answer/6112435). For affected new personal accounts, production access requires a closed test with **at least 12 testers continuously opted in for 14 days**, then an application for production access; review is not guaranteed. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

Apple Developer Program membership is normally **US$99/year** or regional equivalent; eligible accredited educational/nonprofit/government institutions may request a waiver. Organization enrollment has legal-entity/authority and identity requirements. A free Apple account is not a substitute for App Store distribution membership. [Apple enrollment](https://developer.apple.com/programs/enroll/).

No account purchase or app publication is authorized by these instructions. Domain, email, test devices and access to a Mac may add costs. The PWA can be distributed as a website before store release without either store membership.
