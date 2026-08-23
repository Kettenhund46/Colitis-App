# Arztbesuch vorbereiten — Umsetzungsplan (Phase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Tipp in der Arztbesuche-Liste erzeugt eine lesbare Zusammenfassung des Zeitraums seit dem jüngsten erfassten Besuch — Kennzahlen, Tagesbewertung, auffällige Phasen, Auslöser, Medikamentenstand — die sich als PDF teilen lässt.

**Architecture:** Alle Entscheidungen liegen in `src/features/doctorVisits/visitSummary.ts`. Das ist der Prüfgegenstand. Darüber zwei dünne Hüllen über derselben `VisitSummary`: der Bildschirm und ein HTML-Bauer fürs PDF. Vorhandene Rechenbausteine aus Tagebuch und Medikamenten werden benutzt, nicht nachgebaut.

**Tech Stack:** React Native 0.86.2 / Expo SDK 57, expo-router, expo-print, expo-sharing, TypeScript, Vitest (`environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-08-23-colitis-app-arztbesuch-vorbereiten-design.md`

## Global Constraints

- **Vitest läuft mit `environment: 'node'`.** Kein jsdom, kein `@testing-library/react-native`, kein `react-test-renderer`. Komponenten können weder gerendert noch getestet werden. Schreibe **keine** Komponententests und installiere **keine** Test-Bibliotheken. Getestet werden das reine Modul, die Datumshilfen und der HTML-Bauer.
- **Kein Schemawechsel, keine Migration, keine neue Repository-Funktion.** Gelesen wird ausschließlich mit `listDiaryEntries`, `listMedications`, `listMedicationIntakes`, `listDoctorVisits`, `getScreeningReminder`.
- **Keine Änderung an `src/features/backup/`** und keine Änderung an den drei vorhandenen PDF-Ausgaben.
- **Keine Deutung der Daten.** Keine Ursachen, keine Empfehlungen, keine Prognosen — nur Beschreibung.
- **Beim Medikamentenstand niemals „X von Y Dosen".** Es stehen Einnahmetage und Gesamtzahl. Die Sollmenge für vergangene Zeiträume kennt die App nicht verlässlich.
- **Alle Datumsrechnung lokal.** Ein Kalenderdatum `YYYY-MM-DD` wird ausschließlich mit `new Date(year, month - 1, day)` geparst, nie mit `new Date('2026-08-21')` — letzteres ist UTC und verschiebt den Tag.
- **Alle Nutzertexte deutsch**, wörtlich wie in den Aufgaben angegeben. Codebezeichner englisch.
- **Kommentare im Quelltext ohne Umlaute** (`Loeschen`, `naechster`). Nutzersichtbare Texte behalten ihre Umlaute.
- **`tsc` meldet keine ungenutzten Importe** (`noUnusedLocals` ist nicht gesetzt). Wer einen Import überflüssig macht, entfernt ihn selbst.
- **Fehler nie still schlucken:** `console.error` mit Präfix in eckigen Klammern plus Fehlerstreifen für den Nutzer.
- **Windows:** `npx.cmd`, nie `npx`.

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `colitis-app/src/lib/localDate.ts` | **neu** — lokale Kalendertage: formatieren, parsen, rechnen |
| `colitis-app/src/lib/localDate.test.ts` | **neu** |
| `colitis-app/src/features/medications/adherence.ts` | nutzt die geteilten Datumshilfen statt eigener |
| `colitis-app/src/features/diary/calendarLogic.ts` | `formatDateKey` wird Weiterreichung |
| `colitis-app/src/features/medications/medicationStatus.ts` | `formatLocalDate` wird Weiterreichung |
| `colitis-app/src/features/doctorVisits/visitSummary.ts` | **neu** — die gesamte Rechnung und alle Beschriftungen |
| `colitis-app/src/features/doctorVisits/visitSummary.test.ts` | **neu** |
| `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.ts` | `escapeHtml` wird exportiert |
| `colitis-app/src/features/doctorVisits/visitSummaryPdfBuilder.ts` | **neu** — dieselbe Zusammenfassung als HTML |
| `colitis-app/src/features/doctorVisits/visitSummaryPdfBuilder.test.ts` | **neu** |
| `colitis-app/src/features/doctorVisits/visitSummaryExport.ts` | **neu** — drucken und teilen |
| `colitis-app/src/features/doctorVisits/components/VisitSummaryView.tsx` | **neu** — die Darstellung |
| `colitis-app/app/(tabs)/tagebuch/arztbesuche/zusammenfassung.tsx` | **neu** — der Bildschirm |
| `colitis-app/app/(tabs)/tagebuch/_layout.tsx` | Route eintragen |
| `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx` | Einstiegsknopf |

Alle Befehle werden aus `D:/Claude/colitis-app` ausgeführt.

---

### Task 1: Geteilte Datumshilfen und der Zeitraum

**Files:**
- Create: `colitis-app/src/lib/localDate.ts`
- Test: `colitis-app/src/lib/localDate.test.ts`
- Modify: `colitis-app/src/features/medications/adherence.ts`
- Modify: `colitis-app/src/features/diary/calendarLogic.ts`
- Modify: `colitis-app/src/features/medications/medicationStatus.ts`
- Create: `colitis-app/src/features/doctorVisits/visitSummary.ts`
- Test: `colitis-app/src/features/doctorVisits/visitSummary.test.ts`

**Interfaces:**
- Consumes: `DoctorVisit` aus `./types`; `formatGermanDate` aus `./doctorVisitPassBuilder`
- Produces:
  - aus `src/lib/localDate.ts`: `formatLocalDateKey(date: Date): string`, `parseLocalDate(date: string): Date`, `addDays(date: Date, days: number): Date`, `eachDayInclusive(fromDate: string, toDate: string): string[]`
  - aus `visitSummary.ts`: `SummaryPeriod`, `determinePeriod(visits: DoctorVisit[], today: string): SummaryPeriod`, `formatPeriodLabel(period: SummaryPeriod): string`, Konstanten `DEFAULT_PERIOD_DAYS = 90`, `MIN_DAYS_FOR_FIGURES = 7`

Drei Funktionen zum Umgang mit lokalen Kalendertagen liegen heute dreifach im Baum: `formatDateKey` in `calendarLogic.ts`, `formatLocalDate` in `medicationStatus.ts` (Zeichen für Zeichen dieselbe Funktion), sowie `parseLocalDate` und `addDays` in `adherence.ts`. Diese Aufgabe legt sie an eine Stelle. Die beiden alten Namen bleiben als Weiterreichung bestehen, damit ihre rund zwanzig Aufrufer unangetastet bleiben.

- [ ] **Step 1: Test für die Datumshilfen schreiben**

Neu: `colitis-app/src/lib/localDate.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatLocalDateKey, parseLocalDate, addDays, eachDayInclusive } from './localDate';

describe('localDate', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  describe('formatLocalDateKey', () => {
    it('pads month and day to two digits', () => {
      expect(formatLocalDateKey(new Date(2026, 7, 5))).toBe('2026-08-05');
    });

    it('keeps the local day for a time just after midnight', () => {
      expect(formatLocalDateKey(new Date(2026, 7, 5, 0, 30))).toBe('2026-08-05');
    });
  });

  describe('parseLocalDate', () => {
    it('reads the string as a local calendar day', () => {
      const parsed = parseLocalDate('2026-08-05');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(5);
      expect(parsed.getHours()).toBe(0);
    });

    it('round-trips with formatLocalDateKey', () => {
      expect(formatLocalDateKey(parseLocalDate('2026-02-29'))).toBe('2026-03-01');
    });
  });

  describe('addDays', () => {
    it('crosses a month boundary', () => {
      expect(formatLocalDateKey(addDays(parseLocalDate('2026-08-31'), 1))).toBe('2026-09-01');
    });

    it('walks backwards across a year boundary', () => {
      expect(formatLocalDateKey(addDays(parseLocalDate('2027-01-01'), -1))).toBe('2026-12-31');
    });

    it('survives the spring daylight-saving change', () => {
      // In Europe/Berlin faellt die Nacht auf den 29.03.2026 um eine Stunde
      // kuerzer aus. Ueber Kalenderfelder gerechnet stoert das nicht.
      expect(formatLocalDateKey(addDays(parseLocalDate('2026-03-28'), 1))).toBe('2026-03-29');
      expect(formatLocalDateKey(addDays(parseLocalDate('2026-03-29'), 1))).toBe('2026-03-30');
    });
  });

  describe('eachDayInclusive', () => {
    it('includes both ends', () => {
      expect(eachDayInclusive('2026-08-03', '2026-08-06')).toEqual([
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
      ]);
    });

    it('returns the single day when both ends match', () => {
      expect(eachDayInclusive('2026-08-03', '2026-08-03')).toEqual(['2026-08-03']);
    });

    it('returns nothing when the range is inverted', () => {
      expect(eachDayInclusive('2026-08-06', '2026-08-03')).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/lib/localDate.test.ts`
Expected: FAIL — `Failed to resolve import "./localDate"`.

- [ ] **Step 3: Die Datumshilfen schreiben**

Neu: `colitis-app/src/lib/localDate.ts`

```ts
/**
 * Kalendertage, wie der Nutzer sie sieht -- also lokal, nicht UTC. Diese drei
 * Funktionen lagen vorher dreifach im Baum: in calendarLogic, medicationStatus
 * und adherence. Wer hier etwas aendert, aendert es fuer Tagebuch,
 * Medikamente und Arztbesuche zugleich.
 */

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ein Kalenderdatum als lokalen Tag lesen. new Date('2026-08-21') waere UTC
 * und wuerde den Tag in oestlichen Zeitzonen verschieben.
 */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Ueber Kalenderfelder rechnen, nicht ueber Millisekunden -- sonst geht die
 * Rechnung an den beiden Tagen der Zeitumstellung um eine Stunde daneben.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Alle Kalendertage von fromDate bis toDate, aufsteigend, beide eingeschlossen. */
export function eachDayInclusive(fromDate: string, toDate: string): string[] {
  const to = parseLocalDate(toDate);
  const days: string[] = [];

  let cursor = parseLocalDate(fromDate);
  while (cursor.getTime() <= to.getTime()) {
    days.push(formatLocalDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx.cmd vitest run src/lib/localDate.test.ts`
Expected: PASS, 10 Tests.

- [ ] **Step 5: Die drei Kopien auf die geteilte Stelle umstellen**

In `colitis-app/src/features/diary/calendarLogic.ts` die Funktion

```ts
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

ersetzen durch einen Import unter eigenem Namen plus dessen Weitergabe. Ganz oben in der Datei, zu den übrigen Importen:

```ts
import { formatLocalDateKey as formatDateKey } from '../../lib/localDate';
```

und im Rumpf, an der Stelle der gelöschten Funktion:

```ts
export { formatDateKey };
```

**Beide Zeilen sind nötig, nicht eine davon.** `groupEntriesByDay` in derselben Datei ruft `formatDateKey` selbst auf; eine reine `export … from`-Weiterleitung bindet aber keinen lokalen Namen und würde diesen Aufruf brechen.

In `colitis-app/src/features/medications/medicationStatus.ts` genauso: die Funktion

```ts
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

ersetzen durch

```ts
import { formatLocalDateKey as formatLocalDate } from '../../lib/localDate';
```

und im Rumpf

```ts
export { formatLocalDate };
```

Auch hier aus demselben Grund beides: `isMedicationActive` in derselben Datei ruft `formatLocalDate` auf.

In `colitis-app/src/features/medications/adherence.ts` die beiden Funktionen `parseLocalDate` und `addDays` samt ihrer Kommentare **löschen** und stattdessen importieren:

```ts
import { parseLocalDate, addDays } from '../../lib/localDate';
```

Sie waren dort exportiert, werden aber außerhalb von `adherence.ts` nirgends benutzt — der Export entfällt ersatzlos.

- [ ] **Step 6: Gesamte Testsuite laufen lassen**

Run: `npx.cmd vitest run`
Expected: PASS. Die Umstellung darf keinen vorhandenen Test brechen; die Funktionen sind zeichengleich.

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 7: Test für den Zeitraum schreiben**

Neu: `colitis-app/src/features/doctorVisits/visitSummary.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { determinePeriod, formatPeriodLabel } from './visitSummary';
import type { DoctorVisit } from './types';

function visit(overrides: Partial<DoctorVisit> & { id: number; visitDate: string }): DoctorVisit {
  return {
    doctorName: null,
    reason: null,
    note: null,
    nextAppointmentDate: null,
    ...overrides,
  };
}

describe('visitSummary', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  describe('determinePeriod', () => {
    it('starts at the most recent past visit', () => {
      const visits = [
        visit({ id: 1, visitDate: '2026-05-12', doctorName: 'Dr. Weber' }),
        visit({ id: 2, visitDate: '2026-02-03', doctorName: 'Dr. Klein' }),
      ];
      const period = determinePeriod(visits, '2026-08-23');
      expect(period.fromDate).toBe('2026-05-12');
      expect(period.toDate).toBe('2026-08-23');
    });

    it('does not care about the order the visits arrive in', () => {
      const visits = [
        visit({ id: 2, visitDate: '2026-02-03' }),
        visit({ id: 1, visitDate: '2026-05-12' }),
      ];
      expect(determinePeriod(visits, '2026-08-23').fromDate).toBe('2026-05-12');
    });

    it('ignores a visit dated in the future', () => {
      const visits = [
        visit({ id: 3, visitDate: '2026-11-04' }),
        visit({ id: 1, visitDate: '2026-05-12' }),
      ];
      expect(determinePeriod(visits, '2026-08-23').fromDate).toBe('2026-05-12');
    });

    it('takes a visit that happened today', () => {
      const visits = [visit({ id: 1, visitDate: '2026-08-23' })];
      expect(determinePeriod(visits, '2026-08-23').fromDate).toBe('2026-08-23');
    });

    it('falls back to the last 90 days without any visit', () => {
      const period = determinePeriod([], '2026-08-23');
      expect(period.fromDate).toBe('2026-05-26');
      expect(period.toDate).toBe('2026-08-23');
      expect(period.dayCount).toBe(90);
      expect(period.sinceVisitLabel).toBeNull();
    });

    it('falls back to the last 90 days when the only visit is in the future', () => {
      const visits = [visit({ id: 3, visitDate: '2026-11-04' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBeNull();
    });

    it('counts the days including both ends', () => {
      const visits = [visit({ id: 1, visitDate: '2026-08-21' })];
      expect(determinePeriod(visits, '2026-08-23').dayCount).toBe(3);
    });

    it('names the doctor in the label', () => {
      const visits = [visit({ id: 1, visitDate: '2026-05-12', doctorName: 'Dr. Weber' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBe(
        'seit dem Besuch bei Dr. Weber'
      );
    });

    it('falls back to the date when no doctor name is stored', () => {
      const visits = [visit({ id: 1, visitDate: '2026-05-12' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBe(
        'seit dem Besuch am 12.05.2026'
      );
    });

    it('treats a blank doctor name like none at all', () => {
      const visits = [visit({ id: 1, visitDate: '2026-05-12', doctorName: '   ' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBe(
        'seit dem Besuch am 12.05.2026'
      );
    });
  });

  describe('formatPeriodLabel', () => {
    it('names the range and the visit it follows', () => {
      const label = formatPeriodLabel({
        fromDate: '2026-05-12',
        toDate: '2026-08-23',
        dayCount: 104,
        sinceVisitLabel: 'seit dem Besuch bei Dr. Weber',
      });
      expect(label).toBe('12.05.2026 – 23.08.2026 · 104 Tage seit dem Besuch bei Dr. Weber');
    });

    it('names the fallback range without a visit', () => {
      const label = formatPeriodLabel({
        fromDate: '2026-05-26',
        toDate: '2026-08-23',
        dayCount: 90,
        sinceVisitLabel: null,
      });
      expect(label).toBe('26.05.2026 – 23.08.2026 · letzte 90 Tage');
    });
  });
});
```

- [ ] **Step 8: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummary.test.ts`
Expected: FAIL — `Failed to resolve import "./visitSummary"`.

- [ ] **Step 9: Zeitraum und Beschriftung schreiben**

Neu: `colitis-app/src/features/doctorVisits/visitSummary.ts`

```ts
import { addDays, eachDayInclusive, formatLocalDateKey, parseLocalDate } from '../../lib/localDate';
import { formatGermanDate } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';

/** Zeitraum, wenn noch kein Arztbesuch erfasst ist. */
export const DEFAULT_PERIOD_DAYS = 90;

/**
 * Unterhalb dieser Zahl erfasster Tage entfallen Kennzahlen, Phasen und
 * Ausloeser. Ein Mittelwert aus vier Eintraegen ueber drei Monate ist keine
 * Aussage, sondern eine irrefuehrende Zahl.
 */
export const MIN_DAYS_FOR_FIGURES = 7;

export interface SummaryPeriod {
  /** YYYY-MM-DD, lokal. */
  fromDate: string;
  /** YYYY-MM-DD, lokal -- heute. */
  toDate: string;
  /** Kalendertage einschliesslich beider Enden. */
  dayCount: number;
  /**
   * Woran der Zeitraum anschliesst, fertig formuliert. null bei der
   * 90-Tage-Regel; dann nennt formatPeriodLabel "letzte 90 Tage".
   */
  sinceVisitLabel: string | null;
}

function buildSinceVisitLabel(visit: DoctorVisit): string {
  if (visit.doctorName !== null && visit.doctorName.trim().length > 0) {
    return `seit dem Besuch bei ${visit.doctorName.trim()}`;
  }
  return `seit dem Besuch am ${formatGermanDate(visit.visitDate)}`;
}

export function determinePeriod(visits: DoctorVisit[], today: string): SummaryPeriod {
  // Ein vorab eingetragener Termin in der Zukunft taugt nicht als Beginn eines
  // Rueckblicks. Die Reihenfolge der Liste wird bewusst nicht vorausgesetzt.
  const pastVisits = visits.filter((visit) => visit.visitDate <= today);

  if (pastVisits.length === 0) {
    const fromDate = formatLocalDateKey(
      addDays(parseLocalDate(today), -(DEFAULT_PERIOD_DAYS - 1))
    );
    return { fromDate, toDate: today, dayCount: DEFAULT_PERIOD_DAYS, sinceVisitLabel: null };
  }

  const latestVisit = pastVisits.reduce((newest, candidate) =>
    candidate.visitDate > newest.visitDate ? candidate : newest
  );

  return {
    fromDate: latestVisit.visitDate,
    toDate: today,
    dayCount: eachDayInclusive(latestVisit.visitDate, today).length,
    sinceVisitLabel: buildSinceVisitLabel(latestVisit),
  };
}

export function formatPeriodLabel(period: SummaryPeriod): string {
  const range = `${formatGermanDate(period.fromDate)} – ${formatGermanDate(period.toDate)}`;
  const since =
    period.sinceVisitLabel === null
      ? `letzte ${period.dayCount} Tage`
      : `${period.dayCount} Tage ${period.sinceVisitLabel}`;
  return `${range} · ${since}`;
}
```

- [ ] **Step 10: Tests laufen lassen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummary.test.ts`
Expected: PASS, 12 Tests.

- [ ] **Step 11: Typprüfung und Gesamtsuite**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/localDate.ts src/lib/localDate.test.ts src/features/diary/calendarLogic.ts src/features/medications/medicationStatus.ts src/features/medications/adherence.ts src/features/doctorVisits/visitSummary.ts src/features/doctorVisits/visitSummary.test.ts
git commit -m "feat: geteilte Datumshilfen und Zeitraum der Zusammenfassung"
```

---

### Task 2: Kennzahlen und auffällige Phasen

**Files:**
- Modify: `colitis-app/src/features/doctorVisits/visitSummary.ts`
- Test: `colitis-app/src/features/doctorVisits/visitSummary.test.ts`

**Interfaces:**
- Consumes: `SummaryPeriod`, `MIN_DAYS_FOR_FIGURES` (Aufgabe 1); `eachDayInclusive`, `formatLocalDateKey` aus `../../lib/localDate`; `groupEntriesByDay`, `sumDayTotals`, `rateDayTotals` aus `../diary/calendarLogic`; `formatGermanDate` aus `./doctorVisitPassBuilder`
- Produces: `SummaryFigures`, `NotablePhase`, `entriesInPeriod`, `countDaysWithEntries`, `computeFigures`, `findNotablePhases`, `formatRatingLabel`, `formatPhaseLabel`, `formatSparseDataLabel`, Konstanten `MIN_PHASE_DAYS = 3`, `MAX_PHASES = 2`

- [ ] **Step 1: Tests schreiben**

In `colitis-app/src/features/doctorVisits/visitSummary.test.ts` den Import erweitern:

```ts
import {
  determinePeriod,
  formatPeriodLabel,
  computeFigures,
  findNotablePhases,
  formatRatingLabel,
  formatPhaseLabel,
  formatSparseDataLabel,
} from './visitSummary';
import type { DiaryEntryWithTriggers } from '../diary/types';
```

Und unterhalb der vorhandenen Hilfsfunktion `visit` diese zwei ergänzen:

```ts
function entry(
  overrides: Partial<DiaryEntryWithTriggers> & { id: number; occurredAt: string }
): DiaryEntryWithTriggers {
  return {
    stoolFrequency: 1,
    hasBlood: false,
    stoolConsistency: 'weich',
    painLevel: 0,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

/** Ein Zeitstempel, der einer bestimmten lokalen Uhrzeit entspricht. */
function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const PERIOD_AUGUST = {
  fromDate: '2026-08-01',
  toDate: '2026-08-20',
  dayCount: 20,
  sinceVisitLabel: null,
};
```

Am Ende des äußeren `describe('visitSummary', …)`-Blocks anfügen:

```ts
  describe('computeFigures', () => {
    it('returns null below seven days with entries', () => {
      const entries = [1, 2, 3, 4, 5, 6].map((day) =>
        entry({ id: day, occurredAt: localIso(2026, 8, day) })
      );
      expect(computeFigures(entries, PERIOD_AUGUST)).toBeNull();
    });

    it('computes at exactly seven days with entries', () => {
      const entries = [1, 2, 3, 4, 5, 6, 7].map((day) =>
        entry({ id: day, occurredAt: localIso(2026, 8, day) })
      );
      expect(computeFigures(entries, PERIOD_AUGUST)).not.toBeNull();
    });

    it('averages over days with entries, not over calendar days', () => {
      // Sieben Tage, je vier Stuehle -- der Schnitt ist 4, nicht 28/20.
      const entries = [1, 2, 3, 4, 5, 6, 7].map((day) =>
        entry({ id: day, occurredAt: localIso(2026, 8, day), stoolFrequency: 4 })
      );
      expect(computeFigures(entries, PERIOD_AUGUST)?.stoolsPerDay).toBe(4);
    });

    it('sums several entries of the same day into one day', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 9), stoolFrequency: 2 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 18), stoolFrequency: 3 }),
        ...[2, 3, 4, 5, 6, 7].map((day) =>
          entry({ id: day + 10, occurredAt: localIso(2026, 8, day), stoolFrequency: 5 })
        ),
      ];
      const figures = computeFigures(entries, PERIOD_AUGUST);
      // Sieben Tage, alle mit fuenf Stuehlen.
      expect(figures?.stoolsPerDay).toBe(5);
    });

    it('counts a day with blood once, however many entries it has', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 9), hasBlood: true }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 18), hasBlood: true }),
        ...[2, 3, 4, 5, 6, 7].map((day) => entry({ id: day + 10, occurredAt: localIso(2026, 8, day) })),
      ];
      expect(computeFigures(entries, PERIOD_AUGUST)?.daysWithBlood).toBe(1);
    });

    it('takes the worst pain level of each day', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 9), painLevel: 2 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 18), painLevel: 8 }),
        ...[2, 3, 4, 5, 6, 7].map((day) =>
          entry({ id: day + 10, occurredAt: localIso(2026, 8, day), painLevel: 0 })
        ),
      ];
      // 8 an einem Tag, 0 an sechs -- Schnitt 8/7 = 1,1.
      expect(computeFigures(entries, PERIOD_AUGUST)?.averagePainLevel).toBe(1.1);
    });

    it('counts the day ratings', () => {
      const entries = [
        ...[1, 2, 3, 4, 5].map((day) => entry({ id: day, occurredAt: localIso(2026, 8, day) })),
        entry({ id: 6, occurredAt: localIso(2026, 8, 6), painLevel: 5 }),
        entry({ id: 7, occurredAt: localIso(2026, 8, 7), hasBlood: true }),
      ];
      const figures = computeFigures(entries, PERIOD_AUGUST);
      expect(figures?.goodDays).toBe(5);
      expect(figures?.mediumDays).toBe(1);
      expect(figures?.badDays).toBe(1);
    });

    it('ignores entries outside the period', () => {
      const entries = [
        ...[1, 2, 3, 4, 5, 6, 7].map((day) => entry({ id: day, occurredAt: localIso(2026, 8, day) })),
        entry({ id: 99, occurredAt: localIso(2026, 7, 15), stoolFrequency: 40 }),
      ];
      expect(computeFigures(entries, PERIOD_AUGUST)?.stoolsPerDay).toBe(1);
    });
  });

  describe('findNotablePhases', () => {
    function badDay(id: number, day: number, withBlood = false): DiaryEntryWithTriggers {
      return entry({ id, occurredAt: localIso(2026, 8, day), painLevel: 8, hasBlood: withBlood });
    }

    function goodDay(id: number, day: number): DiaryEntryWithTriggers {
      return entry({ id, occurredAt: localIso(2026, 8, day) });
    }

    it('finds a run of three affected days', () => {
      const phases = findNotablePhases([badDay(1, 5), badDay(2, 6), badDay(3, 7)], PERIOD_AUGUST);
      expect(phases).toHaveLength(1);
      expect(phases[0].fromDate).toBe('2026-08-05');
      expect(phases[0].toDate).toBe('2026-08-07');
      expect(phases[0].affectedDays).toBe(3);
      expect(phases[0].spanDays).toBe(3);
    });

    it('ignores a run of two', () => {
      expect(findNotablePhases([badDay(1, 5), badDay(2, 6)], PERIOD_AUGUST)).toEqual([]);
    });

    it('lets a good day break the run', () => {
      const entries = [badDay(1, 5), badDay(2, 6), goodDay(3, 7), badDay(4, 8)];
      expect(findNotablePhases(entries, PERIOD_AUGUST)).toEqual([]);
    });

    it('does not let an unrecorded day break the run', () => {
      // Am 6. wurde nichts erfasst.
      const phases = findNotablePhases([badDay(1, 5), badDay(2, 7), badDay(3, 8)], PERIOD_AUGUST);
      expect(phases).toHaveLength(1);
      expect(phases[0].affectedDays).toBe(3);
      expect(phases[0].spanDays).toBe(4);
    });

    it('starts and ends on an affected day', () => {
      // Am 4. und am 9. wurde nichts erfasst -- sie gehoeren nicht zur Strecke.
      const phases = findNotablePhases([badDay(1, 5), badDay(2, 6), badDay(3, 8)], PERIOD_AUGUST);
      expect(phases[0].fromDate).toBe('2026-08-05');
      expect(phases[0].toDate).toBe('2026-08-08');
    });

    it('counts the days with blood inside the phase', () => {
      const phases = findNotablePhases(
        [badDay(1, 5, true), badDay(2, 6), badDay(3, 7, true)],
        PERIOD_AUGUST
      );
      expect(phases[0].daysWithBlood).toBe(2);
    });

    it('returns at most two, the ones with the most affected days', () => {
      const entries = [
        badDay(1, 2), badDay(2, 3), badDay(3, 4),
        goodDay(4, 5),
        badDay(5, 7), badDay(6, 8), badDay(7, 9), badDay(8, 10), badDay(9, 11),
        goodDay(10, 12),
        badDay(11, 14), badDay(12, 15), badDay(13, 16), badDay(14, 17),
      ];
      const phases = findNotablePhases(entries, PERIOD_AUGUST);
      expect(phases).toHaveLength(2);
      expect(phases.map((phase) => phase.affectedDays)).toEqual([5, 4]);
    });

    it('returns the chosen phases oldest first', () => {
      const entries = [
        badDay(1, 2), badDay(2, 3), badDay(3, 4), badDay(4, 5),
        goodDay(5, 6),
        badDay(6, 8), badDay(7, 9), badDay(8, 10), badDay(9, 11), badDay(10, 12),
      ];
      const phases = findNotablePhases(entries, PERIOD_AUGUST);
      expect(phases[0].fromDate).toBe('2026-08-02');
      expect(phases[1].fromDate).toBe('2026-08-08');
    });

    it('returns nothing when no run is long enough', () => {
      expect(findNotablePhases([goodDay(1, 5), goodDay(2, 6)], PERIOD_AUGUST)).toEqual([]);
    });
  });

  describe('labels', () => {
    it('formatRatingLabel names all three counts', () => {
      const label = formatRatingLabel({
        stoolsPerDay: 3.2,
        daysWithBlood: 12,
        averagePainLevel: 2.4,
        goodDays: 71,
        mediumDays: 18,
        badDays: 7,
      });
      expect(label).toBe('71 gut · 18 mittel · 7 schub-verdächtig');
    });

    it('formatPhaseLabel names range, counts and blood', () => {
      const label = formatPhaseLabel({
        fromDate: '2026-07-03',
        toDate: '2026-07-14',
        spanDays: 12,
        affectedDays: 8,
        daysWithBlood: 6,
      });
      expect(label).toBe(
        '03.07.2026 – 14.07.2026: an 8 von 12 Tagen mittel oder schub-verdächtig, an 6 Tagen Blut vermerkt.'
      );
    });

    it('formatPhaseLabel omits the blood clause at zero', () => {
      const label = formatPhaseLabel({
        fromDate: '2026-07-03',
        toDate: '2026-07-05',
        spanDays: 3,
        affectedDays: 3,
        daysWithBlood: 0,
      });
      expect(label).toBe('03.07.2026 – 05.07.2026: an 3 von 3 Tagen mittel oder schub-verdächtig.');
    });

    it('formatSparseDataLabel names both numbers', () => {
      expect(formatSparseDataLabel(4, 103)).toBe(
        'An 4 von 103 Tagen wurde etwas erfasst — zu wenig für eine Auswertung des Zeitraums.'
      );
    });
  });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummary.test.ts`
Expected: FAIL — `computeFigures is not a function`.

- [ ] **Step 3: Kennzahlen und Phasen schreiben**

In `colitis-app/src/features/doctorVisits/visitSummary.ts` die Importe erweitern:

```ts
import { groupEntriesByDay, rateDayTotals, sumDayTotals } from '../diary/calendarLogic';
import type { DiaryEntryWithTriggers } from '../diary/types';
```

Und ans Ende der Datei anfügen:

```ts
/** Mindestzahl betroffener Tage, damit eine Strecke genannt wird. */
export const MIN_PHASE_DAYS = 3;

