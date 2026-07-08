# Trigger-Auswertung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zeige dem Nutzer für jede Auslöser-Kategorie (Ernährung, Stress, Schlaf, Medikament, Sonstiges) eine einfache Muster-Auswertung: Anzahl der Tagebuch-Einträge mit diesem Auslöser und der durchschnittliche Schmerzlevel an diesen Tagen.

**Architecture:** Eine reine, framework-freie Berechnungsfunktion liest die bereits vorhandenen `DiaryEntryWithTriggers[]` (aus `listDiaryEntries`) und aggregiert pro Trigger-Kategorie Anzahl + Schmerzlevel-Durchschnitt. Eine neue, rein präsentationale Komponente zeigt das Ergebnis an. Ein neuer Screen unter dem Tagebuch-Tab lädt die Einträge, berechnet die Muster und rendert die Komponente; ein Link in der bestehenden Verlaufsansicht führt dorthin.

**Tech Stack:** TypeScript, React Native/Expo Router, Vitest (bestehendes Projekt-Setup, keine neuen Abhängigkeiten).

## Global Constraints

- Alle Gesundheitsdaten bleiben 100% lokal und verschlüsselt (SQLCipher) – kein Netzwerkzugriff in diesem Feature.
- UI-Sprache: Deutsch, durchgehend.
- Design-Ton: ruhig/warm – ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts`, kein hartkodiertes Rot/Alarmfarben.
- Bewusst einfache Statistik: "keine komplexe Statistik in Phase 1" (Design-Spec, Abschnitt 4a) – nur Anzahl + Schmerzlevel-Durchschnitt pro Kategorie, keine weiteren Kennzahlen, keine Zeiträume/Filter.
- Testbarkeit: React Native lässt sich unter dem aktuellen Test-Runner (Vitest) nicht parsen/rendern (bestätigte Einschränkung aus Umsetzungsschritt 2). Nur framework-freie Logik (`analysis.ts`) wird automatisiert getestet; die Anzeige-Komponente und der Screen werden beim späteren manuellen Alltagstest mitgeprüft.
- Anzeige-Ort (mit Adrian abgestimmt): eigener Unterbildschirm "Auswertung" unter dem Tagebuch-Tab, erreichbar über einen Link in der Verlaufsansicht – nicht inline in der bestehenden Liste.
- Umfang (mit Adrian abgestimmt): pro Trigger-Kategorie nur Eintragsanzahl + Schmerzlevel-Durchschnitt, keine weiteren Kennzahlen (kein Stuhlgang-Durchschnitt, kein Blut-Anteil).
- Container/Presentational-Split beibehalten: Nur Route-Dateien (`auswertung.tsx`) rufen `createEncryptedDb()`/Repository-Funktionen auf; `TriggerAnalysisView` bekommt fertige Daten per Props.

---

### Task 1: Trigger-Pattern-Auswertung – reine Logik

**Files:**
- Create: `colitis-app/src/features/diary/analysis.ts`
- Test: `colitis-app/src/features/diary/analysis.test.ts`

**Interfaces:**
- Consumes: `DiaryEntryWithTriggers` (`colitis-app/src/features/diary/types.ts`, bereits vorhanden – Felder: `id: number`, `occurredAt: string`, `stoolFrequency: number`, `hasBlood: boolean`, `stoolConsistency: string`, `painLevel: number`, `symptoms: string[]`, `note: string | null`, `triggerCategories: string[]`), `TRIGGER_CATEGORY_OPTIONS` (`colitis-app/src/features/diary/constants.ts` – Array von `{key: TriggerCategory, label: string}`, Reihenfolge: ernaehrung, stress, schlaf, medikament, sonstiges), `TriggerCategory` Typ (`'ernaehrung' | 'stress' | 'schlaf' | 'medikament' | 'sonstiges'`).
- Produces: `TriggerPatternStat` Interface (`{category: TriggerCategory, entryCount: number, averagePainLevel: number}`) und `computeTriggerPatterns(entries: DiaryEntryWithTriggers[]): TriggerPatternStat[]` – wird von Task 3 (Screen) aufgerufen und von Task 2 (Komponente) als Prop-Typ verwendet.

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/diary/analysis.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeTriggerPatterns } from './analysis';
import type { DiaryEntryWithTriggers } from './types';

function buildEntry(overrides: Partial<DiaryEntryWithTriggers>): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-01T08:00:00.000Z',
    stoolFrequency: 3,
    hasBlood: false,
    stoolConsistency: 'normal',
    painLevel: 4,
    symptoms: [],
    note: null,
    triggerCategories: [],
    ...overrides,
  };
}

describe('computeTriggerPatterns', () => {
  it('returns an empty array for no entries', () => {
    expect(computeTriggerPatterns([])).toEqual([]);
  });

  it('returns an empty array when no entry has any trigger category', () => {
    const entries = [buildEntry({ id: 1 }), buildEntry({ id: 2 })];
    expect(computeTriggerPatterns(entries)).toEqual([]);
  });

  it('computes count and average pain level for a single matching entry', () => {
    const entries = [buildEntry({ id: 1, painLevel: 6, triggerCategories: ['stress'] })];
    expect(computeTriggerPatterns(entries)).toEqual([
      { category: 'stress', entryCount: 1, averagePainLevel: 6 },
    ]);
  });

  it('averages pain level across multiple entries with the same trigger, rounded to 1 decimal', () => {
    const entries = [
      buildEntry({ id: 1, painLevel: 5, triggerCategories: ['ernaehrung'] }),
      buildEntry({ id: 2, painLevel: 8, triggerCategories: ['ernaehrung'] }),
      buildEntry({ id: 3, painLevel: 4, triggerCategories: ['ernaehrung'] }),
    ];
    // (5 + 8 + 4) / 3 = 5.666... -> 5.7
    expect(computeTriggerPatterns(entries)).toEqual([
      { category: 'ernaehrung', entryCount: 3, averagePainLevel: 5.7 },
    ]);
  });

  it('counts an entry with multiple trigger categories toward each of its categories', () => {
    const entries = [buildEntry({ id: 1, painLevel: 7, triggerCategories: ['stress', 'schlaf'] })];
    const result = computeTriggerPatterns(entries);
    expect(result).toEqual([
      { category: 'stress', entryCount: 1, averagePainLevel: 7 },
      { category: 'schlaf', entryCount: 1, averagePainLevel: 7 },
    ]);
  });

  it('returns results in canonical TRIGGER_CATEGORY_OPTIONS order regardless of insertion order', () => {
    const entries = [
      buildEntry({ id: 1, triggerCategories: ['sonstiges'] }),
      buildEntry({ id: 2, triggerCategories: ['ernaehrung'] }),
      buildEntry({ id: 3, triggerCategories: ['medikament'] }),
    ];
    const categories = computeTriggerPatterns(entries).map((stat) => stat.category);
    expect(categories).toEqual(['ernaehrung', 'medikament', 'sonstiges']);
  });

  it('excludes categories with no matching entries', () => {
    const entries = [buildEntry({ id: 1, triggerCategories: ['stress'] })];
    const categories = computeTriggerPatterns(entries).map((stat) => stat.category);
    expect(categories).toEqual(['stress']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/diary/analysis.test.ts`
