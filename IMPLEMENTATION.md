# Implementation and verification — 22 September 2026

This report supersedes the earlier `REVIEW.md`. The latest request explicitly
authorised work on both the app and API. Existing uncommitted work was preserved;
the C# backend deletions already existed before this implementation. Nothing was
deployed, committed, or published, and no production database was accessed.

## Implemented improvements

- Replaced the inconsistent screen layouts with a shared light design system:
  warm surfaces, charcoal text, deep orange actions, consistent category colours,
  cards, spacing, typography and accessible control sizes.
- Added Explore with shared Map/List search and category filters, visible result
  counts, fit-results action, saved-place filtering and a useful empty state.
- Added persistent bookmarks and user-triggered nearby distance sorting. Location
  is foreground-only, held in memory, never sent to the API, and not persisted.
- Moved online resources into a browsable Resources directory and rebuilt Club
  with real data statistics and an optional configured contact address.
- Removed the misleading password gate for this public directory. The legacy
  backend unlock route remains compatible with older builds, but is not presented
  as authentication. Private/member functionality would need real server auth.
- Replaced the home-grown details overlay with Gorhom's draggable bottom sheet,
  including close/back handling and an accessible expand action. Website links
  use the platform browser rather than a second in-app WebView navigation stack.
- Country-only and online entries stay in the list and do not offer misleading
  map pins/directions. Source coordinates remain untouched; approximate locations
  have an explicit warning.
- Added TanStack Query, connectivity/foreground handling, cancellation, bounded
  retry, last-good public data caching and honest bundled/saved/live status.
  Bookmarks and cache are scoped and versioned; invalid responses do not overwrite
  good data, and failed storage reads do not overwrite unread bookmarks.
- Added a Zod wire schema, separate display model and one authoritative seed with
  a reproducibly generated mobile fallback. Preserved all 43 source records.
- Upgraded Expo 54 through the intermediate SDKs to 57.0.24, React Native 0.86.3
  and React 19.2.3, adopting the New Architecture and current splash plugin.
- Reorganised frontend code by feature and split PHP HTTP handling, DTO mapping,
  persistence and pure import validation without adding a backend framework.
- Added checksum-tracked SQL migrations, data-integrity constraints, internal
  timestamps, conditional ETag responses, tests, lint/format tooling and CI.

## File manifest

Paths below are relative to the repository root; Git shows the complete diff.

### Created or substantially rewritten

- `README.md`, `IMPLEMENTATION.md`, `app/README.md`, `api/README.md`.
- `app/App.tsx`, `index.ts`, `app.json`, `app.config.js`, `package.json`,
  `package-lock.json`, `tsconfig.json`.
- `app/src/app/`: `Providers.tsx`, `RootTabs.tsx`.
- `app/src/features/places/`: `ExploreScreen.tsx`, `PlacesProvider.tsx`,
  `PlacesStatus.tsx`, `PlacesMap.tsx`, `PlacesMap.web.tsx`, `PlaceCard.tsx`,
  `PlaceDetailsSheet.tsx`, `CategoryFilter.tsx`, `categories.ts`, `schema.ts`,
  `model.ts`, `cache.ts`, `useNearby.ts`, `data/places.generated.json`.
- `app/src/features/resources/ResourcesScreen.tsx`,
  `app/src/features/club/ClubScreen.tsx`.
- `app/src/shared/`: `api.ts`, `urls.ts`, `links.ts`, `theme.ts`, `ui.tsx`.
- `app/scripts/generate-snapshot.cjs`, `eslint.config.js`, `jest.config.cjs`,
  `.prettierrc.json`, `.prettierignore`, `.maestro/directory.yaml` and `tests/`.
- `api/public/index.php`, `api/src/bootstrap.php`, `Config.php`, `Database.php`,
  `Migrator.php`.
- `api/src/Http/`: `Router.php`, `Cors.php`, `JsonResponse.php`,
  `HealthHandler.php`, `PlacesHandler.php`, `UnlockHandler.php`.
- `api/src/Places/`: `PlaceDto.php`, `PlaceRepository.php`, `SeedValidator.php`,
  `SeedImporter.php`.
- `api/scripts/migrate.php`, `import_places.php`, `check-deployment.php`.
- `api/database/migrations/002_integrity_and_timestamps.sql`, `phpstan.neon`,
  `tests/unit.php`, `tests/integration.php`, `tests/upgrade.php`.
- `.github/workflows/verify.yml`, `.gitignore`, `api/.gitignore`.

### Moved, removed or retained

- Historical `app/src/data/places_old.json` and `laverda_addresses.json` moved to
  `archive/data/`, with `archive/README.md`; they are not bundled.
- Removed the duplicate hand-maintained `app/src/data/places.json`; its replacement
  is generated from the unchanged `api/places.json`.
- Removed obsolete screens/navigation/context/components, redundant place types,
  old normalisation/map helpers, the unused dark-map style and broken migration/
  enrichment scripts. Their replacements are in the feature/shared folders above.
