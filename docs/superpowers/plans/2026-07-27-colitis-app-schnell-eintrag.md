# Schnell-Eintrag und aufgeräumter Tagebuch-Tab — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Tagebucheintrag lässt sich mit einem Tipp erfassen, und der Tagebuch-Tab zeigt seine Liste statt fünf gestapelter Aktionszeilen.

**Architecture:** Ein neuer Bildschirm `/tagebuch/schnell` zählt den heutigen Tageseintrag hoch, statt Einzeleinträge anzulegen — dadurch bleiben Bewertungslogik, Kalender und Schub-Frühwarnung unverändert gültig. Die Zusammenführungsregeln liegen in einem reinen, vollständig getesteten Logikmodul; der Bildschirm ruft nur auf. Im Tagebuch-Tab wandern die beiden Export-Knöpfe in ein Kopfzeilen-Menü und die beiden Navigationslinks werden zu einer Chip-Zeile.

**Tech Stack:** React Native 0.86.2, Expo SDK 57, TypeScript, expo-router, Drizzle ORM über SQLCipher-SQLite, Vitest (mit better-sqlite3 für Repository-Tests).

## Global Constraints

Diese Anforderungen gelten für **jede** Aufgabe dieses Plans:

- **Erfassungsmodell:** Ein Tipp zählt den heutigen Tageseintrag hoch. Es werden niemals mehrere Einträge pro Tag durch den Schnell-Eintrag erzeugt.
- **Konsistenz-Reihenfolge:** `hart` (0) < `normal` (1) < `weich` (2) < `waessrig` (3). Bei Zusammenführung gewinnt die schlechtere.
- **Blut:** Einmal auf `true` gesetzt, bleibt `true`. Ein späterer Tipp darf es nie auf `false` zurücksetzen.
- **`occurredAt`** bleibt beim Hochzählen unverändert.
- **Niemals überschreiben:** `painLevel`, `symptoms`, `note` und die Auslöser-Einträge werden vom Schnell-Eintrag nie verändert.
- **Unverändert bleiben:** `src/features/diary/calendarLogic.ts` und `src/features/diary/flareWarning.ts`. Wer sie anfasst, hat den Sinn dieses Vorhabens verfehlt.
- **Keine neuen npm-Abhängigkeiten.** Alles Nötige ist vorhanden.
- **Expo SDK 57:** Laut `colitis-app/AGENTS.md` sind die versionierten Dokumente unter https://docs.expo.dev/versions/v57.0.0/ zu prüfen, bevor eine Expo- oder expo-router-API verwendet wird.
- **Windows-Umgebung:** Immer `npx.cmd`, nie `npx`. Alle Befehle werden aus `D:\Claude\colitis-app` ausgeführt.
- **`Alert.alert` fasst auf Android genau drei Schaltflächen.** Keine vierte hinzufügen.
- **Deutsche UI-Texte wörtlich** wie in den Aufgaben angegeben, inklusive des Auslassungszeichens „…" als Einzelzeichen (nicht drei Punkte).

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `src/features/diary/quickEntryLogic.ts` (neu) | Reine Zusammenführungsregeln: schlechtere Konsistenz, klebendes Blut, heutigen Eintrag finden |
| `src/features/diary/quickEntryLogic.test.ts` (neu) | Tests dazu |
| `src/features/diary/db/diaryRepository.ts` (ändern) | `updateDiaryEntryQuickFields` ergänzen |
| `src/features/diary/db/diaryRepository.test.ts` (ändern) | Test dafür ergänzen |
| `app/(tabs)/tagebuch/schnell.tsx` (neu) | Der Schnell-Eintrag-Bildschirm |
| `app/(tabs)/tagebuch/_layout.tsx` (ändern) | Route registrieren |
| `plugins/withNewDiaryEntryWidget.js` (ändern) | Deep-Link-Ziel und Beschriftung |
| `app/(tabs)/tagebuch/index.tsx` (ändern) | Kopfzeilen-Menü, Chip-Zeile, „+" umleiten |

---

### Task 1: Reine Zusammenführungslogik

**Files:**
- Create: `colitis-app/src/features/diary/quickEntryLogic.ts`
- Test: `colitis-app/src/features/diary/quickEntryLogic.test.ts`

