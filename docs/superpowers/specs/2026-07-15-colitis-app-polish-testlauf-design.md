# Colitis-Ulcerosa-App – Schritt 8: Polish & Testlauf (Design)

Stand: 2026-07-15

## 1. Ziel und Abgrenzung

Schritt 8 ist der letzte grobe Umsetzungsschritt aus der ursprünglichen 8-stufigen Spec
(`docs/superpowers/specs/2026-07-07-colitis-ulcerosa-app-design.md`, Zeile 175):
"Design-Feinschliff, echter Alltagstest, Fehlerbehandlung schärfen".

Anders als bei den vorherigen Schritten wird hier keine neue Funktionalität gebaut, sondern
die bestehenden 7 fertigen Schritte werden zum ersten Mal als Ganzes betrachtet: bisher wurde
jeder Tab in einer eigenen Sitzung gebaut, ohne dass danach ein Durchgang über alle Screens
zusammen auf Konsistenz oder App-weite Fehlerpfade geprüft wurde.

**Umfang:**
- Systematischer Design-Konsistenz-Review über alle 5 Tabs + Unterbildschirme
- Systematischer Fehlerpfad-Review über die ganze App (Netzwerk, Datenbank, Berechtigungen,
  Formular-Validierung)
- Beheben der über die letzten 7 Pläne bewusst zurückgestellten Kleinigkeiten (Backlog)
- Erstellen einer Alltagstest-Checkliste als Dokument

**Explizit nicht Teil dieses Schritts:**
- Der tatsächliche Alltagstest auf einem echten Android-Gerät selbst – es ist aktuell unklar,
  ob/wann ein Testgerät zur Verfügung steht. Dieser Schritt liefert nur die Checkliste dafür.
- Neues visuelles Redesign oder neue Features – reine Konsistenz- und Robustheits-Härtung
  des bestehenden Designs.
- PDF/CSV-Export für Arztgespräche (bereits in Schritt 7 bewusst ausgeklammert)

**Vorgehen:** Vor dem Schreiben dieser Spec wurden zwei Recherche-Agenten (rein lesend)
eingesetzt, um die App systematisch nach Design-Inkonsistenzen bzw. Fehlerbehandlungs-Lücken
zu durchsuchen. Die konkreten Befunde unten sind das Ergebnis dieser Audits, jeweils mit
exakter Datei- und Zeilenangabe verifiziert. Der spätere Umsetzungsplan bekommt dadurch klare
"behebe X an Stelle Y"-Aufträge statt offener Sucheaufträge an die Arbeits-Agenten.

## 2. Design-Konsistenz-Befunde

### 2.1 Ladezustände fehlen (höchste Priorität)

Vier Listen-Screens haben keinen `isLoading`-Zustand – bis die Datenbank geantwortet hat,
zeigen sie denselben Leerzustand wie "wirklich keine Daten vorhanden", obwohl die
Detail-/Edit-Screens (`app/(tabs)/wissen/[slug].tsx`, `app/(tabs)/medikamente/[id].tsx`,
`app/schnellzugriff.tsx`, `app/_layout.tsx`) bereits einen sauberen Text-Ladezustand haben:

- `app/(tabs)/tagebuch/index.tsx`
- `app/(tabs)/tagebuch/auswertung.tsx`
- `app/(tabs)/wissen/index.tsx`
- `app/(tabs)/medikamente/index.tsx`

Fix: pro Screen einen `isLoading`-State (initial `true`) einführen, der auf `false` gesetzt
wird sobald die erste Abfrage zurückkommt (Erfolg oder Fehler). Solange `isLoading`, denselben
Text-Ladestil wie in `[slug].tsx`/`[id].tsx` zeigen, bevor auf den eigentlichen Leerzustand
geprüft wird. Kein `ActivityIndicator` nötig – die App verwendet durchgängig Text-Ladehinweise.

### 2.2 Anführungszeichen-Stil uneinheitlich

Korrekter deutscher Stil ist `„…"` (öffnend U+201E, schließend U+201C) – Referenz-Implementierung:
`src/features/diary/components/DiaryHistoryList.tsx:30`.

Falscher Stil `„…"` (öffnend U+201E, schließend gerades ASCII U+0022):
- `src/features/medications/components/MedicationList.tsx:19`
- `src/features/knowledge/content/articles.ts` – Zeilen 7, 26, 44, 48, 52 (zwei Vorkommen),
  95, 97, 101, 128

Komplett falscher Stil (beidseitig gerades ASCII `"…"`):
- `src/features/appLock/components/LockScreen.tsx:80`

Fix: alle genannten Stellen auf `„…"` (U+201E/U+201C) vereinheitlichen.

### 2.3 Unveränderter Expo-Scaffold-Screen

