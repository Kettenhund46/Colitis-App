# Colitis2Go — Arztbesuch vorbereiten (Phase 5)

**Datum:** 2026-08-23
**Status:** entworfen

## Ziel

Vor einem Termin mit einem Griff eine Zusammenfassung des Zeitraums seit dem
letzten Besuch erzeugen, statt Tagebuch, Medikamente und Auswertung einzeln
durchzugehen. Lesbar am Gerät, teilbar als PDF.

## Ausgangslage

Gerechnet wird in dieser App schon viel; es fehlt das Zusammenfassen.
Vorhanden und wiederzuverwenden:

| Baustein | Datei | Liefert |
|---|---|---|
| `rateDayEntries` | `src/features/diary/calendarLogic.ts` | `'good' \| 'medium' \| 'bad'` je Tag |
| `groupEntriesByDay` | dieselbe | `Map<YYYY-MM-DD, Eintraege>` |
| `computeTriggerPatterns` | `src/features/diary/analysis.ts` | je Auslöser `entryCount` und `averagePainLevel` |
| `labelFor` / `TRIGGER_CATEGORY_OPTIONS` | `src/features/diary/constants.ts` | deutsche Beschriftung eines Auslösers |
| `listMedicationIntakes`, `intakesOnDate`, `localDateOf` | Phase 4 | Einnahmen und ihr lokaler Kalendertag |
| `isMedicationDueOn`, `expectedDosesPerDay` | `src/features/medications/adherence.ts` | Laufzeit und Sollmenge |
| `listDoctorVisits` | `src/features/doctorVisits/db/doctorVisitsRepository.ts` | Besuche, **absteigend nach `visitDate`** |
| `exportDoctorVisitPass` | `src/features/doctorVisits/doctorVisitPassExport.ts` | Muster für Drucken und Teilen |

Es gibt bereits drei PDF-Ausgaben (Tagebuch, Medikamenten-Pass,
Arztbesuch-Übersicht). Diese Phase fügt eine vierte hinzu — bewusst, weil sie
etwas anderes zeigt als die drei: nicht eine Liste, sondern einen Zeitraum.

## Entscheidungen

### 1 · Einstieg und Zeitraum

In der Arztbesuche-Liste, direkt unter der vorhandenen PDF-Leiste, ein zweiter
Eintrag: **„Für den nächsten Termin vorbereiten"**. Ein Tipp, keine Eingabe.

Der Zeitraum ergibt sich selbst:

- Gibt es erfasste Besuche, beginnt er am **`visitDate` des jüngsten** und endet
  **heute**. `listDoctorVisits` sortiert bereits absteigend, der jüngste ist
  also `visits[0]`.
- Gibt es keinen, sind es die **letzten 90 Tage** einschließlich heute.
- Liegt das jüngste `visitDate` in der Zukunft (ein vorab eingetragener
  Termin), zählt es nicht als Beginn; dann gilt der nächstältere Besuch,
  sonst die 90-Tage-Regel.

Der Kopf nennt beides: `12.05.2026 – 23.08.2026 · 103 Tage seit dem Besuch bei
Dr. Weber` bzw. `· letzte 90 Tage`.

**Die Zusammenfassung wird nicht gespeichert.** Sie wird bei jedem Öffnen frisch
gerechnet — sonst gäbe es zwei Wahrheiten in der App, und die ältere wäre die
falsche.

### 2 · Aufbau: Zahlen zuerst

Sechs Blöcke, in dieser Reihenfolge:

**a) Vier Kennzahlen**, groß gesetzt:

| Kennzahl | Definition |
|---|---|
| Stühle pro Tag | Summe `stoolFrequency` ÷ Anzahl **Tage mit Eintrag**, auf eine Nachkommastelle |
| Tage mit Blut | Anzahl Tage, an denen mindestens ein Eintrag `hasBlood` trägt |
| Schmerz im Mittel | Mittel des **höchsten** `painLevel` je Tag, über Tage mit Eintrag, eine Nachkommastelle |
| Erfasst | `Tage mit Eintrag` von `Tage im Zeitraum` |

Die Mittelwerte beziehen sich auf **Tage mit Eintrag**, nicht auf Kalendertage.
Sonst drückt jede Erfassungslücke den Schnitt und täuscht Besserung vor.

**b) Tagesbewertung** als Aufzählung: `71 gut · 18 mittel · 7 schub-verdächtig`.
Aus `rateDayEntries`, keine zweite Rechnung.

**c) Auffällige Phasen** — Definition in Abschnitt 3.

**d) Häufigste Auslöser**, absteigend, höchstens drei:
`Stress (61 %) · Schlaf (38 %) · Sonstiges (22 %)`. Der Prozentwert ist
`entryCount ÷ Anzahl Einträge im Zeitraum`, gerundet auf ganze Prozent.
Beschriftung über `labelFor(TRIGGER_CATEGORY_OPTIONS, …)`.

