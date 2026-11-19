# Laverda PHP-/MariaDB-API

Framework-freie REST-API für PHP 8.3+, PDO MySQL und MariaDB 10.11+. Kein Node-Server, Docker, VPS oder Composer im Betrieb. Geeignet für PHP-Shared-Hosting mit HTTPS und persistentem Datenbankspeicher.

## Aufgabe und Architektur

Die mobile App fragt JSON ab. PHP prüft bei jedem Ortsaufruf eine Tenant-Sitzung und liest über vorbereitete PDO-Abfragen aus MariaDB. DTOs halten den bisherigen Aufbau `{"entries":[...]}` beziehungsweise einen einzelnen Eintrag stabil. Direkte Datenbankverbindungen aus der App sind nicht vorgesehen.

## Dateien und Hosting

```text
api/
  public/                   Einziger öffentlicher Dokumentenstamm
    index.php
    .htaccess               Routing und Weitergabe des Authorization-Headers
  src/Auth/                 Passwort- und Sitzungsprüfung
  src/Health/               Statusprüfungen und Browser-Dashboard (inkl. CSS/JS)
  src/Http/                 Routing, HTTP-Handler, CORS und Antworten
  src/Places/               DTO, Repository, Import und Validierung
  database/schema.sql       Basisschema
  database/migrations/      Geordnete, checksum-geprüfte Upgrades
  scripts/migrate.php       Migrationen, nur CLI
  scripts/import_places.php Idempotenter Import, nur CLI
  scripts/set-password.php  Passwort setzen/wechseln oder private SQL-Datei erzeugen
  config.example.php        Vorlage ohne echte Zugangsdaten
  config.local.php          Private Serverkonfiguration; von Git ausgeschlossen
  places.json               Redaktionelle Importquelle; nicht zur Laufzeit gelesen
```

Nur `public/` veröffentlichen. Quellcode, JSON, SQL, Skripte und private Konfiguration müssen ausserhalb des Dokumentenstamms bleiben. Auf Hosttech aktuell beispielhaft `api.laverdaclub.ch/laverda-api/public`; den tatsächlichen Serverpfad in Plesk bestätigen. PHP-FPM über Apache beziehungsweise gleichwertiges Routing verwenden und `pdo_mysql` aktivieren. Produktionsfehler liefern generische JSON-Antworten; technische Fehler stehen in den Serverlogs. Display-Errors bleiben aus.

## Datenbankverbindung

Auflösung pro Wert: Prozessumgebung → gleichnamige `$_SERVER`-Variable → private `api/config.local.php`. HTTP-Header sind keine Konfiguration. Explizite leere Umgebungswerte werden nicht durch Dateiinhalte ersetzt.

| Variable              | Bedeutung                                                 |
| --------------------- | --------------------------------------------------------- |
| `DB_HOST`             | Datenbankserver, z. B. `localhost`                        |
| `DB_PORT`             | Separater Port, z. B. `3306`                              |
| `DB_NAME`             | z. B. `api_laverda`                                       |
| `DB_USER`             | Datenbankbenutzer, nicht automatisch der FTP-Benutzer     |
| `DB_PASSWORD`         | Datenbankpasswort, niemals ins Repository schreiben       |
| `CORS_ALLOWED_ORIGIN` | Optional `*` oder eine genaue Web-Origin; keine Anmeldung |

Wenn Plesk keine Servervariablen zulässt, `config.example.php` serverseitig nach `config.local.php` kopieren und bearbeiten. Alle Werte sind PHP-Strings in einfachen Anführungszeichen; Apostroph als `\'`, Backslash als `\\` schreiben. Datei niemals in `public/` ablegen. Wo passend Rechte `600` setzen, sofern PHP als Dateieigentümer läuft; andernfalls dem tatsächlichen PHP-Benutzer gezielt Leserechte geben. Kein `777`. Die private Datei bei Updates erhalten und private Backups verwenden. Die API lädt keine `.env`-Datei.

`DB_PASSWORD` ist nicht das Clubpasswort. Das frühere `APP_PASSWORD` wird für die Anmeldung nicht mehr verwendet; der Clubpasswort-Hash steht ausschliesslich in MariaDB.

## Tabellen und Migrationen

