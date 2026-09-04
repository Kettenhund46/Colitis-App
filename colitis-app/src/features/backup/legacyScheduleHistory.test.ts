import { describe, it, expect } from 'vitest';
import { scheduleHistoryForImport } from './legacyScheduleHistory';
import type { medicationReminderTimes, medications } from '../../db/schema';

type MedicationRow = typeof medications.$inferSelect;
type ReminderTimeRow = typeof medicationReminderTimes.$inferSelect;

function medicationRow(overrides: Partial<MedicationRow> & { id: number }): MedicationRow {
  return {
    name: 'Mesalazin',
    dose: '500mg',
    schedule: '3x täglich',
    startDate: '2026-06-01',
    endDate: null,
    sideEffectsNote: null,
    unitsPerIntake: 1,
    packUnits: null,
    stockUnits: null,
    supplyNotificationId: null,
    ...overrides,
  };
}

function reminderTimeRow(id: number, medicationId: number): ReminderTimeRow {
  return { id, medicationId, time: '08:00', notificationId: null };
}

describe('scheduleHistoryForImport', () => {
  it('opens one segment per medication over its whole runtime', () => {
    const rows = scheduleHistoryForImport(
      [medicationRow({ id: 5, startDate: '2026-06-01', endDate: '2026-08-31' })],
      [reminderTimeRow(1, 5), reminderTimeRow(2, 5), reminderTimeRow(3, 5)]
    );
    expect(rows).toEqual([
      { id: 1, medicationId: 5, validFrom: '2026-06-01', validTo: '2026-08-31', dosesPerDay: 3 },
    ]);
  });

  it('leaves a running medication open', () => {
    const rows = scheduleHistoryForImport([medicationRow({ id: 5 })], [reminderTimeRow(1, 5)]);
    expect(rows[0].validTo).toBeNull();
  });

  it('counts one due dose for a medication without reminder times', () => {
    const rows = scheduleHistoryForImport([medicationRow({ id: 5 })], []);
    expect(rows[0].dosesPerDay).toBe(1);
  });

  it('keeps the medications apart', () => {
    const rows = scheduleHistoryForImport(
      [medicationRow({ id: 5 }), medicationRow({ id: 6, startDate: '2026-07-01' })],
      [reminderTimeRow(1, 5), reminderTimeRow(2, 5), reminderTimeRow(3, 6)]
    );
    expect(rows.map((row) => [row.medicationId, row.dosesPerDay])).toEqual([
      [5, 2],
      [6, 1],
    ]);
  });

  it('gives every row its own id', () => {
    const rows = scheduleHistoryForImport(
      [medicationRow({ id: 5 }), medicationRow({ id: 6 })],
      []
    );
    expect(rows.map((row) => row.id)).toEqual([1, 2]);
  });

  it('is empty without a single medication', () => {
    expect(scheduleHistoryForImport([], [])).toEqual([]);
  });
});
