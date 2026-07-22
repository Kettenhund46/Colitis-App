# Tagebuch-Kalenderübersicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Kalenderansicht im Tagebuch-Tab hinzufügen, die pro Tag farblich (grün/gelb/rot) zeigt, wie es dem Nutzer ging, basierend auf bereits erfassten Tagebucheinträgen.

**Architecture:** Reine Bewertungs- und Rasterlogik in einer neuen Datei `calendarLogic.ts` (keine UI, voll testbar), eine neue Präsentationskomponente `DiaryCalendarView.tsx` (baut auf `calendarLogic.ts` und der bestehenden `DiaryHistoryList` auf), und ein Umschalter im bestehenden Tagebuch-Tab-Screen zwischen der bisherigen Liste und der neuen Kalenderansicht.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Vitest. Kein neues npm-Paket — das Monatsraster wird selbst gebaut (im Projekt ist keine Kalender-Bibliothek installiert).

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-tagebuch-kalenderuebersicht-design.md`
- Keine neue Abhängigkeit in `package.json` — Monatsraster wird als reine Funktion selbst gebaut.
- Keine Datenbank-/Schema-Änderung.
- Alle UI-Texte auf Deutsch, konsistent mit bestehenden Tagebuch-Komponenten.
- Muss in allen drei Themes (`light`, `dark`, `light-blue`) über `useTheme()`/`ThemeColors` funktionieren — keine hartkodierten Hex-Farben in Komponenten.
- Schwellenwerte für die Tagesbewertung (fest im Code, aus der Spec):
  - `hasBlood === true` → immer `'bad'`
  - sonst `painLevel >= 7` ODER `stoolFrequency >= 8` → `'bad'`
  - sonst `painLevel >= 4` ODER `stoolFrequency >= 5` → `'medium'`
  - sonst → `'good'`
- Tagesfarbe = schlechtester Wert aller Einträge des Tages (`'bad'` > `'medium'` > `'good'`).
- Monatsraster: exakt 42 Zellen (6×7), Wochenstart Montag.
- Windows-Testbefehl in diesem Projekt: `npx.cmd vitest run <pfad>` (nicht `npx`, siehe `AGENTS.md`).
- Vor dem Schreiben von Code: `AGENTS.md` beachten — Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier nicht nötig, reines React Native + eigene Logik).

---

### Task 1: Kalender-Logik (`calendarLogic.ts`)

**Files:**
- Create: `colitis-app/src/features/diary/calendarLogic.ts`
- Test: `colitis-app/src/features/diary/calendarLogic.test.ts`

**Interfaces:**
- Consumes: `DiaryEntryWithTriggers` aus `colitis-app/src/features/diary/types.ts` (Felder: `occurredAt: string`, `hasBlood: boolean`, `painLevel: number`, `stoolFrequency: number`).
- Produces (für Task 2):
  - `export type DayRating = 'good' | 'medium' | 'bad';`
  - `export function rateDiaryEntry(entry: DiaryEntryWithTriggers): DayRating`
  - `export function rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating`
  - `export function groupEntriesByDay(entries: DiaryEntryWithTriggers[]): Map<string, DiaryEntryWithTriggers[]>` (Schlüssel: `YYYY-MM-DD`, lokale Zeitzone)
  - `export interface CalendarCell { date: string; dayOfMonth: number; isCurrentMonth: boolean; }`
  - `export function buildCalendarGrid(year: number, month: number): CalendarCell[]` (Monat 0-indiziert wie `Date`, gibt immer genau 42 Zellen zurück)

- [ ] **Step 1: Write the failing test for `rateDiaryEntry`**

Create `colitis-app/src/features/diary/calendarLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rateDiaryEntry, rateDayEntries, groupEntriesByDay, buildCalendarGrid } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 2,
    hasBlood: false,
    stoolConsistency: 'normal',
    painLevel: 2,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('rateDiaryEntry', () => {
  it('rates a low-symptom entry as good', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 0, hasBlood: false }))).toBe('good');
  });

  it('rates blood as bad even with low pain and frequency', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 0, hasBlood: true }))).toBe('bad');
  });

  it('rates painLevel 7 as bad', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 7, stoolFrequency: 0 }))).toBe('bad');
  });

  it('rates painLevel 6 as medium (below the bad threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 6, stoolFrequency: 0 }))).toBe('medium');
  });

  it('rates stoolFrequency 8 as bad', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 8 }))).toBe('bad');
  });

  it('rates stoolFrequency 7 as medium (below the bad threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 7 }))).toBe('medium');
  });

  it('rates painLevel 4 as medium', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 4, stoolFrequency: 0 }))).toBe('medium');
  });

  it('rates painLevel 3 as good (below the medium threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 3, stoolFrequency: 0 }))).toBe('good');
  });

  it('rates stoolFrequency 5 as medium', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 5 }))).toBe('medium');
  });

  it('rates stoolFrequency 4 as good (below the medium threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 4 }))).toBe('good');
  });
});

