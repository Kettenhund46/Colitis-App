import { describe, it, expect } from 'vitest';
import { resolveBackupReminderEnabled, buildBackupReminderTrigger } from './reminderScheduling';

describe('resolveBackupReminderEnabled', () => {
  it('returns the explicit raw value when set to true', () => {
    expect(resolveBackupReminderEnabled(true, null)).toBe(true);
  });

  it('returns the explicit raw value when set to false, even with a backup present', () => {
    expect(resolveBackupReminderEnabled(false, '2026-07-01T09:00:00.000Z')).toBe(false);
  });

  it('defaults to true when never explicitly set and a backup exists', () => {
    expect(resolveBackupReminderEnabled(null, '2026-07-01T09:00:00.000Z')).toBe(true);
  });

  it('defaults to false when never explicitly set and no backup exists yet', () => {
    expect(resolveBackupReminderEnabled(null, null)).toBe(false);
  });
});

describe('buildBackupReminderTrigger', () => {
  it('returns a date intervalDays after the last backup', () => {
    const lastBackupAt = '2026-01-01T09:00:00.000Z';
    const now = new Date('2026-01-01T10:00:00.000Z');
    const trigger = buildBackupReminderTrigger(lastBackupAt, 30, now);
    expect(trigger).toEqual(new Date('2026-01-31T09:00:00.000Z'));
  });

  it('returns null when the computed date has already passed', () => {
    const lastBackupAt = '2026-01-01T09:00:00.000Z';
    const now = new Date('2026-03-01T09:00:00.000Z');
    expect(buildBackupReminderTrigger(lastBackupAt, 30, now)).toBeNull();
  });

  it('returns null when the computed date equals now exactly', () => {
    const lastBackupAt = '2026-01-01T09:00:00.000Z';
    const now = new Date('2026-01-31T09:00:00.000Z');
    expect(buildBackupReminderTrigger(lastBackupAt, 30, now)).toBeNull();
  });
});
