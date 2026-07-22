# Ernährungs-Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bei ausgewähltem Auslöser "Ernährung" im Tagebuch-Formular optional erfassen, welches Lebensmittel gemeint war, und dieses Detail in Verlaufsliste, PDF- und CSV-Export sichtbar machen.

**Architecture:** Nutzt eine bereits vorhandene, bisher ungenutzte `note`-Spalte in der `triggers`-Tabelle — keine Schema-Änderung. Eine reine Funktion `buildTriggerLabels` wandelt Auslöser-Kategorien in Anzeige-Labels um und hängt bei "Ernährung" das Lebensmittel an; sie wird an den drei bestehenden Stellen eingesetzt, die aktuell Auslöser-Labels bauen (Verlaufsliste, PDF, CSV). Eine zweite reine Funktion `appendFoodSuggestion` verwaltet das Anhängen von Vorschlag-Chips im Formular.

**Tech Stack:** React Native (Expo SDK 57), TypeScript, Drizzle ORM, Vitest.

## Global Constraints

- Zielverzeichnis: `D:\Claude\colitis-app`
- Alle Nutzertexte auf Deutsch
- Keine Schema-Änderung — die `triggers.note`-Spalte existiert bereits in `src/db/schema.ts:22`
- Vorschlag-Chips (fest im Code): Kaffee, Milchprodukte, Gluten, Scharfes, Alkohol, Zucker
- Lebensmittel-Angabe ist optional, nie Pflichtfeld
- Tests mit `npx.cmd vitest run <pfad>` (Windows — `npx` allein schlägt fehl)
- Nach jeder Aufgabe: `npx.cmd tsc --noEmit --pretty false` ohne neue Fehler (die vorbestehende `@react-native-async-storage/async-storage`-Warnung ist bekannt und nicht Teil dieser Aufgabe)
- Kein automatisiertes Test für React-Native-UI-Komponenten in diesem Projekt (bestehendes Muster — keine `.test.tsx`-Datei existiert irgendwo im Projekt)

---

## Task 1: Reine Hilfsfunktionen — `buildTriggerLabels` und `appendFoodSuggestion`

**Files:**
- Modify: `colitis-app/src/features/diary/constants.ts`
- Modify: `colitis-app/src/features/diary/constants.test.ts`
- Modify: `colitis-app/src/features/diary/formLogic.ts`
- Modify: `colitis-app/src/features/diary/formLogic.test.ts`

**Interfaces:**
- Consumes: `TRIGGER_CATEGORY_OPTIONS`, `labelFor` (bereits vorhanden in `constants.ts`)
- Produces: `buildTriggerLabels(categories: string[], foodTriggerNote: string | null): string[]` (aus `constants.ts`), `appendFoodSuggestion(current: string, suggestion: string): string` (aus `formLogic.ts`)

- [ ] **Step 1: Fehlschlagende Tests für `buildTriggerLabels` schreiben**

Füge in `colitis-app/src/features/diary/constants.test.ts` den Import um `buildTriggerLabels` und einen neuen `describe`-Block hinzu:

```typescript
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor, buildTriggerLabels } from './constants';
```

(ersetzt die bestehende erste Import-Zeile der Datei)

Am Ende der Datei, vor der letzten schließenden `});` des äußeren `describe('diary constants', ...)`-Blocks, ergänzen:

```typescript
  describe('buildTriggerLabels', () => {
    it('returns the plain label for ernaehrung without a food note', () => {
      expect(buildTriggerLabels(['ernaehrung'], null)).toEqual(['Ernährung']);
    });

    it('appends the food note in parentheses for ernaehrung', () => {
      expect(buildTriggerLabels(['ernaehrung'], 'Kaffee')).toEqual(['Ernährung (Kaffee)']);
    });

    it('appends a multi-item food note unchanged', () => {
      expect(buildTriggerLabels(['ernaehrung'], 'Kaffee, Milchprodukte')).toEqual(['Ernährung (Kaffee, Milchprodukte)']);
    });

    it('leaves other categories unaffected by a food note', () => {
      expect(buildTriggerLabels(['stress'], 'Kaffee')).toEqual(['Stress']);
    });

    it('only appends the note to the ernaehrung entry among mixed categories, preserving order', () => {
      expect(buildTriggerLabels(['stress', 'ernaehrung', 'schlaf'], 'Kaffee')).toEqual([
        'Stress',
        'Ernährung (Kaffee)',
        'Schlaf',
      ]);
    });

    it('returns an empty array for no categories', () => {
      expect(buildTriggerLabels([], 'Kaffee')).toEqual([]);
    });
  });
```