/** Wie viele Strecken hoechstens genannt werden. */
export const MAX_PHASES = 2;

export interface SummaryFigures {
  stoolsPerDay: number;
  daysWithBlood: number;
  averagePainLevel: number;
  goodDays: number;
  mediumDays: number;
  badDays: number;
}

export interface NotablePhase {
  /** Erster und letzter betroffener Tag -- nie ein nicht erfasster. */
  fromDate: string;
  toDate: string;
  /** Kalendertage von fromDate bis toDate, beide eingeschlossen. */
  spanDays: number;
  /** Davon Tage mit Bewertung medium oder bad. Der Rest wurde nicht erfasst. */
  affectedDays: number;
  daysWithBlood: number;
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function entriesInPeriod(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): DiaryEntryWithTriggers[] {
  return entries.filter((entry) => {
    const day = formatLocalDateKey(new Date(entry.occurredAt));
    return day >= period.fromDate && day <= period.toDate;
  });
}

export function countDaysWithEntries(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): number {
  return groupEntriesByDay(entriesInPeriod(entries, period)).size;
}

export function computeFigures(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): SummaryFigures | null {
  const byDay = groupEntriesByDay(entriesInPeriod(entries, period));
  if (byDay.size < MIN_DAYS_FOR_FIGURES) {
    return null;
  }

  let totalStools = 0;
  let totalWorstPain = 0;
  let daysWithBlood = 0;
  let goodDays = 0;
  let mediumDays = 0;
  let badDays = 0;

  for (const dayEntries of byDay.values()) {
    const totals = sumDayTotals(dayEntries);
    totalStools += totals.totalStoolFrequency;
    totalWorstPain += totals.worstPainLevel;
    if (totals.hasBlood) {
      daysWithBlood += 1;
    }
    const rating = rateDayTotals(totals);
    if (rating === 'good') {
      goodDays += 1;
    } else if (rating === 'medium') {
      mediumDays += 1;
    } else {
      badDays += 1;
    }
  }

  // Geteilt wird durch die Tage MIT Eintrag, nicht durch die Kalendertage.
  // Sonst drueckt jede Erfassungsluecke den Schnitt und taeuscht Besserung vor.
  return {
    stoolsPerDay: roundToOne(totalStools / byDay.size),
    daysWithBlood,
    averagePainLevel: roundToOne(totalWorstPain / byDay.size),
    goodDays,
    mediumDays,
    badDays,
  };
}

export function findNotablePhases(
  entries: DiaryEntryWithTriggers[],
  period: SummaryPeriod
): NotablePhase[] {
  const byDay = groupEntriesByDay(entriesInPeriod(entries, period));
  const found: NotablePhase[] = [];

  let startDate: string | null = null;
  let lastAffectedDate: string | null = null;
  let affectedDays = 0;
  let daysWithBlood = 0;

  function closeRun() {
    if (startDate !== null && lastAffectedDate !== null && affectedDays >= MIN_PHASE_DAYS) {
      found.push({
        fromDate: startDate,
        toDate: lastAffectedDate,
        spanDays: eachDayInclusive(startDate, lastAffectedDate).length,
        affectedDays,
        daysWithBlood,
      });
    }
    startDate = null;
    lastAffectedDate = null;
    affectedDays = 0;
    daysWithBlood = 0;
  }

  for (const date of eachDayInclusive(period.fromDate, period.toDate)) {
    const dayEntries = byDay.get(date);
    if (dayEntries === undefined) {
      // Ein nicht erfasster Tag unterbricht die Strecke nicht. Er verlaengert
      // sie auch nicht von sich aus -- die Spannweite ergibt sich am Ende aus
      // erstem und letztem betroffenen Tag.
      continue;
    }

    const totals = sumDayTotals(dayEntries);
    if (rateDayTotals(totals) === 'good') {
      closeRun();
      continue;
    }

    if (startDate === null) {
      startDate = date;
    }
    lastAffectedDate = date;
    affectedDays += 1;
    if (totals.hasBlood) {
      daysWithBlood += 1;
    }
  }
  closeRun();

  // Ausgewaehlt wird nach betroffenen Tagen, ausgegeben in zeitlicher Folge.
  const chosen = [...found]
    .sort((a, b) => b.affectedDays - a.affectedDays || b.fromDate.localeCompare(a.fromDate))
    .slice(0, MAX_PHASES);

  return chosen.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
}

export function formatRatingLabel(figures: SummaryFigures): string {
  return `${figures.goodDays} gut · ${figures.mediumDays} mittel · ${figures.badDays} schub-verdächtig`;
}

export function formatPhaseLabel(phase: NotablePhase): string {
  const range = `${formatGermanDate(phase.fromDate)} – ${formatGermanDate(phase.toDate)}`;
  const blood =
    phase.daysWithBlood > 0 ? `, an ${phase.daysWithBlood} Tagen Blut vermerkt` : '';
  return `${range}: an ${phase.affectedDays} von ${phase.spanDays} Tagen mittel oder schub-verdächtig${blood}.`;
}

export function formatSparseDataLabel(daysWithEntries: number, dayCount: number): string {
  return `An ${daysWithEntries} von ${dayCount} Tagen wurde etwas erfasst — zu wenig für eine Auswertung des Zeitraums.`;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Typprüfung und Gesamtsuite**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/doctorVisits/visitSummary.ts src/features/doctorVisits/visitSummary.test.ts
git commit -m "feat: Kennzahlen und auffaellige Phasen der Zusammenfassung"
```

---

### Task 3: Auslöser, Medikamentenstand und Zusammenbau

**Files:**
- Modify: `colitis-app/src/features/doctorVisits/visitSummary.ts`
- Test: `colitis-app/src/features/doctorVisits/visitSummary.test.ts`

**Interfaces:**
- Consumes: alles aus Aufgabe 1 und 2; `computeTriggerPatterns` aus `../diary/analysis`; `labelFor`, `TRIGGER_CATEGORY_OPTIONS` aus `../diary/constants`; `isMedicationDueOn`, `localDateOf` aus `../medications/adherence`; `Medication`, `MedicationIntake`, `ScreeningReminder` aus `../medications/types`
- Produces: `TriggerShare`, `MedicationSummaryLine`, `VisitSummary`, `VisitSummaryInput`, `computeTriggerShares`, `buildMedicationLines`, `formatMedicationIntakeLabel`, `buildVisitSummary`, Konstante `MAX_TRIGGERS = 3`

- [ ] **Step 1: Tests schreiben**

In `colitis-app/src/features/doctorVisits/visitSummary.test.ts` den Import erweitern:

```ts
import {
  determinePeriod,
  formatPeriodLabel,
  computeFigures,
  findNotablePhases,
  formatRatingLabel,
  formatPhaseLabel,
  formatSparseDataLabel,
  computeTriggerShares,
  buildMedicationLines,
  formatMedicationIntakeLabel,
  buildVisitSummary,
} from './visitSummary';
import type { Medication, MedicationIntake } from '../medications/types';
```

Und diese Hilfsfunktionen zu den vorhandenen ergänzen:

```ts
function medication(
  overrides: Partial<Medication> & { id: number; name: string }
): Medication {
  return {
    dose: '500 mg',
    schedule: '3x täglich',
    startDate: '2026-08-01',
    endDate: null,
    sideEffectsNote: null,
    reminderTimes: [],
    ...overrides,
  };
}

function intake(id: number, medicationId: number, day: number, hour = 9): MedicationIntake {
  return { id, medicationId, takenAt: localIso(2026, 8, day, hour) };
}
```

Am Ende des äußeren `describe`-Blocks anfügen:

```ts
  describe('computeTriggerShares', () => {
    it('states the share of entries that named the trigger', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1), triggerCategories: ['stress'] }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 2), triggerCategories: ['stress'] }),
        entry({ id: 3, occurredAt: localIso(2026, 8, 3), triggerCategories: ['schlaf'] }),
        entry({ id: 4, occurredAt: localIso(2026, 8, 4) }),
      ];
      expect(computeTriggerShares(entries)).toEqual([
        { label: 'Stress', percent: 50 },
        { label: 'Schlaf', percent: 25 },
      ]);
    });

    it('returns at most three, highest first', () => {
      const entries = [
        entry({
          id: 1,
          occurredAt: localIso(2026, 8, 1),
          triggerCategories: ['stress', 'schlaf', 'ernaehrung', 'sonstiges'],
        }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 2), triggerCategories: ['stress'] }),
      ];
      const shares = computeTriggerShares(entries);
      expect(shares).toHaveLength(3);
      expect(shares[0].label).toBe('Stress');
      expect(shares[0].percent).toBe(100);
    });

    it('returns nothing without entries', () => {
      expect(computeTriggerShares([])).toEqual([]);
    });
  });

  describe('buildMedicationLines', () => {
    it('skips a medication that did not run in the period', () => {
      const older = medication({ id: 1, name: 'Prednisolon', startDate: '2026-01-01', endDate: '2026-02-01' });
      expect(buildMedicationLines([older], [], PERIOD_AUGUST)).toEqual([]);
    });

    it('uses the days it actually ran as the denominator', () => {
      // Laeuft vom 1. bis zum 10., der Zeitraum geht bis zum 20.
      const ended = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-08-10' });
      const lines = buildMedicationLines([ended], [], PERIOD_AUGUST);
      expect(lines[0].dueDays).toBe(10);
    });

    it('counts a day with intake once, however many intakes it has', () => {
      const running = medication({ id: 1, name: 'Mesalazin' });
      const intakes = [intake(1, 1, 3, 8), intake(2, 1, 3, 13), intake(3, 1, 3, 19)];
      const lines = buildMedicationLines([running], intakes, PERIOD_AUGUST);
      expect(lines[0].daysWithIntake).toBe(1);
      expect(lines[0].totalIntakes).toBe(3);
    });

    it('ignores intakes of another medication', () => {
      const running = medication({ id: 1, name: 'Mesalazin' });
      const lines = buildMedicationLines([running], [intake(1, 2, 3)], PERIOD_AUGUST);
      expect(lines[0].totalIntakes).toBe(0);
    });

    it('ignores intakes outside the period', () => {
      const running = medication({ id: 1, name: 'Mesalazin' });
      const outside: MedicationIntake = {
        id: 9,
        medicationId: 1,
        takenAt: new Date(2026, 6, 15, 9).toISOString(),
      };
      expect(buildMedicationLines([running], [outside], PERIOD_AUGUST)[0].totalIntakes).toBe(0);
    });

    it('carries dose, schedule and end date', () => {
      const ended = medication({
        id: 1,
        name: 'Prednisolon',
        dose: '20 mg',
        schedule: 'morgens',
        endDate: '2026-08-10',
      });
      const line = buildMedicationLines([ended], [], PERIOD_AUGUST)[0];
      expect(line.name).toBe('Prednisolon');
      expect(line.dose).toBe('20 mg');
      expect(line.schedule).toBe('morgens');
      expect(line.endDate).toBe('2026-08-10');
    });
  });

  describe('formatMedicationIntakeLabel', () => {
    it('names days with intake and the total', () => {
      const label = formatMedicationIntakeLabel({
        name: 'Mesalazin',
        dose: '500 mg',
        schedule: '3x täglich',
        startDate: '2026-05-04',
        endDate: null,
        dueDays: 103,
        daysWithIntake: 96,
        totalIntakes: 268,
      });
      expect(label).toBe('An 96 von 103 Tagen erfasst, 268 Einnahmen');
    });
  });

  describe('buildVisitSummary', () => {
    const sevenGoodDays = [1, 2, 3, 4, 5, 6, 7].map((day) =>
      entry({ id: day, occurredAt: localIso(2026, 8, day), triggerCategories: ['stress'] })
    );

    it('assembles period, figures, triggers and medications', () => {
      const summary = buildVisitSummary({
        entries: sevenGoodDays,
        medications: [medication({ id: 1, name: 'Mesalazin' })],
        intakes: [intake(1, 1, 3)],
        visits: [visit({ id: 1, visitDate: '2026-08-01', doctorName: 'Dr. Weber' })],
        screening: null,
        today: '2026-08-20',
      });

      expect(summary.period.fromDate).toBe('2026-08-01');
      expect(summary.daysWithEntries).toBe(7);
      expect(summary.figures).not.toBeNull();
      expect(summary.triggers[0].label).toBe('Stress');
      expect(summary.medications).toHaveLength(1);
      expect(summary.isEmpty).toBe(false);
    });

    it('drops figures, phases and triggers when the period is too sparse', () => {
      const summary = buildVisitSummary({
        entries: sevenGoodDays.slice(0, 3),
        medications: [],
        intakes: [],
        visits: [visit({ id: 1, visitDate: '2026-08-01' })],
        screening: null,
        today: '2026-08-20',
      });

      expect(summary.figures).toBeNull();
      expect(summary.phases).toEqual([]);
      expect(summary.triggers).toEqual([]);
      expect(summary.daysWithEntries).toBe(3);
    });

    it('is empty without entries and without medications', () => {
      const summary = buildVisitSummary({
        entries: [],
        medications: [],
        intakes: [],
        visits: [visit({ id: 1, visitDate: '2026-08-01' })],
        screening: null,
        today: '2026-08-20',
      });
      expect(summary.isEmpty).toBe(true);
    });

    it('is not empty when only a medication is present', () => {
      const summary = buildVisitSummary({
        entries: [],
        medications: [medication({ id: 1, name: 'Mesalazin' })],
        intakes: [],
        visits: [visit({ id: 1, visitDate: '2026-08-01' })],
        screening: null,
        today: '2026-08-20',
      });
      expect(summary.isEmpty).toBe(false);
    });

    it('carries the next screening date', () => {
      const summary = buildVisitSummary({
        entries: [],
        medications: [],
        intakes: [],
        visits: [],
        screening: { id: 1, intervalMonths: 12, nextDueDate: '2027-01-15', note: null, notificationId: null },
        today: '2026-08-20',
      });
      expect(summary.nextScreeningDate).toBe('2027-01-15');
    });
  });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummary.test.ts`
Expected: FAIL — `computeTriggerShares is not a function`.

- [ ] **Step 3: Auslöser, Medikamentenstand und Zusammenbau schreiben**

In `colitis-app/src/features/doctorVisits/visitSummary.ts` die Importe erweitern:

```ts
import { computeTriggerPatterns } from '../diary/analysis';
import { labelFor, TRIGGER_CATEGORY_OPTIONS } from '../diary/constants';
import { isMedicationDueOn, localDateOf } from '../medications/adherence';
import type { Medication, MedicationIntake, ScreeningReminder } from '../medications/types';
```

Und ans Ende der Datei anfügen:

```ts
/** Wie viele Ausloeser hoechstens genannt werden. */
export const MAX_TRIGGERS = 3;

