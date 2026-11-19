# App lokal testen und einen Android-Build erstellen

Diese Anleitung gilt für Windows, PowerShell und ein echtes Android-Handy per USB. Alle Befehle sind PowerShell-Befehle; weder die Codeblock-Markierung noch `PS ...>` mitkopieren. `npm.cmd` und `npx.cmd` umgehen unter Windows die mögliche Sperre ihrer `.ps1`-Starter durch die Execution Policy.

Die API hat eine [eigene lokale Anleitung](../api/LOCAL-DEVELOPMENT.md), Cloud-Builds stehen in [EAS-SETUP.md](EAS-SETUP.md). Die Befehle starten Dienste erst, wenn du sie selbst ausführst.

## Kurzer Weg mit den lokalen Skripten

Die wiederkehrenden Schritte unten sind jetzt in `app/scripts/local.ps1` gebündelt. Im App-Ordner:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm.cmd run local -- Doctor
```

| Aktion                       | Befehl im App-Ordner              | Wirkung                                                                                                          |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Voraussetzungen              | `npm.cmd run local -- Doctor`     | Prüft Node, SDK, Java und Konfigurationsstatus; keine Server/Downloads, zeigt keine Schlüssel.                   |
| Erstinstallation             | `npm.cmd run local -- Setup`      | Führt `npm ci` aus. Legt `.env.local` nur an, wenn sie fehlt; vorhandene Werte bleiben erhalten.                 |
| Geräte anzeigen              | `npm.cmd run local -- Devices`    | Zeigt die angeschlossenen Android-Geräte, ohne Ports weiterzuleiten.                                             |
| Nur USB verbinden            | `npm.cmd run local -- Connect`    | Wählt ein einziges autorisiertes Gerät und richtet Port 8080/8081 ein.                                           |
| Metro starten                | `npm.cmd run local -- Start`      | Verbindet das Handy und startet Metro interaktiv im selben Fenster.                                              |
| Android bauen/installieren   | `npm.cmd run local -- Android`    | Verwendet den Metro-Prozess dieses Helfers; führt Prebuild und `run:android --no-bundler` aus.                   |
| Automatische Prüfungen       | `npm.cmd run local -- Check`      | TypeScript, Lint, Tests, Formatierung und Expo-Paketprüfung, ohne API-/Metro-Start.                              |
| Bundles prüfen               | `npm.cmd run local -- Export`     | Erzeugt Android-/iOS-JavaScript-Bundles in `dist`, keine installierbare APK.                                     |
| Alles prüfen und exportieren | `npm.cmd run local -- Verify`     | Führt `Check` und danach `Export` aus; bei Fehlern wird abgebrochen.                                             |
| Testdaten aktualisieren      | `npm.cmd run local -- Snapshot`   | Erzeugt die Testfixture aus `api/places.json` und prüft anschliessend ihre Übereinstimmung.                      |
| Gradle beenden               | `npm.cmd run local -- GradleStop` | Führt im generierten Android-Projekt `gradlew --stop` aus. Betrifft Daemons derselben Gradle-Version.            |
| Laufzustand                  | `npm.cmd run local -- Status`     | Zeigt eigenen Metro-Prozess, Portbelegung und gespeicherte USB-Zuordnungen.                                      |
| App-Werkzeuge stoppen        | `npm.cmd run local -- Stop`       | Beendet nur den aufgezeichneten Metro-Prozess samt seinen Workern und entfernt selbst angelegte USB-Zuordnungen. |

`Setup` ist eine ausdrückliche Installation und kann Pakete herunterladen. Es verweigert den Austausch von `node_modules`, solange Port 8081 belegt ist. Die erstellte Konfigurationsvorlage hat noch keinen Maps-Schlüssel. Den echten Schlüssel privat ergänzen; das kann kein Setup-Skript für dich beantragen.

Der SDK-Pfad wird aus `-SdkPath`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` oder dem Windows-Standardpfad ermittelt. Beispiel bei mehreren Geräten oder einem anderen SDK:

