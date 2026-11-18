# Mobile Laverda-App

Expo SDK 57, React Native 0.86, React 19 und TypeScript. Die App spricht ausschliesslich mit der PHP-API über HTTPS; sie enthält keine Datenbank-Zugangsdaten.

## Funktionen

- Clubpasswort-Abfrage vor dem Verzeichnis, geschützte serverseitige Sitzungen und Abmeldung.
- Explore mit Karte/Liste, gemeinsamer Suche, Filtern, Favoriten und optionaler Entfernungssortierung.
- Club-Marker verwenden das Laverda-Logo; andere Kategorien behalten ihre eigenen Symbole. Nur tatsächliche/ungefähre Zielorte erhalten Marker; Länderzentren und Online-Ressourcen bleiben in der Liste.
- Resources für Blogs, Foren und Register; Club-Seite mit Kontakt und Eintragsvorschlägen.
- Gemeinsame Gestaltung mit warmen Flächen, klarer Typografie und gut erreichbaren Bedienelementen.

## Einrichtung

Node 24.13+ und npm verwenden. Android benötigt Android Studio/SDK und Java; iOS benötigt macOS/Xcode. Aus `app/`:

```powershell
npm ci
npm run verify
npx expo start --dev-client
npx expo run:android
# Auf macOS:
npx expo run:ios
```

Native Änderungen, insbesondere SecureStore, MailComposer, Expo-Patches und Maps-Konfiguration, benötigen einen neuen Android-/iOS-Build. Ein JavaScript-Neuladen reicht dafür nicht. Generierte native Ordner bleiben ignoriert. Bei OneDrive-/Windows-Pfadlängenfehlern eine kurze Arbeitskopie ausserhalb von OneDrive und einen kurzen Gradle-Cache verwenden; vorhandene native Anpassungen und Debug-Signatur erhalten.

## Konfiguration

Ungetrackte `.env.local` oder Build-Umgebung:

| Variable                      | Bedeutung                                                             |
| ----------------------------- | --------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`         | API-Origin, z. B. `https://api.laverdaclub.ch`, ohne angehängte Route |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Auf Android-Paket und Signatur eingeschränkter Maps-SDK-Schlüssel     |
| `EXPO_PUBLIC_CONTACT_EMAIL`   | Echte Empfängeradresse für Kontakt und Vorschläge                     |

Diese Werte sind Client-Konfiguration, keine Serverpasswörter. Clubpasswort und DB-Zugang gehören niemals in `EXPO_PUBLIC_*`, App-Code oder Git. Android-ID: `com.anonymous.laverdamap`. iOS verwendet Apple Maps. Google Maps benötigt ein eingerichtetes Cloud-Projekt, Maps SDK for Android, passende Schlüsselbeschränkungen und gegebenenfalls Abrechnung.

Ohne Kontaktadresse steht sichtbar `kontakt@example.org`. Der Mail-Entwurf hat dann absichtlich keinen Empfänger. Erst nach Eintragen einer echten Adresse und Neustart/Neu-Bundling geht er an den Club. Zugang ohne konfigurierte API ist nicht möglich.

## Anmeldung und lokale Daten

1. Die App sendet das eingegebene Clubpasswort an den Tenant-Login-Endpunkt.
2. Nach Prüfung des DB-Hashes stellt der Server ein zufälliges Token mit maximal 24 Stunden Gültigkeit aus.
3. Nur das Token wird nativ in Expo SecureStore gespeichert; auf Web bleibt es ausschliesslich im Arbeitsspeicher.
4. Bei Neustart und Rückkehr aus dem Hintergrund wird die Sitzung online geprüft; bis dahin ist das Verzeichnis verborgen. Im Vordergrund wird sie zusätzlich minütlich überprüft, ohne Formularzustände bei erfolgreicher Prüfung zurückzusetzen.
5. Ablauf, Abmeldung und HTTP 401 sperren die App. Ein Passwortwechsel widerruft serverseitig bestehende Sitzungen. Ohne Verbindung zur Sitzungsprüfung bleibt sie gesperrt.