export interface TriggerShare {
  label: string;
  /** Anteil der Eintraege im Zeitraum, die diesen Ausloeser nannten. */
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
  /** null, wenn weniger als MIN_DAYS_FOR_FIGURES Tage mit Eintrag vorliegen. */
  figures: SummaryFigures | null;
  phases: NotablePhase[];
  triggers: TriggerShare[];
  medications: MedicationSummaryLine[];
  nextScreeningDate: string | null;
  /** Kein Eintrag und kein Medikament im Zeitraum. */
  isEmpty: boolean;
}

export interface VisitSummaryInput {
  entries: DiaryEntryWithTriggers[];
  medications: Medication[];
  intakes: MedicationIntake[];
  visits: DoctorVisit[];
  screening: ScreeningReminder | null;
  /** Heutiger Kalendertag, YYYY-MM-DD lokal. */
  today: string;
}

export function computeTriggerShares(entries: DiaryEntryWithTriggers[]): TriggerShare[] {
  if (entries.length === 0) {
    return [];
  }

  return computeTriggerPatterns(entries)
    .map((stat) => ({
      label: labelFor(TRIGGER_CATEGORY_OPTIONS, stat.category),
      percent: Math.round((stat.entryCount / entries.length) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, MAX_TRIGGERS);
}

export function buildMedicationLines(
  medications: Medication[],
  intakes: MedicationIntake[],
  period: SummaryPeriod
): MedicationSummaryLine[] {
  const periodDays = eachDayInclusive(period.fromDate, period.toDate);
  const lines: MedicationSummaryLine[] = [];

  for (const medication of medications) {
    const dueDays = periodDays.filter((date) => isMedicationDueOn(medication, date));
    if (dueDays.length === 0) {
      // Lief in diesem Zeitraum gar nicht -- gehoert nicht ins Dokument.
      continue;
    }

    const dueDaySet = new Set(dueDays);
    const relevantDays: string[] = [];
    for (const intake of intakes) {
      if (intake.medicationId !== medication.id) {
        continue;
      }
      const day = localDateOf(intake.takenAt);
      if (dueDaySet.has(day)) {
        relevantDays.push(day);
      }
    }

    lines.push({
      name: medication.name,
      dose: medication.dose,
      schedule: medication.schedule,
      startDate: medication.startDate,
      endDate: medication.endDate,
      dueDays: dueDays.length,
      daysWithIntake: new Set(relevantDays).size,
      totalIntakes: relevantDays.length,
    });
  }

  return lines;
}

export function formatMedicationIntakeLabel(line: MedicationSummaryLine): string {
  return `An ${line.daysWithIntake} von ${line.dueDays} Tagen erfasst, ${line.totalIntakes} Einnahmen`;
}

export function buildVisitSummary(input: VisitSummaryInput): VisitSummary {
  const period = determinePeriod(input.visits, input.today);
  const entries = entriesInPeriod(input.entries, period);
  const daysWithEntries = countDaysWithEntries(input.entries, period);
  const figures = computeFigures(input.entries, period);
  const medications = buildMedicationLines(input.medications, input.intakes, period);

  // Die drei haengen zusammen: Ist die Datenlage zu duenn fuer Kennzahlen, ist
  // sie es auch fuer Phasen und Ausloeser.
  return {
    period,
    daysWithEntries,
    figures,
    phases: figures === null ? [] : findNotablePhases(input.entries, period),
    triggers: figures === null ? [] : computeTriggerShares(entries),
    medications,
    nextScreeningDate: input.screening === null ? null : input.screening.nextDueDate,
    isEmpty: daysWithEntries === 0 && medications.length === 0,
  };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Typprüfung und Gesamtsuite**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/doctorVisits/visitSummary.ts src/features/doctorVisits/visitSummary.test.ts
git commit -m "feat: Ausloeser, Medikamentenstand und Zusammenbau der Zusammenfassung"
```

---

### Task 4: Die Zusammenfassung als PDF

**Files:**
- Modify: `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.ts:3-9`
- Create: `colitis-app/src/features/doctorVisits/visitSummaryPdfBuilder.ts`
- Test: `colitis-app/src/features/doctorVisits/visitSummaryPdfBuilder.test.ts`
- Create: `colitis-app/src/features/doctorVisits/visitSummaryExport.ts`

**Interfaces:**
- Consumes: `VisitSummary` und alle `format…`-Funktionen aus `./visitSummary` (Aufgaben 1–3); `escapeHtml`, `formatGermanDate` aus `./doctorVisitPassBuilder`
- Produces: `buildVisitSummaryHtml(summary: VisitSummary, today: Date): string`, `exportVisitSummary(summary: VisitSummary): Promise<void>`

- [ ] **Step 1: `escapeHtml` exportierbar machen**

In `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.ts` aus

```ts
function escapeHtml(value: string): string {
```

wird

```ts
export function escapeHtml(value: string): string {
```

Sonst nichts an der Datei ändern.

- [ ] **Step 2: Test schreiben**

Neu: `colitis-app/src/features/doctorVisits/visitSummaryPdfBuilder.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildVisitSummaryHtml } from './visitSummaryPdfBuilder';
import type { VisitSummary } from './visitSummary';

const TODAY = new Date(2026, 7, 23);

function summary(overrides: Partial<VisitSummary> = {}): VisitSummary {
  return {
    period: {
      fromDate: '2026-05-12',
      toDate: '2026-08-23',
      dayCount: 104,
      sinceVisitLabel: 'seit dem Besuch bei Dr. Weber',
    },
    daysWithEntries: 96,
    figures: {
      stoolsPerDay: 3.2,
      daysWithBlood: 12,
      averagePainLevel: 2.4,
      goodDays: 71,
      mediumDays: 18,
      badDays: 7,
    },
    phases: [],
    triggers: [],
    medications: [],
    nextScreeningDate: null,
    isEmpty: false,
    ...overrides,
  };
}

describe('buildVisitSummaryHtml', () => {
  it('names the period', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('12.05.2026 – 23.08.2026 · 104 Tage seit dem Besuch bei Dr. Weber');
  });

  it('shows the four figures', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('3,2');
    expect(html).toContain('12');
    expect(html).toContain('2,4');
    expect(html).toContain('96 von 104');
  });

  it('shows the day ratings', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('71 gut · 18 mittel · 7 schub-verdächtig');
  });

  it('replaces the figures with the hint when the period is too sparse', () => {
    const html = buildVisitSummaryHtml(summary({ figures: null, daysWithEntries: 4 }), TODAY);
    expect(html).toContain('An 4 von 104 Tagen wurde etwas erfasst');
    expect(html).not.toContain('schub-verdächtig');
  });

  it('lists the notable phases', () => {
    const html = buildVisitSummaryHtml(
      summary({
        phases: [
          { fromDate: '2026-07-03', toDate: '2026-07-14', spanDays: 12, affectedDays: 8, daysWithBlood: 6 },
        ],
      }),
      TODAY
    );
    expect(html).toContain('03.07.2026 – 14.07.2026: an 8 von 12 Tagen');
  });

  it('says so when there is no notable phase', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('Keine zusammenhängende auffällige Phase.');
  });

  it('lists the triggers with their share', () => {
    const html = buildVisitSummaryHtml(
      summary({ triggers: [{ label: 'Stress', percent: 61 }] }),
      TODAY
    );
    expect(html).toContain('Stress (61 %)');
  });

  it('lists a medication with its intake line', () => {
    const html = buildVisitSummaryHtml(
      summary({
        medications: [
          {
            name: 'Mesalazin',
            dose: '500 mg',
            schedule: '3x täglich',
            startDate: '2026-05-04',
            endDate: null,
            dueDays: 104,
            daysWithIntake: 96,
            totalIntakes: 268,
          },
        ],
      }),
      TODAY
    );
    expect(html).toContain('Mesalazin');
    expect(html).toContain('An 96 von 104 Tagen erfasst, 268 Einnahmen');
  });

  it('marks an ended medication with its end date', () => {
    const html = buildVisitSummaryHtml(
      summary({
        medications: [
          {
            name: 'Prednisolon',
            dose: '20 mg',
            schedule: 'morgens',
            startDate: '2026-05-04',
            endDate: '2026-08-08',
            dueDays: 88,
            daysWithIntake: 88,
            totalIntakes: 88,
          },
        ],
      }),
      TODAY
    );
    expect(html).toContain('beendet am 08.08.2026');
  });

  it('shows the screening date only when one is stored', () => {
    expect(buildVisitSummaryHtml(summary({ nextScreeningDate: '2027-01-15' }), TODAY)).toContain(
      'Nächste Vorsorge-Koloskopie: 15.01.2027'
    );
    expect(buildVisitSummaryHtml(summary(), TODAY)).not.toContain('Vorsorge-Koloskopie');
  });

  it('escapes markup in a medication name', () => {
    const html = buildVisitSummaryHtml(
      summary({
        medications: [
          {
            name: '<script>alert(1)</script>',
            dose: '1',
            schedule: '1',
            startDate: '2026-05-04',
            endDate: null,
            dueDays: 1,
            daysWithIntake: 1,
            totalIntakes: 1,
          },
        ],
      }),
      TODAY
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('carries the creation date and the origin note', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('Erstellt am 23.08.2026');
    expect(html).toContain('Die Angaben stammen aus einem selbstgeführten Tagebuch.');
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummaryPdfBuilder.test.ts`
Expected: FAIL — `Failed to resolve import "./visitSummaryPdfBuilder"`.

- [ ] **Step 4: Den HTML-Bauer schreiben**

Neu: `colitis-app/src/features/doctorVisits/visitSummaryPdfBuilder.ts`

```ts
import { escapeHtml, formatGermanDate } from './doctorVisitPassBuilder';
import {
  formatMedicationIntakeLabel,
  formatPeriodLabel,
  formatPhaseLabel,
  formatRatingLabel,
  formatSparseDataLabel,
} from './visitSummary';
import type { MedicationSummaryLine, VisitSummary } from './visitSummary';

/** Deutsche Schreibweise mit Komma statt Punkt. */
function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function buildFiguresSection(summary: VisitSummary): string {
  if (summary.figures === null) {
    return `<p class="sparse">${escapeHtml(
      formatSparseDataLabel(summary.daysWithEntries, summary.period.dayCount)
    )}</p>`;
  }

  const figures = summary.figures;
  return `
    <div class="kpis">
      <div class="kpi"><span class="n">${formatDecimal(figures.stoolsPerDay)}</span><span class="l">Stühle pro Tag</span></div>
      <div class="kpi"><span class="n">${figures.daysWithBlood}</span><span class="l">Tage mit Blut</span></div>
      <div class="kpi"><span class="n">${formatDecimal(figures.averagePainLevel)}</span><span class="l">Schmerz von 10</span></div>
      <div class="kpi"><span class="n">${summary.daysWithEntries} von ${summary.period.dayCount}</span><span class="l">Tagen erfasst</span></div>
    </div>
    <h2>Tagesbewertung</h2>
    <p>${escapeHtml(formatRatingLabel(figures))}</p>
  `;
}

function buildPhasesSection(summary: VisitSummary): string {
  if (summary.figures === null) {
    return '';
  }
  const body =
    summary.phases.length === 0
      ? '<p>Keine zusammenhängende auffällige Phase.</p>'
      : summary.phases.map((phase) => `<p>${escapeHtml(formatPhaseLabel(phase))}</p>`).join('\n');
  return `<h2>Auffällige Phasen</h2>${body}`;
}

function buildTriggersSection(summary: VisitSummary): string {
  if (summary.figures === null || summary.triggers.length === 0) {
    return '';
  }
  const list = summary.triggers
    .map((share) => `${escapeHtml(share.label)} (${share.percent} %)`)
    .join(' · ');
  return `<h2>Häufigste Auslöser</h2><p>${list}</p>`;
}

function buildMedicationSection(line: MedicationSummaryLine): string {
  const ended = line.endDate === null ? '' : ` · beendet am ${formatGermanDate(line.endDate)}`;
  return `
    <div class="med${line.endDate === null ? '' : ' ended'}">
      <p class="med-name">${escapeHtml(line.name)}</p>
      <p class="med-detail">${escapeHtml(line.dose)} · ${escapeHtml(line.schedule)} · seit ${formatGermanDate(line.startDate)}${ended}</p>
      <p class="med-detail">${escapeHtml(formatMedicationIntakeLabel(line))}</p>
    </div>
  `;
}

function buildMedicationsSection(summary: VisitSummary): string {
  if (summary.medications.length === 0) {
    return '<h2>Medikamente</h2><p>Im Zeitraum war kein Medikament hinterlegt.</p>';
  }
  return `<h2>Medikamente</h2>${summary.medications.map(buildMedicationSection).join('\n')}`;
}

function buildScreeningSection(summary: VisitSummary): string {
  if (summary.nextScreeningDate === null) {
    return '';
  }
  return `<p class="screening">Nächste Vorsorge-Koloskopie: ${formatGermanDate(summary.nextScreeningDate)}</p>`;
}

export function buildVisitSummaryHtml(summary: VisitSummary, today: Date): string {
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6B6259; margin: 18px 0 6px; }
          p { font-size: 12px; margin: 3px 0; line-height: 1.5; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 20px; }
          .kpis { display: flex; gap: 10px; }
          .kpi { flex: 1; background: #F7F3EC; border-radius: 8px; padding: 10px; text-align: center; }
          .kpi .n { display: block; font-size: 19px; font-weight: 700; }
          .kpi .l { display: block; font-size: 10px; color: #6B6259; margin-top: 3px; }
          .sparse { font-style: italic; }
          .med { border-top: 1px solid #E4DACB; padding: 7px 0; }
          .med.ended { color: #6B6259; }
          .med-name { font-weight: 700; margin: 0; }
          .med-detail { color: #6B6259; margin: 1px 0; }
          .screening { margin-top: 14px; }
          .footer { color: #6B6259; font-size: 11px; margin-top: 24px; border-top: 1px solid #E4DACB; padding-top: 8px; }
        </style>
      </head>
      <body>
        <h1>Zusammenfassung für den Arztbesuch</h1>
        <p class="generated">${escapeHtml(formatPeriodLabel(summary.period))}</p>
        ${buildFiguresSection(summary)}
        ${buildPhasesSection(summary)}
        ${buildTriggersSection(summary)}
        ${buildMedicationsSection(summary)}
        ${buildScreeningSection(summary)}
        <p class="footer">Erstellt am ${day}.${month}.${year} · Die Angaben stammen aus einem selbstgeführten Tagebuch.</p>
      </body>
    </html>
  `;
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `npx.cmd vitest run src/features/doctorVisits/visitSummaryPdfBuilder.test.ts`
Expected: PASS, 12 Tests.

- [ ] **Step 6: Drucken und Teilen schreiben**

Neu: `colitis-app/src/features/doctorVisits/visitSummaryExport.ts`

```ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildVisitSummaryHtml } from './visitSummaryPdfBuilder';
import type { VisitSummary } from './visitSummary';

export async function exportVisitSummary(summary: VisitSummary): Promise<void> {
  const html = buildVisitSummaryHtml(summary, new Date());
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
```

- [ ] **Step 7: Typprüfung und Gesamtsuite**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/doctorVisits/doctorVisitPassBuilder.ts src/features/doctorVisits/visitSummaryPdfBuilder.ts src/features/doctorVisits/visitSummaryPdfBuilder.test.ts src/features/doctorVisits/visitSummaryExport.ts
git commit -m "feat: Zusammenfassung als PDF"
```

---

### Task 5: Bildschirm, Route und Einstieg

**Files:**
- Create: `colitis-app/src/features/doctorVisits/components/VisitSummaryView.tsx`
- Create: `colitis-app/app/(tabs)/tagebuch/arztbesuche/zusammenfassung.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/_layout.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx`

**Interfaces:**
- Consumes: `buildVisitSummary`, `VisitSummary` und alle `format…`-Funktionen aus `../visitSummary`; `exportVisitSummary` aus `../visitSummaryExport`; `listDiaryEntries`, `listMedications`, `listMedicationIntakes`, `listDoctorVisits`, `getScreeningReminder`; `formatLocalDateKey` aus `../../lib/localDate`
- Produces: nichts, worauf spätere Aufgaben aufbauen.

Keine Tests: Komponenten sind in diesem Projekt nicht testbar (siehe Global Constraints). Geprüft wird mit `tsc`.

- [ ] **Step 1: Die Darstellung schreiben**

Neu: `colitis-app/src/features/doctorVisits/components/VisitSummaryView.tsx`

```tsx
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import {
  formatMedicationIntakeLabel,
  formatPeriodLabel,
  formatPhaseLabel,
  formatRatingLabel,
  formatSparseDataLabel,
} from '../visitSummary';
import { formatGermanDate } from '../doctorVisitPassBuilder';
import { SectionHeading } from '../../../components/ui/SectionHeading';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { VisitSummary } from '../visitSummary';
import type { ThemeColors } from '../../../theme/types';

/** Deutsche Schreibweise mit Komma statt Punkt. */
function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

interface VisitSummaryViewProps {
  summary: VisitSummary;
}

export function VisitSummaryView({ summary }: VisitSummaryViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { figures } = summary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.periodText}>{formatPeriodLabel(summary.period)}</Text>

      {figures === null ? (
        <Text style={styles.sparseText}>
          {formatSparseDataLabel(summary.daysWithEntries, summary.period.dayCount)}
        </Text>
      ) : (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>{formatDecimal(figures.stoolsPerDay)}</Text>
              <Text style={styles.kpiLabel}>Stühle pro Tag</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>{figures.daysWithBlood}</Text>
              <Text style={styles.kpiLabel}>Tage mit Blut</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>{formatDecimal(figures.averagePainLevel)}</Text>
              <Text style={styles.kpiLabel}>Schmerz von 10</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiNumber}>
                {summary.daysWithEntries} von {summary.period.dayCount}
              </Text>
              <Text style={styles.kpiLabel}>Tagen erfasst</Text>
            </View>
          </View>

          <SectionHeading>Tagesbewertung</SectionHeading>
          <Text style={styles.bodyText}>{formatRatingLabel(figures)}</Text>

          <SectionHeading>Auffällige Phasen</SectionHeading>
          {summary.phases.length === 0 ? (
            <Text style={styles.bodyText}>Keine zusammenhängende auffällige Phase.</Text>
          ) : (
            summary.phases.map((phase) => (
              <Text key={phase.fromDate} style={styles.bodyText}>
                {formatPhaseLabel(phase)}
              </Text>
            ))
          )}

          {summary.triggers.length > 0 && (
            <>
              <SectionHeading>Häufigste Auslöser</SectionHeading>
              <Text style={styles.bodyText}>
                {summary.triggers.map((share) => `${share.label} (${share.percent} %)`).join(' · ')}
              </Text>
            </>
          )}
        </>
      )}

      <SectionHeading>Medikamente</SectionHeading>
      {summary.medications.length === 0 ? (
        <Text style={styles.bodyText}>Im Zeitraum war kein Medikament hinterlegt.</Text>
      ) : (
        summary.medications.map((line) => (
          <View key={line.name} style={[styles.medication, line.endDate !== null && styles.medicationEnded]}>
            <Text style={styles.medicationName}>{line.name}</Text>
            <Text style={styles.medicationDetail}>
              {line.dose} · {line.schedule} · seit {formatGermanDate(line.startDate)}
              {line.endDate === null ? '' : ` · beendet am ${formatGermanDate(line.endDate)}`}
            </Text>
            <Text style={styles.medicationDetail}>{formatMedicationIntakeLabel(line)}</Text>
          </View>
        ))
      )}

      {summary.nextScreeningDate !== null && (
        <Text style={styles.screeningText}>
          Nächste Vorsorge-Koloskopie: {formatGermanDate(summary.nextScreeningDate)}
        </Text>
      )}

      <Text style={styles.footerText}>Die Angaben stammen aus einem selbstgeführten Tagebuch.</Text>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxl },
    periodText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.md,
    },
    sparseText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    kpiRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.sm },
    kpi: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    kpiNumber: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    kpiLabel: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
      textAlign: 'center',
    },
    bodyText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      lineHeight: 20,
      marginBottom: tokens.spacing.xs,
    },
    medication: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: tokens.spacing.sm,
    },
    medicationEnded: { opacity: 0.6 },
    medicationName: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    medicationDetail: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: 2,
    },
    screeningText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.md,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: tokens.spacing.sm,
    },
  });
}
```

- [ ] **Step 2: Den Bildschirm schreiben**

Neu: `colitis-app/app/(tabs)/tagebuch/arztbesuche/zusammenfassung.tsx`

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { listDiaryEntries } from '../../../../src/features/diary/db/diaryRepository';
import {
  listMedications,
  listMedicationIntakes,
} from '../../../../src/features/medications/db/medicationsRepository';
import { getScreeningReminder } from '../../../../src/features/medications/db/screeningRepository';
import { listDoctorVisits } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { buildVisitSummary } from '../../../../src/features/doctorVisits/visitSummary';
import { exportVisitSummary } from '../../../../src/features/doctorVisits/visitSummaryExport';
import { VisitSummaryView } from '../../../../src/features/doctorVisits/components/VisitSummaryView';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { SkeletonList } from '../../../../src/components/ui/SkeletonList';
import { formatLocalDateKey } from '../../../../src/lib/localDate';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { VisitSummary } from '../../../../src/features/doctorVisits/visitSummary';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ZusammenfassungScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [entries, medications, intakes, visits, screening] = await Promise.all([
            listDiaryEntries(db),
            listMedications(db),
            listMedicationIntakes(db, null),
            listDoctorVisits(db),
            getScreeningReminder(db),
          ]);
          if (isActive) {
            setSummary(
              buildVisitSummary({
                entries,
                medications,
                intakes,
                visits,
                screening,
                today: formatLocalDateKey(new Date()),
              })
            );
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Zusammenfassung] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Zusammenfassung konnte nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleExport() {
    if (summary === null) {
      return;
    }
    setIsExporting(true);
    try {
      await exportVisitSummary(summary);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Zusammenfassung] PDF-Ausgabe fehlgeschlagen:', exportError);
      setError('PDF konnte nicht erstellt werden.');
    } finally {
      setIsExporting(false);
    }
  }

  function renderBody() {
    if (isLoading || summary === null) {
      return <SkeletonList count={4} lines={2} />;
    }
    if (summary.isEmpty) {
      return (
        <EmptyState
          title="Noch nichts zusammenzufassen"
          description="Für diesen Zeitraum gibt es weder Tagebucheinträge noch hinterlegte Medikamente."
          showGhost={false}
        />
      );
    }
    return <VisitSummaryView summary={summary} />;
  }

  const isShareDisabled = isLoading || summary === null || summary.isEmpty || isExporting;

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isShareDisabled }}
        accessibilityLabel="Zusammenfassung als PDF teilen"
        disabled={isShareDisabled}
        style={[styles.shareLink, isShareDisabled && styles.shareLinkDisabled]}
        onPress={() => void handleExport()}
      >
        <Text style={styles.shareLinkText}>
          {isExporting ? 'PDF wird erstellt …' : 'Als PDF teilen'}
        </Text>
      </Pressable>
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
    shareLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    shareLinkDisabled: { opacity: 0.5 },
    shareLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
  });
}
```

- [ ] **Step 3: Die Route eintragen**

In `colitis-app/app/(tabs)/tagebuch/_layout.tsx` nach der Zeile für `arztbesuche/[id]` einfügen:

```tsx
      <Stack.Screen name="arztbesuche/zusammenfassung" options={{ title: 'Zusammenfassung' }} />
```

- [ ] **Step 4: Den Einstiegsknopf setzen**

In `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx` direkt **unter** dem vorhandenen `Pressable` mit `style={[styles.exportLink, …]}` einfügen:

```tsx
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Für den nächsten Termin vorbereiten"
        style={styles.prepareLink}
        onPress={() => router.push('/tagebuch/arztbesuche/zusammenfassung')}
      >
        <Text style={styles.prepareLinkText}>Für den nächsten Termin vorbereiten</Text>
      </Pressable>
```

Und in `makeStyles` derselben Datei ergänzen:

```tsx
    prepareLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    prepareLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
```

- [ ] **Step 5: Typprüfung**

Run: `npx.cmd tsc --noEmit`
Expected: keine Ausgabe.

- [ ] **Step 6: Gesamte Testsuite laufen lassen**

Run: `npx.cmd vitest run`
Expected: PASS.

- [ ] **Step 7: Auf tote Importe prüfen**

Weil `tsc` ungenutzte Importe nicht meldet, prüfe jede in diesem Zweig geänderte Datei von Hand: Kommt jeder importierte Bezeichner im Rumpf noch vor? Besonders zu prüfen: `calendarLogic.ts`, `medicationStatus.ts` und `adherence.ts` aus Aufgabe 1.

- [ ] **Step 8: Commit**

```bash
git add app/(tabs)/tagebuch src/features/doctorVisits/components/VisitSummaryView.tsx
git commit -m "feat: Bildschirm der Zusammenfassung mit PDF-Ausgabe"
```

---

## Selbstprüfung nach dem Plan

**Spec-Abdeckung**

| Spec-Abschnitt | Aufgabe |
|---|---|
| 1 · Einstieg und Zeitraum | 1 (`determinePeriod`), 5 (Knopf und Route) |
| 2a · Vier Kennzahlen | 2 (`computeFigures`), 4 und 5 (Darstellung) |
| 2b · Tagesbewertung | 2 (`formatRatingLabel`) |
| 2c · Auffällige Phasen | 2 (`findNotablePhases`, `formatPhaseLabel`) |
| 2d · Häufigste Auslöser | 3 (`computeTriggerShares`) |
| 2e · Medikamentenstand | 3 (`buildMedicationLines`, `formatMedicationIntakeLabel`) |
| 2f · Vorsorge-Termin und Fußzeile | 3 (`nextScreeningDate`), 4 und 5 |
| 3 · Definition der Phase | 2 |
| 4 · Wenig Daten | 2 (`MIN_DAYS_FOR_FIGURES`, `formatSparseDataLabel`), 3 (Verknüpfung), 5 (Leerzustand) |
| 5 · Bildschirm und PDF | 4 und 5 |
| Datumsrechnung lokal | 1 (`src/lib/localDate.ts`) |
| Fehlerbehandlung | 5 |

**Typkonsistenz**

`SummaryPeriod` entsteht in Aufgabe 1 und wird von 2, 3, 4, 5 unverändert benutzt. `SummaryFigures` und `NotablePhase` entstehen in Aufgabe 2, `TriggerShare`, `MedicationSummaryLine` und `VisitSummary` in Aufgabe 3; Aufgaben 4 und 5 lesen sie nur. Die vier Beschriftungsfunktionen heißen in allen Aufgaben gleich: `formatPeriodLabel`, `formatRatingLabel`, `formatPhaseLabel`, `formatSparseDataLabel`, `formatMedicationIntakeLabel`.

**Bekannte Zwischenstände**

Keine. Nach jeder Aufgabe ist der Baum typrein und die Testsuite grün.

**Bewusst nicht getestet**

`VisitSummaryView`, `zusammenfassung.tsx` und `visitSummaryExport.ts` — Komponenten und Geräteschnittstellen lassen sich in diesem Projekt nicht testen. Deshalb steckt jede Entscheidung in `visitSummary.ts` und `visitSummaryPdfBuilder.ts`, die beide vollständig geprüft sind.
