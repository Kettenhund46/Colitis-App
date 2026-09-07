# Testprotokoll Colitis2Go

Stand 07.09.2026, nachmittags. Dieses Dokument trennt drei Dinge: was
automatisiert geprüft wird, was tatsächlich auf einem Android-Gerät
ausprobiert wurde, und was ungeprüft geblieben ist.

**Ein Hinweis vorweg zur Ehrlichkeit dieses Dokuments.** Während der Entwicklung
wurde kein formales Geräteprotokoll geführt. Die Geräteprüfungen liefen als
Durchgang nach einer vorab notierten Prüfliste, das Ergebnis wurde mündlich
bestätigt. Abschnitt B gibt deshalb wieder, *was geprüft werden sollte* und
*was zurückgemeldet wurde* — nicht mehr. Wo eine Angabe fehlt, steht das da.

**Offene Angabe:** Gerätemodell und Android-Version sind unten nicht eingetragen,
weil sie nicht festgehalten wurden. Adrian trägt sie nach.

---

## A · Automatisierte Tests

Reproduzierbar mit `npm test` im Ordner `colitis-app`.

| | |
|---|---|
| Testfälle | 904 |
| Testdateien | 84 |
| Laufzeit | rund 5 Sekunden |
| Ergebnis am 07.09.2026 | alle grün |
| Typprüfung `npx tsc --noEmit` | ohne Befund |

**Was abgedeckt ist.** Die gesamte Fachlogik: Tagesbewertung, Krankheitsaktivität
nach 6-Punkte-Mayo, Zeitplan-Historie der Medikamente, Vorratsrechnung und
Reichweite, Einnahmetreue, Arztbesuch-Zusammenfassung, Ernährungs-Korrelation,
Backup-Serialisierung und -Verschlüsselung, PDF- und CSV-Aufbau, sowie sämtliche
Datenbank-Repositories gegen eine In-Memory-SQLite mit allen fünfzehn
Migrationen.

**Was nicht abgedeckt ist.** React-Native-Komponenten. Der Test-Runner läuft in
einer Node-Umgebung ohne DOM, `@testing-library/react-native` ist damit nicht
einsetzbar. Die Konsequenz war eine bewusste Entscheidung: Logik konsequent aus
den Komponenten heraushalten, Darstellung am Gerät prüfen. Ebenfalls nicht
abgedeckt: alles, was echte Geräte-Dienste braucht — Benachrichtigungen,
Standort, Biometrie, Dateisystem.

---

## B · Geräteprüfungen, die stattgefunden haben

Alle Builds über EAS, Profil `preview`, Android, interne Verteilung.
Installiert wurde jeweils über die vorhandene App, damit die Migrationen an
echten Daten laufen.

### B1 · Build `3a605964`, Commit `1458631`

Umfang: Medikamenten-Vorrat und Fragen für den Arzttermin. Migrationen 0011, 0012.

Vorab notierte Prüfliste:

1. Bei einem Medikament Packungsgröße und Bestand eintragen → Vorratszeile und
   Reichweite erscheinen auf der Karte.
2. Eine Einnahme abhaken → Bestand sinkt um die Einheiten je Einnahme.
3. Dieselbe Einnahme im Einnahme-Verlauf löschen → Bestand springt zurück.
4. Zweites Medikament ohne Vorratsangabe → keinerlei Vorratsanzeige.
5. Eine Frage notieren, Zusammenfassung öffnen → Frage steht vor den Zahlen.

Rückmeldung: „Läuft alles wie es soll." Kein Einzelergebnis je Punkt festgehalten.

### B2 · Build `7e539ad3`, Commit `3f5f159`

Umfang: Historisierung der Zeitpläne, Pausieren, Einnahmetreue im
Medikamenten-Pass. Migration 0013.

Vorab notierte Prüfliste:

1. Einnahme-Verlauf ansehen, Tage merken; danach eine Erinnerungszeit löschen →
   die vergangenen Tage bleiben unverändert.
2. Ein Medikament pausieren → Karte wechselt den Zustand, keine Erinnerungen,
   im Verlauf erscheint der Tag neutral als „pausiert".
3. Medikamenten-Pass exportieren → je Medikament eine Einnahme-Zeile.

**Befund am Gerät:** Beim pausierten Medikament war der Knopf „Fortsetzen"
genauso blass wie alle übrigen, weil die ganze Karte gedämpft wurde. Belegt
durch Screenshot vom 05.09.2026. Ursache: `isMuted` legt eine Deckkraft von
60 % über den gesamten Karteninhalt. Behoben in
`src/features/medications/components/MedicationList.tsx` — pausierte Karten
werden nicht mehr gedämpft, „Fortsetzen" trägt die gefüllte Form und steht an
erster Stelle.

### B3 · Build `1d635518`, Commit `4a29ac0`

Umfang: Ernährungstagebuch, dazu die Korrektur aus B2. Migration 0014.