```powershell
npm.cmd run local -- Start -DeviceId DEINE_GERAETE_ID -SdkPath "C:\Android\Sdk"
```

Platzhalter ersetzen. Ein ausdrücklich übergebener falscher SDK-Pfad führt zum Abbruch. Mehrere Geräte werden nicht stillschweigend auf das erste reduziert. Konkurrierende USB-Zuordnungen werden nicht ersetzt. `Start` und `Android` verwenden nur für ihre Prozesse die lokale API `http://127.0.0.1:8080` und Metro `http://127.0.0.1:8081`; `.env.local` und dauerhafte Windows-Variablen werden dabei nicht umgeschrieben.

**Normaler Tagesablauf:** API in Fenster 1 mit dem API-Helfer starten. In Fenster 2 `npm.cmd run local -- Start` und dort später `a` drücken. Nach nativen Änderungen in Fenster 3 `npm.cmd run local -- Android`. Anschliessend `npm.cmd run local -- Stop` und separat `api/scripts/local.ps1 Stop` ausführen. Ein bereits manuell gestarteter Metro-Server wird vom Helfer nicht übernommen: erst dort `Ctrl+C`, dann mit dem Helfer starten. Die folgenden Abschnitte erklären die Skripte und ihre Hintergründe im Detail. Alle `npm.cmd run local`-Aufrufe gelten aus dem App-Ordner; die beiden Ordnerwechsel unten sind einmalig pro Terminal nötig.

Laufzeitaufzeichnungen liegen unter `.local-tools/app-local/` und sind von Git ausgeschlossen. PID, Programm und Startzeit werden vor dem Stoppen geprüft; fremde oder inzwischen wiederverwendete Prozess-IDs werden nicht beendet. Manuell vorab bestehende USB-Zuordnungen bleiben erhalten. Ist adb schon beendet, startet `Stop` ihn nicht erneut; offene Zuordnungsaufzeichnungen bleiben zur späteren Bereinigung erhalten. API/MariaDB, andere adb-Sitzungen und Gradle werden durch den App-Helfer nicht gestoppt. Für Gradle gilt weiterhin Abschnitt 10.

Die Helfer selbst lassen sich aus dem Projektstamm separat prüfen:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\app\tests\local-tools.ps1
```

Diese Prüfungen verwenden temporäre Node-Prozesse und simulierte USB-/HTTP-Antworten. Sie verändern weder dein Handy noch deine Datenbank und bauen keine APK. GitHub Actions führt sie unter Windows PowerShell 5.1 und PowerShell 7 aus.

## 1. Was wird gestartet?

```text
Android-Handy → USB / adb reverse → PHP-API :8080 → MariaDB :3307
Android-Handy → USB / adb reverse → Metro :8081
```

| Bestandteil         | Zweck                                       | Fenster                                   |
| ------------------- | ------------------------------------------- | ----------------------------------------- |
| API und MariaDB     | Anmeldung, Sitzungen und Ortsdaten          | Fenster 1 steuert die Hintergrundprozesse |
| Metro               | Liefert JavaScript an den Development Build | Fenster 2 bleibt offen                    |
| Android-Build / adb | Baut, installiert und verbindet die App     | Fenster 3 für Befehle                     |

Ein **Development Build** ist die installierte Android-App mit unseren nativen Modulen. **Metro** liefert dazu den veränderbaren JavaScript-Code. Der Development Build ersetzt weder Metro noch die API. Für diesen Ablauf die eigene App verwenden, nicht Expo Go.

## 2. Einmalige Voraussetzungen

- Node.js 24.13+ und npm.
- Android Studio mit Android SDK, Platform-Tools und passendem JDK. Unter **Settings → Languages & Frameworks → Android SDK** die **Android SDK Location** nachsehen.
- Portable PHP-/MariaDB-Programme und ein eingerichtetes Clubpasswort: siehe [API-Anleitung](../api/LOCAL-DEVELOPMENT.md).
- Am Handy Entwickleroptionen und USB-Debugging aktivieren, Daten-USB-Kabel anschliessen und die RSA-Zugriffsanfrage dieses PCs erlauben.

Im App-Ordner prüfen:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm.cmd run local -- Doctor
```

