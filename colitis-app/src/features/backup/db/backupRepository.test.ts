import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { exportBackupData, importBackupData } from './backupRepository';
import { diaryEntries, triggers, medications, medicationLog } from '../../../db/schema';

describe('backup repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('exports an empty structure with all twelve table keys when nothing exists yet', async () => {
    const data = await exportBackupData(db);
    expect(data.version).toBe(1);
    expect(data.tables).toEqual({
      diaryEntries: [],
      triggers: [],
      medications: [],
      medicationLog: [],
      medicationReminderTimes: [],
      medicationScheduleHistory: [],
      visitQuestions: [],
      meals: [],
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
        bloodLevel: 0,
        nocturnalStools: 0,
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
      bloodLevel: 0,
      nocturnalStools: 0,
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
            bloodLevel: 1,
            nocturnalStools: 0,
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
            bloodLevel: 0,
            nocturnalStools: 0,
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
            unitsPerIntake: 1,
            packUnits: null,
            stockUnits: null,
            supplyNotificationId: null,
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
      bloodLevel: 0,
      nocturnalStools: 0,
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
        bloodLevel: 0,
        nocturnalStools: 0,
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
            bloodLevel: 1,
            nocturnalStools: 0,
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
            unitsPerIntake: 1,
            packUnits: null,
            stockUnits: null,
            supplyNotificationId: null,
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
            nextAppointmentNotificationId: null,
          },
        ],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.doctorVisits).toEqual(importedData.tables.doctorVisits);
  });
function legacyTables() {
    return {
      diaryEntries: [],
      triggers: [],
      medications: [
        {
          id: 5,
          name: 'Mesalazin',
          dose: '500mg',
          schedule: '3x taeglich',
          startDate: '2026-06-01',
          endDate: null,
          sideEffectsNote: null,
          unitsPerIntake: 1,
          packUnits: null,
          stockUnits: null,
          supplyNotificationId: null,
        },
      ],
      medicationLog: [],
      medicationReminderTimes: [
        { id: 1, medicationId: 5, time: '08:00', notificationId: null },
        { id: 2, medicationId: 5, time: '19:00', notificationId: null },
      ],
      savedPlaces: [],
      screeningReminders: [],
      knowledgeFavorites: [],
      doctorVisits: [],
    };
  }

  it('carries the schedule history through an export and re-import', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-09-04T09:00:00.000Z',
      tables: {
        ...legacyTables(),
        medicationScheduleHistory: [
          { id: 1, medicationId: 5, validFrom: '2026-06-01', validTo: '2026-07-31', dosesPerDay: 3 },
          { id: 2, medicationId: 5, validFrom: '2026-08-01', validTo: null, dosesPerDay: 2 },
        ],
        visitQuestions: [],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.medicationScheduleHistory).toEqual(
      importedData.tables.medicationScheduleHistory
    );
  });

  it('carries the meals through an export and re-import', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-09-05T09:00:00.000Z',
      tables: {
        ...legacyTables(),
        medicationScheduleHistory: [],
        visitQuestions: [],
        meals: [
          { id: 4, eatenAt: '2026-09-04T17:30:00.000Z', description: 'Pizza' },
          { id: 5, eatenAt: '2026-09-04T06:30:00.000Z', description: 'Haferbrei' },
        ],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.meals).toEqual(importedData.tables.meals);
  });

  it('carries the visit questions through an export and re-import', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-09-04T09:00:00.000Z',
      tables: {
        ...legacyTables(),
        medicationScheduleHistory: [],
        visitQuestions: [
          { id: 3, text: 'Kann ich die Dosis senken?', createdAt: '2026-08-01T09:00:00.000Z', answeredAt: null },
        ],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.visitQuestions).toEqual(importedData.tables.visitQuestions);
  });

  it('builds a schedule history for a backup that predates it', async () => {
    // Aeltere Sicherung: keine Abschnitte, keine Fragen. Beides darf nicht zum
    // Fehler fuehren, und die Historie entsteht aus Laufzeit und Zeiten.
    await importBackupData(db, {
      version: 1 as const,
      exportedAt: '2026-08-01T09:00:00.000Z',
      tables: legacyTables(),
    });

    const data = await exportBackupData(db);
    expect(data.tables.medicationScheduleHistory).toEqual([
      { id: 1, medicationId: 5, validFrom: '2026-06-01', validTo: null, dosesPerDay: 2 },
    ]);
    expect(data.tables.visitQuestions).toEqual([]);
    expect(data.tables.meals).toEqual([]);
  });
});

describe('Datenverlust beim Wiederherstellen', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('laesst die vorhandenen Daten stehen, wenn der Import mittendrin scheitert', async () => {
    // Der Import loescht erst alles und fuegt dann neu ein. Scheitert er
    // dazwischen, darf davon nichts uebrig bleiben -- sonst waere ein
    // fehlerhaftes Backup schlimmer als gar keines.
    const [vorhandenerEintrag] = await db
      .insert(diaryEntries)
      .values({
        occurredAt: '2026-09-01T09:00:00.000Z',
        stoolFrequency: 3,
        bloodLevel: 1,
        nocturnalStools: 0,
        stoolConsistency: 'weich',
        painLevel: 4,
        symptoms: 'Kraempfe',
        note: null,
      })
      .returning();
    await db.insert(medications).values({
      name: 'Bestehendes Medikament',
      dose: '500mg',
      schedule: '1x taeglich',
      startDate: '2026-08-01',
      endDate: null,
    });

    const kaputt = {
      version: 1 as const,
      exportedAt: '2026-09-07T09:00:00.000Z',
      tables: {
        diaryEntries: [],
        triggers: [],
        // `name` ist NOT NULL -- diese Zeile bringt den Import zu Fall,
        // nachdem das Loeschen bereits gelaufen ist.
        medications: [
          {
            id: 1,
            name: null as unknown as string,
            dose: '1mg',
            schedule: '1x',
            startDate: '2026-01-01',
            endDate: null,
            sideEffectsNote: null,
            unitsPerIntake: 1,
            packUnits: null,
            stockUnits: null,
            supplyNotificationId: null,
          },
        ],
        medicationLog: [],
        medicationReminderTimes: [],
        medicationScheduleHistory: [],
        visitQuestions: [],
        meals: [],
        savedPlaces: [],
        screeningReminders: [],
        knowledgeFavorites: [],
        doctorVisits: [],
      },
    };

    await expect(importBackupData(db, kaputt)).rejects.toThrow();

    const danach = await exportBackupData(db);
    expect(danach.tables.diaryEntries).toHaveLength(1);
    expect(danach.tables.diaryEntries[0].id).toBe(vorhandenerEintrag.id);
    expect(danach.tables.medications).toHaveLength(1);
    expect(danach.tables.medications[0].name).toBe('Bestehendes Medikament');
  });

  it('sichert jede Tabelle mit Nutzerdaten', async () => {
    // Zwischenspeicher und die aus dem Code erzeugten Wissensartikel fehlen
    // bewusst: Sie entstehen beim naechsten Start von selbst neu.
    const data = await exportBackupData(db);
    expect(Object.keys(data.tables).sort()).toEqual(
      [
        'diaryEntries',
        'doctorVisits',
        'knowledgeFavorites',
        'meals',
        'medicationLog',
        'medicationReminderTimes',
        'medicationScheduleHistory',
        'medications',
        'savedPlaces',
        'screeningReminders',
        'triggers',
        'visitQuestions',
      ].sort()
    );
  });
});