Vorab notierte Prüfliste:

1. Pausiertes Medikament → „Fortsetzen" hebt sich sichtbar ab.
2. Mahlzeit eintragen → erscheint mit korrekter Uhrzeit in der Tagesliste.
3. Auswertung öffnen → zeigt zu einem auffälligen Tag die Mahlzeiten davor.

Rückmeldung: „Sieht alles gut aus." Kein Einzelergebnis je Punkt festgehalten.

### B4 · Build `1d635518` — Sichtprüfung am 07.09.2026

Zehn Bildschirmaufnahmen zwischen 11:08 und 11:19 Uhr, abgelegt in der
Präsentation (Folien 11 bis 13). Sie belegen den tatsächlichen Zustand von
Tagebuch, Auswertung, Arztbesuchen, Arztbesuch-Formular, Ernährungstagebuch,
Wissensbereich, Medikamenten, Einstellungen und Toilettenkarte.

**Befund:** Die Toilettenkarte zeigt oben das rote Banner „Toiletten konnten
nicht geladen werden". Siehe Abschnitt D2.

### B5 · Build `5d8bd31b`, Commit `7335082`

Umfang: eigenes App-Symbol. Keine Migration, keine Logikänderung.
**Noch nicht am Gerät installiert** (Stand 07.09.2026, 11:45 Uhr).

### B6 · Build `e783b7a2`, Commit `141ae24`

Umfang: die beiden Korrekturen vom Nachmittag des 07.09. — Rückhaltung der
App-Sperre beim Benachrichtigungs-Dialog (E3) und die Kennzeichnung des nicht
veröffentlichten Feeds (E5). Keine Migration.

Vorab notierte Prüfliste:

1. App-Sperre einschalten, PIN vergeben. Danach in den Einstellungen die
   tägliche Erinnerung aktivieren → Android fragt nach der
   Benachrichtigungserlaubnis; nach dem Erlauben **darf der Sperrbildschirm
   nicht erscheinen**.
2. Wissen → Neuigkeiten öffnen → ein ruhiger grauer Hinweis benennt den Feed
   als „noch nicht in Betrieb", keine rote Fehlermeldung.

Rückmeldung am 07.09.2026: „Funktioniert beides wie es soll." Damit sind E3
und E5 am Gerät bestätigt. Einzelergebnisse je Punkt wurden nicht getrennt
festgehalten; Gerätemodell und Android-Version stehen weiterhin aus.

---

## C · Was nicht geprüft wurde

| Bereich | Warum es offen ist |
|---|---|
| Wiederherstellung in getrennter Installation | Sicherung und Wiederherstellung sind automatisiert getestet, aber nie auf einem zweiten Gerät durchgespielt. Falsches Passwort und beschädigte Datei sind nur im Test abgedeckt, nicht am Gerät. |
| Erinnerung bei geschlossener App | Ob eine Medikamenten-Erinnerung bei beendeter App und nach einem Geräteneustart ausgelöst wird, ist ungeprüft. Das Manifest der gebauten APK deklariert `RECEIVE_BOOT_COMPLETED`, die Voraussetzung für das Wiedereintragen nach einem Neustart ist also da. |
| Pünktlichkeit der Erinnerungen | Das Manifest deklariert weder `SCHEDULE_EXACT_ALARM` noch `USE_EXACT_ALARM`. Die Erinnerungen sind damit ungenaue Alarme und dürfen ab Android 12 vom System verschoben werden — im Doze-Modus oder bei aktiver Akku-Optimierung um Minuten bis Stunden. Nicht gemessen. |
| App-Sperre im Zusammenspiel mit Berechtigungen | E3 ist nach der Behebung am Gerät bestätigt (B6). D1 — der Standort-Dialog — ist nach seiner Behebung nie erneut durchgespielt worden; durch D2 ist der Toiletten-Bereich dafür ohnehin schlecht erreichbar. |
| Toiletten-Bereich vollständig | Siehe D2 — durch den Fehler in der Umkreissuche ist der Rest des Bereichs praktisch nicht erreichbar und damit ungetestet. |
| Nachrichten-Feed | Siehe D3 — der Feed war nie in Betrieb, ein sinnvoller Test ist deshalb nicht möglich. |
| Verhalten bei frischer Installation ohne Netz | Nicht durchgespielt. |
| iOS | Nicht gebaut, nicht getestet. |

---

## D · Am Gerät gefundene Fehler

Diese Befunde stammen ausnahmslos aus Durchgängen am Gerät, nicht aus der
Testsuite. Sie sind der Grund, warum ab August ein Gerätedurchgang zu jeder
Ausbaustufe gehörte.