describe('rateDayEntries', () => {
  it('returns good for a single good entry', () => {
    const entries = [makeEntry({ painLevel: 1, stoolFrequency: 1 })];
    expect(rateDayEntries(entries)).toBe('good');
  });

  it('returns the worst rating when entries are mixed good and bad', () => {
    const entries = [makeEntry({ painLevel: 1 }), makeEntry({ hasBlood: true })];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('returns the worst rating when entries are mixed good and medium', () => {
    const entries = [makeEntry({ painLevel: 1 }), makeEntry({ painLevel: 4 })];
    expect(rateDayEntries(entries)).toBe('medium');
  });

  it('is independent of entry order', () => {
    const entries = [makeEntry({ hasBlood: true }), makeEntry({ painLevel: 1 }), makeEntry({ painLevel: 4 })];
    expect(rateDayEntries(entries)).toBe('bad');
  });
});

describe('groupEntriesByDay', () => {
  it('groups two entries on the same local day under one key', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-21T08:00:00' }),
      makeEntry({ id: 2, occurredAt: '2026-07-21T20:00:00' }),
    ];
    const grouped = groupEntriesByDay(entries);
    expect(grouped.size).toBe(1);
    expect(grouped.get('2026-07-21')).toHaveLength(2);
  });

  it('splits entries just before and after local midnight into separate days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-21T23:59:00' }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T00:01:00' }),
    ];
    const grouped = groupEntriesByDay(entries);
    expect(grouped.size).toBe(2);
    expect(grouped.get('2026-07-21')).toHaveLength(1);
    expect(grouped.get('2026-07-22')).toHaveLength(1);
  });

  it('returns an empty map for no entries', () => {
    expect(groupEntriesByDay([]).size).toBe(0);
  });
});