- `tenants`: ID, eindeutiger Slug, Name, aktiv, internen Zeitstempel, Passwort-Hash und Auth-Version.
- `places`: Tenant + unveränderte/collision-sicher zugeteilte ID, alle bisherigen Felder, JSON-Tags, double-genaue Koordinaten und Quellreihenfolge.
- `schema_migrations`: Dateiname, SHA-256 und Ausführungszeit.
- `auth_sessions`: nur SHA-256 des zufälligen Tokens, Tenant, Auth-Version und Ablaufzeit.
- `auth_login_limits`: begrenzte Versuche pro Tenant und gehashter Verbindungs-IP; keine ungeprüften Proxy-Header.

Migration 001 erhält case-sensitive Orts-IDs, 002 ergänzt Integrität/Zeitstempel, 003 ergänzt die Authentifizierung. Angewendete SQL-Dateien nicht ändern. MariaDB-DDL ist nicht vollständig transaktional; bestehende Datenbanken zuerst sichern. `schema.sql` allein ist nicht das vollständige aktuelle Schema.

## Einrichtung und Import

Mit administrativem Migrationskonto und konfigurierter Verbindung, aus dem Repository-Stamm:

```sh
php api/scripts/migrate.php
php api/scripts/import_places.php
```

Alternatives JSON als erstes Argument des Importers möglich. Der Import validiert vorab, bewahrt IDs, Koordinaten, URLs, Tags und Statuswerte, ordnet alles `laverda` zu und läuft transaktional. Doppelte Quell-IDs erhalten stabile Suffixe; die Reihenfolge gleichnamiger Quellen nicht verändern. Wiederholen erzeugt keine Duplikate, überschreibt aber importierte Felder mit den Quellwerten. Nicht mehr vorhandene Einträge werden nicht automatisch gelöscht. Tenant-Name, Aktivierung und Passwort werden beim Import nicht zurückgesetzt.

Auf Hosttech können diese beiden CLI-Dateien über einmalige Plesk-Aufgaben vom Typ „PHP-Skript ausführen“ oder SSH gestartet werden. Kein Passwort als Aufgabe-/Befehlsargument eintragen: die private Konfiguration wird automatisch gelesen. Fehlen diese Rechte, mit Webmaster/Hosttech klären. Keine öffentlich aufrufbaren Installations-/Import-Endpunkte anlegen.

## Clubpasswort einrichten

Für die bereits gestartete lokale Windows-Umgebung genügt aus dem Projektstamm `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 SetPassword`. Der Helfer fragt verdeckt zweimal nach der Passphrase und verwendet ausschliesslich die lokale Datenbank. Er startet keine Dienste. Die folgenden CLI-/SQL-Varianten sind für separat konfigurierte Datenbankverbindungen beziehungsweise Hosttech gedacht.

Nach Migration UND Import gibt es den Tenant `laverda`, zunächst ohne Zugangspasswort. Ohne eingerichteten Hash bleibt der Zugang gesperrt; es gibt kein Standardpasswort.

Mit CLI-Zugang:

```sh
php api/scripts/set-password.php laverda
```

