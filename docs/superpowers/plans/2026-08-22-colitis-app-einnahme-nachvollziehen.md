# Einnahme nachvollziehen — Umsetzungsplan (Phase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus dem binären Haken „genommen" wird eine Zählung je Erinnerungszeit, dazu eine Zusammenfassungszeile für heute und ein Verlaufsbildschirm, der Tag für Tag zeigt, was fehlte — samt Korrekturmöglichkeit.

**Architecture:** Alle Entscheidungen liegen in einem reinen Modul `src/features/medications/adherence.ts`. Das ist der einzige Prüfgegenstand. Der Datenzugriff bekommt zwei neue Funktionen im bestehenden Repository. Die Bildschirme bleiben dünne Hüllen, die das reine Modul aufrufen.

**Tech Stack:** React Native 0.86.2 / Expo SDK 57, expo-router, TypeScript, Drizzle ORM über SQLCipher-SQLite, Vitest (`environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-08-22-colitis-app-einnahme-nachvollziehen-design.md`

## Global Constraints

- **Vitest läuft mit `environment: 'node'`.** Es gibt kein jsdom, kein `@testing-library/react-native`, kein `react-test-renderer`. Komponenten können nicht gerendert und nicht getestet werden. Schreibe **keine** Komponententests und installiere **keine** Test-Bibliotheken. Getestet wird ausschließlich das reine Modul und das Repository.
- **Kein Schemawechsel, keine Migration.** `medication_log` bleibt wie es ist.
- **Keine Änderung an `src/features/backup/`.** `medicationLog` ist dort bereits vollständig abgedeckt.
- **Alle Datumsrechnung lokal.** Ein Kalenderdatum `YYYY-MM-DD` wird ausschließlich mit `new Date(year, month - 1, day)` geparst, nie mit `new Date('2026-08-21')` — letzteres ist UTC und verschiebt den Tag.
- **Alle Nutzertexte auf Deutsch**, mit den exakten Zeichenketten aus den jeweiligen Aufgaben. Codebezeichner auf Englisch, wie im übrigen Projekt.
- **Kommentare im Quelltext ohne Umlaute** (`Loeschen`, `naechster`) — so hält es das übrige Projekt. Nutzersichtbare Texte behalten ihre Umlaute.
- **`tsc` meldet keine ungenutzten Importe** (`noUnusedLocals` ist nicht gesetzt). Wer einen Import überflüssig macht, entfernt ihn selbst.
- **Fehler nie still schlucken:** `console.error` mit Präfix in eckigen Klammern plus ein Fehlerstreifen für den Nutzer, wie im übrigen Projekt.
- **Immutabilität:** keine Mutation von Eingabeparametern. Lokale Akkumulatoren (`Map`, Array) innerhalb einer Funktion sind erlaubt.
- **Windows:** `npx.cmd`, nie `npx`.

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `colitis-app/src/features/medications/types.ts` | Typ `MedicationIntake` ergänzen |
| `colitis-app/src/features/medications/adherence.ts` | **neu** — die gesamte Rechnung und alle Beschriftungen |
| `colitis-app/src/features/medications/adherence.test.ts` | **neu** — Tests dazu |
| `colitis-app/src/features/medications/db/medicationsRepository.ts` | zwei neue Funktionen, eine entfällt |
| `colitis-app/src/features/medications/components/TodaySummaryLine.tsx` | **neu** — die Zeile über der Liste |
| `colitis-app/src/features/medications/components/MedicationList.tsx` | Zählstände statt Menge |
| `colitis-app/src/features/medications/components/IntakeHistoryList.tsx` | **neu** — die Tagesliste |
| `colitis-app/app/(tabs)/medikamente/index.tsx` | Verdrahtung, Verlaufs-Link |
| `colitis-app/app/(tabs)/medikamente/verlauf.tsx` | **neu** — der Verlaufsbildschirm |
| `colitis-app/app/(tabs)/medikamente/_layout.tsx` | Route eintragen |
| `colitis-app/src/components/ui/UndoBar.tsx` | optionales Prop für Bildschirme ohne „+"-Knopf |

Alle Befehle werden aus `D:/Claude/colitis-app` ausgeführt.

---

### Task 1: Das reine Modul `adherence.ts`

**Files:**
- Modify: `colitis-app/src/features/medications/types.ts`
- Create: `colitis-app/src/features/medications/adherence.ts`
- Test: `colitis-app/src/features/medications/adherence.test.ts`

**Interfaces:**
- Consumes: `Medication` aus `./types`, `formatLocalDate` aus `./medicationStatus`
- Produces: sämtliche unten stehenden Typen und Funktionen. Die Aufgaben 2 bis 5 verwenden sie unverändert.

- [ ] **Step 1: `MedicationIntake` in `types.ts` ergänzen**

Ans Ende von `colitis-app/src/features/medications/types.ts` anfügen:

```ts
export interface MedicationIntake {
  /** Zeilen-ID aus medication_log — noetig, um eine einzelne Einnahme zu entfernen. */
  id: number;
  medicationId: number;
  /** ISO-Zeitstempel in UTC, wie ihn new Date().toISOString() liefert. */
  takenAt: string;
}
```

- [ ] **Step 2: Die Testdatei schreiben**

Neu: `colitis-app/src/features/medications/adherence.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  expectedDosesPerDay,
  isMedicationDueOn,
  localDateOf,
  intakesOnDate,
  countByMedication,
  buildDaySummaries,
  buildTodaySummary,
  formatTodaySummaryLabel,
  formatDaySummaryLabel,
  formatDayHeading,
  formatIntakeTime,
  formatTakenButtonLabel,
  periodStartDate,
  queryLowerBoundIso,
  medicationNameById,
} from './adherence';
import type { Medication, MedicationIntake } from './types';

function medication(overrides: Partial<Medication> & { id: number; name: string }): Medication {
  return {
    dose: '500mg',
    schedule: 'nach Bedarf',
    startDate: '2026-08-01',
    endDate: null,
    sideEffectsNote: null,
    reminderTimes: [],
    ...overrides,
  };
}

function reminderTimesFor(times: string[]) {
  return times.map((time, index) => ({ id: index + 1, time, notificationId: null }));
}

/** Ein Zeitstempel, der einer bestimmten lokalen Uhrzeit entspricht. */
function localIso(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function intake(id: number, medicationId: number, takenAt: string): MedicationIntake {
  return { id, medicationId, takenAt };
}

describe('adherence', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  describe('expectedDosesPerDay', () => {
    it('expects one dose when no reminder time is stored', () => {
      expect(expectedDosesPerDay(medication({ id: 1, name: 'Azathioprin' }))).toBe(1);
    });

    it('expects one dose per reminder time', () => {
      const withThree = medication({
        id: 1,
        name: 'Mesalazin',
        reminderTimes: reminderTimesFor(['08:00', '13:00', '19:00']),
      });
      expect(expectedDosesPerDay(withThree)).toBe(3);
    });
  });

  describe('isMedicationDueOn', () => {
    const running = medication({ id: 1, name: 'Mesalazin', startDate: '2026-08-05', endDate: '2026-08-08' });

    it('is not due before the start date', () => {
      expect(isMedicationDueOn(running, '2026-08-04')).toBe(false);
    });

    it('is due on the start date', () => {
      expect(isMedicationDueOn(running, '2026-08-05')).toBe(true);
    });

    it('is due on the end date', () => {
      expect(isMedicationDueOn(running, '2026-08-08')).toBe(true);
    });

    it('is not due after the end date', () => {
      expect(isMedicationDueOn(running, '2026-08-09')).toBe(false);
    });

    it('stays due without an end date', () => {
      const open = medication({ id: 2, name: 'Azathioprin', startDate: '2026-08-05' });
      expect(isMedicationDueOn(open, '2027-01-01')).toBe(true);
    });
  });

  describe('localDateOf', () => {
    it('keeps the local calendar day for a time just after midnight', () => {
      // In UTC+2 liegt dieser Zeitstempel noch auf dem Vortag.
      expect(localDateOf(localIso(2026, 8, 21, 0, 30))).toBe('2026-08-21');
    });

    it('keeps the local calendar day for a time just before midnight', () => {
      expect(localDateOf(localIso(2026, 8, 21, 23, 45))).toBe('2026-08-21');
    });
  });

  describe('intakesOnDate and countByMedication', () => {
    const intakes = [
      intake(1, 10, localIso(2026, 8, 20, 8, 0)),
      intake(2, 10, localIso(2026, 8, 20, 13, 0)),
      intake(3, 11, localIso(2026, 8, 20, 19, 0)),
      intake(4, 10, localIso(2026, 8, 19, 8, 0)),
    ];

    it('keeps only the intakes of the given local day', () => {
      expect(intakesOnDate(intakes, '2026-08-20').map((entry) => entry.id)).toEqual([1, 2, 3]);
    });

    it('counts the intakes per medication', () => {
      const counts = countByMedication(intakesOnDate(intakes, '2026-08-20'));
      expect(counts.get(10)).toBe(2);
      expect(counts.get(11)).toBe(1);
    });

    it('leaves a medication without intakes out of the counts', () => {
      const counts = countByMedication(intakesOnDate(intakes, '2026-08-18'));
      expect(counts.size).toBe(0);
    });
  });

  describe('buildDaySummaries', () => {
    const mesalazin = medication({
      id: 10,
      name: 'Mesalazin',
      startDate: '2026-08-18',
      reminderTimes: reminderTimesFor(['08:00', '13:00', '19:00']),
    });
    const prednisolon = medication({
      id: 11,
      name: 'Prednisolon',
      startDate: '2026-08-18',
      endDate: '2026-08-19',
    });

    it('returns the days newest first', () => {
      const summaries = buildDaySummaries([mesalazin], [], '2026-08-18', '2026-08-20');
      expect(summaries.map((summary) => summary.date)).toEqual(['2026-08-20', '2026-08-19', '2026-08-18']);
    });

    it('skips days on which nothing was due', () => {
      const summaries = buildDaySummaries([mesalazin], [], '2026-08-16', '2026-08-18');
      expect(summaries.map((summary) => summary.date)).toEqual(['2026-08-18']);
    });

    it('marks a day complete only when every due medication reached its count', () => {
      const intakes = [
        intake(1, 10, localIso(2026, 8, 18, 8, 0)),
        intake(2, 10, localIso(2026, 8, 18, 13, 0)),
        intake(3, 10, localIso(2026, 8, 18, 19, 0)),
      ];
      const summaries = buildDaySummaries([mesalazin], intakes, '2026-08-18', '2026-08-19');
      expect(summaries[0].date).toBe('2026-08-19');
      expect(summaries[0].isComplete).toBe(false);
      expect(summaries[1].date).toBe('2026-08-18');
      expect(summaries[1].isComplete).toBe(true);
    });

    it('counts an ended medication only within its runtime', () => {
      const summaries = buildDaySummaries([mesalazin, prednisolon], [], '2026-08-18', '2026-08-20');
      const byDate = new Map(summaries.map((summary) => [summary.date, summary]));
      expect(byDate.get('2026-08-19')?.medications.map((status) => status.name)).toEqual([
        'Mesalazin',
        'Prednisolon',
      ]);
      expect(byDate.get('2026-08-20')?.medications.map((status) => status.name)).toEqual(['Mesalazin']);
    });

    it('carries the intakes of each day', () => {
      const intakes = [intake(7, 10, localIso(2026, 8, 19, 8, 0))];
      const summaries = buildDaySummaries([mesalazin], intakes, '2026-08-18', '2026-08-19');
      expect(summaries[0].intakes.map((entry) => entry.id)).toEqual([7]);
      expect(summaries[1].intakes).toEqual([]);
    });

    it('returns nothing when the range is inverted', () => {
      expect(buildDaySummaries([mesalazin], [], '2026-08-20', '2026-08-18')).toEqual([]);
    });
  });

  describe('buildTodaySummary', () => {
    const mesalazin = medication({
      id: 10,
      name: 'Mesalazin',
      reminderTimes: reminderTimesFor(['08:00', '13:00', '19:00']),
    });
    const azathioprin = medication({ id: 11, name: 'Azathioprin' });

    it('reports how many doses are still missing', () => {
      const intakes = [intake(1, 10, localIso(2026, 8, 22, 8, 0))];
      const summary = buildTodaySummary([mesalazin, azathioprin], intakes, '2026-08-22');
      expect(summary.open).toEqual([
        { medicationId: 10, name: 'Mesalazin', missing: 2 },
        { medicationId: 11, name: 'Azathioprin', missing: 1 },
      ]);
      expect(summary.hasActiveMedications).toBe(true);
    });

    it('reports nothing open once every dose is taken', () => {
      const intakes = [
        intake(1, 10, localIso(2026, 8, 22, 8, 0)),
        intake(2, 10, localIso(2026, 8, 22, 13, 0)),
        intake(3, 10, localIso(2026, 8, 22, 19, 0)),
      ];
      const summary = buildTodaySummary([mesalazin], intakes, '2026-08-22');
      expect(summary.open).toEqual([]);
      expect(summary.hasActiveMedications).toBe(true);
    });

    it('reports no active medications when none is due today', () => {
      const ended = medication({ id: 12, name: 'Prednisolon', endDate: '2026-08-08' });
      const summary = buildTodaySummary([ended], [], '2026-08-22');
      expect(summary.hasActiveMedications).toBe(false);
      expect(summary.open).toEqual([]);
    });
  });

  describe('formatTodaySummaryLabel', () => {
    it('says nothing without active medications', () => {
      expect(formatTodaySummaryLabel({ open: [], hasActiveMedications: false })).toBeNull();
    });

    it('confirms a complete day', () => {
      expect(formatTodaySummaryLabel({ open: [], hasActiveMedications: true })).toBe(
        'Heute ist alles genommen'
      );
    });

    it('names what is open and adds the count only above one', () => {
      const label = formatTodaySummaryLabel({
        open: [
          { medicationId: 10, name: 'Mesalazin', missing: 2 },
          { medicationId: 11, name: 'Azathioprin', missing: 1 },
        ],
        hasActiveMedications: true,
      });
      expect(label).toBe('Heute noch offen: Mesalazin (2), Azathioprin');
    });
  });

  describe('formatDaySummaryLabel', () => {
    it('confirms a complete day', () => {
      const summary = {
        date: '2026-08-20',
        medications: [{ medicationId: 10, name: 'Mesalazin', expected: 3, taken: 3 }],
        intakes: [],
        isComplete: true,
      };
      expect(formatDaySummaryLabel(summary)).toBe('alles genommen');
    });

    it('names only what is missing', () => {
      const summary = {
        date: '2026-08-20',
        medications: [
          { medicationId: 10, name: 'Mesalazin', expected: 3, taken: 2 },
          { medicationId: 11, name: 'Azathioprin', expected: 1, taken: 1 },
          { medicationId: 12, name: 'Prednisolon', expected: 1, taken: 0 },
        ],
        intakes: [],
        isComplete: false,
      };
      expect(formatDaySummaryLabel(summary)).toBe('Mesalazin: 2 von 3 · Prednisolon: 0 von 1');
    });
  });

  describe('formatDayHeading', () => {
    it('names the weekday and the padded date', () => {
      expect(formatDayHeading('2026-08-05')).toBe('Mi 05.08.');
    });
  });

  describe('formatIntakeTime', () => {
    it('pads hours and minutes to two digits', () => {
      expect(formatIntakeTime(localIso(2026, 8, 20, 8, 5))).toBe('08:05');
    });
  });

  describe('formatTakenButtonLabel', () => {
    it('stays plain for a single dose', () => {
      expect(formatTakenButtonLabel(0, 1)).toBe('Heute genommen');
    });

    it('counts up for several doses', () => {
      expect(formatTakenButtonLabel(1, 3)).toBe('Heute genommen (1 von 3)');
    });

    it('confirms once every dose is taken', () => {
      expect(formatTakenButtonLabel(3, 3)).toBe('Heute genommen ✓');
    });
  });

  describe('periodStartDate', () => {
    const medications = [
      medication({ id: 10, name: 'Mesalazin', startDate: '2026-05-04' }),
      medication({ id: 11, name: 'Azathioprin', startDate: '2026-03-17' }),
    ];

    it('counts the last 30 days including today', () => {
      expect(periodStartDate('30', medications, '2026-08-22')).toBe('2026-07-24');
    });

    it('counts the last 90 days including today', () => {
      expect(periodStartDate('90', medications, '2026-08-22')).toBe('2026-05-25');
    });

    it('starts at the earliest start date for the whole range', () => {
      expect(periodStartDate('alles', medications, '2026-08-22')).toBe('2026-03-17');
    });

    it('falls back to today when there is no medication at all', () => {
      expect(periodStartDate('alles', [], '2026-08-22')).toBe('2026-08-22');
    });
  });

  describe('queryLowerBoundIso', () => {
    it('reaches exactly one day further back than the local start of the requested day', () => {
      const startOfDay = new Date(2026, 7, 22).getTime();
      const bound = new Date(queryLowerBoundIso('2026-08-22')).getTime();
      expect(bound).toBe(startOfDay - 24 * 60 * 60 * 1000);
    });
  });

  describe('medicationNameById', () => {
    const medications = [medication({ id: 10, name: 'Mesalazin' })];

    it('finds the name', () => {
      expect(medicationNameById(medications, 10)).toBe('Mesalazin');
    });

    it('falls back when the medication is gone', () => {
      expect(medicationNameById(medications, 99)).toBe('Unbekanntes Medikament');
    });
  });
});
```

- [ ] **Step 3: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/features/medications/adherence.test.ts`
Expected: FAIL — `Failed to resolve import "./adherence"`.

- [ ] **Step 4: Das Modul schreiben**

Neu: `colitis-app/src/features/medications/adherence.ts`

```ts
import { formatLocalDate } from './medicationStatus';
import type { Medication, MedicationIntake } from './types';

export interface MedicationDayStatus {
  medicationId: number;
  name: string;
  expected: number;
  taken: number;
}

export interface DaySummary {
  /** Lokales Kalenderdatum, YYYY-MM-DD. */
  date: string;
  /** Nur die an diesem Tag faelligen Medikamente. */
  medications: MedicationDayStatus[];
  /** Die tatsaechlich erfassten Zeilen dieses Tages. */
  intakes: MedicationIntake[];
  isComplete: boolean;
}

export interface OpenMedication {
  medicationId: number;
  name: string;
  missing: number;
}

export interface TodaySummary {
  open: OpenMedication[];
  hasActiveMedications: boolean;
}

export type HistoryPeriod = '30' | '90' | 'alles';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYS_BY_PERIOD: Record<'30' | '90', number> = { '30': 30, '90': 90 };
const UNKNOWN_MEDICATION_NAME = 'Unbekanntes Medikament';

/**
 * Ein Kalenderdatum als lokalen Tag lesen. new Date('2026-08-21') waere UTC
 * und wuerde den Tag in oestlichen Zeitzonen verschieben.
 */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Der Zeitstempel im Protokoll ist UTC, der Kalendertag des Nutzers ist lokal.
 * Ohne diese Umrechnung faellt eine Einnahme kurz nach Mitternacht auf den
 * Vortag und damit in die falsche Zeile.
 */
export function localDateOf(takenAt: string): string {
  return formatLocalDate(new Date(takenAt));
}

export function expectedDosesPerDay(medication: Medication): number {
  return Math.max(1, medication.reminderTimes.length);
}

export function isMedicationDueOn(medication: Medication, date: string): boolean {
  if (date < medication.startDate) {
    return false;
  }
  if (medication.endDate !== null && date > medication.endDate) {
    return false;
  }
  return true;
}

export function intakesOnDate(intakes: MedicationIntake[], date: string): MedicationIntake[] {
  return intakes.filter((intake) => localDateOf(intake.takenAt) === date);
}

export function countByMedication(intakes: MedicationIntake[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const intake of intakes) {
    counts.set(intake.medicationId, (counts.get(intake.medicationId) ?? 0) + 1);
  }
  return counts;
}

function groupIntakesByDate(intakes: MedicationIntake[]): Map<string, MedicationIntake[]> {
  const byDate = new Map<string, MedicationIntake[]>();
  for (const intake of intakes) {
    const date = localDateOf(intake.takenAt);
    const bucket = byDate.get(date);
    if (bucket === undefined) {
      byDate.set(date, [intake]);
    } else {
      bucket.push(intake);
    }
  }
  return byDate;
}

export function buildDaySummaries(
  medications: Medication[],
  intakes: MedicationIntake[],
  fromDate: string,
  toDate: string
): DaySummary[] {
  const byDate = groupIntakesByDate(intakes);
  const from = parseLocalDate(fromDate);
  const summaries: DaySummary[] = [];

  let cursor = parseLocalDate(toDate);
  while (cursor.getTime() >= from.getTime()) {
    const date = formatLocalDate(cursor);
    const due = medications.filter((medication) => isMedicationDueOn(medication, date));
    if (due.length > 0) {
      const dayIntakes = byDate.get(date) ?? [];
      const counts = countByMedication(dayIntakes);
      const statuses = due.map((medication) => ({
        medicationId: medication.id,
        name: medication.name,
        expected: expectedDosesPerDay(medication),
        taken: counts.get(medication.id) ?? 0,
      }));
      summaries.push({
        date,
        medications: statuses,
        intakes: dayIntakes,
        isComplete: statuses.every((status) => status.taken >= status.expected),
      });
    }
    cursor = addDays(cursor, -1);
  }

  return summaries;
}

export function buildTodaySummary(
  medications: Medication[],
  intakes: MedicationIntake[],
  today: string
): TodaySummary {
  const due = medications.filter((medication) => isMedicationDueOn(medication, today));
  const counts = countByMedication(intakesOnDate(intakes, today));

  const open: OpenMedication[] = [];
  for (const medication of due) {
    const missing = expectedDosesPerDay(medication) - (counts.get(medication.id) ?? 0);
    if (missing > 0) {
      open.push({ medicationId: medication.id, name: medication.name, missing });
    }
  }

  return { open, hasActiveMedications: due.length > 0 };
}

export function formatTodaySummaryLabel(summary: TodaySummary): string | null {
  if (!summary.hasActiveMedications) {
    return null;
  }
  if (summary.open.length === 0) {
    return 'Heute ist alles genommen';
  }
  const parts = summary.open.map((entry) =>
    entry.missing > 1 ? `${entry.name} (${entry.missing})` : entry.name
  );
  return `Heute noch offen: ${parts.join(', ')}`;
}

export function formatDaySummaryLabel(summary: DaySummary): string {
  if (summary.isComplete) {
    return 'alles genommen';
  }
  return summary.medications
    .filter((status) => status.taken < status.expected)
    .map((status) => `${status.name}: ${status.taken} von ${status.expected}`)
    .join(' · ');
}

export function formatDayHeading(date: string): string {
  const parsed = parseLocalDate(date);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${WEEKDAY_LABELS[parsed.getDay()]} ${day}.${month}.`;
}

export function formatIntakeTime(takenAt: string): string {
  const parsed = new Date(takenAt);
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatTakenButtonLabel(taken: number, expected: number): string {
  if (taken >= expected) {
    return 'Heute genommen ✓';
  }
  if (expected === 1) {
    return 'Heute genommen';
  }
  return `Heute genommen (${taken} von ${expected})`;
}

export function periodStartDate(
  period: HistoryPeriod,
  medications: Medication[],
  today: string
): string {
  if (period === 'alles') {
    if (medications.length === 0) {
      return today;
    }
    return medications
      .map((medication) => medication.startDate)
      .reduce((earliest, candidate) => (candidate < earliest ? candidate : earliest));
  }
  // Der heutige Tag zaehlt mit, deshalb einer weniger zurueck.
  return formatLocalDate(addDays(parseLocalDate(today), -(DAYS_BY_PERIOD[period] - 1)));
}

/**
 * Untergrenze der Datenbankabfrage: ein Tag frueher als gefragt. Der
 * gespeicherte Zeitstempel ist UTC, gesucht wird nach lokalen Tagen — ohne
 * diesen Puffer fiele die frueheste Einnahme am Rand heraus.
 */
export function queryLowerBoundIso(fromDate: string): string {
  return addDays(parseLocalDate(fromDate), -1).toISOString();
}

export function medicationNameById(medications: Medication[], medicationId: number): string {
  const found = medications.find((medication) => medication.id === medicationId);
  return found === undefined ? UNKNOWN_MEDICATION_NAME : found.name;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx.cmd vitest run src/features/medications/adherence.test.ts`
Expected: PASS, 38 Tests.

- [ ] **Step 6: Typprüfung**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 7: Commit**

```bash
git add src/features/medications/adherence.ts src/features/medications/adherence.test.ts src/features/medications/types.ts
git commit -m "feat: reines Modul fuer Einnahme-Zaehlung und Rueckschau"
```

---

### Task 2: Datenzugriff — Einnahmen lesen und einzeln entfernen

**Files:**
- Modify: `colitis-app/src/features/medications/db/medicationsRepository.ts`
- Test: `colitis-app/src/features/medications/db/medicationsRepository.test.ts`

**Interfaces:**
- Consumes: `MedicationIntake` aus `../types` (Aufgabe 1)
- Produces:
  - `listMedicationIntakes(db: MedicationsDb, fromIsoInclusive: string | null): Promise<MedicationIntake[]>`
  - `deleteMedicationIntake(db: MedicationsDb, intakeId: number): Promise<void>`
  - `listMedicationIdsTakenOn` **entfällt ersatzlos**.

`listMedicationIdsTakenOn` wird entfernt, weil sie zwei Fehler trägt: Sie faltet mehrere Einnahmen eines Tages mit `[...new Set(...)]` zu einer zusammen, und sie vergleicht mit `like` ein lokales Datum gegen einen UTC-Zeitstempel. Der einzige Aufrufer ist `app/(tabs)/medikamente/index.tsx`; der wechselt in Aufgabe 3 auf den neuen Weg. **Damit ist der Baum zwischen Aufgabe 2 und 3 vorübergehend nicht typrein — das ist erwartet und wird in Aufgabe 3 aufgelöst.** Prüfe in Aufgabe 2 nur die Tests, nicht `tsc`.

- [ ] **Step 1: Die Tests schreiben**

In `colitis-app/src/features/medications/db/medicationsRepository.test.ts`:

Zuerst den Import anpassen — `listMedicationIdsTakenOn` streichen, die beiden neuen aufnehmen:

```ts
import {
  createMedication,
  listMedications,
  getMedicationById,
  updateMedication,
  endMedication,
  setReminderTimeNotificationId,
  logMedicationTaken,
  listMedicationIntakes,
  deleteMedicationIntake,
  deleteMedication,
} from './medicationsRepository';
```

Dann jeden vorhandenen Test, der `listMedicationIdsTakenOn` aufruft, ersatzlos entfernen. Anschließend am Ende des `describe`-Blocks anfügen:

```ts
  async function createSimpleMedication(name: string) {
    return createMedication(db, {
      name,
      dose: '500mg',
      schedule: '3x täglich',
      startDate: '2026-08-01',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });
  }

  it('lists every intake with its row id, oldest first', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-20T11:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');

    const intakes = await listMedicationIntakes(db, null);

    expect(intakes).toHaveLength(2);
    expect(intakes[0].takenAt).toBe('2026-08-20T06:00:00.000Z');
    expect(intakes[1].takenAt).toBe('2026-08-20T11:00:00.000Z');
    expect(intakes[0].medicationId).toBe(medication.id);
    expect(intakes[0].id).toBeGreaterThan(0);
  });

  it('keeps several intakes of the same medication on the same day apart', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T11:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T17:00:00.000Z');

    expect(await listMedicationIntakes(db, null)).toHaveLength(3);
  });

  it('drops intakes before the lower bound', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-18T06:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');

    const intakes = await listMedicationIntakes(db, '2026-08-19T00:00:00.000Z');

    expect(intakes.map((intake) => intake.takenAt)).toEqual(['2026-08-20T06:00:00.000Z']);
  });

  it('keeps an intake that sits exactly on the lower bound', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-19T00:00:00.000Z');

    expect(await listMedicationIntakes(db, '2026-08-19T00:00:00.000Z')).toHaveLength(1);
  });

  it('deletes a single intake and leaves the others alone', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T11:00:00.000Z');
    const intakes = await listMedicationIntakes(db, null);

    await deleteMedicationIntake(db, intakes[0].id);

    const remaining = await listMedicationIntakes(db, null);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].takenAt).toBe('2026-08-20T11:00:00.000Z');
  });

  it('stays quiet when the intake is already gone', async () => {
    await expect(deleteMedicationIntake(db, 999)).resolves.toBeUndefined();
  });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/features/medications/db/medicationsRepository.test.ts`
Expected: FAIL — `listMedicationIntakes is not a function`.

- [ ] **Step 3: Das Repository ändern**

In `colitis-app/src/features/medications/db/medicationsRepository.ts`:

Den Import aus `drizzle-orm` von `like` auf `gte` umstellen:

```ts
import { asc, eq, gte } from 'drizzle-orm';
```

Den Typimport ergänzen:

```ts
import type { Medication, MedicationInput, MedicationReminderTime, MedicationIntake } from '../types';
```

`listMedicationIdsTakenOn` vollständig löschen und durch diese beiden Funktionen ersetzen:

```ts
/**
 * Alle Einnahmen ab der Untergrenze, aelteste zuerst. fromIsoInclusive null
 * liest das ganze Protokoll. Der gespeicherte Zeitstempel ist ISO in UTC,
 * deshalb ist der lexikografische Vergleich zugleich der zeitliche.
 */
export async function listMedicationIntakes(
  db: MedicationsDb,
  fromIsoInclusive: string | null
): Promise<MedicationIntake[]> {
  const columns = {
    id: medicationLog.id,
    medicationId: medicationLog.medicationId,
    takenAt: medicationLog.takenAt,
  };

  if (fromIsoInclusive === null) {
    return db.select(columns).from(medicationLog).orderBy(asc(medicationLog.takenAt));
  }

  return db
    .select(columns)
    .from(medicationLog)
    .where(gte(medicationLog.takenAt, fromIsoInclusive))
    .orderBy(asc(medicationLog.takenAt));
}

export async function deleteMedicationIntake(db: MedicationsDb, intakeId: number): Promise<void> {
  await db.delete(medicationLog).where(eq(medicationLog.id, intakeId));
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx.cmd vitest run src/features/medications/db/medicationsRepository.test.ts`
Expected: PASS.

- [ ] **Step 5: Gesamte Testsuite laufen lassen**

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/medications/db/medicationsRepository.ts src/features/medications/db/medicationsRepository.test.ts
git commit -m "feat: Einnahmen einzeln lesen und entfernen"
```

---

### Task 3: Der Knopf zählt, die Zeile fasst zusammen

**Files:**
- Create: `colitis-app/src/features/medications/components/TodaySummaryLine.tsx`
- Modify: `colitis-app/src/features/medications/components/MedicationList.tsx`
- Modify: `colitis-app/app/(tabs)/medikamente/index.tsx`

**Interfaces:**
- Consumes: `expectedDosesPerDay`, `formatTakenButtonLabel`, `formatTodaySummaryLabel`, `buildTodaySummary`, `countByMedication`, `intakesOnDate`, `queryLowerBoundIso` (Aufgabe 1); `listMedicationIntakes` (Aufgabe 2)
- Produces: `MedicationList` erwartet ab jetzt `takenTodayCounts: Map<number, number>` statt `takenTodayIds: Set<number>`.

Keine Tests: Komponenten sind in diesem Projekt nicht testbar (siehe Global Constraints). Geprüft wird mit `tsc`.

- [ ] **Step 1: Die Zusammenfassungszeile schreiben**

Neu: `colitis-app/src/features/medications/components/TodaySummaryLine.tsx`

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { formatTodaySummaryLabel } from '../adherence';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { TodaySummary } from '../adherence';
import type { ThemeColors } from '../../../theme/types';

interface TodaySummaryLineProps {
  summary: TodaySummary | null;
}

export function TodaySummaryLine({ summary }: TodaySummaryLineProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (summary === null) {
    return null;
  }

  const label = formatTodaySummaryLabel(summary);
  if (label === null) {
    return null;
  }

  const isComplete = summary.open.length === 0;

  return (
    <View style={styles.line}>
      <Text style={isComplete ? styles.completeText : styles.openText}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    line: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
    },
    openText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    completeText: {
      color: colors.success,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
```

- [ ] **Step 2: `MedicationList` auf Zählstände umstellen**

In `colitis-app/src/features/medications/components/MedicationList.tsx`:

Den Import ergänzen:

```tsx
import { expectedDosesPerDay, formatTakenButtonLabel } from '../adherence';
```

In `MedicationListProps` die Zeile

```tsx
  takenTodayIds: Set<number>;
```

ersetzen durch

```tsx
  takenTodayCounts: Map<number, number>;
```

und den Bezeichner in der Parameterliste der Komponente entsprechend von `takenTodayIds` auf `takenTodayCounts` ändern.

In `renderItem` die Zeile

```tsx
        const isTakenToday = takenTodayIds.has(item.id);
```

ersetzen durch

```tsx
        const expectedToday = expectedDosesPerDay(item);
        const takenToday = takenTodayCounts.get(item.id) ?? 0;
        const isTakenToday = takenToday >= expectedToday;
```

und den Knopf so schreiben:

```tsx
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isTakenToday }}
                    accessibilityLabel={
                      isTakenToday
                        ? `${item.name} heute vollständig genommen`
                        : `${item.name} heute genommen, ${takenToday} von ${expectedToday}`
                    }
                    disabled={isTakenToday}
                    style={isTakenToday ? styles.takenButton : styles.notTakenButton}
                    onPress={() => onTakenToday(item.id)}
                  >
                    <Text style={isTakenToday ? styles.takenButtonText : styles.notTakenButtonText}>
                      {formatTakenButtonLabel(takenToday, expectedToday)}
                    </Text>
                  </Pressable>
```

Sonst nichts an der Datei ändern.

- [ ] **Step 3: Den Medikamenten-Tab verdrahten**

In `colitis-app/app/(tabs)/medikamente/index.tsx`:

Den Repository-Import ändern — `listMedicationIdsTakenOn` streichen, `listMedicationIntakes` aufnehmen:

```tsx
import {
  listMedications,
  logMedicationTaken,
  listMedicationIntakes,
  endMedication,
  deleteMedication,
} from '../../../src/features/medications/db/medicationsRepository';
```

Diese Importe ergänzen:

```tsx
import {
  buildTodaySummary,
  countByMedication,
  intakesOnDate,
  queryLowerBoundIso,
} from '../../../src/features/medications/adherence';
import { TodaySummaryLine } from '../../../src/features/medications/components/TodaySummaryLine';
import type { TodaySummary } from '../../../src/features/medications/adherence';
```

Den Zustand

```tsx
  const [takenTodayIds, setTakenTodayIds] = useState<Set<number>>(new Set());
```

ersetzen durch

```tsx
  const [takenTodayCounts, setTakenTodayCounts] = useState<Map<number, number>>(new Map());
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
```

Im `useFocusEffect` den Ladeblock ersetzen:

```tsx
        .then(async (db) => {
          const today = formatLocalDate(new Date());
          const [loadedMedications, loadedScreening, loadedIntakes] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
            listMedicationIntakes(db, queryLowerBoundIso(today)),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
            setTakenTodayCounts(countByMedication(intakesOnDate(loadedIntakes, today)));
            setTodaySummary(buildTodaySummary(loadedMedications, loadedIntakes, today));
            setError(null);
            setIsLoading(false);
          }
        })
```

`handleTakenToday` ersetzen:

```tsx
  async function handleTakenToday(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      await logMedicationTaken(db, medicationId, new Date().toISOString());
      const today = formatLocalDate(new Date());
      const intakes = await listMedicationIntakes(db, queryLowerBoundIso(today));
      setTakenTodayCounts(countByMedication(intakesOnDate(intakes, today)));
      setTodaySummary(buildTodaySummary(medications, intakes, today));
      setError(null);
    } catch (takenError: unknown) {
      console.error('[Medikamente] Eintragen der Einnahme fehlgeschlagen:', takenError);
      setError('Einnahme konnte nicht gespeichert werden.');
    }
  }
```

Im JSX die Zusammenfassungszeile direkt über der Vorsorge-Karte einsetzen:

```tsx
      <TodaySummaryLine summary={todaySummary} />
      <ScreeningReminderCard
```

und in der `MedicationList` das Prop umbenennen:

```tsx
          takenTodayCounts={takenTodayCounts}
```

- [ ] **Step 4: Typprüfung**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 5: Gesamte Testsuite laufen lassen**

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/medications/components app/(tabs)/medikamente/index.tsx
git commit -m "feat: Einnahme-Knopf zaehlt, Zusammenfassungszeile fuer heute"
```

---

### Task 4: Der Verlaufsbildschirm

**Files:**
- Create: `colitis-app/src/features/medications/components/IntakeHistoryList.tsx`
- Create: `colitis-app/app/(tabs)/medikamente/verlauf.tsx`
- Modify: `colitis-app/app/(tabs)/medikamente/_layout.tsx`
- Modify: `colitis-app/app/(tabs)/medikamente/index.tsx`

**Interfaces:**
- Consumes: `buildDaySummaries`, `periodStartDate`, `formatDayHeading`, `formatDaySummaryLabel` (Aufgabe 1); `listMedicationIntakes` (Aufgabe 2)
- Produces: `IntakeHistoryList` mit den Props aus Step 1. Aufgabe 5 erweitert dieselbe Komponente um Aufklappen und Löschen.

In dieser Aufgabe ist die Liste **nur lesend**. Aufklappen und Löschen folgen in Aufgabe 5.

- [ ] **Step 1: Die Tagesliste schreiben**

Neu: `colitis-app/src/features/medications/components/IntakeHistoryList.tsx`

```tsx
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { formatDayHeading, formatDaySummaryLabel } from '../adherence';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DaySummary } from '../adherence';
import type { ThemeColors } from '../../../theme/types';

interface IntakeHistoryListProps {
  summaries: DaySummary[];
}

export function IntakeHistoryList({ summaries }: IntakeHistoryListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={summaries}
      keyExtractor={(summary) => summary.date}
      renderItem={({ item }) => (
        <Card accent={item.isComplete ? 'good' : 'warning'}>
          <View style={styles.dayRow}>
            <Text style={styles.dayHeading}>{formatDayHeading(item.date)}</Text>
            <Text style={item.isComplete ? styles.completeText : styles.missingText}>
              {formatDaySummaryLabel(item)}
            </Text>
          </View>
        </Card>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
    dayRow: { gap: tokens.spacing.xs },
    dayHeading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    completeText: { color: colors.success, fontSize: tokens.typography.fontSize.sm },
    missingText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
  });
}
```

- [ ] **Step 2: Den Bildschirm schreiben**

Neu: `colitis-app/app/(tabs)/medikamente/verlauf.tsx`

```tsx
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  listMedicationIntakes,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import { buildDaySummaries, periodStartDate } from '../../../src/features/medications/adherence';
import { IntakeHistoryList } from '../../../src/features/medications/components/IntakeHistoryList';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { SkeletonList } from '../../../src/components/ui/SkeletonList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { HistoryPeriod } from '../../../src/features/medications/adherence';
import type { Medication, MedicationIntake } from '../../../src/features/medications/types';
import type { ThemeColors } from '../../../src/theme/types';

const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: '30', label: '30 Tage' },
  { value: '90', label: '90 Tage' },
  { value: 'alles', label: 'Alles' },
];

