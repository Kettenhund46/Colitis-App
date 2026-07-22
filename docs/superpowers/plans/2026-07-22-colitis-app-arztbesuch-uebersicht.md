# Arztbesuch-Übersicht/PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nutzer können Arztbesuche (Datum, Arzt/Fachrichtung, Anlass, Notizen, optionaler Folgetermin) im Tagebuch-Tab anlegen, bearbeiten und löschen, sich als Liste anzeigen lassen und die komplette Besuchshistorie als PDF exportieren. Die neuen Daten überleben ein Backup/Restore.

**Architecture:** Neue eigenständige Datenbanktabelle `doctor_visits` (keine Fremdschlüssel-Beziehung zu anderen Tabellen) mit eigenem Repository, nach dem Muster von `src/features/medications/`. Neue Stack-Screens unter `app/(tabs)/tagebuch/arztbesuche/`, erreichbar über einen Link im Tagebuch-Haupttab. PDF-Export nach dem etablierten Builder/Export-Wrapper-Muster (`diaryPdfBuilder.ts`/`diaryPdfExport.ts`, `medicationPassBuilder.ts`/`medicationPassExport.ts`). Anschluss an das bestehende Backup/Restore-System, das Tabellen explizit auflistet.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Drizzle ORM, expo-print, expo-sharing, Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-arztbesuch-uebersicht-design.md`
- Neue Tabelle erfordert eine Drizzle-Migration (`npx drizzle-kit generate`), gleicher Ablauf wie bei den sechs bestehenden Migrationen in `drizzle/`.
- `doctorVisits` ist unabhängig von allen anderen Tabellen (keine Fremdschlüssel-Beziehung).
- `visitDate` ist Pflichtfeld (Format `JJJJ-MM-TT`); `doctorName`, `reason`, `note`, `nextAppointmentDate` sind optional/nullable.
- Liste und PDF sortieren nach Datum absteigend (neueste zuerst), wie bei Tagebucheinträgen (`desc(occurredAt)` in `diaryRepository.ts`).
- Datumsvalidierung: bestehende `isValidCalendarDate` aus `src/features/medications/dateValidation.ts` wiederverwenden (keine Dopplung, die Funktion ist bereits medikamentenunabhängig).
- PDF-Export zeigt die komplette Besuchshistorie (keine Filterung auf zukünftige Termine), eigenes lokales `escapeHtml` (kein Shared-Util, wie bei allen bisherigen PDF-Buildern).
- Neue Screens unter `app/(tabs)/tagebuch/arztbesuche/` (`index.tsx`, `neu.tsx`, `[id].tsx`), Navigation über einen neuen Link auf `tagebuch/index.tsx` unterhalb des bestehenden "Muster-Auswertung ansehen →"-Links, gleicher `analysisLink`-Stil.
- Backup-Integration: `doctorVisits` muss explizit in `src/features/backup/types.ts`, `db/backupRepository.ts` und `backupSerializer.ts` (`REQUIRED_TABLE_KEYS`) ergänzt werden – das Backup-System sichert keine Tabellen automatisch.
- `BACKUP_FORMAT_VERSION` bleibt bei `1` (reine Tabellenerweiterung); alte Sicherungsdateien ohne `doctorVisits` werden von der bestehenden `REQUIRED_TABLE_KEYS`-Prüfung korrekt als ungültig zurückgewiesen – kein Sonderfall nötig.
- Alle UI-Texte auf Deutsch, Themes über `useTheme()`/`ThemeColors`, keine hartkodierten Hex-Farben in Komponenten.
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier: `expo-print`/`expo-sharing`, bereits im Projekt etabliert, keine neuen APIs).

---

### Task 1: Datenbank-Tabelle, Migration und Repository

**Files:**
- Modify: `colitis-app/src/db/schema.ts` (neue Tabelle am Dateiende, nach `cachedFeedItems`)
- Create: (generiert durch `drizzle-kit generate`) eine neue Datei `colitis-app/drizzle/000X_<generierter-name>.sql`, aktualisierte `colitis-app/drizzle/meta/_journal.json`, neue `colitis-app/drizzle/meta/000X_snapshot.json`, aktualisierte `colitis-app/drizzle/migrations.js`
- Create: `colitis-app/src/features/doctorVisits/types.ts`
- Create: `colitis-app/src/features/doctorVisits/db/testDb.ts`
- Create: `colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.ts`
- Test: `colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (erster Task).
- Produces (für Task 2, 3, 4, 5, 6, 7):
  - `export const doctorVisits` Tabelle in `src/db/schema.ts`.
  - `export interface DoctorVisit { id: number; visitDate: string; doctorName: string | null; reason: string | null; note: string | null; nextAppointmentDate: string | null; }` in `src/features/doctorVisits/types.ts`.
  - `export interface DoctorVisitInput { visitDate: string; doctorName: string | null; reason: string | null; note: string | null; nextAppointmentDate: string | null; }` in `src/features/doctorVisits/types.ts`.
  - `export function createDoctorVisit(db: DoctorVisitsDb, input: DoctorVisitInput): Promise<DoctorVisit>`
  - `export function listDoctorVisits(db: DoctorVisitsDb): Promise<DoctorVisit[]>` (sortiert `desc(visitDate)`)
  - `export function getDoctorVisitById(db: DoctorVisitsDb, visitId: number): Promise<DoctorVisit | null>`
  - `export function updateDoctorVisit(db: DoctorVisitsDb, visitId: number, input: DoctorVisitInput): Promise<void>`
  - `export function deleteDoctorVisit(db: DoctorVisitsDb, visitId: number): Promise<void>`
  - `export function createTestDb()` in `colitis-app/src/features/doctorVisits/db/testDb.ts` (liest alle SQL-Migrationsdateien aus `drizzle/` ein, gleiches Muster wie `src/features/knowledge/db/testDb.ts`)

- [ ] **Step 1: Neue Tabelle in `schema.ts` ergänzen**

In `colitis-app/src/db/schema.ts`, füge am Dateiende (nach dem bestehenden `cachedFeedItems`-Block) folgenden neuen Block ein:

```typescript

export const doctorVisits = sqliteTable('doctor_visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitDate: text('visit_date').notNull(),
  doctorName: text('doctor_name'),
  reason: text('reason'),
  note: text('note'),
  nextAppointmentDate: text('next_appointment_date'),
});
```

- [ ] **Step 2: Migration generieren**

Run (aus `colitis-app/`): `npx.cmd drizzle-kit generate`