`app/+not-found.tsx` ist noch der unveränderte Expo-Standard-Screen und wurde bei keinem der
5 Tab-Durchläufe angefasst:
- Zeile 36: hartkodierte Linkfarbe `#2e78b7` (kräftiges Blau, kein Token, bricht aus der
  warmen Palette aus)
- Zeile 24: `padding: 20` statt `tokens.spacing.lg`
- Zeilen 27, 35: hartkodierte `fontSize: 20` / `fontSize: 14` statt Typografie-Tokens

Fix: Screen an die bestehenden Design-Tokens (`tokens.colors`, `tokens.spacing`,
`tokens.typography`) anschließen, gleicher Stil wie die restliche App.

### 2.4 Fehlender Radius-Token / Chip-Radius-Abweichung

`src/styles/tokens.ts` hat aktuell keine `radius`-Skala. Dadurch hat sich eine sichtbare
Abweichung zwischen zwei strukturell identischen Auswahl-Chip-Komponenten eingeschlichen:
- `src/features/diary/components/DiaryEntryForm.tsx:203` – `borderRadius: 20`
- `src/features/toilets/components/SavedPlaceForm.tsx:172` – `borderRadius: 16`

Fix: `tokens.radius = { sm: 8, md: 12, pill: 20 }` (oder passende Werte) in `tokens.ts`
ergänzen, beide Chip-Styles auf `tokens.radius.pill` (20) vereinheitlichen.

### 2.5 Button-Farbkonvention im Schnellzugriff-Screen

`app/schnellzugriff.tsx:114-119` ("Toiletten-Tab öffnen", reine Navigations-CTA) nutzt
`primary`, während die inhaltlich vergleichbare "Route dorthin"-Aktion in
`ToiletInfoCard.tsx:82` und `SavedPlaceInfoCard.tsx:118` (ebenfalls reine
Weiterleitung/Navigation) durchgängig `accent` nutzt.

Fix: Button in `schnellzugriff.tsx` auf `accent` umstellen, um die bestehende
Farbe-zu-Aktionstyp-Konvention einzuhalten.

## 3. Fehlerbehandlungs-Befunde

### 3.1 Kritisch

**App bleibt bei SecureStore-Fehler dauerhaft auf dem Lade-Screen hängen**
`src/features/appLock/useAppLockGate.ts:12` und `:30` – `isAppLockEnabled().then(...)` hat an
beiden Stellen (initialer Effekt, `AppState`-Listener) kein `.catch()`. Wirft
`SecureStore.getItemAsync()` (z. B. defekter/blockierter Android-Keystore), bleibt
`isResolved` dauerhaft `false`. In `app/_layout.tsx:83` führt das dazu, dass die App
unbegrenzt auf "Datenbank wird vorbereitet …" hängen bleibt – keine Fehlermeldung, kein
Ausweg.

Fix: `.catch()` an beiden Stellen ergänzen, das die Sperre im Fehlerfall auf einen definierten
Zustand setzt (Empfehlung: Sperre als aktiviert behandeln – sicherer Default bei
unsicherem Zustand) und den Fehler loggt, statt das Gate für immer offen zu lassen.

**"PIN vergessen"-Reset kann bei Teilausfall inkonsistenten Zustand hinterlassen**
`src/features/appLock/components/LockScreen.tsx:62-69` (`handleResetConfirm`) ruft
`await onReset()` nur in `try/finally`, kein `catch` – Fehler verlässt den `onPress`-Handler
als unbehandelte Rejection. `src/lib/appReset.ts:6-11` führt vier sequenzielle Schritte (DB
löschen, DB-Schlüssel löschen, PIN zurücksetzen, DB-Cache zurücksetzen) ohne jede
Fehlerbehandlung aus – schlägt ein Zwischenschritt fehl, bleibt die App in einem
widersprüchlichen Zustand, ohne dass der Nutzer etwas davon erfährt, bei einer unwiderruflichen
Aktion.

Fix: `try/catch` um `onReset()` in `LockScreen.tsx`, deutsche Fehlermeldung bei Fehlschlag.
In `appReset.ts` jeden Schritt einzeln fangen/loggen, sodass zumindest nachvollziehbar ist,
welcher Schritt fehlschlug (vollständige Atomarität ist hier technisch nicht herstellbar, da
die vier Schritte verschiedene Speicher-Subsysteme betreffen – aber sichtbares Fehlschlagen
statt stillem Teilerfolg ist das Ziel).

### 3.2 Wichtig – bekannter Backlog

