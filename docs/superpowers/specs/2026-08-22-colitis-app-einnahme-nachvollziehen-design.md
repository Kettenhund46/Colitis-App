# Colitis2Go — Einnahme nachvollziehen (Phase 4)

**Datum:** 2026-08-22
**Status:** entworfen

## Ziel

Aus dem heutigen Haken „genommen" wird eine Zählung, und aus der Zählung eine
Rückschau: Was ist heute noch offen, und was wurde in den vergangenen Wochen
versäumt? Das Ergebnis ist eine Zahl, die man dem Arzt zeigen kann.

## Ausgangslage

Erfassen und Sichern bestehen bereits:

- `medication_log` speichert je Abhaken eine Zeile mit `medicationId` und
  `takenAt` (ISO-Zeitstempel). **Kein Schemawechsel nötig.**
- `backupRepository` führt `medicationLog` in Export, Löschen und
  Wiederherstellen bereits vollständig.

Zwei Eigenschaften des heutigen Stands stehen dem Ziel im Weg:

1. `listMedicationIdsTakenOn` faltet die Zeilen eines Tages mit
   `[...new Set(...)]` zu einer Menge zusammen. Die Erfassung ist damit
   **binär je Medikament und Tag**: Der Knopf schaltet nach dem ersten Tippen
   ab, ein dreimal täglich einzunehmendes Medikament liest sich nach der
   ersten Dosis den ganzen Tag als erledigt.
2. Dieselbe Abfrage vergleicht mit `like('${date}%')` ein **lokales** Datum
   gegen einen **UTC**-Zeitstempel. In deutscher Sommerzeit fällt eine
   Einnahme um 01:30 Uhr auf den Vortag. Solange der Haken binär war, fiel das
   kaum auf; sobald daraus eine Zahl für den Arzt wird, ist es eine falsche
   Zahl. Diese Phase behebt es.

`Medication.schedule` ist Freitext und trägt keine maschinenlesbare Struktur.
Das einzige strukturierte Signal für die Tagesfrequenz sind die
`reminderTimes`.

## Entscheidungen

### 1 · Was „fällig" heißt

An einem Tag sind so viele Einnahmen fällig, wie das Medikament
Erinnerungszeiten hat, **mindestens aber eine**. Ein Medikament ohne
hinterlegte Zeit zählt einmal täglich und verhält sich damit exakt wie bisher.

Ein Tag zählt nur, wenn das Medikament an ihm lief: nicht vor `startDate`,
nicht nach `endDate`. Ein am 8. August beendetes Präparat taucht im
30-Tage-Rückblick mit 16 fälligen Tagen auf, nicht mit 30.

### 2 · Der Knopf zählt

Statt nach dem ersten Tippen abzuschalten, zählt der Knopf hoch:

| Zustand | Beschriftung |
|---|---|
| eine Dosis fällig, noch nicht genommen | `Heute genommen` |
| mehrere fällig, `n` von `m` genommen | `Heute genommen (n von m)` |
| alle genommen | `Heute genommen ✓` (abgeschaltet) |

### 3 · Die Zusammenfassungszeile

Über der Medikamentenliste steht eine Zeile:

- offen: `Heute noch offen: Mesalazin (2), Azathioprin`
- vollständig: `Heute ist alles genommen`
- kein aktives Medikament: keine Zeile

Die Zahl in Klammern erscheint nur, wenn mehr als eine Dosis fehlt.
Beendete Medikamente kommen nicht vor.

### 4 · Der Verlauf

Ein eigener Bildschirm `medikamente/verlauf`, erreichbar über einen Knopf im
Medikamenten-Tab.

- Oben die Zeitraumwahl: **30 Tage · 90 Tage · Alles**. „Alles" beginnt beim
  frühesten `startDate` aller Medikamente.
- Darunter ein Tag je Zeile, **neueste zuerst**:
  `Do 21.08. — alles genommen` bzw.
  `Mi 20.08. — Mesalazin: 2 von 3 · Azathioprin: 0 von 1`.
- Genannt wird nur, was fehlte.
- Tage, an denen **kein** Medikament fällig war, entfallen ganz.
- Tage in der Zukunft entfallen; der heutige Tag ist enthalten.

### 5 · Korrektur eines Fehlgriffs

Ein Tipp auf eine Tageszeile klappt sie auf und zeigt die einzelnen Einnahmen
mit Uhrzeit (`Mesalazin — 08:12`). Jede trägt einen Löschen-Knopf. Gelöscht
wird über denselben Weg wie überall seit Phase 3: **kein Dialog**, sondern der
`UndoBar` mit acht Sekunden Rückgängig (`usePendingDeletion`).

Keine Wischgeste auf diesen Unterzeilen — sie sind keine Karten, und der
Knopf genügt.

## Architektur

Vitest läuft in dieser App mit `environment: 'node'`. Komponenten lassen sich
nicht rendern und damit **überhaupt nicht** testen. Wie in Phase 2 und 3 gilt
deshalb: Jede Entscheidung wandert in ein reines Modul, die Komponenten
bleiben dünne Hüllen.

### Reines Modul — der Prüfgegenstand

`src/features/medications/adherence.ts`

```ts
export interface MedicationIntake {
  id: number;            // Zeilen-ID aus medication_log
  medicationId: number;
  takenAt: string;       // ISO-Zeitstempel (UTC)
}

export interface MedicationDayStatus {
  medicationId: number;
  name: string;
  expected: number;
  taken: number;
}

export interface DaySummary {
  date: string;                        // YYYY-MM-DD, lokal
  medications: MedicationDayStatus[];  // nur an diesem Tag fällige
  intakes: MedicationIntake[];         // die tatsächlichen Zeilen des Tages
  isComplete: boolean;
}

export interface TodaySummary {
  open: { medicationId: number; name: string; missing: number }[];
  hasActiveMedications: boolean;
}
```

