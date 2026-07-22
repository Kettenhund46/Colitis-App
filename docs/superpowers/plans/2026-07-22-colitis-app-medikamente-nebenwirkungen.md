# Medikamente-Nebenwirkungsnotizen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medikamente bekommen ein optionales, dauerhaftes Freitextfeld für Nebenwirkungen, sichtbar im Bearbeiten-Formular und in der Medikamenten-Liste.

**Architecture:** Eine neue nullable Spalte auf der bestehenden `medications`-Tabelle (per Drizzle-Migration), durchgereicht durch Typen/Repository/Formular-Logik bis zur UI. Da `MedicationInput`/`Medication` das Feld künftig zwingend führen, werden in derselben Aufgabe alle dadurch betroffenen bestehenden Tests mit aktualisiert.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Drizzle ORM, Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-medikamente-nebenwirkungen-design.md`
- Keine neue Abhängigkeit in `package.json`.
- Neue Spalte ist rein additiv (nullable, kein Default nötig) – bestehende Zeilen bekommen automatisch `NULL`, kein Datenverlust.
- `sideEffectsNote` ist ein Pflichtfeld im TypeScript-Typ (`string | null`), niemals optional (`?`) – gleiche Konvention wie `note` bei `SavedPlaceInput`/`NewScreeningReminderInput`/`NewDiaryEntryInput`.
- Leerer Freitext wird beim Speichern zu `null` (gleiche Logik wie bei `endDate` in `buildMedicationInput`).
- Keine Notiz pro einzelner Einnahme (`medication_log` bleibt unverändert) – nur ein Feld pro Medikament.
- Alle UI-Texte auf Deutsch, Themes über `useTheme()`/`ThemeColors`, keine hartkodierten Hex-Farben in Komponenten.
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier nicht nötig, reines React Native + Drizzle).

---

### Task 1: Datenbank-Spalte, Migration und Repository

**Files:**
- Modify: `colitis-app/src/db/schema.ts:51-58` (neue Spalte auf `medications`)
- Create: (generiert durch `drizzle-kit generate`) eine neue Datei `colitis-app/drizzle/000X_<generierter-name>.sql`, aktualisierte `colitis-app/drizzle/meta/_journal.json`, neue `colitis-app/drizzle/meta/000X_snapshot.json`, aktualisierte `colitis-app/drizzle/migrations.js`
- Modify: `colitis-app/src/features/medications/types.ts`
- Modify: `colitis-app/src/features/medications/db/medicationsRepository.ts`
- Modify: `colitis-app/src/features/medications/db/medicationsRepository.test.ts`
- Modify: `colitis-app/src/features/backup/db/backupRepository.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (erster Task).
- Produces (für Task 2, 3, 4):
  - `Medication.sideEffectsNote: string | null` und `MedicationInput.sideEffectsNote: string | null` in `src/features/medications/types.ts`.
  - `createMedication`/`updateMedication`/`listMedications`/`getMedicationById` lesen/schreiben `sideEffectsNote` mit (Signaturen bleiben sonst unverändert).

- [ ] **Step 1: Neue Spalte in `schema.ts` ergänzen**

In `colitis-app/src/db/schema.ts`, ändere den bestehenden `medications`-Block (Zeile 51-58):

```typescript
export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  schedule: text('schedule').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
});
```

zu:

```typescript
export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  schedule: text('schedule').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  sideEffectsNote: text('side_effects_note'),
});
```

- [ ] **Step 2: Migration generieren**

Run (aus `colitis-app/`): `npx.cmd drizzle-kit generate`

Expected: Eine neue SQL-Datei erscheint in `colitis-app/drizzle/` (Name wird von drizzle-kit automatisch vergeben) mit genau einem `ALTER TABLE "medications" ADD "side_effects_note" text;`-Statement (kein `CREATE TABLE`, keine andere Tabelle wird verändert). `colitis-app/drizzle/meta/_journal.json` bekommt einen neuen Eintrag, eine neue `000X_snapshot.json` erscheint in `colitis-app/drizzle/meta/`, und `colitis-app/drizzle/migrations.js` wird automatisch um den neuen Import/Eintrag erweitert.

