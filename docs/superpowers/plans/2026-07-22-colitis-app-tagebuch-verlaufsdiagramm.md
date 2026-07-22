# Tagebuch-Verlaufsdiagramm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Balkendiagramm auf der bestehenden Muster-Auswertung-Seite hinzufügen, das den Verlauf von Schmerzlevel und Stuhlgang-Häufigkeit über die letzten 7, 30 oder 90 Tage zeigt.

**Architecture:** Reine Aggregationslogik in einer neuen Datei `trendLogic.ts` (wiederverwendet die bestehende `groupEntriesByDay`-Funktion aus `calendarLogic.ts`), eine neue Präsentationskomponente `DiaryTrendChart.tsx` (Balken via normale `View`-Elemente, kein neues npm-Paket), und eine kleine Erweiterung der bestehenden `auswertung.tsx`-Seite, die die geladenen Tagebucheinträge zusätzlich in State hält und an die neue Komponente weitergibt.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Vitest. Kein neues npm-Paket.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-tagebuch-verlaufsdiagramm-design.md`
- Keine neue Abhängigkeit in `package.json` — Balken werden mit normalen `View`-Elementen gebaut.
- Keine Datenbank-/Schema-Änderung.
- Alle UI-Texte auf Deutsch, konsistent mit bestehenden Tagebuch-Komponenten.
- Muss in allen drei Themes (`light`, `dark`, `light-blue`) über `useTheme()`/`ThemeColors` funktionieren — keine hartkodierten Hex-Farben in Komponenten.
- Tagesdurchschnitt: arithmetisches Mittel, gerundet auf eine Nachkommastelle (`Math.round(value * 10) / 10`, gleiche Konvention wie `src/features/diary/analysis.ts:22`).
- Tag ohne Eintrag → `null`, nicht `0` (damit nicht mit einem echten Schmerzlevel-0-Tag verwechselbar).
- Schmerzlevel-Skala im Diagramm ist fest 0–10. Stuhlgang-Häufigkeit-Skala ist dynamisch, mindestens 0–5.
- Zeiträume sind exakt die drei Stufen 7, 30, 90 Tage — keine freie Auswahl.
- Windows-Testbefehl in diesem Projekt: `npx.cmd vitest run <pfad>` (nicht `npx`, siehe `AGENTS.md`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier nicht nötig, reines React Native + eigene Logik).

---

### Task 1: Tages-Aggregation (`trendLogic.ts`)

**Files:**
- Modify: `colitis-app/src/features/diary/calendarLogic.ts:35` (macht `formatDateKey` exportierbar, damit `trendLogic.ts` es wiederverwenden kann, statt die Datumsformatierung zu duplizieren)
- Create: `colitis-app/src/features/diary/trendLogic.ts`
- Test: `colitis-app/src/features/diary/trendLogic.test.ts`

**Interfaces:**
- Consumes: `groupEntriesByDay(entries: DiaryEntryWithTriggers[]): Map<string, DiaryEntryWithTriggers[]>` und `formatDateKey(date: Date): string` (nach diesem Task exportiert) aus `./calendarLogic`; `DiaryEntryWithTriggers` aus `./types` (Felder: `occurredAt: string`, `painLevel: number`, `stoolFrequency: number`).
- Produces (für Task 2):
  - `export type TrendRangeDays = 7 | 30 | 90;`
  - `export interface DailyAverage { date: string; averagePainLevel: number | null; averageStoolFrequency: number | null; }`
  - `export function buildDailyAverages(entries: DiaryEntryWithTriggers[], rangeDays: TrendRangeDays, referenceDate?: Date): DailyAverage[]` (aufsteigend sortiert, ältester Tag zuerst, exakt `rangeDays` Einträge, Standard `referenceDate` ist `new Date()`)

- [ ] **Step 1: `formatDateKey` in `calendarLogic.ts` exportierbar machen**

In `colitis-app/src/features/diary/calendarLogic.ts`, Zeile 35, ändere:

```typescript
function formatDateKey(date: Date): string {
```

zu:

```typescript
export function formatDateKey(date: Date): string {
```

(Keine weitere Änderung an der Datei nötig — die Funktion bleibt inhaltlich identisch, wird nur zusätzlich exportiert.)

- [ ] **Step 2: Type-Check nach der Export-Änderung**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler, bestehende `calendarLogic.test.ts`-Tests bleiben unberührt.

- [ ] **Step 3: Write the failing test for `buildDailyAverages`**

Create `colitis-app/src/features/diary/trendLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDailyAverages } from './trendLogic';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-22T10:00:00',
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

const REFERENCE_DATE = new Date(2026, 6, 22); // 22. Juli 2026, lokal (Monat 0-indiziert)

describe('buildDailyAverages', () => {
  it('returns exactly 7 days for a 7-day range', () => {
    expect(buildDailyAverages([], 7, REFERENCE_DATE)).toHaveLength(7);
  });

  it('returns exactly 30 days for a 30-day range', () => {
    expect(buildDailyAverages([], 30, REFERENCE_DATE)).toHaveLength(30);
  });

  it('returns exactly 90 days for a 90-day range', () => {
    expect(buildDailyAverages([], 90, REFERENCE_DATE)).toHaveLength(90);
  });

  it('orders days ascending, oldest first, ending on the reference date', () => {
    const days = buildDailyAverages([], 7, REFERENCE_DATE);
    expect(days[0].date).toBe('2026-07-16');
    expect(days[6].date).toBe('2026-07-22');
  });

  it('returns null averages for a day with no entries', () => {
    const days = buildDailyAverages([], 7, REFERENCE_DATE);
    expect(days[6].averagePainLevel).toBeNull();
    expect(days[6].averageStoolFrequency).toBeNull();
  });

  it('averages multiple entries on the same day, rounded to one decimal', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', painLevel: 3, stoolFrequency: 2 }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T20:00:00', painLevel: 4, stoolFrequency: 3 }),
    ];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    expect(days[6].averagePainLevel).toBe(3.5);
    expect(days[6].averageStoolFrequency).toBe(2.5);
  });

  it('rounds a repeating-decimal average to one decimal place', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T06:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T12:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-22T18:00:00', painLevel: 2, stoolFrequency: 2 }),
    ];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    expect(days[6].averagePainLevel).toBe(1.3); // (1+1+2)/3 = 1.333...
    expect(days[6].averageStoolFrequency).toBe(1.3);
  });

  it('ignores entries outside the selected range', () => {
    const entries = [makeEntry({ occurredAt: '2026-06-01T10:00:00', painLevel: 9 })];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    expect(days.every((day) => day.averagePainLevel === null)).toBe(true);
  });

  it('places an entry on the correct day within the range', () => {
    const entries = [makeEntry({ occurredAt: '2026-07-18T10:00:00', painLevel: 5, stoolFrequency: 4 })];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    const julyEighteenth = days.find((day) => day.date === '2026-07-18');
    expect(julyEighteenth?.averagePainLevel).toBe(5);
    expect(julyEighteenth?.averageStoolFrequency).toBe(4);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/diary/trendLogic.test.ts`
Expected: FAIL — `trendLogic.ts` does not exist yet (module not found).

- [ ] **Step 5: Write the implementation**

Create `colitis-app/src/features/diary/trendLogic.ts`:

```typescript
import { groupEntriesByDay, formatDateKey } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

export type TrendRangeDays = 7 | 30 | 90;

export interface DailyAverage {
  date: string;
  averagePainLevel: number | null;
  averageStoolFrequency: number | null;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return roundToOneDecimal(sum / values.length);
}

export function buildDailyAverages(
  entries: DiaryEntryWithTriggers[],
  rangeDays: TrendRangeDays,
  referenceDate: Date = new Date()
): DailyAverage[] {
  const entriesByDay = groupEntriesByDay(entries);
  const days: DailyAverage[] = [];

  for (let offset = rangeDays - 1; offset >= 0; offset--) {
    const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - offset);
    const dateKey = formatDateKey(day);
    const dayEntries = entriesByDay.get(dateKey) ?? [];

    days.push({
      date: dateKey,
      averagePainLevel: averageOf(dayEntries.map((entry) => entry.painLevel)),
      averageStoolFrequency: averageOf(dayEntries.map((entry) => entry.stoolFrequency)),
    });
  }

  return days;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/diary/trendLogic.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 7: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün, keine neuen Typfehler.

- [ ] **Step 8: Commit**

```bash
git add colitis-app/src/features/diary/calendarLogic.ts colitis-app/src/features/diary/trendLogic.ts colitis-app/src/features/diary/trendLogic.test.ts
git commit -m "feat: Tages-Durchschnittslogik fuer Verlaufsdiagramm ergaenzen"
```

---

### Task 2: Balkendiagramm-Komponente (`DiaryTrendChart.tsx`)

**Files:**
- Create: `colitis-app/src/features/diary/components/DiaryTrendChart.tsx`

**Interfaces:**
- Consumes:
  - `buildDailyAverages`, `DailyAverage`, `TrendRangeDays` aus `../trendLogic` (Task 1)
  - `DiaryEntryWithTriggers` aus `../types`
  - `useTheme()` aus `../../../theme/ThemeContext`, `tokens` aus `../../../styles/tokens`, `ThemeColors` aus `../../../theme/types`
- Produces (für Task 3):
  - `export function DiaryTrendChart(props: { entries: DiaryEntryWithTriggers[] }): JSX.Element` in `colitis-app/src/features/diary/components/DiaryTrendChart.tsx`

Diese Komponente ist im bestehenden Projekt nicht automatisiert testbar (gleiches Muster wie `DiaryCalendarView.tsx`, `DiaryEntryForm.tsx` — keine Test-Datei für UI-Komponenten). Verifikation über `tsc --noEmit` und manuellen Test in Schritt 3 dieser Aufgabe.

- [ ] **Step 1: `DiaryTrendChart.tsx` erstellen**

Create `colitis-app/src/features/diary/components/DiaryTrendChart.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import { buildDailyAverages } from '../trendLogic';
import type { DailyAverage, TrendRangeDays } from '../trendLogic';
import type { DiaryEntryWithTriggers } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DiaryTrendChartProps {
  entries: DiaryEntryWithTriggers[];
}

const RANGE_OPTIONS: { value: TrendRangeDays; label: string }[] = [
  { value: 7, label: '7 Tage' },
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
];

const BAR_WIDTH = 8;
const BAR_GAP = 3;
const CHART_HEIGHT = 80;
const MIN_STOOL_FREQUENCY_SCALE = 5;
const PAIN_LEVEL_SCALE = 10;

function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}.${month}.`;
}

function barHeight(value: number | null, maxValue: number): number {
  if (value === null || maxValue === 0) {
    return 0;
  }
  return Math.max(1, Math.round((value / maxValue) * CHART_HEIGHT));
}

function resolveStoolFrequencyMax(days: DailyAverage[]): number {
  const values = days
    .map((day) => day.averageStoolFrequency)
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return MIN_STOOL_FREQUENCY_SCALE;
  }
  return Math.max(MIN_STOOL_FREQUENCY_SCALE, ...values);
}