Expected: Eine neue SQL-Datei erscheint in `colitis-app/drizzle/` (Name wird von drizzle-kit automatisch vergeben, z. B. `0006_<zufälliger-name>.sql`) mit genau einem `CREATE TABLE "doctor_visits" (...)`-Statement. `colitis-app/drizzle/meta/_journal.json` bekommt einen neuen Eintrag, eine neue `000X_snapshot.json` erscheint in `colitis-app/drizzle/meta/`, und `colitis-app/drizzle/migrations.js` wird automatisch um den neuen Import/Eintrag erweitert.

Prüfe die neu generierte SQL-Datei: sie darf ausschließlich die neue Tabelle anlegen, keine bestehende Tabelle verändern.

- [ ] **Step 3: Type-Check nach der Migration**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Keine Fehler.

- [ ] **Step 4: Typen für das neue Feature anlegen**

Create `colitis-app/src/features/doctorVisits/types.ts`:

```typescript
export interface DoctorVisit {
  id: number;
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}

export interface DoctorVisitInput {
  visitDate: string;
  doctorName: string | null;
  reason: string | null;
  note: string | null;
  nextAppointmentDate: string | null;
}
```

- [ ] **Step 5: Gemeinsames Test-DB-Setup für das Arztbesuch-Feature erstellen**

Create `colitis-app/src/features/doctorVisits/db/testDb.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../../db/schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const migrationsDir = join(__dirname, '../../../../drizzle');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8');
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        sqlite.exec(trimmed);
      }
    }
  }

  return drizzle(sqlite, { schema });
}
```

- [ ] **Step 6: Write the failing test für das Repository**

Create `colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  createDoctorVisit,
  listDoctorVisits,
  getDoctorVisitById,
  updateDoctorVisit,
  deleteDoctorVisit,
} from './doctorVisitsRepository';

describe('doctor visits repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a doctor visit with only the required field set', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.visitDate).toBe('2026-07-20');
    expect(created.doctorName).toBeNull();
    expect(created.reason).toBeNull();
    expect(created.note).toBeNull();
    expect(created.nextAppointmentDate).toBeNull();
  });

  it('creates a doctor visit with all fields set', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller, Gastroenterologie',
      reason: 'Kontrolle',
      note: 'Blutwerte unauffällig, Dosis unverändert.',
      nextAppointmentDate: '2026-10-20',
    });

    expect(created.doctorName).toBe('Dr. Müller, Gastroenterologie');
    expect(created.reason).toBe('Kontrolle');
    expect(created.note).toBe('Blutwerte unauffällig, Dosis unverändert.');
    expect(created.nextAppointmentDate).toBe('2026-10-20');
  });

  it('lists doctor visits ordered by date, newest first', async () => {
    await createDoctorVisit(db, {
      visitDate: '2026-01-15',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });
    await createDoctorVisit(db, {
      visitDate: '2026-06-01',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    const list = await listDoctorVisits(db);

    expect(list.map((visit) => visit.visitDate)).toEqual(['2026-06-01', '2026-01-15']);
  });

  it('gets a single doctor visit by id', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller',
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    const found = await getDoctorVisitById(db, created.id);
    expect(found?.doctorName).toBe('Dr. Müller');
  });

  it('returns null when a doctor visit is not found', async () => {
    const found = await getDoctorVisitById(db, 999);
    expect(found).toBeNull();
  });

  it('updates a doctor visit', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller',
      reason: 'Kontrolle',
      note: null,
      nextAppointmentDate: null,
    });

    await updateDoctorVisit(db, created.id, {
      visitDate: '2026-07-21',
      doctorName: 'Dr. Schmidt',
      reason: 'Akuter Schub',
      note: 'Kortison-Stoß begonnen.',
      nextAppointmentDate: '2026-08-01',
    });

    const updated = await getDoctorVisitById(db, created.id);
    expect(updated).toEqual({
      id: created.id,
      visitDate: '2026-07-21',
      doctorName: 'Dr. Schmidt',
      reason: 'Akuter Schub',
      note: 'Kortison-Stoß begonnen.',
      nextAppointmentDate: '2026-08-01',
    });
  });

  it('throws when updating a doctor visit that does not exist', async () => {
    await expect(
      updateDoctorVisit(db, 999, {
        visitDate: '2026-07-21',
        doctorName: null,
        reason: null,
        note: null,
        nextAppointmentDate: null,
      })
    ).rejects.toThrow('Arztbesuch mit ID 999 wurde nicht gefunden.');
  });

  it('deletes a doctor visit', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    await deleteDoctorVisit(db, created.id);

    expect(await getDoctorVisitById(db, created.id)).toBeNull();
  });

  it('throws when deleting a doctor visit that does not exist', async () => {
    await expect(deleteDoctorVisit(db, 999)).rejects.toThrow('Arztbesuch mit ID 999 wurde nicht gefunden.');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.test.ts`
Expected: FAIL — `doctorVisitsRepository.ts` does not exist yet (module not found).

- [ ] **Step 8: Write the implementation**

Create `colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.ts`:

