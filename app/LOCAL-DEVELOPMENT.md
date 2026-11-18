# App lokal testen und einen Android-Build erstellen

Diese Anleitung gilt für Windows, PowerShell und ein echtes Android-Handy per USB. Alle Befehle sind PowerShell-Befehle; weder die Codeblock-Markierung noch `PS ...>` mitkopieren. `npm.cmd` und `npx.cmd` umgehen unter Windows die mögliche Sperre ihrer `.ps1`-Starter durch die Execution Policy.

Die API hat eine [eigene lokale Anleitung](../api/LOCAL-DEVELOPMENT.md), Cloud-Builds stehen in [EAS-SETUP.md](EAS-SETUP.md). Die Befehle starten Dienste erst, wenn du sie selbst ausführst.

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
node.exe --version
npm.cmd --version
java.exe -version
```

`JAVA_HOME` muss auf das passende JDK zeigen. Falls Java nicht gefunden wird, in Android Studio das verwendete Gradle-JDK nachsehen und dessen Installationsordner verwenden. Nicht beliebig eine andere Java-Version installieren.

Beim ersten Checkout oder nach Änderungen von `package-lock.json`:

```powershell
npm.cmd ci
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
Invoke-RestMethod http://127.0.0.1:8080/health
```

Erwartet: `status` ist `Healthy`. Ohne eingerichtetes Clubpasswort kann Health trotzdem gesund sein, während die Anmeldung gesperrt bleibt. Passwort einmalig gemäss [API-Anleitung](../api/LOCAL-DEVELOPMENT.md) setzen; der Tagesstart setzt es nicht neu.

## 5. Fenster 2: USB-Verbindung und Metro

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
$env:ANDROID_HOME = "C:\Users\sagoo\AppData\Local\Android\Sdk"
$adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
if (!(Test-Path -LiteralPath $adb)) { throw 'SDK-Pfad anhand der Android SDK Location korrigieren.' }
& $adb devices -l
```

Bei abweichender Installation den SDK-Pfad anpassen. Die Handy-Zeile muss `device` anzeigen. Bei `unauthorized` das Handy entsperren und die Anfrage bestätigen; bei fehlender Zeile Kabel, USB-Modus und Treiber prüfen.

Die Seriennummer aus der ersten Spalte der Handy-Zeile eingeben:

```powershell
$deviceId = Read-Host 'Seriennummer des Android-Handys aus adb devices'
& $adb -s $deviceId reverse tcp:8080 tcp:8080
& $adb -s $deviceId reverse tcp:8081 tcp:8081
& $adb -s $deviceId reverse --list
npx.cmd expo start --dev-client --localhost --port 8081
```

**Warum zwei Weiterleitungen:** 8080 liefert Daten und Anmeldung, 8081 den App-Code. `-s` wählt genau dein Gerät aus, auch bei zusätzlich laufendem Emulator. Nach erneutem Anschliessen oder Neustart wieder einrichten. Für diesen Ablauf ist kein gemeinsames WLAN nötig.

Das Metro-Fenster offen lassen. Ist der aktuelle Development Build bereits installiert und gab es keine nativen Änderungen, hier `a` drücken und dein Handy auswählen. Bei der Serverauswahl des Developer-Clients den Metro-Server `http://127.0.0.1:8081` öffnen beziehungsweise auswählen.

## 6. Fenster 3: neuen Android-Build erstellen und installieren

Nach Änderungen an Icon, SecureStore, MailComposer oder Maps:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
$env:ANDROID_HOME = "C:\Users\sagoo\AppData\Local\Android\Sdk"
npx.cmd expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Prebuild fehlgeschlagen; zuerst die Fehlermeldung beheben.' }
npx.cmd expo run:android --device --no-bundler
```

Bei abweichendem SDK-Pfad auch hier korrigieren; Variablen gelten nur für das jeweilige Fenster. Das richtige Handy in der Geräteauswahl bestätigen.

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
Get-Content "$env:LOCALAPPDATA\LaverdaDev\workspace-app\api-error.log" -Tail 20 -Wait
```

Zugriffe auf `/auth/session` und `/places` müssen zum Test passen. `Ctrl+C` beendet nur das Beobachten dieses Logs.

## 8. Automatische App-Prüfungen ohne laufende Server

Aus `app/`:

```powershell
npm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw 'App-Pruefungen fehlgeschlagen.' }
npm.cmd run format:check
npx.cmd expo install --check
npx.cmd expo export --platform android --platform ios
```

| Befehl                         | Prüft / erzeugt                                                              |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `npm.cmd run verify`           | TypeScript, ESLint, Testdaten-Abgleich, reine Tests und Komponentenprüfungen |
| `npm.cmd run format:check`     | Formatierung, ohne Dateien umzuschreiben                                     |
| `npx.cmd expo install --check` | Paketversionen passend zum Expo SDK                                          |
| `npx.cmd expo export ...`      | JavaScript-/Asset-Bundles in `app/dist`, keine installierbare APK/IPA        |

