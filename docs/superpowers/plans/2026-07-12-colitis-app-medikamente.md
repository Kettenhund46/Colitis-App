# Eigene Medikamentenliste & Erinnerungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adrian kann seine eigenen Medikamente verwalten, Einnahmen tracken und bekommt lokale Erinnerungen dafür sowie für die fällige Vorsorge-Koloskopie — als neuer 5. Tab "Medikamente".

**Architecture:** Neues Feature-Modul `src/features/medications/` (Domain-Typen, reine Berechnungslogik, Repository, Notification-Service, Komponenten), verdrahtet über einen neuen Tab mit drei Screens (Liste, Anlegen, Bearbeiten). Erinnerungen laufen über `expo-notifications` (neue Abhängigkeit), rein lokal geplant, kein Server.

**Tech Stack:** TypeScript, React Native/Expo Router, Drizzle ORM, Vitest, better-sqlite3 (Tests), expo-notifications (neu, via `npx expo install`).

## Global Constraints

- Alle Daten bleiben 100% lokal (verschlüsselte SQLite-DB), keine Cloud-/Server-Push-Infrastruktur — nur lokal auf dem Gerät geplante Benachrichtigungen.
- UI-Sprache: Deutsch, durchgehend.
- Design-Ton: ruhig/warm — ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts`, kein zusätzliches hartkodiertes Rot/Alarmfarben (bestehendes `tokens.colors.danger` ist die einzige Warnfarbe und bleibt es).
- `medications.schedule` bleibt unverändertes Freitextfeld für die Anzeige; echte Erinnerungszeiten kommen ausschließlich aus der neuen Tabelle `medication_reminder_times`.
- Kein hartes Löschen von Medikamenten — nur "Beenden" über `endDate` (Fremdschlüssel-Historie in `medication_log` bleibt erhalten).
- Vorsorge-Intervall wird von Adrian manuell eingetragen, keine automatische Ableitung aus Krankheitsdauer/-ausdehnung.
- Kein Interaktions-Button direkt in der Push-Benachrichtigung; Einnahme-Tracking läuft über einen "Heute genommen"-Button in der Medikamenten-Liste.
- Berechtigung für Benachrichtigungen wird lazy angefragt (beim Speichern einer ersten Erinnerungszeit/des Vorsorge-Termins), nicht global beim App-Start. Bei Ablehnung: Zeiten werden trotzdem gespeichert/angezeigt, nur ohne echte Push — dazu ein statischer Hinweistext im Formular (keine zusätzliche Fehlerbehandlung nötig, siehe Task 4).
- React Native lässt sich unter dem aktuellen Test-Runner (Vitest) nicht parsen/rendern (bestätigte Einschränkung aus Schritt 2/3/4) — Component-/Screen-Tests entfallen, dafür wird jede reine Logik-Schicht (Trigger-Berechnung, Formular-Validierung, Aktiv-Status, Notification-Service mit gemocktem `expo-notifications`) vollständig automatisiert getestet.
- Der Notification-Service wird nach demselben Muster wie `src/lib/encryption.ts` getestet: das native Modul (`expo-notifications`) wird mit `vi.mock` ersetzt, die Aufruf-Logik (welche Werte an welche Funktion übergeben werden) wird vollständig geprüft. Nur das tatsächliche Anzeigen einer Benachrichtigung auf einem echten Gerät bleibt ungeprüft (Alltagstest, Schritt 8).
- `AGENTS.md` im Projekt weist darauf hin, dass sich Expo zwischen Versionen stark verändert hat — die exakten `expo-notifications`-API-Signaturen (Trigger-Typen, Berechtigungs-Funktion, Handler-Shape) sind für SDK 57 bereits unten im Plan verifiziert und verbindlich zu verwenden; nicht durch ältere API-Varianten aus dem Training ersetzen.

---

### Task 1: Domain-Typen + reine Logik (Auslösezeitpunkt-Berechnung, Aktiv-Status)

**Files:**
- Create: `colitis-app/src/features/medications/types.ts`
- Create: `colitis-app/src/features/medications/reminderScheduling.ts`
- Test: `colitis-app/src/features/medications/reminderScheduling.test.ts`
- Create: `colitis-app/src/features/medications/medicationStatus.ts`
- Test: `colitis-app/src/features/medications/medicationStatus.test.ts`

**Interfaces:**
- Consumes: nichts (reine Domain-Typen und framework-freie Logik).
- Produces: `MedicationReminderTime`, `Medication`, `MedicationInput`, `ScreeningReminder`, `NewScreeningReminderInput` (alle in `types.ts`); `DailyTrigger`, `DateTrigger`, `isValidReminderTime(time: string): boolean`, `buildDailyReminderTrigger(time: string): DailyTrigger`, `buildScreeningReminderTrigger(nextDueDate: string, now: Date): DateTrigger | null` (in `reminderScheduling.ts`); `isMedicationActive(endDate: string | null, today: Date): boolean` (in `medicationStatus.ts`). Werden von Task 2 (Repository-Typen), Task 3 (Notification-Service) und Task 4 (Formular-Logik, Komponenten) verwendet.

- [ ] **Step 1: `types.ts` anlegen (keine Tests nötig — reine Typdeklarationen)**

Create `colitis-app/src/features/medications/types.ts`:

```typescript
export interface MedicationReminderTime {
  id: number;
  time: string;
  notificationId: string | null;
}

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

export interface ScreeningReminder {
  id: number;
  intervalMonths: number;
  nextDueDate: string;
  note: string | null;
  notificationId: string | null;
}

export interface NewScreeningReminderInput {
  intervalMonths: number;
  nextDueDate: string;
  note: string | null;
}
```

- [ ] **Step 2: Write the failing tests for `reminderScheduling.ts`**

Create `colitis-app/src/features/medications/reminderScheduling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isValidReminderTime, buildDailyReminderTrigger, buildScreeningReminderTrigger } from './reminderScheduling';

describe('isValidReminderTime', () => {
  it('accepts valid HH:mm times', () => {
    expect(isValidReminderTime('08:00')).toBe(true);
    expect(isValidReminderTime('23:59')).toBe(true);
    expect(isValidReminderTime('00:00')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidReminderTime('8:00')).toBe(false);
    expect(isValidReminderTime('24:00')).toBe(false);
    expect(isValidReminderTime('12:60')).toBe(false);
    expect(isValidReminderTime('abc')).toBe(false);
  });
});

describe('buildDailyReminderTrigger', () => {
  it('parses a valid time into hour and minute', () => {
    expect(buildDailyReminderTrigger('08:30')).toEqual({ type: 'daily', hour: 8, minute: 30 });
  });

  it('throws on an invalid time', () => {
    expect(() => buildDailyReminderTrigger('25:00')).toThrow('Ungültige Erinnerungszeit');
  });
});