Das Skript liest die neue Passphrase zweimal von stdin. Mindestens 15 und maximal 72 UTF-8-Bytes, keine Nullzeichen. Keine Passwörter als Argument, im App-Code, in einer öffentlichen Datei oder im Git-Repository. Normale Terminals können stdin sichtbar anzeigen; auf diesem Windows-Arbeitsplatz ist deshalb der versteckte Eingabehelfer vorgesehen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\password-sql.ps1
```

Er startet keinen Server, fragt verdeckt nach der Passphrase und schreibt `.local-tools/club-password-private.sql`. Diese Datei enthält nur den gesalzenen Hash und SQL zum Setzen/Wechseln, keine Klartextpassphrase. Nach Einrichtung des Tenants kann sie über phpMyAdmin in `api_laverda` importiert werden. Datei privat behandeln und danach entfernen. Alternativ erzeugt `php api/scripts/set-password.php laverda --sql` SQL nach derselben zweifachen stdin-Eingabe. Beim Passwortwechsel werden bestehende Sitzungen widerrufen. Das ersetzt keine persönlichen Mitgliedskonten.

## Endpunkte

| Methode / Pfad                             | Zugriff                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `GET /health`                              | Öffentlich; Status-Dashboard im Browser, JSON für API-Clients      |
| `POST /api/v1/tenants/laverda/auth/login`  | JSON `{"password":"…"}`; gibt Token, Tenant und `expiresAt` zurück |
| `GET /api/v1/tenants/laverda/auth/session` | Bearer-Token; prüft die bestehende Sitzung                         |
| `POST /api/v1/tenants/laverda/auth/logout` | Bearer-Token; widerruft diese Sitzung                              |
| `GET /api/v1/tenants/laverda/places`       | Bearer-Token für genau diesen aktiven Tenant                       |
| `GET /api/v1/tenants/laverda/places/{id}`  | Gleicher Schutz                                                    |

Alte `/api/places`-Routen sind ebenfalls geschützt. `/auth/unlock` ist nur ein Alias für den echten Login, keine ungeschützte Freischaltung. Alte App-Builds ohne Token-Unterstützung benötigen ein Update.

Der Ortsvertrag bleibt gleich. Filter `type`, `country`, `q` bleiben erhalten, Reihenfolge bleibt deterministisch. Nur `visibility=public` wird im authentifizierten Verzeichnis angezeigt; hidden/private/null bleiben ausgeschlossen. Ohne/mit ungültiger, abgelaufener, widerrufener oder fremdem Tenant zugeordneter Sitzung: HTTP 401. Mit gültiger Sitzung unbekannte/nonpublic Orts-ID: 404. Fehlerhafte Eingaben: 400, zu grosser Login-Body: 413, falsche Methode: 405, Versuchslimit: 429.

Login auf nichtlokalen Verbindungen verlangt HTTPS. Token bestehen aus 32 zufälligen Bytes und gelten maximal 24 Stunden; der Server speichert nur deren SHA-256. Zehn Anmeldeversuche je IP/Tenant in 15 Minuten, dann begrenzte Sperre; erfolgreiche Anmeldung setzt den Zähler zurück. Passwortwechsel und Tenant-Deaktivierung sperren bestehende Sitzungen. Geschützte Antworten sind `private, no-store`; ETags umgehen die Auth-Prüfung nicht. Proxy-/Webserver müssen den Authorization-Header erhalten. Bestehende veröffentlichte Daten oder alte Client-Kopien können nicht zurückgerufen werden.

## Statusseite und Monitoring

`/health` liefert bei einer Browser-Anfrage mit `Accept: text/html` eine responsive Statusseite. `?format=html` wählt sie ausdrücklich aus. Für Skripte bleibt JSON der Standard; `Accept: application/json` oder `/health?format=json` erzwingt JSON auch im Browser. Beide Darstellungen verwenden denselben Prüfbericht und liefern bei Bereitschaft HTTP 200, bei einer fehlgeschlagenen Prüfung HTTP 503. `Vary: Accept` und `Cache-Control: no-store` verhindern die Wiederverwendung einer falschen oder veralteten Darstellung.

Die JSON-Antwort behält `status: Healthy|Unhealthy` und ergänzt `service`, `apiVersion`, `checkedAt` (UTC), `durationMs` und vier `checks`: API-Anfrage, DB-Verbindung, Orts-/Tenant-Tabellen und Anmeldungstabellen. Komponenten haben `pass`, `fail` oder `skipped`. Ohne DB-Verbindung werden nachgelagerte Prüfungen übersprungen. Es werden keine Zugangsdaten, Server-/PHP-/DB-Versionen, DB-Namen, SQL-Fehler, Tokens oder Orts-/Mitgliederzahlen ausgegeben.

Die Browser-Seite aktualisiert bei sichtbarem Tab alle 60 Sekunden; ein Schalter pausiert dies. „Jetzt prüfen“ funktioniert auch manuell. Bei nicht erreichbarem Server wird der Status ausdrücklich als unbekannt markiert, statt eine alte grüne Anzeige beizubehalten. Die Seite prüft Tabellenzugriff, kein tatsächlich gesetztes Clubpasswort, keine redaktionellen Inhalte und keine Maps-/Mail-Funktion. Uptime-Prozente oder historische Verläufe werden nicht behauptet.

Die Darstellung benötigt keine zusätzlichen Pakete, externen Schriftarten oder CDNs. CSS und JavaScript unter `src/Health/` werden mit einem CSP-Nonce eingebettet, damit dieselbe Seite unter lokalem PHP-Router und Apache/Plesk läuft. Bei FTP-Updates den **gesamten Ordner `src/Health/`** und `src/Http/HealthHandler.php` übertragen; nur `public/` bleibt der Dokumentenstamm. Dafür ist kein neuer App-Build nötig.

## Produktionsrechte

Der API-Benutzer benötigt SELECT auf `tenants` und `places` sowie SELECT/INSERT/UPDATE/DELETE auf `auth_sessions` und `auth_login_limits`. Keine Orts-Schreibrechte für die App. Beispiel, mit passendem administrativem Konto und den tatsächlichen Benutzerdaten ausführen:

```sql
GRANT SELECT ON api_laverda.tenants TO 'api_user'@'localhost';
GRANT SELECT ON api_laverda.places TO 'api_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON api_laverda.auth_sessions TO 'api_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON api_laverda.auth_login_limits TO 'api_user'@'localhost';
```

Ein bisheriger globaler SELECT-Benutzer braucht diese zusätzlichen Auth-Tabellenrechte. Importkonto: SELECT/INSERT/UPDATE auf tenants/places. Migrations-/Passwortverwaltung getrennt und administrativ durchführen. CORS ersetzt keine Anmeldung; Login zusätzlich durch Provider-seitige Rate-Limits absichern. Backups und Wiederherstellung testen; Sitzungstabellen enthalten Zugangsnachweise und gehören in private Backups.

## Vorschläge redaktionell übernehmen

1. E-Mail-Absender und Inhalt prüfen; JSON-Anhang als Daten behandeln, nicht als ausführbaren Code.
2. `entries[0]` enthält nur Ortsfelder; Absenderdaten stehen im Mailtext und gehören nicht ins öffentliche Verzeichnis.
3. Adresse, URLs, Koordinaten und Berechtigung zur Veröffentlichung prüfen. `visibility` bewusst auf `public`, `status` passend setzen; `verified=true` nur nach eigener Prüfung.
4. Neuen Eintrag an das `entries`-Array in `api/places.json` anhängen; eindeutige ID erhalten. Bei Korrekturen den vorhandenen Datensatz ersetzen, keine zweite Zeile mit derselben ID anhängen.
5. JSON sichern/prüfen, Import explizit ausführen und Ergebnis über die angemeldete API kontrollieren.

Kein Mailanhang wird automatisch importiert. Ein erneuter Import kann manuelle DB-Änderungen überschreiben: die redaktionelle Quelle deshalb mitpflegen.

## Tests und Betrieb

Die vollständige lokale Schritt-für-Schritt-Anleitung mit Start/Stop, sicherer Passworteingabe, angemeldeten HTTP-Aufrufen und den Testbefehlen steht in [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md).

Der Windows-Helfer bietet zusätzlich `Doctor`, `Check`, `Health`, `CheckAccess`, `Database`, `Restart` und `Logs`. `Database` öffnet die lokale MariaDB-Konsole mit gespeicherten Zugangsdaten; standardmässig ohne Ortsschreibrechte. `Test -StopAfterTest` stoppt die eigene lokale Umgebung nach dem Test auch bei Fehlern. `Doctor`/`Check` starten keine Datenbank; `CheckAccess` prüft das bestehende lokale Clubpasswort und widerruft seine Testsitzung. Details und Beispiele stehen in der lokalen Anleitung.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Check
```

Für den vollständigen lokalen Integrationslauf separat `local.ps1 Test -StopAfterTest` verwenden. Das startet eine lokale MariaDB und legt isolierte Testdatenbanken an. Integrationsprüfungen starten einen kurzlebigen PHP-Testserver, prüfen echte MariaDB-Abfragen, alle Seed-Felder, Authentifizierung, Sitzungswiderruf/-ablauf, Versuchslimits, Tenant-Isolation, Sichtbarkeit und Migrationen. Niemals gegen die Produktionsdatenbank ausführen. `php api/scripts/check-deployment.php https://api.laverdaclub.ch` prüft nach dem Deployment bewusst anonym: Health 200 und Ortsrouten 401. Der angemeldete Vertrag wird separat getestet.

Windows-Entwicklung: [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md). `Start` wendet Migrationen an und vergibt spezifische Auth-Tabellenrechte; vorhandene Daten werden nicht neu importiert. Das Clubpasswort wird ausdrücklich separat gesetzt. `Stop` fährt MariaDB sauber herunter. PHPStan: `php .local-tools/phpstan.phar analyse -c api/phpstan.neon --memory-limit=512M`.
