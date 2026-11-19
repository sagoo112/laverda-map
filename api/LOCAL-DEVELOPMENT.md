# Lokale API mit MariaDB unter Windows

Schritt-für-Schritt-Anleitung für PowerShell. Die API hat keinen separaten
Kompilier-/Build-Schritt: PHP führt den Quellcode aus. Der lokale Ablauf ist
**MariaDB starten → Migrationen → Datenimport → PHP-Server → Tests**.
App-Builds sind in der [App-Anleitung](../app/LOCAL-DEVELOPMENT.md) erklärt.
Diese Dokumentation startet selbst keine Dienste; Befehle ohne `PS ...>` kopieren.

Die lokale Umgebung verwendet denselben PHP-Code und dieselben Migrationen wie
Hosttech. Die Expo-App wird dafür nicht benötigt. Der Helfer installiert keinen
Windows-Dienst und startet keine Programme automatisch beim Anmelden.

## Kurzübersicht der Skriptbefehle

Alle Aufrufe aus dem Projektstamm. Schema: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 AKTION`.

| Aktion                      | Wirkung                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Doctor`                    | Prüft portable PHP-/MariaDB-Programme und PDO MySQL, ohne Server, neue Zugangsdaten oder DB-Einrichtung.                                      |
| `Check`                     | PHP-Syntax und reine Tests; benötigt PHP, aber keine laufende MariaDB und keinen Serverstart.                                                 |
| `Start`                     | Initialisiert bei Bedarf, migriert und startet die lokale API/MariaDB.                                                                        |
| `SetPassword`               | Fragt verdeckt nach einem neuen lokalen Clubpasswort; beide Dienste vorher starten.                                                           |
| `Health`                    | Prüft die bereits laufende eigene API, zeigt Komponentenstatus und testet anonymen Zugriffsschutz.                                            |
| `CheckAccess`               | Fragt verdeckt das bestehende Clubpasswort ab, prüft Anmeldung, Sitzung, Ortsliste und ersten Detailaufruf; meldet die Testsitzung danach ab. |
| `Database`                  | Öffnet die lokale MariaDB-Konsole mit den gespeicherten DB-Zugangsdaten; keine manuelle Passwortentschlüsselung.                              |
| `Database -CheckConnection` | Prüft nur Verbindung, angemeldeten DB-Benutzer und Anzahl der Orte; schliesst danach den Client.                                              |
| `Restart`                   | Stoppt und startet die eigene lokale API/MariaDB und zeigt danach den Status.                                                                 |
| `Logs`                      | Zeigt die letzten 40 API-Logzeilen; `-Log Database` wählt MariaDB, `-Follow` beobachtet neue Zeilen.                                          |
| `Test -StopAfterTest`       | Vollständiger Integrationstest mit anschliessendem sauberem Stoppen auch bei Fehlern.                                                         |
| `Import`                    | Bewusster erneuter Import; kann lokale importierte Felder auf JSON-Werte zurücksetzen.                                                        |
| `Status` / `Stop`           | Eigene Prozesse anzeigen beziehungsweise sauber beenden.                                                                                      |

Beispiel für eine Voraussetzungskontrolle:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Doctor
```

`Health` und `CheckAccess` verlangen die bereits gestartete eigene API. `CheckAccess` setzt oder ändert kein Passwort und schreibt keine Orte. Es erzeugt kurz eine Anmeldungssitzung und versucht sie auch bei Fehlern wieder zu widerrufen. Bei einem Verbindungsabbruch während der Abmeldung kann das Token bis zum regulären Ablauf bestehen bleiben. Passphrase und Token werden nie ausgegeben oder gespeichert. Die Prüfung ist fest an die lokale Origin gebunden.

`Logs -Follow` mit `Ctrl+C` beenden; damit werden die Dienste nicht gestoppt. `-StopAfterTest` stoppt ausdrücklich auch die vorher schon laufenden Dienste dieser lokalen Umgebung; Daten bleiben erhalten. Ohne Schalter behält `Test` sein bisheriges Verhalten und lässt die Umgebung laufen. Keiner der Befehle lädt Windows-/Android-Programme herunter oder greift auf Hosttech zu.

Die zusätzlichen Helferprüfungen in `app/tests/local-tools.ps1` testen auch den lokalen Anmeldecheck mit simulierten HTTP-Antworten, einschliesslich Abmeldung bei Fehlern. Der Aufruf steht in der [App-Anleitung](../app/LOCAL-DEVELOPMENT.md). Diese Simulation ersetzt den echten Datenbanktest mit `Test` beziehungsweise `CheckAccess` nicht.

## Starten

Öffne PowerShell im Projektverzeichnis und führe aus:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app"
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Start
```