**Fehlende Existenzprüfung in zwei Medikamenten-Repository-Funktionen**
`src/features/medications/db/medicationsRepository.ts:98-121` (`updateMedication`, insertiert
über `insertReminderTimes` in Zeile 118) und `:143-145` (`logMedicationTaken`). Beide fügen
referenzierende Zeilen ein, ohne vorher zu prüfen, ob die `medicationId` existiert – aktuell
nur durch `PRAGMA foreign_keys = ON` (`src/db/client.ts:44`) abgesichert, mit roher
FK-Fehlermeldung statt eigener, verständlicher Prüfung.

Fix: vor dem `INSERT` eine explizite Existenzprüfung ergänzen, bei Nichtvorhandensein einen
eigenen, aussagekräftigen Fehler werfen.

**Zu allgemeine Fehlermeldung im Schnellzugriff-Screen**
`app/schnellzugriff.tsx:43-44` (`Promise.all([listSavedPlaces, listCachedToilets])`) wird nur
vom äußeren Catch-all in `:60-65` gefangen, das bei jedem Fehler pauschal
`setStatus('no-candidates')` setzt. Ein echter Datenbankfehler zeigt dieselbe Meldung wie
"noch keine Toiletten/Orte bekannt".

Fix: Datenbankfehler von "keine Kandidaten gefunden" unterscheiden (z. B. eigener
`status`-Wert `'error'`) und eine spezifische deutsche Fehlermeldung anzeigen.

**Keine echte Kalender-Gültigkeitsprüfung für Datumsangaben**
`src/features/medications/formLogic.ts:22` (`DATE_PATTERN`) und `:36-41`
(`validateMedicationForm`) sowie `ScreeningReminderCard.tsx:11,26` prüfen nur das Format
`JJJJ-MM-TT`, nicht die Gültigkeit. `src/features/medications/reminderScheduling.ts:29-30`
(`new Date(year, month - 1, day, ...)`) rollt ungültige Werte lautlos auf ein anderes Datum
um – eine Erinnerung landet dann unbemerkt auf dem falschen Tag.
`src/features/medications/medicationStatus.ts:1-6` (`isMedicationActive`) vergleicht rein
lexikografisch – ein ungültiges, aber formatkonformes Datum erzeugt unsinnige
Aktiv/Beendet-Zustände. Zusätzlich fehlt eine Prüfung, dass Enddatum ≥ Startdatum ist.

Fix: echte Kalender-Validierung ergänzen (z. B. Datum bauen und prüfen, dass
Jahr/Monat/Tag nach dem Runden unverändert sind), plus Prüfung Enddatum ≥ Startdatum, an
allen betroffenen Stellen (Formular-Validierung, Screening-Reminder).

### 3.3 Wichtig – neu

**Overpass-Anfrage ohne Client-Timeout**
`src/features/toilets/overpassClient.ts:9-13` – `fetch()` ohne `AbortController`. Das
`[timeout:25]` in der Query ist nur ein serverseitiger Verarbeitungs-Timeout; bei hängender
Verbindung (z. B. Captive Portal) kann `fetch()` unbegrenzt hängen bleiben, der `try/catch` in
`toiletten/index.tsx:107-129` greift nie, die Suche bleibt dauerhaft im Ladezustand.

Fix: `AbortController` mit angemessenem Client-Timeout (z. B. 15 Sekunden) einführen, bei
Abbruch denselben Fehlerpfad wie bei einem regulären Netzwerkfehler auslösen (inkl.
Offline-Cache-Fallback).

**Biometrie- und PIN-Prüfung im Lock-Screen ohne Fehlerbehandlung**
`src/features/appLock/components/LockScreen.tsx:23-34` (`isBiometricsAvailable().then(...)`
ohne `.catch()`), `:40-45` (`handleBiometricsRetry`, kein `try/catch` um
`LocalAuthentication.authenticateAsync()`), und `handlePinChange` (`verifyPin`, Zeile 52,
`SecureStore`-Zugriffe in `pinAuth.ts:21-29`) ohne `try/catch`.

Fix: an allen drei Stellen Fehler abfangen und eine deutsche Fehlermeldung anzeigen statt
einer stillen, unbehandelten Rejection.

**PIN aktivieren/deaktivieren in den Einstellungen ohne Fehlerbehandlung**
`app/(tabs)/einstellungen/index.tsx:64-71` (`handleToggleLock`, `disableAppLock()` in Zeile 69
ungeschützt) und `:73-88` (`handleSetPin`, `setPin(newPin)` in Zeile 82 ungeschützt). Schlägt
der `SecureStore`-Zugriff fehl, bricht der Handler unbehandelt ab – bei einer
sicherheitsrelevanten Einstellung besonders problematisch, da der Nutzer nicht weiß, ob der
PIN-Schutz jetzt aktiv ist.

Fix: `try/catch` ergänzen, deutsche Fehlermeldung bei Fehlschlag, UI-Zustand nur bei
bestätigtem Erfolg ändern.

