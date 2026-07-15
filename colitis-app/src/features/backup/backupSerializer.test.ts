import { describe, it, expect } from 'vitest';
import { serializeBackupData, parseBackupData } from './backupSerializer';
import type { BackupData } from './types';

const sampleData: BackupData = {
  version: 1,
  exportedAt: '2026-07-14T10:00:00.000Z',
  tables: {
    diaryEntries: [],
    triggers: [],
    medications: [],
    medicationLog: [],
    medicationReminderTimes: [],
    savedPlaces: [],
    screeningReminders: [],
  },
};

describe('serializeBackupData / parseBackupData', () => {
  it('round-trips valid backup data', () => {
    const json = serializeBackupData(sampleData);
    expect(parseBackupData(json)).toEqual(sampleData);
  });

  it('throws a German error for invalid JSON', () => {
    expect(() => parseBackupData('not json')).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });

  it('throws a German error for an unknown version', () => {
    const json = JSON.stringify({ ...sampleData, version: 99 });
    expect(() => parseBackupData(json)).toThrow('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
  });

  it('throws a German error when a table key is missing', () => {
    const broken = JSON.parse(serializeBackupData(sampleData));
    delete broken.tables.triggers;
    expect(() => parseBackupData(JSON.stringify(broken))).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });

  it('throws a German error when a table value is not an array', () => {
    const broken = JSON.parse(serializeBackupData(sampleData));
    broken.tables.triggers = 'not an array';
    expect(() => parseBackupData(JSON.stringify(broken))).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });

  it('throws a German error when the root is not an object', () => {
    expect(() => parseBackupData('42')).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });
});