**Interfaces:**
- Consumes: `formatDateKey(date: Date): string` aus `./calendarLogic`; Typ `StoolConsistency = 'hart' | 'normal' | 'weich' | 'waessrig'` aus `./constants`; Typen `DiaryEntryWithTriggers` und `NewDiaryEntryInput` aus `./types`
- Produces:
  - `STOOL_CONSISTENCY_SEVERITY: Record<StoolConsistency, number>`
  - `worseConsistency(a: StoolConsistency, b: StoolConsistency): StoolConsistency`
  - `findTodaysEntry(entries: DiaryEntryWithTriggers[], now: Date): DiaryEntryWithTriggers | null`
  - `buildQuickEntryInput(consistency: StoolConsistency, hasBlood: boolean, occurredAt: string): NewDiaryEntryInput`
  - `buildQuickEntryUpdate(existing: DiaryEntryWithTriggers, consistency: StoolConsistency, hasBlood: boolean): QuickEntryUpdate`
  - `interface QuickEntryUpdate { stoolFrequency: number; hasBlood: boolean; stoolConsistency: StoolConsistency; }`

**Wichtiger Hinweis zu Zeitzonen:** `formatDateKey` arbeitet mit lokaler Zeit (`getFullYear`/`getMonth`/`getDate`). Testdaten dürfen deshalb **nicht** als feste UTC-Zeichenketten wie `'2026-07-27T10:00:00.000Z'` geschrieben werden — in einer Zeitzone weit westlich fiele das auf den Vortag und der Test würde je nach Rechner unterschiedlich ausgehen. Stattdessen wird die Hilfsfunktion `localIso` verwendet, die aus lokalen Datumsbestandteilen eine ISO-Zeichenkette baut.

- [ ] **Step 1: Testdatei schreiben**

Datei `colitis-app/src/features/diary/quickEntryLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  STOOL_CONSISTENCY_SEVERITY,
  worseConsistency,
  findTodaysEntry,
  buildQuickEntryInput,
  buildQuickEntryUpdate,
} from './quickEntryLogic';
import type { DiaryEntryWithTriggers } from './types';

function localIso(year: number, monthIndex: number, day: number, hour: number): string {
  return new Date(year, monthIndex, day, hour, 0, 0).toISOString();
}

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: localIso(2026, 6, 27, 10),
    stoolFrequency: 2,
    hasBlood: false,
    stoolConsistency: 'normal',
    painLevel: 3,
    symptoms: ['muedigkeit'],
    note: 'Vorhandene Notiz',
    triggerCategories: ['stress'],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('STOOL_CONSISTENCY_SEVERITY', () => {
  it('orders consistencies from harmless to worst', () => {
    expect(STOOL_CONSISTENCY_SEVERITY.hart).toBe(0);
    expect(STOOL_CONSISTENCY_SEVERITY.normal).toBe(1);
    expect(STOOL_CONSISTENCY_SEVERITY.weich).toBe(2);
    expect(STOOL_CONSISTENCY_SEVERITY.waessrig).toBe(3);
  });
});

describe('worseConsistency', () => {
  it('returns the worse value regardless of argument order', () => {
    expect(worseConsistency('hart', 'normal')).toBe('normal');
    expect(worseConsistency('normal', 'hart')).toBe('normal');
    expect(worseConsistency('normal', 'weich')).toBe('weich');
    expect(worseConsistency('weich', 'normal')).toBe('weich');
    expect(worseConsistency('weich', 'waessrig')).toBe('waessrig');
    expect(worseConsistency('waessrig', 'weich')).toBe('waessrig');
    expect(worseConsistency('hart', 'waessrig')).toBe('waessrig');
    expect(worseConsistency('waessrig', 'hart')).toBe('waessrig');
  });

  it('returns the value itself when both are equal', () => {
    expect(worseConsistency('weich', 'weich')).toBe('weich');
  });
});

describe('findTodaysEntry', () => {
  const now = new Date(2026, 6, 27, 18, 0, 0);

  it('returns null for an empty list', () => {
    expect(findTodaysEntry([], now)).toBeNull();
  });

  it('returns null when every entry is from another day', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 26, 23) }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 28, 1) }),
    ];
    expect(findTodaysEntry(entries, now)).toBeNull();
  });

  it("returns today's entry", () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 26, 9) }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 9) }),
    ];
    expect(findTodaysEntry(entries, now)?.id).toBe(2);
  });

  it('returns the newest entry when several exist for today', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 27, 8) }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 15) }),
      makeEntry({ id: 3, occurredAt: localIso(2026, 6, 27, 11) }),
    ];
    expect(findTodaysEntry(entries, now)?.id).toBe(2);
  });

  it('ignores an entry from the same day and month one year earlier', () => {
    const entries = [makeEntry({ id: 1, occurredAt: localIso(2025, 6, 27, 10) })];
    expect(findTodaysEntry(entries, now)).toBeNull();
  });
});

describe('buildQuickEntryInput', () => {
  it('records frequency 1 and leaves every optional field empty', () => {
    const occurredAt = localIso(2026, 6, 27, 12);
    const input = buildQuickEntryInput('weich', false, occurredAt);

    expect(input).toEqual({
      occurredAt,
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'weich',
      painLevel: 0,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });
  });

  it('passes the blood flag through', () => {
    const input = buildQuickEntryInput('waessrig', true, localIso(2026, 6, 27, 12));
    expect(input.hasBlood).toBe(true);
  });
});

describe('buildQuickEntryUpdate', () => {
  it('increments the frequency by one', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolFrequency: 4 }), 'normal', false);
    expect(update.stoolFrequency).toBe(5);
  });

  it('keeps blood set once it was recorded', () => {
    const update = buildQuickEntryUpdate(makeEntry({ hasBlood: true }), 'normal', false);
    expect(update.hasBlood).toBe(true);
  });

  it('sets blood when this tap reports it', () => {
    const update = buildQuickEntryUpdate(makeEntry({ hasBlood: false }), 'normal', true);
    expect(update.hasBlood).toBe(true);
  });

  it('keeps the worse consistency when the new one is milder', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolConsistency: 'waessrig' }), 'hart', false);
    expect(update.stoolConsistency).toBe('waessrig');
  });

  it('takes over the new consistency when it is worse', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolConsistency: 'hart' }), 'weich', false);
    expect(update.stoolConsistency).toBe('weich');
  });

  it('falls back to normal when the stored consistency is unknown', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolConsistency: 'unbekannt' }), 'hart', false);
    expect(update.stoolConsistency).toBe('normal');
  });

  it('reports only the three quick fields', () => {
    const update = buildQuickEntryUpdate(makeEntry(), 'normal', false);
    expect(Object.keys(update).sort()).toEqual(['hasBlood', 'stoolConsistency', 'stoolFrequency']);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/quickEntryLogic.test.ts`

