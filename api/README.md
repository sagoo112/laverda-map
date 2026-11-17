# Laverda PHP API

A small, framework-free REST API for PHP shared hosting:

```text
React Native app -> HTTPS/JSON -> PHP API -> PDO -> MariaDB
```

The API has no Composer, Node.js, .NET, Docker, or runtime JSON dependency.
PHPStan is optional development-only tooling; it is not uploaded or loaded by the API.
`places.json` is used only by the explicit CLI import command.

## Requirements

- PHP 8.3 or newer (use a currently supported patch release)
- PDO MySQL extension (`pdo_mysql`)
- MariaDB 10.11 or newer (integration tests use 11.8)
- Apache `mod_rewrite`, or equivalent web-server routing to `public/index.php`
- HTTPS in production

## Project layout

```text
api/
  database/schema.sql        MariaDB schema
  database/migrations/       SQL upgrades for existing deployments
  public/                    only directory exposed by the web server
    .htaccess
    index.php
  scripts/migrate.php        CLI-only checksum-tracked migration runner
  scripts/import_places.php  CLI-only idempotent importer
  scripts/check-deployment.php read-only HTTP smoke check
  src/Http/                  routing, handlers, CORS and responses
  src/Places/                repository, DTO mapper, validator and importer
  src/                       bootstrap, configuration, PDO and migrations
  places.json                reproducible import source; not read by the API
  tests/integration.php      isolated CLI integration suite
```

## Configuration

The application reads configuration from the process environment, with a fallback
to same-named server variables in `$_SERVER` (not request headers):

| Variable | Required | Example |
|---|---:|---|
| `DB_HOST` | yes | `127.0.0.1` or the host shown by Plesk |
| `DB_PORT` | yes | `3306` |
| `DB_NAME` | yes | `laverda_api` |
| `DB_USER` | yes | `laverda_api_user` |
| `DB_PASSWORD` | yes | set a strong value outside Git |
| `APP_PASSWORD` | old unlock route only | optional compatibility for older app builds |
| `CORS_ALLOWED_ORIGIN` | no | `*` for this public read-only API, or one exact origin |

Never commit real credentials. The API does not load a repository `.env` file.
CLI imports and the current app need only the five `DB_*` variables on the API.
The current app opens the public directory without a password. Keep APP_PASSWORD
only if supporting older app builds; the compatibility endpoint is not authentication.

## Local setup