export default function EinnahmeVerlaufScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [period, setPeriod] = useState<HistoryPeriod>('30');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [loadedMedications, loadedIntakes] = await Promise.all([
            listMedications(db),
            listMedicationIntakes(db, null),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setIntakes(loadedIntakes);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Einnahme-Verlauf] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einnahmen konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  // Die Tagesliste laeuft ueber jeden Tag des Zeitraums und gruppiert dabei
  // alle Einnahmen. Bei "Alles" sind das schnell mehrere hundert Zeilen; das
  // bei jedem Tastendruck neu zu rechnen waere spuerbar.
  const summaries = useMemo(() => {
    const today = formatLocalDate(new Date());
    return buildDaySummaries(medications, intakes, periodStartDate(period, medications, today), today);
  }, [medications, intakes, period]);

  function renderBody() {
    if (isLoading) {
      return <SkeletonList count={4} lines={2} />;
    }
    if (medications.length === 0) {
      return (
        <EmptyState
          title="Noch keine Medikamente hinterlegt"
          description="Sobald du ein Medikament anlegst, hält der Verlauf fest, an welchen Tagen etwas fehlte."
          showGhost={false}
        />
      );
    }
    if (summaries.length === 0) {
      return (
        <EmptyState
          title="In diesem Zeitraum war nichts fällig"
          description="Wähle einen längeren Zeitraum, um weiter zurückzuschauen."
          showGhost={false}
        />
      );
    }
    return <IntakeHistoryList summaries={summaries} />;
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((option) => {
          const isSelected = option.value === period;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Zeitraum ${option.label}`}
              style={isSelected ? styles.periodChipSelected : styles.periodChip}
              onPress={() => setPeriod(option.value)}
            >
              <Text style={isSelected ? styles.periodChipTextSelected : styles.periodChipText}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {renderBody()}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
    periodRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
    },
    periodChip: {
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    periodChipSelected: {
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    periodChipText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    periodChipTextSelected: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
```

- [ ] **Step 3: Die Route eintragen**

In `colitis-app/app/(tabs)/medikamente/_layout.tsx` nach der `neu`-Zeile einfügen:

```tsx
      <Stack.Screen name="verlauf" options={{ title: 'Einnahme-Verlauf' }} />
```

- [ ] **Step 4: Vom Medikamenten-Tab aus verlinken**

In `colitis-app/app/(tabs)/medikamente/index.tsx` direkt **unter** dem vorhandenen Export-Knopf (der `Pressable` mit `styles.exportLink`) einfügen:

```tsx
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Einnahme-Verlauf öffnen"
        style={styles.historyLink}
        onPress={() => router.push('/medikamente/verlauf')}
      >
        <Text style={styles.historyLinkText}>Einnahme-Verlauf ansehen</Text>
      </Pressable>
```

Und in `makeStyles` derselben Datei ergänzen:

```tsx
    historyLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    historyLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
```

- [ ] **Step 5: Typprüfung**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/medikamente src/features/medications/components/IntakeHistoryList.tsx
git commit -m "feat: Verlaufsbildschirm mit Tagesliste und Zeitraumwahl"
```

---

### Task 5: Aufklappen und Korrigieren

**Files:**
- Modify: `colitis-app/src/features/medications/components/IntakeHistoryList.tsx`
- Modify: `colitis-app/src/components/ui/UndoBar.tsx`
- Modify: `colitis-app/app/(tabs)/medikamente/verlauf.tsx`

**Interfaces:**
- Consumes: `formatIntakeTime`, `medicationNameById` (Aufgabe 1); `deleteMedicationIntake` (Aufgabe 2); `usePendingDeletion` aus `src/features/deletion/usePendingDeletion`, `UndoBar` aus `src/components/ui/UndoBar` (beide seit Phase 3 vorhanden)
- Produces: nichts, worauf spätere Aufgaben aufbauen.

Zwei Punkte, die aus der Schlussdurchsicht von Phase 3 stammen und hier wieder gelten:

1. **Der Löschknopf darf während des Rückgängig-Fensters nicht erreichbar bleiben.** Deshalb wird die schwebende Einnahme aus den Daten gefiltert, bevor die Tagesliste gebaut wird — die Zeile verschwindet, und ein zweiter Druck darauf ist unmöglich.
2. **Der Tageszähler muss sofort mitgehen.** Weil gefiltert und nicht bloß versteckt wird, liest die Zeile im selben Moment „2 von 3" statt weiter „3 von 3" — und beim Rückgängigmachen wieder „3 von 3".

- [ ] **Step 1: Die Tagesliste um Aufklappen und Löschen erweitern**

`colitis-app/src/features/medications/components/IntakeHistoryList.tsx` vollständig ersetzen:

```tsx
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import {
  formatDayHeading,
  formatDaySummaryLabel,
  formatIntakeTime,
  medicationNameById,
} from '../adherence';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DaySummary } from '../adherence';
import type { Medication } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface IntakeHistoryListProps {
  summaries: DaySummary[];
  medications: Medication[];
  expandedDate: string | null;
  onToggleDate: (date: string) => void;
  onDeleteIntake: (intakeId: number) => void;
}

export function IntakeHistoryList({
  summaries,
  medications,
  expandedDate,
  onToggleDate,
  onDeleteIntake,
}: IntakeHistoryListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={summaries}
      keyExtractor={(summary) => summary.date}
      renderItem={({ item }) => {
        const isExpanded = item.date === expandedDate;
        return (
          <Card accent={item.isComplete ? 'good' : 'warning'}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              accessibilityLabel={`${formatDayHeading(item.date)}: ${formatDaySummaryLabel(item)}`}
              style={styles.dayRow}
              onPress={() => onToggleDate(item.date)}
            >
              <Text style={styles.dayHeading}>{formatDayHeading(item.date)}</Text>
              <Text style={item.isComplete ? styles.completeText : styles.missingText}>
                {formatDaySummaryLabel(item)}
              </Text>
            </Pressable>

            {isExpanded && (
              <View style={styles.intakeBlock}>
                {item.intakes.length === 0 ? (
                  <Text style={styles.noIntakeText}>An diesem Tag wurde nichts erfasst.</Text>
                ) : (
                  item.intakes.map((intake) => (
                    <View key={intake.id} style={styles.intakeRow}>
                      <Text style={styles.intakeText}>
                        {medicationNameById(medications, intake.medicationId)} —{' '}
                        {formatIntakeTime(intake.takenAt)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Einnahme um ${formatIntakeTime(intake.takenAt)} entfernen`}
                        style={styles.deleteButton}
                        onPress={() => onDeleteIntake(intake.id)}
                      >
                        <Text style={styles.deleteButtonText}>Entfernen</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </Card>
        );
      }}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg, gap: tokens.spacing.md },
    dayRow: { gap: tokens.spacing.xs },
    dayHeading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    completeText: { color: colors.success, fontSize: tokens.typography.fontSize.sm },
    missingText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
    intakeBlock: {
      marginTop: tokens.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: tokens.spacing.sm,
      gap: tokens.spacing.xs,
    },
    noIntakeText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    intakeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    },
    intakeText: { color: colors.textPrimary, fontSize: tokens.typography.fontSize.sm, flexShrink: 1 },
    deleteButton: {
      borderRadius: tokens.radius.sm,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
    },
    deleteButtonText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
  });
}
```

- [ ] **Step 2: Den Rückgängig-Streifen für Bildschirme ohne „+"-Knopf öffnen**

`UndoBar` hält seit Phase 3 mit `FAB_CLEARANCE` Abstand zum unteren Rand, weil der „+"-Knopf sonst genau den Rückgängig-Knopf verdeckt. Der Verlaufsbildschirm hat keinen solchen Knopf; ohne diese Ergänzung schwebte der Streifen dort grundlos über dem Rand.

In `colitis-app/src/components/ui/UndoBar.tsx` die Props erweitern:

```tsx
interface UndoBarProps {
  /** Was geloescht wurde, etwa "Eintrag" oder "Medikament". */
  label: string;
  onUndo: () => void;
  /**
   * Ob der Streifen dem "+"-Knopf ausweichen muss. Bildschirme ohne diesen
   * Knopf setzen false; sonst bleibt unter dem Streifen eine leere Flaeche.
   */
  avoidsFloatingButton?: boolean;
}
```

Die Signatur und das Wurzelelement anpassen:

```tsx
export function UndoBar({ label, onUndo, avoidsFloatingButton = true }: UndoBarProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View
      style={[styles.bar, !avoidsFloatingButton && styles.barWithoutFloatingButton]}
      accessibilityRole="alert"
    >
```

Und in `makeStyles` nach `bar` ergänzen:

```tsx
    barWithoutFloatingButton: {
      marginBottom: tokens.spacing.md,
    },
```

Die vier vorhandenen Aufrufer setzen das Prop nicht und verhalten sich damit unverändert.

- [ ] **Step 3: Den Bildschirm um Löschen und Rückgängig erweitern**

In `colitis-app/app/(tabs)/medikamente/verlauf.tsx`:

Den Repository-Import erweitern:

```tsx
import {
  listMedications,
  listMedicationIntakes,
  deleteMedicationIntake,
} from '../../../src/features/medications/db/medicationsRepository';
```

Diese Importe ergänzen:

```tsx
import { UndoBar } from '../../../src/components/ui/UndoBar';
import { usePendingDeletion } from '../../../src/features/deletion/usePendingDeletion';
```

Den Zustand für die aufgeklappte Zeile ergänzen:

```tsx
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
```

Nach dem `useFocusEffect` und **vor** dem `useMemo` einfügen:

```tsx
  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (intakeId) => {
    try {
      const db = await createEncryptedDb();
      await deleteMedicationIntake(db, intakeId);
      setIntakes(await listMedicationIntakes(db, null));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Einnahme-Verlauf] Einnahme loeschen fehlgeschlagen:', deleteError);
      setError('Einnahme konnte nicht gelöscht werden.');
    }
  });

  // Die schwebende Einnahme faellt schon vor der Rechnung heraus: So
  // verschwindet ihre Zeile sofort, der Tageszaehler geht im selben Moment
  // zurueck, und ein zweiter Druck auf denselben Entfernen-Knopf ist gar
  // nicht erst moeglich.
  const visibleIntakes = useMemo(
    () => (pending === null ? intakes : intakes.filter((intake) => intake.id !== pending.id)),
    [intakes, pending]
  );
```

Das vorhandene `useMemo` für `summaries` auf `visibleIntakes` umstellen:

```tsx
  const summaries = useMemo(() => {
    const today = formatLocalDate(new Date());
    return buildDaySummaries(
      medications,
      visibleIntakes,
      periodStartDate(period, medications, today),
      today
    );
  }, [medications, visibleIntakes, period]);
```

In `renderBody` den Aufruf der Liste ersetzen:

```tsx
    return (
      <IntakeHistoryList
        summaries={summaries}
        medications={medications}
        expandedDate={expandedDate}
        onToggleDate={(date) => setExpandedDate((current) => (current === date ? null : date))}
        onDeleteIntake={(intakeId) => requestDelete({ id: intakeId, label: 'Einnahme' })}
      />
    );
```

Und direkt vor dem schließenden `</View>` des Bildschirms den Streifen einsetzen:

```tsx
      {pending !== null && (
        <UndoBar label={pending.label} onUndo={undo} avoidsFloatingButton={false} />
      )}
```

- [ ] **Step 4: Typprüfung**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 5: Gesamte Testsuite laufen lassen**

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 6: Auf tote Importe prüfen**

Weil `tsc` ungenutzte Importe nicht meldet, prüfe jede in diesem Zweig geänderte Datei von Hand: Kommt jeder importierte Bezeichner im Rumpf noch vor? Entferne, was übrig ist. Besonders zu prüfen: `medicationsRepository.ts` (`like` ist entfallen) und `medicationsRepository.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/medikamente/verlauf.tsx src/features/medications/components/IntakeHistoryList.tsx src/components/ui/UndoBar.tsx
git commit -m "feat: Einnahme im Verlauf entfernen, mit Rueckgaengig-Streifen"
```

---

## Selbstprüfung nach dem Plan

**Spec-Abdeckung**

| Spec-Abschnitt | Aufgabe |
|---|---|
| 1 · Was „fällig" heißt | 1 (`expectedDosesPerDay`, `isMedicationDueOn`) |
| 2 · Der Knopf zählt | 1 (`formatTakenButtonLabel`), 3 (Verdrahtung) |
| 3 · Zusammenfassungszeile | 1 (`buildTodaySummary`, `formatTodaySummaryLabel`), 3 (`TodaySummaryLine`) |
| 4 · Der Verlauf | 1 (`buildDaySummaries`, `periodStartDate`, Beschriftungen), 4 (Bildschirm) |
| 5 · Korrektur eines Fehlgriffs | 2 (`deleteMedicationIntake`), 5 (Aufklappen, Löschen, Rückgängig) |
| Zeitzonenfehler | 1 (`localDateOf`), 2 (`listMedicationIdsTakenOn` entfällt) |
| Leerzustände | 4 |
| Fehlerbehandlung | 3, 4, 5 |

**Typkonsistenz**

`MedicationIntake` wird in Aufgabe 1 in `types.ts` definiert und von Aufgabe 2 (Repository), 4 und 5 (Bildschirm) unverändert verwendet. `takenTodayCounts: Map<number, number>` heißt in Aufgabe 3 an beiden Enden gleich. `HistoryPeriod` ist `'30' | '90' | 'alles'` in Aufgabe 1 und 4.

**Bekannte Zwischenstände**

Nach Aufgabe 2 ist der Baum kurzzeitig nicht typrein, weil `index.tsx` noch die entfernte `listMedicationIdsTakenOn` aufruft. Aufgabe 3 löst das auf. Die Aufgaben 2 und 3 dürfen deshalb nicht in umgekehrter Reihenfolge ausgeführt werden.
