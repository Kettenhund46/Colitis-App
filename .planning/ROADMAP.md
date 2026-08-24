---
roadmap_version: 1.0
current_milestone: v1
---

# Roadmap — Colitis2Go

Entstanden am 2026-08-20 aus einer Bestandsaufnahme der App nach dem erfolgreichen
Gerätetest von Schnell-Eintrag, aufgeräumtem Tagebuch-Tab und Tab-Wischgeste.

Der Nutzer hat entschieden, alle vorgeschlagenen Verbesserungen nacheinander
umzusetzen. Jede Phase durchläuft den etablierten Ablauf dieses Projekts:
brainstorming → writing-plans → subagent-driven-development → Gerätetest.

## Reihenfolge — warum genau so

**Mehrsprachigkeit steht am Ende.** Sie zieht jeden sichtbaren Text der App in
Übersetzungsdateien. Käme sie früh, würden Leerzustands-Texte übersetzt, die
Phase 2 ohnehin neu formuliert, und Bildschirme, die es noch gar nicht gibt.
Als letzter Schritt fasst sie den Endstand genau einmal an.

**Die Gestaltungssprache steht vor den neuen Features.** Phase 2 legt fest, wie
eine Karte, ein Leerzustand und ein Ladezustand in dieser App aussehen. Was
danach dazukommt, folgt dieser Sprache, statt sie nachträglich aufgedrückt zu
bekommen.

## Milestone v1 — Alltagstauglichkeit und Erscheinungsbild

| Phase | Ziel | Status |
|------|------|--------|
| 1 | Ans Eintragen erinnert werden und den Schweregrad beim Scrollen sehen | done |
| 2 | Die App sieht nach Gestaltung aus, nicht nach Formular | done |
| 3 | Löschen geht per Wischen und die Bedienung fühlt sich spürbar an | done |
| 4 | Medikamenteneinnahme lässt sich abhaken und nachvollziehen | done |
| 5 | Ein Arzttermin lässt sich mit einer Zusammenfassung vorbereiten | done |
| 6 | Die App ist auf Deutsch und Englisch bedienbar | zurückgestellt |

---

### Phase 1 — Erinnerung und Schweregrad auf einen Blick

**Goal:** Der Nutzer wird täglich ans Eintragen erinnert und erkennt beim
Durchscrollen der Tagebuch-Liste sofort, wie die einzelnen Tage verliefen.

**Success criteria:**
- Eine tägliche Erinnerung erscheint zur selbst gewählten Uhrzeit und lässt sich in den Einstellungen ein- und ausschalten
- Jeder Eintrag in der Tagebuch-Liste trägt eine sichtbare Kennzeichnung seines Schweregrads, die nicht allein auf Farbe beruht
- Die Kennzeichnung stimmt mit der Bewertung überein, die derselbe Tag im Kalender erhält

**Stand am 2026-08-20:** Code umgesetzt und nach main übernommen (Merge `06e416e`),
463 Tests grün, Typprüfung sauber. Die Phase gilt aber erst als abgeschlossen,
wenn der Gerätedurchgang aus dem Umsetzungsplan durch ist — zwei der drei
Erfolgskriterien lassen sich nur dort bestätigen, weil Benachrichtigungen und
Darstellung im Testlauf nicht nachgebildet sind.