Prüfe die neu generierte SQL-Datei: sie darf ausschließlich die neue Spalte auf `medications` hinzufügen, keine andere Tabelle oder Spalte verändern.

- [ ] **Step 3: Type-Check nach der Migration**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Fehler in `types.ts`-Konsumenten sind an dieser Stelle noch nicht zu erwarten (die Typen werden erst in Step 4 geändert) – falls doch Fehler auftreten, sind sie auf die Migration selbst zurückzuführen und müssen vor dem nächsten Schritt behoben werden.

- [ ] **Step 4: Typen erweitern**

In `colitis-app/src/features/medications/types.ts`, ändere:

```typescript
export interface Medication {
  id: number;
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  reminderTimes: MedicationReminderTime[];
}

export interface MedicationInput {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  reminderTimes: string[];
}
```

zu:

```typescript
export interface Medication {
  id: number;
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  sideEffectsNote: string | null;
  reminderTimes: MedicationReminderTime[];
}

export interface MedicationInput {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string | null;
  sideEffectsNote: string | null;
  reminderTimes: string[];
}
```

- [ ] **Step 5: Type-Check nach der Typ-Änderung**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Mehrere Fehler in `medicationsRepository.ts` (fehlendes Feld beim Insert/Update/Rückgabewert), `medicationsRepository.test.ts` (fehlendes Feld in 15 `createMedication`/`updateMedication`-Aufrufen) und `backupRepository.test.ts` (fehlendes Feld in 2 `medications: [{...}]`-Objektliteralen). Das ist erwartet – die nächsten Schritte beheben das.

- [ ] **Step 6: Repository erweitern**

In `colitis-app/src/features/medications/db/medicationsRepository.ts`, ändere `createMedication` (Zeile 9-32):

```typescript
export async function createMedication(db: MedicationsDb, input: MedicationInput): Promise<Medication> {
  const [insertedMedication] = await db
    .insert(medications)
    .values({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .returning({ id: medications.id });

  const reminderTimes = await insertReminderTimes(db, insertedMedication.id, input.reminderTimes);

  return {
    id: insertedMedication.id,
    name: input.name,
    dose: input.dose,
    schedule: input.schedule,
    startDate: input.startDate,
    endDate: input.endDate,
    reminderTimes,
  };
}
```

zu:

```typescript
export async function createMedication(db: MedicationsDb, input: MedicationInput): Promise<Medication> {
  const [insertedMedication] = await db
    .insert(medications)
    .values({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      sideEffectsNote: input.sideEffectsNote,
    })
    .returning({ id: medications.id });

  const reminderTimes = await insertReminderTimes(db, insertedMedication.id, input.reminderTimes);

  return {
    id: insertedMedication.id,
    name: input.name,
    dose: input.dose,
    schedule: input.schedule,
    startDate: input.startDate,
    endDate: input.endDate,
    sideEffectsNote: input.sideEffectsNote,
    reminderTimes,
  };
}
```

Ändere `listMedications` (Zeile 65-81):

```typescript
export async function listMedications(db: MedicationsDb): Promise<Medication[]> {
  const medicationRows = await db.select().from(medications).orderBy(asc(medications.name));

  const result: Medication[] = [];
  for (const medication of medicationRows) {
    result.push({
      id: medication.id,
      name: medication.name,
      dose: medication.dose,
      schedule: medication.schedule,
      startDate: medication.startDate,
      endDate: medication.endDate,
      reminderTimes: await loadReminderTimes(db, medication.id),
    });
  }
  return result;
}
```

zu:

```typescript
export async function listMedications(db: MedicationsDb): Promise<Medication[]> {
  const medicationRows = await db.select().from(medications).orderBy(asc(medications.name));

  const result: Medication[] = [];
  for (const medication of medicationRows) {
    result.push({
      id: medication.id,
      name: medication.name,
      dose: medication.dose,
      schedule: medication.schedule,
      startDate: medication.startDate,
      endDate: medication.endDate,
      sideEffectsNote: medication.sideEffectsNote,
      reminderTimes: await loadReminderTimes(db, medication.id),
    });
  }
  return result;
}
```

