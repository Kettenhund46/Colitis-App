# Colitis2Go – Design: Tägliche Erinnerung und Schweregrad in der Tagebuch-Liste

*Status: Vom Nutzer (Adrian) genehmigt am 2026-08-20*
*Fahrplan: Phase 1 von 6 aus `.planning/ROADMAP.md`*

## Kontext & Ziel

Ein Symptomtagebuch nützt nur, wenn es geführt wird — daran scheitern solche Apps
üblicherweise nach einigen Wochen. Diese Phase ergänzt deshalb eine tägliche
Erinnerung ans Eintragen.

Zugleich wird eine bereits vorhandene, aber ungenutzte Information sichtbar
gemacht: Die App bewertet jeden Tag als gut, mittel oder schub-verdächtig, zeigt
das aber nur im Kalender. Beim Durchscrollen der Liste sieht ein Tag mit Blut
aus wie ein beschwerdefreier.

## Ausgangsbefund

**Der wiederkehrende Tagestrigger lässt sich nicht teilweise abbestellen.**
`scheduleDailyReminder` nutzt `SchedulableTriggerInputTypes.DAILY`. Das
Betriebssystem feuert die Serie zuverlässig auch ohne laufende App, aber
`cancelScheduledNotificationAsync` löscht immer die gesamte Serie — eine einzelne
Wiederholung zu überspringen ist nicht vorgesehen. Die naheliegende Anforderung
„nicht erinnern, wenn heute schon erfasst wurde" ist damit nicht ohne Weiteres
umsetzbar. Der Ausweg wären einzelne Termin-Benachrichtigungen für einen
begrenzten Vorrat an Tagen, der beim Öffnen der App aufgefüllt wird; dann würden
die Erinnerungen aber ausgerechnet dann verstummen, wenn die App länger nicht
geöffnet wird. **Entscheidung des Nutzers:** Es wird immer erinnert, mit neutralem
Text. Ein zweiter Eintrag am Abend ist bei Colitis ohnehin häufig angebracht.

**Die Bewertung gilt seit dem 27.07. dem Tag, nicht dem Eintrag.**
`rateDayEntries` rechnet die Häufigkeiten aller Einträge eines Tages zusammen und
nimmt den höchsten Schmerzwert. Eine Kennzeichnung pro Eintrag würde deshalb bei
geteilten Tagen der Kalenderfarbe widersprechen.

**Die Formensprache für Bewertungen existiert bereits.** `DiaryCalendarView.tsx`
unterscheidet nicht allein über Farbe, sondern über Formen: Kreis, Quadrat,
Dreieck. Sie steckt dort fest und ist nicht wiederverwendbar.

**Uhrzeiten werden in dieser App als Text im Format `HH:MM` erfasst** und mit
`isValidReminderTime` aus `src/features/medications/reminderScheduling.ts`
geprüft. Ein zweites Eingabemuster käme nicht in Frage.

## 1. Die Erinnerung

### Einstellungen

Neue Schlüssel in `src/features/settings/settingsStorage.ts`, nach dem dort
etablierten `get.../set...`-Muster:

| Schlüssel | Typ | Vorgabe |
|---|---|---|
| `colitis2go.settings.diaryReminderEnabled` | Boolean | `false` |
| `colitis2go.settings.diaryReminderTime` | `HH:MM`-Zeichenkette | `'20:00'` |
| `colitis2go.settings.diaryReminderNotificationId` | Zeichenkette oder `null` | `null` |

Ausgeschaltet als Vorgabe, weil eine Benachrichtigungsberechtigung daran hängt.
20:00 Uhr, weil der Tag dann gelaufen ist.

### Planung

Neue Datei `src/features/diary/scheduleDiaryReminder.ts`, gebaut nach dem Vorbild
`src/features/backup/scheduleBackupReminder.ts`:

```typescript
export async function rescheduleDiaryReminder(): Promise<void>
```

Ablauf:

1. Gespeicherte Kennung lesen; ist eine vorhanden, die Erinnerung über
   `cancelScheduledReminder` abbestellen
2. Ist die Erinnerung ausgeschaltet: Kennung auf `null` setzen, fertig
3. Sonst die gespeicherte Uhrzeit lesen und über das vorhandene
   `scheduleDailyReminder(zeit, inhalt)` neu planen
