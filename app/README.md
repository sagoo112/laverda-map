# Mobile Laverda-App

Expo SDK 57, React Native 0.86, React 19 und TypeScript.

## Funktionen

- Die Play-Store-Testversion öffnet das Verzeichnis ohne Anmeldung mit mitgelieferten Daten.
- Explore mit Karte/Liste, gemeinsamer Suche, Filtern, Favoriten und optionaler Entfernungssortierung.
- Club-Marker verwenden das Laverda-Logo; andere Kategorien behalten ihre eigenen Symbole. Nur tatsächliche/ungefähre Zielorte erhalten Marker; Länderzentren und Online-Ressourcen bleiben in der Liste.
- Resources für Blogs, Foren und Register; Club-Seite mit Kontakt und Eintragsvorschlägen.
- Gemeinsame Gestaltung mit warmen Flächen, klarer Typografie und gut erreichbaren Bedienelementen.

## Einrichtung

Die Schritt-für-Schritt-Anleitung für PowerShell, Android-Handy per USB, lokale Tests, native Builds und das Stoppen aller Dienste steht in [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md).

Windows-Helfer im App-Ordner: `npm.cmd run local -- Doctor`, einmalig `Setup`, danach `Start` und bei nativen Änderungen `Android`. `Devices`, `Connect`, `Verify`, `Snapshot`, `Status`, `Stop` und `GradleStop` decken die weiteren Schritte ab. API/MariaDB separat über den API-Helfer starten/stoppen. Vorhandene Konfiguration wird erhalten; der Helfer startet keine Cloud-Builds.

Node 24.13+ und npm verwenden. Android benötigt Android Studio/SDK und Java; iOS benötigt macOS/Xcode. Unter Windows aus `app/` einmalig installieren:

```powershell
npm.cmd run local -- Setup
```

Danach `npm.cmd run local -- Start` in einem eigenen Fenster und für einen neuen Build `npm.cmd run local -- Android` in einem weiteren Fenster ausführen. Für iOS auf macOS gelten `npm ci`, `npx expo prebuild --platform ios` und `npx expo run:ios` als getrennte Schritte; der PowerShell-Helfer ist für Windows.

Native Änderungen, insbesondere SecureStore, MailComposer, Expo-Patches und Maps-Konfiguration, benötigen einen neuen Android-/iOS-Build. Ein JavaScript-Neuladen reicht dafür nicht. Generierte native Ordner bleiben ignoriert. Bei OneDrive-/Windows-Pfadlängenfehlern eine kurze Arbeitskopie ausserhalb von OneDrive und einen kurzen Gradle-Cache verwenden; vorhandene native Anpassungen und Debug-Signatur erhalten.

## Cloud-Builds mit EAS

Die Einrichtung für dein Expo-Konto, Android-Test-APKs und spätere Store-Builds
steht in [EAS-SETUP.md](EAS-SETUP.md). `eas.json` enthält die Profile
`development`, `preview` und `production`. Für den ersten eigenständig laufenden
Android-Test nach der Einrichtung `npm run build:android:preview` verwenden.

## Konfiguration

Ungetrackte `.env.local` oder Build-Umgebung:

| Variable                      | Bedeutung                                                                   |
| ----------------------------- | --------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`         | Optionale API-Origin ohne Route. Standard ist `https://api.laverdaclub.ch`. |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Auf Android-Paket und Signatur eingeschränkter Maps-SDK-Schlüssel           |
| `EXPO_PUBLIC_CONTACT_EMAIL`   | Echte Empfängeradresse für Kontakt und Vorschläge                           |

Diese Werte sind Client-Konfiguration, keine Serverpasswörter. Clubpasswort und DB-Zugang gehören niemals in `EXPO_PUBLIC_*`, App-Code oder Git. Android-ID: `com.anonymous.laverdamap`. iOS verwendet Apple Maps. Google Maps benötigt ein eingerichtetes Cloud-Projekt, Maps SDK for Android, passende Schlüsselbeschränkungen und gegebenenfalls Abrechnung.

Ohne Kontaktadresse steht sichtbar `kontakt@example.org`. Der Mail-Entwurf hat dann absichtlich keinen Empfänger. Erst nach Eintragen einer echten Adresse und Neustart/Neu-Bundling geht er an den Club.

## Datenquelle

