# Tagebuch-Kern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umsetzungsschritt 2 aus dem Design-Spec: ein funktionierender Tagebuch-Eingabe-Screen, lokale (verschlüsselte) Speicherung der Einträge, und eine Verlaufsansicht — alles über die bestehende `diary_entries`/`triggers`-Schema und den bestehenden `createEncryptedDb()`-Client.

**Architecture:** Reine Domain-Logik (Typen, Konstanten, Formular-Validierung/-Aufbau) wird als testbare, framework-freie TypeScript-Module implementiert. Die DB-Zugriffsschicht (`diaryRepository.ts`) kapselt alle Drizzle-Queries hinter zwei Funktionen (`createDiaryEntry`, `listDiaryEntries`) und wird gegen eine In-Memory-`better-sqlite3`-DB getestet (echtes SQL, gleiche Drizzle-Schema-Definition wie in Produktion — `expo-sqlite` selbst kann nicht in Node/Vitest laufen). Die UI-Komponenten (`NumberStepper`, `DiaryEntryForm`, `DiaryHistoryList`) sind reine Präsentationskomponenten (Container/Presentational-Split), die von den Expo-Router-Routen (`app/(tabs)/tagebuch/*.tsx`) verdrahtet werden; die Routen übernehmen DB-Zugriff und Fehlerbehandlung.

**Tech Stack:** React Native (Expo SDK 57, TypeScript), Expo Router, Drizzle ORM, expo-sqlite (Produktion) / better-sqlite3 (Tests), Vitest.

## Global Constraints

- UI-Sprache: Deutsch — alle Labels, Buttons, Platzhalter und Fehlermeldungen.
- Design-Ton: ruhig, warm, beruhigend, wenig Alarmfarben. Ausschließlich Farben/Abstände/Typografie aus `src/styles/tokens.ts` verwenden (`tokens.colors`, `tokens.spacing`, `tokens.typography`) — keine Hex-Werte inline. `tokens.colors.danger` darf ausschließlich für den "Blut: Ja"-Zustand und Fehlermeldungen verwendet werden, nicht großflächig.
- Datenmodell (`src/db/schema.ts`, Tabellen `diaryEntries` und `triggers`) ist bereits fertig aus Umsetzungsschritt 1 — NICHT verändern.
- Datenzugriff ausschließlich über `createEncryptedDb()` aus `src/db/client.ts` (bereits vorhandener, gecachter Singleton). Niemals `openDatabaseSync` direkt aufrufen.
- Container/Presentational-Trennung: `src/features/diary/components/*` bekommen keinen direkten DB-Zugriff — nur die Routen-Dateien (`app/(tabs)/tagebuch/*.tsx`) rufen `diaryRepository`-Funktionen auf.
- Fehlerbehandlung (Spec §6): DB-Fehler beim Speichern/Laden → verständliche deutsche Fehlermeldung im UI anzeigen, zusätzlich `console.error` mit Kontext loggen, kein stiller Datenverlust.
- Testing: Vitest (nicht Jest). DB-Repository-Tests laufen gegen eine In-Memory-`better-sqlite3`-DB unter Verwendung derselben Drizzle-Schema-Definitionen und der generierten Migrations-SQL (`drizzle/0000_remarkable_junta.sql`) — `expo-sqlite` selbst ist in Node/Vitest nicht lauffähig.
- **Bestätigte Abweichung von Spec §7 ("Komponenten-/Screen-Tests ... React Native Testing Library"):** Ein Test in dieser Session hat gezeigt, dass `react-native` Flow-Syntax verwendet, die der aktuelle Vitest-Transform (Rolldown/Vite) nicht parsen kann (`Parse failure: Flow is not supported`, `node_modules/react-native/index.js:1:0`). Automatisiertes Rendern von RN-Komponenten unter Vitest würde eine eigene Babel/Flow-Transform-Infrastruktur erfordern — das ist außerhalb des Umfangs dieses Plans. Stattdessen wird die gesamte Formular- und Anzeige-Logik (Validierung, Input-Aufbau, Label-Auflösung) in reine, framework-freie Funktionen ausgelagert und dort vollständig mit Vitest getestet (Task 3). Die UI-Bindung selbst (JSX/State-Wiring) wird nur durch `tsc --noEmit` verifiziert; die visuelle/interaktive Prüfung erfolgt beim manuellen Alltagstest (Umsetzungsschritt 8, wie bereits für PIN/Biometrie/Standort in Umsetzungsschritt 1 vorgemerkt).
- AGENTS.md-Hinweis für dieses Projekt: Vor jeder Implementierung, die Expo-APIs nutzt, exakte versionierte Doku unter https://docs.expo.dev/versions/v57.0.0/ prüfen. Falls sich Tool-Verhalten seit Planerstellung geändert hat (wie bei Task 1–5 aus Umsetzungsschritt 1), transparent recherchieren, anpassen und im Report dokumentieren statt die Aufgabe stumpf nach Plantext abzuarbeiten.
- Symptome werden als kommagetrennter String in der bestehenden `symptoms`-Spalte gespeichert; pro Tagebuch-Eintrag können mehrere `triggers`-Zeilen (eine pro gewählter Kategorie) existieren.

