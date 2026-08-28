import { describe, it, expect, vi, beforeEach } from 'vitest';

const rescheduleAllReminders = vi.fn();
const rescheduleBackupReminder = vi.fn();
const rescheduleDiaryReminder = vi.fn();

vi.mock('./rescheduleReminders', () => ({
  rescheduleAllReminders: (db: unknown, data: unknown) => rescheduleAllReminders(db, data),
}));

vi.mock('./scheduleBackupReminder', () => ({
  rescheduleBackupReminder: () => rescheduleBackupReminder(),
}));

vi.mock('../diary/scheduleDiaryReminder', () => ({
  rescheduleDiaryReminder: () => rescheduleDiaryReminder(),
}));

import { rescheduleAllAfterRestore, formatRestoreResultMessage } from './rescheduleAfterRestore';
import type { BackupDb } from './db/backupRepository';
import type { BackupData } from './types';

const db = {} as unknown as BackupDb;
const data = {} as unknown as BackupData;

describe('rescheduleAllAfterRestore', () => {
  beforeEach(() => {
    rescheduleAllReminders.mockReset();
    rescheduleAllReminders.mockResolvedValue(undefined);
    rescheduleBackupReminder.mockReset();
    rescheduleBackupReminder.mockResolvedValue(undefined);
    rescheduleDiaryReminder.mockReset();
    rescheduleDiaryReminder.mockResolvedValue('scheduled');
  });

  it('schedules all three kinds and reports no failure', async () => {
    const failed = await rescheduleAllAfterRestore(db, data);

    expect(failed).toEqual([]);
    expect(rescheduleAllReminders).toHaveBeenCalledWith(db, data);
    expect(rescheduleBackupReminder).toHaveBeenCalledTimes(1);
    expect(rescheduleDiaryReminder).toHaveBeenCalledTimes(1);
  });

  it('still schedules the diary reminder when the medication reminders throw', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    rescheduleAllReminders.mockRejectedValue(new Error('kaputt'));

    const failed = await rescheduleAllAfterRestore(db, data);

    expect(failed).toEqual(['Medikamente']);
    expect(rescheduleBackupReminder).toHaveBeenCalledTimes(1);
    expect(rescheduleDiaryReminder).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('names every kind that failed', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    rescheduleAllReminders.mockRejectedValue(new Error('kaputt'));
    rescheduleBackupReminder.mockRejectedValue(new Error('auch kaputt'));

    const failed = await rescheduleAllAfterRestore(db, data);

    expect(failed).toEqual(['Medikamente', 'Sicherung']);

    consoleError.mockRestore();
  });
});

describe('formatRestoreResultMessage', () => {
  it('reports plain success when nothing failed', () => {
    expect(formatRestoreResultMessage([])).toBe('Backup erfolgreich wiederhergestellt.');
  });

  it('uses the singular for a single failed kind', () => {
    expect(formatRestoreResultMessage(['Tagebuch'])).toBe(
      'Daten wiederhergestellt. Diese Erinnerung konnte nicht neu geplant werden: Tagebuch.'
    );
  });

  it('uses the plural and lists every failed kind', () => {
    expect(formatRestoreResultMessage(['Medikamente', 'Sicherung'])).toBe(
      'Daten wiederhergestellt. Diese Erinnerungen konnten nicht neu geplant werden: Medikamente, Sicherung.'
    );
  });
});
