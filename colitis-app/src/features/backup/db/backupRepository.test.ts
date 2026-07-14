import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { exportBackupData, importBackupData } from './backupRepository';
import { diaryEntries, triggers, medications, medicationLog } from '../../../db/schema';

describe('backup repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('exports an empty structure with all seven table keys when nothing exists yet', async () => {
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
    });
  });

  it('exports rows that were inserted directly', async () => {
    const [entry] = await db
      .insert(diaryEntries)
      .values({
        occurredAt: '2026-07-14T08:00:00.000Z',
        stoolFrequency: 3,
        hasBlood: false,
        stoolConsistency: 'weich',
        painLevel: 4,
        symptoms: 'Bauchschmerzen',
        note: null,
      })
      .returning();

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual([entry]);
  });

  it('replaces all existing data with imported data in a single pass', async () => {
    await db.insert(diaryEntries).values({
      occurredAt: '2026-01-01T00:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 0,
      symptoms: '',
      note: null,
    });

    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [
          {
            id: 42,
            occurredAt: '2026-07-14T09:00:00.000Z',
            stoolFrequency: 5,
            hasBlood: true,
            stoolConsistency: 'wässrig',
            painLevel: 7,
            symptoms: 'Krämpfe',
            note: 'importiert',
          },
        ],
        triggers: [],
        medications: [],
        medicationLog: [],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual(importedData.tables.diaryEntries);
  });

  it('preserves foreign key relationships by keeping original ids', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [
          {
            id: 7,
            occurredAt: '2026-07-14T09:00:00.000Z',
            stoolFrequency: 2,
            hasBlood: false,
            stoolConsistency: 'normal',
            painLevel: 1,
            symptoms: '',
            note: null,
          },
        ],
        triggers: [{ id: 3, diaryEntryId: 7, category: 'stress' as const, note: null }],
        medications: [
          { id: 5, name: 'Salofalk', dose: '500mg', schedule: '1x taeglich', startDate: '2026-01-01', endDate: null },
        ],
        medicationLog: [{ id: 9, medicationId: 5, takenAt: '2026-07-14T08:00:00.000Z' }],
        medicationReminderTimes: [{ id: 2, medicationId: 5, time: '08:00', notificationId: null }],
        savedPlaces: [],
        screeningReminders: [],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.triggers[0].diaryEntryId).toBe(7);
    expect(data.tables.medicationLog[0].medicationId).toBe(5);
    expect(data.tables.medicationReminderTimes[0].medicationId).toBe(5);
  });

  it('clears all data when importing an empty backup', async () => {
    await db.insert(diaryEntries).values({
      occurredAt: '2026-01-01T00:00:00.000Z',
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'normal',
      painLevel: 0,
      symptoms: '',
      note: null,
    });

    await importBackupData(db, {
      version: 1,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [],
        triggers: [],
        medications: [],
        medicationLog: [],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
      },
    });

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual([]);
  });
});
