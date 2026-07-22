# Schub-Frühwarnung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beim Öffnen des Tagebuch-Tabs proaktiv auf eine Häufung schub-verdächtiger Tage in der letzten Woche hinweisen.

**Architecture:** Eine reine Erkennungsfunktion (`flareWarning.ts`), die die bereits vorhandene Kalender-Bewertungslogik wiederverwendet, eine neue Banner-Komponente, und eine kleine Erweiterung des bestehenden Tagebuch-Tab-Screens (lokaler, nicht persistierter Dismiss-State).

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-schub-fruehwarnung-design.md`
- Keine neue Abhängigkeit in `package.json`.
- Keine Datenbank-/Schema-Änderung.
- Keine Hintergrundausführung/Push-Benachrichtigung – Erkennung läuft ausschließlich beim Fokussieren des Tagebuch-Tabs.
- Fenster: letzte 7 Kalendertage (einschließlich des Referenzdatums). Schwelle: mindestens 3 als `'bad'` bewertete Tage in diesem Fenster. Tage müssen nicht aufeinanderfolgen.
- Wiederverwendung der bestehenden `groupEntriesByDay`, `rateDayEntries`, `formatDateKey` aus `src/features/diary/calendarLogic.ts` – keine neue/duplizierte Bewertungslogik.
- Der "Weggeklickt"-Zustand ist reiner Komponenten-State (kein `AsyncStorage`/keine DB), setzt sich bei App-Neustart automatisch zurück.
- Alle UI-Texte auf Deutsch, Themes über `useTheme()`/`ThemeColors`, keine hartkodierten Hex-Farben in Komponenten.
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier nicht nötig, reines React Native + bestehende Logik).

---

### Task 1: Erkennungslogik

**Files:**
- Create: `colitis-app/src/features/diary/flareWarning.ts`
- Test: `colitis-app/src/features/diary/flareWarning.test.ts`

**Interfaces:**
- Consumes: `groupEntriesByDay(entries: DiaryEntryWithTriggers[]): Map<string, DiaryEntryWithTriggers[]>`, `rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating`, `formatDateKey(date: Date): string` aus `./calendarLogic` (alle bereits vorhanden und exportiert); `DiaryEntryWithTriggers` aus `./types`.
- Produces (für Task 3):
  - `export function shouldShowFlareWarning(entries: DiaryEntryWithTriggers[], referenceDate: Date): boolean`

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/diary/flareWarning.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldShowFlareWarning } from './flareWarning';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-22T10:00:00',
    stoolFrequency: 1,
    hasBlood: false,
    stoolConsistency: 'normal',
    painLevel: 1,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

const REFERENCE_DATE = new Date(2026, 6, 22); // 22. Juli 2026, lokal (Monat 0-indiziert)

describe('shouldShowFlareWarning', () => {
  it('returns false for no entries', () => {
    expect(shouldShowFlareWarning([], REFERENCE_DATE)).toBe(false);
  });

  it('returns false when only 2 bad days occur within the last 7 days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', hasBlood: true }),
      makeEntry({ id: 2, occurredAt: '2026-07-20T08:00:00', hasBlood: true }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(false);
  });

  it('returns true when exactly 3 bad days occur within the last 7 days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', hasBlood: true }),
      makeEntry({ id: 2, occurredAt: '2026-07-20T08:00:00', hasBlood: true }),
      makeEntry({ id: 3, occurredAt: '2026-07-18T08:00:00', hasBlood: true }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(true);
  });

  it('does not count a bad day outside the 7-day window', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', hasBlood: true }),
      makeEntry({ id: 2, occurredAt: '2026-07-20T08:00:00', hasBlood: true }),
      makeEntry({ id: 3, occurredAt: '2026-07-10T08:00:00', hasBlood: true }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(false);
  });

  it('counts non-consecutive bad days within the window the same as consecutive ones', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', hasBlood: true }),
      makeEntry({ id: 2, occurredAt: '2026-07-19T08:00:00', hasBlood: true }),
      makeEntry({ id: 3, occurredAt: '2026-07-16T08:00:00', hasBlood: true }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(true);
  });

  it('ignores good days when counting toward the threshold', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', hasBlood: true }),
      makeEntry({ id: 2, occurredAt: '2026-07-21T08:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-20T08:00:00', hasBlood: true }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/diary/flareWarning.test.ts`