```typescript
import { desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { doctorVisits } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { DoctorVisit, DoctorVisitInput } from '../types';

export type DoctorVisitsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createDoctorVisit(db: DoctorVisitsDb, input: DoctorVisitInput): Promise<DoctorVisit> {
  const [inserted] = await db
    .insert(doctorVisits)
    .values({
      visitDate: input.visitDate,
      doctorName: input.doctorName,
      reason: input.reason,
      note: input.note,
      nextAppointmentDate: input.nextAppointmentDate,
    })
    .returning({ id: doctorVisits.id });

  return {
    id: inserted.id,
    visitDate: input.visitDate,
    doctorName: input.doctorName,
    reason: input.reason,
    note: input.note,
    nextAppointmentDate: input.nextAppointmentDate,
  };
}

export async function listDoctorVisits(db: DoctorVisitsDb): Promise<DoctorVisit[]> {
  return db.select().from(doctorVisits).orderBy(desc(doctorVisits.visitDate));
}

export async function getDoctorVisitById(db: DoctorVisitsDb, visitId: number): Promise<DoctorVisit | null> {
  const rows = await db.select().from(doctorVisits).where(eq(doctorVisits.id, visitId));
  return rows.length > 0 ? rows[0] : null;
}

async function assertDoctorVisitExists(db: DoctorVisitsDb, visitId: number): Promise<void> {
  const rows = await db.select({ id: doctorVisits.id }).from(doctorVisits).where(eq(doctorVisits.id, visitId));
  if (rows.length === 0) {
    throw new Error(`Arztbesuch mit ID ${visitId} wurde nicht gefunden.`);
  }
}

export async function updateDoctorVisit(db: DoctorVisitsDb, visitId: number, input: DoctorVisitInput): Promise<void> {
  await assertDoctorVisitExists(db, visitId);
  await db
    .update(doctorVisits)
    .set({
      visitDate: input.visitDate,
      doctorName: input.doctorName,
      reason: input.reason,
      note: input.note,
      nextAppointmentDate: input.nextAppointmentDate,
    })
    .where(eq(doctorVisits.id, visitId));
}

export async function deleteDoctorVisit(db: DoctorVisitsDb, visitId: number): Promise<void> {
  await assertDoctorVisitExists(db, visitId);
  await db.delete(doctorVisits).where(eq(doctorVisits.id, visitId));
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 10: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün, keine neuen Typfehler.

- [ ] **Step 11: Commit**

```bash
git add colitis-app/src/db/schema.ts colitis-app/drizzle colitis-app/src/features/doctorVisits/types.ts colitis-app/src/features/doctorVisits/db/testDb.ts colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.ts colitis-app/src/features/doctorVisits/db/doctorVisitsRepository.test.ts
git commit -m "feat: Schema-Migration und Repository fuer Arztbesuch-Uebersicht"
```

---

### Task 2: Formular-Logik

**Files:**
- Create: `colitis-app/src/features/doctorVisits/formLogic.ts`
- Test: `colitis-app/src/features/doctorVisits/formLogic.test.ts`

**Interfaces:**
- Consumes: `DoctorVisitInput` aus `./types` (Task 1), `isValidCalendarDate` aus `../medications/dateValidation` (bereits vorhanden, unverändert).
- Produces (für Task 3):
  - `export interface DoctorVisitFormState { visitDate: string; doctorName: string; reason: string; note: string; nextAppointmentDate: string; }`
  - `export const INITIAL_DOCTOR_VISIT_FORM_STATE: DoctorVisitFormState`
  - `export function validateDoctorVisitForm(state: DoctorVisitFormState): string[]`
  - `export function buildDoctorVisitInput(state: DoctorVisitFormState): DoctorVisitInput`

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/doctorVisits/formLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  INITIAL_DOCTOR_VISIT_FORM_STATE,
  validateDoctorVisitForm,
  buildDoctorVisitInput,
  type DoctorVisitFormState,
} from './formLogic';

describe('validateDoctorVisitForm', () => {
  it('requires a valid visit date', () => {
    const state: DoctorVisitFormState = { ...INITIAL_DOCTOR_VISIT_FORM_STATE, visitDate: '' };
    expect(validateDoctorVisitForm(state)).toContain('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
  });

  it('rejects an invalid visit date format', () => {
    const state: DoctorVisitFormState = { ...INITIAL_DOCTOR_VISIT_FORM_STATE, visitDate: '20.07.2026' };
    expect(validateDoctorVisitForm(state)).toContain('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
  });

  it('accepts a valid visit date with all other fields empty', () => {
    const state: DoctorVisitFormState = { ...INITIAL_DOCTOR_VISIT_FORM_STATE, visitDate: '2026-07-20' };
    expect(validateDoctorVisitForm(state)).toEqual([]);
  });

  it('rejects an invalid next appointment date', () => {
    const state: DoctorVisitFormState = {
      ...INITIAL_DOCTOR_VISIT_FORM_STATE,
      visitDate: '2026-07-20',
      nextAppointmentDate: 'nicht-ein-datum',
    };
    expect(validateDoctorVisitForm(state)).toContain(
      'Bitte ein gültiges Datum für den nächsten Termin eingeben (JJJJ-MM-TT) oder leer lassen.'
    );
  });

  it('accepts an empty next appointment date', () => {
    const state: DoctorVisitFormState = {
      ...INITIAL_DOCTOR_VISIT_FORM_STATE,
      visitDate: '2026-07-20',
      nextAppointmentDate: '',
    };
    expect(validateDoctorVisitForm(state)).toEqual([]);
  });
});

describe('buildDoctorVisitInput', () => {
  it('trims text fields and converts empty strings to null', () => {
    const state: DoctorVisitFormState = {
      visitDate: '2026-07-20',
      doctorName: '  ',
      reason: '  ',
      note: '  ',
      nextAppointmentDate: '',
    };

    expect(buildDoctorVisitInput(state)).toEqual({
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });
  });

  it('keeps trimmed non-empty text fields', () => {
    const state: DoctorVisitFormState = {
      visitDate: '2026-07-20',
      doctorName: '  Dr. Müller  ',
      reason: '  Kontrolle  ',
      note: '  Alles unauffällig  ',
      nextAppointmentDate: '2026-10-20',
    };

    expect(buildDoctorVisitInput(state)).toEqual({
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller',
      reason: 'Kontrolle',
      note: 'Alles unauffällig',
      nextAppointmentDate: '2026-10-20',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/doctorVisits/formLogic.test.ts`
Expected: FAIL — `formLogic.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/doctorVisits/formLogic.ts`:

```typescript
import { isValidCalendarDate } from '../medications/dateValidation';
import type { DoctorVisitInput } from './types';

export interface DoctorVisitFormState {
  visitDate: string;
  doctorName: string;
  reason: string;
  note: string;
  nextAppointmentDate: string;
}

export const INITIAL_DOCTOR_VISIT_FORM_STATE: DoctorVisitFormState = {
  visitDate: new Date().toISOString().slice(0, 10),
  doctorName: '',
  reason: '',
  note: '',
  nextAppointmentDate: '',
};

export function validateDoctorVisitForm(state: DoctorVisitFormState): string[] {
  const errors: string[] = [];

  if (!isValidCalendarDate(state.visitDate)) {
    errors.push('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
  }
  if (state.nextAppointmentDate.length > 0 && !isValidCalendarDate(state.nextAppointmentDate)) {
    errors.push('Bitte ein gültiges Datum für den nächsten Termin eingeben (JJJJ-MM-TT) oder leer lassen.');
  }

  return errors;
}

export function buildDoctorVisitInput(state: DoctorVisitFormState): DoctorVisitInput {
  const trimmedDoctorName = state.doctorName.trim();
  const trimmedReason = state.reason.trim();
  const trimmedNote = state.note.trim();

  return {
    visitDate: state.visitDate,
    doctorName: trimmedDoctorName.length > 0 ? trimmedDoctorName : null,
    reason: trimmedReason.length > 0 ? trimmedReason : null,
    note: trimmedNote.length > 0 ? trimmedNote : null,
    nextAppointmentDate: state.nextAppointmentDate.length > 0 ? state.nextAppointmentDate : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/doctorVisits/formLogic.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/doctorVisits/formLogic.ts colitis-app/src/features/doctorVisits/formLogic.test.ts
git commit -m "feat: Formular-Logik fuer Arztbesuch-Uebersicht ergaenzen"
```

