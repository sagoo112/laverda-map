# Laverda app

Expo SDK 57 / React Native 0.86.3 / React 19.2.3. PHP/PDO/MariaDB remains the backend.
The directory is public: no password screen or direct MariaDB access.

## Local setup

Use Node 24 LTS (at least 24.13), npm, and Android Studio for Android native builds.
iOS native builds need macOS and Xcode 26.4 or newer. SDK 57 supports iOS 16.4+;
older iOS devices supported by SDK 54 are no longer supported.
Use an Xcode 26.4 build image for now. Xcode 27 requires Expo's scene-support
configuration; verify the current SDK 57 release notes before switching.

From `app/`:

```powershell
npm ci
npm run data:check
npm run verify
npm start
# A development build is recommended for the upgraded native dependencies:
npm run android
# On macOS:
npm run ios
# Browser directory preview (native map is intentionally not rendered on web):
npm run web
```

If upgrading an old local native project, preserve any native customisations and
run `npx expo prebuild --clean` before rebuilding. The generated Android/iOS
directories are ignored; app.json and app.config.js are the source of native
configuration. Do not delete custom native work without backing it up.
The previous local Android project from this upgrade is preserved under
`../.local-tools/android-sdk54-backup/`.

## Build-time configuration

Set these in your environment or an untracked `.env` file, then restart Expo.
Public variables and map keys are part of the compiled app, never server secrets.

| Variable                    | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| EXPO_PUBLIC_API_URL         | API origin, eventually https://api.laverdaclub.ch; no trailing route |
| GOOGLE_MAPS_ANDROID_API_KEY | Android Maps SDK key; restrict to package and signing certificate    |
| EXPO_PUBLIC_CONTACT_EMAIL   | Optional real club contribution email                                |

No API URL is required to browse the bundled directory. Failed updates retain
the last successful public response. A missing Android Maps key shows a
directory fallback, not an unusable map or native crash. Rebuild the native app
after changing keys/plugins. iOS uses Apple Maps without a Google key.

The existing Android identifier `com.anonymous.laverdamap` was retained.
Choose release identifiers, signing and store accounts explicitly before shipping;
no store deployment or credentials are configured by this project.

## Structure and data contract

- `src/app/`: providers and typed navigation.
- `src/features/places/`: API schema, normalised model, selectors, cache, map,
  cards, draggable details and Explore.
- `src/features/resources/`: independent blogs, forums and registries.
- `src/features/club/`: club information and contributions.
- `src/shared/`: theme, buttons/icons, safe links and HTTP requests.
- `tests/`: pure data/HTTP tests and React Native component interaction tests.
- `.maestro/`: native smoke flow for a built app.
- `../archive/data/`: historical datasets, not bundled.

The API returns `{ entries: PlaceDto[] }` and a single DTO for detail requests.
Zod validates enums, nullability, dates, coordinates, booleans and unique IDs.
The app then creates a separate display model; it never changes API IDs.
Only explicit public visibility is shown.

`../api/places.json` is the authoritative import seed. Generate the public-only,
uniquely identified fallback after editing it:

```powershell
npm run data:generate
npm run data:check
```

Commit the generated snapshot alongside seed changes. Do not edit it manually.
The allocation of the one duplicate source ID matches PHP's collision-safe
importer. Keep duplicate source order stable; changing IDs requires an explicit
migration because bookmarks use IDs. The runtime API reads MariaDB, not JSON.

## Behaviour and privacy

- Explore shares search/categories between Map and List. Only actual/approximate
  destinations appear as pins; online and country-only entries remain in List.
- Saved filters all types, including blogs saved in Resources.
- Near me requests foreground permission only after a tap. It uses straight-line
  distance, keeps coordinates only in memory, and never sends them to the API.
  No background-location permission or tracking is enabled.
- AsyncStorage keeps versioned, tenant/API-scoped public data and tenant-scoped
  bookmarks. It is unencrypted and must never contain secrets or private data.
- TanStack Query handles cancellation, freshness, one bounded retry, foreground
  refetch and connectivity recovery. Invalid responses do not replace good data.
- Offline data does not imply offline map tiles, websites or route guidance.
- Website links use the platform browser; directions use the maps/browser handler.
- Membership/private content is not implemented. Add real server authentication
  and an offline/privacy policy before introducing confidential data.

## Checks

```powershell
npm run verify
npm run format:check
npx expo install --check
npx expo-doctor
npx expo export --platform android --platform ios
# With a running, freshly seeded local PHP API:
$env:LAVERDA_TEST_API_URL = "http://127.0.0.1:8080"
npm test
# Installed Maestro + running emulator/device + installed app:
maestro test -e APP_ID=com.anonymous.laverdamap .maestro/directory.yaml
```

The live API test explicitly skips if LAVERDA_TEST_API_URL is absent. Component
tests mock native maps/sheets/location; they do not prove native gestures,
permissions or external browser behaviour. Maestro is a local development tool,
not a runtime dependency. Run the flow against a disposable test installation;
it clears that installation's data.

CI checks types, lint, snapshot drift, tests, formatting and Android/iOS bundles.
No Node server is used in production; Metro/web tooling is development-only.
See the root IMPLEMENTATION.md for checks actually executed and release caveats.

## Design

Light, warm surfaces, charcoal text and a deep orange accent are shared tokens.
Category colours indicate meaning, not card position. Buttons and icon controls
have minimum 44–48 point targets. Navigation reserves safe-area and scaled-label
space. Dark mode, marker clustering, pagination and a global state framework are
deliberately not added without a concrete need.

The cleaner follow-up uses compact screen headers, borderless cards, subdued
filters and one prominent action per detail sheet. Dates and fuller descriptions
remain in details rather than being repeated in every list card. Resources has
its own search/category controls; empty filtered lists offer a one-tap reset.
Search accepts combined terms, country names and unaccented spelling. Builds
without a configured native map open in List view, with an explicit return-to-list
action if Map is selected. Offline cache and bookmark reads recover independently.
Country names include a small native fallback; the tests require it to cover all
countries in the seed, including on engines without `Intl.DisplayNames`.