Expected: FAIL — `flareWarning.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/diary/flareWarning.ts`:

```typescript
import { groupEntriesByDay, rateDayEntries, formatDateKey } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

const FLARE_WARNING_WINDOW_DAYS = 7;
const FLARE_WARNING_THRESHOLD = 3;

export function shouldShowFlareWarning(entries: DiaryEntryWithTriggers[], referenceDate: Date): boolean {
  const entriesByDay = groupEntriesByDay(entries);
  let badDayCount = 0;

  for (let offset = 0; offset < FLARE_WARNING_WINDOW_DAYS; offset++) {
    const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - offset);
    const dateKey = formatDateKey(day);
    const dayEntries = entriesByDay.get(dateKey) ?? [];

    if (dayEntries.length > 0 && rateDayEntries(dayEntries) === 'bad') {
      badDayCount++;
    }
  }

  return badDayCount >= FLARE_WARNING_THRESHOLD;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/diary/flareWarning.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün, keine neuen Typfehler.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/diary/flareWarning.ts colitis-app/src/features/diary/flareWarning.test.ts
git commit -m "feat: Erkennungslogik fuer Schub-Fruehwarnung ergaenzen"
```

---

### Task 2: Banner-Komponente

**Files:**
- Create: `colitis-app/src/features/diary/components/FlareWarningBanner.tsx`

**Interfaces:**
- Consumes: `useTheme()` aus `../../../theme/ThemeContext`, `tokens` aus `../../../styles/tokens`, `ThemeColors` aus `../../../theme/types`.
- Produces (für Task 3):
  - `export function FlareWarningBanner(props: { onDismiss: () => void }): JSX.Element` in `colitis-app/src/features/diary/components/FlareWarningBanner.tsx`

Diese Komponente ist im bestehenden Projekt nicht automatisiert testbar (gleiches Muster wie `LocationPermissionBanner.tsx` — keine Test-Datei für einfache Banner-Komponenten). Verifikation über `tsc --noEmit` in Schritt 2.

- [ ] **Step 1: `FlareWarningBanner.tsx` erstellen**

Create `colitis-app/src/features/diary/components/FlareWarningBanner.tsx`:

```typescript
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { ThemeColors } from '../../../theme/types';

interface FlareWarningBannerProps {
  onDismiss: () => void;
}

export function FlareWarningBanner({ onDismiss }: FlareWarningBannerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.banner}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Warnung schließen"
        style={styles.closeButton}
        onPress={onDismiss}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
      <Text style={styles.text}>
        Mehrere schub-verdächtige Tage in der letzten Woche – ziehe in Erwägung, deinen Arzt zu kontaktieren.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 2,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.md,
      paddingRight: tokens.spacing.xl,
    },
    closeButton: {
      position: 'absolute',
      right: tokens.spacing.sm,
      top: tokens.spacing.sm,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textSecondary,
    },
    text: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
```