- Removed the previous review's now-unused PasswordGate and WebsitePreview and
  their direct navigation/WebView dependencies.
- Renamed `app/assets/laverda-logo.png` to `laverda-logo.jpg` without changing its
  bytes: the original was a JPEG with a PNG extension, rejected by Android AAPT.
- Existing SQL baseline and migration 001 remain the migration starting point.
- Obsolete `.NET` solution/project/models/configuration deletions remain in the
  working tree from the earlier PHP replacement; no .NET backend was restored.
- Preserved the old local native Android project in the ignored
  `.local-tools/android-sdk54-backup/` before regenerating it. Test runtimes,
  databases, bundles and native build artifacts are ignored, not source files.

## Database, contract and import

- `tenants`: `id`, unique `slug`, `name`, `is_active`, `created_at`, `updated_at`.
- `places`: tenant foreign key and case-sensitive composite `(tenant_id, id)` key;
  type, category, name, description, address, country, URL, status, visibility,
  verified, link type, JSON tags, priority, last-checked date, double-precision
  latitude/longitude, location mode/label/source, navigation URL, source order,
  and internal timestamps. Public-order and filter indexes are retained.
- `schema_migrations`: migration name/checksum and execution timestamp, protected
  by an advisory lock while applying ordered SQL files.
- CHECK constraints reject invalid booleans, non-array tags, invalid coordinate
  pairs/ranges/modes, visibility and types. DDL auto-commits; back up before an
  upgrade and never change an already-applied migration.
- Transactional CLI import creates tenant `laverda` if absent and upserts every
  entry. It preserves existing tenant settings, does not delete absent records,
  and leaves unchanged rows' timestamps alone. The one duplicate source ID gets
  a stable `-2` suffix; no record is discarded.
- Runtime requests read MariaDB only. `api/places.json` remains reproducible seed
  input; `npm run data:generate` produces the public mobile fallback with the same
  deterministic IDs.
- Collection response remains `{ "entries": [...] }`; detail remains a single
  DTO. Camel-case fields and nested `location: {mode, lat, lng, label}` are retained.
  Internal tenant/timestamp fields are not leaked into the mobile contract.
- Only active tenants and explicitly public places are returned. Stable ordering,
  native PDO prepared statements and safe production errors are retained.

Endpoints:

```http
GET /health
GET /api/v1/tenants/laverda/places
GET /api/v1/tenants/laverda/places/{id}
GET /api/places                     # older clients
GET /api/places/{id}                # older clients
POST /auth/unlock                   # older clients only; not real authentication
```

## Configuration and commands

API server/CLI: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
Optional: `CORS_ALLOWED_ORIGIN`; `APP_PASSWORD` only for legacy clients.
Credentials are never compiled into the app or committed.

App build: `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_ANDROID_API_KEY`, optional
`EXPO_PUBLIC_CONTACT_EMAIL`. Missing API configuration still allows the included
public directory. Missing Android map configuration shows a safe directory
fallback. Restrict the map key to the chosen package and signing certificate.

After creating the database and setting the appropriate account/environment:

```powershell
# Repository root; migration account first, import account for the second command:
php api/scripts/migrate.php
php api/scripts/import_places.php
php -S 127.0.0.1:8080 -t api/public api/public/index.php
```

In another terminal:

```powershell
Set-Location app
npm ci
npm run data:check
$env:LAVERDA_TEST_API_URL = "http://127.0.0.1:8080"
npm run verify
npm run format:check
npx expo install --check
npx expo-doctor
npm run android
```

The two project READMEs contain complete account setup, clean test-database
commands and deployment instructions. Do not run integration tests against real
data: they require a new empty database named `laverda_test_*`.

## Checks actually executed

Windows, Node 24.13.0, PHP 8.3.33/PDO MySQL, isolated MariaDB 11.8.5:

- All 21 PHP files passed syntax checking; 12 pure importer assertions passed.
- PHPStan level 5 passed with a 512 MiB memory limit.
- Final PHP integration suite: **802 assertions passed** on a fresh isolated
  database, covering migrations/repeat import, all 43 records and fields,
  transactional rollback, constraints, HTTP health/list/detail, unknown resources,
  public visibility, tenant isolation, search, CORS, ETags and safe errors.
- Populated-baseline upgrade test passed: all 43 existing records/fields unchanged
  and repeated migration was a no-op.
- The read-only deployment smoke script passed against the local PHP API.
- `npm run verify`: TypeScript, ESLint, generated snapshot check, **16 Node tests**
  and **6 component tests** passed. The live PHP compatibility test ran, not skipped.
- `npm run format:check` passed.
- Expo dependency compatibility check passed; Expo Doctor passed **21/21** checks.
- Android, iOS and web production bundle exports passed.
- Native Android release-variant **x86_64 emulator APK built successfully**.
  It uses the generated development signing configuration, not store credentials.
- Browser preview inspected at mobile width: Explore search/bookmarks/details,
  Resources, Club and navigation. The tab-label clipping found during inspection
  was fixed and rechecked. Native map rendering is deliberately absent on web.