Ändere `getMedicationById` (Zeile 83-98):

```typescript
export async function getMedicationById(db: MedicationsDb, medicationId: number): Promise<Medication | null> {
  const rows = await db.select().from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    return null;
  }
  const medication = rows[0];
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose,
    schedule: medication.schedule,
    startDate: medication.startDate,
    endDate: medication.endDate,
    reminderTimes: await loadReminderTimes(db, medication.id),
  };
}
```

zu:

```typescript
export async function getMedicationById(db: MedicationsDb, medicationId: number): Promise<Medication | null> {
  const rows = await db.select().from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    return null;
  }
  const medication = rows[0];
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose,
    schedule: medication.schedule,
    startDate: medication.startDate,
    endDate: medication.endDate,
    sideEffectsNote: medication.sideEffectsNote,
    reminderTimes: await loadReminderTimes(db, medication.id),
  };
}
```

Ändere `updateMedication` (Zeile 105-130), im `.set({...})`-Aufruf:

```typescript
  await db
    .update(medications)
    .set({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .where(eq(medications.id, medicationId));
```

zu:

```typescript
  await db
    .update(medications)
    .set({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      sideEffectsNote: input.sideEffectsNote,
    })
    .where(eq(medications.id, medicationId));
```

(Der Rest von `updateMedication` – die Reminder-Times-Logik danach – bleibt unverändert.)

- [ ] **Step 7: Bestehende Tests in `medicationsRepository.test.ts` aktualisieren**

In `colitis-app/src/features/medications/db/medicationsRepository.test.ts` enthält jeder der 15 bestehenden `createMedication(db, {...})`- bzw. `updateMedication(db, id, {...})`-Aufrufe ein Objekt mit den Feldern `name`, `dose`, `schedule`, `startDate`, `endDate`, `reminderTimes`. Ergänze in **jedem** dieser 15 Aufrufe nach der Zeile `endDate: null,` die Zeile `sideEffectsNote: null,`.

Beispiel für den ersten Test (Zeile 23-31), vorher:

```typescript
  it('creates a medication with its reminder times', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich morgens',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00'],
    });
```

nachher:

```typescript
  it('creates a medication with its reminder times', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich morgens',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00'],
    });
```

Wende dieselbe Ergänzung (`sideEffectsNote: null,` direkt nach `endDate: null,`, vor `reminderTimes:`) in den übrigen 14 Aufrufen an. Sie befinden sich in folgenden Tests (jeweils an genau einer Stelle, außer wo mehrere Aufrufe im selben Test stehen):
- `'lists medications ordered by name, with their reminder times'` (2 Aufrufe: 'Tremfya' und 'Azathioprin')
- `'gets a single medication by id'` (1 Aufruf)
- `'replaces reminder times on update and reports removed/inserted rows'` (1× `createMedication` UND 1× `updateMedication` – beide bekommen die Ergänzung)
- `'ends a medication and returns its current reminder times'` (1 Aufruf)
- `'persists a notification id for a reminder time'` (1 Aufruf)
- `'logs a medication as taken'` (1 Aufruf)
- `'throws when updating a medication that does not exist'` (1× `updateMedication`)
- `'lists medication ids taken on a given date'` (3 Aufrufe: 'Salofalk', 'Tremfya', 'Azathioprin')
- `'deduplicates medication ids taken multiple times on the same date'` (1 Aufruf)
- `'deletes a medication along with its reminder times and log entries'` (1 Aufruf)

Ergänze außerdem am Ende der Datei (vor der letzten schließenden `});` des `describe`-Blocks) einen neuen Test:

```typescript

  it('persists and returns a side effects note', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: 'Verursacht gelegentlich Übelkeit',
      reminderTimes: [],
    });

    expect(created.sideEffectsNote).toBe('Verursacht gelegentlich Übelkeit');

    const found = await getMedicationById(db, created.id);
    expect(found?.sideEffectsNote).toBe('Verursacht gelegentlich Übelkeit');
  });

  it('updates a side effects note back to null', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: 'Übelkeit',
      reminderTimes: [],
    });

    await updateMedication(db, created.id, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });

    const updated = await getMedicationById(db, created.id);
    expect(updated?.sideEffectsNote).toBeNull();
  });
```