`JAVA_HOME` muss auf das passende JDK zeigen. Falls Java nicht gefunden wird, in Android Studio das verwendete Gradle-JDK nachsehen und dessen Installationsordner verwenden. Nicht beliebig eine andere Java-Version installieren.

Beim ersten Checkout oder nach Änderungen von `package-lock.json`:

```powershell
npm.cmd run local -- Setup
```

**Warum:** Installiert die festgelegten Paketversionen reproduzierbar und ersetzt dabei `node_modules`. Metro vorher beenden. Dieser Schritt ist nicht bei jedem Start erforderlich.

## 3. Lokale App-Konfiguration

Die vorhandene `app/.env.local` im Editor öffnen. Nötige Werte bearbeiten; die Datei nicht pauschal ersetzen:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8080
GOOGLE_MAPS_ANDROID_API_KEY=DEIN_BESTEHENDER_ANDROID_MAPS_SCHLUESSEL
EXPO_PUBLIC_CONTACT_EMAIL=kontakt@example.org
```

Beim Maps-Wert den bereits eingerichteten echten Schlüssel behalten. In Google Cloud muss er für **Maps SDK for Android**, `com.anonymous.laverdamap` und den SHA-1 der verwendeten Signatur freigegeben sein. `kontakt@example.org` ist vorerst ein sichtbarer Platzhalter; Mailentwürfe öffnen ohne Empfänger.

Auf dem Handy bedeutet `127.0.0.1` das Handy selbst. Erst die USB-Weiterleitung aus Abschnitt 5 verbindet dessen Port 8080 mit dem PC. Die API-Adresse ohne `/health` oder `/api/v1/...` eintragen.

DB-Passwörter und Clubpasswort gehören niemals in App-Konfiguration oder `EXPO_PUBLIC_*`: Client-Werte sind aus einem Build lesbar. Die API prüft die Passphrase und gibt der App nur ein Sitzungstoken.

Eine geänderte API-Adresse erfordert einen Metro-Neustart. Änderungen an Maps-Schlüssel, Icon, nativen Plugins oder Paketen brauchen zusätzlich einen neuen nativen Build. Falls in deinem Terminal `EXPO_NO_DOTENV=1` gesetzt ist, wird `.env.local` nicht geladen; diese bewusst gesetzte Testoption vor normaler Entwicklung entfernen.

## 4. Fenster 1: API und Datenbank starten

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Start
```

Der Startbefehl wartet selbst auf `Healthy`. Den Komponentenstatus zusätzlich anzeigen mit `api/scripts/local.ps1 Health`. Ohne eingerichtetes Clubpasswort kann Health trotzdem gesund sein, während die Anmeldung gesperrt bleibt. Passwort einmalig gemäss [API-Anleitung](../api/LOCAL-DEVELOPMENT.md) setzen; der Tagesstart setzt es nicht neu.

## 5. Fenster 2: USB-Verbindung und Metro

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm.cmd run local -- Devices
```

Der Helfer ermittelt den SDK-Pfad automatisch; bei abweichender Installation `-SdkPath` ergänzen. Die Handy-Zeile muss `device` anzeigen. Bei `unauthorized` das Handy entsperren und die Anfrage bestätigen; bei fehlender Zeile Kabel, USB-Modus und Treiber prüfen.

USB-Ports verbinden und Metro starten:

```powershell
npm.cmd run local -- Start
```

**Warum zwei Weiterleitungen:** 8080 liefert Daten und Anmeldung, 8081 den App-Code. Der Helfer setzt beide `adb reverse`-Zuordnungen und wählt ein einziges autorisiertes Gerät. Bei mehreren Geräten `-DeviceId` mit der Seriennummer aus `Devices` ergänzen. Nach erneutem Anschliessen `Connect` ausführen; wenn Metro gestoppt ist, genügt erneut `Start`. Für diesen Ablauf ist kein gemeinsames WLAN nötig.

Das Metro-Fenster offen lassen. Ist der aktuelle Development Build bereits installiert und gab es keine nativen Änderungen, hier `a` drücken und dein Handy auswählen. Bei der Serverauswahl des Developer-Clients den Metro-Server `http://127.0.0.1:8081` öffnen beziehungsweise auswählen.