---

### Task 3: Formular-Komponente und Anlegen/Bearbeiten-Screens

**Files:**
- Create: `colitis-app/src/features/doctorVisits/components/DoctorVisitForm.tsx`
- Create: `colitis-app/app/(tabs)/tagebuch/arztbesuche/neu.tsx`
- Create: `colitis-app/app/(tabs)/tagebuch/arztbesuche/[id].tsx`

**Interfaces:**
- Consumes: `DoctorVisitFormState`, `INITIAL_DOCTOR_VISIT_FORM_STATE`, `validateDoctorVisitForm`, `buildDoctorVisitInput` aus `../formLogic` (Task 2); `createDoctorVisit`, `getDoctorVisitById`, `updateDoctorVisit` aus `../db/doctorVisitsRepository` (Task 1); `DoctorVisit`, `DoctorVisitInput` aus `../types` (Task 1).
- Produces (für Task 4): nichts direkt, aber `arztbesuche/index.tsx` (Task 4) navigiert zu `arztbesuche/neu` und `arztbesuche/[id]`, die hier entstehen.

Diese Aufgabe erstellt neue UI-Dateien (keine bestehenden werden geändert) – nicht automatisiert testbar, gleiches Muster wie bisherige Formular-UI in diesem Projekt. Verifikation über `tsc --noEmit` in Schritt 4.

- [ ] **Step 1: Formular-Komponente erstellen**

Create `colitis-app/src/features/doctorVisits/components/DoctorVisitForm.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import {
  INITIAL_DOCTOR_VISIT_FORM_STATE,
  buildDoctorVisitInput,
  validateDoctorVisitForm,
  type DoctorVisitFormState,
} from '../formLogic';
import type { DoctorVisitInput } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DoctorVisitFormProps {
  initialState?: DoctorVisitFormState;
  onSubmit: (input: DoctorVisitInput) => void | Promise<void>;
  submitLabel: string;
}

export function DoctorVisitForm({ initialState, onSubmit, submitLabel }: DoctorVisitFormProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [formState, setFormState] = useState<DoctorVisitFormState>(initialState ?? INITIAL_DOCTOR_VISIT_FORM_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const validationErrors = validateDoctorVisitForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildDoctorVisitInput(formState)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Datum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2026-07-20"
        placeholderTextColor={colors.textSecondary}
        value={formState.visitDate}
        onChangeText={(text) => setFormState({ ...formState, visitDate: text })}
      />

      <Text style={styles.sectionLabel}>Arzt/Fachrichtung (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Dr. Müller, Gastroenterologie"
        placeholderTextColor={colors.textSecondary}
        value={formState.doctorName}
        onChangeText={(text) => setFormState({ ...formState, doctorName: text })}
      />

      <Text style={styles.sectionLabel}>Anlass/Grund (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Kontrolle, akuter Schub"
        placeholderTextColor={colors.textSecondary}
        value={formState.reason}
        onChangeText={(text) => setFormState({ ...formState, reason: text })}
      />

      <Text style={styles.sectionLabel}>Notizen/Ergebnis (optional)</Text>
      <TextInput
        style={[styles.textInput, styles.noteInput]}
        placeholder="z. B. Befund, Besprochenes, Medikamentenänderungen"
        placeholderTextColor={colors.textSecondary}
        value={formState.note}
        onChangeText={(text) => setFormState({ ...formState, note: text })}
        multiline
      />

      <Text style={styles.sectionLabel}>Nächster Termin (optional, JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Leer lassen, falls noch kein Folgetermin bekannt"
        placeholderTextColor={colors.textSecondary}
        value={formState.nextAppointmentDate}
        onChangeText={(text) => setFormState({ ...formState, nextAppointmentDate: text })}
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

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: tokens.spacing.lg },
    sectionLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: tokens.spacing.md,
    },
    noteInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    errorBox: {
      backgroundColor: colors.surface,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.md,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
      marginTop: tokens.spacing.md,
    },
    submitButtonDisabled: { backgroundColor: colors.border },
    submitButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

- [ ] **Step 2: Anlegen-Screen erstellen**

Create `colitis-app/app/(tabs)/tagebuch/arztbesuche/neu.tsx`:

```typescript
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { createDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { DoctorVisitForm } from '../../../../src/features/doctorVisits/components/DoctorVisitForm';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { DoctorVisitInput } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function NeuerArztbesuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(input: DoctorVisitInput) {
    try {
      const db = await createEncryptedDb();
      await createDoctorVisit(db, input);
      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Arztbesuche] Anlegen fehlgeschlagen:', error);
      setSaveError('Arztbesuch konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <DoctorVisitForm onSubmit={handleSubmit} submitLabel="Arztbesuch speichern" />
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
  });
}
```

- [ ] **Step 3: Bearbeiten-Screen erstellen**

Create `colitis-app/app/(tabs)/tagebuch/arztbesuche/[id].tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { getDoctorVisitById, updateDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { DoctorVisitForm } from '../../../../src/features/doctorVisits/components/DoctorVisitForm';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { DoctorVisit, DoctorVisitInput } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ArztbesuchBearbeitenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const visitId = Number(id);
  const [visit, setVisit] = useState<DoctorVisit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => getDoctorVisitById(db, visitId))
        .then((loaded) => {
          if (isActive) {
            setVisit(loaded);
            setLoadError(loaded ? null : 'Arztbesuch wurde nicht gefunden.');
          }
        })
        .catch((error: unknown) => {
          console.error('[Arztbesuche] Laden zum Bearbeiten fehlgeschlagen:', error);
          if (isActive) {
            setLoadError('Arztbesuch konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [visitId])
  );

  async function handleSubmit(input: DoctorVisitInput) {
    try {
      const db = await createEncryptedDb();
      await updateDoctorVisit(db, visitId, input);
      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Arztbesuche] Bearbeiten fehlgeschlagen:', error);
      setSaveError('Änderungen konnten nicht gespeichert werden.');
    }
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Arztbesuch wird geladen …</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <DoctorVisitForm
        initialState={{
          visitDate: visit.visitDate,
          doctorName: visit.doctorName ?? '',
          reason: visit.reason ?? '',
          note: visit.note ?? '',
          nextAppointmentDate: visit.nextAppointmentDate ?? '',
        }}
        onSubmit={handleSubmit}
        submitLabel="Änderungen speichern"
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: tokens.spacing.lg },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
    loadingText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
  });
}
```

- [ ] **Step 4: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler (die Screens sind zu diesem Zeitpunkt noch nicht über `_layout.tsx` erreichbar oder von `index.tsx` verlinkt — das folgt in Task 4 — aber sie müssen bereits jetzt typkorrekt sein).

- [ ] **Step 5: Commit**

```bash
git add "colitis-app/src/features/doctorVisits/components/DoctorVisitForm.tsx" "colitis-app/app/(tabs)/tagebuch/arztbesuche/neu.tsx" "colitis-app/app/(tabs)/tagebuch/arztbesuche/[id].tsx"
git commit -m "feat: Formular-Komponente und Anlegen/Bearbeiten-Screens fuer Arztbesuche"
```

---

### Task 4: Listen-Komponente, Übersichts-Screen und Navigation

**Files:**
- Create: `colitis-app/src/features/doctorVisits/components/DoctorVisitList.tsx`
- Create: `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/_layout.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: `listDoctorVisits`, `deleteDoctorVisit` aus `../../../../src/features/doctorVisits/db/doctorVisitsRepository` (Task 1); `DoctorVisit` aus `../../../../src/features/doctorVisits/types` (Task 1); die Screens `arztbesuche/neu` und `arztbesuche/[id]` aus Task 3 (Navigationsziele).
- Produces (für Task 6): den Übersichts-Screen `arztbesuche/index.tsx`, auf dem Task 6 den PDF-Export-Button ergänzt.