function hasAnyData(days: DailyAverage[]): boolean {
  return days.some((day) => day.averagePainLevel !== null || day.averageStoolFrequency !== null);
}

const barRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
  },
  barSlot: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    justifyContent: 'flex-end',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2,
  },
});

interface BarRowProps {
  days: DailyAverage[];
  valueKey: 'averagePainLevel' | 'averageStoolFrequency';
  maxValue: number;
  barColor: string;
}

function BarRow({ days, valueKey, maxValue, barColor }: BarRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={barRowStyles.row}>
        {days.map((day) => (
          <View key={day.date} style={barRowStyles.barSlot}>
            <View style={[barRowStyles.bar, { height: barHeight(day[valueKey], maxValue), backgroundColor: barColor }]} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function DiaryTrendChart({ entries }: DiaryTrendChartProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [rangeDays, setRangeDays] = useState<TrendRangeDays>(7);

  const days = buildDailyAverages(entries, rangeDays);
  const stoolFrequencyMax = resolveStoolFrequencyMax(days);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        {RANGE_OPTIONS.map((option) => {
          const isSelected = rangeDays === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.toggleButton, isSelected && styles.toggleButtonActive]}
              onPress={() => setRangeDays(option.value)}
            >
              <Text style={[styles.toggleButtonText, isSelected && styles.toggleButtonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasAnyData(days) ? (
        <>
          <Text style={styles.chartTitle}>Schmerzlevel</Text>
          <BarRow days={days} valueKey="averagePainLevel" maxValue={PAIN_LEVEL_SCALE} barColor={colors.danger} />

          <Text style={styles.chartTitle}>Stuhlgang-Häufigkeit</Text>
          <BarRow days={days} valueKey="averageStoolFrequency" maxValue={stoolFrequencyMax} barColor={colors.primary} />

          <View style={styles.dateRangeRow}>
            <Text style={styles.dateRangeText}>{formatShortDate(days[0].date)}</Text>
            <Text style={styles.dateRangeText}>{formatShortDate(days[days.length - 1].date)}</Text>
          </View>
        </>
      ) : (
        <Text style={styles.emptyText}>Keine Daten in diesem Zeitraum.</Text>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: tokens.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleRow: {
      flexDirection: 'row',
      gap: tokens.spacing.xs,
      marginBottom: tokens.spacing.md,
    },
    toggleButton: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
      borderRadius: tokens.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toggleButtonText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
    toggleButtonTextActive: {
      color: colors.surface,
    },
    chartTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    dateRangeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: tokens.spacing.xs,
    },
    dateRangeText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
      paddingVertical: tokens.spacing.lg,
    },
  });
}
```

- [ ] **Step 2: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün (diese Aufgabe fügt keine neuen Tests hinzu, `trendLogic.test.ts` aus Task 1 muss weiterhin bestehen).

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/diary/components/DiaryTrendChart.tsx
git commit -m "feat: Balkendiagramm-Komponente fuer Verlaufsdiagramm ergaenzen"
```

---

### Task 3: Einbindung in die Muster-Auswertung-Seite

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/auswertung.tsx`

**Interfaces:**
- Consumes: `DiaryTrendChart` aus `../../../src/features/diary/components/DiaryTrendChart` (Task 2), Props `{ entries: DiaryEntryWithTriggers[] }`.
- Produces: Nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe ändert nur eine bestehende Screen-Datei (UI-Verdrahtung + zusätzlicher State), keine neue Logik — nicht automatisiert testbar, gleiches Muster wie die Erweiterung von `tagebuch/index.tsx` beim Kalender-Feature. Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Datei komplett ersetzen**

Ersetze den vollständigen Inhalt von `colitis-app/app/(tabs)/tagebuch/auswertung.tsx` mit:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { computeTriggerPatterns } from '../../../src/features/diary/analysis';
import { TriggerAnalysisView } from '../../../src/features/diary/components/TriggerAnalysisView';
import { DiaryTrendChart } from '../../../src/features/diary/components/DiaryTrendChart';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { TriggerPatternStat } from '../../../src/features/diary/analysis';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function AuswertungScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [patterns, setPatterns] = useState<TriggerPatternStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((loadedEntries) => {
          if (isActive) {
            setEntries(loadedEntries);
            setPatterns(computeTriggerPatterns(loadedEntries));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Auswertung] Laden der Auswertung fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Auswertung konnte nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Auswertung wird geladen …</Text>
        </View>
      ) : (
        <ScrollView>
          <DiaryTrendChart entries={entries} />
          <TriggerAnalysisView patterns={patterns} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
```

Änderungen gegenüber der bisherigen Datei: neuer `entries`-State (wird zusätzlich zu `patterns` aus derselben `listDiaryEntries`-Abfrage gesetzt, keine zweite Datenbankabfrage), neuer `DiaryTrendChart`-Import und -Aufruf, der bisherige direkte `<TriggerAnalysisView />`-Block ist jetzt in eine `ScrollView` verpackt (zusammen mit dem neuen Diagramm, damit der zusätzliche Inhalt auf kleinen Bildschirmen nicht abgeschnitten wird). `makeStyles` bleibt unverändert.

- [ ] **Step 2: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build)**

- Tagebuch-Tab → "Muster-Auswertung ansehen" öffnen → Diagramm erscheint oberhalb der Auslöser-Karten, Standard-Zeitraum "7 Tage" ist aktiv.
- Zwischen "7 Tage" / "30 Tage" / "90 Tage" umschalten → Balken aktualisieren sich, bei 30/90 Tagen lässt sich die Balkenreihe horizontal scrollen.
- Bei einem Nutzer ohne Einträge im gewählten Zeitraum → Hinweistext "Keine Daten in diesem Zeitraum." erscheint statt der Balken.
- Tage ohne Eintrag zeigen eine Lücke (keinen Balken), nicht einen Balken der Höhe 0.
- Ganze Seite auf einem kleinen Bildschirm testen → Diagramm + Auslöser-Karten lassen sich vollständig durchscrollen, nichts wird abgeschnitten.
- Alle drei Themes (Standard, Dunkel, Blau-Weiß) durchschalten und die Diagrammfarben (Schmerzlevel-Balken, Stuhlgang-Balken, aktiver Zeitraum-Button) auf Lesbarkeit prüfen.

- [ ] **Step 5: Commit**

```bash
git add "colitis-app/app/(tabs)/tagebuch/auswertung.tsx"
git commit -m "feat: Verlaufsdiagramm in Muster-Auswertung-Seite einbinden"
```