Unter **Club → Settings → Use online API** lässt sich zwischen der lokalen `places.json` und der API umschalten. Standard ist die lokale Liste. Für den Online-Modus muss die [Leseroute auf der API freigegeben](../api/README.md#online-modus-der-play-store-testversion) sein. Bei fehlender Verbindung lässt sich jederzeit auf die lokale Liste zurückschalten.

Die mitgelieferte `src/data/places.json` entsteht aus den Einträgen mit `visibility=public` in `api/places.json`. Nach redaktionellen Änderungen `npm.cmd run data:generate` ausführen und einen neuen App-Build erstellen. Die App speichert Favoriten-IDs und die Quellenwahl auf dem Gerät. API-Antworten bleiben im Arbeitsspeicher.

HTTPS ist in produktiven Builds erforderlich. Klartext-HTTP dient nur der lokalen Entwicklung. Beim Android-USB-Test werden API und Metro mit `adb reverse tcp:8080 tcp:8080` und `adb reverse tcp:8081 tcp:8081` erreicht; die API-Origin ist dann `http://127.0.0.1:8080`. Der Entwicklungsserver bleibt ein separates Werkzeug.

## Kontakt und Eintragsvorschläge

Das Formular erfasst Absendername/-mail, Typ, Name, Beschreibung, Adresse, Land, Website, Tags, optionale Koordinaten samt Genauigkeit/Quelle, Navigationslink, Kategorie, Linktyp, Priorität und Prüfdatum. Eingaben werden vor dem Entwurf validiert; Koordinaten benötigen ein vollständiges gültiges Paar, URLs dürfen nur HTTP(S) enthalten.

MailComposer öffnet die Mail-App mit Betreff, Text und einem UTF-8-JSON-Anhang `{"entries":[...]}`. Nutzer prüfen und senden den Entwurf selbst. Android bestätigt keine Zustellung; die App meldet deshalb nur das Öffnen des Entwurfs. Bei fehlender Mail-App bleiben Vorschau und auswählbarer JSON-Text verfügbar. Der JSON-Anhang enthält keine Absenderdaten; diese stehen ausschliesslich im Mailtext. Temporäre Anhänge im App-Cache werden bei weiteren Entwürfen nach 24 Stunden bereinigt.

Vorschläge beginnen mit `visibility=hidden`, `status=pending` und `verified=false`. Die Redaktion prüft alle Inhalte, setzt den gewünschten Freigabestatus und übernimmt sie erst dann in `api/places.json`. Keine direkte Schreibberechtigung der App auf Orte oder Datenbank.

## Struktur

Das App-Icon ist in `app.json` konfiguriert: `assets/laverda-app-icon.png` (1024×1024, undurchsichtig) für das allgemeine/iOS-Icon und Web-Favicon, `assets/laverda-adaptive-icon.png` (1024×1024, transparenter Rand mit sicherem Innenabstand) für Android auf weissem Hintergrund. Es sind für das Icon aufbereitete Varianten des vorhandenen Laverda-Logos. Änderungen am Launcher-Icon benötigen einen neuen nativen Build und dessen Installation; Metro-Neuladen genügt nicht. Vor Veröffentlichung klärt der Club die Erlaubnis des tatsächlichen Rechteinhabers für App und Store-Auftritt.

```text
src/app/               Provider und Navigation
src/data/              Mitgelieferte Ortsliste
src/features/auth/     Anmeldung für Builds mit Clubpasswort
src/features/places/   DTO-Schema, Datenabruf, Karte, Liste, Details und Favoriten
src/features/club/     Clubseite, Kontakt und Vorschlagsformular
src/features/resources/ Online-Verzeichnis
src/shared/            HTTP-Client, Designsystem und sichere Links
```

## Prüfungen

```powershell
npm.cmd run local -- Verify
```

`Verify` bündelt TypeScript, Lint, Tests, Formatierung, Expo-Paketprüfung und Bundle-Export. `npm.cmd run local -- Snapshot` aktualisiert die mitgelieferte Ortsliste. Für den optionalen Live-Vertragstest der geschützten API müssen `LAVERDA_TEST_API_URL` und ein kurzlebiges `LAVERDA_TEST_TOKEN` für eine frisch importierte Testdatenbank gesetzt sein. Komponentenprüfungen verwenden Ersatzmodule für native Funktionen. Der Maestro-Smoke-Test löscht den Zustand der Testinstallation und prüft die lokale Liste.

Sicherheitsstand der npm-Abhängigkeiten am 18.11.2026: kompatible Updates für `shell-quote` und `zod` sind enthalten. `npm audit` meldet weiterhin 6 moderate und 62 hohe Meldungen im Abhängigkeitsbaum, keine kritische. Die angebotenen umfassenden Fixes enthalten inkompatible Expo-/React-Native-Downgrades; diese wurden nicht erzwungen. Vor einer Veröffentlichung erneut prüfen und mit einem unterstützten SDK-Upgrade abarbeiten. Erfolgreiche Funktionstests bedeuten keinen vollständig bereinigten Sicherheits-Audit.