## 6. Fenster 3: neuen Android-Build erstellen und installieren

Nach Änderungen an Icon, SecureStore, MailComposer oder Maps:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm.cmd run local -- Android
```

Metro muss zuvor mit `Start` laufen. Bei mehreren Geräten `-DeviceId` und gegebenenfalls `-SdkPath` ergänzen. Der Helfer setzt SDK/JDK-Werte nur für seine Kindprozesse und bricht bei einem fehlgeschlagenen Prebuild vor dem Installieren ab.

Der Befehl schreibt die Expo- und Gradle-Ausgabe ins Terminal und in `.local-tools/app-local/android-build.log` im Projektstamm. Ein neuer Build ersetzt das vorherige Protokoll. Bei `BUILD FAILED` steht die konkrete Ursache in der Regel weiter oben unter `What went wrong`, mit dem fehlgeschlagenen Task und dem betroffenen Dateipfad.

`-DeviceId` bleibt die Seriennummer aus `Devices`. Der Helfer ermittelt dazu den Gerätenamen aus der installierten Expo-CLI: `adb -s` verwendet die Seriennummer, Expo `run:android --device` dagegen den Namen, beispielsweise `Pixel_8_Pro`. Vor und nach dem Prebuild wird dasselbe Gerät geprüft. Bei identischen Expo-Namen die anderen passenden Geräte/Emulatoren trennen, damit kein falsches Ziel ausgewählt wird.

**Prebuild** überträgt `app.json`, `app.config.js` und Plugins in die generierten Android-Dateien. So werden auch neue Icon-/Maps-Einstellungen übernommen. Generierte native Ordner sind von Git ausgeschlossen. Manuelle Änderungen darin vorher sichern; wichtige Anpassungen gehören langfristig in Konfiguration oder Plugins. `--clean` ist für den normalen Ablauf nicht nötig und kann lokale native Anpassungen oder Signierungsdateien entfernen.

**`--no-bundler`** verhindert einen zweiten Metro-Start. Hier **kein `--port` ergänzen**: Diese beiden Optionen sind gegenseitig ausgeschlossen. Der Port steht nur im Metro-Befehl.

Nach einem erfolgreichen lokalen Debug-Build liegt die APK normalerweise hier:

```text
app/android/app/build/outputs/apk/debug/app-debug.apk
```

Ein neues Launcher-Icon erscheint erst mit der neu installierten APK; JavaScript-Neuladen genügt nicht.

## 7. Auf dem Handy testen

1. App öffnen: vor der Anmeldung muss das Verzeichnis verborgen sein.
2. Ein falsches Clubpasswort testen: keine Freischaltung. Nicht ständig wiederholen; die API begrenzt Anmeldeversuche.
3. Mit dem lokalen Clubpasswort anmelden, Liste und Suche prüfen.
4. Karte zoomen/verschieben und Marker öffnen; Club-Marker zeigen das Laverda-Logo.
5. Favorit setzen, App erneut öffnen und nach Sitzungsprüfung kontrollieren.
6. Vorschlagsformular ausfüllen, Mailentwurf öffnen und zur App zurückkehren. Formularzustand prüfen; nichts wird automatisch versendet oder veröffentlicht.
7. Abmelden: Verzeichnis muss wieder gesperrt sein.

**Lokale Datenquelle prüfen:** Die API-Anleitung enthält einen angemeldeten Abruf direkt aus MariaDB. `.env.local` muss auf die lokale Origin zeigen. Die App enthält keine eingebauten Offline-Ortsdaten mehr; bereits geladene Daten können während einer Sitzung aber im Arbeitsspeicher liegen. Eine sichtbare Liste allein beweist deshalb keinen neuen Abruf. App aktualisieren beziehungsweise erneut öffnen und parallel in einem zusätzlichen Fenster das Log beobachten:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ..\api\scripts\local.ps1 Logs -Follow
```

