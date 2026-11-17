# Full-app review — 22 September 2026

Scope: the latest request explicitly included both the frontend and backend. The
existing PHP/MariaDB replacement, password gate, native package identity, and
architecture setting were retained. No production system was changed or deployed.
Both source JSON files remain unchanged and byte-identical.

## Improvements

- Map, Blogs, and About now use the same API-backed provider. Blogs no longer
  silently read a separate static data source.
- API requests have a timeout, cancellation, payload validation, honest fallback
  messaging, and retry/pull-to-refresh support. Login distinguishes a rejected
  password from an unavailable or misconfigured server and prevents duplicate submits.
- Nullable API fields match TypeScript types. Duplicate source IDs get stable,
  collision-safe suffixes without losing records. Invalid coordinates fall back
  safely and only explicitly public entries are shown.
- Suggestions respect the map's category/search filters; marker keys stay stable;
  selected details follow refreshed data. Empty searches show a useful message.
- Country-centre markers are labelled and no longer offer misleading directions.
  Place details have a close button and Android back handling.
- Website previews share safe-area, loading, and failure handling. Data-provided
  links are limited to HTTP(S), and external browser/maps failures are handled.
- Safe-area spacing prevents content from sitting behind the floating tab bar.
  Key controls have accessibility labels/roles/states.
- About statistics are calculated from real data; unsupported bookmark claims and
  the fake contribution address were removed. The contact email is configurable.
- Android map key placeholders were replaced by build-time configuration. Existing
  native identity and architecture choices are unchanged.
- Native PDO text search now uses distinct parameter names and literal wildcard
  escaping. Invalid query shapes/oversized values receive HTTP 400.
- Import preserves tenant activation/name settings, validates input, rolls back
  failures, and retains coordinate precision independently of PHP INI settings.
- Place IDs are case-sensitive; an explicit SQL upgrade is supplied for existing
  databases. Public DTO structure and legacy API endpoints remain compatible.
- Health checks table access, configuration supports server variables, database
  connection time is bounded, unlock bodies are bounded, and CORS Vary is correct.
- Compatible dependency patches were applied and locked: Expo 54.0.37, matching
  Expo font 14.0.12, and transitive security fixes. No major SDK upgrade or forced
  dependency override was applied.

## Files touched in this review

Some backend files and PasswordGate were already uncommitted before this review.
The obsolete C# deletions visible in Git predate this review and were preserved.

Frontend updates:

- `app/App.tsx`, `app/app.json`, `app/package.json`, `app/package-lock.json`
- `app/src/components/PasswordGate.tsx`, `CategoryFilter.tsx`, `PlaceBottomSheet.tsx`
- `app/src/context/PlacesContext.tsx`, `app/src/navigation/RootTabs.tsx`
- `app/src/screens/MapScreen.tsx`, `BlogScreen.tsx`, `AboutScreen.tsx`, `PlaceDetailsScreen.tsx`
- `app/src/types/entry.ts`
- `app/src/utils/normalizeEntries.ts`, `openMaps.ts`, `placeCategories.ts`

Frontend additions:

- `app/app.config.js`, `app/README.md`
- `app/src/services/api.ts`
- `app/src/utils/parseEntries.ts`, `urls.ts`
- `app/src/components/PlacesStatus.tsx`, `WebsitePreview.tsx`
- `app/tests/register.cjs`, `api.test.cjs`, `places.test.cjs`, `live-api.test.cjs`

Removed: `app/src/utils/placesData.ts`, the now-unused parallel static data loader.
It remains recoverable from Git history; the source JSON was not removed.

Backend updates:

- `api/.gitignore`, `api/README.md`, `api/database/schema.sql`
- `api/public/index.php`
- `api/scripts/import_places.php`
- `api/src/Config.php`, `Database.php`, `JsonResponse.php`, `PlaceRepository.php`

Backend additions:

- `api/database/migrations/001_case_sensitive_place_ids.sql`
- `api/tests/integration.php`
- This root `REVIEW.md` report

## Executed validation

Environment: Windows, Node 24.13.0, portable PHP 8.3.33 with PDO MySQL, isolated
loopback MariaDB 11.8.5. No production database or credentials were used.

- `npm ci --ignore-scripts`: successful clean lockfile installation. An initial
  attempt encountered a Windows file lock; the retry completed.
- `npm run typecheck`: passed.
- `npm test` with `LAVERDA_TEST_API_URL` pointed at the seeded local API: all 12
  tests passed, including the real PHP response through the app parser/normalizer.
- `npx expo install --check`: passed, dependencies compatible with Expo 54.
- `npx expo export --clear --platform android --platform ios --max-workers 2`:
  passed after the clean dependency reinstall. Android and iOS Hermes bundles
  and asset metadata were generated in an external temporary directory.
- PHP syntax checks: all 7 PHP files passed.
- `php api/tests/integration.php`: 785 assertions passed, covering schema creation,
  first/repeated imports, 43 unique records, exact source-field preservation,
  transaction rollback, tenant settings, both versioned/legacy endpoints, unknown
  tenants/IDs, search/filter validation, injection strings, visibility, tenant
  isolation, case-sensitive IDs, unlock, CORS, missing-schema errors and recovery.
- Applied the SQL ID-collation migration to an already-seeded test database:
  all 43 records remained and `utf8mb4_bin` was confirmed.
- Direct PHP server-variable configuration fallback check: passed.
- After stopping the isolated MariaDB server, `/health` returned 503/Unhealthy
  and the collection returned a generic 500 without leaking database details.
  The temporary PHP and MariaDB servers were then stopped.
- Temporary downloaded runtimes, test databases, and exported bundles were removed
  after verification. They are reproducible from the documented commands; source
  files and the retained regression suites were not removed.
- `git diff --check` and generated SQLite-file ignore checks: passed.
- Dependency audit: reduced from 33 vulnerable packages (including 2 critical)
  to 16 (9 high, 7 moderate), including dependency-chain entries.

Earlier export attempts failed resolving a React dependency; these were not
counted as successful builds. The clean reinstall resolved that failure.
No emulator/physical-device UI test, signed APK/IPA
build, iOS native build, or real Hosttech deployment has been performed.

## Release follow-up / manual configuration

1. Reassess the 16 remaining audit entries before release. Their root dependencies
   are `image-size`, `postcss`, and `uuid` in Expo/Metro/native build tooling. npm
   proposes a major Expo upgrade; this needs a planned SDK migration and native
   testing. Do not expose development servers or process untrusted build inputs.
2. Test the UI on real Android/iOS devices: login, search/category interaction,
   native maps, back handling, keyboard, website previews, safe areas, and offline
   fallback/retry. Bundle/type checks do not prove native runtime behavior.
3. Set the API URL, a restricted Android map key, and optionally a real contact
   email. No actual key or email address was invented or committed. Rebuild native
   config after changing the map key; choose the final package/signing identity
   deliberately if the current development identity is not the release identity.
4. Hosttech/Plesk still needs the subdomain, public document root, PHP/PDO handler,
   database, secure server variables, schema/import, HTTPS, and suitable request
   limits. Back up existing PHP databases before the ID-collation migration.
5. The password screen is not server-enforced protection for public place data.
   Member-only content would require proper server authentication/authorization
   and a review of bundled/offline data. No confidential data should be bundled.

Run/setup instructions are in `app/README.md` and `api/README.md`.
