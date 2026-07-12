import { describe, it, expect } from 'vitest';
import { isValidReminderTime, buildDailyReminderTrigger, buildScreeningReminderTrigger } from './reminderScheduling';

describe('isValidReminderTime', () => {
  it('accepts valid HH:mm times', () => {
    expect(isValidReminderTime('08:00')).toBe(true);
    expect(isValidReminderTime('23:59')).toBe(true);
    expect(isValidReminderTime('00:00')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidReminderTime('8:00')).toBe(false);
    expect(isValidReminderTime('24:00')).toBe(false);
    expect(isValidReminderTime('12:60')).toBe(false);
    expect(isValidReminderTime('abc')).toBe(false);
  });
});

describe('buildDailyReminderTrigger', () => {
  it('parses a valid time into hour and minute', () => {
    expect(buildDailyReminderTrigger('08:30')).toEqual({ type: 'daily', hour: 8, minute: 30 });
  });

  it('throws on an invalid time', () => {
    expect(() => buildDailyReminderTrigger('25:00')).toThrow('Ungültige Erinnerungszeit');
  });
});

describe('buildScreeningReminderTrigger', () => {
  it('returns a date trigger for a future due date', () => {
    const now = new Date(2026, 0, 1, 8, 0, 0, 0);
    const trigger = buildScreeningReminderTrigger('2026-06-01', now);
    expect(trigger).toEqual({ type: 'date', date: new Date(2026, 5, 1, 9, 0, 0, 0) });
  });

  it('returns null when the due date has already passed', () => {
    const now = new Date(2026, 6, 1, 8, 0, 0, 0);
    expect(buildScreeningReminderTrigger('2026-06-01', now)).toBeNull();
  });

  it('returns null when the due date is today but the reminder time has already passed', () => {
    const now = new Date(2026, 5, 1, 10, 0, 0, 0);
    expect(buildScreeningReminderTrigger('2026-06-01', now)).toBeNull();
  });

  it('returns a date trigger when the due date is today and the reminder time has not passed yet', () => {
    const now = new Date(2026, 5, 1, 7, 0, 0, 0);
    expect(buildScreeningReminderTrigger('2026-06-01', now)).toEqual({
      type: 'date',
      date: new Date(2026, 5, 1, 9, 0, 0, 0),
    });
  });
});