Funktionen:

- `expectedDosesPerDay(medication)` → `Math.max(1, reminderTimes.length)`
- `isMedicationDueOn(medication, date)` → Laufzeitprüfung gegen
  `startDate`/`endDate`
- `localDateOf(takenAt)` → lokales Kalenderdatum eines UTC-Zeitstempels.
  **Hier wird der Zeitzonenfehler behoben.**
- `countTakenPerMedication(intakes, date)` → Zählstände eines Tages
- `buildDaySummaries(medications, intakes, fromDate, toDate)` → Tage
  absteigend, ohne Tage ohne Fälligkeit
- `buildTodaySummary(medications, intakes, today)`
- `formatTodaySummaryLabel(summary)`
- `formatDaySummaryLabel(summary)`
- `formatDayHeading(date)` → `Mi 20.08.`
- `formatIntakeTime(date)` → `08:12`
- `formatTakenButtonLabel(taken, expected)`
- `periodStartDate(period, medications, today)` → Anfangsdatum für
  `'30' | '90' | 'alles'`

Datumsrechnung ausschließlich über lokale Kalenderdaten (`new Date(y, m-1, d)`),
nie über `Date.parse` eines reinen Datumsstrings — der wäre UTC.

### Datenzugriff

`src/features/medications/db/medicationsRepository.ts`

- **neu** `listMedicationIntakes(db, fromIsoInclusive: string | null)` —
  liefert `MedicationIntake[]` (mit Zeilen-ID), aufsteigend nach `takenAt`.
  Die Untergrenze wird um einen Tag nach hinten erweitert, damit die
  Umrechnung in lokale Tage am Rand nichts verliert.
- **neu** `deleteMedicationIntake(db, intakeId)` — löscht eine Protokollzeile.
- **entfällt** `listMedicationIdsTakenOn` samt Tests. Einziger Aufrufer ist der
  Medikamenten-Tab, der auf den neuen Weg wechselt; die Funktion trägt zudem
  beide oben beschriebenen Fehler.

### Hüllen

- `app/(tabs)/medikamente/index.tsx` — lädt Einnahmen statt IDs, reicht die
  Zusammenfassung an die neue Zeile und die Zählstände an die Liste, verlinkt
  auf den Verlauf.
- `src/features/medications/components/TodaySummaryLine.tsx` — eine Zeile,
  Text aus dem reinen Modul.
- `src/features/medications/components/MedicationList.tsx` — `takenTodayIds:
  Set<number>` wird zu `takenTodayCounts: Map<number, number>`; die
  Knopfbeschriftung kommt aus dem reinen Modul.
- `app/(tabs)/medikamente/verlauf.tsx` — Zeitraumwahl, Tagesliste, Aufklappen,
  Löschen mit `usePendingDeletion` + `UndoBar`.
- `src/features/medications/components/IntakeHistoryList.tsx` — die Liste
  selbst, damit der Bildschirm klein bleibt.

## Fehlerbehandlung

Wie im übrigen Projekt: Fehler werden geloggt, der Nutzer bekommt einen
Fehlerstreifen (`Einnahmen konnten nicht geladen werden.`,
`Einnahme konnte nicht gelöscht werden.`). Kein stilles Schlucken.

## Leerzustände

Kein Medikament hinterlegt heißt leer — **keine Einnahme** hinterlegt heißt
nicht leer: Dann zeigt die Tagesliste lauter Lücken, und genau das ist ihr
Zweck. Die Leerzustände richten sich deshalb nach den Medikamenten, nicht nach
den Einnahmen:

- Kein Medikament hinterlegt: `EmptyState` mit Titel
  `Noch keine Medikamente hinterlegt`.
- Medikamente vorhanden, im gewählten Zeitraum war aber keines fällig:
  `EmptyState` mit `In diesem Zeitraum war nichts fällig`.

Beide mit `showGhost={false}` — hier entsteht durch Anlegen nichts, eine
Formvorschau wäre ein falsches Versprechen.

## Was ausdrücklich nicht dazugehört

- Kein Schemawechsel, keine Migration.
- Keine Änderung an Sicherung und Wiederherstellung.
- Keine Zuordnung einer Einnahme zu einer bestimmten Erinnerungszeit — gezählt
  wird je Tag, nicht je Uhrzeit.
- Kein Nachtragen einer vergessenen Einnahme für einen vergangenen Tag.
- Keine Auswertung im Medikamenten-Pass-PDF (gehört zu Phase 5).

## Erfolgskriterien

1. Ein dreimal täglich einzunehmendes Medikament lässt sich dreimal abhaken;
   der Knopf zählt sichtbar mit und schaltet erst danach ab.
2. Die Zeile über der Liste nennt, was heute noch aussteht.
3. Der Verlauf zeigt für 30 Tage, 90 Tage und den ganzen Zeitraum je Tag, was
   fehlte — beendete Medikamente nur für ihre Laufzeit.
4. Eine versehentlich erfasste Einnahme lässt sich im Verlauf entfernen und
   binnen acht Sekunden zurückholen.
5. Eine Einnahme kurz nach Mitternacht zählt für den Tag, an dem sie nach der
   Uhr des Geräts erfolgte.