Diese Aufgabe ändert bestehende UI-Dateien (`_layout.tsx`, `tagebuch/index.tsx`) und erstellt neue – nicht automatisiert testbar. Verifikation über `tsc --noEmit` und manuellen Test in Schritt 5.

- [ ] **Step 1: Listen-Komponente erstellen**

Create `colitis-app/src/features/doctorVisits/components/DoctorVisitList.tsx`:

```typescript
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DoctorVisit } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface DoctorVisitListProps {
  visits: DoctorVisit[];
  onEdit: (visitId: number) => void;
  onDelete: (visitId: number) => void;
}

export function DoctorVisitList({ visits, onEdit, onDelete }: DoctorVisitListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (visits.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Noch keine Arztbesuche. Tippe auf „+“, um deinen ersten Besuch anzulegen.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={visits}
      keyExtractor={(visit) => String(visit.id)}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Arztbesuch vom ${item.visitDate} bearbeiten`}
          style={styles.card}
          onPress={() => onEdit(item.id)}
        >
          <Text style={styles.cardDate}>{item.visitDate}</Text>
          {item.doctorName && <Text style={styles.cardDetail}>{item.doctorName}</Text>}
          {item.reason && <Text style={styles.cardDetail}>{item.reason}</Text>}
          {item.nextAppointmentDate && (
            <Text style={styles.cardNextAppointment}>Nächster Termin: {item.nextAppointmentDate}</Text>
          )}
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Arztbesuch vom ${item.visitDate} löschen`}
              style={styles.deleteButton}
              onPress={() => onDelete(item.id)}
            >
              <Text style={styles.deleteButtonText}>Löschen</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: tokens.spacing.lg },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    emptyText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    cardDate: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardDetail: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
    cardNextAppointment: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontStyle: 'italic',
      marginTop: tokens.spacing.xs,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    deleteButton: {
      backgroundColor: colors.danger,
      borderRadius: 8,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    deleteButtonText: { color: colors.surface, fontSize: tokens.typography.fontSize.sm },
  });
}
```

- [ ] **Step 2: Übersichts-Screen erstellen**

Create `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../../src/db/client';
import { listDoctorVisits, deleteDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { DoctorVisitList } from '../../../../src/features/doctorVisits/components/DoctorVisitList';
import { useTheme } from '../../../../src/theme/ThemeContext';
import { tokens } from '../../../../src/styles/tokens';
import type { DoctorVisit } from '../../../../src/features/doctorVisits/types';
import type { ThemeColors } from '../../../../src/theme/types';

export default function ArztbesucheScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [visits, setVisits] = useState<DoctorVisit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDoctorVisits(db))
        .then((loadedVisits) => {
          if (isActive) {
            setVisits(loadedVisits);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Arztbesuche] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Arztbesuche konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  function handleDelete(visitId: number) {
    Alert.alert('Arztbesuch löschen?', 'Dieser Arztbesuch wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void confirmDelete(visitId),
      },
    ]);
  }

  async function confirmDelete(visitId: number) {
    try {
      const db = await createEncryptedDb();
      await deleteDoctorVisit(db, visitId);
      setVisits(await listDoctorVisits(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Arztbesuche] Löschen fehlgeschlagen:', deleteError);
      setError('Arztbesuch konnte nicht gelöscht werden.');
    }
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Arztbesuche werden geladen …</Text>
        </View>
      ) : (
        <DoctorVisitList
          visits={visits}
          onEdit={(visitId) => router.push(`/tagebuch/arztbesuche/${visitId}`)}
          onDelete={handleDelete}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuen Arztbesuch anlegen"
        style={styles.addButton}
        onPress={() => router.push('/tagebuch/arztbesuche/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
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

- [ ] **Step 3: Stack-Screens in `_layout.tsx` ergänzen**

In `colitis-app/app/(tabs)/tagebuch/_layout.tsx`, ändere:

```typescript
      <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
      <Stack.Screen name="neu" options={{ title: 'Neuer Eintrag' }} />
      <Stack.Screen name="auswertung" options={{ title: 'Auswertung' }} />
```

zu:

```typescript
      <Stack.Screen name="index" options={{ title: 'Tagebuch' }} />
      <Stack.Screen name="neu" options={{ title: 'Neuer Eintrag' }} />
      <Stack.Screen name="auswertung" options={{ title: 'Auswertung' }} />
      <Stack.Screen name="arztbesuche/index" options={{ title: 'Arztbesuche' }} />
      <Stack.Screen name="arztbesuche/neu" options={{ title: 'Neuer Arztbesuch' }} />
      <Stack.Screen name="arztbesuche/[id]" options={{ title: 'Arztbesuch bearbeiten' }} />