4. Die zurückgegebene Kennung speichern

Aufgerufen wird die Funktion an drei Stellen: beim Umlegen des Schalters, beim
Übernehmen einer geänderten Uhrzeit und beim App-Start. Der Aufruf beim Start
sorgt dafür, dass die Erinnerung eine Wiederherstellung aus einer Sicherung
übersteht.

### Inhalt der Benachrichtigung

Titel „Wie war dein Tag?", Text „Kurz im Tagebuch festhalten."

Bewusst neutral gehalten: Die Erinnerung erscheint auch, wenn bereits erfasst
wurde, und darf dann nicht wie ein Vorwurf klingen.

### Bedienoberfläche

Im Einstellungen-Tab ein eigener Block, in der Form des vorhandenen
Backup-Erinnerungs-Blocks:

- Schalter „Tägliche Erinnerung ans Eintragen"
- Bei eingeschaltetem Zustand darunter ein Textfeld für die Uhrzeit im Format
  `HH:MM`, geprüft mit `isValidReminderTime`

### Fehlerbehandlung

- **Berechtigung verweigert:** Beim Einschalten wird
  `requestNotificationPermission()` aufgerufen. Bei Verweigerung bleibt der
  Schalter aus und es erscheint der Hinweis, dass die Erinnerung ohne
  Benachrichtigungsberechtigung nicht möglich ist. Ein Schalter, der eingeschaltet
  aussieht, aber nichts bewirkt, wäre schlimmer als keiner.
- **Ungültige Uhrzeit:** Es wird nichts umgeplant, eine Fehlermeldung erscheint,
  und die bisherige Erinnerung bleibt unangetastet. Ein Zahlendreher darf nicht
  dazu führen, dass die Erinnerung stillschweigend verschwindet.
- **Planung scheitert:** Die gespeicherte Kennung wird auf `null` gesetzt, statt
  eine tote Kennung zu behalten, und der Schalter fällt sichtbar auf aus zurück.

## 2. Die Schweregrad-Kennzeichnung

### Gemeinsame Formensprache

Neue Datei `src/features/diary/components/RatingIndicator.tsx`. Sie übernimmt
unverändert, was heute in `DiaryCalendarView.tsx` steht:

- `RATING_LABELS: Record<DayRating, string>` mit den Werten `gut`, `mittel`,
  `schub-verdächtig`
- eine Komponente `RatingIndicator`, die je nach Bewertung Kreis (grün),
  Quadrat (gelb) oder Dreieck (rot) darstellt

`DiaryCalendarView.tsx` nutzt danach diese Komponente. Sein sichtbares Verhalten
ändert sich dabei nicht — dieselben Formen, dieselben Farben, nur an einer Stelle
definiert statt in einer Datei eingeschlossen.

### Zuordnung Tag zu Bewertung

Neue reine Funktion in `src/features/diary/calendarLogic.ts`:

```typescript
export function buildDayRatings(entries: DiaryEntryWithTriggers[]): Map<string, DayRating>
```

Sie stützt sich auf die dort vorhandenen `groupEntriesByDay` und
`rateDayEntries`. Es entsteht keine zweite Bewertungslogik, nur eine
Nachschlagetabelle mit demselben Datumsschlüssel, den `formatDateKey` liefert.

Die Liste berechnet sie einmal je Datenstand und schlägt pro Zeile nach, statt
für jede Zeile erneut über alle Einträge zu laufen.

### Darstellung in der Liste

In `src/features/diary/components/DiaryHistoryList.tsx` rückt die vorhandene
Datumszeile in eine waagerechte Reihe: links das Datum wie bisher, rechts davon
der `RatingIndicator` des Tages und unmittelbar daneben der Text „Tag: gut",
„Tag: mittel" beziehungsweise „Tag: schub-verdächtig". Die Kennzeichnung steht
damit auf derselben Höhe wie das Datum, auf das sie sich bezieht.

Das vorangestellte Wort „Tag" ist wesentlich: Es macht unmissverständlich, dass
sich die Kennzeichnung auf den ganzen Tag bezieht und nicht auf diese eine Zeile.
Ohne es sähe ein harmloser Eintrag an einem schweren Tag wie ein Fehler aus.

