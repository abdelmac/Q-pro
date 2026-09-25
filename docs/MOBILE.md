# Specialty Match on iOS and Android

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