Erwartet: FEHLER — die Datei `./quickEntryLogic` existiert nicht („Failed to resolve import").

- [ ] **Step 3: Modul umsetzen**

Datei `colitis-app/src/features/diary/quickEntryLogic.ts`:

```typescript
import { formatDateKey } from './calendarLogic';
import type { StoolConsistency } from './constants';
import type { DiaryEntryWithTriggers, NewDiaryEntryInput } from './types';

export const STOOL_CONSISTENCY_SEVERITY: Record<StoolConsistency, number> = {
  hart: 0,
  normal: 1,
  weich: 2,
  waessrig: 3,
};

const FALLBACK_CONSISTENCY: StoolConsistency = 'normal';

export interface QuickEntryUpdate {
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency;
}

function toKnownConsistency(value: string): StoolConsistency {
  return value in STOOL_CONSISTENCY_SEVERITY ? (value as StoolConsistency) : FALLBACK_CONSISTENCY;
}

export function worseConsistency(a: StoolConsistency, b: StoolConsistency): StoolConsistency {
  return STOOL_CONSISTENCY_SEVERITY[b] > STOOL_CONSISTENCY_SEVERITY[a] ? b : a;
}

export function findTodaysEntry(
  entries: DiaryEntryWithTriggers[],
  now: Date
): DiaryEntryWithTriggers | null {
  const todayKey = formatDateKey(now);
  let newest: DiaryEntryWithTriggers | null = null;

  for (const entry of entries) {
    if (formatDateKey(new Date(entry.occurredAt)) !== todayKey) {
      continue;
    }
    if (newest === null || entry.occurredAt > newest.occurredAt) {
      newest = entry;
    }
  }

  return newest;
}

export function buildQuickEntryInput(
  consistency: StoolConsistency,
  hasBlood: boolean,
  occurredAt: string
): NewDiaryEntryInput {
  return {
    occurredAt,
    stoolFrequency: 1,
    hasBlood,
    stoolConsistency: consistency,
    painLevel: 0,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
  };
}

export function buildQuickEntryUpdate(
  existing: DiaryEntryWithTriggers,
  consistency: StoolConsistency,
  hasBlood: boolean
): QuickEntryUpdate {
  return {
    stoolFrequency: existing.stoolFrequency + 1,
    hasBlood: existing.hasBlood || hasBlood,
    stoolConsistency: worseConsistency(toKnownConsistency(existing.stoolConsistency), consistency),
  };
}
```

Zur Sortierannahme: `findTodaysEntry` verlässt sich bewusst **nicht** darauf, dass die übergebene Liste bereits absteigend sortiert ist, sondern vergleicht die `occurredAt`-Zeichenketten selbst. ISO-8601-Zeichenketten mit `Z`-Suffix vergleichen sich lexikografisch identisch zur zeitlichen Reihenfolge. Das ist die stärkere Zusicherung und gegen spätere Änderungen an der Sortierung unempfindlich.

- [ ] **Step 4: Tests laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/quickEntryLogic.test.ts`

Erwartet: BESTANDEN — 1 Testdatei, 17 Tests.

- [ ] **Step 5: Typprüfung**

Ausführen: `npx.cmd tsc --noEmit --pretty false`

Erwartet: Keine Ausgabe, Rückgabewert 0.

- [ ] **Step 6: Committen**

```bash
git add colitis-app/src/features/diary/quickEntryLogic.ts colitis-app/src/features/diary/quickEntryLogic.test.ts
git commit -m "feat: Zusammenfuehrungslogik fuer Schnell-Eintrag ergaenzen"
```

---

### Task 2: Repository um gezieltes Aktualisieren erweitern

**Files:**
- Modify: `colitis-app/src/features/diary/db/diaryRepository.ts`
- Test: `colitis-app/src/features/diary/db/diaryRepository.test.ts`

**Interfaces:**
- Consumes: `QuickEntryUpdate` aus `../quickEntryLogic` (Task 1) — `{ stoolFrequency: number; hasBlood: boolean; stoolConsistency: StoolConsistency }`; vorhandene `DiaryDb`, `createDiaryEntry`, `listDiaryEntries` aus derselben Datei
- Produces: `updateDiaryEntryQuickFields(db: DiaryDb, entryId: number, update: QuickEntryUpdate): Promise<void>`

Die Testdatei besitzt bereits die Hilfsfunktion `createTestDb()`, die eine SQLite-Datenbank im Arbeitsspeicher aus `drizzle/0000_remarkable_junta.sql` aufbaut, sowie ein `beforeEach`, das `db` neu setzt. Beides wird weiterverwendet, nicht neu geschrieben.

- [ ] **Step 1: Fehlschlagenden Test ergänzen**

In `colitis-app/src/features/diary/db/diaryRepository.test.ts` die Import-Zeile für das Repository um die neue Funktion erweitern:

```typescript
import {
  createDiaryEntry,
  listDiaryEntries,
  deleteDiaryEntry,
  updateDiaryEntryQuickFields,
} from './diaryRepository';
```

Am Ende des `describe('diary repository', …)`-Blocks, vor dessen schließender Klammer, einfügen:

```typescript
  it('updates only the quick fields and leaves every other field untouched', async () => {
    const id = await createDiaryEntry(db, {
      occurredAt: '2026-07-27T09:00:00.000Z',
      stoolFrequency: 2,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 6,
      symptoms: ['bauchschmerzen', 'muedigkeit'],
      note: 'Diese Notiz muss erhalten bleiben',
      triggerCategories: ['ernaehrung'],
      foodTriggerNote: 'Kaffee',
    });

    await updateDiaryEntryQuickFields(db, id, {
      stoolFrequency: 3,
      hasBlood: true,
      stoolConsistency: 'waessrig',
    });

    const [entry] = await listDiaryEntries(db);

    expect(entry.stoolFrequency).toBe(3);
    expect(entry.hasBlood).toBe(true);
    expect(entry.stoolConsistency).toBe('waessrig');

    expect(entry.occurredAt).toBe('2026-07-27T09:00:00.000Z');
    expect(entry.painLevel).toBe(6);
    expect(entry.symptoms).toEqual(['bauchschmerzen', 'muedigkeit']);
    expect(entry.note).toBe('Diese Notiz muss erhalten bleiben');
    expect(entry.triggerCategories).toEqual(['ernaehrung']);
    expect(entry.foodTriggerNote).toBe('Kaffee');
  });

  it('leaves other entries untouched', async () => {
    const firstId = await createDiaryEntry(db, {
      occurredAt: '2026-07-26T09:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'hart',
      painLevel: 0,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });
    await createDiaryEntry(db, {
      occurredAt: '2026-07-27T09:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 0,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });

    await updateDiaryEntryQuickFields(db, firstId, {
      stoolFrequency: 9,
      hasBlood: true,
      stoolConsistency: 'waessrig',
    });

    const entries = await listDiaryEntries(db);
    const untouched = entries.find((entry) => entry.id !== firstId);

    expect(untouched?.stoolFrequency).toBe(1);
    expect(untouched?.hasBlood).toBe(false);
    expect(untouched?.stoolConsistency).toBe('normal');
  });
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/db/diaryRepository.test.ts`

Erwartet: FEHLER — `updateDiaryEntryQuickFields is not a function` beziehungsweise ein Import-Fehler.

- [ ] **Step 3: Funktion umsetzen**

In `colitis-app/src/features/diary/db/diaryRepository.ts` den Import-Block um den Typ erweitern (unterhalb der vorhandenen Importe):

```typescript
import type { QuickEntryUpdate } from '../quickEntryLogic';
```

Und am Ende der Datei ergänzen:

```typescript
export async function updateDiaryEntryQuickFields(
  db: DiaryDb,
  entryId: number,
  update: QuickEntryUpdate
): Promise<void> {
  await db
    .update(diaryEntries)
    .set({
      stoolFrequency: update.stoolFrequency,
      hasBlood: update.hasBlood,
      stoolConsistency: update.stoolConsistency,
    })
    .where(eq(diaryEntries.id, entryId));
}
```

`eq` und `diaryEntries` sind in dieser Datei bereits importiert; es wird kein weiterer Wert-Import benötigt.

- [ ] **Step 4: Tests laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/db/diaryRepository.test.ts`

Erwartet: BESTANDEN — alle vorher vorhandenen Tests plus die zwei neuen.

- [ ] **Step 5: Typprüfung**

Ausführen: `npx.cmd tsc --noEmit --pretty false`

Erwartet: Keine Ausgabe, Rückgabewert 0.

- [ ] **Step 6: Committen**

```bash
git add colitis-app/src/features/diary/db/diaryRepository.ts colitis-app/src/features/diary/db/diaryRepository.test.ts
git commit -m "feat: Gezieltes Aktualisieren der Schnell-Eintrag-Felder im Repository"
```

---

### Task 3: Schnell-Eintrag-Bildschirm, Route und Widget-Ziel

**Files:**
- Create: `colitis-app/app/(tabs)/tagebuch/schnell.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/_layout.tsx`
- Modify: `colitis-app/plugins/withNewDiaryEntryWidget.js`

**Interfaces:**
- Consumes aus Task 1: `findTodaysEntry(entries, now)`, `buildQuickEntryInput(consistency, hasBlood, occurredAt)`, `buildQuickEntryUpdate(existing, consistency, hasBlood)` aus `src/features/diary/quickEntryLogic`
- Consumes aus Task 2: `updateDiaryEntryQuickFields(db, entryId, update)` aus `src/features/diary/db/diaryRepository`
- Consumes vorhanden: `createEncryptedDb()` aus `src/db/client`; `createDiaryEntry`, `listDiaryEntries` aus dem Repository; `STOOL_CONSISTENCY_OPTIONS: SelectOption<StoolConsistency>[]` aus `src/features/diary/constants` (Einträge in der Reihenfolge Hart, Normal, Weich, Wässrig); `useTheme()` aus `src/theme/ThemeContext`; `tokens` aus `src/styles/tokens`
- Produces: Route `/tagebuch/schnell`, auf die Task 4 und das Widget verweisen

**Vor der Umsetzung:** Gemäß `colitis-app/AGENTS.md` die Dokumentation zu `useFocusEffect` und `Stack.Screen` unter https://docs.expo.dev/versions/v57.0.0/ prüfen, bevor der Bildschirm geschrieben wird.

Die exakten deutschen Texte auf diesem Bildschirm:

| Stelle | Text |
|---|---|
| Bildschirmtitel | `Schnell-Eintrag` |
| Zähler beim Laden | `wird geladen …` |
| Zähler ohne heutigen Eintrag | `Heute noch nichts erfasst` |
| Zähler mit heutigem Eintrag | `Heute: {Anzahl} erfasst` |
| Blut-Schalter | `mit Blut` |
| Hinweis statt Schalter | `Für heute ist Blut vermerkt` |
| Über den Knöpfen | `Konsistenz wählen — das speichert:` |
| Link nach unten | `Ausführlichen Eintrag anlegen →` |
| Fehler beim Laden | `Heutiger Stand konnte nicht geladen werden.` |
| Fehler beim Speichern | `Eintrag konnte nicht gespeichert werden.` |

- [ ] **Step 1: Bildschirm anlegen**

Datei `colitis-app/app/(tabs)/tagebuch/schnell.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Switch, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  createDiaryEntry,
  listDiaryEntries,
  updateDiaryEntryQuickFields,
} from '../../../src/features/diary/db/diaryRepository';
import {
  findTodaysEntry,
  buildQuickEntryInput,
  buildQuickEntryUpdate,
} from '../../../src/features/diary/quickEntryLogic';
import { STOOL_CONSISTENCY_OPTIONS } from '../../../src/features/diary/constants';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { StoolConsistency } from '../../../src/features/diary/constants';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function SchnellEintragScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [todaysEntry, setTodaysEntry] = useState<DiaryEntryWithTriggers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasBlood, setHasBlood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      setHasBlood(false);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((entries) => {
          if (isActive) {
            setTodaysEntry(findTodaysEntry(entries, new Date()));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Schnell-Eintrag] Laden des heutigen Stands fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Heutiger Stand konnte nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleSelectConsistency(consistency: StoolConsistency) {
    setIsSaving(true);
    try {
      const db = await createEncryptedDb();

      if (todaysEntry === null) {
        await createDiaryEntry(
          db,
          buildQuickEntryInput(consistency, hasBlood, new Date().toISOString())
        );
      } else {
        await updateDiaryEntryQuickFields(
          db,
          todaysEntry.id,
          buildQuickEntryUpdate(todaysEntry, consistency, hasBlood)
        );
      }

      const entries = await listDiaryEntries(db);
      setTodaysEntry(findTodaysEntry(entries, new Date()));
      setHasBlood(false);
      setError(null);
    } catch (saveError: unknown) {
      console.error('[Schnell-Eintrag] Speichern fehlgeschlagen:', saveError);
      setError('Eintrag konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  }

  const countLabel = isLoading
    ? 'wird geladen …'
    : todaysEntry === null
    ? 'Heute noch nichts erfasst'
    : `Heute: ${todaysEntry.stoolFrequency} erfasst`;

  const isBloodAlreadyRecorded = todaysEntry !== null && todaysEntry.hasBlood;
  const areButtonsDisabled = isLoading || isSaving;

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.countText}>{countLabel}</Text>

      {isBloodAlreadyRecorded ? (
        <Text style={styles.bloodNote}>Für heute ist Blut vermerkt</Text>
      ) : (
        <View style={styles.bloodRow}>
          <Text style={styles.bloodLabel}>mit Blut</Text>
          <Switch
            accessibilityLabel="Mit Blut erfassen"
            value={hasBlood}
            onValueChange={setHasBlood}
            disabled={areButtonsDisabled}
          />
        </View>
      )}

      <Text style={styles.hint}>Konsistenz wählen — das speichert:</Text>

      <View style={styles.consistencyRow}>
        {STOOL_CONSISTENCY_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} erfassen`}
            accessibilityState={{ disabled: areButtonsDisabled }}
            disabled={areButtonsDisabled}
            style={[
              styles.consistencyButton,
              areButtonsDisabled && styles.consistencyButtonDisabled,
            ]}
            onPress={() => void handleSelectConsistency(option.key)}
          >
            <Text style={styles.consistencyButtonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ausführlichen Eintrag anlegen"
        style={styles.fullFormLink}
        onPress={() => router.push('/tagebuch/neu')}
      >
        <Text style={styles.fullFormLinkText}>Ausführlichen Eintrag anlegen →</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: tokens.spacing.lg,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    countText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.lg,
    },
    bloodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      marginBottom: tokens.spacing.lg,
    },
    bloodLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    bloodNote: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.lg,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    consistencyRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    consistencyButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    consistencyButtonDisabled: {
      opacity: 0.5,
    },
    consistencyButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
    fullFormLink: {
      marginTop: tokens.spacing.xl,
      padding: tokens.spacing.md,
      alignItems: 'center',
    },
    fullFormLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
```

- [ ] **Step 2: Route registrieren**

In `colitis-app/app/(tabs)/tagebuch/_layout.tsx` unterhalb der Zeile für `neu` einfügen:

```tsx
      <Stack.Screen name="schnell" options={{ title: 'Schnell-Eintrag' }} />
```

Danach lautet der Block:

```tsx
      <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
      <Stack.Screen name="neu" options={{ title: 'Neuer Eintrag' }} />
      <Stack.Screen name="schnell" options={{ title: 'Schnell-Eintrag' }} />
      <Stack.Screen name="auswertung" options={{ title: 'Auswertung' }} />
```

- [ ] **Step 3: Widget-Ziel und Beschriftung ändern**

In `colitis-app/plugins/withNewDiaryEntryWidget.js` die Konstante ändern:

```javascript
const DEEP_LINK_URL = 'colitisapp://tagebuch/schnell';
```

Und im Block, der `widget_strings.xml` schreibt, beide Zeichenketten ersetzen:

```javascript
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="widget_new_diary_entry_label">Schnell-Eintrag</string>
  <string name="widget_new_diary_entry_description">Schnell-Eintrag</string>
</resources>
`,
```

Die Ressourcennamen `widget_new_diary_entry_label` und `widget_new_diary_entry_description` bleiben unverändert — sie werden im Manifest und im Layout referenziert. Nur die angezeigten Werte ändern sich.

- [ ] **Step 4: Typprüfung**

Ausführen: `npx.cmd tsc --noEmit --pretty false`

Erwartet: Keine Ausgabe, Rückgabewert 0.

- [ ] **Step 5: Gesamte Testsuite laufen lassen**

Ausführen: `npx.cmd vitest run`

Erwartet: BESTANDEN — alle Testdateien. Dieser Schritt weist nach, dass der neue Bildschirm nichts Bestehendes bricht.

- [ ] **Step 6: Committen**

```bash
git add colitis-app/app/\(tabs\)/tagebuch/schnell.tsx colitis-app/app/\(tabs\)/tagebuch/_layout.tsx colitis-app/plugins/withNewDiaryEntryWidget.js
git commit -m "feat: Schnell-Eintrag-Bildschirm mit Route und Widget-Ziel ergaenzen"
```

---

### Task 4: Tagebuch-Tab aufräumen

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes aus Task 3: Route `/tagebuch/schnell`
- Consumes vorhanden: `handleExportPdf()` und `handleExportCsv()` (bereits in dieser Datei definiert), Zustandsvariablen `entries` und `isExporting`
- Produces: nichts, worauf spätere Aufgaben zugreifen — dies ist die letzte Aufgabe

**Vor der Umsetzung:** Gemäß `colitis-app/AGENTS.md` prüfen, ob das Setzen von `headerRight` über ein innerhalb der Bildschirmkomponente gerendertes `<Stack.Screen options={{ … }} />` in SDK 57 unterstützt wird — siehe https://docs.expo.dev/versions/v57.0.0/. Genau dieser Weg ist nötig, damit der Kopfzeilen-Knopf auf `entries` und `isExporting` zugreifen kann, ohne diesen Zustand in `_layout.tsx` zu heben.

Die exakten deutschen Texte:

| Stelle | Text |
|---|---|
| Dialogtitel | `Tagebuch exportieren` |
| Erster Knopf | `Als PDF exportieren` |
| Zweiter Knopf | `Als CSV exportieren` |
| Dritter Knopf | `Abbrechen` (mit `style: 'cancel'`) |
| Meldung ohne Einträge | `Noch keine Einträge zum Exportieren.` |
| Linker Chip | `Auswertung` (Screenreader: `Muster-Auswertung ansehen`) |
| Rechter Chip | `Arztbesuche` (Screenreader: `Arztbesuche verwalten`) |
| Kopfzeilen-Knopf | Screenreader: `Export-Menü öffnen` |

- [ ] **Step 1: Importe erweitern**

In `colitis-app/app/(tabs)/tagebuch/index.tsx` die beiden Import-Zeilen ersetzen:

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
```

wird zu:

```tsx
import { Stack, useFocusEffect, useRouter } from 'expo-router';
```

und darunter ergänzen:

```tsx
import { Ionicons } from '@expo/vector-icons';
```

- [ ] **Step 2: Menü-Funktion ergänzen**

Direkt unterhalb der vorhandenen Funktion `handleExportCsv` einfügen:

```tsx
  function handleOpenExportMenu() {
    if (entries.length === 0) {
      Alert.alert('Tagebuch exportieren', 'Noch keine Einträge zum Exportieren.', [
        { text: 'Abbrechen', style: 'cancel' },
      ]);
      return;
    }

    Alert.alert('Tagebuch exportieren', undefined, [
      { text: 'Als PDF exportieren', onPress: () => void handleExportPdf() },
      { text: 'Als CSV exportieren', onPress: () => void handleExportCsv() },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }
```

`Alert` ist in dieser Datei bereits importiert.

- [ ] **Step 3: Kopfzeilen-Menü und Chip-Zeile einsetzen, Export-Knöpfe entfernen**

Im zurückgegebenen JSX: Direkt nach dem öffnenden `<View style={styles.container}>` einfügen:

```tsx
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export-Menü öffnen"
              accessibilityState={{ disabled: isExporting }}
              disabled={isExporting}
              style={[styles.headerButton, isExporting && styles.headerButtonDisabled]}
              onPress={handleOpenExportMenu}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.textPrimary} />
            </Pressable>
          ),
        }}
      />