Die Schlussdurchsicht fand einen kritischen und drei wichtige Wege in einen
stillen Fehlzustand („Einstellung an, aber keine Erinnerung geplant"), alle
behoben. Der schwerste trat beim Wiederherstellen einer Sicherung auf. Die
Abnahmepunkte 9 bis 11 im Umsetzungsplan prüfen genau diese Wege nach.

**Bewusst offengelassene geringfügige Befunde**, die bei Gelegenheit mitlaufen
können, keiner davon dringend:
- Schlägt das Speichern der Benachrichtigungs-Kennung nach erfolgreicher Planung fehl, bleibt eine Benachrichtigung ohne bekannte Kennung zurück (sehr unwahrscheinlich, Fehlerrichtung ungefährlich)
- Scheitert die Planung beim App-Start, wird ohne sichtbare Rückmeldung ausgeschaltet
- Wird bei sichtbarem Einstellungen-Bildschirm wiederhergestellt, frischt der Bedienblock sich nicht auf; heilt beim Bildschirmwechsel
- Wirft das Neuplanen der Medikamenten- oder Backup-Erinnerung, wird der Tagebuch-Aufruf übersprungen
- `buildDayRatings` läuft bei jedem Render statt einmal je Datenstand
- Der Bewertungs-Indikator sitzt in der Listenkopfzeile 2 px zu tief; der Wert stammt aus der Kalenderzelle — passt zu Phase 2

**Nachtrag 2026-08-20:** Der Gerätetest bestätigte Erinnerung und Kennzeichnung.
Dabei fiel auf, dass der Erinnerungs-Block im Backup-Abschnitt saß und als Karte
gestaltet war, während alle übrigen Abschnitte flach auf dem Hintergrund liegen.
Behoben in `00a2cc8`: eigener Abschnitt nach „Navigation", Gestaltung an die
Nachbarn angeglichen. Auf Entscheidung des Nutzers **kein eigener Build dafür** —
die Sichtprüfung dieser Änderung und die offenen Abnahmepunkte 9 bis 11 laufen
beim nächsten Build aus Phase 2 mit.

Dieser Befund gehört inhaltlich zu Phase 2: Der Einstellungen-Bildschirm mischt
zwei Gestaltungssprachen. Phase 2 legt fest, welche gilt.

*Gestrichen am 2026-08-20 im Entwurf:* „Wer heute bereits etwas erfasst hat, wird
nicht mehr erinnert." Der wiederkehrende Tagestrigger des Betriebssystems lässt
sich nicht teilweise abbestellen; die Alternative über einen begrenzten Vorrat
einzelner Termin-Benachrichtigungen würde ausgerechnet bei längerer Nichtnutzung
verstummen. Entscheidung des Nutzers: immer erinnern, dafür mit neutralem Text.

**Depends on:** none

**Vorhandenes, worauf das aufbaut:** `scheduleDailyReminder` in
`src/lib/notifications/notificationService.ts`; `rateDiaryEntry` in
`src/features/diary/calendarLogic.ts` (heute nur im Kalender genutzt);
das `get.../set...`-Muster in `src/features/settings/settingsStorage.ts`.

---

### Phase 2 — Gestaltungssprache

**Goal:** Die App nutzt ihre vorhandene Farbpalette gestalterisch aus, statt
jeden Inhalt in gleich aussehende Zeilen mit einem Pixel Rand zu setzen.

**Success criteria:**
- Listeneinträge und Inhaltsblöcke erscheinen als abgesetzte Flächen mit erkennbarer Hierarchie zwischen Überschrift und Detail
- Jeder der fünf Leerzustände erklärt, was hier entstehen wird, statt nur festzustellen, dass nichts da ist
- Während Daten geladen werden, erscheint ein Platzhalter in der Form des kommenden Inhalts statt eines Textes
- Alle drei Themes wirken gleichermaßen absichtsvoll, keines wie eine Ableitung der anderen

**Depends on:** Phase 1 (die Schweregrad-Kennzeichnung ist Teil der Listendarstellung, die hier gestaltet wird)

**Bestandsaufnahme:** Die Palette in `src/theme/palettes.ts` ist bewusst gewählt
(warmes Creme, Salbeigrün, gedämpftes Orange) und wird von den Layouts kaum
abgerufen. Fünf Leerzustände existieren, alle als nackter Text.

**Stand am 2026-08-21:** Neun Aufgaben umgesetzt und nach `main` übernommen
(Merge `24dad83`), 477 Tests grün, Typprüfung sauber. Build
`497e94c7-6f30-42db-9af0-dd7ca42f4d4e` fertig. Die Phase gilt erst als
abgeschlossen, wenn der Gerätedurchgang aus dem Umsetzungsplan durch ist —
Gestaltung ist im Testlauf nicht nachbildbar.

Entwurf: `docs/superpowers/specs/2026-08-20-colitis-app-gestaltungssprache-design.md`
Plan mit 15 Abnahmepunkten: `docs/superpowers/plans/2026-08-20-colitis-app-gestaltungssprache.md`

Es waren ursprünglich acht Aufgaben. Der Abschlussgrep der achten fand drei
weitere echte Kartenkopien, die die Dateiliste des Plans übersehen hatte —
`ScreeningReminderCard`, `SavedPlaceInfoCard`, `ToiletInfoCard`. Entscheidung
des Nutzers: mitnehmen statt vertagen. Daher Aufgabe 9. Übrig bleiben genau
zwei `borderRadius: 12`, beide in Formularen und laut Entwurf außerhalb.

Die Schlussdurchsicht fand nichts Kritisches und zwei wichtige Punkte, beide
behoben in `5bebafd`: `EmptyState` hatte `flex: 1`, also `flexBasis: 0` — im
Verlaufsdiagramm sitzt es in einem Container ohne `flex` innerhalb einer
ScrollView, der Leerzustand wäre auf Android verschwunden. Dazu ein toter
`View`-Import, den `tsc` hier nicht meldet, weil `noUnusedLocals` nicht
gesetzt ist.

**Erfolgskriterium 4 ist nur teilweise eingelöst.** Weil `success` in allen
drei Themes grün bleiben sollte, teilen sich Hell und Hellblau jetzt denselben
Grünton *und* dieselbe Flächenbehandlung (Schatten). Auf der
Zustandsfarben-Achse ist Hellblau damit eher eine Ableitung von Hell als
vorher. Dunkel ist echt eigenständig. Das ist eine Schwäche der
Entwurfsentscheidung, nicht der Umsetzung.

**Auf dem Gerät zu klären, aus der Schlussdurchsicht:**
- Die neutrale Kante greift auf `colors.border` zu — als 1 px Trennlinie richtig, als 4 px Zustandskante womöglich fast unsichtbar; im dunklen Theme gleicht sie exakt dem Kartenrand. Betrifft beendete Medikamente und Arztbesuche. Falls sie nichts sagt: eine Konstante in `cardStyle.ts`
- Toiletten-Tab: Die Einblendung über der Landkarte hat in den hellen Themes jetzt Schatten statt Rand. Vor buntem Kartenmaterial ist ein Schatten schwächer — der einzige Ort, an dem eine Ausnahme von der Theme-Regel begründbar wäre
- Neuigkeiten: Ungelesene tragen eine Kante, gelesene nicht. React Native zeichnet Ränder nach innen, der Text ungelesener Karten beginnt also 4 px weiter rechts — in gemischter Liste ein ausgefranster linker Rand
- Arztbesuche: `accent="neutral"` steht auf jeder Zeile unbedingt und unterscheidet damit nichts

**Kleinere Befunde, bewusst offengelassen:**
- Wissens-Suche: Bei leerer Abfrage *und* leerer Artikeltabelle steht dort „Versuch es mit einem anderen Suchbegriff", obwohl es keinen gibt
- `palettes.test.ts` prüft Ungleichheit, nicht Kontrast. Die gewählten Werte sind in Ordnung (`#3E8E4F` auf Weiß etwa 4,2:1), der Test ließe aber auch schlechte durch
- `GhostCard` hat ein `hasHeaderBadge`, das kein Aufrufer je übergibt
- `GhostCard`/`SkeletonList` klemmen `count` und `lines` still auf mindestens 1
- Die Zuordnung Zustand → Kante wurde nur im Tagebuch in eine reine Funktion gezogen (`accentForRating`, getestet). Die gleichartigen Entscheidungen in `MedicationList` und `NewsFeedList` stehen im JSX und sind damit ungeprüft

**Für Phase 3 gelernt:** Den Abschlussgrep zum festen Schritt der letzten
Aufgabe machen — er hat mehr gefunden als jede einzelne Durchsicht. Daneben
einen Durchgang auf unbenutzte Importe, weil `tsc` die hier nicht meldet.

---

### Phase 3 — Bedienung

**Goal:** Häufige Handgriffe gehen schneller und geben spürbare Rückmeldung.

**Success criteria:**
- Ein Listeneintrag lässt sich durch Wischen löschen
- Ein versehentliches Löschen lässt sich unmittelbar rückgängig machen
- Speichern und Löschen geben ein haptisches Signal
- Wer die Systemeinstellung für reduzierte Bewegung gesetzt hat, bekommt keine Bewegungseffekte

**Depends on:** Phase 2 (die Wisch-Darstellung folgt der dort festgelegten Kartenform)

**Achtung:** Die Tab-Wischgeste aus `src/components/SwipeableTabScreen.tsx`
greift bereits auf Randgesten zu. Das Wischen auf Listeneinträgen darf ihr nicht
in die Quere kommen — das ist der Kern des Entwurfs dieser Phase.

**Stand am 2026-08-21:** Sieben Aufgaben umgesetzt und nach `main` übernommen
(Merge `8b8240a`), 502 Tests grün, Typprüfung sauber. Die Phase gilt erst als
abgeschlossen, wenn der Gerätedurchgang durch ist — Gesten, Zeitverhalten und
Haptik sind im Testlauf nicht nachbildbar.

Entwurf: `docs/superpowers/specs/2026-08-21-colitis-app-bedienung-design.md`
Plan mit 16 Abnahmepunkten: `docs/superpowers/plans/2026-08-21-colitis-app-bedienung.md`

Neue Abhängigkeit: `expo-haptics ~57.0.1`. **Nach einem `git pull` auf einem
anderen Rechner erst `npm install`**, sonst bricht die Typprüfung.

**Der Gestenkonflikt hält.** Beide Gesten holen `EDGE_WIDTH` aus derselben
Datei und benutzen denselben Vergleich; es gibt keinen Pixel, den beide
beanspruchen. Die Schlussdurchsicht hat sechs Kombinationen durchgespielt.
Bestätigen kann das aber erst das Gerät — die Abnahmepunkte 8 bis 11 prüfen
ausdrücklich das Alte, nicht das Neue: Tab-Wischgeste, Leaflet-Karte,
Randstreifen, Scrollen mit schrägem Finger.

**Die Schlussdurchsicht fand stillen Datenverlust.** Im Kalender und im
Toiletten-Tab blieb der Löschen-Knopf während des Rückgängig-Fensters
bedienbar; ein zweiter Druck führte den ersten Vorgang endgültig aus, während
der Streifen weiter Rückgängig anbot. Behoben an drei Stellen: ein Wächter in
`requestDeletion` (gleiche Kennung führt nichts aus, startet nur die Uhr neu),
eine eigene `hiddenId`-Prop für `DiaryCalendarView`, und die Infokarte im
Toiletten-Tab schließt jetzt sofort.

Dazu vier wichtige Befunde, alle behoben: Der Streifen lag unter dem
„+"-Knopf. Ein fehlgeschlagener Löschvorgang erreichte den Nutzer nicht. Die
Zeilengeste beanspruchte die Berührung ab einem Pixel und schluckte damit
Tipps auf die Knöpfe in der Zeile. Und die Zeile tauchte zwischen
Zustandswechsel und Neuladen kurz wieder auf.

**Bewusste Ausnahme:** Der Vorsorge-Termin verliert den Dialog, bekommt aber
kein Rückgängig — er sitzt im Medikamente-Bildschirm, der bereits einen
wartenden Vorgang führt, und die Karte klappt beim Löschen ohnehin sofort ins
Eingabefeld auf. Entscheidung des Nutzers. Rückgängig gilt damit an vier der
fünf Löschwege.

**Kleinere Befunde, bewusst offengelassen:**
- `usePendingDeletion` schreibt zwei Refs im Render-Rumpf; gängiges Muster, widerspricht aber der Projektregel
- `SwipeableRow` baut seinen `PanResponder` neu, wenn `onDelete` die Identität wechselt — alle Aufrufer übergeben frische Pfeilfunktionen
- `UndoBar` setzt `accessibilityRole="alert"` ohne `accessibilityLiveRegion`; TalkBack kündigt den Streifen also nicht an, und er ist nach acht Sekunden weg
- Rückgängig gibt kein haptisches Signal, Löschen schon
- Zwei Speicherwege ticken nicht: der sichere Ort im Toiletten-Tab und der Vorsorge-Termin
- Die drei Listen filtern `hiddenId` unterschiedlich (einmal als Variable, zweimal inline)

---

### Phase 4 — Medikamenteneinnahme nachvollziehen

**Goal:** Der Medikamente-Tab wird vom Nachschlagewerk zum Werkzeug: Einnahmen
lassen sich festhalten und im Rückblick nachvollziehen.

**Success criteria:**
- Für jedes aktive Medikament lässt sich die heutige Einnahme mit einem Tipp festhalten
- Der Tab zeigt auf einen Blick, was heute noch offen ist
- Vergangene Einnahmen und Lücken sind für einen wählbaren Zeitraum einsehbar
- Die Einnahmedaten sind in Sicherung und Wiederherstellung enthalten

**Depends on:** Phase 2 (folgt der dort festgelegten Gestaltungssprache)

**Bestandsaufnahme am 2026-08-22 — die Hälfte steht schon.** Nachgeprüft am Code:

| Kriterium | Stand |
|---|---|
| Heutige Einnahme mit einem Tipp festhalten | **erfüllt** |
| Der Tab zeigt auf einen Blick, was heute noch offen ist | offen |
| Vergangene Einnahmen und Lücken für einen wählbaren Zeitraum | offen |
| Einnahmedaten in Sicherung und Wiederherstellung | **erfüllt** |

Vorhanden: die Tabelle `medication_log` in `src/db/schema.ts`,
`logMedicationTaken` und `listMedicationIdsTakenOn` in
`src/features/medications/db/medicationsRepository.ts`, der Knopf
„Heute genommen ✓" in `MedicationList.tsx`, und `medicationLog` vollständig in
Export, Leeren und Wiederherstellen in
`src/features/backup/db/backupRepository.ts`.

**Was diese Phase noch zu tun hat**, ist also nicht das Erfassen, sondern das
Zurückschauen: eine Übersicht des heutigen Stands im Tab, und eine Ansicht
vergangener Einnahmen samt Lücken über einen wählbaren Zeitraum.
`listMedicationIdsTakenOn` liest heute genau einen Tag — für den Rückblick
braucht es eine Abfrage über einen Bereich.

**Stand am 2026-08-22:** Fünf Aufgaben umgesetzt, 544 Tests grün (vorher 502),
Typprüfung sauber. Die Phase gilt erst als abgeschlossen, wenn der
Gerätedurchgang durch ist.

**Was sich beim Bauen als falsch herausstellte.** Die Bestandsaufnahme oben
nannte das Erfassen „erfüllt". Das stimmte nur halb. `listMedicationIdsTakenOn`
faltete die Zeilen eines Tages mit `[...new Set(...)]` zu einer Menge zusammen
— die Erfassung war damit binär je Medikament und Tag, ein dreimal täglich
einzunehmendes Präparat las sich nach der ersten Dosis den ganzen Tag als
erledigt. Dieselbe Abfrage verglich zudem mit `like` ein lokales Datum gegen
einen UTC-Zeitstempel, sodass eine Einnahme kurz nach Mitternacht auf den
Vortag fiel. Beides fiel nicht auf, solange der Haken binär war. Die Funktion
ist ersatzlos entfallen; gezählt wird jetzt in `adherence.ts` über lokale
Kalendertage.

**Die Rechnung.** Fällige Einnahmen je Tag = Anzahl der hinterlegten
Erinnerungszeiten, mindestens eine. Ein Tag zählt nur innerhalb der Laufzeit
des Medikaments. Kein Schemawechsel — jedes Abhaken schrieb schon immer eine
eigene Zeile mit Zeitstempel, sie wurden nur zusammengefaltet.

**Befunde der Schlussdurchsicht, alle behoben:** Der „Heute genommen"-Knopf
hatte keine Sperre gegen Doppeltippen — bisher folgenlos, jetzt eine
überzählige Zeile in genau der Zahl, die der Arzt sieht. Die
Zusammenfassungszeile blieb nach dem Löschen eines Medikaments stehen und
nannte etwas als offen, dessen Karte bereits weg war; sie wird jetzt aus dem
Zustand abgeleitet statt getrennt geführt. Der Einnahme-Knopf beachtete das
Startdatum nicht. Das vorbelegte Startdatum im Formular stammte aus UTC. Und
ein Testaufräumer schrieb die Zeichenkette `"undefined"` in `process.env.TZ`.

**Bewusst offengelassen, für Phase 5 zu entscheiden:**
- **Die Rückschau bewertet jeden vergangenen Tag mit der *heutigen* Zahl der
  Erinnerungszeiten.** Wer im Juli eine Zeit hatte und im August auf drei
  erhöht, dessen Juli liest sich rückwirkend als lauter „1 von 3". Das folgt
  der Spezifikation (§1 definiert Fälligkeit über die aktuellen
  `reminderTimes`, und „kein Schemawechsel" schließt eine Historisierung aus),
  ist aber die einzige Stelle, an der ohne Fehlbedienung eine belastbar falsche
  Zahl entsteht. **Bis das entschieden ist, darf die Auswertung nicht in den
  Medikamenten-Pass wandern.** Zwei Wege: eine historisierte Sollmenge
  (`medication_schedule_history`, echter Schemawechsel) oder ein Hinweis im
  Verlauf, dass die Sollmenge dem aktuellen Zeitplan folgt.
- Ein pausiertes und wieder aufgenommenes Medikament liest sich als lange
  Versäumnisstrecke — `startDate`/`endDate` bilden genau ein Intervall ab.
- Einnahmen an Tagen, an denen kein Medikament fällig war, sind im Verlauf
  weder sichtbar noch entfernbar, obwohl sie in Datenbank und Sicherung stehen.
- Bleibt ein Bildschirm über Mitternacht im Vordergrund, altert sein „heute";
  ein Wechsel weg und zurück heilt es. Vorbestehend, durch die Zählung nur
  sichtbarer.
- `medicationStatus.test.ts` schreibt beim Aufräumen dieselbe Zeichenkette
  `"undefined"` in `process.env.TZ` wie der in dieser Phase behobene Fall.
- Während des Rückgängig-Fensters eine *andere* Einnahme zu löschen lässt die
  erste kurz wieder auftauchen. Stammt aus `usePendingDeletion` (Phase 3) und
  beträfe Tagebuch und Arztbesuche gleichermaßen — dort zu beheben, nicht hier.
- Die Listen in Tagebuch und Arztbesuche enden mit `padding: tokens.spacing.lg`
  und schieben ihre letzte Karte damit unter den „+"-Knopf. Im
  Medikamente-Tab ist das mit `FAB_CLEARANCE` behoben; die Konstante steht
  jetzt in `src/components/ui/floatingActionButton.ts` und wartet dort auf die
  übrigen Listen.

**Nachtrag 2026-08-23 — Gerätetest.** Zählung, Zusammenfassungszeile und
Verlauf samt Rückgängig verhalten sich wie entworfen. Ein Layoutfehler kam
dabei ans Licht: Der Medikamente-Tab war eine feste Spalte, in der nur die
Medikamentenliste scrollte. Die aufgeklappte Vorsorge-Karte füllt den halben
Schirm, sodass für die Liste ein schmaler Streifen blieb; der zweite Link
(„Einnahme-Verlauf ansehen") machte es sichtbar, verursachte es aber nicht.
Behoben, indem die Vorsorge-Karte als `ListHeaderComponent` in die Liste
gewandert ist — der Tab ist jetzt ein einziger Scrollbereich. Der Leerzustand
ist dabei von einer vorzeitigen Rückgabe zu `ListEmptyComponent` geworden,
damit der Kopfbereich auch ohne ein einziges Medikament erreichbar bleibt.

Vier weitere Runden am Gerät folgten, alle Layout:
- Die PDF-Ausgabe scrollte weg und landete mitten im Bild; sie sitzt jetzt
  fest unter dem Titel, wie im Arztbesuche-Bildschirm.
- „Einnahme-Verlauf ansehen" saß als volle Leiste direkt unter der
  Vorsorge-Karte und las sich als deren letzte Zeile — beide auf derselben
  hellen Fläche. Jetzt ein Chip oben, wie „Auswertung" und „Arztbesuche" im
  Tagebuch.
- Im Tagebuch-Kalender waren die Zellen quadratisch (`aspectRatio: 1`), also
  rund 49dp hoch, während Zahl und Bewertungspunkt nur 27dp brauchen. Sechs
  Reihen kosteten fast 300dp und schnitten den ausgewählten Tag ab. Feste
  Zellenhöhe von 44dp plus knappere Abstände geben rund 90dp zurück.
- Der Community-Knopf ist aus dem Wissen-Tab in die Einstellungen gewandert,
  als eigener Abschnitt im Stil des Backup-Blocks.

**Die Zusammenfassungszeile ist wieder entfallen** (Entscheidung des Nutzers
nach dem Gerätetest): Die Karten zeigen den Zählstand ohnehin je Medikament,
der Verlauf zeigt ihn je Tag. Mit ihr fielen `buildTodaySummary`,
`formatTodaySummaryLabel` und sechs Tests — 538 statt 544. Damit ist von den
vier Entscheidungen des Entwurfs die dritte zurückgenommen; die Rechnung
selbst blieb unangetastet.

**Offen geblieben:** Sind weder ein Medikament noch ein Vorsorge-Termin
hinterlegt, füllt das aufgeklappte Vorsorge-Formular den Schirm so weit, dass
„Erstes Medikament anlegen" erst nach einem Stück Scrollen auftaucht. Betrifft
nur diesen einen Zustand. Drei Wege wurden dem Nutzer vorgelegt
(Vorsorge-Block nach unten, Formular einklappen, so lassen) und nicht
entschieden.

---

### Phase 5 — Arztbesuch vorbereiten

**Goal:** Vor einem Termin lässt sich mit einem Griff eine Zusammenfassung des
relevanten Zeitraums erzeugen, statt Tagebuch, Medikamente und Auswertung
einzeln durchzugehen.

**Success criteria:**
- Zu einem angelegten Arztbesuch lässt sich eine Zusammenfassung des Zeitraums seit dem letzten Besuch erzeugen
- Die Zusammenfassung enthält Verlauf, auffällige Muster und den Medikamentenstand
- Sie lässt sich als PDF teilen oder ausdrucken

**Depends on:** Phase 4 (der Medikamentenstand gehört in die Zusammenfassung)

**Stand am 2026-08-23:** Fünf Aufgaben umgesetzt, 632 Tests grün (vorher 538),
Typprüfung sauber. **Gerätedurchgang bestanden — die Phase ist abgeschlossen.**

**Nachtrag aus dem Gerätetest.** Ein Zeitraum von einem einzigen Tag brachte
vier Einzahl-Fehler ans Licht: „1 Tage", „An 1 von 1 Tagen wurde etwas
erfasst", „An 1 von 1 Tagen erfasst", und „1 Einnahmen" wäre gefolgt. Die
Einzahl war nur beim Blut-Zusatz behandelt. Keiner der 629 Tests traf den
Fall, weil in jedem Beispiel mehrere Tage standen — behoben in `3f81c0b` über
drei geteilte Zählwort-Funktionen (Nominativ, Dativ, Einnahmen) und drei neue
Tests. Dabei fällt ein Ein-Tages-Zeitraum jetzt nicht mehr als „23.08.2026 –
23.08.2026" aus, sondern nennt das Datum einmal.

Entwurf: `docs/superpowers/specs/2026-08-23-colitis-app-arztbesuch-vorbereiten-design.md`
Plan: `docs/superpowers/plans/2026-08-23-colitis-app-arztbesuch-vorbereiten.md`

**Die vier Entscheidungen des Entwurfs.** Der Zeitraum ergibt sich selbst —
jüngster erfasster Besuch bis heute, sonst die letzten 90 Tage; kein
Eingabefeld. Der Aufbau setzt die Zahlen nach oben. Es gibt einen Bildschirm
zum Lesen, nicht nur ein PDF: Das Ziel der Phase beschreibt jemanden, der sich
selbst einen Überblick verschafft, und dafür ist ein PDF am Handy der
umständlichste Weg. Und beim Medikamentenstand stehen **Einnahmetage und
Gesamtzahl statt „X von Y Dosen"** — siehe unten.

**Der Vorbehalt aus Phase 4 ist damit umschifft, nicht gelöst.** Die Rückschau
kennt für vergangene Tage nur den heutigen Zeitplan eines Medikaments; eine
Dosis-Sollmenge wäre rückwirkend erfunden. Das Dokument nennt deshalb „An 96
von 103 Tagen erfasst, 268 Einnahmen" — beide Zahlen sind unabhängig vom
Zeitplan wahr, weil sie zählen, was passiert ist, statt es gegen ein
unbekanntes Soll zu halten. Die klinische Frage „nimmt er es regelmäßig?" ist
damit beantwortet. **Die Historisierung der Zeitpläne bleibt als eigener
Vorschlag offen** (neue Tabelle, echter Schemawechsel); erst danach dürfte eine
Dosisgenauigkeit ins Dokument.

**Nebenbei aufgeräumt:** `formatDateKey`, `formatLocalDate`, `parseLocalDate`
und `addDays` lagen zeichengleich in drei Feature-Modulen. Sie liegen jetzt in
`src/lib/localDate.ts`; die beiden alten Namen bleiben als Weitergabe, ihre
rund zwanzig Aufrufer sind unangetastet. Ohne das wäre in dieser Phase die
vierte Kopie entstanden.

**Die Schlussdurchsicht fand einen kritischen Punkt**, behoben in `bf2cbf0`:
Beide Darstellungen prüften `endDate !== null` und schrieben dann „beendet am".
Der übrige Baum prüft `isMedicationActive`, also `endDate >= today` — ein
Enddatum in der Zukunft heißt aktiv, und das Formular lässt eines zu. Wer ein
Präparat mit geplantem Ausschleich-Ende einträgt, hätte es im
Medikamenten-Pass als aktiv und im Arztdokument als abgesetzt gesehen. Jetzt
entscheidet ein `hasEnded` im reinen Modul, und die Formulierung
unterscheidet „beendet am" von „geplantes Ende".

Dazu drei wichtige Punkte, alle behoben: Die Auslöser wurden nach dem
*gerundeten* Prozentwert sortiert und geschnitten — bei vielen Einträgen fiel
damit der häufigste aus den ersten dreien heraus. Zwei Zeilen wurden noch in
beiden Darstellungen getrennt formuliert, obwohl kein Test ein Auseinanderlaufen
bemerken kann. Und „Schmerz von 10" verschwieg, dass es ein Tagesmittel ist.

**Kleinere Befunde, bewusst offengelassen:**
- Der Bildschirm nennt kein Erstellungsdatum, das PDF schon; und bleibt der Bildschirm über Mitternacht offen, trägt das PDF ein Datum einen Tag nach dem Zeitraumende
- `buildVisitSummary` läuft viermal über dieselben Einträge, statt die Gruppierung einmal zu bauen und durchzureichen
- Einnahmen an Tagen außerhalb der Laufzeit eines Medikaments zählen nicht mit; das ist gewollt (sonst „an 12 von 10 Tagen"), steht aber nur als Kommentar

---

### Phase 6 — Mehrsprachigkeit *(zurückgestellt am 2026-08-23)*

**Goal:** Die App lässt sich auf Deutsch und Englisch bedienen.

**Success criteria:**
- Die Sprache lässt sich in den Einstellungen umschalten und bleibt über Neustarts erhalten
- Kein sichtbarer Text der App bleibt beim Umschalten auf Deutsch stehen
- Die Umschaltung wirkt sofort, ohne Neustart der App

**Depends on:** Phasen 1–5 (erfasst deren Texte in einem Durchgang mit)

**Entscheidung des Nutzers am 2026-08-23: zurückgestellt, die App bleibt auf
Deutsch.** Das Praktikum läuft bis zum 11.09., und in dieser Zeit kommen
voraussichtlich weitere Funktionen dazu. Mehrsprachigkeit ist ausgerechnet die
Phase, die jeden sichtbaren Text anfasst — jetzt umgesetzt, müsste sie nach
jeder neuen Idee nachgezogen werden. Sie gehört ans Ende eines stehenden
Funktionsumfangs oder gar nicht.

**Vorarbeit vorhanden:** Spec und Umsetzungsplan wurden am 2026-08-07
geschrieben und liegen unter
`docs/superpowers/specs/2026-08-07-colitis-app-mehrsprachigkeit-design.md` und
`docs/superpowers/plans/2026-08-07-colitis-app-mehrsprachigkeit.md`.

**Bestandsaufnahme am 2026-08-23**, falls die Phase später wieder aufgenommen
wird. Die Spezifikation trägt noch: Architektur (`LanguageContext` neben
`ThemeProvider`, eigene Dictionaries statt Bibliothek, `t()` mit Punktpfaden)
ist unberührt, und sie hat sich damals ausdrücklich geweigert, eine Dateiliste
festzuschreiben. **Der Plan ist veraltet** — 3845 Zeilen gegen den Codebestand
vom 7. August. Heute enthalten 56 Dateien deutschen Text, davon 22 reine Module.

Drei Fragen, die die alte Spezifikation nicht kennen konnte:
- **Die reinen Module bauen inzwischen ganze Sätze** (`visitSummary.ts`,
  `adherence.ts`, die drei PDF-Bauer). `t()` hängt am React-Kontext, den ein
  reines Modul nicht erreicht. Entweder bekommen die Module den Übersetzer als
  Parameter, oder sie liefern Bausteine und die Hüllen formulieren — beides mit
  Folgen für die teuer erkaufte Testbarkeit.
- **Pluralisierung steht in den Nicht-Zielen**, steckt aber seit `3f81c0b` im
  Code (`formatDayCount`, `formatDayCountDative`, `formatIntakeCount`).
- **Drei PDF-Dokumente entstehen komplett auf Deutsch.** Folgen sie der
  App-Sprache? Ein deutscher Patient mit englischer App sitzt trotzdem einem
  deutschen Arzt gegenüber.

---

## Abdeckungsprüfung

Alle am 2026-08-20 vorgeschlagenen Verbesserungen sind genau einer Phase zugeordnet:

| Vorschlag | Phase |
|---|---|
| Tägliche Erinnerung ans Eintragen | 1 |
| Bewertungsfarbe in der Tagebuch-Liste | 1 |
| Karten statt flacher Zeilen | 2 |
| Gestaltete Leerzustände | 2 |
| Ladeskelette | 2 |
| Wischen zum Löschen mit Rückgängig | 3 |
| Haptisches Feedback | 3 |
| Medikamenten-Einnahme abhaken | 4 |
| Arztbesuch-Vorbereitung | 5 |
| Mehrsprachigkeit | 6 |

Keine Phase ohne Vorschlag, kein Vorschlag ohne Phase.