Expected: FAIL – `Cannot find module './analysis'` (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `colitis-app/src/features/diary/analysis.ts`:

```typescript
import { TRIGGER_CATEGORY_OPTIONS } from './constants';
import type { TriggerCategory } from './constants';
import type { DiaryEntryWithTriggers } from './types';

export interface TriggerPatternStat {
  category: TriggerCategory;
  entryCount: number;
  averagePainLevel: number;
}

export function computeTriggerPatterns(entries: DiaryEntryWithTriggers[]): TriggerPatternStat[] {
  const stats: TriggerPatternStat[] = [];

  for (const option of TRIGGER_CATEGORY_OPTIONS) {
    const matchingEntries = entries.filter((entry) => entry.triggerCategories.includes(option.key));

    if (matchingEntries.length === 0) {
      continue;
    }

    const totalPainLevel = matchingEntries.reduce((sum, entry) => sum + entry.painLevel, 0);
    const averagePainLevel = Math.round((totalPainLevel / matchingEntries.length) * 10) / 10;

    stats.push({
      category: option.key,
      entryCount: matchingEntries.length,
      averagePainLevel,
    });
  }

  return stats;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/diary/analysis.test.ts`
Expected: PASS (7/7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/diary/analysis.ts src/features/diary/analysis.test.ts
git commit -m "feat: Trigger-Muster-Berechnung (Anzahl + Schmerzlevel-Durchschnitt pro Kategorie)"
```

---

### Task 2: TriggerAnalysisView – Anzeige-Komponente

**Files:**
- Create: `colitis-app/src/features/diary/components/TriggerAnalysisView.tsx`

**Interfaces:**
- Consumes: `TriggerPatternStat` und die exportierte Liste-Form von `computeTriggerPatterns` aus Task 1 (`colitis-app/src/features/diary/analysis.ts`); `TRIGGER_CATEGORY_OPTIONS` aus `colitis-app/src/features/diary/constants.ts` (für deutsche Labels); `tokens` aus `colitis-app/src/styles/tokens.ts`.
- Produces: `TriggerAnalysisView({patterns}: {patterns: TriggerPatternStat[]})` – rein präsentational, keine DB-/Hook-Zugriffe. Wird von Task 3 (`auswertung.tsx`) verwendet.

Kein automatisierter Test für diese Datei (React Native kann unter Vitest nicht geparst werden – siehe Global Constraints). Manuelle Prüfung erfolgt über die Screen-Verifikation in Task 3 sowie den späteren Alltagstest.

- [ ] **Step 1: Implement the component**

Create `colitis-app/src/features/diary/components/TriggerAnalysisView.tsx`:

```typescript
import { Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { TRIGGER_CATEGORY_OPTIONS } from '../constants';
import type { TriggerPatternStat } from '../analysis';

interface TriggerAnalysisViewProps {
  patterns: TriggerPatternStat[];
}

function labelForCategory(category: string): string {
  return TRIGGER_CATEGORY_OPTIONS.find((option) => option.key === category)?.label ?? category;
}

export function TriggerAnalysisView({ patterns }: TriggerAnalysisViewProps) {
  if (patterns.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Noch keine Auswertung möglich. Erfasse Einträge mit Auslösern im Tagebuch, um hier Muster zu
          sehen.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {patterns.map((pattern) => (
        <View key={pattern.category} style={styles.card}>
          <Text style={styles.cardTitle}>{labelForCategory(pattern.category)}</Text>
          <Text style={styles.cardDetail}>
            {pattern.entryCount} {pattern.entryCount === 1 ? 'Eintrag' : 'Einträge'}
          </Text>
          <Text style={styles.cardDetail}>Ø Schmerzlevel: {pattern.averagePainLevel}/10</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: tokens.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardDetail: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
});
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (all existing tests + the 7 new tests from Task 1, no failures)

- [ ] **Step 3: Run the TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/diary/components/TriggerAnalysisView.tsx
git commit -m "feat: TriggerAnalysisView-Komponente fuer Muster-Auswertung"
```

---

### Task 3: Auswertung-Screen & Navigation

**Files:**
- Create: `colitis-app/app/(tabs)/tagebuch/auswertung.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/_layout.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: `createEncryptedDb` (`colitis-app/src/db/client.ts`), `listDiaryEntries` (`colitis-app/src/features/diary/db/diaryRepository.ts`), `computeTriggerPatterns`/`TriggerPatternStat` (Task 1), `TriggerAnalysisView` (Task 2), `tokens` (`colitis-app/src/styles/tokens.ts`).
- Produces: neue Route `/tagebuch/auswertung`, erreichbar per `router.push('/tagebuch/auswertung')` von der Verlaufsansicht aus.

- [ ] **Step 1: Create the Auswertung screen**

Create `colitis-app/app/(tabs)/tagebuch/auswertung.tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { computeTriggerPatterns } from '../../../src/features/diary/analysis';
import { TriggerAnalysisView } from '../../../src/features/diary/components/TriggerAnalysisView';
import { tokens } from '../../../src/styles/tokens';
import type { TriggerPatternStat } from '../../../src/features/diary/analysis';

export default function AuswertungScreen() {
  const [patterns, setPatterns] = useState<TriggerPatternStat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((entries) => {
          if (isActive) {
            setPatterns(computeTriggerPatterns(entries));
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Auswertung] Laden der Auswertung fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Auswertung konnte nicht geladen werden.');
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
      <TriggerAnalysisView patterns={patterns} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Register the screen in the Tagebuch Stack layout**

Modify `colitis-app/app/(tabs)/tagebuch/_layout.tsx` – add a new `Stack.Screen` entry after the existing `neu` entry:

```typescript
import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function TagebuchLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
      <Stack.Screen name="neu" options={{ title: 'Neuer Eintrag' }} />
      <Stack.Screen name="auswertung" options={{ title: 'Auswertung' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Add a navigation link from the Verlaufsansicht**

Modify `colitis-app/app/(tabs)/tagebuch/index.tsx` – add a `Pressable` link right after the error banner and before `DiaryHistoryList`, and the corresponding styles:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';

export default function TagebuchScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((loadedEntries) => {
          if (isActive) {
            setEntries(loadedEntries);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Laden der Einträge fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einträge konnten nicht geladen werden.');
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Muster-Auswertung ansehen"
        style={styles.analysisLink}
        onPress={() => router.push('/tagebuch/auswertung')}
      >
        <Text style={styles.analysisLinkText}>Muster-Auswertung ansehen →</Text>
      </Pressable>
      <DiaryHistoryList entries={entries} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  analysisLink: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  analysisLinkText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    right: tokens.spacing.lg,
    bottom: tokens.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  addButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 4: Run the full test suite and TypeScript check**

Run: `npx vitest run`
Expected: PASS (all tests, no failures)

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/tagebuch/auswertung.tsx app/\(tabs\)/tagebuch/_layout.tsx app/\(tabs\)/tagebuch/index.tsx
git commit -m "feat: Auswertung-Screen fuer Trigger-Muster + Navigation aus der Verlaufsansicht"
```