### 3.4 Klein

**`endMedication` stiller No-Op bei ungültiger ID**
`src/features/medications/db/medicationsRepository.ts:123-130` – reines `UPDATE ... WHERE id
= medicationId` ohne referenzierenden `INSERT`, dadurch nicht durch die FK-Prüfung
abgesichert. Bei ungültiger ID betrifft das UPDATE 0 Zeilen, ohne jede Rückmeldung.

Fix: betroffene Zeilenanzahl prüfen, bei 0 einen eigenen Fehler werfen.

**Karten-WebView ohne `onError`-Handler**
`src/features/toilets/components/ToiletMapView.tsx:74-81` – kein `onError`/`onHttpError` an
der `WebView`. Schlägt das Laden der Karten-HTML fehl, bleibt die Karte leer ohne Meldung.

Fix: `onError`-Handler ergänzen, der eine deutsche Fehlermeldung anzeigt (Karte konnte nicht
geladen werden).

## 4. Alltagstest-Checkliste

Neues Dokument `docs/superpowers/colitis-app-alltagstest-checkliste.md`, deutschsprachig,
abhakbare Prüfpunkte, gegliedert nach Bereich:

- Standort-Berechtigung (erlaubt / verweigert / später nachträglich erteilt)
- Benachrichtigungen (Medikamenten-Erinnerungen lösen aus, Vorsorge-Reminder, Verhalten bei
  verweigerter Berechtigung)
- PIN-/Biometrie-Sperre (Aktivierung, Sperre bei App-Start, Sperre bei Vordergrund-Wechsel,
  Biometrie-Fallback auf PIN, "PIN vergessen"-Reset-Flow)
- Backup/Restore (Export über System-Teilen-Dialog, Import mit falschem Passwort, echter
  Restore-Durchlauf, Neuplanung der Erinnerungen danach)
- Offline-Verhalten (Toiletten-Suche ohne Netzverbindung, Cache-Fallback,
  Schnellzugriff-Shortcut ohne Netz)
- Allgemeiner Alltagseindruck (Ladezeiten, Lesbarkeit/Kontrast bei Tageslicht, Bedienbarkeit
  unter Stress/im akuten Schub, Schriftgröße)

Reines Dokument, keine Code-Änderung. Wird nicht in dieser Sitzung abgehakt, sondern dient als
Vorlage für den späteren Test, sobald ein Gerät verfügbar ist.

## 5. Architektur – Aufteilung der Umsetzung

Subagent-Driven Development wie in den vorherigen Schritten, isolierter Arbeitsbereich, jede
Teilaufgabe einzeln reviewt, abschließend eine plan-übergreifende Abschluss-Review über alle
Teilaufgaben. 6 Teilaufgaben, gruppiert nach Codebereich (nicht nach Design/Fehlerbehandlung
getrennt), um Dateikonflikte zwischen parallel arbeitenden Agenten zu vermeiden:

1. **App-Sperre robuster machen** – Abschnitt 3.1 (beide kritischen Punkte) + die zwei
   App-Sperre-bezogenen Punkte aus 3.3 (Biometrie/PIN-Prüfung im Lock-Screen,
   Settings-Toggle)
2. **Medikamente-Validierung & Robustheit** – Kalender-Gültigkeitsprüfung (3.2),
   Existenzprüfungen (3.2), `endMedication`-No-Op (3.4)
3. **Toiletten-Fehlerbehandlung** – Overpass-Timeout (3.3), WebView-`onError` (3.4),
   spezifische Schnellzugriff-Fehlermeldung (3.2)
4. **Ladezustände ergänzen** – Abschnitt 2.1, alle 4 Listen-Screens
5. **Design-Token-Konsistenz** – Abschnitte 2.2–2.5 (Anführungszeichen, `+not-found.tsx`,
   Radius-Token, Button-Farbe)
6. **Alltagstest-Checkliste erstellen** – Abschnitt 4, reines Dokument

## 6. Testing-Ansatz

Wie in den vorherigen Schritten: automatisierte Tests (Vitest) für jede neue/geänderte
Fehlerbehandlungs-Logik (z. B. Kalender-Validierung, Existenzprüfungen, Timeout-Verhalten des
Overpass-Clients), Typprüfung durchgehend fehlerfrei. Reine UI-Konsistenz-Änderungen (Tokens,
Anführungszeichen, Ladezustände) benötigen keine neuen automatisierten Tests, sofern sie
bestehende Tests nicht brechen. Die Alltagstest-Checkliste (Abschnitt 4) ersetzt keine
automatisierten Tests, sondern ergänzt sie um das, was nur auf einem echten Gerät prüfbar ist.