On this Windows workspace the portable PHP/MariaDB tools are already available.
For an isolated local database, generated Windows-encrypted credentials and simple
start/stop/test commands, see [the local development guide](LOCAL-DEVELOPMENT.md):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Start
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Test
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Stop
```

Run these from the repository root. The helper is development-only; no change to
the PHP API configuration or FTP deployment is required. The manual alternative
for an independently installed MariaDB follows below.

Create a database and a least-privilege application user using your local MariaDB
administration account. Adjust names and passwords as needed:

```sql
CREATE DATABASE laverda_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'laverda_api_user'@'127.0.0.1' IDENTIFIED BY 'change-this-password';
GRANT SELECT, INSERT, UPDATE ON laverda_api.* TO 'laverda_api_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Set configuration for the current PowerShell session:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_NAME = "laverda_api"
$env:DB_USER = "laverda_api_user"
$env:DB_PASSWORD = "change-this-password"
$env:CORS_ALLOWED_ORIGIN = "*"
```

From the repository root, apply the schema using your local administrative
migration account (it needs CREATE, ALTER and INDEX privileges). Then switch back
to the application/import account created above:

```powershell
$env:DB_USER = "your-migration-user"
$env:DB_PASSWORD = "your-migration-password"
php .\api\scripts\migrate.php
$env:DB_USER = "laverda_api_user"
$env:DB_PASSWORD = "change-this-password"
php .\api\scripts\import_places.php
php -S 127.0.0.1:8080 -t .\api\public .\api\public\index.php
```

The import is transactional and idempotent. It creates the `laverda` tenant if missing and
upserts every source record using `(tenant_id, id)`, so repeated runs update records without
creating duplicates. One duplicated ID in the current source is retained as a
second record with the deterministic suffix `-2`.
Existing tenant names and active/inactive settings are preserved. The importer is
authoritative for the imported place fields (including visibility), so review the
source before rerunning it after database edits. It does not delete absent records.
Keep duplicate rows in stable source order so their suffixed IDs remain stable.
An alternate JSON file can be provided as the first CLI argument:
`php api/scripts/import_places.php path/to/places.json`.
Invalid tags, booleans, numeric coordinates, or field types abort the transaction;
coordinate precision is preserved even with non-default PHP precision settings.

### Schema and existing deployments

- `tenants`: numeric ID, unique slug, display name, active flag.
- `places`: composite `(tenant_id, id)` primary key, all source fields, JSON tags,
  double-precision coordinates, and original source ordering. IDs are case-sensitive.
- Fresh and existing databases: back up first, then run `php scripts/migrate.php`.
  `schema.sql` is the baseline, not the complete current schema. The runner applies
  ordered migrations and records SHA-256 checksums in `schema_migrations`, using a
  database advisory lock to prevent concurrent migrations. Never edit an applied migration.
- Migration 002 adds `created_at`/`updated_at` to both entities and CHECK constraints
  for booleans, tags arrays, coordinate pairs/ranges, modes, types and visibility.
  These internal timestamps do not change the API DTO. Unchanged repeated imports
  do not advance row timestamps.
- MariaDB DDL auto-commits. A failure may leave a partially applied migration;
  the supplied operations are restartable. Repair invalid existing rows after
  reviewing a backup, then retry. Do not disable checks or silently discard data.
- The runtime API only needs `SELECT`. Use a separate import account with
  `SELECT, INSERT, UPDATE` when the hosting plan permits, and an administrative
  account for schema changes.

## Endpoints

```http
GET /health
GET /api/v1/tenants/laverda/places
GET /api/v1/tenants/laverda/places/{id}
```

The following compatibility endpoints remain available for older mobile builds:

```http
GET /api/places
GET /api/places/{id}
POST /auth/unlock
```

Collection endpoints return:

```json
{
  "entries": []
}
```

The collection routes continue to accept optional `type`, `country`, and `q` query
parameters. Results are ordered by their original source order and then ID. Only
active tenants and records with `visibility = "public"` are exposed.
`q` performs a literal substring search (including literal `%` and `_`). Each
filter must be a string of at most 500 bytes; malformed filters return HTTP 400.
Missing/inactive tenants and missing/nonpublic IDs return HTTP 404. Unsupported
methods return HTTP 405. The unlock route returns 401 for a wrong password, 400 for
invalid JSON/password type, and 413 for request bodies over 4 KiB.

## Hosttech/Plesk deployment

1. In Plesk, create the `api.laverdaclub.ch` subdomain.
2. Set its document root to the uploaded API's `public` directory, for example
   `api/public`. Do not expose `src`, `scripts`, `database`, or `places.json`.
3. Select PHP 8.3 or newer and confirm that `pdo_mysql` is enabled. Prefer a PHP
   handler served through Apache so the included `.htaccess` rewrite is honored.
   Plesk documents that nginx-served PHP handlers can ignore `.htaccess`.
4. Create the MariaDB database and database user in **Databases**. Hosttech's Plesk
   instructions use **Databases -> Add Database**.
5. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and
   optionally `APP_PASSWORD` for legacy clients, as per-domain server environment variables. If Plesk exposes
   additional PHP-FPM
   directives, pool entries use the form `env[DB_HOST] = localhost`. If this control
   is unavailable on the shared-hosting subscription, ask Hosttech support to set
   the variables securely. Do not add credentials to uploaded tracked files.
6. Back up existing databases. Run `scripts/migrate.php` with the selected PHP CLI
   using SSH or a temporary Plesk Scheduled Task, with an administrative migration
   account and the DB environment above. If CLI execution is unavailable,
   coordinate with Hosttech support; do not upload a web-accessible migration/import endpoint.
7. Run `scripts/import_places.php` once with Plesk SSH or a temporary Plesk Scheduled
   Task using the selected PHP CLI. Supply the same DB environment to that CLI task.
   Run it a second time if you want to verify idempotency, then remove the task.
8. Upload `.htaccess` (some FTP clients hide dotfiles) and test the endpoints.
9. Issue and enable a Let's Encrypt certificate for `api.laverdaclub.ch`, force HTTPS,
   then configure the mobile app's API base URL in its build environment.
10. Run `php scripts/check-deployment.php https://api.laverdaclub.ch` and verify a
    known detail ID too. Keep scheduled backups and rehearse restoring to a separate
    database. MariaDB storage must be persistent; FTP deployment must not replace it.

