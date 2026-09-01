import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
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
import * as schema from '../../../db/schema';
import { BACKUP_FORMAT_VERSION, type BackupData } from '../types';
import { normalizeDiaryRow } from '../legacyDiaryRow';

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
  });
}