**e) Medikamentenstand.** Je Medikament, das im Zeitraum lief: Name, Dosis,
Zeitplan, Beginn. Dazu `An 96 von 103 Tagen erfasst, 268 Einnahmen`. Beendete
Präparate erscheinen abgesetzt mit ihrem Enddatum.

Bewusst **kein** „X von Y Dosen": Die Rückschau kennt für vergangene Tage nur
den *heutigen* Zeitplan (siehe Phase 4 im Fahrplan). Einnahmetage und
Gesamtzahl sind unabhängig davon wahr, weil sie zählen, was passiert ist,
statt es gegen ein unbekanntes Soll zu halten.

**f) Nächster Vorsorge-Termin**, eine Zeile, falls hinterlegt:
`Nächste Vorsorge-Koloskopie: 15.01.2027`.

Dazu eine **Fußzeile**: Erstellungsdatum und der Satz
`Die Angaben stammen aus einem selbstgeführten Tagebuch.`

### 3 · Was „auffällige Phase" heißt

Eine Phase ist eine zusammenhängende Strecke von **mindestens drei Tagen**, an
denen die Tagesbewertung `medium` oder `bad` war.

Ein Tag **ohne Eintrag unterbricht die Strecke nicht** — sonst zerfiele jede
Phase an dem einen Tag, an dem nichts eingetragen wurde. Ein Tag mit
Bewertung `good` unterbricht sie. Tage ohne Eintrag zählen nicht zur
Mindestlänge und nicht in die genannten Zahlen; eine Strecke darf weder mit
einem solchen Tag beginnen noch enden.

Genannt werden höchstens **zwei**, ausgewählt nach der Anzahl betroffener Tage
(`affectedDays`) absteigend; bei Gleichstand die jüngere zuerst. Ausgegeben
werden sie in zeitlicher Reihenfolge, älteste zuerst. Je mit Zeitraum und
Zählung:

> 3. – 14. Juli: an 8 von 12 Tagen mittel oder schub-verdächtig, an 6 Tagen
> Blut vermerkt.

Beschreibend, ohne Ursachen und ohne Wertung. Gibt es keine solche Strecke,
steht dort `Keine zusammenhängende auffällige Phase.`

### 4 · Wenn wenig Daten da sind

Ein Mittelwert aus vier Einträgen über drei Monate ist keine Aussage, sondern
eine irreführende Zahl.

- **Weniger als sieben Tage mit Eintrag** im Zeitraum: Kennzahlen,
  Tagesbewertung, Phasen und Auslöser entfallen. Stattdessen steht dort
  `An 4 von 103 Tagen wurde etwas erfasst — zu wenig für eine Auswertung des
  Zeitraums.` Der Medikamentenstand bleibt, er hängt nicht am Tagebuch.
  In der Datenstruktur heißt das: `figures` ist `null`, und `phases` sowie
  `triggers` sind leer. Die drei hängen zusammen — es gibt keinen Zustand, in
  dem `figures` null ist und trotzdem Phasen genannt werden.
- **Kein Eintrag und kein Medikament** im Zeitraum: Der Bildschirm zeigt einen
  `EmptyState` statt eines leeren Dokuments, und das Teilen ist abgeschaltet.

### 5 · Bildschirm und PDF

Ein neuer Bildschirm `tagebuch/arztbesuche/zusammenfassung`, registriert in
`app/(tabs)/tagebuch/_layout.tsx` mit dem Titel `Zusammenfassung`. Er zeigt
dieselben sechs Blöcke und trägt oben einen Knopf **„Als PDF teilen"**.

Das PDF entsteht aus **derselben** `VisitSummary` über einen eigenen
HTML-Bauer, wie es `doctorVisitPassBuilder` und `medicationPassBuilder`
vormachen. Geteilt wird über den vorhandenen Weg aus `expo-print` und
`expo-sharing`.

## Architektur

Vitest läuft mit `environment: 'node'`. Komponenten lassen sich nicht rendern
und damit nicht testen. Wie in den Phasen 2 bis 4 gilt: Jede Entscheidung
wandert in ein reines Modul, die Komponenten bleiben dünne Hüllen.

### Reines Modul — der Prüfgegenstand

`src/features/doctorVisits/visitSummary.ts`