---

### Task 1: Diary-Domain — Typen & Konstanten

**Files:**
- Create: `src/features/diary/constants.ts`
- Create: `src/features/diary/types.ts`
- Test: `src/features/diary/constants.test.ts`

**Interfaces:**
- Produces: `SelectOption<T>`, `StoolConsistency`, `TriggerCategory`, `SymptomKey` (Typen + `STOOL_CONSISTENCY_OPTIONS`, `TRIGGER_CATEGORY_OPTIONS`, `SYMPTOM_OPTIONS` Arrays) aus `constants.ts`; `NewDiaryEntryInput`, `DiaryEntryWithTriggers` aus `types.ts`. Task 2–5 importieren diese Namen exakt so.

- [ ] **Step 1: Schreibe den fehlschlagenden Test**

`src/features/diary/constants.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS } from './constants';

describe('diary constants', () => {
  it('has no duplicate symptom keys', () => {
    const keys = SYMPTOM_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate stool consistency keys', () => {
    const keys = STOOL_CONSISTENCY_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('trigger category keys match the diary_entries schema enum exactly', () => {
    const keys = TRIGGER_CATEGORY_OPTIONS.map((option) => option.key).sort();
    expect(keys).toEqual(['ernaehrung', 'medikament', 'schlaf', 'sonstiges', 'stress'].sort());
  });

  it('every option has a non-empty German label', () => {
    const allOptions = [...SYMPTOM_OPTIONS, ...STOOL_CONSISTENCY_OPTIONS, ...TRIGGER_CATEGORY_OPTIONS];
    for (const option of allOptions) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Führe den Test aus, um das Fehlschlagen zu bestätigen**

Run: `npx vitest run src/features/diary/constants.test.ts`
Expected: FAIL — `constants.ts` existiert noch nicht (Modul nicht gefunden).

- [ ] **Step 3: Implementiere `constants.ts`**

`src/features/diary/constants.ts`:
```typescript
export interface SelectOption<T extends string> {
  key: T;
  label: string;
}

export type StoolConsistency = 'hart' | 'normal' | 'weich' | 'waessrig';

export const STOOL_CONSISTENCY_OPTIONS: SelectOption<StoolConsistency>[] = [
  { key: 'hart', label: 'Hart' },
  { key: 'normal', label: 'Normal' },
  { key: 'weich', label: 'Weich' },
  { key: 'waessrig', label: 'Wässrig' },
];

export type TriggerCategory = 'ernaehrung' | 'stress' | 'schlaf' | 'medikament' | 'sonstiges';