- [ ] **Step 8: Bestehende Tests in `backupRepository.test.ts` aktualisieren**

In `colitis-app/src/features/backup/db/backupRepository.test.ts` enthalten zwei Tests ein `medications: [{...}]`-Objektliteral mit vollständiger Zeilenform. Ergänze in **beiden** nach der Zeile `endDate: null,` die Zeile `sideEffectsNote: null,`.

Erste Stelle (im Test `'preserves foreign key relationships by keeping original ids'`), vorher:

```typescript
        medications: [
          { id: 5, name: 'Salofalk', dose: '500mg', schedule: '1x taeglich', startDate: '2026-01-01', endDate: null },
        ],
```

nachher:

```typescript
        medications: [
          {
            id: 5,
            name: 'Salofalk',
            dose: '500mg',
            schedule: '1x taeglich',
            startDate: '2026-01-01',
            endDate: null,
            sideEffectsNote: null,
          },
        ],
```

Zweite Stelle (im Test `'does not violate foreign key constraints when pre-existing linked data must be deleted before import'`), vorher:

```typescript
        medications: [
          {
            id: 77,
            name: 'Importiertes Medikament',
            dose: '200mg',
            schedule: '2x taeglich',
            startDate: '2026-01-01',
            endDate: null,
          },
        ],
```

nachher:

```typescript
        medications: [
          {
            id: 77,
            name: 'Importiertes Medikament',
            dose: '200mg',
            schedule: '2x taeglich',
            startDate: '2026-01-01',
            endDate: null,
            sideEffectsNote: null,
          },
        ],
```

- [ ] **Step 9: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle Tests grün, keine Typfehler.

- [ ] **Step 10: Commit**

```bash
git add colitis-app/src/db/schema.ts colitis-app/drizzle colitis-app/src/features/medications/types.ts colitis-app/src/features/medications/db/medicationsRepository.ts colitis-app/src/features/medications/db/medicationsRepository.test.ts colitis-app/src/features/backup/db/backupRepository.test.ts
git commit -m "feat: Nebenwirkungs-Notiz-Spalte, Migration und Repository ergaenzen"
```

---

### Task 2: Formular-Logik

**Files:**
- Modify: `colitis-app/src/features/medications/formLogic.ts`
- Modify: `colitis-app/src/features/medications/formLogic.test.ts`

**Interfaces:**
- Consumes: `MedicationInput` aus `./types` (Task 1, jetzt mit `sideEffectsNote: string | null`).
- Produces (für Task 3):
  - `MedicationFormState.sideEffectsNote: string`
  - `INITIAL_MEDICATION_FORM_STATE.sideEffectsNote: ''`
  - `buildMedicationInput` befüllt `sideEffectsNote` (getrimmt, leerer String → `null`)

- [ ] **Step 1: Write the failing test**

In `colitis-app/src/features/medications/formLogic.test.ts`, ändere den bestehenden Test `'trims text fields and converts an empty end date to null'` (Zeile 75-93):

```typescript
  it('trims text fields and converts an empty end date to null', () => {
    const input = buildMedicationInput({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: '  Salofalk  ',
      dose: ' 500mg ',
      schedule: ' 1x täglich ',
      startDate: '2026-07-12',
      endDate: '',
      reminderTimes: ['08:00'],
    });
    expect(input).toEqual({
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00'],
    });
  });
```

zu:

```typescript
  it('trims text fields and converts an empty end date to null', () => {
    const input = buildMedicationInput({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: '  Salofalk  ',
      dose: ' 500mg ',
      schedule: ' 1x täglich ',
      startDate: '2026-07-12',
      endDate: '',
      reminderTimes: ['08:00'],
    });
    expect(input).toEqual({
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00'],
    });
  });
```

Ergänze außerdem am Ende des `describe('buildMedicationInput', ...)`-Blocks (nach dem bestehenden Test `'keeps a provided end date'`) zwei neue Tests:

```typescript

  it('trims a side effects note and converts an empty string to null', () => {
    const input = buildMedicationInput({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      sideEffectsNote: '  Übelkeit  ',
    });
    expect(input.sideEffectsNote).toBe('Übelkeit');
  });

  it('converts an empty side effects note to null', () => {
    const input = buildMedicationInput({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      sideEffectsNote: '   ',
    });
    expect(input.sideEffectsNote).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/medications/formLogic.test.ts`
Expected: FAIL — `MedicationFormState` hat kein `sideEffectsNote`-Feld, `buildMedicationInput` liefert kein `sideEffectsNote` zurück.

- [ ] **Step 3: Write minimal implementation**

In `colitis-app/src/features/medications/formLogic.ts`, ändere:

```typescript
export interface MedicationFormState {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string;
  reminderTimes: string[];
}

export const INITIAL_MEDICATION_FORM_STATE: MedicationFormState = {
  name: '',
  dose: '',
  schedule: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  reminderTimes: [],
};
```

zu:

```typescript
export interface MedicationFormState {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string;
  sideEffectsNote: string;
  reminderTimes: string[];
}

export const INITIAL_MEDICATION_FORM_STATE: MedicationFormState = {
  name: '',
  dose: '',
  schedule: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  sideEffectsNote: '',
  reminderTimes: [],
};
```

Ändere `buildMedicationInput`:

```typescript
export function buildMedicationInput(state: MedicationFormState): MedicationInput {
  return {
    name: state.name.trim(),
    dose: state.dose.trim(),
    schedule: state.schedule.trim(),
    startDate: state.startDate,
    endDate: state.endDate.length > 0 ? state.endDate : null,
    reminderTimes: state.reminderTimes,
  };
}
```

zu:

```typescript
export function buildMedicationInput(state: MedicationFormState): MedicationInput {
  const trimmedSideEffectsNote = state.sideEffectsNote.trim();
  return {
    name: state.name.trim(),
    dose: state.dose.trim(),
    schedule: state.schedule.trim(),
    startDate: state.startDate,
    endDate: state.endDate.length > 0 ? state.endDate : null,
    sideEffectsNote: trimmedSideEffectsNote.length > 0 ? trimmedSideEffectsNote : null,
    reminderTimes: state.reminderTimes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/medications/formLogic.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle Tests grün, keine Typfehler.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/medications/formLogic.ts colitis-app/src/features/medications/formLogic.test.ts
git commit -m "feat: Nebenwirkungs-Notiz in Formular-Logik ergaenzen"
```

---

### Task 3: Formular-Feld für Nebenwirkungen

**Files:**
- Modify: `colitis-app/src/features/medications/components/MedicationForm.tsx`
- Modify: `colitis-app/app/(tabs)/medikamente/[id].tsx`

**Interfaces:**
- Consumes: `MedicationFormState.sideEffectsNote` (Task 2).
- Produces: Nichts für weitere Tasks (Task 4 betrifft nur die Anzeige in der Liste, unabhängig vom Formular).

Diese Aufgabe ändert bestehende UI-Dateien (keine neue Logik) – nicht automatisiert testbar. Verifikation über `tsc --noEmit` und manuellen Test in Schritt 3.

- [ ] **Step 1: Neues Feld in `MedicationForm.tsx` ergänzen**

In `colitis-app/src/features/medications/components/MedicationForm.tsx`, füge nach dem bestehenden Erinnerungszeiten-Block (nach der schließenden `</View>` der `reminderRow` mit "Hinzufügen"-Button, Zeile 121-137, und vor dem `errors.length > 0`-Block, Zeile 139) folgenden neuen Abschnitt ein:

```typescript
      <Text style={styles.sectionLabel}>Nebenwirkungen (optional)</Text>
      <TextInput
        style={[styles.textInput, styles.noteInput]}
        placeholder="z. B. Verursacht gelegentlich Übelkeit"
        placeholderTextColor={colors.textSecondary}
        value={formState.sideEffectsNote}
        onChangeText={(text) => setFormState({ ...formState, sideEffectsNote: text })}
        multiline
      />
```

In `makeStyles` (Zeile 162-240), ergänze nach dem bestehenden `reminderInput`-Eintrag (Zeile 198-201) einen neuen Stil:

```typescript
    noteInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
```

- [ ] **Step 2: `[id].tsx` um `sideEffectsNote` im `initialState` ergänzen**

In `colitis-app/app/(tabs)/medikamente/[id].tsx`, ändere den `initialState`-Block innerhalb des `<MedicationForm ...>`-Aufrufs (Zeile 112-120):

```typescript
      <MedicationForm
        initialState={{
          name: medication.name,
          dose: medication.dose,
          schedule: medication.schedule,
          startDate: medication.startDate,
          endDate: medication.endDate ?? '',
          reminderTimes: medication.reminderTimes.map((reminderTime) => reminderTime.time),
        }}
        onSubmit={handleSubmit}
        submitLabel="Änderungen speichern"
      />
```

zu:

```typescript
      <MedicationForm
        initialState={{
          name: medication.name,
          dose: medication.dose,
          schedule: medication.schedule,
          startDate: medication.startDate,
          endDate: medication.endDate ?? '',
          sideEffectsNote: medication.sideEffectsNote ?? '',
          reminderTimes: medication.reminderTimes.map((reminderTime) => reminderTime.time),
        }}
        onSubmit={handleSubmit}
        submitLabel="Änderungen speichern"
      />
```

- [ ] **Step 3: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/medications/components/MedicationForm.tsx "colitis-app/app/(tabs)/medikamente/[id].tsx"
git commit -m "feat: Nebenwirkungs-Notizfeld im Medikamenten-Formular ergaenzen"
```

---

### Task 4: Anzeige in der Medikamenten-Liste

**Files:**
- Modify: `colitis-app/src/features/medications/components/MedicationList.tsx`

**Interfaces:**
- Consumes: `Medication.sideEffectsNote` (Task 1).
- Produces: Nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe ändert eine bestehende UI-Datei (keine neue Logik) – nicht automatisiert testbar. Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Nebenwirkungs-Zeile in der Karte ergänzen**

In `colitis-app/src/features/medications/components/MedicationList.tsx`, füge in der `renderItem`-Funktion nach dem Erinnerungszeiten-Block (Zeile 58-62) und vor der "Beendet am"-Zeile (Zeile 63) folgenden neuen Block ein:

```typescript
            {item.sideEffectsNote && <Text style={styles.cardSideEffects}>Nebenwirkungen: {item.sideEffectsNote}</Text>}
```

Die Stelle sieht danach so aus:

```typescript
            {item.reminderTimes.length > 0 && (
              <Text style={styles.cardDetail}>
                Erinnerungen: {item.reminderTimes.map((reminderTime) => reminderTime.time).join(', ')}
              </Text>
            )}
            {item.sideEffectsNote && <Text style={styles.cardSideEffects}>Nebenwirkungen: {item.sideEffectsNote}</Text>}
            {!isActive && item.endDate && <Text style={styles.cardEndedLabel}>Beendet am {item.endDate}</Text>}
```

In `makeStyles` (Zeile 115-194), ergänze nach dem bestehenden `cardDetail`-Eintrag (Zeile 142) einen neuen Stil:

```typescript
    cardSideEffects: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: tokens.spacing.xs,
    },
```

- [ ] **Step 2: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

- [ ] **Step 3: Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build)**

- Neues Medikament anlegen, Nebenwirkungsfeld ausfüllen (z. B. "Übelkeit nach der Einnahme") → nach dem Speichern erscheint die Notiz in der Liste unter den Erinnerungszeiten.
- Bestehendes Medikament bearbeiten, Nebenwirkungsfeld leeren → nach dem Speichern verschwindet die Zeile aus der Liste.
- Medikament ohne Nebenwirkungsfeld anlegen → keine zusätzliche Zeile in der Karte.
- Backup exportieren, Nebenwirkungs-Notiz ändern, Backup wieder importieren → ursprüngliche Notiz ist wiederhergestellt.
- Alle drei Themes (Standard, Dunkel, Blau-Weiß) durchschalten und die neue Zeile auf Lesbarkeit prüfen.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/medications/components/MedicationList.tsx
git commit -m "feat: Nebenwirkungs-Notiz in Medikamenten-Liste anzeigen"
```