```ts
export interface SummaryPeriod {
  fromDate: string;          // YYYY-MM-DD, lokal
  toDate: string;            // YYYY-MM-DD, lokal (heute)
  /** Kalendertage einschliesslich beider Enden. */
  dayCount: number;
  /**
   * Woran der Zeitraum anschliesst, fertig formuliert:
   * "seit dem Besuch bei Dr. Weber", wenn ein Arztname hinterlegt ist;
   * "seit dem Besuch am 12.05.2026", wenn nicht;
   * null bei der 90-Tage-Regel -- dann nennt der Kopf "letzte 90 Tage".
   */
  sinceVisitLabel: string | null;
}

export interface SummaryFigures {
  stoolsPerDay: number;
  daysWithBlood: number;
  averagePainLevel: number;
  goodDays: number;
  mediumDays: number;
  badDays: number;
}

export interface NotablePhase {
  /** Erster und letzter *betroffener* Tag -- eine Strecke beginnt und endet nie
   *  auf einem nicht erfassten Tag. */
  fromDate: string;
  toDate: string;
  /** Kalendertage von fromDate bis toDate, beide eingeschlossen. */
  spanDays: number;
  /** Davon Tage mit Bewertung medium oder bad. Der Rest wurde nicht erfasst. */
  affectedDays: number;
  daysWithBlood: number;
}

export interface TriggerShare {
  label: string;
  percent: number;
}

export interface MedicationSummaryLine {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  /** Tage des Zeitraums, an denen das Medikament lief. Nenner der Angabe. */
  dueDays: number;
  daysWithIntake: number;
  totalIntakes: number;
}

export interface VisitSummary {
  period: SummaryPeriod;
  /** Auch dann gesetzt, wenn figures null ist -- der Hinweis nennt die Zahl. */
  daysWithEntries: number;
  /** null, wenn weniger als sieben Tage mit Eintrag vorliegen. */
  figures: SummaryFigures | null;
  phases: NotablePhase[];
  triggers: TriggerShare[];
  medications: MedicationSummaryLine[];
  nextScreeningDate: string | null;
  isEmpty: boolean;          // kein Eintrag und kein Medikament im Zeitraum
}
```

Funktionen:

- `determinePeriod(visits, today)` → `SummaryPeriod`
- `computeFigures(entriesByDay, period)` → `SummaryFigures | null`
- `findNotablePhases(entriesByDay, period)` → `NotablePhase[]`
- `computeTriggerShares(entriesInPeriod)` → `TriggerShare[]`
- `buildMedicationLines(medications, intakes, period)` → `MedicationSummaryLine[]`
- `buildVisitSummary(entries, medications, intakes, visits, screening, today)` →
  `VisitSummary`
- Beschriftungen, jede eine Zeichenkette: `formatPeriodLabel`,
  `formatRatingLabel` (`71 gut · 18 mittel · 7 schub-verdächtig`),
  `formatPhaseLabel`, `formatMedicationIntakeLabel`
  (`An 96 von 103 Tagen erfasst, 268 Einnahmen`), `formatSparseDataLabel`

Datumsrechnung ausschließlich über lokale Kalendertage, wie in Phase 4
festgelegt.

### Datenzugriff

Keine neuen Repository-Funktionen. Der Bildschirm liest mit den vorhandenen:
`listDiaryEntries`, `listMedications`, `listMedicationIntakes`,
`listDoctorVisits`, `getScreeningReminder`.

### Hüllen

- `app/(tabs)/tagebuch/arztbesuche/zusammenfassung.tsx` — lädt, ruft
  `buildVisitSummary`, zeigt die Blöcke, teilt.
- `src/features/doctorVisits/components/VisitSummaryView.tsx` — die Darstellung,
  damit der Bildschirm klein bleibt.
- `src/features/doctorVisits/visitSummaryPdfBuilder.ts` — dieselbe
  `VisitSummary` nach HTML.
- `src/features/doctorVisits/visitSummaryExport.ts` — drucken und teilen, nach
  dem Muster von `doctorVisitPassExport.ts`.
- `app/(tabs)/tagebuch/arztbesuche/index.tsx` — der neue Einstiegsknopf.
- `app/(tabs)/tagebuch/_layout.tsx` — die neue Route.

## Fehlerbehandlung

Wie im übrigen Projekt: `console.error` mit Präfix in eckigen Klammern plus
Fehlerstreifen für den Nutzer (`Zusammenfassung konnte nicht geladen werden.`,
`PDF konnte nicht erstellt werden.`). Kein stilles Schlucken.

## Was ausdrücklich nicht dazugehört

- Kein Schemawechsel, keine Migration, keine Änderung an der Sicherung.
- Keine Speicherung der Zusammenfassung.
- Keine Historisierung der Medikamenten-Zeitpläne — bleibt als eigener
  Vorschlag im Fahrplan.
- Keine Deutung der Daten: keine Ursachen, keine Empfehlungen, keine Prognosen.
- Keine Änderung an den drei vorhandenen PDF-Ausgaben.
- Keine Auswahl des Zeitraums von Hand.

## Erfolgskriterien

1. Ein Tipp in der Arztbesuche-Liste erzeugt eine Zusammenfassung des
   Zeitraums seit dem jüngsten erfassten Besuch; ohne erfassten Besuch der
   letzten 90 Tage.
2. Sie enthält Kennzahlen, Tagesbewertung, auffällige Phasen, Auslöser und den
   Medikamentenstand.
3. Sie lässt sich vom Bildschirm aus als PDF teilen.
4. Bei weniger als sieben Tagen mit Eintrag erscheinen keine Mittelwerte,
   sondern der Hinweis, dass der Zeitraum zu dünn ist.
5. Eine Erfassungslücke von einem Tag zerreißt eine auffällige Phase nicht.