export const TRIGGER_CATEGORY_OPTIONS: SelectOption<TriggerCategory>[] = [
  { key: 'ernaehrung', label: 'Ernährung' },
  { key: 'stress', label: 'Stress' },
  { key: 'schlaf', label: 'Schlaf' },
  { key: 'medikament', label: 'Medikament' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

export type SymptomKey =
  | 'bauchschmerzen'
  | 'kraempfe'
  | 'muedigkeit'
  | 'fieber'
  | 'gelenkschmerzen'
  | 'dringlichkeit'
  | 'appetitlosigkeit'
  | 'gewichtsverlust';

export const SYMPTOM_OPTIONS: SelectOption<SymptomKey>[] = [
  { key: 'bauchschmerzen', label: 'Bauchschmerzen' },
  { key: 'kraempfe', label: 'Krämpfe' },
  { key: 'muedigkeit', label: 'Müdigkeit' },
  { key: 'fieber', label: 'Fieber' },
  { key: 'gelenkschmerzen', label: 'Gelenkschmerzen' },
  { key: 'dringlichkeit', label: 'Stuhldrang' },
  { key: 'appetitlosigkeit', label: 'Appetitlosigkeit' },
  { key: 'gewichtsverlust', label: 'Gewichtsverlust' },
];
```

- [ ] **Step 4: Führe den Test erneut aus, um GREEN zu bestätigen**

Run: `npx vitest run src/features/diary/constants.test.ts`
Expected: PASS (4/4 Tests)

- [ ] **Step 5: Implementiere `types.ts`**

`src/features/diary/types.ts`:
```typescript
import type { StoolConsistency, TriggerCategory } from './constants';

export interface NewDiaryEntryInput {
  occurredAt: string;
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency;
  painLevel: number;
  symptoms: string[];
  note: string | null;
  triggerCategories: TriggerCategory[];
}

export interface DiaryEntryWithTriggers {
  id: number;
  occurredAt: string;
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: string;
  painLevel: number;
  symptoms: string[];
  note: string | null;
  triggerCategories: string[];
}
```

`types.ts` hat keine eigene Laufzeit-Logik (nur Typ-Deklarationen) und braucht daher keinen separaten Test — es wird durch die Nutzung in Task 2's Tests indirekt abgedeckt.

- [ ] **Step 6: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/features/diary/constants.ts src/features/diary/constants.test.ts src/features/diary/types.ts
git commit -m "feat: Tagebuch-Domain-Typen und Konstanten"
```

---

### Task 2: Diary-Repository (DB-Zugriff)

**Files:**
- Create: `src/features/diary/db/diaryRepository.ts`
- Test: `src/features/diary/db/diaryRepository.test.ts`
- Modify: `package.json` (devDependencies: `better-sqlite3`, `@types/better-sqlite3`)

**Interfaces:**
- Consumes: `NewDiaryEntryInput`, `DiaryEntryWithTriggers` (Task 1); `diaryEntries`, `triggers` aus `src/db/schema.ts` (bereits vorhanden).
- Produces: `createDiaryEntry(db, input: NewDiaryEntryInput): Promise<number>`, `listDiaryEntries(db): Promise<DiaryEntryWithTriggers[]>`, `type DiaryDb`. Task 5 (Routen) ruft diese Funktionen exakt so mit dem Ergebnis von `createEncryptedDb()` auf.

- [ ] **Step 1: Installiere die Test-Abhängigkeit**

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

Falls sich Peer-Dependency-Konflikte mit der installierten `drizzle-orm`-Version zeigen, recherchiere die kompatible `better-sqlite3`-Version und dokumentiere die gewählte Version im Report.

- [ ] **Step 2: Schreibe den fehlschlagenden Test**

`src/features/diary/db/diaryRepository.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../../db/schema';
import { createDiaryEntry, listDiaryEntries } from './diaryRepository';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const migrationSql = readFileSync(
    join(__dirname, '../../../../drizzle/0000_remarkable_junta.sql'),
    'utf-8'
  );
  for (const statement of migrationSql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      sqlite.exec(trimmed);
    }
  }
  return drizzle(sqlite, { schema });
}

describe('diary repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a diary entry and returns its id', async () => {
    const id = await createDiaryEntry(db, {
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 3,
      hasBlood: false,
      stoolConsistency: 'weich',
      painLevel: 4,
      symptoms: ['bauchschmerzen', 'muedigkeit'],
      note: 'Nach dem Frühstück',
      triggerCategories: ['stress'],
    });

    expect(id).toBeGreaterThan(0);
  });

  it('lists created entries newest first, with their triggers', async () => {
    await createDiaryEntry(db, {
      occurredAt: '2026-07-06T08:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 1,
      symptoms: [],
      note: null,
      triggerCategories: [],
    });
    await createDiaryEntry(db, {
      occurredAt: '2026-07-08T08:00:00.000Z',
      stoolFrequency: 5,
      hasBlood: true,
      stoolConsistency: 'waessrig',
      painLevel: 8,
      symptoms: ['fieber'],
      note: null,
      triggerCategories: ['ernaehrung', 'stress'],
    });

    const entries = await listDiaryEntries(db);

    expect(entries).toHaveLength(2);
    expect(entries[0].occurredAt).toBe('2026-07-08T08:00:00.000Z');
    expect(entries[0].triggerCategories.slice().sort()).toEqual(['ernaehrung', 'stress'].sort());
    expect(entries[1].occurredAt).toBe('2026-07-06T08:00:00.000Z');
  });

  it('round-trips symptoms as an array', async () => {
    await createDiaryEntry(db, {
      occurredAt: '2026-07-08T09:00:00.000Z',
      stoolFrequency: 2,
      hasBlood: false,
      stoolConsistency: 'hart',
      painLevel: 2,
      symptoms: ['kraempfe', 'gelenkschmerzen'],
      note: null,
      triggerCategories: [],
    });

    const [entry] = await listDiaryEntries(db);
    expect(entry.symptoms).toEqual(['kraempfe', 'gelenkschmerzen']);
  });
});
```

- [ ] **Step 3: Führe den Test aus, um das Fehlschlagen zu bestätigen**

Run: `npx vitest run src/features/diary/db/diaryRepository.test.ts`
Expected: FAIL — `diaryRepository.ts` existiert noch nicht.

- [ ] **Step 4: Implementiere `diaryRepository.ts`**

`src/features/diary/db/diaryRepository.ts`:
```typescript
import { desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { diaryEntries, triggers } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { NewDiaryEntryInput, DiaryEntryWithTriggers } from '../types';

export type DiaryDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createDiaryEntry(db: DiaryDb, input: NewDiaryEntryInput): Promise<number> {
  const [inserted] = await db
    .insert(diaryEntries)
    .values({
      occurredAt: input.occurredAt,
      stoolFrequency: input.stoolFrequency,
      hasBlood: input.hasBlood,
      stoolConsistency: input.stoolConsistency,
      painLevel: input.painLevel,
      symptoms: input.symptoms.join(','),
      note: input.note,
    })
    .returning({ id: diaryEntries.id });

  const entryId = inserted.id;

  for (const triggerCategory of input.triggerCategories) {
    await db.insert(triggers).values({
      diaryEntryId: entryId,
      category: triggerCategory,
      note: null,
    });
  }

  return entryId;
}

export async function listDiaryEntries(db: DiaryDb): Promise<DiaryEntryWithTriggers[]> {
  const entries = await db.select().from(diaryEntries).orderBy(desc(diaryEntries.occurredAt));

  const result: DiaryEntryWithTriggers[] = [];
  for (const entry of entries) {
    const entryTriggers = await db.select().from(triggers).where(eq(triggers.diaryEntryId, entry.id));

    result.push({
      id: entry.id,
      occurredAt: entry.occurredAt,
      stoolFrequency: entry.stoolFrequency,
      hasBlood: entry.hasBlood,
      stoolConsistency: entry.stoolConsistency,
      painLevel: entry.painLevel,
      symptoms: entry.symptoms.length > 0 ? entry.symptoms.split(',') : [],
      note: entry.note,
      triggerCategories: entryTriggers.map((trigger) => trigger.category),
    });
  }

  return result;
}
```

Falls `tsc` einen Typkonflikt zwischen `BaseSQLiteDatabase<'sync', ...>` (Produktions-Treiber `ExpoSQLiteDatabase`, Test-Treiber `BetterSQLite3Database`) meldet: beide Klassen erweitern exakt `BaseSQLiteDatabase<'sync', TRunResult, TSchema>` mit unterschiedlichem `TRunResult` — der `any` in `DiaryDb` deckt das ab. Falls dennoch ein Konflikt auftritt, recherchiere die exakte Typsignatur in `node_modules/drizzle-orm/*/driver.d.ts` und passe `DiaryDb` an; dokumentiere die Anpassung im Report.

- [ ] **Step 5: Führe den Test erneut aus, um GREEN zu bestätigen**

Run: `npx vitest run src/features/diary/db/diaryRepository.test.ts`
Expected: PASS (3/3 Tests)

- [ ] **Step 6: Typprüfung und vollständige Test-Suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: keine Typfehler, alle Tests (alt + neu) grün.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/diary/db/diaryRepository.ts src/features/diary/db/diaryRepository.test.ts
git commit -m "feat: Tagebuch-Repository für Anlegen und Auflisten von Einträgen"
```

---

### Task 3: Formular-Logik (reine Funktionen)

**Files:**
- Create: `src/features/diary/formLogic.ts`
- Test: `src/features/diary/formLogic.test.ts`

**Interfaces:**
- Consumes: `StoolConsistency`, `TriggerCategory`, `SymptomKey` (Task 1 `constants.ts`); `NewDiaryEntryInput` (Task 1 `types.ts`).
- Produces: `DiaryEntryFormState`, `INITIAL_DIARY_ENTRY_FORM_STATE`, `validateDiaryEntryForm(state): string[]`, `buildDiaryEntryInput(state, occurredAt): NewDiaryEntryInput`, `toggleListValue<T>(list, value): T[]`. Task 4 (UI-Komponenten) verwendet diese Namen exakt so.

- [ ] **Step 1: Schreibe die fehlschlagenden Tests**

`src/features/diary/formLogic.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  validateDiaryEntryForm,
} from './formLogic';

describe('validateDiaryEntryForm', () => {
  it('requires a stool consistency to be selected', () => {
    const errors = validateDiaryEntryForm(INITIAL_DIARY_ENTRY_FORM_STATE);
    expect(errors).toContain('Bitte eine Stuhlgang-Konsistenz auswählen.');
  });

  it('returns no errors for a valid state', () => {
    const errors = validateDiaryEntryForm({
      ...INITIAL_DIARY_ENTRY_FORM_STATE,
      stoolConsistency: 'normal',
    });
    expect(errors).toEqual([]);
  });

  it('flags a pain level outside 0-10', () => {
    const errors = validateDiaryEntryForm({
      ...INITIAL_DIARY_ENTRY_FORM_STATE,
      stoolConsistency: 'normal',
      painLevel: 11,
    });
    expect(errors).toContain('Das Schmerzlevel muss zwischen 0 und 10 liegen.');
  });
});

describe('buildDiaryEntryInput', () => {
  it('throws when stool consistency is missing', () => {
    expect(() => buildDiaryEntryInput(INITIAL_DIARY_ENTRY_FORM_STATE, '2026-07-08T10:00:00.000Z')).toThrow();
  });

  it('trims whitespace-only notes to null', () => {
    const input = buildDiaryEntryInput(
      { ...INITIAL_DIARY_ENTRY_FORM_STATE, stoolConsistency: 'normal', note: '   ' },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.note).toBeNull();
  });

  it('carries all fields through unchanged', () => {
    const input = buildDiaryEntryInput(
      {
        stoolFrequency: 4,
        hasBlood: true,
        stoolConsistency: 'waessrig',
        painLevel: 7,
        symptoms: ['fieber'],
        note: '  Starke Schmerzen nach dem Essen  ',
        triggerCategories: ['ernaehrung'],
      },
      '2026-07-08T10:00:00.000Z'
    );

    expect(input).toEqual({
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 4,
      hasBlood: true,
      stoolConsistency: 'waessrig',
      painLevel: 7,
      symptoms: ['fieber'],
      note: 'Starke Schmerzen nach dem Essen',
      triggerCategories: ['ernaehrung'],
    });
  });
});

describe('toggleListValue', () => {
  it('adds a value that is not yet in the list', () => {
    expect(toggleListValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a value that is already in the list', () => {
    expect(toggleListValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('does not mutate the original list', () => {
    const original = ['a'];
    toggleListValue(original, 'b');
    expect(original).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Führe die Tests aus, um das Fehlschlagen zu bestätigen**

Run: `npx vitest run src/features/diary/formLogic.test.ts`
Expected: FAIL — `formLogic.ts` existiert noch nicht.

- [ ] **Step 3: Implementiere `formLogic.ts`**

`src/features/diary/formLogic.ts`:
```typescript
import type { StoolConsistency, SymptomKey, TriggerCategory } from './constants';
import type { NewDiaryEntryInput } from './types';

export interface DiaryEntryFormState {
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency | null;
  painLevel: number;
  symptoms: SymptomKey[];
  note: string;
  triggerCategories: TriggerCategory[];
}

export const INITIAL_DIARY_ENTRY_FORM_STATE: DiaryEntryFormState = {
  stoolFrequency: 0,
  hasBlood: false,
  stoolConsistency: null,
  painLevel: 0,
  symptoms: [],
  note: '',
  triggerCategories: [],
};

export function validateDiaryEntryForm(state: DiaryEntryFormState): string[] {
  const errors: string[] = [];

  if (state.stoolConsistency === null) {
    errors.push('Bitte eine Stuhlgang-Konsistenz auswählen.');
  }
  if (state.stoolFrequency < 0) {
    errors.push('Die Häufigkeit darf nicht negativ sein.');
  }
  if (state.painLevel < 0 || state.painLevel > 10) {
    errors.push('Das Schmerzlevel muss zwischen 0 und 10 liegen.');
  }

  return errors;
}

export function buildDiaryEntryInput(state: DiaryEntryFormState, occurredAt: string): NewDiaryEntryInput {
  if (state.stoolConsistency === null) {
    throw new Error('Formular ist nicht gültig: Stuhlgang-Konsistenz fehlt.');
  }

  const trimmedNote = state.note.trim();

  return {
    occurredAt,
    stoolFrequency: state.stoolFrequency,
    hasBlood: state.hasBlood,
    stoolConsistency: state.stoolConsistency,
    painLevel: state.painLevel,
    symptoms: state.symptoms,
    note: trimmedNote.length > 0 ? trimmedNote : null,
    triggerCategories: state.triggerCategories,
  };
}

export function toggleListValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
```

- [ ] **Step 4: Führe die Tests erneut aus, um GREEN zu bestätigen**

Run: `npx vitest run src/features/diary/formLogic.test.ts`
Expected: PASS (8/8 Tests)

- [ ] **Step 5: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/features/diary/formLogic.ts src/features/diary/formLogic.test.ts
git commit -m "feat: reine Formular-Logik für Tagebuch-Eintrag (Validierung, Aufbau, Toggle)"
```

---

### Task 4: UI-Komponenten (NumberStepper, DiaryEntryForm, DiaryHistoryList)

**Files:**
- Create: `src/components/ui/NumberStepper.tsx`
- Create: `src/features/diary/components/DiaryEntryForm.tsx`
- Create: `src/features/diary/components/DiaryHistoryList.tsx`

**Interfaces:**
- Consumes: `tokens` (`src/styles/tokens.ts`); `SYMPTOM_OPTIONS`, `STOOL_CONSISTENCY_OPTIONS`, `TRIGGER_CATEGORY_OPTIONS`, `StoolConsistency`, `SymptomKey`, `TriggerCategory` (Task 1); `INITIAL_DIARY_ENTRY_FORM_STATE`, `DiaryEntryFormState`, `validateDiaryEntryForm`, `buildDiaryEntryInput`, `toggleListValue` (Task 3); `NewDiaryEntryInput`, `DiaryEntryWithTriggers` (Task 1).
- Produces: `NumberStepper` (Props: `label: string; value: number; onChange: (next: number) => void; min?: number; max?: number;`), `DiaryEntryForm` (Props: `onSubmit: (input: NewDiaryEntryInput) => void;`), `DiaryHistoryList` (Props: `entries: DiaryEntryWithTriggers[];`). Task 5 (Routen) importiert und verwendet diese drei Komponenten mit exakt diesen Props.

Diese Aufgabe hat wie in den Global Constraints dokumentiert **keinen automatisierten Render-Test** (Vitest kann `react-native`-Komponenten wegen Flow-Syntax nicht importieren). Verifiziere stattdessen ausschließlich über `tsc --noEmit` nach jedem Schritt.

- [ ] **Step 1: Implementiere `NumberStepper.tsx`**

`src/components/ui/NumberStepper.tsx`:
```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../styles/tokens';

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

export function NumberStepper({ label, value, onChange, min = 0, max = 20 }: NumberStepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} verringern`}
          disabled={!canDecrement}
          onPress={() => onChange(value - 1)}
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} erhöhen`}
          disabled={!canIncrement}
          onPress={() => onChange(value + 1)}
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.md,
  },
  label: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    marginBottom: tokens.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: tokens.colors.border,
  },
  buttonText: {
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.textPrimary,
  },
  value: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.textPrimary,
    marginHorizontal: tokens.spacing.sm,
  },
});
```

- [ ] **Step 2: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/NumberStepper.tsx
git commit -m "feat: wiederverwendbare NumberStepper-UI-Komponente"
```

- [ ] **Step 4: Implementiere `DiaryEntryForm.tsx`**

`src/features/diary/components/DiaryEntryForm.tsx`:
```tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { tokens } from '../../../styles/tokens';
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS } from '../constants';
import type { StoolConsistency, SymptomKey, TriggerCategory } from '../constants';
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  validateDiaryEntryForm,
  type DiaryEntryFormState,
} from '../formLogic';
import type { NewDiaryEntryInput } from '../types';

interface DiaryEntryFormProps {
  onSubmit: (input: NewDiaryEntryInput) => void;
}

export function DiaryEntryForm({ onSubmit }: DiaryEntryFormProps) {
  const [formState, setFormState] = useState<DiaryEntryFormState>(INITIAL_DIARY_ENTRY_FORM_STATE);
  const [errors, setErrors] = useState<string[]>([]);

  function handleSubmit() {
    const validationErrors = validateDiaryEntryForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onSubmit(buildDiaryEntryInput(formState, new Date().toISOString()));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <NumberStepper
        label="Stuhlgang-Häufigkeit heute"
        value={formState.stoolFrequency}
        onChange={(next) => setFormState({ ...formState, stoolFrequency: next })}
        min={0}
        max={20}
      />

      <Text style={styles.sectionLabel}>Blut im Stuhl</Text>
      <View style={styles.row}>
        {[
          { key: false, label: 'Nein' },
          { key: true, label: 'Ja' },
        ].map((option) => {
          const isSelected = formState.hasBlood === option.key;
          return (
            <Pressable
              key={String(option.key)}
              onPress={() => setFormState({ ...formState, hasBlood: option.key })}
              style={[
                styles.choiceButton,
                isSelected && (option.key ? styles.choiceButtonDanger : styles.choiceButtonActive),
              ]}
            >
              <Text style={styles.choiceButtonText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Stuhlgang-Konsistenz</Text>
      <View style={styles.row}>
        {STOOL_CONSISTENCY_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setFormState({ ...formState, stoolConsistency: option.key as StoolConsistency })}
            style={[styles.choiceButton, formState.stoolConsistency === option.key && styles.choiceButtonActive]}
          >
            <Text style={styles.choiceButtonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <NumberStepper
        label="Schmerzlevel (0-10)"
        value={formState.painLevel}
        onChange={(next) => setFormState({ ...formState, painLevel: next })}
        min={0}
        max={10}
      />

      <Text style={styles.sectionLabel}>Symptome</Text>
      <View style={styles.row}>
        {SYMPTOM_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() =>
              setFormState({
                ...formState,
                symptoms: toggleListValue(formState.symptoms, option.key as SymptomKey),
              })
            }
            style={[
              styles.choiceButton,
              formState.symptoms.includes(option.key as SymptomKey) && styles.choiceButtonActive,
            ]}
          >
            <Text style={styles.choiceButtonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Mögliche Auslöser</Text>
      <View style={styles.row}>
        {TRIGGER_CATEGORY_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() =>
              setFormState({
                ...formState,
                triggerCategories: toggleListValue(formState.triggerCategories, option.key as TriggerCategory),
              })
            }
            style={[
              styles.choiceButton,
              formState.triggerCategories.includes(option.key as TriggerCategory) && styles.choiceButtonActive,
            ]}
          >
            <Text style={styles.choiceButtonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Notiz</Text>
      <TextInput
        style={styles.noteInput}
        multiline
        placeholder="Zusätzliche Beobachtungen …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.note}
        onChangeText={(text) => setFormState({ ...formState, note: text })}
      />

      {errors.length > 0 && (
        <View style={styles.errorBox}>
          {errors.map((error) => (
            <Text key={error} style={styles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Eintrag speichern</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  sectionLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  choiceButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  choiceButtonActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  choiceButtonDanger: {
    backgroundColor: tokens.colors.danger,
    borderColor: tokens.colors.danger,
  },
  choiceButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
  },
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    textAlignVertical: 'top',
    marginBottom: tokens.spacing.lg,
  },
  errorBox: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
  },
  submitButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 5: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/features/diary/components/DiaryEntryForm.tsx
git commit -m "feat: DiaryEntryForm-Eingabekomponente fuer Tagebuch-Eintraege"
```

- [ ] **Step 7: Implementiere `DiaryHistoryList.tsx`**

`src/features/diary/components/DiaryHistoryList.tsx`:
```tsx
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS } from '../constants';
import type { SelectOption } from '../constants';
import type { DiaryEntryWithTriggers } from '../types';

interface DiaryHistoryListProps {
  entries: DiaryEntryWithTriggers[];
}

function labelFor(options: SelectOption<string>[], key: string): string {
  return options.find((option) => option.key === key)?.label ?? key;
}

function formatOccurredAt(occurredAt: string): string {
  return new Date(occurredAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DiaryHistoryList({ entries }: DiaryHistoryListProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Noch keine Einträge. Tippe auf „+“, um deinen ersten Eintrag anzulegen.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={entries}
      keyExtractor={(entry) => String(entry.id)}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardDate}>{formatOccurredAt(item.occurredAt)}</Text>
          <Text style={styles.cardDetail}>
            Stuhlgang: {item.stoolFrequency}× · {labelFor(STOOL_CONSISTENCY_OPTIONS, item.stoolConsistency)}
          </Text>
          <Text style={styles.cardDetail}>Schmerzlevel: {item.painLevel}/10</Text>
          {item.hasBlood && <Text style={styles.cardWarning}>Blut im Stuhl</Text>}
          {item.triggerCategories.length > 0 && (
            <Text style={styles.cardDetail}>
              Auslöser: {item.triggerCategories.map((category) => labelFor(TRIGGER_CATEGORY_OPTIONS, category)).join(', ')}
            </Text>
          )}
          {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  listContent: {
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
  cardDate: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardDetail: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
  cardWarning: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
  },
  cardNote: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
    marginTop: tokens.spacing.xs,
    fontStyle: 'italic',
  },
});
```

- [ ] **Step 8: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 9: Commit**

```bash
git add src/features/diary/components/DiaryHistoryList.tsx
git commit -m "feat: DiaryHistoryList-Verlaufskomponente"
```

---

### Task 5: Routen-Wiring (Tagebuch-Tab)

**Files:**
- Modify: `app/(tabs)/tagebuch/index.tsx` (aktuell Platzhalter aus Umsetzungsschritt 1)
- Create: `app/(tabs)/tagebuch/neu.tsx`
- Create: `app/(tabs)/tagebuch/_layout.tsx`

**Interfaces:**
- Consumes: `createEncryptedDb` (`src/db/client.ts`); `createDiaryEntry`, `listDiaryEntries` (Task 2); `DiaryEntryForm`, `DiaryHistoryList` (Task 4); `NewDiaryEntryInput`, `DiaryEntryWithTriggers` (Task 1).

- [ ] **Step 1: Implementiere den Stack-Layout für den Tagebuch-Tab**

`app/(tabs)/tagebuch/_layout.tsx`:
```tsx
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
    </Stack>
  );
}
```

- [ ] **Step 2: Ersetze den Platzhalter-Screen durch die Verlaufsansicht**

`app/(tabs)/tagebuch/index.tsx`:
```tsx
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

- [ ] **Step 3: Implementiere den Eingabe-Screen**

`app/(tabs)/tagebuch/neu.tsx`:
```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { createDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { DiaryEntryForm } from '../../../src/features/diary/components/DiaryEntryForm';
import { tokens } from '../../../src/styles/tokens';
import type { NewDiaryEntryInput } from '../../../src/features/diary/types';

export default function NeuerEintragScreen() {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(input: NewDiaryEntryInput) {
    try {
      const db = await createEncryptedDb();
      await createDiaryEntry(db, input);
      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Tagebuch] Speichern des Eintrags fehlgeschlagen:', error);
      setSaveError('Eintrag konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <DiaryEntryForm onSubmit={handleSubmit} />
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

- [ ] **Step 4: Typprüfung und vollständige Test-Suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: keine Typfehler, alle bisherigen Tests weiterhin grün (Routen-Dateien selbst haben keine eigenen automatisierten Tests — siehe Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/tagebuch/index.tsx" "app/(tabs)/tagebuch/neu.tsx" "app/(tabs)/tagebuch/_layout.tsx"
git commit -m "feat: Tagebuch-Tab mit Eingabe-Screen und Verlaufsansicht verdrahten"
```

---

## Offene Punkte nach diesem Plan

- Manueller Alltagstest auf echtem Android-Gerät (Formular-Bedienung, Verlaufsanzeige, Navigation) bleibt offen — wie bereits nach Umsetzungsschritt 1 vermerkt.
- Trigger-*Musteranalyse* (z. B. Schmerzlevel-Durchschnitt an Tagen mit Trigger X) ist explizit Umsetzungsschritt 3, nicht Teil dieses Plans — hier wird nur die Erfassung pro Eintrag umgesetzt.
