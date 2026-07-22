import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { exportBackupData, importBackupData } from './backupRepository';
import { diaryEntries, triggers, medications, medicationLog } from '../../../db/schema';

describe('backup repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

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
        knowledgeFavorites: [],
        doctorVisits: [],
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
        medicationLog: [{ id: 9, medicationId: 5, takenAt: '2026-07-14T08:00:00.000Z' }],
        medicationReminderTimes: [{ id: 2, medicationId: 5, time: '08:00', notificationId: null }],
        savedPlaces: [],
        screeningReminders: [],
        knowledgeFavorites: [],
        doctorVisits: [],
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
        knowledgeFavorites: [],
        doctorVisits: [],
      },
    });

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual([]);
  });

  it('does not violate foreign key constraints when pre-existing linked data must be deleted before import', async () => {
    const [existingEntry] = await db
      .insert(diaryEntries)
      .values({
        occurredAt: '2026-01-01T00:00:00.000Z',
        stoolFrequency: 1,
        hasBlood: false,
        stoolConsistency: 'normal',
        painLevel: 0,
        symptoms: '',
        note: null,
      })
      .returning();
    await db.insert(triggers).values({
      diaryEntryId: existingEntry.id,
      category: 'stress',
      note: null,
    });

    const [existingMedication] = await db
      .insert(medications)
      .values({
        name: 'Bestehendes Medikament',
        dose: '100mg',
        schedule: '1x taeglich',
        startDate: '2025-01-01',
        endDate: null,
      })
      .returning();
    await db.insert(medicationLog).values({
      medicationId: existingMedication.id,
      takenAt: '2026-01-01T08:00:00.000Z',
    });

    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-14T09:00:00.000Z',
      tables: {
        diaryEntries: [
          {
            id: 99,
            occurredAt: '2026-07-14T09:00:00.000Z',
            stoolFrequency: 6,
            hasBlood: true,
            stoolConsistency: 'wässrig',
            painLevel: 8,
            symptoms: 'importiert',
            note: null,
          },
        ],
        triggers: [{ id: 88, diaryEntryId: 99, category: 'ernaehrung' as const, note: null }],
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
        medicationLog: [{ id: 66, medicationId: 77, takenAt: '2026-07-14T08:00:00.000Z' }],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
        knowledgeFavorites: [],
        doctorVisits: [],
      },
    };

    await expect(importBackupData(db, importedData)).resolves.not.toThrow();

    const data = await exportBackupData(db);
    expect(data.tables.diaryEntries).toEqual(importedData.tables.diaryEntries);
    expect(data.tables.triggers).toEqual(importedData.tables.triggers);
    expect(data.tables.medications).toEqual(importedData.tables.medications);
    expect(data.tables.medicationLog).toEqual(importedData.tables.medicationLog);
  });

  it('exports and re-imports knowledge favorites, preserving original ids', async () => {
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
        knowledgeFavorites: [{ id: 3, articleSlug: 'ueberblick' }],
        doctorVisits: [],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.knowledgeFavorites).toEqual(importedData.tables.knowledgeFavorites);
  });

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
});