```

- [ ] **Step 4: Link im Tagebuch-Haupttab ergänzen**

In `colitis-app/app/(tabs)/tagebuch/index.tsx`, ändere den bestehenden Block (direkt nach dem `analysisLink`-Pressable, vor dem PDF-Export-`Pressable`):

```typescript
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
```

zu:

```typescript
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
        accessibilityLabel="Arztbesuche verwalten"
        style={styles.analysisLink}
        onPress={() => router.push('/tagebuch/arztbesuche')}
      >
        <Text style={styles.analysisLinkText}>Arztbesuche verwalten →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || entries.length === 0 }}
```

- [ ] **Step 5: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- Tagebuch-Tab öffnen, "Arztbesuche verwalten →" antippen → leere Liste mit Hinweistext.
- "+" antippen, Formular ausfüllen (nur Datum, dann mit allen Feldern), speichern → erscheint in der Liste, neueste zuerst.
- Eintrag antippen → Bearbeiten-Formular vorausgefüllt, Änderung speichern → Liste aktualisiert.
- Eintrag löschen → Bestätigungsdialog, Eintrag verschwindet.
- Ungültiges Datum eingeben → Fehlermeldung erscheint, Speichern wird verhindert.

- [ ] **Step 6: Commit**

```bash
git add "colitis-app/src/features/doctorVisits/components/DoctorVisitList.tsx" "colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx" "colitis-app/app/(tabs)/tagebuch/_layout.tsx" "colitis-app/app/(tabs)/tagebuch/index.tsx"
git commit -m "feat: Uebersichts-Screen und Navigation fuer Arztbesuche verdrahten"
```

---

### Task 5: PDF-Baufunktion

**Files:**
- Create: `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.ts`
- Test: `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.test.ts`

**Interfaces:**
- Consumes: `DoctorVisit` aus `./types` (Task 1).
- Produces (für Task 6): `export function buildDoctorVisitPassHtml(visits: DoctorVisit[], today: Date): string`

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDoctorVisitPassHtml } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';

const today = new Date(2026, 6, 22);

describe('buildDoctorVisitPassHtml', () => {
  it('shows a hint text when the list is empty', () => {
    const html = buildDoctorVisitPassHtml([], today);
    expect(html).toContain('Keine Arztbesuche erfasst.');
  });

  it('renders the header with the current date', () => {
    const html = buildDoctorVisitPassHtml([], today);
    expect(html).toContain('Arztbesuch-Übersicht');
    expect(html).toContain('22.07.2026');
  });

  it('renders all fields when present', () => {
    const visit: DoctorVisit = {
      id: 1,
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller, Gastroenterologie',
      reason: 'Kontrolle',
      note: 'Blutwerte unauffällig',
      nextAppointmentDate: '2026-10-20',
    };

    const html = buildDoctorVisitPassHtml([visit], today);

    expect(html).toContain('20.07.2026');
    expect(html).toContain('Dr. Müller, Gastroenterologie');
    expect(html).toContain('Kontrolle');
    expect(html).toContain('Blutwerte unauffällig');
    expect(html).toContain('20.10.2026');
  });

  it('omits optional fields when null', () => {
    const visit: DoctorVisit = {
      id: 1,
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    };

    const html = buildDoctorVisitPassHtml([visit], today);

    expect(html).toContain('20.07.2026');
    expect(html).not.toContain('Nächster Termin');
  });

  it('escapes HTML special characters in free-text fields', () => {
    const visit: DoctorVisit = {
      id: 1,
      visitDate: '2026-07-20',
      doctorName: 'Dr. <Müller> & "Team"',
      reason: null,
      note: null,
      nextAppointmentDate: null,
    };

    const html = buildDoctorVisitPassHtml([visit], today);

    expect(html).toContain('Dr. &lt;Müller&gt; &amp; &quot;Team&quot;');
    expect(html).not.toContain('<Müller>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.test.ts`
Expected: FAIL — `doctorVisitPassBuilder.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.ts`:

```typescript
import type { DoctorVisit } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function buildVisitSection(visit: DoctorVisit): string {
  return `
    <section class="visit">
      <h2>${escapeHtml(formatGermanDate(visit.visitDate))}</h2>
      ${visit.doctorName ? `<p>${escapeHtml(visit.doctorName)}</p>` : ''}
      ${visit.reason ? `<p>${escapeHtml(visit.reason)}</p>` : ''}
      ${visit.note ? `<p class="note">${escapeHtml(visit.note)}</p>` : ''}
      ${visit.nextAppointmentDate ? `<p>Nächster Termin: ${escapeHtml(formatGermanDate(visit.nextAppointmentDate))}</p>` : ''}
    </section>
  `;
}

export function buildDoctorVisitPassHtml(visits: DoctorVisit[], today: Date): string {
  const body =
    visits.length > 0 ? visits.map(buildVisitSection).join('\n') : '<p>Keine Arztbesuche erfasst.</p>';

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
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .visit { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .visit h2 { font-size: 14px; margin: 0 0 6px; }
          .visit p { font-size: 12px; margin: 2px 0; }
          .note { font-style: italic; }
        </style>
      </head>
      <body>
        <h1>Arztbesuch-Übersicht</h1>
        <p class="generated">Erstellt am ${day}.${month}.${year}</p>
        ${body}
      </body>
    </html>
  `;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.ts colitis-app/src/features/doctorVisits/doctorVisitPassBuilder.test.ts
git commit -m "feat: HTML-Baufunktion fuer Arztbesuch-Pass ergaenzen"
```

---

### Task 6: PDF-Export-Funktion und Button

**Files:**
- Create: `colitis-app/src/features/doctorVisits/doctorVisitPassExport.ts`
- Modify: `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx`

**Interfaces:**
- Consumes: `buildDoctorVisitPassHtml` aus `./doctorVisitPassBuilder` (Task 5); `DoctorVisit` aus `./types` (Task 1); den Übersichts-Screen aus Task 4.
- Produces: nichts für weitere Tasks — letzte funktionale Aufgabe dieses Plans (Task 7 betrifft nur das Backup-System, unabhängig).

Der Export-Wrapper nutzt native Module (`expo-print`, `expo-sharing`) und hat wie die bestehenden `diaryPdfExport.ts`/`medicationPassExport.ts` bewusst kein Testfile (native Module sind in diesem Projekt nicht gemockt). Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Export-Funktion erstellen**

Create `colitis-app/src/features/doctorVisits/doctorVisitPassExport.ts`:

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildDoctorVisitPassHtml } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';

export async function exportDoctorVisitPass(visits: DoctorVisit[]): Promise<void> {
  const html = buildDoctorVisitPassHtml(visits, new Date());
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
```