- [ ] **Step 2: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/constants.test.ts
```
Erwartet: FAIL — `buildTriggerLabels` ist keine Funktion.

- [ ] **Step 3: `buildTriggerLabels` implementieren**

Füge in `colitis-app/src/features/diary/constants.ts` am Ende der Datei (nach der bestehenden `labelFor`-Funktion) hinzu:

```typescript
export function buildTriggerLabels(categories: string[], foodTriggerNote: string | null): string[] {
  return categories.map((category) => {
    const label = labelFor(TRIGGER_CATEGORY_OPTIONS, category);
    if (category === 'ernaehrung' && foodTriggerNote) {
      return `${label} (${foodTriggerNote})`;
    }
    return label;
  });
}
```

- [ ] **Step 4: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/constants.test.ts
```
Erwartet: PASS, alle Tests grün.

- [ ] **Step 5: Fehlschlagende Tests für `appendFoodSuggestion` schreiben**

Füge in `colitis-app/src/features/diary/formLogic.test.ts` den Import um `appendFoodSuggestion` ergänzen:

```typescript
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  validateDiaryEntryForm,
  appendFoodSuggestion,
} from './formLogic';
```

(ersetzt die bestehende Import-Zeile der Datei)

Am Ende der Datei ergänzen:

```typescript

describe('appendFoodSuggestion', () => {
  it('sets the suggestion directly when the field is empty', () => {
    expect(appendFoodSuggestion('', 'Kaffee')).toBe('Kaffee');
  });

  it('sets the suggestion directly when the field is only whitespace', () => {
    expect(appendFoodSuggestion('   ', 'Kaffee')).toBe('Kaffee');
  });

  it('appends a second suggestion with a comma', () => {
    expect(appendFoodSuggestion('Kaffee', 'Milchprodukte')).toBe('Kaffee, Milchprodukte');
  });

  it('does not add a duplicate suggestion', () => {
    expect(appendFoodSuggestion('Kaffee, Milchprodukte', 'Kaffee')).toBe('Kaffee, Milchprodukte');
  });

  it('is robust to extra whitespace around existing entries', () => {
    expect(appendFoodSuggestion('Kaffee ,  Milchprodukte', 'Milchprodukte')).toBe('Kaffee ,  Milchprodukte');
  });

  it('preserves free-text additions alongside chip suggestions', () => {
    expect(appendFoodSuggestion('Schokolade', 'Kaffee')).toBe('Schokolade, Kaffee');
  });
});
```

- [ ] **Step 6: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/formLogic.test.ts
```
Erwartet: FAIL — `appendFoodSuggestion` ist keine Funktion.

- [ ] **Step 7: `appendFoodSuggestion` implementieren**

Füge in `colitis-app/src/features/diary/formLogic.ts` am Ende der Datei (nach der bestehenden `toggleListValue`-Funktion) hinzu:

```typescript
export function appendFoodSuggestion(current: string, suggestion: string): string {
  const trimmed = current.trim();
  if (trimmed.length === 0) {
    return suggestion;
  }
  const parts = trimmed.split(',').map((part) => part.trim());
  if (parts.includes(suggestion)) {
    return trimmed;
  }
  return `${trimmed}, ${suggestion}`;
}
```

- [ ] **Step 8: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/formLogic.test.ts
```
Erwartet: PASS, alle Tests grün (bestehende + 6 neue).

