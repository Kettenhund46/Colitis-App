# Colitis2Go

Android-App für Menschen mit Colitis ulcerosa. Symptomtagebuch, Medikamentenplan,
Arztbesuch-Vorbereitung, Wissensbereich und Toilettenkarte.

Alle Daten bleiben verschlüsselt auf dem Gerät. Es gibt kein Benutzerkonto und
keinen Server, auf dem Gesundheitsdaten liegen.

Praktikumsprojekt von Adrian Cuculea-Citu, 07.07. bis 11.09.2026.

---

## Inhalt des Repositorys

```
colitis-app/          die App (Expo / React Native)
  app/                Bildschirme und Navigation (expo-router, dateibasiert)
  src/features/       ein Ordner je Fachbereich, siehe unten
  src/components/     geteilte Bausteine (Karte, Leerzustand, Wischzeile …)
  src/lib/            Werkzeuge ohne Fachbezug (Datum, Zahlen, Haptik, Benachrichtigungen)
  src/db/             Schema und verschlüsselter Datenbank-Client
  drizzle/            SQL-Migrationen 0000 bis 0014
  plugins/            eigenes Expo-Plugin für das Android-Widget
.planning/ROADMAP.md  Fahrplan mit allen Phasen und den Begründungen dazu
docs/superpowers/     Spezifikationen und Umsetzungspläne je Ausbaustufe
feed-service/         Erzeuger des Nachrichten-Feeds (eigenes Node-Projekt, nicht in Betrieb)
.github/workflows/    geplanter Zeitplan für den Feed (feed-update.yml)
```

Die Fachbereiche unter `src/features/`: `diary`, `medications`, `doctorVisits`,
`nutrition`, `knowledge`, `newsFeed`, `toilets`, `backup`, `appLock`,
`onboarding`, `settings`, `community`, `dailyJoke`, `deletion`.

Jeder Bereich folgt demselben Aufbau: reine Logik in `.ts`-Dateien mit
zugehöriger `.test.ts`, Datenbankzugriff in `db/`, Oberfläche in `components/`.
Die Dateien unter `app/` sind bewusst dünn — sie laden Daten und reichen sie an
Komponenten weiter.

---

## Voraussetzungen