describe('buildScreeningReminderTrigger', () => {
  it('returns a date trigger for a future due date', () => {
    const now = new Date(2026, 0, 1, 8, 0, 0, 0);
    const trigger = buildScreeningReminderTrigger('2026-06-01', now);
    expect(trigger).toEqual({ type: 'date', date: new Date(2026, 5, 1, 9, 0, 0, 0) });
  });

  it('returns null when the due date has already passed', () => {
    const now = new Date(2026, 6, 1, 8, 0, 0, 0);
    expect(buildScreeningReminderTrigger('2026-06-01', now)).toBeNull();
  });

  it('returns null when the due date is today but the reminder time has already passed', () => {
    const now = new Date(2026, 5, 1, 10, 0, 0, 0);
    expect(buildScreeningReminderTrigger('2026-06-01', now)).toBeNull();
  });

  it('returns a date trigger when the due date is today and the reminder time has not passed yet', () => {
    const now = new Date(2026, 5, 1, 7, 0, 0, 0);
    expect(buildScreeningReminderTrigger('2026-06-01', now)).toEqual({
      type: 'date',
      date: new Date(2026, 5, 1, 9, 0, 0, 0),
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/medications/reminderScheduling.test.ts`
Expected: FAIL with "Cannot find module './reminderScheduling'" (module does not exist yet)

- [ ] **Step 4: Write the implementation**

Create `colitis-app/src/features/medications/reminderScheduling.ts`:

```typescript
export interface DailyTrigger {
  type: 'daily';
  hour: number;
  minute: number;
}

export interface DateTrigger {
  type: 'date';
  date: Date;
}

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
const SCREENING_REMINDER_HOUR = 9;
const SCREENING_REMINDER_MINUTE = 0;

export function isValidReminderTime(time: string): boolean {
  return REMINDER_TIME_PATTERN.test(time);
}

export function buildDailyReminderTrigger(time: string): DailyTrigger {
  const match = REMINDER_TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm)`);
  }
  return { type: 'daily', hour: Number(match[1]), minute: Number(match[2]) };
}

export function buildScreeningReminderTrigger(nextDueDate: string, now: Date): DateTrigger | null {
  const [year, month, day] = nextDueDate.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day, SCREENING_REMINDER_HOUR, SCREENING_REMINDER_MINUTE, 0, 0);
  if (dueDate.getTime() <= now.getTime()) {
    return null;
  }
  return { type: 'date', date: dueDate };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/medications/reminderScheduling.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Write the failing tests for `medicationStatus.ts`**

Create `colitis-app/src/features/medications/medicationStatus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isMedicationActive } from './medicationStatus';

describe('isMedicationActive', () => {
  const today = new Date(2026, 6, 12);

  it('is active when there is no end date', () => {
    expect(isMedicationActive(null, today)).toBe(true);
  });

  it('is active when the end date is today', () => {
    expect(isMedicationActive('2026-07-12', today)).toBe(true);
  });

  it('is active when the end date is in the future', () => {
    expect(isMedicationActive('2026-08-01', today)).toBe(true);
  });

  it('is inactive when the end date is in the past', () => {
    expect(isMedicationActive('2026-07-01', today)).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/features/medications/medicationStatus.test.ts`
Expected: FAIL with "Cannot find module './medicationStatus'" (module does not exist yet)

- [ ] **Step 8: Write the implementation**

Create `colitis-app/src/features/medications/medicationStatus.ts`:

```typescript
export function isMedicationActive(endDate: string | null, today: Date): boolean {
  if (endDate === null) {
    return true;
  }
  const todayDateOnly = today.toISOString().slice(0, 10);
  return endDate >= todayDateOnly;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/features/medications/medicationStatus.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 10: Commit**

```bash
git add src/features/medications/types.ts src/features/medications/reminderScheduling.ts src/features/medications/reminderScheduling.test.ts src/features/medications/medicationStatus.ts src/features/medications/medicationStatus.test.ts
git commit -m "feat: Domain-Typen und reine Erinnerungslogik fuer Medikamente"
```

---

### Task 2: Schema-Migration + Repository (Medikamente, Erinnerungszeiten, Einnahme-Log, Vorsorge-Reminder)

**Files:**
- Modify: `colitis-app/src/db/schema.ts`
- Modify: `colitis-app/src/db/schema.test.ts`
- Create: `colitis-app/drizzle/0001_<generierter-name>.sql` (automatisch von `drizzle-kit generate`)
- Create: `colitis-app/src/features/medications/db/testDb.ts`
- Create: `colitis-app/src/features/medications/db/medicationsRepository.ts`
- Test: `colitis-app/src/features/medications/db/medicationsRepository.test.ts`
- Create: `colitis-app/src/features/medications/db/screeningRepository.ts`
- Test: `colitis-app/src/features/medications/db/screeningRepository.test.ts`

**Interfaces:**
- Consumes: `Medication`, `MedicationInput`, `MedicationReminderTime`, `ScreeningReminder`, `NewScreeningReminderInput` aus Task 1 (`../types`).
- Produces (`medicationsRepository.ts`): `MedicationsDb` type; `createMedication(db, input: MedicationInput): Promise<Medication>`; `listMedications(db): Promise<Medication[]>`; `getMedicationById(db, medicationId: number): Promise<Medication | null>`; `updateMedication(db, medicationId: number, input: MedicationInput): Promise<{removed: MedicationReminderTime[], inserted: MedicationReminderTime[]}>`; `endMedication(db, medicationId: number, endDate: string): Promise<MedicationReminderTime[]>`; `setReminderTimeNotificationId(db, reminderTimeId: number, notificationId: string | null): Promise<void>`; `logMedicationTaken(db, medicationId: number, takenAt: string): Promise<void>`.
- Produces (`screeningRepository.ts`): `ScreeningDb` type; `getScreeningReminder(db): Promise<ScreeningReminder | null>`; `upsertScreeningReminder(db, input: NewScreeningReminderInput): Promise<{previous: ScreeningReminder | null, current: ScreeningReminder}>`; `setScreeningReminderNotificationId(db, id: number, notificationId: string | null): Promise<void>`.
- Alle Funktionen werden von Task 5 (Screens) konsumiert; die Notification-Auslösung selbst gehört nicht hierher (siehe Task 3), die Screens (Task 5) orchestrieren Repository- und Notification-Aufrufe gemeinsam.

- [ ] **Step 1: Schema erweitern**

Modify `colitis-app/src/db/schema.ts` — nach dem bestehenden `medicationLog`-Block (Zeile 34-40) einfügen:

```typescript
export const medicationReminderTimes = sqliteTable('medication_reminder_times', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicationId: integer('medication_id')
    .notNull()
    .references(() => medications.id),
  time: text('time').notNull(),
  notificationId: text('notification_id'),
});
```

Und den bestehenden `screeningReminders`-Block (Zeile 59-64) ersetzen durch:

```typescript
export const screeningReminders = sqliteTable('screening_reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  intervalMonths: integer('interval_months').notNull(),
  nextDueDate: text('next_due_date').notNull(),
  note: text('note'),
  notificationId: text('notification_id'),
});
```

- [ ] **Step 2: Migration generieren**

Run: `cd colitis-app && npx drizzle-kit generate`
Expected: Neue Datei `drizzle/0001_<zwei-zufaellige-woerter>.sql` wird erstellt (enthält `CREATE TABLE medication_reminder_times` und `ALTER TABLE screening_reminders ADD COLUMN notification_id text`), zusätzlich `drizzle/meta/0001_snapshot.json`; `drizzle/meta/_journal.json` bekommt einen zweiten Eintrag, `drizzle/migrations.js` wird aktualisiert.

- [ ] **Step 3: `schema.test.ts` um die neue Tabelle ergänzen**

Modify `colitis-app/src/db/schema.test.ts` — im ersten Test (Zeile 6-16) `'medicationReminderTimes'` zur erwarteten Liste hinzufügen:

```typescript
  it('defines all seven core tables from the design spec', () => {
    expect(Object.keys(schema)).toEqual(
      expect.arrayContaining([
        'diaryEntries',
        'triggers',
        'medications',
        'medicationLog',
        'medicationReminderTimes',
        'savedPlaces',
        'knowledgeContent',
        'screeningReminders',
      ])
    );
  });
```

Und am Ende der Datei (nach dem letzten `it`-Block, vor der letzten schließenden Klammer der äußeren `describe`) einen neuen Test ergänzen:

```typescript
  it('medicationReminderTimes references a medication via medicationId', () => {
    const columns = Object.keys(schema.medicationReminderTimes);
    expect(columns).toContain('medicationId');
  });

  it('screeningReminders has a notificationId column for cancelling scheduled reminders', () => {
    const columns = Object.keys(schema.screeningReminders);
    expect(columns).toContain('notificationId');
  });
```

- [ ] **Step 4: Schema-Tests laufen lassen**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS (alle Tests, inkl. der beiden neuen)

- [ ] **Step 5: Gemeinsamen Test-DB-Helper anlegen**

Create `colitis-app/src/features/medications/db/testDb.ts`:

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

Diese Variante liest (anders als `diaryRepository.test.ts`/`knowledgeRepository.test.ts`, die nur die eine feste Datei `0000_remarkable_junta.sql` lesen) alle `.sql`-Dateien im `drizzle/`-Ordner sortiert ein — nötig, weil dieses Feature als erstes eine zweite Migration (`0001_...`) einführt und der generierte Dateiname vorab nicht bekannt ist.

- [ ] **Step 6: Write the failing tests for `medicationsRepository.ts`**

Create `colitis-app/src/features/medications/db/medicationsRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  createMedication,
  listMedications,
  getMedicationById,
  updateMedication,
  endMedication,
  setReminderTimeNotificationId,
  logMedicationTaken,
} from './medicationsRepository';
import { medicationLog } from '../../../db/schema';

describe('medications repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a medication with its reminder times', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich morgens',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00'],
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('Salofalk');
    expect(created.reminderTimes).toHaveLength(1);
    expect(created.reminderTimes[0].time).toBe('08:00');
    expect(created.reminderTimes[0].notificationId).toBeNull();
  });

  it('lists medications ordered by name, with their reminder times', async () => {
    await createMedication(db, {
      name: 'Tremfya',
      dose: '100mg',
      schedule: 'alle 8 Wochen',
      startDate: '2026-01-01',
      endDate: null,
      reminderTimes: [],
    });
    await createMedication(db, {
      name: 'Azathioprin',
      dose: '50mg',
      schedule: '1x täglich abends',
      startDate: '2026-01-01',
      endDate: null,
      reminderTimes: ['21:00'],
    });

    const list = await listMedications(db);

    expect(list.map((medication) => medication.name)).toEqual(['Azathioprin', 'Tremfya']);
    expect(list[0].reminderTimes.map((reminderTime) => reminderTime.time)).toEqual(['21:00']);
  });

  it('gets a single medication by id', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: [],
    });

    const found = await getMedicationById(db, created.id);
    expect(found?.name).toBe('Salofalk');

    const notFound = await getMedicationById(db, created.id + 999);
    expect(notFound).toBeNull();
  });

  it('replaces reminder times on update and reports removed/inserted rows', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00'],
    });

    const { removed, inserted } = await updateMedication(db, created.id, {
      name: 'Salofalk',
      dose: '1000mg',
      schedule: '2x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00', '20:00'],
    });

    expect(removed).toHaveLength(1);
    expect(removed[0].time).toBe('08:00');
    expect(inserted.map((reminderTime) => reminderTime.time)).toEqual(['08:00', '20:00']);

    const updated = await getMedicationById(db, created.id);
    expect(updated?.dose).toBe('1000mg');
    expect(updated?.reminderTimes).toHaveLength(2);
  });

  it('ends a medication and returns its current reminder times', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00'],
    });

    const reminderTimes = await endMedication(db, created.id, '2026-08-01');

    expect(reminderTimes).toHaveLength(1);
    const ended = await getMedicationById(db, created.id);
    expect(ended?.endDate).toBe('2026-08-01');
  });

  it('persists a notification id for a reminder time', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: ['08:00'],
    });

    await setReminderTimeNotificationId(db, created.reminderTimes[0].id, 'notif-abc');

    const found = await getMedicationById(db, created.id);
    expect(found?.reminderTimes[0].notificationId).toBe('notif-abc');
  });

  it('logs a medication as taken', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      reminderTimes: [],
    });

    await logMedicationTaken(db, created.id, '2026-07-12T08:05:00.000Z');

    const rows = await db.select().from(medicationLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].medicationId).toBe(created.id);
    expect(rows[0].takenAt).toBe('2026-07-12T08:05:00.000Z');
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx vitest run src/features/medications/db/medicationsRepository.test.ts`
Expected: FAIL with "Cannot find module './medicationsRepository'" (module does not exist yet)

- [ ] **Step 8: Write the implementation**

Create `colitis-app/src/features/medications/db/medicationsRepository.ts`:

```typescript
import { asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { medications, medicationReminderTimes, medicationLog } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Medication, MedicationInput, MedicationReminderTime } from '../types';

export type MedicationsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

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

async function insertReminderTimes(
  db: MedicationsDb,
  medicationId: number,
  times: string[]
): Promise<MedicationReminderTime[]> {
  const result: MedicationReminderTime[] = [];
  for (const time of times) {
    const [inserted] = await db
      .insert(medicationReminderTimes)
      .values({ medicationId, time, notificationId: null })
      .returning({ id: medicationReminderTimes.id });
    result.push({ id: inserted.id, time, notificationId: null });
  }
  return result;
}

async function loadReminderTimes(db: MedicationsDb, medicationId: number): Promise<MedicationReminderTime[]> {
  const rows = await db
    .select()
    .from(medicationReminderTimes)
    .where(eq(medicationReminderTimes.medicationId, medicationId));
  return rows.map((row) => ({ id: row.id, time: row.time, notificationId: row.notificationId }));
}

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

export interface ReminderTimesReplaceResult {
  removed: MedicationReminderTime[];
  inserted: MedicationReminderTime[];
}

export async function updateMedication(
  db: MedicationsDb,
  medicationId: number,
  input: MedicationInput
): Promise<ReminderTimesReplaceResult> {
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

  const removed = await loadReminderTimes(db, medicationId);

  await db.delete(medicationReminderTimes).where(eq(medicationReminderTimes.medicationId, medicationId));

  const inserted = await insertReminderTimes(db, medicationId, input.reminderTimes);

  return { removed, inserted };
}

export async function endMedication(
  db: MedicationsDb,
  medicationId: number,
  endDate: string
): Promise<MedicationReminderTime[]> {
  await db.update(medications).set({ endDate }).where(eq(medications.id, medicationId));
  return loadReminderTimes(db, medicationId);
}

export async function setReminderTimeNotificationId(
  db: MedicationsDb,
  reminderTimeId: number,
  notificationId: string | null
): Promise<void> {
  await db
    .update(medicationReminderTimes)
    .set({ notificationId })
    .where(eq(medicationReminderTimes.id, reminderTimeId));
}

export async function logMedicationTaken(db: MedicationsDb, medicationId: number, takenAt: string): Promise<void> {
  await db.insert(medicationLog).values({ medicationId, takenAt });
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/features/medications/db/medicationsRepository.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 10: Write the failing tests for `screeningRepository.ts`**

Create `colitis-app/src/features/medications/db/screeningRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
} from './screeningRepository';

describe('screening repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns null when no screening reminder exists yet', async () => {
    expect(await getScreeningReminder(db)).toBeNull();
  });

  it('inserts a new screening reminder when none exists', async () => {
    const { previous, current } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });

    expect(previous).toBeNull();
    expect(current.id).toBeGreaterThan(0);
    expect(current.intervalMonths).toBe(12);
    expect(current.nextDueDate).toBe('2027-01-15');
    expect(current.notificationId).toBeNull();
  });

  it('updates the existing screening reminder and returns the previous values', async () => {
    const { current: first } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });
    await setScreeningReminderNotificationId(db, first.id, 'notif-old');

    const { previous, current } = await upsertScreeningReminder(db, {
      intervalMonths: 24,
      nextDueDate: '2028-03-01',
      note: 'Nach Rücksprache verschoben',
    });

    expect(previous?.id).toBe(first.id);
    expect(previous?.notificationId).toBe('notif-old');
    expect(current.id).toBe(first.id);
    expect(current.intervalMonths).toBe(24);
    expect(current.nextDueDate).toBe('2028-03-01');

    const reloaded = await getScreeningReminder(db);
    expect(reloaded?.nextDueDate).toBe('2028-03-01');
    expect(reloaded?.note).toBe('Nach Rücksprache verschoben');
  });

  it('persists a notification id', async () => {
    const { current } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });

    await setScreeningReminderNotificationId(db, current.id, 'notif-xyz');

    const reloaded = await getScreeningReminder(db);
    expect(reloaded?.notificationId).toBe('notif-xyz');
  });
});
```

- [ ] **Step 11: Run tests to verify they fail**

Run: `npx vitest run src/features/medications/db/screeningRepository.test.ts`
Expected: FAIL with "Cannot find module './screeningRepository'" (module does not exist yet)

- [ ] **Step 12: Write the implementation**

Create `colitis-app/src/features/medications/db/screeningRepository.ts`:

```typescript
import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { screeningReminders } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { ScreeningReminder, NewScreeningReminderInput } from '../types';

export type ScreeningDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function getScreeningReminder(db: ScreeningDb): Promise<ScreeningReminder | null> {
  const rows = await db.select().from(screeningReminders);
  if (rows.length === 0) {
    return null;
  }
  return rowToScreeningReminder(rows[0]);
}

export interface ScreeningReminderUpsertResult {
  previous: ScreeningReminder | null;
  current: ScreeningReminder;
}

export async function upsertScreeningReminder(
  db: ScreeningDb,
  input: NewScreeningReminderInput
): Promise<ScreeningReminderUpsertResult> {
  const existing = await getScreeningReminder(db);

  if (existing === null) {
    const [inserted] = await db
      .insert(screeningReminders)
      .values({
        intervalMonths: input.intervalMonths,
        nextDueDate: input.nextDueDate,
        note: input.note,
        notificationId: null,
      })
      .returning({ id: screeningReminders.id });

    return {
      previous: null,
      current: {
        id: inserted.id,
        intervalMonths: input.intervalMonths,
        nextDueDate: input.nextDueDate,
        note: input.note,
        notificationId: null,
      },
    };
  }

  await db
    .update(screeningReminders)
    .set({
      intervalMonths: input.intervalMonths,
      nextDueDate: input.nextDueDate,
      note: input.note,
    })
    .where(eq(screeningReminders.id, existing.id));

  return {
    previous: existing,
    current: {
      id: existing.id,
      intervalMonths: input.intervalMonths,
      nextDueDate: input.nextDueDate,
      note: input.note,
      notificationId: existing.notificationId,
    },
  };
}

export async function setScreeningReminderNotificationId(
  db: ScreeningDb,
  id: number,
  notificationId: string | null
): Promise<void> {
  await db.update(screeningReminders).set({ notificationId }).where(eq(screeningReminders.id, id));
}

function rowToScreeningReminder(row: typeof screeningReminders.$inferSelect): ScreeningReminder {
  return {
    id: row.id,
    intervalMonths: row.intervalMonths,
    nextDueDate: row.nextDueDate,
    note: row.note,
    notificationId: row.notificationId,
  };
}
```

- [ ] **Step 13: Run tests to verify they pass**

Run: `npx vitest run src/features/medications/db/screeningRepository.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 14: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler

- [ ] **Step 15: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts drizzle/ src/features/medications/db/
git commit -m "feat: Schema-Migration und Repository fuer Medikamente, Erinnerungszeiten und Vorsorge-Reminder"
```

---

### Task 3: Notification-Service (`expo-notifications`)

**Files:**
- Modify: `colitis-app/package.json` (via `npx expo install`)
- Modify: `colitis-app/app.json`
- Create: `colitis-app/src/features/medications/notifications/notificationService.ts`
- Test: `colitis-app/src/features/medications/notifications/notificationService.test.ts`

**Interfaces:**
- Consumes: `buildDailyReminderTrigger`, `buildScreeningReminderTrigger` aus Task 1 (`../reminderScheduling`).
- Produces: `ReminderContent` type; `configureNotificationHandling(): void`; `requestNotificationPermission(): Promise<boolean>`; `scheduleDailyReminder(time: string, content: ReminderContent): Promise<string>`; `scheduleScreeningReminder(nextDueDate: string, content: ReminderContent, now?: Date): Promise<string | null>`; `cancelScheduledReminder(notificationId: string): Promise<void>`. Werden ausschließlich von den Screens in Task 5 aufgerufen — nicht vom Repository (Container/Presentational-Trennung: Notification-Aufrufe gehören in die Route-Dateien).

- [ ] **Step 1: `expo-notifications` installieren**

Run: `cd colitis-app && npx expo install expo-notifications`
Expected: `package.json` bekommt einen neuen Eintrag `"expo-notifications": "~<von Expo für SDK 57 aufgelöste Version>"`, `node_modules/expo-notifications` wird installiert.

- [ ] **Step 2: Config-Plugin eintragen**

Modify `colitis-app/app.json` — im `plugins`-Array nach `"expo-secure-store"` ergänzen:

```json
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ],
      "expo-secure-store",
      "expo-notifications"
    ],
