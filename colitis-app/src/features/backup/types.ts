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

export interface BackupEnvelope {
  version: typeof BACKUP_FORMAT_VERSION;
  saltHex: string;
  nonceHex: string;
  ciphertextHex: string;
}