Die `accessibilityLabel` der Zeile wird um die Bewertung ergänzt, damit die
Information nicht nur sehend zugänglich ist — dasselbe Prinzip, das der Kalender
bereits verfolgt.

Sonst ändert sich an der Zeile nichts: Karte, Angaben und Löschen-Knopf bleiben
unverändert. Das Umgestalten der Liste ist Phase 2.

## 3. Testansatz

### Automatisiert

**`buildDayRatings` in `calendarLogic.test.ts`:** leere Liste; ein Tag mit einem
Eintrag; ein auf zwei Einträge geteilter Tag, der die zusammengerechnete
Bewertung liefern muss und nicht die eines einzelnen Eintrags; mehrere Tage
nebeneinander. Der geteilte Tag ist der wichtigste Fall — an ihm hängt, dass
Liste und Kalender dasselbe aussagen.

**Die drei neuen Einstellungen in `settingsStorage.test.ts`:** Vorgabewert ohne
gespeicherten Wert, Speichern und erneutes Lesen.

### Nicht automatisiert

`rescheduleDiaryReminder` greift auf Benachrichtigungen und den Gerätespeicher
zu, beides im Testlauf nicht nachgebildet. Die Funktion folgt damit demselben
Muster wie `scheduleBackupReminder.ts`, das ebenfalls nur in seinem reinen
Rechenteil getestet ist. Ebenso wenig automatisiert prüfbar sind die
Einstellungsoberfläche und die Darstellung des `RatingIndicator`.

Der Erinnerungsteil dieser Phase ruht damit auf dem Gerätetest, nicht auf der
Testsuite. Absicherung im Übrigen über `tsc --noEmit` und den vollständigen
Testlauf, der nachweist, dass nichts Bestehendes bricht.

### Manueller Durchgang

1. Schalter einschalten, Berechtigung erteilen — Erinnerung erscheint zur eingestellten Zeit
2. Berechtigung verweigern — Schalter bleibt aus, Hinweis erscheint
3. Ungültige Uhrzeit eingeben — Fehlermeldung, die vorherige Erinnerung läuft weiter
4. Schalter ausschalten — keine Erinnerung mehr
5. App beenden und neu starten — Einstellung und Erinnerung bestehen weiter
6. Ein Tag mit einem harmlosen und einem schweren Eintrag — beide Zeilen tragen dieselbe Kennzeichnung, und sie stimmt mit der Farbe desselben Tages im Kalender überein
7. Alle drei Themes — die Formen sind in jedem erkennbar

## Erfolgskriterien der Phase

Aus `.planning/ROADMAP.md`, Phase 1:

- Eine tägliche Erinnerung erscheint zur selbst gewählten Uhrzeit und lässt sich in den Einstellungen ein- und ausschalten
- Jeder Eintrag in der Tagebuch-Liste trägt eine sichtbare Kennzeichnung seines Schweregrads, die nicht allein auf Farbe beruht
- Die Kennzeichnung stimmt mit der Bewertung überein, die derselbe Tag im Kalender erhält

Das ursprünglich dort notierte Kriterium „Wer heute bereits etwas erfasst hat,
wird nicht mehr erinnert" entfällt aufgrund der oben begründeten Entscheidung.
Der Fahrplan ist entsprechend anzupassen.

## Explizit nicht Teil dieser Phase

- Keine Änderung an der Bewertungslogik selbst. `rateDiaryEntry`, `rateDayEntries`, `sumDayTotals` und `rateDayTotals` bleiben unverändert.
- Kein Umgestalten der Listenzeile über die Ergänzung der Kennzeichnung hinaus — das ist Phase 2.
- Keine Gruppierung der Liste nach Tagen. Wurde erwogen und verworfen: ehrlicher, aber ein deutlich größerer Umbau, der zu Phase 2 gehört.
- Keine Erinnerung, die erfasste Tage überspringt. Begründung im Ausgangsbefund.
- Keine neuen npm-Abhängigkeiten.

---

*Hinweis: Die Kennzeichnung macht eine bereits vorhandene Bewertung sichtbar, sie
führt keine neue medizinische Einstufung ein. Die App stellt keine Diagnose und
ersetzt keine ärztliche Beurteilung.*