- [ ] **Step 2: Export-Button in `arztbesuche/index.tsx` verdrahten**

In `colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx`, ändere die Imports:

```typescript
import { createEncryptedDb } from '../../../../src/db/client';
import { listDoctorVisits, deleteDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { DoctorVisitList } from '../../../../src/features/doctorVisits/components/DoctorVisitList';
```

zu:

```typescript
import { createEncryptedDb } from '../../../../src/db/client';
import { listDoctorVisits, deleteDoctorVisit } from '../../../../src/features/doctorVisits/db/doctorVisitsRepository';
import { exportDoctorVisitPass } from '../../../../src/features/doctorVisits/doctorVisitPassExport';
import { DoctorVisitList } from '../../../../src/features/doctorVisits/components/DoctorVisitList';
```

Ergänze im Komponentenkörper (nach der bestehenden `isLoading`-State-Deklaration) einen neuen State und eine neue Handler-Funktion:

```typescript
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
```

und nach der bestehenden `confirmDelete`-Funktion:

```typescript
  async function handleExportPass() {
    setIsExporting(true);
    try {
      await exportDoctorVisitPass(visits);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Arztbesuche] PDF-Export fehlgeschlagen:', exportError);
      setError('Arztbesuch-Übersicht konnte nicht exportiert werden.');
    } finally {
      setIsExporting(false);
    }
  }
```

Ergänze im JSX (zwischen dem Error-Banner und dem `isLoading`-Bedingungsblock) einen neuen Export-Button:

```typescript
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || visits.length === 0 }}
        accessibilityLabel="Arztbesuch-Übersicht als PDF exportieren"
        disabled={isExporting || visits.length === 0}
        style={[styles.exportLink, (isExporting || visits.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPass}
      >
        <Text style={styles.exportLinkText}>
          {isExporting ? 'PDF wird erstellt …' : 'Arztbesuch-Übersicht als PDF exportieren'}
        </Text>
      </Pressable>
      {isLoading ? (
```

Ergänze in `makeStyles` (nach `errorText`) die passenden Stile:

```typescript
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
```

- [ ] **Step 3: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- Mit leerer Liste: Export-Button deaktiviert.
- Mindestens einen Arztbesuch anlegen: Export-Button aktiv, antippen → PDF wird erzeugt und Teilen-Dialog öffnet sich.
- PDF-Inhalt prüfen: Titel "Arztbesuch-Übersicht", alle erfassten Besuche chronologisch (neueste zuerst), optionale Felder korrekt ein-/ausgeblendet.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/doctorVisits/doctorVisitPassExport.ts "colitis-app/app/(tabs)/tagebuch/arztbesuche/index.tsx"
git commit -m "feat: PDF-Export fuer Arztbesuch-Uebersicht verdrahten"
```

---

### Task 7: Backup-Integration

**Files:**
- Modify: `colitis-app/src/features/backup/types.ts`
- Modify: `colitis-app/src/features/backup/db/backupRepository.ts`
- Modify: `colitis-app/src/features/backup/backupSerializer.ts`
- Modify: `colitis-app/src/features/backup/db/backupRepository.test.ts`
- Modify: `colitis-app/src/features/backup/backupSerializer.test.ts`

**Interfaces:**
- Consumes: `doctorVisits` Tabelle aus `../../db/schema` (Task 1).
- Produces: nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe erweitert ein bestehendes, testabgedecktes System um eine neunte Tabelle. Da `BackupData['tables']` als Objekt-Typ jedes Feld als Pflichtfeld führt, brechen alle bestehenden Test-Literale, die ein vollständiges `tables: {...}`-Objekt konstruieren, ohne die Ergänzung – das ist erwartet und wird in dieser Aufgabe direkt mit behoben (kein separater Nacharbeits-Schritt nötig).

- [ ] **Step 1: `BackupData`-Typ erweitern**

In `colitis-app/src/features/backup/types.ts`, ändere:

```typescript
import type { diaryEntries, knowledgeFavorites, medicationLog, medicationReminderTimes, medications, savedPlaces, screeningReminders, triggers } from '../../db/schema';

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  tables: {
    diaryEntries: (typeof diaryEntries.$inferSelect)[];
    triggers: (typeof triggers.$inferSelect)[];
    medications: (typeof medications.$inferSelect)[];
    medicationLog: (typeof medicationLog.$inferSelect)[];
    medicationReminderTimes: (typeof medicationReminderTimes.$inferSelect)[];
    savedPlaces: (typeof savedPlaces.$inferSelect)[];
    screeningReminders: (typeof screeningReminders.$inferSelect)[];
    knowledgeFavorites: (typeof knowledgeFavorites.$inferSelect)[];
  };
}
```

zu:

```typescript
import type { diaryEntries, doctorVisits, knowledgeFavorites, medicationLog, medicationReminderTimes, medications, savedPlaces, screeningReminders, triggers } from '../../db/schema';

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  tables: {
    diaryEntries: (typeof diaryEntries.$inferSelect)[];
    triggers: (typeof triggers.$inferSelect)[];
    medications: (typeof medications.$inferSelect)[];
    medicationLog: (typeof medicationLog.$inferSelect)[];
    medicationReminderTimes: (typeof medicationReminderTimes.$inferSelect)[];
    savedPlaces: (typeof savedPlaces.$inferSelect)[];
    screeningReminders: (typeof screeningReminders.$inferSelect)[];
    knowledgeFavorites: (typeof knowledgeFavorites.$inferSelect)[];
    doctorVisits: (typeof doctorVisits.$inferSelect)[];
  };
}
```

(Die `BackupEnvelope`-Schnittstelle weiter unten in der Datei bleibt unverändert.)

- [ ] **Step 2: `backupRepository.ts` erweitern**

In `colitis-app/src/features/backup/db/backupRepository.ts`, ändere den Import:

```typescript
import {
  diaryEntries,
  knowledgeFavorites,
  medicationLog,
  medicationReminderTimes,
  medications,
  savedPlaces,
  screeningReminders,
  triggers,
} from '../../../db/schema';
```

zu:

```typescript
import {
  diaryEntries,
  doctorVisits,
  knowledgeFavorites,
  medicationLog,
  medicationReminderTimes,
  medications,
  savedPlaces,
  screeningReminders,
  triggers,
} from '../../../db/schema';
```

In `exportBackupData`, ergänze in `tables: {...}` (nach `knowledgeFavorites`):

```typescript
      knowledgeFavorites: await db.select().from(knowledgeFavorites),
      doctorVisits: await db.select().from(doctorVisits),