| | |
|---|---|
| Node.js | 24.x (entwickelt mit 24.18.0) |
| npm | 11.x (entwickelt mit 11.16.0) |
| Expo SDK | 57 |
| Zielplattform | Android; iOS ist nicht getestet |
| Für Cloud-Builds | Konto bei [expo.dev](https://expo.dev) |

Ein lokaler Android-Build braucht zusätzlich Android Studio mit SDK und JDK 17.
Der schnellere Weg ist der Cloud-Build weiter unten.

---

## Einrichten und starten

```bash
git clone https://github.com/Kettenhund46/Colitis-App.git
cd Colitis-App/colitis-app
npm ci
npx expo start
```

Unter Windows: `npx.cmd` statt `npx`.

`npx expo start` öffnet den Entwicklungsserver. Die App braucht native Module
(SQLCipher, Benachrichtigungen, Standort, Biometrie) und läuft deshalb **nicht**
in Expo Go, sondern nur in einem Development Build oder in der fertigen APK.

---

## Tests

```bash
npm test
```

Führt die Vitest-Suite aus: **904 Tests in 84 Dateien** (Stand 07.09.2026).

Getestet wird die gesamte Fachlogik — Bewertung von Tagen, Krankheitsaktivität,
Zeitplan-Historie, Vorratsrechnung, Backup-Serialisierung, PDF- und CSV-Aufbau,
Datenbank-Repositories gegen eine In-Memory-SQLite.

Drei Tests verdienen eine eigene Erwähnung, weil sie Zusicherungen absichern
statt nur Verhalten festzuhalten:

- `backupRepository.test.ts` — ein Import, der mittendrin scheitert, lässt die
  vorhandenen Daten unangetastet, und die Sicherung erfasst nachweislich alle
  zwölf Tabellen mit Nutzerdaten.
- `medicationHistorySequence.test.ts` — die Abfolge Dosisänderung, Pausieren,
  Fortsetzen, Beenden an einem Stück, mit der Prüfung nach jedem Schritt, dass
  ein vergangener Tag seine ursprüngliche Bewertung behält.
- `scheduleHistoryMigration.test.ts` — Migration 0013 gegen echte
  Bestandsdaten statt gegen eine leere Datenbank.

**Nicht** automatisiert getestet werden React-Native-Komponenten. Der Test-Runner
läuft in einer Node-Umgebung ohne DOM; `@testing-library/react-native` ist damit
nicht nutzbar. Diese Grenze war eine bewusste Entscheidung: Die Logik liegt
deshalb konsequent außerhalb der Komponenten, und die Darstellung wird am Gerät
geprüft. Was am Gerät geprüft wurde und was nicht, steht in
[`TESTPROTOKOLL.md`](TESTPROTOKOLL.md).

Typprüfung:

```bash
npx tsc --noEmit
```

---

## APK bauen

```bash
cd colitis-app
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Das Profil `preview` erzeugt eine installierbare APK zur internen Verteilung
(siehe `eas.json`). Der Build läuft auf den Servern von Expo und dauert rund
fünfzehn Minuten; am Ende steht ein Download-Link im Terminal.

Die zuletzt ausgelieferte APK stammt aus Commit `7335082`. Der Code ist seither
weitergelaufen; die Änderungen der Commits `c3e0aa2` bis `3c9b7b7` stecken
noch in keiner gebauten APK.

Lokaler Build ohne Expo-Konto:

```bash
npx expo prebuild --platform android
npx expo run:android --variant release
```

Ungetestet — der Weg über EAS ist der, mit dem alle bisherigen Builds entstanden
sind.

---

## Datenbank und Migrationen

SQLite über Drizzle ORM, verschlüsselt mit SQLCipher. Der Schlüssel wird beim
ersten Start erzeugt und in `expo-secure-store` abgelegt, also im Keystore des
Geräts, nicht in der Datenbank und nicht im Quellcode.

Schema ändern:

```bash
npx drizzle-kit generate
```

Danach die neue Datei in `drizzle/migrations.js` eintragen — sonst läuft sie auf
dem Gerät nicht. Die Migrationen laufen beim App-Start automatisch.

Es gibt derzeit fünfzehn Migrationen (0000 bis 0014). Zwei davon tragen Daten
über einen Umbau hinweg mit: `0008` überführt „Blut ja/nein" in vier Stufen,
`0013` legt für jedes vorhandene Medikament einen ersten Zeitplan-Abschnitt an.
Die Nachtragung in `0013` ist in `scheduleHistoryMigration.test.ts` gegen
echte Bestandsdaten geprüft.

### Was die Sicherung enthält

Zwölf der fünfzehn Tabellen. Bewusst nicht enthalten sind `cached_toilets`,
`cached_feed_items` und `knowledge_content` — zwei Zwischenspeicher und die aus
dem Code erzeugten Artikel; alle drei entstehen beim nächsten Start neu.

Ein Wiederherstellen prüft Umschlag, Version, Passwort und Format **bevor** die
Datenbank angefasst wird. Falsches Passwort oder eine beschädigte Datei kosten
keine Daten. Der Import selbst läuft in einer Transaktion; bricht er ab, bleibt
der alte Stand stehen. Was der Import ersetzt, ersetzt er allerdings
vollständig — eine automatische Sicherheitskopie davor gibt es nicht.

---

## Stand der Bereiche

| Bereich | Stand |
|---|---|
| Tagebuch | in Betrieb, am Gerät geprüft |
| Krankheitsaktivität | in Betrieb, am Gerät geprüft |
| Medikamente | in Betrieb, am Gerät geprüft |
| Arztbesuche und Fragen | in Betrieb, am Gerät geprüft |
| Ernährungstagebuch | in Betrieb, am Gerät geprüft |
| Wissensartikel | in Betrieb, am Gerät geprüft |
| App-Sperre, Sicherung | umgesetzt, nur teilweise am Gerät geprüft |
| Toiletten-Bereich | **nur die Karte**; die Umkreissuche liefert keine Ergebnisse |
| Nachrichten-Feed | **nicht in Betrieb**; die App weist im Bildschirm darauf hin |

Der Umfang der Geräteprüfungen steht in [`TESTPROTOKOLL.md`](TESTPROTOKOLL.md).

---

## Bekannte offene Punkte

1. **Nachrichten-Feed nicht veröffentlicht.** Die App liest
   `https://raw.githubusercontent.com/Kettenhund46/colitis-app-feed/main/feed.json`
   (`src/features/newsFeed/constants.ts`). Dieses Repository gibt es nicht; der
   Abruf endet mit HTTP 404. Der Erzeuger liegt unter `feed-service/` samt
   Clients für PubMed, AWMF, FDA und EMA, deutscher Zusammenfassung über die
   Claude-API und einem GitHub-Actions-Workflow — er wurde nie gestartet.

   Seit `3c9b7b7` unterscheidet die App diesen Dauerzustand von einer Störung:
   Ein 404 unter der fest einkompilierten Adresse führt zu einem ruhigen
   Hinweis („noch nicht in Betrieb"), ein Netzfehler weiterhin zum
   Offline-Hinweis. **In Betrieb nehmen** würde bedeuten: ein Repository
   `colitis-app-feed` anlegen, `ANTHROPIC_API_KEY` und `FEED_PUBLISH_TOKEN` als
   GitHub-Secrets hinterlegen und den Workflow laufen lassen.
2. **Toiletten-Umkreissuche ohne Ergebnis.** Auf dem Testgerät erscheint
   „Toiletten konnten nicht geladen werden". Ursache noch nicht eingegrenzt;
   in Frage kommen der Standort (das Testgerät hat keine Google Play Services)
   und die Overpass-Abfrage selbst. Sichere Orte, Offline-Speicher und
   Schnellzugriff sind im Code vorhanden, aber dadurch praktisch nicht
   erreichbar und ungetestet.
3. **Kein Wiederherstellungs-Test in getrennter Installation.** Sicherung und
   Wiederherstellung sind automatisiert getestet, aber nicht auf einem zweiten
   Gerät durchgespielt.
4. **Erinnerungen nach einem Geräteneustart** sind nicht geprüft. Das Manifest
   der gebauten APK deklariert `RECEIVE_BOOT_COMPLETED`, die Voraussetzung ist
   also da.
5. **Erinnerungen sind ungenaue Alarme.** Das Manifest deklariert weder
   `SCHEDULE_EXACT_ALARM` noch `USE_EXACT_ALARM`. Ab Android 12 darf das System
   solche Alarme verschieben — im Doze-Modus oder bei aktiver Akku-Optimierung
   um Minuten bis Stunden. Für eine Medikamenten-Erinnerung ist das eine
   spürbare Einschränkung.
6. **Nur deutsche Bedienung.** Die Mehrsprachigkeit ist geplant und
   zurückgestellt, siehe Fahrplan.
7. **Der Test-Helfer `createTestDb`** liegt in sechs Fachbereichen fast
   wortgleich; das Zusammenführen steht aus.

---

## Herkunft der Zahlen und Grenzen

Die Krankheitsaktivität folgt dem **6-Punkte-Mayo (PRO-2)**: Stuhlfrequenz
relativ zur persönlichen Normalzahl und Blutbeimengung, je 0 bis 3.
Berechnung in `src/features/diary/activityIndex.ts`, Tests in der
gleichnamigen `.test.ts`.

Ohne hinterlegte persönliche Normalzahl gibt die App **keine** Zahl aus, statt
eine zu schätzen.

Die App rechnet und zeigt. Sie stellt keine Diagnose, gibt keine Empfehlung ab
und ersetzt keine ärztliche Beurteilung. Unter jeder Ausgabe steht, woraus sie
entsteht. Das ist die bewusste Grenze zum Medizinprodukt.

---

## Lizenz

Siehe [colitis-app/LICENSE](colitis-app/LICENSE).