- Maestro native smoke test **passed** on the disposable Android emulator:
  public cold start, List view, search, bookmark/save filter, native details sheet,
  navigation action visibility, close and bookmark persistence across app restart.
  This does not verify actual external routing or map tiles without a configured key.
- `git diff --check` passed; `api/places.json` has no diff.
- Final npm advisory audit: **11 moderate, 0 high, 0 critical** dependency-chain
  entries. The audit exits nonzero until those moderate advisories are resolved;
  this is not a clean security audit. Remaining entries are in the Expo native
  build-tooling chain. No forced SDK downgrade or incompatible override was used.

Initial native builds exposed the incorrectly named JPEG and then a stale
generated PNG resource. Correcting the filename and clearing that one generated
resource resolved the build; unsuccessful attempts are not counted as passes.
The first emulator test was blocked by an Android System UI ANR dialog, not an
app exception. After selecting Wait, the entire unchanged smoke flow passed.
Temporary preview/API/database servers and the read-only emulator were stopped
after verification. Ignored test artifacts and the native-project backup remain
available locally; the user's saved emulator data was not reset.

The GitHub workflow was added but has **not** run on GitHub in this task. There was
no iOS native build, physical-device test, store signing/release or Hosttech deploy.

## Hosttech/Plesk and release handoff

1. Create `api.laverdaclub.ch`, point its document root at `api/public`, select a
   supported PHP 8.3+ handler with PDO MySQL and configure Apache rewrite support.
2. Create the persistent MariaDB database and least-privilege accounts. Configure
   DB variables for PHP requests and the migration/import CLI separately.
3. Upload API source by FTP including `.htaccess`, keeping source/config/scripts
   outside the document root. Back up, migrate, and import through SSH or a
   temporary Plesk scheduled task; do not create a public import endpoint.
4. Enable HTTPS and renewal, configure suitable request limits, error logs and
   backups, then run `check-deployment.php` and verify a known detail ID.
5. Build the app with the final API origin, restricted map key and real optional
   contact email. Final app identity, signing and store accounts require a choice.

The exact Plesk PHP handler, MariaDB version, server-variable controls, CLI/task
access and backup facilities depend on the Hosttech subscription. Hosting support
may need to configure them. No secrets or hosting details were invented.

Before release, test actual Google/Apple maps, GPS permission grant/denial, external
website/routing handlers, large text and screen readers on physical Android/iOS
devices. Expo 57 raises the minimum iOS version to 16.4; native iOS verification
requires macOS/Xcode. Reassess the remaining moderate npm advisories.

Dark mode, clustering, server pagination, member authentication and a global-state
framework remain future options, not necessary additions for this 43-entry public
directory. Offline snapshots contain formerly public data and cannot be remotely
erased from disconnected devices; never publish private content into them.

## Subsequent design-cleanup pass

The later request asked for a cleaner version of the same design. This pass keeps
the API, seed, dependencies and native configuration unchanged. It refines shared
theme/UI primitives, Explore, cards, filters/status, map fallback, details,
Resources and Club; it also updates model/provider logic, tests and the Maestro flow.

- Simplified headings, lighter type, fewer borders/boxed surfaces and less repeated
  metadata. Saved/category controls share one strip and Near me is a compact action.
- Details keep one prominent navigation/website action, with accessible toolbar
  controls for saving, expanding/collapsing and closing. Checked dates remain there.
- Club uses simple sections and expandable offline/privacy information. Resources
  has keyword/type filters and both directories have one-tap empty-state recovery.
- Search recognises full country names, accent-free spelling and combined keywords;
  source names/fields are unchanged. Unconfigured maps default to a usable List.
- Offline cache and bookmarks load independently; a cache read error no longer
  blocks correctly restored bookmarks, while unread bookmarks are never overwritten.

Follow-up validation: TypeScript, lint and formatting passed; 17 Node tests and
14 component tests passed. The live PHP test was explicitly skipped because no
API server was started in this UI-only pass; the earlier database results above
were not rerun. Browser layout/interactions were inspected at 390px and 320px.
The Android release-variant x86_64 test APK built successfully. Windows initially
prevented Gradle from removing generated packaging directories; those directories
were moved to recoverable ignored backups before the successful rebuild. This was
not a source-code compilation failure. Native inspection also exposed missing
Intl.DisplayNames support: a small built-in fallback now covers all seeded countries,
with a regression test that disables the platform API. The source data is unchanged.
The extended Maestro flow passed on the rebuilt APK: cold start, country-name and
accent-insensitive search, clear search, bookmarks and Saved filtering, navigation
action visibility, sheet expand/close and bookmark persistence across restart.
The initial emulator attempt was obstructed by a System UI ANR dialog; selecting
Wait cleared that system dialog before the successful complete run.
Final Android, iOS and web exports also passed. No physical-device or native iOS
test was performed in this pass. Temporary preview/emulator processes were stopped;
generated test artifacts and recovery backups remain ignored locally.
