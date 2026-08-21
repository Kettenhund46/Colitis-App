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
| 1 | Ans Eintragen erinnert werden und den Schweregrad beim Scrollen sehen | in_progress |
| 2 | Die App sieht nach Gestaltung aus, nicht nach Formular | in_progress |
| 3 | Löschen geht per Wischen und die Bedienung fühlt sich spürbar an | todo |
| 4 | Medikamenteneinnahme lässt sich abhaken und nachvollziehen | todo |
| 5 | Ein Arzttermin lässt sich mit einer Zusammenfassung vorbereiten | todo |
| 6 | Die App ist auf Deutsch und Englisch bedienbar | todo |

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

---

### Phase 4 — Medikamenteneinnahme abhaken

**Goal:** Der Medikamente-Tab wird vom Nachschlagewerk zum Werkzeug: Einnahmen
lassen sich festhalten und im Rückblick nachvollziehen.

**Success criteria:**
- Für jedes aktive Medikament lässt sich die heutige Einnahme mit einem Tipp festhalten
- Der Tab zeigt auf einen Blick, was heute noch offen ist
- Vergangene Einnahmen und Lücken sind für einen wählbaren Zeitraum einsehbar
- Die Einnahmedaten sind in Sicherung und Wiederherstellung enthalten

**Depends on:** Phase 2 (folgt der dort festgelegten Gestaltungssprache)

**Achtung, diese Phase ist teilweise schon gebaut.** Beim Lesen von
`MedicationList.tsx` in Phase 2 fiel auf, dass es dort bereits einen Knopf
„Heute genommen ✓" mit `takenTodayIds` und `onTakenToday` gibt. Vor dem
Entwurf dieser Phase ist zu klären, was davon schon steht und welche der vier
Erfolgskriterien damit bereits erfüllt sind — sonst wird hier etwas zum
zweiten Mal gebaut.

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

---

### Phase 6 — Mehrsprachigkeit

**Goal:** Die App lässt sich auf Deutsch und Englisch bedienen.

**Success criteria:**
- Die Sprache lässt sich in den Einstellungen umschalten und bleibt über Neustarts erhalten
- Kein sichtbarer Text der App bleibt beim Umschalten auf Deutsch stehen
- Die Umschaltung wirkt sofort, ohne Neustart der App

**Depends on:** Phasen 1–5 (erfasst deren Texte in einem Durchgang mit)

**Vorarbeit vorhanden:** Spec und Umsetzungsplan wurden am 2026-08-07 geschrieben
und liegen unter `docs/superpowers/specs/2026-08-07-colitis-app-mehrsprachigkeit-design.md`
und `docs/superpowers/plans/2026-08-07-colitis-app-mehrsprachigkeit.md`. Beide
müssen vor der Umsetzung gegen den dann aktuellen Stand geprüft werden — sie
kennen weder die Texte aus den Phasen 1 bis 5 noch den Schnell-Eintrag.

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
