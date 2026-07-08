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