| # | Befund | Stand |
|---|---|---|
| D1 | Die App-Sperre schlug erneut zu, sobald der Standort-Berechtigungsdialog erschien; nach dem Entsperren landete man im falschen Tab. | behoben |
| D2 | Toilettenkarte meldet „Toiletten konnten nicht geladen werden". Die Karte selbst lädt, die Umkreissuche liefert nichts. Ursache nicht eingegrenzt. Das Testgerät hat keine Google Play Services, was die Standortbestimmung betrifft; ob zusätzlich die Overpass-Abfrage scheitert, ist offen. | **offen** |
| D3 | Der Nachrichten-Feed liefert HTTP 404. | Ursache belegt, Zustand in der App benannt (E5); der Feed selbst bleibt **außer Betrieb** |
| D4 | Der Knopf „Beenden" löschte ein Medikament, statt es zu beenden. | behoben |
| D5 | Ein über Mitternacht angelegtes Medikament bekam den Vortag als Startdatum. | behoben |
| D6 | Symbole der Tab-Leiste erschienen beim ersten Start als leere Kästchen (Schriftart noch nicht geladen). | behoben |
| D7 | Bei einem Zeitraum von genau einem Tag stand im Arztdokument „1 Tage". | behoben |
| D8 | Pausiertes Medikament: „Fortsetzen" nicht vom Rest unterscheidbar. | behoben |
| D9 | Tagebuch-Export lag hinter einem Drei-Punkte-Menü, im Medikamente-Tab dagegen als Leiste. | behoben |
| D10 | Die letzte Karte einer Liste lag unter dem Plus-Knopf. | behoben |

---

## E · Fehler, die ohne Gerät gefunden wurden

Aus einem neu geschriebenen Test oder aus dem Lesen des Codes — nicht aus
einem Gerätedurchgang.

**E1 · Rückwirkend gesetztes Enddatum.** Ein Test zu `closeScheduleAt` zeigte,
dass beim rückwirkenden Beenden eines Medikaments nur der letzte
Zeitplan-Abschnitt entfernt wurde, der davorliegende aber über das Enddatum
hinausreichte. Behoben in
`colitis-app/src/features/medications/db/scheduleHistoryRepository.ts`.

**E2 · Fehlende Tabellen in der Sicherung.** Beim Erweitern des Backups fiel
auf, dass `visit_questions` gar nicht exportiert wurde — die Fragen für den
Arzttermin wären beim Wiederherstellen spurlos verschwunden. Behoben in
`colitis-app/src/features/backup/db/backupRepository.ts`, mit Test für den
Rundlauf und für ältere Sicherungen ohne diese Tabelle.

**E3 · App-Sperre beim Benachrichtigungs-Dialog.** Bei der Durchsicht am
07.09. fiel auf, dass der Schutz aus D1 nur um den Standort-Aufruf gelegt war.
Ab Android 13 zeigt auch `requestNotificationPermission` einen Systemdialog,
der die App in den Hintergrund legt — bei aktiver App-Sperre landet der Nutzer
danach auf dem Sperrbildschirm. Sechs Aufrufstellen waren betroffen, etwa das
Einschalten der täglichen Erinnerung.

Behoben in `colitis-app/src/lib/permissions/pendingPermissionGuard.ts` und
`colitis-app/src/lib/notifications/notificationService.ts`: Der Merker sitzt
jetzt in der Anfrage selbst statt an den Aufrufstellen, ist ein Zähler statt
eines Schalters (verschachtelte Anfragen) und wird auch im Fehlerfall
freigegeben. Sechs Tests. **Am Gerät bestätigt** in Build `e783b7a2`, siehe B6.

**E4 · Migration 0013 lief nie gegen Daten.** Alle Tests legen eine leere
Datenbank an; die Nachtragung der Zeitplan-Abschnitte arbeitete dabei auf null
Medikamenten. Auf dem Gerät eines aktualisierenden Nutzers ist genau das der
Fall, der zählt. Kein Fehler im Code — aber eine Zusicherung ohne Nachweis.
Geschlossen in `scheduleHistoryMigration.test.ts`.

**E5 · Feed-Fehler nicht von einer Störung unterscheidbar.** Der Bildschirm
zeigte für den dauerhaft nicht veröffentlichten Feed dieselbe rote Meldung wie
für eine vorübergehende Störung. Seit `3c9b7b7` wirft der Client bei 404 einen
eigenen Fehlertyp, und der Bildschirm benennt den Zustand. **Am Gerät
bestätigt** in Build `e783b7a2`, siehe B6.

---

## F · Nachzutragen

- [ ] Gerätemodell und Android-Version in Abschnitt B
- [ ] Build `5d8bd31b` installieren und das App-Symbol sichten
- [x] Build aus `141ae24` erstellt (`e783b7a2`); E3 und E5 am Gerät bestätigt
- [ ] Wiederherstellung in getrennter Installation durchspielen (Abschnitt C)
- [ ] Erinnerung bei geschlossener App und nach Geräteneustart prüfen
- [ ] Pünktlichkeit der Erinnerungen unter Akku-Optimierung beobachten
- [ ] Ursache von D2 eingrenzen
