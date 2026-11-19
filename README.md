# Laverda-App und PHP-API

Ein Club-Verzeichnis mit Karte, Suche, Favoriten und redaktionell geprüften Einträgen.

```text
Test-App → mitgelieferte places.json oder HTTPS → PHP → MariaDB
```

## Bestandteile

- [App](app/README.md): Expo SDK 57 / React Native, Google Maps auf Android und Apple Maps auf iOS, Suche, Favoriten, Kontakt und Eintragsvorschläge.
- [Backend](api/README.md): PHP 8.3+, PDO/MariaDB, Tenants, Passwort-Hashes, widerrufbare Sitzungen, Migrationen und idempotenter Datenimport. Kein Node-Server, Docker oder Composer im Betrieb.
- `api/places.json`: redaktionelle Importquelle. Die laufende API liest ausschliesslich die Datenbank.
- `archive/data/`: historische Daten; kein Bestandteil der App.
- `app/src/data/places.json` enthält die beim Test-Build mitgelieferte Ortsliste.

## Zugriff und Daten

Die Play-Store-Testversion öffnet das Verzeichnis direkt mit der mitgelieferten Ortsliste. Unter **Club → Settings → Use online API** lässt sich die Datenquelle wechseln. Die App merkt sich die Auswahl auf dem Gerät.

Für den Online-Modus kann der Betreiber die separate Leseroute `/api/v1/public/laverda/places` freigeben. Sie liefert ausschliesslich Einträge mit `visibility=public`. Die regulären Orts-Endpunkte verwenden weiterhin Bearer-Sitzungen. Angaben in der mitgelieferten Ortsliste sind für alle mit Zugriff auf die Test-App lesbar.

## Beiträge und Kontakt

Auf der Club-Seite stehen Kontakt und ein Vorschlagsformular bereit. Die Mail-App öffnet einen vom Nutzer überprüfbaren Entwurf mit einem JSON-Anhang im Importformat. Kein automatischer Versand und keine automatische Veröffentlichung. Der Platzhalter `kontakt@example.org` wird angezeigt; solange keine echte Adresse konfiguriert ist, öffnet der Entwurf ohne Empfänger.

## Einrichtung

Zum lokalen Arbeiten: [App testen und Android bauen](app/LOCAL-DEVELOPMENT.md) und [API/MariaDB einrichten und testen](api/LOCAL-DEVELOPMENT.md). Beide Anleitungen erklären die Befehle und das spätere Stoppen der Dienste.

Die Testversion für Google Play lässt sich mit der mitgelieferten Liste bereits bauen. Die Schritte für den Android-Build stehen in der [EAS-Anleitung](app/EAS-SETUP.md). Für den späteren Online-Modus zuerst die PHP-API einrichten, die Migrationen und den Datenimport ausführen und danach die [Leseroute freigeben](api/README.md#online-modus-der-play-store-testversion).

Hosttech benötigt PHP/PDO MySQL, persistente MariaDB, HTTPS und für Migration/Import einen einmaligen CLI-/Aufgaben-Ausführungsweg. Die fehlende Freigabe dieses Weges wird mit dem Webmaster geklärt. Siehe [Backend-Anleitung](api/README.md).

## Prüfungen

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\app\scripts\local.ps1 Verify
```

Beim ersten Checkout zuerst denselben App-Helfer mit `Setup` statt `Verify` aufrufen. `Verify` bündelt TypeScript, Lint, Tests, Formatierung, Paketprüfung und Bundle-Export; bei Fehlern bricht es ab.

Backend-Tests, direkte lokale DB-Anmeldung (`local.ps1 Database`) und Start-/Stop-Werkzeuge stehen in [api/LOCAL-DEVELOPMENT.md](api/LOCAL-DEVELOPMENT.md). Integrations-/Upgrade-Tests dürfen nur isolierte `laverda_test_*`-Datenbanken verwenden. Native Karteninteraktion, SecureStore und Mail-Apps sind zusätzlich auf echten Geräten zu prüfen.

`REVIEW.md` und `IMPLEMENTATION.md` sind historische Berichte. Ihre Aussagen zur früher öffentlichen, passwortlosen App und zum Offline-Verzeichnis beschreiben den damaligen Stand; diese README-Dateien beschreiben die aktuelle Architektur.
