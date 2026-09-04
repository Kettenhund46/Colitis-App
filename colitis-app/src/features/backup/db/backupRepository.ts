import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import {
  diaryEntries,
  doctorVisits,
  knowledgeFavorites,
  medicationLog,
  medicationReminderTimes,
  medicationScheduleHistory,
  medications,
  savedPlaces,
  screeningReminders,
  triggers,
  visitQuestions,
} from '../../../db/schema';
import * as schema from '../../../db/schema';
import { BACKUP_FORMAT_VERSION, type BackupData } from '../types';
import { normalizeDiaryRow } from '../legacyDiaryRow';
import { scheduleHistoryForImport } from '../legacyScheduleHistory';

export type BackupDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function exportBackupData(db: BackupDb): Promise<BackupData> {
  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      diaryEntries: await db.select().from(diaryEntries),
      triggers: await db.select().from(triggers),
      medications: await db.select().from(medications),
      medicationLog: await db.select().from(medicationLog),
      medicationReminderTimes: await db.select().from(medicationReminderTimes),
      medicationScheduleHistory: await db.select().from(medicationScheduleHistory),
      visitQuestions: await db.select().from(visitQuestions),
      savedPlaces: await db.select().from(savedPlaces),
      screeningReminders: await db.select().from(screeningReminders),
      knowledgeFavorites: await db.select().from(knowledgeFavorites),
      doctorVisits: await db.select().from(doctorVisits),
    },
  };
}

export async function importBackupData(db: BackupDb, data: BackupData): Promise<void> {
  db.transaction((tx) => {
    // Kinder vor Eltern loeschen, damit PRAGMA foreign_keys=ON nicht blockiert.
    tx.delete(triggers).run();
    tx.delete(medicationLog).run();
    tx.delete(medicationReminderTimes).run();
    tx.delete(medicationScheduleHistory).run();
    tx.delete(visitQuestions).run();
    tx.delete(diaryEntries).run();
    tx.delete(medications).run();
    tx.delete(savedPlaces).run();
    tx.delete(screeningReminders).run();
    tx.delete(knowledgeFavorites).run();
    tx.delete(doctorVisits).run();

    // Eltern vor Kindern einfuegen, mit den urspruenglichen IDs aus dem Backup.
    for (const row of data.tables.diaryEntries) {
      tx.insert(diaryEntries).values(normalizeDiaryRow(row)).run();
    }
    for (const row of data.tables.medications) {
      tx.insert(medications).values(row).run();
    }
    for (const row of data.tables.savedPlaces) {
      tx.insert(savedPlaces).values(row).run();
    }
    for (const row of data.tables.screeningReminders) {
      tx.insert(screeningReminders).values(row).run();
    }
    for (const row of data.tables.knowledgeFavorites) {
      tx.insert(knowledgeFavorites).values(row).run();
    }
    for (const row of data.tables.doctorVisits) {
      tx.insert(doctorVisits).values(row).run();
    }
    for (const row of data.tables.triggers) {
      tx.insert(triggers).values(row).run();
    }
    for (const row of data.tables.medicationLog) {
      tx.insert(medicationLog).values(row).run();
    }
    for (const row of data.tables.medicationReminderTimes) {
      tx.insert(medicationReminderTimes).values(row).run();
    }
    for (const row of data.tables.visitQuestions ?? []) {
      tx.insert(visitQuestions).values(row).run();
    }
    // Aeltere Sicherungen kennen die Zeitplan-Historie nicht. Sie wird dann aus
    // Laufzeit und Erinnerungszeiten erzeugt -- genau wie bei der Migration.
    const historyRows =
      data.tables.medicationScheduleHistory ??
      scheduleHistoryForImport(data.tables.medications, data.tables.medicationReminderTimes);
    for (const row of historyRows) {
      tx.insert(medicationScheduleHistory).values(row).run();
    }
  });
}