```

Die beiden `Pressable`-Blöcke mit `styles.analysisLink` (Muster-Auswertung und Arztbesuche) durch diese eine Zeile ersetzen:

```tsx
      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Muster-Auswertung ansehen"
          style={styles.chip}
          onPress={() => router.push('/tagebuch/auswertung')}
        >
          <Text style={styles.chipText}>Auswertung</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Arztbesuche verwalten"
          style={styles.chip}
          onPress={() => router.push('/tagebuch/arztbesuche')}
        >
          <Text style={styles.chipText}>Arztbesuche</Text>
        </Pressable>
      </View>
```

Die beiden `Pressable`-Blöcke mit `styles.exportLink` (PDF und CSV) **ersatzlos löschen**.

Beim „+"-Knopf das Ziel ändern:

```tsx
        onPress={() => router.push('/tagebuch/schnell')}
```

- [ ] **Step 4: Stile anpassen**

In `makeStyles` die vier nicht mehr verwendeten Einträge `analysisLink`, `analysisLinkText`, `exportLink`, `exportLinkDisabled` und `exportLinkText` **löschen** und stattdessen ergänzen:

```tsx
    chipRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.pill,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    chipText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    headerButton: {
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: tokens.spacing.xs,
    },
    headerButtonDisabled: {
      opacity: 0.5,
    },