Zugriffe auf `/auth/session` und `/places` müssen zum Test passen. `Ctrl+C` beendet nur das Beobachten dieses Logs.

## 8. Automatische App-Prüfungen ohne laufende Server

Aus `app/`:

```powershell
npm.cmd run local -- Verify
```

| Befehl                         | Prüft / erzeugt                                                              |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `npm.cmd run verify`           | TypeScript, ESLint, Testdaten-Abgleich, reine Tests und Komponentenprüfungen |
| `npm.cmd run format:check`     | Formatierung, ohne Dateien umzuschreiben                                     |
| `npx.cmd expo install --check` | Paketversionen passend zum Expo SDK                                          |
| `npx.cmd expo export ...`      | JavaScript-/Asset-Bundles in `app/dist`, keine installierbare APK/IPA        |

`Verify` führt alle vier Prüfungen in dieser Reihenfolge aus und stoppt bei Fehlern. Für die Prüfungen ohne Bundle-Export reicht `Check`. Es startet weder Metro noch API/MariaDB. Native Module werden in Komponententests gemockt. Maps, SecureStore und Mail-App müssen zusätzlich am Gerät geprüft werden. Der optionale Live-API-Vertragstest wird ohne `LAVERDA_TEST_API_URL` und `LAVERDA_TEST_TOKEN` übersprungen; er braucht eine Testdatenbank mit unverändertem Seed und ein gültiges Token, keine Produktion.

## 9. Eigenständige Test-APK / iOS

Für eine Test-APK ohne Metro gibt es das EAS-Preview-Profil:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm.cmd run build:android:preview
```

Dieser Befehl lädt Quellcode zu Expo hoch und startet einen Cloud-Build. Zuerst [EAS-SETUP.md](EAS-SETUP.md) einrichten. Das Profil nutzt die Expo-Umgebung `preview`, nicht automatisch `.env.local`. Es benötigt eine erreichbare HTTPS-API; die lokale HTTP-API per USB ist für den Development Build gedacht. Preview-/Produktionsbuilds erzwingen HTTPS.

Windows erstellt keinen lokalen iOS-Build. Auf einem eingerichteten Mac: `npx expo prebuild --platform ios` und `npx expo run:ios`. Xcode und passende Signierung sind nötig. Cloud-Builds für iPhone sind über EAS möglich; für Geräteverteilung die Apple-Einrichtung aus der EAS-Anleitung beachten.

## 10. Alles stoppen

1. Aus dem App-Ordner in einem weiteren Terminal den eigenen Metro-Prozess und die vom Helfer angelegten USB-Zuordnungen beenden:

```powershell
npm.cmd run local -- Stop
```

Alternativ beendet `Ctrl+C` im Metro-Fenster Metro; danach entfernt `Stop` noch die USB-Zuordnungen. Ist das Handy bereits getrennt, werden nicht entfernbare Zuordnungen zur späteren Bereinigung aufgezeichnet. Manuell angelegte Zuordnungen übernimmt der Helfer nicht.

2. API/MariaDB ebenfalls aus dem App-Ordner stoppen:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ..\api\scripts\local.ps1 Stop
```

3. Nach einem lokalen Build bei Bedarf auch dessen Gradle-Daemons stoppen:

```powershell
npm.cmd run local -- GradleStop
```

Das betrifft Daemons derselben Gradle-Version und kann damit andere Android-Arbeitskopien betreffen; deshalb ist es ein eigener ausdrücklicher Befehl. Den gemeinsamen adb-Server und andere Geräte lässt der Helfer weiterlaufen. Einen geöffneten Emulator separat in Android Studio schliessen. Datenbank und Favoriten werden beim Stoppen nicht gelöscht.

## 11. Häufige Fehler