- [ ] **Step 9: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/diary/constants.ts colitis-app/src/features/diary/constants.test.ts colitis-app/src/features/diary/formLogic.ts colitis-app/src/features/diary/formLogic.test.ts
git commit -m "feat: reine Hilfsfunktionen buildTriggerLabels und appendFoodSuggestion ergaenzen"
```

---

## Task 2: Datenmodell & Repository — `foodTriggerNote` speichern und lesen

**Files:**
- Modify: `colitis-app/src/features/diary/types.ts`
- Modify: `colitis-app/src/features/diary/formLogic.ts`
- Modify: `colitis-app/src/features/diary/formLogic.test.ts`
- Modify: `colitis-app/src/features/diary/db/diaryRepository.ts`
- Modify: `colitis-app/src/features/diary/db/diaryRepository.test.ts`

**Interfaces:**
- Consumes: nichts aus Task 1
- Produces: `NewDiaryEntryInput.foodTriggerNote: string | null`, `DiaryEntryWithTriggers.foodTriggerNote: string | null`, `DiaryEntryFormState.foodTriggerNote: string` — diese Feldnamen und Typen werden von Task 3 (Formular) und Task 4 (Anzeige) vorausgesetzt

- [ ] **Step 1: Typen erweitern**

Ersetze in `colitis-app/src/features/diary/types.ts` den kompletten Dateiinhalt durch:

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
  foodTriggerNote: string | null;
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
  foodTriggerNote: string | null;
}
```

- [ ] **Step 2: Fehlschlagende Tests für `buildDiaryEntryInput` mit `foodTriggerNote` schreiben**

In `colitis-app/src/features/diary/formLogic.test.ts`: ersetze den bestehenden Test `'carries all fields through unchanged'` (im `describe('buildDiaryEntryInput', ...)`-Block) durch:

```typescript
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
        foodTriggerNote: 'Kaffee',
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
      foodTriggerNote: 'Kaffee',
    });
  });

  it('includes the food trigger note when ernaehrung is selected and text is present', () => {
    const input = buildDiaryEntryInput(
      {
        ...INITIAL_DIARY_ENTRY_FORM_STATE,
        stoolConsistency: 'normal',
        triggerCategories: ['ernaehrung'],
        foodTriggerNote: '  Kaffee, Milchprodukte  ',
      },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.foodTriggerNote).toBe('Kaffee, Milchprodukte');
  });

  it('discards the food trigger note when ernaehrung is not selected', () => {
    const input = buildDiaryEntryInput(
      {
        ...INITIAL_DIARY_ENTRY_FORM_STATE,
        stoolConsistency: 'normal',
        triggerCategories: ['stress'],
        foodTriggerNote: 'Kaffee',
      },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.foodTriggerNote).toBeNull();
  });

  it('sets a null food trigger note when ernaehrung is selected but no text was entered', () => {
    const input = buildDiaryEntryInput(
      {
        ...INITIAL_DIARY_ENTRY_FORM_STATE,
        stoolConsistency: 'normal',
        triggerCategories: ['ernaehrung'],
        foodTriggerNote: '   ',
      },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.foodTriggerNote).toBeNull();
  });
```

(Der bestehende Test `'trims whitespace-only notes to null'` und der `describe('validateDiaryEntryForm', ...)`-Block bleiben unverändert — `INITIAL_DIARY_ENTRY_FORM_STATE` deckt das neue Feld automatisch mit ab, sobald Step 4 es ergänzt.)

- [ ] **Step 3: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/formLogic.test.ts
```
Erwartet: FAIL — TypeScript-Fehler oder `foodTriggerNote` fehlt in `input`.

- [ ] **Step 4: `formLogic.ts` erweitern**

Ersetze in `colitis-app/src/features/diary/formLogic.ts` das komplette Interface, die Konstante und die Funktion `buildDiaryEntryInput`:

```typescript
export interface DiaryEntryFormState {
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency | null;
  painLevel: number;
  symptoms: SymptomKey[];
  note: string;
  triggerCategories: TriggerCategory[];
  foodTriggerNote: string;
}