```

In `importBackupData`, ergänze im Lösch-Block (nach `tx.delete(knowledgeFavorites).run();`):

```typescript
    tx.delete(knowledgeFavorites).run();
    tx.delete(doctorVisits).run();
```

und im Einfüge-Block (nach der `knowledgeFavorites`-Schleife):

```typescript
    for (const row of data.tables.knowledgeFavorites) {
      tx.insert(knowledgeFavorites).values(row).run();
    }
    for (const row of data.tables.doctorVisits) {
      tx.insert(doctorVisits).values(row).run();
    }
```

- [ ] **Step 3: `backupSerializer.ts` erweitern**

In `colitis-app/src/features/backup/backupSerializer.ts`, ändere `REQUIRED_TABLE_KEYS`:

```typescript
const REQUIRED_TABLE_KEYS = [
  'diaryEntries',
  'triggers',
  'medications',
  'medicationLog',
  'medicationReminderTimes',
  'savedPlaces',
  'screeningReminders',
  'knowledgeFavorites',
] as const;
```

zu:

```typescript
const REQUIRED_TABLE_KEYS = [
  'diaryEntries',
  'triggers',
  'medications',
  'medicationLog',
  'medicationReminderTimes',
  'savedPlaces',
  'screeningReminders',
  'knowledgeFavorites',
  'doctorVisits',
] as const;
```

- [ ] **Step 4: Type-Check nach den Schnittstellen-Änderungen**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Fehler in `backupRepository.test.ts` und `backupSerializer.test.ts` (fehlendes `doctorVisits`-Feld in bestehenden `tables: {...}`-Objekt-Literalen) – das wird in den nächsten beiden Schritten behoben.

- [ ] **Step 5: Bestehende Tests in `backupRepository.test.ts` aktualisieren und einen neuen Test ergänzen**

In `colitis-app/src/features/backup/db/backupRepository.test.ts`, ergänze in **jedem** der sechs bestehenden `tables: {...}`-Objekt-Literale (in den Tests `'exports an empty structure...'`, `'replaces all existing data...'`, `'preserves foreign key relationships...'`, `'clears all data...'`, `'does not violate foreign key constraints...'`, `'exports and re-imports knowledge favorites...'`) nach der Zeile `knowledgeFavorites: [...],` (bzw. ohne Komma, falls letztes Feld vor der schließenden Klammer) die Zeile:

```typescript
        doctorVisits: [],
```

Beispiel für den ersten Test, vorher:

```typescript
  it('exports an empty structure with all eight table keys when nothing exists yet', async () => {
    const data = await exportBackupData(db);
    expect(data.version).toBe(1);
    expect(data.tables).toEqual({
      diaryEntries: [],
      triggers: [],
      medications: [],
      medicationLog: [],
      medicationReminderTimes: [],
      savedPlaces: [],
      screeningReminders: [],
      knowledgeFavorites: [],
    });
  });
```

nachher:

```typescript
  it('exports an empty structure with all nine table keys when nothing exists yet', async () => {
    const data = await exportBackupData(db);
    expect(data.version).toBe(1);
    expect(data.tables).toEqual({
      diaryEntries: [],
      triggers: [],
      medications: [],
      medicationLog: [],
      medicationReminderTimes: [],
      savedPlaces: [],
      screeningReminders: [],
      knowledgeFavorites: [],
      doctorVisits: [],
    });
  });
```

Wende die gleiche Ergänzung (`doctorVisits: [],` nach `knowledgeFavorites: [...],`) in den fünf weiteren Tests an, die jeweils ein `tables: {...}`-Literal enthalten (bei `'exports and re-imports knowledge favorites...'` steht `knowledgeFavorites: [{ id: 3, articleSlug: 'ueberblick' }],` — danach `doctorVisits: [],` ergänzen).

Ergänze außerdem am Ende der Datei (vor der letzten schließenden `});` des `describe`-Blocks) einen neuen Test:

```typescript

  it('exports and re-imports doctor visits, preserving original ids', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-22T09:00:00.000Z',
      tables: {
        diaryEntries: [],
        triggers: [],
        medications: [],
        medicationLog: [],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
        knowledgeFavorites: [],
        doctorVisits: [
          {
            id: 5,
            visitDate: '2026-07-20',
            doctorName: 'Dr. Müller',
            reason: 'Kontrolle',
            note: null,
            nextAppointmentDate: null,
          },
        ],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.doctorVisits).toEqual(importedData.tables.doctorVisits);
  });
```

- [ ] **Step 6: Bestehende Tests in `backupSerializer.test.ts` aktualisieren und einen neuen Test ergänzen**

In `colitis-app/src/features/backup/backupSerializer.test.ts`, ändere `sampleData`:

```typescript
const sampleData: BackupData = {
  version: 1,
  exportedAt: '2026-07-14T10:00:00.000Z',
  tables: {
    diaryEntries: [],
    triggers: [],
    medications: [],
    medicationLog: [],
    medicationReminderTimes: [],
    savedPlaces: [],
    screeningReminders: [],
    knowledgeFavorites: [],
  },
};
```

zu:

```typescript
const sampleData: BackupData = {
  version: 1,
  exportedAt: '2026-07-14T10:00:00.000Z',
  tables: {
    diaryEntries: [],
    triggers: [],
    medications: [],
    medicationLog: [],
    medicationReminderTimes: [],
    savedPlaces: [],
    screeningReminders: [],
    knowledgeFavorites: [],
    doctorVisits: [],
  },
};
```

Ergänze am Ende der Datei (vor der letzten schließenden `});` des `describe`-Blocks) einen neuen Test:

```typescript

  it('throws a German error when the doctorVisits table key is missing', () => {
    const broken = JSON.parse(serializeBackupData(sampleData));
    delete broken.tables.doctorVisits;
    expect(() => parseBackupData(JSON.stringify(broken))).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });
```

- [ ] **Step 7: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle Tests grün, keine Typfehler.

- [ ] **Step 8: Commit**

```bash
git add colitis-app/src/features/backup/types.ts colitis-app/src/features/backup/db/backupRepository.ts colitis-app/src/features/backup/backupSerializer.ts colitis-app/src/features/backup/db/backupRepository.test.ts colitis-app/src/features/backup/backupSerializer.test.ts
git commit -m "feat: Arztbesuch-Uebersicht ins Backup/Restore-System aufnehmen"
```