Native Module werden in Komponententests gemockt. Maps, SecureStore und Mail-App müssen zusätzlich am Gerät geprüft werden. Der optionale Live-API-Vertragstest wird ohne `LAVERDA_TEST_API_URL` und `LAVERDA_TEST_TOKEN` übersprungen; er braucht eine Testdatenbank mit unverändertem Seed und ein gültiges Token, keine Produktion.

## 9. Eigenständige Test-APK / iOS

Für eine Test-APK ohne Metro gibt es das EAS-Preview-Profil:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm.cmd run build:android:preview
```

Dieser Befehl lädt Quellcode zu Expo hoch und startet einen Cloud-Build. Zuerst [EAS-SETUP.md](EAS-SETUP.md) einrichten. Das Profil nutzt die Expo-Umgebung `preview`, nicht automatisch `.env.local`. Es benötigt eine erreichbare HTTPS-API; die lokale HTTP-API per USB ist für den Development Build gedacht. Preview-/Produktionsbuilds erzwingen HTTPS.

Windows erstellt keinen lokalen iOS-Build. Auf einem eingerichteten Mac: `npx expo prebuild --platform ios` und `npx expo run:ios`. Xcode und passende Signierung sind nötig. Cloud-Builds für iPhone sind über EAS möglich; für Geräteverteilung die Apple-Einrichtung aus der EAS-Anleitung beachten.

## 10. Alles stoppen

1. Im Metro-Fenster `Ctrl+C` drücken, eventuelle Nachfrage bestätigen.
2. Im adb-Fenster die USB-Zuordnungen entfernen:

```powershell
& $adb -s $deviceId reverse --remove tcp:8080
& $adb -s $deviceId reverse --remove tcp:8081
```

Ist das Handy bereits getrennt, können die Zuordnungen nicht mehr entfernt werden; beim nächsten Verbinden ohnehin erneut setzen.

3. API/MariaDB aus dem Projektstamm stoppen:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\api\scripts\local.ps1 Status
```

4. Nach einem lokalen Build bei Bedarf auch dessen Gradle-Daemons stoppen:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app\android"
.\gradlew.bat --stop
```

Das betrifft Daemons derselben Gradle-Version. Falls du keine weitere Android-Sitzung brauchst: im adb-Fenster `& $adb kill-server`. Das beendet den gemeinsamen adb-Server für alle Geräte dieses PCs. Einen geöffneten Emulator separat in Android Studio schliessen. Datenbank und Favoriten werden beim Stoppen nicht gelöscht.

## 11. Häufige Fehler

| Meldung / Verhalten                                              | Nächster Schritt                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--port and --no-bundler are mutually exclusive`                 | `--port` beim `run:android` weglassen; nur Metro bekommt `--port 8081`.                                                                                                                                                                      |
| `NoRouteToHost`, `unexpected end of stream`, leere Serverauswahl | API-Health und fertigen Metro-Start prüfen. Richtige Seriennummer und beide USB-Weiterleitungen kontrollieren, dann erneut `a` bei Metro. Keine alte WLAN-IP verwenden.                                                                      |
| Health gut, Anmeldung scheitert                                  | API-Adresse und gesetztes Clubpasswort prüfen. Health ist keine erfolgreiche Anmeldung.                                                                                                                                                      |
| Karte leer                                                       | Maps SDK, Abrechnung, Paketname, SHA-1 und Schlüsselbeschränkungen prüfen. Neuer Schlüssel braucht neuen nativen Build.                                                                                                                      |
| `Cannot find native module`                                      | Nach nativen Paketänderungen neu bauen/installieren; eine alte APK oder Expo Go reichen nicht.                                                                                                                                               |
| Icon bleibt alt                                                  | Prebuild und neue APK installieren. Launcher können Icons zwischenspeichern.                                                                                                                                                                 |
| OneDrive meldet vorhandene Dateien als fehlend; Pfade zu lang    | Vollständige Arbeitskopie mit kurzem Pfad ausserhalb OneDrive verwenden und Abhängigkeiten frisch installieren. Nötige App-Konfiguration privat übernehmen; für die API einen eigenen lokalen Zustandsordner gemäss API-Anleitung verwenden. |
| Signatur passt nicht zur installierten App                       | Lokale Debug- und EAS-Signatur vergleichen. Nicht vorschnell deinstallieren: dabei gehen Favoriten und Anmeldung verloren.                                                                                                                   |

Weitere Quellen: [Expo CLI](https://docs.expo.dev/more/expo-cli/), [native Projektgenerierung](https://docs.expo.dev/workflow/continuous-native-generation/), [Android Debug Bridge](https://developer.android.com/tools/adb).