Useful references:

- [Hosttech: create a database in Plesk](https://support.hosttech.ch/knowledge-base/wie-erstelle-ich-eine-datenbank/)
- [Plesk: configure PHP for a domain](https://doc.plesk.com/en-US/obsidian/administrator-guide/website-management/websites-and-domains/hosting-settings/web-scripting-settings/php-settings.70742/)
- [Plesk: PHP handler and `.htaccess` behavior](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/websites-and-domains/hosting-settings/web-scripting-settings/choosing-the-php-handler.75145/)

## Production behavior

- PDO uses native prepared statements, exceptions, UTF-8, and non-persistent
  request-scoped connections with a five-second connection timeout. Each search
  value has its own parameter, as required by [native PDO prepares](https://www.php.net/manual/en/pdo.prepare.php).
- CORS permits only `GET`, `POST`, and `OPTIONS`; `POST` is limited to the existing
  `/auth/unlock` compatibility route.
- Database and internal exception details are written to the PHP/Plesk error log,
  never returned to clients.
- `/health` verifies access to both tables and returns HTTP 503 when the database
  or schema is unavailable. An empty but correctly initialized database is healthy.
- The mobile application connects only to the HTTPS API; MariaDB must not be exposed
  publicly for mobile access.
- Older builds' password screen is a **UI convenience gate, not authentication for the public
  data API**. `/auth/unlock` issues no token/session; the place endpoints intentionally
  remain public. CORS is not authentication. Never store confidential data in the
  app's bundled JSON. If member-only data is required later, add server-enforced
  authentication/authorization and review the offline data policy together.
- Configure request limits/rate limiting for `/auth/unlock` in Plesk/Hosttech where
  available. The application bounds input size but does not implement distributed
  login throttling.
- Public collection/detail responses include an ETag and `public, no-cache`:
  clients can revalidate, but every request still checks tenant activity and public
  visibility before any HTTP 304. Errors, health and unlock remain `no-store`.
  Offline mobile snapshots contain only data already published publicly; removing
  it from the server cannot erase copies on disconnected devices.

## Seed and mobile fallback

`api/places.json` is the sole authoritative seed source and remains unchanged.
After seed edits, run `npm run data:generate` in `../app` and commit the generated
public snapshot. Historical datasets are in `../archive/data`. Import validation
is a pure class tested separately; IDs, URLs, tags, metadata and double-precision
coordinates retain their existing wire format.

## Regression tests

From the repository root, with PHP and MariaDB on PATH:

```powershell
Get-ChildItem .\api -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
php .\api\tests\unit.php
# Create a NEW, EMPTY database using your local test administration account:
mariadb --user=root --password --execute="CREATE DATABASE laverda_test_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# Set DB_HOST, DB_PORT, DB_USER and DB_PASSWORD to the isolated local test account.
$env:DB_NAME = "laverda_test_local"
php .\api\tests\integration.php
```

The suite refuses nonempty databases and names not starting with `laverda_test_`.
Use a fresh database name on the next run. It applies the schema, imports twice,
tests rollback, starts/stops its own loopback PHP server, checks all source fields
and public endpoints, privacy, tenant isolation, filters, unlock, CORS, and schema
failure/recovery. It leaves the test database for inspection; never run against
production. PHP CLI must support `proc_open` and inherit the same PDO configuration
in child processes (e.g. via `PHPRC` when using a portable PHP installation).

`php api/tests/upgrade.php` uses another fresh `laverda_test_*` database to verify
upgrading populated baseline tables without changing existing fields. Optional
static analysis: download PHPStan from its official releases and run
`php phpstan.phar analyse -c api/phpstan.neon --memory-limit=512M`.

The current check results and release caveats are in `../IMPLEMENTATION.md`.