```

- [ ] **Step 3: Write the failing tests**

Create `colitis-app/src/features/medications/notifications/notificationService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const scheduleNotificationAsync = vi.fn(() => Promise.resolve('notif-id-123'));
const cancelScheduledNotificationAsync = vi.fn(() => Promise.resolve());
const requestPermissionsAsync = vi.fn(() => Promise.resolve({ status: 'granted' }));
const setNotificationHandler = vi.fn();

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => scheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => cancelScheduledNotificationAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  setNotificationHandler: (...args: unknown[]) => setNotificationHandler(...args),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

import {
  configureNotificationHandling,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
  cancelScheduledReminder,
} from './notificationService';

beforeEach(() => {
  vi.clearAllMocks();
  scheduleNotificationAsync.mockResolvedValue('notif-id-123');
});

describe('configureNotificationHandling', () => {
  it('registers a handler that shows banners and plays sound in the foreground', async () => {
    configureNotificationHandling();

    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
    const handlerArg = setNotificationHandler.mock.calls[0][0] as {
      handleNotification: () => Promise<Record<string, boolean>>;
    };
    const behavior = await handlerArg.handleNotification();
    expect(behavior).toEqual({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });
});

describe('requestNotificationPermission', () => {
  it('returns true when permission is granted', async () => {
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    expect(await requestNotificationPermission()).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await requestNotificationPermission()).toBe(false);
  });
});

describe('scheduleDailyReminder', () => {
  it('schedules a daily trigger at the parsed hour/minute and returns the identifier', async () => {
    const id = await scheduleDailyReminder('08:30', { title: 'Medikament', body: 'Zeit für Salofalk' });

    expect(id).toBe('notif-id-123');
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Medikament', body: 'Zeit für Salofalk' },
      trigger: { type: 'daily', hour: 8, minute: 30 },
    });
  });
});

