import { BACKUP_FORMAT_VERSION, type BackupData } from './types';

export function serializeBackupData(data: BackupData): string {
  return JSON.stringify(data);
}

const REQUIRED_TABLE_KEYS = [
  'diaryEntries',
  'triggers',
  'medications',
  'medicationLog',
  'medicationReminderTimes',
  'savedPlaces',
  'screeningReminders',
] as const;

export function parseBackupData(json: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.version !== BACKUP_FORMAT_VERSION) {
    throw new Error('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
  }

  if (typeof candidate.exportedAt !== 'string') {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  if (typeof candidate.tables !== 'object' || candidate.tables === null) {
    throw new Error('Sicherungsdatei ist kein gültiges Format.');
  }

  const tables = candidate.tables as Record<string, unknown>;
  for (const key of REQUIRED_TABLE_KEYS) {
    if (!Array.isArray(tables[key])) {
      throw new Error('Sicherungsdatei ist kein gültiges Format.');
    }
  }

  return candidate as BackupData;
}