`ExecutionPolicy Bypass` gilt nur fuer diesen PowerShell-Aufruf. Die dauerhaften
Windows-Einstellungen werden nicht geändert. Lies das Skript vor der Ausführung,
wenn du seine einzelnen Schritte nachvollziehen möchtest.

Beim ersten Start initialisiert der Helfer eine eigene MariaDB-Instanz, erstellt
`api_laverda_local`, wendet die Migrationen an und importiert die 43 Eintraege aus
`api/places.json`. Bei weiteren Starts bleiben Datenbank und Daten erhalten. Der
Import wird dabei nicht automatisch wiederholt, damit spätere lokale
Datenbankänderungen nicht unbemerkt überschrieben werden.

Neue Migrationen werden auch bei späteren Starts angewendet und die benötigten
Rechte der Auth-Tabellen vergeben. `schema.sql` allein ist nicht das vollständige
aktuelle Schema: Es gehören `tenants`, `places`, `schema_migrations`,
`auth_sessions` und `auth_login_limits` dazu. Die Quelle `places.json` wird bei
HTTP-Anfragen nicht gelesen.

Die Prozesse laufen im Hintergrund. Du kannst das aufrufende PowerShell-Fenster
nach Abschluss schliessen. Es gibt nur folgende lokale Netzwerkadressen:

| Bestandteil | Adresse               | Aufgabe                                       |
| ----------- | --------------------- | --------------------------------------------- |
| PHP-API     | http://127.0.0.1:8080 | Empfängt HTTP-Anfragen und antwortet mit JSON |
| MariaDB     | 127.0.0.1:3307        | Speichert und durchsucht die Daten            |

`127.0.0.1` bezeichnet deinen Computer. Beide Server lauschen ausschliesslich auf
dieser Adresse. Der Browser fragt die API an; PHP greift über PDO auf MariaDB zu.
Der PHP-Entwicklungsserver verwendet `api/public` als Dokumentenstamm und
`api/public/index.php` als Router. Apache, `.htaccess`, HTTPS und Plesk werden lokal
damit nicht getestet.

## Clubpasswort einmalig setzen oder bewusst wechseln

