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
| 1 | Ans Eintragen erinnert werden und den Schweregrad beim Scrollen sehen | todo |
| 2 | Die App sieht nach Gestaltung aus, nicht nach Formular | todo |
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
- Wer heute bereits etwas erfasst hat, wird nicht mehr erinnert
- Jeder Eintrag in der Tagebuch-Liste trägt eine sichtbare Kennzeichnung seines Schweregrads, die nicht allein auf Farbe beruht
- Die Kennzeichnung stimmt mit der Bewertung überein, die derselbe Tag im Kalender erhält

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
