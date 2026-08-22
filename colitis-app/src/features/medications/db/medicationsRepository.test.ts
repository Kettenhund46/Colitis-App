import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  createMedication,
  listMedications,
  getMedicationById,
  updateMedication,
  endMedication,
  setReminderTimeNotificationId,
  logMedicationTaken,
  listMedicationIntakes,
  deleteMedicationIntake,
  deleteMedication,
} from './medicationsRepository';
import { medicationLog, medicationReminderTimes } from '../../../db/schema';

describe('medications repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a medication with its reminder times', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich morgens',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00'],
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('Salofalk');
    expect(created.reminderTimes).toHaveLength(1);
    expect(created.reminderTimes[0].time).toBe('08:00');
    expect(created.reminderTimes[0].notificationId).toBeNull();
  });

  it('lists medications ordered by name, with their reminder times', async () => {
    await createMedication(db, {
      name: 'Tremfya',
      dose: '100mg',
      schedule: 'alle 8 Wochen',
      startDate: '2026-01-01',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });
    await createMedication(db, {
      name: 'Azathioprin',
      dose: '50mg',
      schedule: '1x täglich abends',
      startDate: '2026-01-01',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['21:00'],
    });

    const list = await listMedications(db);

    expect(list.map((medication) => medication.name)).toEqual(['Azathioprin', 'Tremfya']);
    expect(list[0].reminderTimes.map((reminderTime) => reminderTime.time)).toEqual(['21:00']);
  });

  it('gets a single medication by id', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });

    const found = await getMedicationById(db, created.id);
    expect(found?.name).toBe('Salofalk');

    const notFound = await getMedicationById(db, created.id + 999);
    expect(notFound).toBeNull();
  });

  it('replaces reminder times on update and reports removed/inserted rows', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00'],
    });

    const { removed, inserted } = await updateMedication(db, created.id, {
      name: 'Salofalk',
      dose: '1000mg',
      schedule: '2x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00', '20:00'],
    });

    expect(removed).toHaveLength(1);
    expect(removed[0].time).toBe('08:00');
    expect(inserted.map((reminderTime) => reminderTime.time)).toEqual(['08:00', '20:00']);

    const updated = await getMedicationById(db, created.id);
    expect(updated?.dose).toBe('1000mg');
    expect(updated?.reminderTimes).toHaveLength(2);
  });

  it('ends a medication and returns its current reminder times', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00'],
    });

    const reminderTimes = await endMedication(db, created.id, '2026-08-01');

    expect(reminderTimes).toHaveLength(1);
    const ended = await getMedicationById(db, created.id);
    expect(ended?.endDate).toBe('2026-08-01');
  });

  it('persists a notification id for a reminder time', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00'],
    });

    await setReminderTimeNotificationId(db, created.reminderTimes[0].id, 'notif-abc');

    const found = await getMedicationById(db, created.id);
    expect(found?.reminderTimes[0].notificationId).toBe('notif-abc');
  });

  it('logs a medication as taken', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });

    await logMedicationTaken(db, created.id, '2026-07-12T08:05:00.000Z');

    const rows = await db.select().from(medicationLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].medicationId).toBe(created.id);
    expect(rows[0].takenAt).toBe('2026-07-12T08:05:00.000Z');
  });

  it('throws when updating a medication that does not exist', async () => {
    await expect(
      updateMedication(db, 999999, {
        name: 'Ghost',
        dose: '1mg',
        schedule: '1x täglich',
        startDate: '2026-07-12',
        endDate: null,
        sideEffectsNote: null,
        reminderTimes: [],
      })
    ).rejects.toThrow('Medikament mit ID 999999 wurde nicht gefunden.');
  });

  it('throws when logging a taken dose for a medication that does not exist', async () => {
    await expect(logMedicationTaken(db, 999999, '2026-07-12T08:00:00.000Z')).rejects.toThrow(
      'Medikament mit ID 999999 wurde nicht gefunden.'
    );
  });

  it('throws when ending a medication that does not exist', async () => {
    await expect(endMedication(db, 999999, '2026-08-01')).rejects.toThrow(
      'Medikament mit ID 999999 wurde nicht gefunden.'
    );
  });

  it('deletes a medication along with its reminder times and log entries', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: ['08:00', '20:00'],
    });
    await logMedicationTaken(db, created.id, '2026-07-16T08:05:00.000Z');

    const removedReminderTimes = await deleteMedication(db, created.id);

    expect(removedReminderTimes.map((reminderTime) => reminderTime.time)).toEqual(['08:00', '20:00']);
    expect(await getMedicationById(db, created.id)).toBeNull();
    expect(await db.select().from(medicationReminderTimes)).toHaveLength(0);
    expect(await db.select().from(medicationLog)).toHaveLength(0);
  });

  it('throws when deleting a medication that does not exist', async () => {
    await expect(deleteMedication(db, 999999)).rejects.toThrow('Medikament mit ID 999999 wurde nicht gefunden.');
  });

  it('persists and returns a side effects note', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: 'Verursacht gelegentlich Übelkeit',
      reminderTimes: [],
    });

    expect(created.sideEffectsNote).toBe('Verursacht gelegentlich Übelkeit');

    const found = await getMedicationById(db, created.id);
    expect(found?.sideEffectsNote).toBe('Verursacht gelegentlich Übelkeit');
  });

  it('updates a side effects note back to null', async () => {
    const created = await createMedication(db, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: 'Übelkeit',
      reminderTimes: [],
    });

    await updateMedication(db, created.id, {
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });

    const updated = await getMedicationById(db, created.id);
    expect(updated?.sideEffectsNote).toBeNull();
  });

  async function createSimpleMedication(name: string) {
    return createMedication(db, {
      name,
      dose: '500mg',
      schedule: '3x täglich',
      startDate: '2026-08-01',
      endDate: null,
      sideEffectsNote: null,
      reminderTimes: [],
    });
  }

  it('lists every intake with its row id, oldest first', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-20T11:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');

    const intakes = await listMedicationIntakes(db, null);

    expect(intakes).toHaveLength(2);
    expect(intakes[0].takenAt).toBe('2026-08-20T06:00:00.000Z');
    expect(intakes[1].takenAt).toBe('2026-08-20T11:00:00.000Z');
    expect(intakes[0].medicationId).toBe(medication.id);
    expect(intakes[0].id).toBeGreaterThan(0);
  });

  it('keeps several intakes of the same medication on the same day apart', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T11:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T17:00:00.000Z');

    expect(await listMedicationIntakes(db, null)).toHaveLength(3);
  });

  it('drops intakes before the lower bound', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-18T06:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');

    const intakes = await listMedicationIntakes(db, '2026-08-19T00:00:00.000Z');

    expect(intakes.map((intake) => intake.takenAt)).toEqual(['2026-08-20T06:00:00.000Z']);
  });

  it('keeps an intake that sits exactly on the lower bound', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-19T00:00:00.000Z');

    expect(await listMedicationIntakes(db, '2026-08-19T00:00:00.000Z')).toHaveLength(1);
  });

  it('deletes a single intake and leaves the others alone', async () => {
    const medication = await createSimpleMedication('Mesalazin');
    await logMedicationTaken(db, medication.id, '2026-08-20T06:00:00.000Z');
    await logMedicationTaken(db, medication.id, '2026-08-20T11:00:00.000Z');
    const intakes = await listMedicationIntakes(db, null);

    await deleteMedicationIntake(db, intakes[0].id);

    const remaining = await listMedicationIntakes(db, null);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].takenAt).toBe('2026-08-20T11:00:00.000Z');
  });

  it('stays quiet when the intake is already gone', async () => {
    await expect(deleteMedicationIntake(db, 999)).resolves.toBeUndefined();
  });
});