export const INITIAL_DIARY_ENTRY_FORM_STATE: DiaryEntryFormState = {
  stoolFrequency: 0,
  hasBlood: false,
  stoolConsistency: null,
  painLevel: 0,
  symptoms: [],
  note: '',
  triggerCategories: [],
  foodTriggerNote: '',
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
  const trimmedFoodTriggerNote = state.foodTriggerNote.trim();
  const hasFoodTrigger = state.triggerCategories.includes('ernaehrung') && trimmedFoodTriggerNote.length > 0;

  return {
    occurredAt,
    stoolFrequency: state.stoolFrequency,
    hasBlood: state.hasBlood,
    stoolConsistency: state.stoolConsistency,
    painLevel: state.painLevel,
    symptoms: state.symptoms,
    note: trimmedNote.length > 0 ? trimmedNote : null,
    triggerCategories: state.triggerCategories,
    foodTriggerNote: hasFoodTrigger ? trimmedFoodTriggerNote : null,
  };
}
```

(Die Funktionen `toggleListValue` und `appendFoodSuggestion` aus Task 1 bleiben am Ende der Datei unverändert stehen.)

- [ ] **Step 5: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/formLogic.test.ts
```
Erwartet: PASS, alle Tests grün.

- [ ] **Step 6: Fehlschlagende Tests für die Datenbank-Ebene schreiben**

Ersetze den kompletten Inhalt von `colitis-app/src/features/diary/db/diaryRepository.test.ts` durch:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../../db/schema';
import { createDiaryEntry, listDiaryEntries, deleteDiaryEntry } from './diaryRepository';
import { triggers } from '../../../db/schema';

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
      foodTriggerNote: null,
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
      foodTriggerNote: null,
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
      foodTriggerNote: null,
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
      foodTriggerNote: null,
    });

    const [entry] = await listDiaryEntries(db);
    expect(entry.symptoms).toEqual(['kraempfe', 'gelenkschmerzen']);
  });

  it('stores and retrieves a food trigger note only for the ernaehrung category', async () => {
    await createDiaryEntry(db, {
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 3,
      hasBlood: false,
      stoolConsistency: 'weich',
      painLevel: 4,
      symptoms: [],
      note: null,
      triggerCategories: ['ernaehrung', 'stress'],
      foodTriggerNote: 'Kaffee, Milchprodukte',
    });

    const [entry] = await listDiaryEntries(db);
    expect(entry.foodTriggerNote).toBe('Kaffee, Milchprodukte');
  });

  it('returns a null food trigger note when ernaehrung was not selected', async () => {
    await createDiaryEntry(db, {
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 3,
      hasBlood: false,
      stoolConsistency: 'weich',
      painLevel: 4,
      symptoms: [],
      note: null,
      triggerCategories: ['stress'],
      foodTriggerNote: 'Kaffee',
    });

    const [entry] = await listDiaryEntries(db);
    expect(entry.foodTriggerNote).toBeNull();
  });

  it('deletes a diary entry along with its triggers', async () => {
    const id = await createDiaryEntry(db, {
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 3,
      hasBlood: false,
      stoolConsistency: 'weich',
      painLevel: 4,
      symptoms: [],
      note: null,
      triggerCategories: ['stress', 'ernaehrung'],
      foodTriggerNote: null,
    });

    await deleteDiaryEntry(db, id);

    expect(await listDiaryEntries(db)).toEqual([]);
    expect(await db.select().from(triggers)).toEqual([]);
  });

  it('leaves other entries untouched when deleting one entry', async () => {
    const keptId = await createDiaryEntry(db, {
      occurredAt: '2026-07-06T08:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 1,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });
    const deletedId = await createDiaryEntry(db, {
      occurredAt: '2026-07-08T08:00:00.000Z',
      stoolFrequency: 5,
      hasBlood: true,
      stoolConsistency: 'waessrig',
      painLevel: 8,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });

    await deleteDiaryEntry(db, deletedId);

    const remaining = await listDiaryEntries(db);
    expect(remaining.map((entry) => entry.id)).toEqual([keptId]);
  });
});
```

- [ ] **Step 7: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/db/diaryRepository.test.ts
```
Erwartet: FAIL — TypeScript-Fehler (`foodTriggerNote` fehlt auf `NewDiaryEntryInput`) oder die zwei neuen Tests schlagen fehl, weil `createDiaryEntry`/`listDiaryEntries` das Feld noch nicht kennen.