Aus dem Projektstamm, nachdem `local.ps1 Start` API und MariaDB gestartet hat:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 SetPassword
```

Der Helfer fragt zweimal verdeckt nach dem neuen **lokalen Clubpasswort**.
Mindestens 15, maximal 72 UTF-8-Bytes; Umlaute können mehr als ein Byte benötigen.
Die UTF-8-Übergabe an PHP ist bereits im Skript enthalten. Das Passwort nicht
als Befehlsargument übergeben, sondern nur in den Eingabeaufforderungen eingeben.

**Was passiert:** Der Helfer prüft, dass seine eigene lokale MariaDB läuft, und
ruft `scripts/set-password.php` mit den lokalen Administrations-Zugangsdaten auf.
Er verwendet fest `127.0.0.1:3307`, `api_laverda_local` und den Tenant `laverda`;
eine Hosttech-Konfiguration in `config.local.php` wird dabei nicht verwendet.
PHP speichert den gesalzenen Hash und widerruft bisherige lokale Sitzungen.
Erwartet: `Club password updated; existing sessions revoked.`

`SetPassword` startet keine Dienste und richtet keine Datenbank neu ein. Ist die
lokale Umgebung nicht initialisiert oder gestoppt, zuerst `local.ps1 Start`
ausführen. Die vorher laufenden Dienste bleiben nach dem Passwortwechsel laufen;
zum Tagesende mit `local.ps1 Stop` beenden.

Das ist kein täglicher Startschritt. Die App muss sich nach einem Wechsel neu
anmelden. Das Clubpasswort im Passwortmanager merken. DB-Passwörter werden von
diesem Befehl nicht gewechselt.

Für den späteren Hosttech-/phpMyAdmin-Weg gibt es separat `password-sql.ps1`.
Es fragt ebenfalls verdeckt und erzeugt nur private SQL für den dortigen Import;
es setzt weder das lokale noch das Produktionspasswort automatisch.

## Health und Zugriffsschutz prüfen

- http://127.0.0.1:8080/health zeigt im Browser die gestaltete Statusseite.
- http://127.0.0.1:8080/health?format=json liefert JSON mit `status: Healthy`
  sowie Prüfzeit, Dauer und den vier Komponentenprüfungen. Bei Fehlern: HTTP 503.
- Ortsrouten liefern ohne Bearer-Token **HTTP 401**, `{"error":"unauthorized"}`.
- Auch unbekannte Tenants liefern anonym 401; sie verraten keine Ortsdaten.

Den zusammengefassten Health-/Smoke-Test aus dem Projektstamm aufrufen:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Health
```

Erwartet: Health 200, Laverda-Ortsliste 401, unbekannter Tenant 401. `Healthy`
prüft Verbindung und Lesezugriff auf Orts-/Auth-Tabellen. Es beweist weder ein
gesetztes Clubpasswort noch importierte Datensätze. Zum Datenabruf anmelden.

Die Statusseite aktualisiert in sichtbaren Tabs alle 60 Sekunden und per „Jetzt
prüfen“. Die Automatik lässt sich abschalten. Nach dem Stoppen der lokalen API
wird beim nächsten Prüfen „Status nicht erreichbar“ angezeigt. Dies ist eine
Momentaufnahme ohne historische Verfügbarkeit; Zugangsdaten und interne
Serverdetails werden nicht angezeigt.

## Anmelden und echte MariaDB-Daten abrufen

Der Helfer übernimmt Anmeldung, Sitzungsprüfung, Liste, ersten Detailaufruf und
Abmeldung in einem Befehl. Das vorher eingerichtete lokale Clubpasswort verdeckt
eingeben; das Token wird nicht ausgegeben:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 CheckAccess
```

Falsches Passwort: 401. Zu viele Versuche: 429, dann abwarten. Token gelten
maximal 24 Stunden und sind Zugangsnachweise; nicht teilen oder in Dateien
kopieren. Bei Erfolg zeigt das Skript die Zahl sichtbarer Orte. Es verändert
keine Ortsdaten und setzt kein Passwort neu.

Die API liest MariaDB, nicht die JSON-Datei. Die Quelle enthält 43 Einträge; nur
`visibility=public` erscheint im angemeldeten Verzeichnis. Die sichtbare Anzahl
kann daher von der Zahl aller DB-Zeilen abweichen. Der Listenvertrag lautet
`{"entries":[...]}`, ein Detailaufruf liefert direkt ein Ortsobjekt.

Mit gültiger Laverda-Sitzung: unbekannte oder nicht öffentliche Orts-ID 404;
Zugriff auf einen anderen Tenant 401. Die Integrationssuite prüft diese Fälle.
Der Helfer widerruft die Testsitzung im abschliessenden Bereinigungsschritt.
Die Handy-App hat eine eigene Sitzung und bleibt davon unabhängig.

## Direkt an der lokalen Datenbank anmelden

Zuerst die Umgebung mit `Start` starten. Dann aus dem Projektstamm:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Database
```

Damit öffnet sich die **MariaDB-Konsole im selben Fenster**, keine HeidiSQL-Oberfläche.
Der Helfer verwendet fest `127.0.0.1:3307`, `api_laverda_local` und standardmässig
`laverda_api_local`. Die DB-Zugangsdaten entschlüsselt Windows für dein Benutzerkonto;
du musst sie weder anzeigen noch kopieren. Das ist das technische DB-Passwort,
nicht das Clubpasswort der App. Die API muss dafür nicht laufen, MariaDB schon.

