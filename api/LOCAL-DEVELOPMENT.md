# Lokale API mit MariaDB unter Windows

Die lokale Umgebung verwendet denselben PHP-Code und dieselben Migrationen wie
Hosttech. Die Expo-App wird dafür nicht benötigt. Der Helfer installiert keinen
Windows-Dienst und startet keine Programme automatisch beim Anmelden.

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

Die Prozesse laufen im Hintergrund. Du kannst das aufrufende PowerShell-Fenster
nach Abschluss schliessen. Es gibt nur folgende lokale Netzwerkadressen:

| Bestandteil | Adresse | Aufgabe |
|---|---|---|
| PHP-API | http://127.0.0.1:8080 | Empfängt HTTP-Anfragen und antwortet mit JSON |
| MariaDB | 127.0.0.1:3307 | Speichert und durchsucht die Daten |

`127.0.0.1` bezeichnet deinen Computer. Beide Server lauschen ausschliesslich auf
dieser Adresse. Der Browser fragt die API an; PHP greift über PDO auf MariaDB zu.
Der PHP-Entwicklungsserver verwendet `api/public` als Dokumentenstamm und
`api/public/index.php` als Router. Apache, `.htaccess`, HTTPS und Plesk werden lokal
damit nicht getestet.

## Im Browser prüfen

- http://127.0.0.1:8080/health liefert `{"status":"Healthy"}`.
- http://127.0.0.1:8080/api/v1/tenants/laverda/places liefert `{"entries":[...]}`.
- http://127.0.0.1:8080/api/v1/tenants/laverda/places/www-laverdaclub-ch-82bbf1 liefert einen einzelnen Eintrag.
- Ein unbekannter Tenant oder eine unbekannte Platz-ID liefert HTTP 404.

`Healthy` bedeutet, dass PHP die Datenbank und beide Anwendungstabellen erreichen
kann. Die Platzliste prüft zusätzlich, ob importierte Datensätze vorhanden sind.

## Status, Stoppen und erneut Starten

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Status
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Stop
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Start
```

`Stop` beendet den eigenen PHP-Prozess und sendet MariaDB einen ordentlichen
Shutdown-Befehl, damit die Datenbank ihre Daten schreiben und schliessen kann.
Die gespeicherten Daten werden nicht gelöscht. Prozess-ID, Startzeit und
Programmpfad werden verglichen, bevor ein Prozess beendet wird. Andere PHP- oder
Datenbankprozesse werden nicht angefasst. Wiederholtes Starten und Stoppen ist
erlaubt. Belegte Ports anderer Programme führen zu einer Fehlermeldung.

## Automatische Tests

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Test
```

Der Befehl startet die Umgebung bei Bedarf und prüft PHP-Syntax, Importvalidierung,
die Leserechte des API-Benutzers, die vorhandene Integrationssuite, das Upgrade
einer bereits befüllten Datenbank sowie die laufenden HTTP-Endpunkte.

Integration und Upgrade bekommen bei jedem Aufruf eigene neue Datenbanken namens
`laverda_test_*`. Ihre Testdaten aendern `api_laverda_local` nicht. Die Testdatenbanken
bleiben für eine mögliche Untersuchung erhalten; wiederholte Testläufe belegen
daher zusätzlichen lokalen Speicher. Die Server bleiben anschliessend gestartet.

## Daten bewusst erneut importieren

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Import
```

Dies führt Migrationen und den Import erneut aus. Wiederholte Imports erzeugen
keine Duplikate, ersetzen aber die importierten Felder durch Werte aus der
JSON-Datei. Deshalb ist der Import ein eigener ausdrücklicher Befehl.

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
- `laverda_api_local`: ausschliesslich SELECT für die laufende API.

Der Helfer verwendet die vorhandenen portablen Programme unter
`.local-tools/php` und `.local-tools/mariadb/*/bin`. Sie sind nicht Teil eines
normalen Git-Checkouts. Falls diese Programme auf einem anderen Computer fehlen,
müssen passende Windows-Versionen von PHP 8.3+ mit `pdo_mysql` und MariaDB 10.11+
bereitgestellt werden. Der Helfer lädt nichts automatisch herunter.

Die Dateien `scripts/local.ps1`, `scripts/local.php` und diese Anleitung sind nur
Entwicklungshilfen. Auf Hosttech verwendest du weiterhin die CLI-Skripte
`migrate.php` und `import_places.php` sowie die dortigen privaten DB-Variablen.
