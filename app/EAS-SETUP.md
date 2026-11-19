# EAS für die Laverda-App einrichten

Die Play-Store-Testversion startet mit der mitgelieferten Ortsliste. Du kannst sie
als APK direkt auf dem Telefon installieren oder als AAB in die interne Testspur
der Google Play Console hochladen.

Dein persönliches Expo-Konto reicht dafür. Für diesen Android-Test brauchst du
kein Google-Play-Entwicklerkonto. Die kostenlose Expo-Stufe hat begrenzte
Build-Kontingente; die aktuellen Grenzen stehen unter <https://expo.dev/pricing>.

## 1. PowerShell im App-Ordner öffnen

Alle folgenden Befehle laufen in diesem Ordner:

```powershell
Set-Location "C:\Users\sagoo\OneDrive\Dokumente\workspace-app\app"
npm run eas -- --version
```

Beim ersten Aufruf lädt npm die festgelegte EAS CLI 27.10.0. Eine globale
Installation ist nicht nötig. Node.js und npm sind auf deinem PC vorhanden.

## 2. Bei Expo anmelden und das Projekt verbinden

Diese Schritte bewusst einzeln ausführen, weil du ein Konto und ein entferntes
Projekt auswählst; der lokale Helfer verbindet keine Cloud-Konten automatisch.

Zuerst im Terminal mit deinem persönlichen Expo-Konto anmelden:

```powershell
npm.cmd run eas -- login
```

Das Passwort gehört nur in den Anmeldedialog. Anschliessend das gewählte Konto prüfen:

```powershell
npm.cmd run eas -- whoami
```

Erst wenn dein Expo-Name stimmt, das Projekt verbinden:

```powershell
npm.cmd run eas -- init
```

Bei `init` dein persönliches Konto als Eigentümer auswählen. Falls du dort schon
ein EAS-Projekt für genau diese App hast, dieses verbinden. Andernfalls das
Projekt `laverda-map` anlegen lassen. Keine fremde Projekt-ID übernehmen.

Das verbindet den Quellcode mit dem Projekt bei Expo; es startet keinen Build.
Die Build-Profile in `eas.json` sind bereits vorbereitet.

Unsere App verwendet `app.config.js`, das die Werte aus `app.json` übernimmt.
Falls EAS meldet, dass es die dynamische Konfiguration nicht automatisch ändern
kann, die angezeigte echte Projekt-ID in `app.json` unter `expo.extra.eas.projectId`
eintragen. Unter `expo.owner` kommt dein Expo-Benutzername. Beispiel der Struktur,
zusätzlich zu den vorhandenen Feldern unter `expo`:

```json
{
  "owner": "DEIN_EXPO_BENUTZERNAME",
  "extra": {
    "eas": {
      "projectId": "ECHTE_PROJEKT_ID_AUS_EXPO"
    }
  }
}
```

Die Platzhalter durch deine echten Werte ersetzen. Vorhandene `extra`-Felder
erhalten. Beide Angaben dürfen ins Repository, sie sind keine Passwörter.
Danach prüfen:

```powershell
npm run eas -- project:info
```

Der angezeigte Eigentümer und Projektname müssen zu deinem Konto und dieser App
passen. Wenn das nicht stimmt, vor dem nächsten Schritt die Verknüpfung korrigieren.

## 3. Die Einstellungen bei Expo hinterlegen

Auf <https://expo.dev> dein Projekt öffnen und unter **Project settings →
Environment variables** die folgenden Variablen anlegen. Für die Test-APK und
das interne Play-Test-AAB die Umgebung **preview** wählen. Als Geltungsbereich
**Project** einstellen.

| Name                          | Wert                                                 | Sichtbarkeit |
| ----------------------------- | ---------------------------------------------------- | ------------ |
| `EXPO_PUBLIC_API_URL`         | Optional. Standard ist `https://api.laverdaclub.ch`. | Plain text   |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Dein Google-Maps-Schlüssel für Android               | Sensitive    |
| `EXPO_PUBLIC_CONTACT_EMAIL`   | Die echte Kontaktadresse des Clubs, sofern bekannt   | Plain text   |