describe('buildCalendarGrid', () => {
  it('always returns exactly 42 cells', () => {
    expect(buildCalendarGrid(2026, 6)).toHaveLength(42);
  });

  it('marks days outside the requested month as isCurrentMonth: false', () => {
    const cells = buildCalendarGrid(2026, 6); // July 2026
    const outside = cells.filter((cell) => !cell.isCurrentMonth);
    const inside = cells.filter((cell) => cell.isCurrentMonth);
    expect(inside).toHaveLength(31); // July has 31 days
    expect(outside.length).toBeGreaterThan(0);
  });

  it('starts the grid on a Monday', () => {
    const cells = buildCalendarGrid(2026, 6);
    const firstCellDate = new Date(cells[0].date);
    expect(firstCellDate.getDay()).toBe(1); // 1 = Monday
  });

  it('handles a December-to-January month rollover', () => {
    const cells = buildCalendarGrid(2026, 11); // December 2026
    const inside = cells.filter((cell) => cell.isCurrentMonth);
    expect(inside).toHaveLength(31);
    expect(inside[0].date).toBe('2026-12-01');
    expect(inside[inside.length - 1].date).toBe('2026-12-31');
  });

  it('handles February in a leap year', () => {
    const cells = buildCalendarGrid(2028, 1); // February 2028 (leap year)
    const inside = cells.filter((cell) => cell.isCurrentMonth);
    expect(inside).toHaveLength(29);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/diary/calendarLogic.test.ts`
Expected: FAIL — `calendarLogic.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/diary/calendarLogic.ts`:

```typescript
import type { DiaryEntryWithTriggers } from './types';

export type DayRating = 'good' | 'medium' | 'bad';

const RATING_SEVERITY: Record<DayRating, number> = {
  good: 0,
  medium: 1,
  bad: 2,
};

export function rateDiaryEntry(entry: DiaryEntryWithTriggers): DayRating {
  if (entry.hasBlood) {
    return 'bad';
  }
  if (entry.painLevel >= 7 || entry.stoolFrequency >= 8) {
    return 'bad';
  }
  if (entry.painLevel >= 4 || entry.stoolFrequency >= 5) {
    return 'medium';
  }
  return 'good';
}

export function rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating {
  let worst: DayRating = 'good';
  for (const entry of entries) {
    const rating = rateDiaryEntry(entry);
    if (RATING_SEVERITY[rating] > RATING_SEVERITY[worst]) {
      worst = rating;
    }
  }
  return worst;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function groupEntriesByDay(entries: DiaryEntryWithTriggers[]): Map<string, DiaryEntryWithTriggers[]> {
  const grouped = new Map<string, DiaryEntryWithTriggers[]>();
  for (const entry of entries) {
    const key = formatDateKey(new Date(entry.occurredAt));
    const existing = grouped.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }
  return grouped;
}

export interface CalendarCell {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
}

const CALENDAR_CELL_COUNT = 42;

export function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekdayMondayIndexed = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekdayMondayIndexed);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < CALENDAR_CELL_COUNT; i++) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      date: formatDateKey(cellDate),
      dayOfMonth: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === month,
    });
  }
  return cells;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/diary/calendarLogic.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` and `npx.cmd tsc --noEmit --pretty false`
Expected: All existing tests still pass, no new type errors.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/diary/calendarLogic.ts colitis-app/src/features/diary/calendarLogic.test.ts
git commit -m "feat: Kalender-Bewertungslogik fuer Tagebuch ergaenzen"
```

---

### Task 2: Warnfarbe im Theme + `DiaryCalendarView`-Komponente

**Files:**
- Modify: `colitis-app/src/theme/types.ts`
- Modify: `colitis-app/src/theme/palettes.ts`
- Create: `colitis-app/src/features/diary/components/DiaryCalendarView.tsx`

**Interfaces:**
- Consumes:
  - `DayRating`, `rateDayEntries`, `groupEntriesByDay`, `buildCalendarGrid`, `CalendarCell` from `../calendarLogic` (Task 1)
  - `DiaryEntryWithTriggers` from `../types`
  - `DiaryHistoryList` from `./DiaryHistoryList` (bestehend, Props: `{ entries: DiaryEntryWithTriggers[]; onDelete: (entryId: number) => void }`)
  - `useTheme()` aus `../../../theme/ThemeContext`, `tokens` aus `../../../styles/tokens`, `ThemeColors` aus `../../../theme/types`
- Produces (für Task 3):
  - `export function DiaryCalendarView(props: { entries: DiaryEntryWithTriggers[]; onDeleteEntry: (entryId: number) => void }): JSX.Element` in `colitis-app/src/features/diary/components/DiaryCalendarView.tsx`

Diese Komponente ist im bestehenden Projekt nicht automatisiert testbar (gleiches Muster wie `DiaryEntryForm.tsx`, `DiaryHistoryList.tsx` — keine Test-Datei für UI-Komponenten). Verifikation über `tsc --noEmit` und manuellen Test in Schritt 6 dieser Aufgabe.

- [ ] **Step 1: Warnfarbe zum Theme-Typ hinzufügen**