```

- [ ] **Step 5: Typprüfung**

Ausführen: `npx.cmd tsc --noEmit --pretty false`

Erwartet: Keine Ausgabe, Rückgabewert 0. Sollte hier ein Fehler wegen eines nicht mehr existierenden Stils auftreten, ist im JSX noch eine Verwendung von `styles.analysisLink`, `styles.exportLink` oder `styles.exportLinkText` übrig geblieben.

- [ ] **Step 6: Gesamte Testsuite laufen lassen**

Ausführen: `npx.cmd vitest run`

Erwartet: BESTANDEN — alle Testdateien.

- [ ] **Step 7: Committen**

```bash
git add colitis-app/app/\(tabs\)/tagebuch/index.tsx
git commit -m "feat: Tagebuch-Tab aufraeumen und Plus-Knopf auf Schnell-Eintrag umlegen"
```

---

## Manuelle Abnahme nach allen Aufgaben

Diese Punkte sind nicht automatisiert prüfbar, weil native Module im Testlauf nicht nachgebildet sind. Sie gehören in einen Gerätetest nach dem nächsten Build:

1. Tagebuch-Tab zeigt nur noch zwei Zeilen über der Liste; das Menü-Symbol steht rechts oben in der Kopfzeile
2. Menü ohne Einträge zeigt „Noch keine Einträge zum Exportieren."; mit Einträgen erzeugen PDF und CSV wie bisher
3. Beide Chips führen auf ihre jeweilige Unterseite
4. „+" öffnet den Schnell-Eintrag
5. Erster Tipp am Tag: Zähler springt von „Heute noch nichts erfasst" auf „Heute: 1 erfasst", die Liste zeigt den neuen Eintrag
6. Zweiter Tipp mit schlechterer Konsistenz: Häufigkeit 2, schlechtere Konsistenz übernommen
7. Zweiter Tipp mit besserer Konsistenz: die schlechtere Konsistenz bleibt stehen
8. Mit gesetztem Blut-Schalter erfassen: Eintrag wird als schlecht bewertet; beim erneuten Öffnen ist der Schalter verschwunden und der Hinweis steht an seiner Stelle
9. „Ausführlichen Eintrag anlegen" öffnet das gewohnte Formular
10. Widget öffnet den Schnell-Eintrag

Punkt 10 wirkt erst mit einem neuen Build, da es sich um eine native Änderung handelt. Das EAS-Build-Kontingent des kostenlosen Tarifs ist für Juli aufgebraucht und setzt sich am 01.08.2026 zurück.