- [ ] **Step 2: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün (diese Aufgabe fügt keine neuen Tests hinzu, `flareWarning.test.ts` aus Task 1 muss weiterhin bestehen).

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/diary/components/FlareWarningBanner.tsx
git commit -m "feat: Banner-Komponente fuer Schub-Fruehwarnung ergaenzen"
```

---

### Task 3: Einbindung im Tagebuch-Tab

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: `shouldShowFlareWarning` aus `../../../src/features/diary/flareWarning` (Task 1); `FlareWarningBanner` aus `../../../src/features/diary/components/FlareWarningBanner` (Task 2).
- Produces: Nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe ändert nur eine bestehende Screen-Datei (UI-Verdrahtung + zusätzlicher lokaler State), keine neue Logik — nicht automatisiert testbar, gleiches Muster wie die bisherigen Erweiterungen dieser Datei. Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Datei komplett ersetzen**

Ersetze den vollständigen Inhalt von `colitis-app/app/(tabs)/tagebuch/index.tsx` mit:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries, deleteDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { exportDiaryEntriesAsPdf } from '../../../src/features/diary/diaryPdfExport';
import { exportDiaryEntriesAsCsv } from '../../../src/features/diary/diaryCsvExport';
import { shouldShowFlareWarning } from '../../../src/features/diary/flareWarning';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { DiaryCalendarView } from '../../../src/features/diary/components/DiaryCalendarView';
import { FlareWarningBanner } from '../../../src/features/diary/components/FlareWarningBanner';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function TagebuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isFlareWarningDismissed, setIsFlareWarningDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((loadedEntries) => {
          if (isActive) {
            setEntries(loadedEntries);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Laden der Einträge fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einträge konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  function handleDelete(entryId: number) {
    Alert.alert('Eintrag löschen?', 'Dieser Tagebucheintrag wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void confirmDelete(entryId),
      },
    ]);
  }

  async function confirmDelete(entryId: number) {
    try {
      const db = await createEncryptedDb();
      await deleteDiaryEntry(db, entryId);
      setEntries(await listDiaryEntries(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Tagebuch] Löschen fehlgeschlagen:', deleteError);
      setError('Eintrag konnte nicht gelöscht werden.');
    }
  }

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      await exportDiaryEntriesAsPdf(entries);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Tagebuch] PDF-Export fehlgeschlagen:', exportError);
      setError('PDF-Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      await exportDiaryEntriesAsCsv(entries);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Tagebuch] CSV-Export fehlgeschlagen:', exportError);
      setError('CSV-Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }

  const showFlareWarning = !isFlareWarningDismissed && shouldShowFlareWarning(entries, new Date());

  return (
    <View style={styles.container}>
      {showFlareWarning && <FlareWarningBanner onDismiss={() => setIsFlareWarningDismissed(true)} />}
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
    analysisLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    exportLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    exportLinkDisabled: {
      opacity: 0.5,
    },
    exportLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
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
    addButton: {
      position: 'absolute',
      right: tokens.spacing.lg,
      bottom: tokens.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    addButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

Änderungen gegenüber der bisherigen Datei: zwei neue Importe (`shouldShowFlareWarning`, `FlareWarningBanner`), neuer `isFlareWarningDismissed`-State, neue abgeleitete Variable `showFlareWarning` (berechnet bei jedem Render aus `entries` und `isFlareWarningDismissed`, kein zusätzlicher `useEffect` nötig), neues bedingtes Banner ganz oben im `return`-Block, vor dem bestehenden Fehlerbanner. Alle bestehenden Handler, State-Variablen, Styles und der restliche JSX-Baum bleiben inhaltlich unverändert.

- [ ] **Step 2: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build)**

- Mindestens 3 Tagebucheinträge mit Blut im Stuhl an unterschiedlichen Tagen innerhalb der letzten 7 Tage anlegen (z. B. über die Testdaten oder manuell in der App) → beim Öffnen des Tagebuch-Tabs erscheint das Warnbanner.
- Banner mit "×" schließen → verschwindet, Tab wechseln und zurückkehren → bleibt weiterhin verschwunden (solange die App nicht neu gestartet wird).
- App vollständig neu starten (nicht nur den Tab wechseln) → Banner erscheint wieder, sofern die Schwelle weiterhin erfüllt ist.
- Einen der auslösenden Einträge löschen, bis weniger als 3 schub-verdächtige Tage übrig sind → Banner erscheint nicht mehr.
- Alle drei Themes (Standard, Dunkel, Blau-Weiß) durchschalten und das Banner auf Lesbarkeit prüfen.

- [ ] **Step 5: Commit**

```bash
git add "colitis-app/app/(tabs)/tagebuch/index.tsx"
git commit -m "feat: Schub-Fruehwarnung im Tagebuch-Tab verdrahten"
```