In `colitis-app/src/theme/types.ts`, Zeile 3-14, füge `warning` nach `danger` hinzu:

```typescript
export type ThemeId = 'light' | 'dark' | 'light-blue';

export interface ThemeColors {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  accent: string;
  danger: string;
  warning: string;
  success: string;
  border: string;
  overlay: string;
}
```

- [ ] **Step 2: Warnfarbe für alle drei Themes definieren**

In `colitis-app/src/theme/palettes.ts`, füge in jeder der drei Paletten eine `warning`-Zeile nach `danger` ein:

```typescript
import type { ThemeColors, ThemeId } from './types';

export const lightColors: ThemeColors = {
  background: '#FBF6EF',
  surface: '#FFFFFF',
  textPrimary: '#2E2A26',
  textSecondary: '#6B6259',
  primary: '#5B8C7B',
  accent: '#D98E4A',
  danger: '#B5533C',
  warning: '#C9A227',
  success: '#5B8C7B',
  border: '#E4DACB',
  overlay: 'rgba(46, 42, 38, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#1C1A17',
  surface: '#262320',
  textPrimary: '#F3EDE4',
  textSecondary: '#B8AFA3',
  primary: '#7BAF9C',
  accent: '#E3A768',
  danger: '#E07A5F',
  warning: '#D9B84A',
  success: '#7BAF9C',
  border: '#3A362F',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const lightBlueColors: ThemeColors = {
  background: '#F3F7FB',
  surface: '#FFFFFF',
  textPrimary: '#1D2B36',
  textSecondary: '#5B6B78',
  primary: '#3E7CB1',
  accent: '#6BA3C9',
  danger: '#C1443A',
  warning: '#C9A227',
  success: '#3E7CB1',
  border: '#D7E3ED',
  overlay: 'rgba(29, 43, 54, 0.4)',
};

export const palettes: Record<ThemeId, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
  'light-blue': lightBlueColors,
};
```

- [ ] **Step 3: Type-Check nach der Theme-Änderung**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Keine neuen Fehler. (Falls andere Dateien `ThemeColors` literal mit allen Feldern konstruieren statt die Paletten zu nutzen, würden hier fehlende `warning`-Felder auffallen — im Projekt gibt es aktuell nur die drei Paletten in `palettes.ts` als vollständige `ThemeColors`-Objekte.)

- [ ] **Step 4: `DiaryCalendarView.tsx` erstellen**

