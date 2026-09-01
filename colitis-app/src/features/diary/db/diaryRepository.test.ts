import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../../db/schema';
import {
  createDiaryEntry,
  listDiaryEntries,
  deleteDiaryEntry,
  updateDiaryEntryQuickFields,
} from './diaryRepository';
import { triggers } from '../../../db/schema';

// Alle Migrationen, nicht nur die erste: Bis zur Blutstufe hatte sich
// diary_entries seit 0000 nie geaendert, weshalb die Abkuerzung lange nicht
// auffiel. Die uebrigen Feature-Tests machen es seit jeher so.
function createTestDb() {
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

describe('diary repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a diary entry and returns its id', async () => {
    const id = await createDiaryEntry(db, {
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 3,
      bloodLevel: 0,
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
      bloodLevel: 0,
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
      bloodLevel: 1,
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
      bloodLevel: 0,
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
      bloodLevel: 0,
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
      bloodLevel: 0,
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
      bloodLevel: 0,
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
      bloodLevel: 0,
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
      bloodLevel: 1,
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

  it('updates only the quick fields and leaves every other field untouched', async () => {
    const id = await createDiaryEntry(db, {
      occurredAt: '2026-07-27T09:00:00.000Z',
      stoolFrequency: 2,
      bloodLevel: 0,
      stoolConsistency: 'normal',
      painLevel: 6,
      symptoms: ['bauchschmerzen', 'muedigkeit'],
      note: 'Diese Notiz muss erhalten bleiben',
      triggerCategories: ['ernaehrung'],
      foodTriggerNote: 'Kaffee',
    });

    await updateDiaryEntryQuickFields(db, id, {
      stoolFrequency: 3,
      bloodLevel: 1,
      stoolConsistency: 'waessrig',
    });

    const [entry] = await listDiaryEntries(db);

    expect(entry.stoolFrequency).toBe(3);
    expect(entry.bloodLevel).toBe(1);
    expect(entry.stoolConsistency).toBe('waessrig');

    expect(entry.occurredAt).toBe('2026-07-27T09:00:00.000Z');
    expect(entry.painLevel).toBe(6);
    expect(entry.symptoms).toEqual(['bauchschmerzen', 'muedigkeit']);
    expect(entry.note).toBe('Diese Notiz muss erhalten bleiben');
    expect(entry.triggerCategories).toEqual(['ernaehrung']);
    expect(entry.foodTriggerNote).toBe('Kaffee');
  });

  it('updates only the addressed entry and leaves the others untouched', async () => {
    const firstId = await createDiaryEntry(db, {
      occurredAt: '2026-07-26T09:00:00.000Z',
      stoolFrequency: 1,
      bloodLevel: 0,
      stoolConsistency: 'hart',
      painLevel: 0,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });
    const secondId = await createDiaryEntry(db, {
      occurredAt: '2026-07-27T09:00:00.000Z',
      stoolFrequency: 1,
      bloodLevel: 0,
      stoolConsistency: 'normal',
      painLevel: 0,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });

    await updateDiaryEntryQuickFields(db, secondId, {
      stoolFrequency: 9,
      bloodLevel: 1,
      stoolConsistency: 'waessrig',
    });

    const entries = await listDiaryEntries(db);
    const changed = entries.find((entry) => entry.id === secondId);
    const untouched = entries.find((entry) => entry.id === firstId);

    expect(changed?.stoolFrequency).toBe(9);
    expect(changed?.bloodLevel).toBe(1);
    expect(changed?.stoolConsistency).toBe('waessrig');

    expect(untouched?.stoolFrequency).toBe(1);
    expect(untouched?.bloodLevel).toBe(0);
    expect(untouched?.stoolConsistency).toBe('hart');
  });
});