Falls du die API-Adresse überschreibst, gib die HTTPS-Adresse ohne Route an. Der
lokale Modus funktioniert bereits, während der Webmaster die API einrichtet.
Den Online-Modus kannst du nach der [Freigabe der Leseroute](../api/README.md#online-modus-der-play-store-testversion) testen.

Die Maps-Variable muss **Sensitive** oder **Plain text** sein, damit auch die
Konfigurationsauswertung in EAS CLI sie lesen kann. Die Sichtbarkeit **Secret**
ist hier ungeeignet. Der Maps-Schlüssel landet technisch in der Android-App;
seinen Schutz übernehmen die Google-Beschränkungen aus Schritt 4.

Lokale `.env`-Dateien werden nicht hochgeladen. Das Startskript für Cloud-Builds
bricht bei fehlender Android-Maps-Konfiguration oder einer ungültigen optionalen
API-Adresse ab. Ohne Kontaktadresse bleibt der bisherige
Kontakt-Platzhalter aktiv. DB-Passwörter und Clubpasswort niemals als
App-Build-Variablen hinterlegen.

## 4. Android-Test bauen und Google Maps freigeben

Die Android-Kennung für den Play-Console-Eintrag und die Maps-Freigabe ist
`ch.laverdaclub.map`.

```powershell
npm run build:android:preview
```

Wenn dies die erste signierte Ausgabe der App ist, EAS einen neuen **Android
Keystore** erzeugen und verwalten lassen. Falls es schon eine veröffentlichte
App mit dieser Kennung gibt, die bestehenden Signierungsdaten verwenden.

Die CLI zeigt einen Link zum Build bei Expo. Dort findest du Status, Logs und
nach Abschluss den Installationslink. Der Befehl lädt den gefilterten App-Quellcode
zu Expo hoch und verbraucht Build-Kontingent.

Sobald der Keystore angelegt ist, unter **Credentials** im Expo-Projekt oder mit
dem folgenden Befehl dessen **SHA-1-Fingerabdruck** nachsehen:

```powershell
npm run eas -- credentials --platform android
```

In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Das zum Maps-Schlüssel gehörige Projekt auswählen; **Maps SDK for Android**
   und die erforderliche Abrechnung müssen eingerichtet sein.
2. Beim API-Schlüssel unter **Application restrictions → Android apps** die
   Kombination aus `ch.laverdaclub.map` und dem **SHA-1 des EAS-Keystores**
   hinzufügen. Bisher benötigte Einträge für lokale Builds erhalten.
3. Unter **API restrictions** auf **Maps SDK for Android** einschränken.

Nur die Beschränkungen desselben Schlüssels geändert? Nach Übernahme der Änderung
die App neu öffnen. Den Schlüssel selbst geändert? Variable bei Expo aktualisieren
und eine neue APK bauen. Bei einer späteren Veröffentlichung über Google Play
zusätzlich den SHA-1 des **Play-App-Signaturschlüssels** freigeben; er kann sich
vom EAS-/Upload-Schlüssel unterscheiden.

## 5. APK auf dem Telefon testen

Den Installationslink auf dem Android-Telefon öffnen und die APK installieren.
Android kann für den verwendeten Browser eine Erlaubnis zum Installieren aus
dieser Quelle verlangen. Alternativ die APK herunterladen und im Emulator
installieren. Zum späteren Abruf des Build-Status:

```powershell
npm run eas -- build:list --platform android --limit 3
```

Falls Android wegen einer anderen Signatur die Installation als Update ablehnt:
Das ist beim Wechsel von lokalem Debug-Keystore zu EAS möglich. Die bisherige
Testinstallation lässt sich deinstallieren; dabei gehen deren lokale Favoriten
und die gewählte Datenquelle verloren. Falls du sie behalten möchtest, zuerst die Signierung
abgleichen.

Die APK bei ausgeschaltetem Metro-Entwicklungsserver öffnen. Die lokale Liste,
Karte, Favoriten und den Kontaktentwurf auf dem Telefon prüfen. Die Google-Karte
benötigt für Kartenkacheln eine Internetverbindung.

## 6. Die weiteren Profile

| Profil               | Zweck                                                             | Befehl                                         |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| `development`        | Android-Entwicklungsclient für Änderungen am Code; benötigt Metro | `npm run build:android:development`            |
| `preview`            | Eigenständig laufende Android-Test-APK                            | `npm run build:android:preview`                |
| `production`         | Signiertes Android App Bundle für Google Play                     | `npm run build:android:production`             |
| `play-test`          | Signiertes AAB für die interne Play-Testspur                      | `npm run eas -- build -p android -e play-test` |
| `preview` für iOS    | Test auf registrierten iPhones, benötigt Apple-Entwicklerkonto    | `npm run build:ios:preview`                    |
| `production` für iOS | Build für App Store Connect/TestFlight                            | `npm run build:ios:production`                 |

Das Profil `play-test` lädt die Variablen aus **preview** und setzt die
API-Adresse auf `https://api.laverdaclub.ch`. Die übrigen Profile verwenden die
gleichnamige Expo-Umgebung.

Beim Entwicklungsclient wird der JavaScript-Code von Metro geladen. Deshalb
die lokale API-Adresse in deiner lokalen Umgebung setzen und den bestehenden
USB-Ablauf verwenden:

```powershell
npm.cmd run local -- Start
```

Diesen Windows-Helfer aus `app/` aufrufen; er richtet beide USB-Weiterleitungen ein
und startet Metro. Auf anderen Plattformen die beiden `adb reverse`-Befehle für
8080/8081 und `npx expo start --dev-client --localhost` manuell getrennt ausführen.
Dazu muss die lokale PHP-/MariaDB-Umgebung laufen und lokal
`EXPO_PUBLIC_API_URL=http://127.0.0.1:8080` konfiguriert sein. Siehe
[lokale API-Anleitung](../api/LOCAL-DEVELOPMENT.md). Der Maps-Schlüssel muss
zusätzlich in der EAS-Umgebung **development** vorhanden sein.

Vor dem ersten iOS-Build unter `expo.ios.bundleIdentifier` in `app.json` eine
eindeutige, zum Club passende Kennung eintragen, beispielsweise
`ch.laverdaclub.app`, sofern sie in eurem Apple-Team verfügbar ist. EAS kann die
iOS-App von Windows aus in der Cloud bauen; für iPhone-Verteilung und Store
werden Apple-Mitgliedschaft, Signierung und gegebenenfalls registrierte Geräte
benötigt. Die App verwendet auf iOS Apple Maps.

Die Profile verwenden aktuell dieselbe App-Kennung. Sie sind nicht als getrennt
installierbare App-Varianten eingerichtet. Produktions-Buildnummern erhöht EAS
automatisch; die sichtbare Version bleibt in `app.json` gepflegt.

## 7. Android-AAB für den internen Play-Test

Auf dem Branch `codex/play-store-test` im Ordner `app` diesen Build starten.

```powershell
npm.cmd run eas -- build -p android -e play-test
```

Nach dem Build das AAB auf der EAS-Buildseite herunterladen. In der Google Play
Console beim App-Eintrag einen Release in der Spur **Interner Test** anlegen und
das AAB dort hochladen. Prüfe vor dem Upload, dass die Einträge in der
mitgelieferten Ortsliste an die Tester weitergegeben werden dürfen.

### Weitere Store-Uploads

Vor einer Veröffentlichung die vorgesehenen Prüfungen aus `README.md` und echte
Gerätetests durchführen. Google Play beziehungsweise App Store Connect benötigen
Entwicklerkonten, App-Eintrag, Datenschutzangaben, Bilder und weitere Store-Daten.

Eine fertige **production**-Ausgabe lässt sich später gezielt auswählen und
hochladen:

```powershell
npm run eas -- submit --platform android
npm run eas -- submit --platform ios
```

Android erfordert einen angelegten App-Eintrag in der Play Console und einen
für EAS Submit eingerichteten Google-Service-Account. Laut aktueller Expo-Anleitung
kann EAS Submit auch den ersten Release in der internen Testspur anlegen;
ein manueller Upload bleibt eine Alternative. Bei iOS führt der Upload zunächst zu
App Store Connect/TestFlight. Die öffentliche Store-Freigabe erfolgt separat.
Store-Zugangsdaten und Service-Account-Dateien nicht ins Repository aufnehmen.

Die Vorbereitung startet weder automatische Store-Uploads noch EAS Update.

## Offizielle Anleitungen

- [Ersten EAS-Build einrichten](https://docs.expo.dev/build/setup/)
- [Build-Profile](https://docs.expo.dev/build/eas-json/)
- [EAS-Umgebungsvariablen](https://docs.expo.dev/eas/environment-variables/manage/)
- [Google Maps und SHA-1](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/)
- [Store-Übermittlung](https://docs.expo.dev/deploy/submit-to-app-stores)