Create `colitis-app/src/features/diary/components/DiaryCalendarView.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { buildCalendarGrid, groupEntriesByDay, rateDayEntries } from '../calendarLogic';
import type { DayRating } from '../calendarLogic';
import { DiaryHistoryList } from './DiaryHistoryList';
import type { DiaryEntryWithTriggers } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DiaryCalendarViewProps {
  entries: DiaryEntryWithTriggers[];
  onDeleteEntry: (entryId: number) => void;
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function formatMonthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function ratingColor(colors: ThemeColors, rating: DayRating): string {
  if (rating === 'bad') {
    return colors.danger;
  }
  if (rating === 'medium') {
    return colors.warning;
  }
  return colors.success;
}

export function DiaryCalendarView({ entries, onDeleteEntry }: DiaryCalendarViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const entriesByDay = groupEntriesByDay(entries);
  const cells = buildCalendarGrid(visibleMonth.year, visibleMonth.month);
  const selectedEntries = selectedDate ? entriesByDay.get(selectedDate) ?? [] : [];

  function handlePrevMonth() {
    setSelectedDate(null);
    setVisibleMonth((current) => {
      const previous = new Date(current.year, current.month - 1, 1);
      return { year: previous.getFullYear(), month: previous.getMonth() };
    });
  }

  function handleNextMonth() {
    setSelectedDate(null);
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.month + 1, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function handleSelectDay(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Monat"
          onPress={handlePrevMonth}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>◀</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{formatMonthTitle(visibleMonth.year, visibleMonth.month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nächster Monat"
          onPress={handleNextMonth}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>▶</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const dayEntries = entriesByDay.get(cell.date) ?? [];
          const hasEntries = dayEntries.length > 0;
          const rating = hasEntries ? rateDayEntries(dayEntries) : null;
          const isSelected = selectedDate === cell.date;

          return (
            <Pressable
              key={cell.date}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${cell.dayOfMonth}${hasEntries ? ', hat Einträge' : ''}`}
              disabled={!hasEntries}
              onPress={() => handleSelectDay(cell.date)}
              style={[styles.cell, !cell.isCurrentMonth && styles.cellOutsideMonth, isSelected && styles.cellSelected]}
            >
              <Text style={[styles.cellText, !cell.isCurrentMonth && styles.cellTextOutsideMonth]}>
                {cell.dayOfMonth}
              </Text>
              {rating && <View style={[styles.dot, { backgroundColor: ratingColor(colors, rating) }]} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>🟢 Gut · 🟡 Mittel · 🔴 Schub-verdächtig</Text>
      </View>

      {selectedDate && (
        <View style={styles.selectedDayList}>
          <DiaryHistoryList entries={selectedEntries} onDelete={onDeleteEntry} />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: tokens.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.md,
    },
    navButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    navButtonText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    monthTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    weekdayRow: {
      flexDirection: 'row',
    },
    weekdayLabel: {
      flexBasis: '14.28%',
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      flexBasis: '14.28%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.radius.sm,
    },
    cellOutsideMonth: {
      opacity: 0.35,
    },
    cellSelected: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    cellText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
    cellTextOutsideMonth: {
      color: colors.textSecondary,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 2,
    },
    legend: {
      marginTop: tokens.spacing.sm,
      alignItems: 'center',
    },
    legendText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    selectedDayList: {
      flex: 1,
      marginTop: tokens.spacing.md,
    },
  });
}
```

- [ ] **Step 5: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Keine Fehler.

- [ ] **Step 6: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run`
Expected: Alle bestehenden Tests weiterhin grün (diese Aufgabe fügt keine neuen Tests hinzu, `calendarLogic.test.ts` aus Task 1 muss weiterhin bestehen).

- [ ] **Step 7: Commit**

```bash
git add colitis-app/src/theme/types.ts colitis-app/src/theme/palettes.ts colitis-app/src/features/diary/components/DiaryCalendarView.tsx
git commit -m "feat: Kalenderansicht-Komponente fuer Tagebuch ergaenzen"
```

---

### Task 3: Umschalter Liste/Kalender im Tagebuch-Tab

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: `DiaryCalendarView` aus `../../../src/features/diary/components/DiaryCalendarView` (Task 2), Props `{ entries: DiaryEntryWithTriggers[]; onDeleteEntry: (entryId: number) => void }`. Bestehende `handleDelete(entryId: number)`-Funktion in dieser Datei wird als `onDeleteEntry` übergeben.
- Produces: Nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe ändert nur eine bestehende Screen-Datei (UI-Verdrahtung), keine neue Logik — nicht automatisiert testbar, gleiches Muster wie die bestehenden Export-Buttons in derselben Datei. Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Import und State ergänzen**