- [ ] **Step 8: `diaryRepository.ts` erweitern**

Ersetze in `colitis-app/src/features/diary/db/diaryRepository.ts` die Funktionen `createDiaryEntry` und `listDiaryEntries`:

```typescript
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
      note: triggerCategory === 'ernaehrung' ? input.foodTriggerNote : null,
    });
  }

  return entryId;
}
```

```typescript
export async function listDiaryEntries(db: DiaryDb): Promise<DiaryEntryWithTriggers[]> {
  const entries = await db.select().from(diaryEntries).orderBy(desc(diaryEntries.occurredAt));

  const result: DiaryEntryWithTriggers[] = [];
  for (const entry of entries) {
    const entryTriggers = await db.select().from(triggers).where(eq(triggers.diaryEntryId, entry.id));
    const foodTrigger = entryTriggers.find((trigger) => trigger.category === 'ernaehrung');

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
      foodTriggerNote: foodTrigger?.note ?? null,
    });
  }

  return result;
}
```

(Die Funktion `deleteDiaryEntry` bleibt unverändert.)

- [ ] **Step 9: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/db/diaryRepository.test.ts
npx.cmd tsc --noEmit --pretty false
```
Erwartet: PASS, alle Tests grün; keine neuen Typfehler.

- [ ] **Step 10: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/diary/types.ts colitis-app/src/features/diary/formLogic.ts colitis-app/src/features/diary/formLogic.test.ts colitis-app/src/features/diary/db/diaryRepository.ts colitis-app/src/features/diary/db/diaryRepository.test.ts
git commit -m "feat: foodTriggerNote im Datenmodell und Repository verdrahten"
```

---

## Task 3: Formular-UI — Lebensmittel-Eingabe mit Vorschlag-Chips

**Files:**
- Modify: `colitis-app/src/features/diary/constants.ts`
- Modify: `colitis-app/src/features/diary/components/DiaryEntryForm.tsx`

**Interfaces:**
- Consumes: `appendFoodSuggestion` (aus Task 1, `../formLogic`), `formState.foodTriggerNote: string` und `formState.triggerCategories` (aus Task 2, `DiaryEntryFormState`)
- Produces: nichts (Blattkomponente)

Kein automatisiertes Test für diese Komponente (bestehendes Muster — keine React-Native-UI-Komponente in diesem Projekt hat eine Testdatei). Verifikation über `tsc --noEmit` und manuellen Test in Task 4.

- [ ] **Step 1: Vorschlagsliste ergänzen**

Füge in `colitis-app/src/features/diary/constants.ts` am Ende der Datei hinzu:

```typescript
export const FOOD_TRIGGER_SUGGESTIONS: string[] = ['Kaffee', 'Milchprodukte', 'Gluten', 'Scharfes', 'Alkohol', 'Zucker'];
```

- [ ] **Step 2: Import in `DiaryEntryForm.tsx` erweitern**

Ersetze in `colitis-app/src/features/diary/components/DiaryEntryForm.tsx` die bestehende Import-Zeile:

```typescript
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS } from '../constants';
```

durch:

```typescript
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS, FOOD_TRIGGER_SUGGESTIONS } from '../constants';
```

Ersetze die bestehende Import-Zeile:

```typescript
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  validateDiaryEntryForm,
  type DiaryEntryFormState,
} from '../formLogic';
```

durch:

```typescript
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  appendFoodSuggestion,
  validateDiaryEntryForm,
  type DiaryEntryFormState,
} from '../formLogic';
```

- [ ] **Step 3: Lebensmittel-Eingabe in die JSX einfügen**

Füge in `colitis-app/src/features/diary/components/DiaryEntryForm.tsx` direkt nach dem schließenden `</View>` des bestehenden "Mögliche Auslöser"-Blocks (der `View`-Block mit `{TRIGGER_CATEGORY_OPTIONS.map(...)}`) und vor `<Text style={styles.sectionLabel}>Notiz</Text>` ein:

```tsx
      {formState.triggerCategories.includes('ernaehrung') && (
        <>
          <Text style={styles.sectionLabel}>Welches Lebensmittel? (optional)</Text>
          <View style={styles.row}>
            {FOOD_TRIGGER_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                accessibilityLabel={`${suggestion} hinzufügen`}
                onPress={() =>
                  setFormState({
                    ...formState,
                    foodTriggerNote: appendFoodSuggestion(formState.foodTriggerNote, suggestion),
                  })
                }
                style={styles.choiceButton}
              >
                <Text style={styles.choiceButtonText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.noteInput}
            placeholder="z. B. Kaffee, Milchprodukte …"
            placeholderTextColor={colors.textSecondary}
            value={formState.foodTriggerNote}
            onChangeText={(text) => setFormState({ ...formState, foodTriggerNote: text })}
          />
        </>
      )}

```

- [ ] **Step 4: Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
```
Erwartet: keine neuen Typfehler.

- [ ] **Step 5: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/diary/constants.ts "colitis-app/src/features/diary/components/DiaryEntryForm.tsx"
git commit -m "feat: Lebensmittel-Eingabe mit Vorschlag-Chips im Tagebuch-Formular ergaenzen"
```

---

## Task 4: Anzeige — Verlaufsliste, PDF- und CSV-Export nutzen `buildTriggerLabels`

**Files:**
- Modify: `colitis-app/src/features/diary/components/DiaryHistoryList.tsx`
- Modify: `colitis-app/src/features/diary/diaryPdfBuilder.ts`
- Modify: `colitis-app/src/features/diary/diaryPdfBuilder.test.ts`
- Modify: `colitis-app/src/features/diary/diaryCsvBuilder.ts`
- Modify: `colitis-app/src/features/diary/diaryCsvBuilder.test.ts`

**Interfaces:**
- Consumes: `buildTriggerLabels` (aus Task 1, `../constants` bzw. `./constants`), `entry.foodTriggerNote` (aus Task 2, `DiaryEntryWithTriggers`)
- Produces: nichts (Endpunkte)

- [ ] **Step 1: Fehlschlagenden Test für den PDF-Export schreiben**

Füge in `colitis-app/src/features/diary/diaryPdfBuilder.test.ts` in der Funktion `makeEntry` das Feld `foodTriggerNote: null,` vor `...overrides,` hinzu:

```typescript
function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 3,
    hasBlood: false,
    stoolConsistency: 'weich',
    painLevel: 4,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}
```

Füge am Ende der Datei, vor der letzten schließenden `});`, hinzu:

```typescript

  it('shows the food trigger note in parentheses next to Ernährung', () => {
    const html = buildDiaryPdfHtml([makeEntry({ triggerCategories: ['ernaehrung'], foodTriggerNote: 'Kaffee' })]);
    expect(html).toContain('Ernährung (Kaffee)');
  });
```

- [ ] **Step 2: Fehlschlagenden Test für den CSV-Export schreiben**

Füge in `colitis-app/src/features/diary/diaryCsvBuilder.test.ts` in der Funktion `makeEntry` ebenso das Feld `foodTriggerNote: null,` vor `...overrides,` hinzu (gleiches Muster wie Step 1).

Füge am Ende der Datei, vor der letzten schließenden `});`, hinzu:

```typescript

  it('shows the food trigger note in parentheses next to Ernährung', () => {
    const csv = buildDiaryCsv([makeEntry({ triggerCategories: ['ernaehrung'], foodTriggerNote: 'Kaffee' })]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toContain('Ernährung (Kaffee)');
  });
```

- [ ] **Step 3: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/diaryPdfBuilder.test.ts src/features/diary/diaryCsvBuilder.test.ts
```
Erwartet: FAIL — beide neuen Tests schlagen fehl (Label enthält noch kein Klammer-Suffix), oder TypeScript-Fehler wegen fehlendem `foodTriggerNote` in `makeEntry`.

- [ ] **Step 4: `diaryPdfBuilder.ts` anpassen**

Ersetze in `colitis-app/src/features/diary/diaryPdfBuilder.ts` die Import-Zeile:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor } from './constants';
```

