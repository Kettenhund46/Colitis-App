import type { diaryEntries, doctorVisits, knowledgeFavorites, meals, medicationLog, medicationReminderTimes, medicationScheduleHistory, medications, savedPlaces, screeningReminders, triggers, visitQuestions } from '../../db/schema';

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
    /**
     * Fehlt in Sicherungen, die vor der Historisierung entstanden sind. Beim
     * Einlesen wird sie dann aus Laufzeit und Erinnerungszeiten erzeugt.
     */
    medicationScheduleHistory?: (typeof medicationScheduleHistory.$inferSelect)[];
    /** Fehlt in Sicherungen, die vor den Arzt-Fragen entstanden sind. */
    visitQuestions?: (typeof visitQuestions.$inferSelect)[];
    /** Fehlt in Sicherungen, die vor dem Ernaehrungstagebuch entstanden sind. */
    meals?: (typeof meals.$inferSelect)[];
    savedPlaces: (typeof savedPlaces.$inferSelect)[];
    screeningReminders: (typeof screeningReminders.$inferSelect)[];
    knowledgeFavorites: (typeof knowledgeFavorites.$inferSelect)[];
    doctorVisits: (typeof doctorVisits.$inferSelect)[];
  };
}

export interface BackupEnvelope {
  version: typeof BACKUP_FORMAT_VERSION;
  saltHex: string;
  nonceHex: string;
  ciphertextHex: string;
}
