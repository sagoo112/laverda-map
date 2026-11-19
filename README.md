# Laverda-App und PHP-API

Ein Club-Verzeichnis mit Karte, Suche, Favoriten und redaktionell geprüften Einträgen.

```text
Android / iOS App → HTTPS + Bearer-Sitzung → PHP → PDO → MariaDB
```

## Bestandteile

- [App](app/README.md): Expo SDK 57 / React Native, Passwortanmeldung, Google Maps auf Android und Apple Maps auf iOS, Suche, Favoriten, Kontakt und Eintragsvorschläge.
- [Backend](api/README.md): PHP 8.3+, PDO/MariaDB, Tenants, Passwort-Hashes, widerrufbare Sitzungen, Migrationen und idempotenter Datenimport. Kein Node-Server, Docker oder Composer im Betrieb.
- `api/places.json`: redaktionelle Importquelle. Die laufende API liest ausschliesslich die Datenbank.
- `archive/data/`: historische Daten; kein Bestandteil der App.
- `app/tests/fixtures/`: erzeugte Testdaten, nicht im Laufzeit-Verzeichnis und nicht im App-Bundle eingebunden.

## Zugriff und Daten

Ein gemeinsames Clubpasswort pro Tenant wird auf dem Server geprüft. In MariaDB steht ein gesalzener Passwort-Hash; das Passwort wird weder im App-Code hinterlegt noch auf dem Gerät gespeichert. Die App erhält ein zufälliges Token; in der Datenbank wird nur dessen Hash gespeichert. Sitzungen gelten maximal 24 Stunden und werden bei Passwortwechsel ungültig.

Auch direkte Aufrufe der Orts-Endpunkte benötigen die passende Sitzung. `visibility=public` bedeutet freigegeben für das Club-Verzeichnis, nicht anonym über die API abrufbar. Hidden/private/null bleiben ausgeschlossen. `/health` ist ohne Anmeldung erreichbar.

Die App enthält keine mitgelieferten Ortsdaten und speichert keine Verzeichnisantworten mehr in AsyncStorage. Daten bleiben während der Sitzung im Arbeitsspeicher; nur Favoriten-IDs werden dauerhaft gespeichert. Ältere Daten-Caches werden beim Start entfernt. Für Anmeldung, Sitzungsprüfung und Datenabruf wird eine Verbindung benötigt. Bereits veröffentlichte Daten, alte App-Versionen, Repository-Historie oder zuvor kopierte Daten können durch einen nachträglichen Passwortschutz nicht zurückgerufen werden.

## Beiträge und Kontakt

Auf der Club-Seite stehen Kontakt und ein Vorschlagsformular bereit. Die Mail-App öffnet einen vom Nutzer überprüfbaren Entwurf mit einem JSON-Anhang im Importformat. Kein automatischer Versand und keine automatische Veröffentlichung. Der Platzhalter `kontakt@example.org` wird angezeigt; solange keine echte Adresse konfiguriert ist, öffnet der Entwurf ohne Empfänger.

## Einrichtung

Zum lokalen Arbeiten: [App testen und Android bauen](app/LOCAL-DEVELOPMENT.md) und [API/MariaDB einrichten und testen](api/LOCAL-DEVELOPMENT.md). Beide Anleitungen erklären die Befehle und das spätere Stoppen der Dienste.

1. Backend hochladen; nur `api/public` als Dokumentenstamm veröffentlichen.
2. DB-Verbindung über Servervariablen oder private `config.local.php` einrichten.
3. Migrationen ausführen und `places.json` importieren.
4. Clubpasswort setzen; erst danach ist eine Anmeldung möglich.
5. API-Adresse, Maps-Schlüssel und echte Kontaktadresse für die App konfigurieren.
6. Neuen nativen Development-/Release-Build erstellen. Alte Builds kennen die neue Anmeldung nicht.

Hosttech benötigt PHP/PDO MySQL, persistente MariaDB, HTTPS und für Migration/Import einen einmaligen CLI-/Aufgaben-Ausführungsweg. Die fehlende Freigabe dieses Weges wird mit dem Webmaster geklärt. Siehe [Backend-Anleitung](api/README.md).

## Prüfungen

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\app\scripts\local.ps1 Verify
```

Beim ersten Checkout zuerst denselben App-Helfer mit `Setup` statt `Verify` aufrufen. `Verify` bündelt TypeScript, Lint, Tests, Formatierung, Paketprüfung und Bundle-Export; bei Fehlern bricht es ab.

Backend-Tests, direkte lokale DB-Anmeldung (`local.ps1 Database`) und Start-/Stop-Werkzeuge stehen in [api/LOCAL-DEVELOPMENT.md](api/LOCAL-DEVELOPMENT.md). Integrations-/Upgrade-Tests dürfen nur isolierte `laverda_test_*`-Datenbanken verwenden. Native Karteninteraktion, SecureStore und Mail-Apps sind zusätzlich auf echten Geräten zu prüfen.

`REVIEW.md` und `IMPLEMENTATION.md` sind historische Berichte. Ihre Aussagen zur früher öffentlichen, passwortlosen App und zum Offline-Verzeichnis beschreiben den damaligen Stand; diese README-Dateien beschreiben die aktuelle Architektur.