| Meldung / Verhalten                                              | Nächster Schritt                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Could not find device with name: <Seriennummer>`                | Den aktuellen Helfer verwenden: Er ordnet die Seriennummer dem Expo-Gerätenamen zu. Für manuelle Expo-Aufrufe `--device` ohne Wert zur Auswahl verwenden, statt eine ADB-Seriennummer zu übergeben.                                          |
| `--port and --no-bundler are mutually exclusive`                 | `--port` beim `run:android` weglassen; nur Metro bekommt `--port 8081`.                                                                                                                                                                      |
| `NoRouteToHost`, `unexpected end of stream`, leere Serverauswahl | API-Health und fertigen Metro-Start prüfen. Richtige Seriennummer und beide USB-Weiterleitungen kontrollieren, dann erneut `a` bei Metro. Keine alte WLAN-IP verwenden.                                                                      |
| Health gut, Anmeldung scheitert                                  | API-Adresse und gesetztes Clubpasswort prüfen. Health ist keine erfolgreiche Anmeldung.                                                                                                                                                      |
| Karte leer                                                       | Maps SDK, Abrechnung, Paketname, SHA-1 und Schlüsselbeschränkungen prüfen. Neuer Schlüssel braucht neuen nativen Build.                                                                                                                      |
| `Cannot find native module`                                      | Nach nativen Paketänderungen neu bauen/installieren; eine alte APK oder Expo Go reichen nicht.                                                                                                                                               |
| Icon bleibt alt                                                  | Prebuild und neue APK installieren. Launcher können Icons zwischenspeichern.                                                                                                                                                                 |
| OneDrive meldet vorhandene Dateien als fehlend; Pfade zu lang    | Vollständige Arbeitskopie mit kurzem Pfad ausserhalb OneDrive verwenden und Abhängigkeiten frisch installieren. Nötige App-Konfiguration privat übernehmen; für die API einen eigenen lokalen Zustandsordner gemäss API-Anleitung verwenden. |
| Signatur passt nicht zur installierten App                       | Lokale Debug- und EAS-Signatur vergleichen. Nicht vorschnell deinstallieren: dabei gehen Favoriten und Anmeldung verloren.                                                                                                                   |

Weitere Quellen: [Expo CLI](https://docs.expo.dev/more/expo-cli/), [native Projektgenerierung](https://docs.expo.dev/workflow/continuous-native-generation/), [Android Debug Bridge](https://developer.android.com/tools/adb).

### Gradle meldet `Cannot snapshot … not a regular file`

Gradle konnte die genannte Datei nicht als reguläre Datei lesen. Beim Pixel-Build hier betraf das zuerst `libfbjni.so` im Gradle-Cache und danach `libc++_shared.so`, die bereits im Android NDK als Windows-Sonderdatei vorlag. Welche Reparatur passt, hängt vom Pfad in der Fehlermeldung ab:

- **Unter `.gradle\caches\…\transforms`**: Beende zuerst aktive Builds und dann die Gradle-Daemons mit `npm.cmd run local -- GradleStop`. Benenne nur den betroffenen Transform-Ordner um. Gradle erzeugt ihn beim nächsten Build neu. [Gradle-Verzeichnisse](https://docs.gradle.org/current/userguide/directory_layout.html)
- **Bei `libc++_shared.so` unter `node_modules` oder im Android-SDK**: Prüfe die im Build verwendete NDK-Version. Ist die Quelldatei im SDK betroffen, installiere diese NDK-Version über **Android Studio → SDK Manager → SDK Tools → NDK (Side by side)** neu. Wenn die generierten Dateien unter `node_modules` weiterhin betroffen sind, stoppe Metro mit `npm.cmd run local -- Stop` und führe `npm.cmd run local -- Setup` aus. Starte danach Metro und wiederhole `Android`. Liegt der Arbeitsordner in OneDrive und tritt der Fehler erneut auf, verwende eine Arbeitskopie unter einem kurzen lokalen Pfad ausserhalb von OneDrive. [Android NDK installieren](https://developer.android.com/studio/projects/install-ndk)