durch:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, labelFor, buildTriggerLabels } from './constants';
```

Ersetze die Zeile:

```typescript
  const triggerLabels = entry.triggerCategories.map((category) => labelFor(TRIGGER_CATEGORY_OPTIONS, category));
```

durch:

```typescript
  const triggerLabels = buildTriggerLabels(entry.triggerCategories, entry.foodTriggerNote);
```

- [ ] **Step 5: `diaryCsvBuilder.ts` anpassen**

Ersetze in `colitis-app/src/features/diary/diaryCsvBuilder.ts` die Import-Zeile:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor } from './constants';
```

durch:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, labelFor, buildTriggerLabels } from './constants';
```

Ersetze die Zeile:

```typescript
  const triggerLabels = entry.triggerCategories.map((category) => labelFor(TRIGGER_CATEGORY_OPTIONS, category));
```

durch:

```typescript
  const triggerLabels = buildTriggerLabels(entry.triggerCategories, entry.foodTriggerNote);
```

- [ ] **Step 6: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/diaryPdfBuilder.test.ts src/features/diary/diaryCsvBuilder.test.ts
```
Erwartet: PASS, alle Tests grün.

- [ ] **Step 7: Verlaufsliste anpassen**

Ersetze in `colitis-app/src/features/diary/components/DiaryHistoryList.tsx` die Import-Zeile:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor } from '../constants';
```

durch:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, labelFor, buildTriggerLabels } from '../constants';
```

Ersetze die Zeile:

```tsx
            Auslöser: {item.triggerCategories.map((category) => labelFor(TRIGGER_CATEGORY_OPTIONS, category)).join(', ')}
```

durch:

```tsx
            Auslöser: {buildTriggerLabels(item.triggerCategories, item.foodTriggerNote).join(', ')}
```

- [ ] **Step 8: Vollständige Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
npx.cmd vitest run
```
Erwartet: keine neuen Typfehler, alle Tests grün.

- [ ] **Step 9: Commit**

```bash
cd D:/Claude
git add "colitis-app/src/features/diary/components/DiaryHistoryList.tsx" colitis-app/src/features/diary/diaryPdfBuilder.ts colitis-app/src/features/diary/diaryPdfBuilder.test.ts colitis-app/src/features/diary/diaryCsvBuilder.ts colitis-app/src/features/diary/diaryCsvBuilder.test.ts
git commit -m "feat: Lebensmittel-Notiz in Verlaufsliste, PDF- und CSV-Export anzeigen"
```

- [ ] **Step 10: Manueller Testhinweis**

Beim nächsten Alltagstest: einen Tagebucheintrag mit Auslöser "Ernährung" und einem Lebensmittel (z. B. per Chip "Kaffee") anlegen, prüfen dass "Ernährung (Kaffee)" in der Verlaufsliste erscheint, dann PDF- und CSV-Export prüfen, dass dort ebenfalls "Ernährung (Kaffee)" auftaucht statt nur "Ernährung".

---

## Plan-Selbstprüfung (bereits durchgeführt)

- **Spec-Abdeckung:** Datenmodell/Repository (Task 2), Formular mit Chips (Task 3), Anzeige in allen drei Stellen (Task 4), reine Hilfsfunktionen als Grundlage (Task 1) — alle Abschnitte der Spec abgedeckt. Muster-Auswertung bewusst nicht angefasst (laut Spec explizit ausgeschlossen).
- **Platzhalter-Scan:** keine TBD/TODO, jeder Schritt enthält vollständigen Code.
- **Typ-Konsistenz:** `foodTriggerNote: string | null` durchgängig auf `NewDiaryEntryInput`/`DiaryEntryWithTriggers`, `foodTriggerNote: string` (nie null) auf `DiaryEntryFormState` — Task 3 und Task 4 verwenden exakt diese Feldnamen, wie in Task 2 definiert. `buildTriggerLabels`- und `appendFoodSuggestion`-Signaturen zwischen Task 1 (Definition) und Task 3/4 (Verwendung) konsistent.