In `colitis-app/app/(tabs)/tagebuch/index.tsx`, Zeile 1-12, füge den Import hinzu:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries, deleteDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { exportDiaryEntriesAsPdf } from '../../../src/features/diary/diaryPdfExport';
import { exportDiaryEntriesAsCsv } from '../../../src/features/diary/diaryCsvExport';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { DiaryCalendarView } from '../../../src/features/diary/components/DiaryCalendarView';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';
```

In Zeile 14-21 (Komponentenkopf), füge den `viewMode`-State direkt nach `isExporting` hinzu:

```typescript
export default function TagebuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
```

- [ ] **Step 2: Umschalter-UI und bedingtes Rendering einbauen**

Ersetze im `return`-Block (aktuell Zeile 100-152) den Abschnitt zwischen dem `errorBanner`-Block und dem `Muster-Auswertung`-Link, sowie den bestehenden `isLoading`-Rendering-Block, wie folgt (vollständiger neuer `return`-Block):

```typescript
  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.viewToggleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'list' }}
          style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewToggleButtonText, viewMode === 'list' && styles.viewToggleButtonTextActive]}>
            Liste
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'calendar' }}
          style={[styles.viewToggleButton, viewMode === 'calendar' && styles.viewToggleButtonActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[styles.viewToggleButtonText, viewMode === 'calendar' && styles.viewToggleButtonTextActive]}>
            Kalender
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Muster-Auswertung ansehen"
        style={styles.analysisLink}
        onPress={() => router.push('/tagebuch/auswertung')}
      >
        <Text style={styles.analysisLinkText}>Muster-Auswertung ansehen →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || entries.length === 0 }}
        accessibilityLabel="Tagebuch als PDF exportieren"
        disabled={isExporting || entries.length === 0}
        style={[styles.exportLink, (isExporting || entries.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPdf}
      >
        <Text style={styles.exportLinkText}>{isExporting ? 'PDF wird erstellt …' : 'Als PDF exportieren'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || entries.length === 0 }}
        accessibilityLabel="Tagebuch als CSV exportieren"
        disabled={isExporting || entries.length === 0}
        style={[styles.exportLink, (isExporting || entries.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportCsv}
      >
        <Text style={styles.exportLinkText}>{isExporting ? 'CSV wird erstellt …' : 'Als CSV exportieren'}</Text>
      </Pressable>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Einträge werden geladen …</Text>
        </View>
      ) : viewMode === 'list' ? (
        <DiaryHistoryList entries={entries} onDelete={handleDelete} />
      ) : (
        <DiaryCalendarView entries={entries} onDeleteEntry={handleDelete} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuen Eintrag anlegen"
        style={styles.addButton}
        onPress={() => router.push('/tagebuch/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Neue Styles ergänzen**

In `makeStyles` (aktuell ab Zeile 154), füge nach `errorText` (vor `analysisLink`) die neuen Toggle-Styles ein:

```typescript
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    viewToggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    viewToggleButton: {
      flex: 1,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    viewToggleButtonActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    viewToggleButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    viewToggleButtonTextActive: {
      color: colors.primary,
    },
    analysisLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
```

(Der restliche Inhalt von `makeStyles` ab `analysisLinkText` bleibt unverändert.)

- [ ] **Step 4: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Keine Fehler.

- [ ] **Step 5: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run`
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 6: Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build)**

- Tagebuch-Tab öffnen, auf "Kalender" tippen → aktueller Monat wird angezeigt, Tage mit Einträgen zeigen einen farbigen Punkt.
- Mit "◀"/"▶" durch Monate navigieren, inkl. Jahreswechsel (z. B. Dezember → Januar).
- Auf einen Tag mit Eintrag tippen → Mini-Liste erscheint darunter, erneutes Tippen blendet sie wieder aus.
- In der Mini-Liste einen Eintrag löschen → Bestätigungsdialog erscheint wie gewohnt, nach Bestätigung verschwindet der Eintrag aus der Liste und der Tagespunkt aktualisiert sich (ggf. verschwindet er ganz, wenn es der letzte Eintrag des Tages war).
- Zwischen "Liste" und "Kalender" hin- und herschalten → Export-Buttons (PDF/CSV) und Muster-Auswertung-Link bleiben in beiden Ansichten sichtbar und funktionsfähig.
- Alle drei Themes (Standard, Dunkel, Blau-Weiß) in den Einstellungen durchschalten und die Kalenderansicht erneut prüfen — Farben (insbesondere die neue Warnfarbe für "mittel") müssen in jedem Theme gut lesbar sein.

- [ ] **Step 7: Commit**

```bash
git add "colitis-app/app/(tabs)/tagebuch/index.tsx"
git commit -m "feat: Liste/Kalender-Umschalter im Tagebuch-Tab verdrahten"
```