describe('scheduleScreeningReminder', () => {
  it('schedules a date trigger and returns the identifier when the date is in the future', async () => {
    const now = new Date(2026, 0, 1, 8, 0, 0, 0);
    const id = await scheduleScreeningReminder('2026-06-01', { title: 'Vorsorge', body: 'Koloskopie fällig' }, now);

    expect(id).toBe('notif-id-123');
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Vorsorge', body: 'Koloskopie fällig' },
      trigger: { type: 'date', date: new Date(2026, 5, 1, 9, 0, 0, 0) },
    });
  });

  it('does not schedule and returns null when the due date has already passed', async () => {
    const now = new Date(2026, 6, 1, 8, 0, 0, 0);
    const id = await scheduleScreeningReminder('2026-06-01', { title: 'Vorsorge', body: 'Koloskopie fällig' }, now);

    expect(id).toBeNull();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelScheduledReminder', () => {
  it('cancels the given notification id', async () => {
    await cancelScheduledReminder('notif-id-123');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id-123');
  });

  it('logs and does not throw when cancellation fails', async () => {
    cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('not found'));
    await expect(cancelScheduledReminder('unknown-id')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/features/medications/notifications/notificationService.test.ts`
Expected: FAIL with "Cannot find module './notificationService'" (module does not exist yet)

- [ ] **Step 5: Write the implementation**

Create `colitis-app/src/features/medications/notifications/notificationService.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import { buildDailyReminderTrigger, buildScreeningReminderTrigger } from '../reminderScheduling';

export interface ReminderContent {
  title: string;
  body: string;
}

export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(time: string, content: ReminderContent): Promise<string> {
  const { hour, minute } = buildDailyReminderTrigger(time);
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export async function scheduleScreeningReminder(
  nextDueDate: string,
  content: ReminderContent,
  now: Date = new Date()
): Promise<string | null> {
  const trigger = buildScreeningReminderTrigger(nextDueDate, now);
  if (trigger === null) {
    return null;
  }
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.date },
  });
}

export async function cancelScheduledReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error: unknown) {
    console.error('[Medikamente] Erinnerung konnte nicht storniert werden:', error);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/medications/notifications/notificationService.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 7: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json app.json src/features/medications/notifications/
git commit -m "feat: Notification-Service fuer lokale Medikamenten- und Vorsorge-Erinnerungen"
```

---

### Task 4: Formular-Logik + UI-Komponenten

**Files:**
- Create: `colitis-app/src/features/medications/formLogic.ts`
- Test: `colitis-app/src/features/medications/formLogic.test.ts`
- Create: `colitis-app/src/features/medications/components/MedicationList.tsx`
- Create: `colitis-app/src/features/medications/components/MedicationForm.tsx`
- Create: `colitis-app/src/features/medications/components/ScreeningReminderCard.tsx`

**Interfaces:**
- Consumes: `Medication`, `MedicationInput`, `ScreeningReminder`, `NewScreeningReminderInput` aus Task 1 (`../types`); `isMedicationActive` aus Task 1 (`../medicationStatus`); `tokens` aus `src/styles/tokens.ts`.
- Produces: `MedicationFormState`, `INITIAL_MEDICATION_FORM_STATE`, `validateMedicationForm(state): string[]`, `buildMedicationInput(state): MedicationInput`, `addReminderTime(times, time): string[]`, `removeReminderTime(times, index): string[]` (in `formLogic.ts`); `MedicationList`, `MedicationForm`, `ScreeningReminderCard` React-Komponenten (Props siehe unten). Werden von Task 5 (Screens) importiert und mit echten Daten befüllt.
- Component-Tests entfallen (bestätigte Vitest/React-Native-Einschränkung) — nur `formLogic.ts` wird automatisiert getestet.

- [ ] **Step 1: Write the failing tests for `formLogic.ts`**

Create `colitis-app/src/features/medications/formLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  INITIAL_MEDICATION_FORM_STATE,
  validateMedicationForm,
  buildMedicationInput,
  addReminderTime,
  removeReminderTime,
} from './formLogic';

describe('validateMedicationForm', () => {
  it('requires name, dose and schedule', () => {
    const errors = validateMedicationForm(INITIAL_MEDICATION_FORM_STATE);
    expect(errors).toContain('Bitte einen Namen eingeben.');
    expect(errors).toContain('Bitte eine Dosis eingeben.');
    expect(errors).toContain('Bitte ein Einnahmeschema eingeben.');
  });

  it('rejects an invalid start date', () => {
    const errors = validateMedicationForm({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '12.07.2026',
    });
    expect(errors).toContain('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  });

  it('rejects an invalid reminder time', () => {
    const errors = validateMedicationForm({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      reminderTimes: ['8 Uhr'],
    });
    expect(errors).toContain('Ungültige Erinnerungszeit: "8 Uhr" (erwartet HH:mm).');
  });

  it('passes with valid required fields and no reminder times', () => {
    const errors = validateMedicationForm({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
    });
    expect(errors).toEqual([]);
  });
});

describe('buildMedicationInput', () => {
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

  it('keeps a provided end date', () => {
    const input = buildMedicationInput({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      endDate: '2026-08-01',
    });
    expect(input.endDate).toBe('2026-08-01');
  });
});

describe('addReminderTime / removeReminderTime', () => {
  it('adds a time to the end of the list', () => {
    expect(addReminderTime(['08:00'], '20:00')).toEqual(['08:00', '20:00']);
  });

  it('removes a time by index', () => {
    expect(removeReminderTime(['08:00', '20:00'], 0)).toEqual(['20:00']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/medications/formLogic.test.ts`
Expected: FAIL with "Cannot find module './formLogic'" (module does not exist yet)

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/medications/formLogic.ts`:

```typescript
import type { MedicationInput } from './types';

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

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateMedicationForm(state: MedicationFormState): string[] {
  const errors: string[] = [];

  if (state.name.trim().length === 0) {
    errors.push('Bitte einen Namen eingeben.');
  }
  if (state.dose.trim().length === 0) {
    errors.push('Bitte eine Dosis eingeben.');
  }
  if (state.schedule.trim().length === 0) {
    errors.push('Bitte ein Einnahmeschema eingeben.');
  }
  if (!DATE_PATTERN.test(state.startDate)) {
    errors.push('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  }
  if (state.endDate.length > 0 && !DATE_PATTERN.test(state.endDate)) {
    errors.push('Bitte ein gültiges Enddatum eingeben (JJJJ-MM-TT) oder leer lassen.');
  }
  for (const time of state.reminderTimes) {
    if (!REMINDER_TIME_PATTERN.test(time)) {
      errors.push(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm).`);
    }
  }

  return errors;
}

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

export function addReminderTime(times: string[], time: string): string[] {
  return [...times, time];
}

export function removeReminderTime(times: string[], index: number): string[] {
  return times.filter((_, i) => i !== index);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/medications/formLogic.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: `MedicationList`-Komponente erstellen (kein automatisierter Test — RN/Vitest-Einschränkung)**

Create `colitis-app/src/features/medications/components/MedicationList.tsx`:

```typescript
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { isMedicationActive } from '../medicationStatus';
import type { Medication } from '../types';

interface MedicationListProps {
  medications: Medication[];
  today: Date;
  onTakenToday: (medicationId: number) => void;
  onEnd: (medicationId: number) => void;
  onEdit: (medicationId: number) => void;
}

export function MedicationList({ medications, today, onTakenToday, onEnd, onEdit }: MedicationListProps) {
  if (medications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Noch keine Medikamente. Tippe auf „+", um dein erstes Medikament anzulegen.
        </Text>
      </View>
    );
  }

  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const endedMedications = medications.filter((medication) => !isMedicationActive(medication.endDate, today));

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={[...activeMedications, ...endedMedications]}
      keyExtractor={(medication) => String(medication.id)}
      renderItem={({ item }) => {
        const isActive = isMedicationActive(item.endDate, today);
        return (
          <View style={[styles.card, !isActive && styles.cardEnded]}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardDetail}>
              {item.dose} · {item.schedule}
            </Text>
            {item.reminderTimes.length > 0 && (
              <Text style={styles.cardDetail}>
                Erinnerungen: {item.reminderTimes.map((reminderTime) => reminderTime.time).join(', ')}
              </Text>
            )}
            {!isActive && item.endDate && <Text style={styles.cardEndedLabel}>Beendet am {item.endDate}</Text>}
            <View style={styles.actionsRow}>
              {isActive && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} heute genommen`}
                  style={styles.takenButton}
                  onPress={() => onTakenToday(item.id)}
                >
                  <Text style={styles.takenButtonText}>Heute genommen</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} bearbeiten`}
                style={styles.editButton}
                onPress={() => onEdit(item.id)}
              >
                <Text style={styles.editButtonText}>Bearbeiten</Text>
              </Pressable>
              {isActive && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} beenden`}
                  style={styles.endButton}
                  onPress={() => onEnd(item.id)}
                >
                  <Text style={styles.endButtonText}>Beenden</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.colors.background },
  listContent: { padding: tokens.spacing.lg },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: { color: tokens.colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardEnded: { opacity: 0.6 },
  cardName: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardDetail: { color: tokens.colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
  cardEndedLabel: {
    color: tokens.colors.textSecondary,
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
  takenButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  takenButtonText: { color: tokens.colors.surface, fontSize: tokens.typography.fontSize.sm },
  editButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  editButtonText: { color: tokens.colors.textPrimary, fontSize: tokens.typography.fontSize.sm },
  endButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  endButtonText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm },
});
```

- [ ] **Step 6: `MedicationForm`-Komponente erstellen**

Create `colitis-app/src/features/medications/components/MedicationForm.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  INITIAL_MEDICATION_FORM_STATE,
  addReminderTime,
  removeReminderTime,
  buildMedicationInput,
  validateMedicationForm,
  type MedicationFormState,
} from '../formLogic';
import type { MedicationInput } from '../types';

interface MedicationFormProps {
  initialState?: MedicationFormState;
  onSubmit: (input: MedicationInput) => void | Promise<void>;
  submitLabel: string;
}

export function MedicationForm({ initialState, onSubmit, submitLabel }: MedicationFormProps) {
  const [formState, setFormState] = useState<MedicationFormState>(initialState ?? INITIAL_MEDICATION_FORM_STATE);
  const [newReminderTime, setNewReminderTime] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAddReminderTime() {
    const trimmed = newReminderTime.trim();
    if (trimmed.length === 0) {
      return;
    }
    setFormState({ ...formState, reminderTimes: addReminderTime(formState.reminderTimes, trimmed) });
    setNewReminderTime('');
  }

  async function handleSubmit() {
    const validationErrors = validateMedicationForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildMedicationInput(formState)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Name</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Salofalk"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.name}
        onChangeText={(text) => setFormState({ ...formState, name: text })}
      />

      <Text style={styles.sectionLabel}>Dosis</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. 500mg"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.dose}
        onChangeText={(text) => setFormState({ ...formState, dose: text })}
      />

      <Text style={styles.sectionLabel}>Einnahmeschema</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. 1x täglich morgens"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.schedule}
        onChangeText={(text) => setFormState({ ...formState, schedule: text })}
      />

      <Text style={styles.sectionLabel}>Startdatum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2026-07-12"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.startDate}
        onChangeText={(text) => setFormState({ ...formState, startDate: text })}
      />

      <Text style={styles.sectionLabel}>Enddatum (optional, JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Leer lassen, falls noch aktiv"
        placeholderTextColor={tokens.colors.textSecondary}
        value={formState.endDate}
        onChangeText={(text) => setFormState({ ...formState, endDate: text })}
      />

      <Text style={styles.sectionLabel}>Erinnerungszeiten</Text>
      <Text style={styles.hintText}>
        Für Erinnerungen wird beim Speichern die Benachrichtigungserlaubnis angefragt. Bei Ablehnung werden die
        Zeiten trotzdem gespeichert, aber ohne Push-Erinnerung.
      </Text>
      {formState.reminderTimes.map((time, index) => (
        <View key={`${time}-${index}`} style={styles.reminderRow}>
          <Text style={styles.reminderTimeText}>{time}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Erinnerungszeit ${time} entfernen`}
            onPress={() =>
              setFormState({ ...formState, reminderTimes: removeReminderTime(formState.reminderTimes, index) })
            }
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>Entfernen</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.reminderRow}>
        <TextInput
          style={[styles.textInput, styles.reminderInput]}
          placeholder="HH:mm, z. B. 08:00"
          placeholderTextColor={tokens.colors.textSecondary}
          value={newReminderTime}
          onChangeText={setNewReminderTime}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Erinnerungszeit hinzufügen"
          onPress={handleAddReminderTime}
          style={styles.addTimeButton}
        >
          <Text style={styles.addTimeButtonText}>Hinzufügen</Text>
        </Pressable>
      </View>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing.lg },
  sectionLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  hintText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    marginBottom: tokens.spacing.md,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  reminderTimeText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    flex: 1,
  },
  reminderInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
  },
  removeButtonText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm },
  addTimeButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 8,
    backgroundColor: tokens.colors.primary,
  },
  addTimeButtonText: { color: tokens.colors.surface, fontSize: tokens.typography.fontSize.sm },
  errorBox: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm },
  submitButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.md,
  },
  submitButtonDisabled: { backgroundColor: tokens.colors.border },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 7: `ScreeningReminderCard`-Komponente erstellen**

Create `colitis-app/src/features/medications/components/ScreeningReminderCard.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { ScreeningReminder, NewScreeningReminderInput } from '../types';

interface ScreeningReminderCardProps {
  reminder: ScreeningReminder | null;
  onSave: (input: NewScreeningReminderInput) => void | Promise<void>;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function ScreeningReminderCard({ reminder, onSave }: ScreeningReminderCardProps) {
  const [intervalMonths, setIntervalMonths] = useState(reminder ? String(reminder.intervalMonths) : '');
  const [nextDueDate, setNextDueDate] = useState(reminder?.nextDueDate ?? '');
  const [note, setNote] = useState(reminder?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const parsedInterval = Number(intervalMonths);
    if (!Number.isInteger(parsedInterval) || parsedInterval <= 0) {
      setError('Bitte ein gültiges Intervall in Monaten eingeben (ganze Zahl größer 0).');
      return;
    }
    if (!DATE_PATTERN.test(nextDueDate)) {
      setError('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await Promise.resolve(
        onSave({
          intervalMonths: parsedInterval,
          nextDueDate,
          note: note.trim().length > 0 ? note.trim() : null,
        })
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Vorsorge-Koloskopie</Text>
      <Text style={styles.hintText}>
        Für die Erinnerung wird beim Speichern die Benachrichtigungserlaubnis angefragt. Bei Ablehnung wird der
        Termin trotzdem gespeichert, aber ohne Push-Erinnerung.
      </Text>
      <Text style={styles.label}>Intervall (Monate)</Text>
      <TextInput
        style={styles.textInput}
        keyboardType="number-pad"
        placeholder="z. B. 12"
        placeholderTextColor={tokens.colors.textSecondary}
        value={intervalMonths}
        onChangeText={setIntervalMonths}
      />
      <Text style={styles.label}>Nächstes fälliges Datum (JJJJ-MM-TT)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="2027-01-15"
        placeholderTextColor={tokens.colors.textSecondary}
        value={nextDueDate}
        onChangeText={setNextDueDate}
      />
      <Text style={styles.label}>Notiz (optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="z. B. Rücksprache mit Dr. …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={note}
        onChangeText={setNote}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSaving }}
        disabled={isSaving}
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Speichern</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    margin: tokens.spacing.lg,
    marginBottom: 0,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  hintText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.sm,
  },
  label: { color: tokens.colors.textPrimary, fontSize: tokens.typography.fontSize.sm, marginBottom: tokens.spacing.xs },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.background,
    marginBottom: tokens.spacing.sm,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm, marginBottom: tokens.spacing.sm },
  saveButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: tokens.colors.border },
  saveButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 8: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler (Komponenten werden nicht von Vitest ausgeführt, müssen aber `tsc`-sauber sein)

- [ ] **Step 9: Commit**

```bash
git add src/features/medications/formLogic.ts src/features/medications/formLogic.test.ts src/features/medications/components/
git commit -m "feat: Formular-Logik und UI-Komponenten fuer Medikamente"
```

---

### Task 5: Screens & Navigation

**Files:**
- Modify: `colitis-app/app/(tabs)/_layout.tsx`
- Create: `colitis-app/app/(tabs)/medikamente/_layout.tsx`
- Create: `colitis-app/app/(tabs)/medikamente/index.tsx`
- Create: `colitis-app/app/(tabs)/medikamente/neu.tsx`
- Create: `colitis-app/app/(tabs)/medikamente/[id].tsx`

**Interfaces:**
- Consumes: alle Repository-Funktionen aus Task 2, alle Notification-Service-Funktionen aus Task 3, `MedicationList`/`MedicationForm`/`ScreeningReminderCard` aus Task 4, `createEncryptedDb` aus `src/db/client.ts`, `tokens` aus `src/styles/tokens.ts`.
- Produces: nichts weiter (Endpunkt der Feature-Kette). Keine automatisierten Tests (React Native/Vitest-Einschränkung) — Verifikation über `tsc --noEmit` und späteren manuellen Alltagstest.

- [ ] **Step 1: Neuen Tab registrieren**

Modify `colitis-app/app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="tagebuch/index" options={{ title: 'Tagebuch' }} />
      <Tabs.Screen name="wissen/index" options={{ title: 'Wissen' }} />
      <Tabs.Screen name="medikamente/index" options={{ title: 'Medikamente' }} />
      <Tabs.Screen name="toiletten/index" options={{ title: 'Toiletten' }} />
      <Tabs.Screen name="einstellungen/index" options={{ title: 'Einstellungen' }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Stack-Layout für den neuen Tab anlegen**

Create `colitis-app/app/(tabs)/medikamente/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function MedikamenteLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Medikamente' }} />
      <Stack.Screen name="neu" options={{ title: 'Neues Medikament' }} />
      <Stack.Screen name="[id]" options={{ title: 'Medikament bearbeiten' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Listen-Screen erstellen**

Create `colitis-app/app/(tabs)/medikamente/index.tsx`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  logMedicationTaken,
  endMedication,
  setReminderTimeNotificationId,
} from '../../../src/features/medications/db/medicationsRepository';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
} from '../../../src/features/medications/db/screeningRepository';
import {
  configureNotificationHandling,
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleScreeningReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { MedicationList } from '../../../src/features/medications/components/MedicationList';
import { ScreeningReminderCard } from '../../../src/features/medications/components/ScreeningReminderCard';
import { tokens } from '../../../src/styles/tokens';
import type {
  Medication,
  ScreeningReminder,
  NewScreeningReminderInput,
} from '../../../src/features/medications/types';

export default function MedikamenteScreen() {
  const router = useRouter();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [screeningReminder, setScreeningReminder] = useState<ScreeningReminder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureNotificationHandling();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then(async (db) => {
          const [loadedMedications, loadedScreening] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Medikamente] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Medikamente konnten nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleTakenToday(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      await logMedicationTaken(db, medicationId, new Date().toISOString());
    } catch (takenError: unknown) {
      console.error('[Medikamente] Eintragen der Einnahme fehlgeschlagen:', takenError);
      setError('Einnahme konnte nicht gespeichert werden.');
    }
  }

  async function handleEnd(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      const reminderTimes = await endMedication(db, medicationId, new Date().toISOString().slice(0, 10));
      for (const reminderTime of reminderTimes) {
        if (reminderTime.notificationId) {
          await cancelScheduledReminder(reminderTime.notificationId);
          await setReminderTimeNotificationId(db, reminderTime.id, null);
        }
      }
      setMedications(await listMedications(db));
    } catch (endError: unknown) {
      console.error('[Medikamente] Beenden fehlgeschlagen:', endError);
      setError('Medikament konnte nicht beendet werden.');
    }
  }

  async function handleSaveScreeningReminder(input: NewScreeningReminderInput) {
    try {
      const db = await createEncryptedDb();
      const { previous, current } = await upsertScreeningReminder(db, input);

      if (previous?.notificationId) {
        await cancelScheduledReminder(previous.notificationId);
      }

      let notificationId: string | null = null;
      const granted = await requestNotificationPermission();
      if (granted) {
        notificationId = await scheduleScreeningReminder(input.nextDueDate, {
          title: 'Vorsorge-Koloskopie',
          body: input.note && input.note.length > 0 ? input.note : 'Deine Vorsorge-Koloskopie ist fällig.',
        });
      }

      await setScreeningReminderNotificationId(db, current.id, notificationId);
      setScreeningReminder({ ...current, notificationId });
      setError(null);
    } catch (saveError: unknown) {
      console.error('[Medikamente] Vorsorge-Reminder speichern fehlgeschlagen:', saveError);
      setError('Vorsorge-Erinnerung konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <ScreeningReminderCard reminder={screeningReminder} onSave={handleSaveScreeningReminder} />
      <MedicationList
        medications={medications}
        today={new Date()}
        onTakenToday={handleTakenToday}
        onEnd={handleEnd}
        onEdit={(medicationId) => router.push(`/medikamente/${medicationId}`)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neues Medikament anlegen"
        style={styles.addButton}
        onPress={() => router.push('/medikamente/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
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

- [ ] **Step 4: "Neu anlegen"-Screen erstellen**

Create `colitis-app/app/(tabs)/medikamente/neu.tsx`:

```typescript
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  createMedication,
  setReminderTimeNotificationId,
} from '../../../src/features/medications/db/medicationsRepository';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { MedicationForm } from '../../../src/features/medications/components/MedicationForm';
import { tokens } from '../../../src/styles/tokens';
import type { MedicationInput } from '../../../src/features/medications/types';

export default function NeuesMedikamentScreen() {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(input: MedicationInput) {
    try {
      const db = await createEncryptedDb();
      const created = await createMedication(db, input);

      if (created.reminderTimes.length > 0) {
        const granted = await requestNotificationPermission();
        if (granted) {
          for (const reminderTime of created.reminderTimes) {
            const notificationId = await scheduleDailyReminder(reminderTime.time, {
              title: 'Medikamenten-Erinnerung',
              body: `${created.name} – ${created.dose}`,
            });
            await setReminderTimeNotificationId(db, reminderTime.id, notificationId);
          }
        }
      }

      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Medikamente] Anlegen fehlgeschlagen:', error);
      setSaveError('Medikament konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}
      <MedicationForm onSubmit={handleSubmit} submitLabel="Medikament speichern" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
});
```

- [ ] **Step 5: "Bearbeiten"-Screen erstellen**

Create `colitis-app/app/(tabs)/medikamente/[id].tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  getMedicationById,
  updateMedication,
  setReminderTimeNotificationId,
} from '../../../src/features/medications/db/medicationsRepository';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelScheduledReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { MedicationForm } from '../../../src/features/medications/components/MedicationForm';
import { tokens } from '../../../src/styles/tokens';
import type { Medication, MedicationInput } from '../../../src/features/medications/types';

export default function MedikamentBearbeitenScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicationId = Number(id);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then((db) => getMedicationById(db, medicationId))
        .then((loaded) => {
          if (isActive) {
            setMedication(loaded);
            setLoadError(loaded ? null : 'Medikament wurde nicht gefunden.');
          }
        })
        .catch((error: unknown) => {
          console.error('[Medikamente] Laden zum Bearbeiten fehlgeschlagen:', error);
          if (isActive) {
            setLoadError('Medikament konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [medicationId])
  );

  async function handleSubmit(input: MedicationInput) {
    try {
      const db = await createEncryptedDb();
      const { removed, inserted } = await updateMedication(db, medicationId, input);

      for (const reminderTime of removed) {
        if (reminderTime.notificationId) {
          await cancelScheduledReminder(reminderTime.notificationId);
        }
      }

      if (inserted.length > 0) {
        const granted = await requestNotificationPermission();
        if (granted) {
          for (const reminderTime of inserted) {
            const notificationId = await scheduleDailyReminder(reminderTime.time, {
              title: 'Medikamenten-Erinnerung',
              body: `${input.name} – ${input.dose}`,
            });
            await setReminderTimeNotificationId(db, reminderTime.id, notificationId);
          }
        }
      }

      setSaveError(null);
      router.back();
    } catch (error: unknown) {
      console.error('[Medikamente] Bearbeiten fehlgeschlagen:', error);
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

  if (!medication) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Medikament wird geladen …</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background, padding: tokens.spacing.lg },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: { color: tokens.colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
  loadingText: { color: tokens.colors.textSecondary, fontSize: tokens.typography.fontSize.md, textAlign: 'center' },
});
```

- [ ] **Step 6: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün (90 Tests insgesamt, siehe Hinweis unten), keine TypeScript-Fehler

Hinweis zur erwarteten Testanzahl: Vor diesem Plan lag der Stand bei 49 Tests. Task 1 fügt 12 hinzu (8 reminderScheduling + 4 medicationStatus), Task 2 fügt 13 hinzu (7 medicationsRepository + 4 screeningRepository + 2 schema.test.ts), Task 3 fügt 8 hinzu (notificationService), Task 4 fügt 8 hinzu (formLogic) — macht insgesamt 49 + 41 = 90 Tests nach Abschluss von Task 4. Task 5 fügt keine neuen Tests hinzu.

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/\(tabs\)/medikamente/
git commit -m "feat: Medikamente-Tab mit Liste, Anlegen- und Bearbeiten-Screen verdrahten"
```

---

## Nach Abschluss aller Tasks

Nach Task 5 folgt die plan-übergreifende Abschluss-Review (whole-branch review) über alle 5 Tasks hinweg, danach `superpowers:finishing-a-development-branch`. Manuelle Prüfpunkte für den späteren Alltagstest (nicht Teil dieser Umsetzung, siehe Global Constraints): tatsächliches Anzeigen der Push-Benachrichtigung auf einem echten Android-Gerät, Verhalten bei verweigerter Benachrichtigungserlaubnis, Verhalten des Android-Fallback-Kanals "Miscellaneous" (kein expliziter Kanal wird in diesem Schritt angelegt — bewusste Vereinfachung, siehe Task 3).