Zum Ansehen beispielsweise diese SQL-Anweisung eingeben:

```sql
SELECT id, name, visibility FROM places ORDER BY sort_order, id LIMIT 10;
```

SQL mit Semikolon abschliessen. `SHOW TABLES;` zeigt Tabellen. Mit `exit;` abmelden:
Das schliesst nur den Client, nicht MariaDB oder die API.

Der Standardbenutzer hat keine Ortsschreibrechte. Zum bewussten Bearbeiten den
Importbenutzer ausdrücklich auswählen:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Database -DatabaseRole Import
```

`-DatabaseRole Admin` wählt das lokale Administrationskonto; nur für Verwaltungsaufgaben
verwenden. Der Client aktiviert `--safe-updates` als zusätzlichen Schutz vor
versehentlich breiten Updates/Deletes. Das ersetzt weder passende WHERE-Bedingungen
noch Backups. Reimport kann manuell bearbeitete Felder wieder überschreiben.

Nur die Verbindung prüfen, ohne in der Konsole zu bleiben:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Database -CheckConnection
```

Der Helfer startet keine Server und verwendet keine Hosttech-Konfiguration. Das Passwort
steht nicht in Prozessargumenten oder der Zwischenablage. Während des Clients gibt es
eine temporäre Optionsdatei unter der lokalen Zustandsablage, deren Ordner nur dein
Windows-Konto berechtigt. Beim normalen Beenden und bei behandelten Fehlern wird sie
gelöscht. Nach hartem Prozessabbruch/Rechnerausfall können private `client-*`-Ordner
zurückbleiben; diese nach Ende aller DB-Clients entfernen. Nicht hochladen oder teilen.
Die [MariaDB-Client-Dokumentation](https://mariadb.com/docs/server/clients-and-utilities/mariadb-client/mariadb-command-line-client)
erklärt Optionsdateien, SQL-Konsole und `--safe-updates`.

## Status, Stoppen und erneut Starten

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Restart
```

`Stop` beendet den eigenen PHP-Prozess und sendet MariaDB einen ordentlichen
Shutdown-Befehl, damit die Datenbank ihre Daten schreiben und schliessen kann.
Die gespeicherten Daten werden nicht gelöscht. Prozess-ID, Startzeit und
Programmpfad werden verglichen, bevor ein Prozess beendet wird. Andere PHP- oder
Datenbankprozesse werden nicht angefasst. Wiederholtes Starten und Stoppen ist
erlaubt. `Restart` bündelt Stoppen, Starten und Statusanzeige. Nur nachsehen mit
`local.ps1 Status`, nur beenden mit `local.ps1 Stop`. Belegte Ports anderer Programme
führen zu einer Fehlermeldung. Eine bereits offene DB-Konsole vorher mit `exit;` verlassen.

## Automatische Tests

Reine Tests ohne laufende API oder Datenbank, aus dem Projektstamm:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Check
```

Diese prüfen Importvalidierung, Konfigurationsauflösung, Passwortrichtlinie,
Hashes und private SQL-Erzeugung. Der Konfigurationstest startet kurzlebige
PHP-Unterprozesse, aber keinen dauerhaften Server.

Der Health-Test prüft HTML-/JSON-Auswahl und sichere Ausgabe ohne DB-Zugriff.
Die Integrationssuite prüft zusätzlich echte Tabellenzugriffe, HTML/JSON mit
200/503, fehlende Auth-/Ortstabellen, Wiederherstellung und Schutz vor der
Ausgabe interner Daten.

Vollständiger Test mit Datenbank und anschliessendem Stopp:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Test -StopAfterTest
```

`Test` startet die Umgebung und wendet gegebenenfalls neue Migrationen an. Es
prüft PHP-Syntax, reine Tests, fehlende Orts-Schreibrechte des API-Benutzers,
Import, Authentifizierung, Sitzungen, Tenant-Isolation, Antwortvertrag und das
Upgrade einer bereits befüllten Datenbank. Danach folgt der anonyme Smoke-Test.

Integration und Upgrade bekommen bei jedem Aufruf eigene neue Datenbanken namens
`laverda_test_*` auf der lokalen MariaDB-Instanz. Deren Fixture-Schreibvorgänge
ändern die Ortsdaten von `api_laverda_local` nicht. Beim ersten Start wird die
Entwicklungsdatenbank aber regulär eingerichtet; spätere Starts wenden neue
Migrationen auch dort an. Dies ist keine vollständig separate MariaDB-Instanz.
Integrationstests niemals mit Produktions-Zugangsdaten ausführen.

Testdatenbanken bleiben für Untersuchungen erhalten und belegen bei Wiederholung
zusätzlichen Speicher. `Test` allein lässt die Server gestartet. Der obige
Schalter `-StopAfterTest` stoppt sie auch bei Fehlern. Zum anschliessenden Arbeiten am Handy
stattdessen `local.ps1 Test` ohne diesen Schalter verwenden und später stoppen.

Optional, falls `.local-tools/phpstan.phar` vorhanden ist:

```powershell
& .\.local-tools\php\php.exe .\.local-tools\phpstan.phar analyse -c api/phpstan.neon --memory-limit=512M
```

## Daten bewusst erneut importieren

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Import
```

Dies führt Migrationen und den Import erneut aus. Wiederholte Imports erzeugen
keine Duplikate, ersetzen aber die importierten Felder durch Werte aus der
JSON-Datei. Manuelle DB-Änderungen können so überschrieben werden. Entfernte
JSON-Einträge werden nicht automatisch gelöscht; Clubpasswort und Aktivierung
werden nicht zurückgesetzt. Deshalb ist der Import ein eigener ausdrücklicher
Befehl. Die Server bleiben danach gestartet.

Mitgelieferte Ortsliste der Test-App nach einer Änderung der Quelle aktualisieren.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\app\scripts\local.ps1 Snapshot
```

Das erzeugt Testdaten, kein Offline-Verzeichnis der App. E-Mail-Vorschläge erst
nach redaktioneller Prüfung übernehmen und `visibility`, `status`, `verified`
bewusst setzen. Die Vorschlagsmaske beginnt mit hidden/pending/unverified.

## Daten, Zugangsdaten und Programme

Der Standardordner für Daten und Logs ist:

```text
%LOCALAPPDATA%\LaverdaDev\workspace-app\
  data\                   MariaDB-Dateien und my.ini
  settings.json           Projektpfad, Einrichtungsstatus, verschlüsselte Passwörter
  mariadb-process.json    Zugehöriger Prozess und Startzeit
  api-process.json        Zugehöriger Prozess und Startzeit
  mariadb-error.log       MariaDB-Meldungen
  api-error.log           PHP-Anfragen und Fehlermeldungen
```

Dieser Ordner liegt ausserhalb des OneDrive-Projektordners und von Git. Die drei
zufälligen Passwörter werden unter Windows mit DPAPI für das aktuelle
Windows-Benutzerkonto verschlüsselt gespeichert. Sie werden beim Start nur an
die benötigten Prozesse übergeben. Teile die Konfiguration nicht und lade sie
nicht auf den Webserver hoch. Lösche sie nicht, wenn du die Daten weiterverwenden
möchtest: Darin befinden sich die verschlüsselten Zugangsdaten zur lokalen Instanz.

Es gibt getrennte Datenbankrollen:

- `root`: Einrichtung, Migrationen, isolierte Tests und sauberer Shutdown.
- `laverda_import_local`: SELECT, INSERT und UPDATE für den Import.
- `laverda_api_local`: SELECT auf Verzeichnisdaten; gezielte Schreibrechte nur auf Sitzungs- und Versuchslimit-Tabellen.

Der Helfer verwendet die vorhandenen portablen Programme unter
`.local-tools/php` und `.local-tools/mariadb/*/bin`. Sie sind nicht Teil eines
normalen Git-Checkouts. Falls diese Programme auf einem anderen Computer fehlen,
müssen passende Windows-Versionen von PHP 8.3+ mit `pdo_mysql` und MariaDB 10.11+
bereitgestellt werden. Der Helfer lädt nichts automatisch herunter.

Die portable PHP-Konfiguration liegt in `.local-tools/php/php.ini`.
Programme und Treiber ohne Serverstart prüfen:

```powershell
& .\.local-tools\php\php.exe --version
& .\.local-tools\php\php.exe -r 'echo implode(PHP_EOL, PDO::getAvailableDrivers());'
```

Die Treiberliste muss `mysql` enthalten. Programme aus offiziellen Quellen
verwenden und Sicherheitsupdates berücksichtigen.

Logs ohne Serverstart lesen:

```powershell
Get-Content "$env:LOCALAPPDATA\LaverdaDev\workspace-app\api-error.log" -Tail 40
Get-Content "$env:LOCALAPPDATA\LaverdaDev\workspace-app\mariadb-error.log" -Tail 40
```

Mit `-Wait` weitere Zeilen live beobachten; `Ctrl+C` beendet nur die Beobachtung.

## Fehlerbehebung und zweite Arbeitskopie

| Problem                                              | Nächster Schritt                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Portable Programme fehlen                            | Verzeichnisstruktur oben bereitstellen; die Programme sind nicht im Git-Checkout.                                          |
| Port 3307 oder 8080 belegt                           | Status und belegenden Prozess prüfen; keine fremden Dienste beenden.                                                       |
| Health ist `Unhealthy` / 503                         | MariaDB, Konfiguration und Migrationen prüfen; Ursache steht im API-Log.                                                   |
| Health gut, Login 401                                | Clubpasswort noch nicht gesetzt, falsch oder Tenant inaktiv.                                                               |
| Ortsliste im Browser 401                             | Ohne Bearer-Token erwarteter Zugriffsschutz; angemeldeten Abruf verwenden.                                                 |
| Login 429                                            | Versuchslimit abwarten, nicht in einer Schleife anmelden.                                                                  |
| Nach Passwortwechsel gesperrt                        | Alte Sitzungen sind widerrufen; neu anmelden.                                                                              |
| Gespeicherte Konfiguration gehört zu anderem Projekt | Vorhandene Daten nicht löschen oder `settings.json` umschreiben; ursprünglichen Pfad oder eigene Zustandsablage verwenden. |

Für eine zweite Arbeitskopie kann der Helfer einen eigenen `-StateDirectory`
bekommen. Beispiel aus dem Stammverzeichnis dieser zweiten Kopie:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Start -StateDirectory "$env:LOCALAPPDATA\LaverdaDev\workspace-app-copy"
```

Diesen Parameter dann bei
**jedem** Start/Status/Test/Import/Stop/SetPassword verwenden. Beide Kopien nutzen dieselben Ports und können
nicht gleichzeitig laufen; zuerst die erste stoppen. Die zweite Ablage übernimmt
keine bisherigen Daten oder Passwörter.

## Abgrenzung zu Hosttech

Die Dateien `scripts/local.ps1`, `scripts/local.php` und diese Anleitung sind nur
Entwicklungshilfen. Auf Hosttech verwendest du weiterhin die CLI-Skripte
`migrate.php`, `import_places.php`, `set-password.php` und die dortigen privaten
DB-Variablen. Lokale `settings.json`, Datenbank und portable Windows-Programme
nicht hochladen. Lokales DB-Passwort und Produktions-DB-Passwort sind getrennt.

Lokal werden weder Apache-`.htaccess` noch PHP-FPM, Plesk, TLS-Zertifikat, DNS oder
die Authorization-Weitergabe auf Hosttech geprüft. Der PHP-Entwicklungsserver ist
kein Produktionsserver; siehe [PHP-Handbuch](https://www.php.net/manual/en/features.commandline.webserver.php).