Keine Runtime-Imports von `places.json` oder Testfixtures. Verzeichnisantworten werden nur im Arbeitsspeicher gehalten; kein persistenter Daten-Cache. Alte `laverda:places:*`-Caches werden entfernt. Favoriten enthalten nur IDs und bleiben lokal. Bereits erhaltene/kopierte Informationen lassen sich nicht nachträglich geheim machen. Das gemeinsame Passwort bietet keine individuelle Mitgliederverwaltung; für getrennte Sperrung einzelner Mitglieder wären persönliche Konten erforderlich.

HTTPS ist in produktiven Builds erforderlich. Klartext-HTTP dient nur der lokalen Entwicklung. Beim Android-USB-Test werden API und Metro mit `adb reverse tcp:8080 tcp:8080` und `adb reverse tcp:8081 tcp:8081` erreicht; die API-Origin ist dann `http://127.0.0.1:8080`. Der Entwicklungsserver bleibt ein separates Werkzeug.

## Kontakt und Eintragsvorschläge

Das Formular erfasst Absendername/-mail, Typ, Name, Beschreibung, Adresse, Land, Website, Tags, optionale Koordinaten samt Genauigkeit/Quelle, Navigationslink, Kategorie, Linktyp, Priorität und Prüfdatum. Eingaben werden vor dem Entwurf validiert; Koordinaten benötigen ein vollständiges gültiges Paar, URLs dürfen nur HTTP(S) enthalten.

MailComposer öffnet die Mail-App mit Betreff, Text und einem UTF-8-JSON-Anhang `{"entries":[...]}`. Nutzer prüfen und senden den Entwurf selbst. Android bestätigt keine Zustellung; die App meldet deshalb nur das Öffnen des Entwurfs. Bei fehlender Mail-App bleiben Vorschau und auswählbarer JSON-Text verfügbar. Der JSON-Anhang enthält keine Absenderdaten; diese stehen ausschliesslich im Mailtext. Temporäre Anhänge im App-Cache werden bei weiteren Entwürfen nach 24 Stunden bereinigt.

Vorschläge beginnen mit `visibility=hidden`, `status=pending` und `verified=false`. Die Redaktion prüft alle Inhalte, setzt den gewünschten Freigabestatus und übernimmt sie erst dann in `api/places.json`. Keine direkte Schreibberechtigung der App auf Orte oder Datenbank.

## Struktur

```text
src/app/               Provider und Navigation
src/features/auth/     Anmeldung, geschützte Sitzung und Zugangssperre
src/features/places/   DTO-Schema, Datenabruf, Karte, Liste, Details und Favoriten
src/features/club/     Clubseite, Kontakt und Vorschlagsformular
src/features/resources/ Online-Verzeichnis
src/shared/            HTTP-Client, Designsystem und sichere Links
tests/fixtures/        Nur Testdaten; kein Runtime-Import
```

## Prüfungen

```powershell
npm run verify
npm run format:check
npx expo install --check
npx expo export --platform android --platform ios
```

`npm run data:generate` erzeugt die Testfixture aus `api/places.json`; `data:check` prüft die Übereinstimmung. Für den optionalen Live-Vertragstest müssen `LAVERDA_TEST_API_URL` und ein kurzlebiges `LAVERDA_TEST_TOKEN` für eine frisch importierte Testdatenbank gesetzt sein. Geheimnisse nicht in Befehlsargumente oder Git schreiben. Komponentenprüfungen mocken native Module; echte Maps-, SecureStore- und Mail-Interaktion muss auf einem Gerät geprüft werden. Der Maestro-Smoke-Test verwendet einen vorbereiteten Testzugang und löscht den Zustand der Testinstallation.

Sicherheitsstand der npm-Abhängigkeiten am 18.11.2026: kompatible Updates für `shell-quote` und `zod` sind enthalten. `npm audit` meldet weiterhin 6 moderate und 62 hohe Meldungen im Abhängigkeitsbaum, keine kritische. Die angebotenen umfassenden Fixes enthalten inkompatible Expo-/React-Native-Downgrades; diese wurden nicht erzwungen. Vor einer Veröffentlichung erneut prüfen und mit einem unterstützten SDK-Upgrade abarbeiten. Erfolgreiche Funktionstests bedeuten keinen vollständig bereinigten Sicherheits-Audit.
