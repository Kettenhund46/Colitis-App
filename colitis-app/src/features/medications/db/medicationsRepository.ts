import { asc, eq, like } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { medications, medicationReminderTimes, medicationLog } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Medication, MedicationInput, MedicationReminderTime } from '../types';

export type MedicationsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createMedication(db: MedicationsDb, input: MedicationInput): Promise<Medication> {
  const [insertedMedication] = await db
    .insert(medications)
    .values({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      sideEffectsNote: input.sideEffectsNote,
    })
    .returning({ id: medications.id });

  const reminderTimes = await insertReminderTimes(db, insertedMedication.id, input.reminderTimes);

  return {
    id: insertedMedication.id,
    name: input.name,
    dose: input.dose,
    schedule: input.schedule,
    startDate: input.startDate,
    endDate: input.endDate,
    sideEffectsNote: input.sideEffectsNote,
    reminderTimes,
  };
}

async function insertReminderTimes(
  db: MedicationsDb,
  medicationId: number,
  times: string[]
): Promise<MedicationReminderTime[]> {
  const result: MedicationReminderTime[] = [];
  for (const time of times) {
    const [inserted] = await db
      .insert(medicationReminderTimes)
      .values({ medicationId, time, notificationId: null })
      .returning({ id: medicationReminderTimes.id });
    result.push({ id: inserted.id, time, notificationId: null });
  }
  return result;
}

async function loadReminderTimes(db: MedicationsDb, medicationId: number): Promise<MedicationReminderTime[]> {
  const rows = await db
    .select()
    .from(medicationReminderTimes)
    .where(eq(medicationReminderTimes.medicationId, medicationId));
  return rows.map((row) => ({ id: row.id, time: row.time, notificationId: row.notificationId }));
}

async function assertMedicationExists(db: MedicationsDb, medicationId: number): Promise<void> {
  const rows = await db.select({ id: medications.id }).from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    throw new Error(`Medikament mit ID ${medicationId} wurde nicht gefunden.`);
  }
}

export async function listMedications(db: MedicationsDb): Promise<Medication[]> {
  const medicationRows = await db.select().from(medications).orderBy(asc(medications.name));

  const result: Medication[] = [];
  for (const medication of medicationRows) {
    result.push({
      id: medication.id,
      name: medication.name,
      dose: medication.dose,
      schedule: medication.schedule,
      startDate: medication.startDate,
      endDate: medication.endDate,
      sideEffectsNote: medication.sideEffectsNote,
      reminderTimes: await loadReminderTimes(db, medication.id),
    });
  }
  return result;
}

export async function getMedicationById(db: MedicationsDb, medicationId: number): Promise<Medication | null> {
  const rows = await db.select().from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    return null;
  }
  const medication = rows[0];
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose,
    schedule: medication.schedule,
    startDate: medication.startDate,
    endDate: medication.endDate,
    sideEffectsNote: medication.sideEffectsNote,
    reminderTimes: await loadReminderTimes(db, medication.id),
  };
}

export interface ReminderTimesReplaceResult {
  removed: MedicationReminderTime[];
  inserted: MedicationReminderTime[];
}

export async function updateMedication(
  db: MedicationsDb,
  medicationId: number,
  input: MedicationInput
): Promise<ReminderTimesReplaceResult> {
  await assertMedicationExists(db, medicationId);

  await db
    .update(medications)
    .set({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
      sideEffectsNote: input.sideEffectsNote,
    })
    .where(eq(medications.id, medicationId));

  const removed = await loadReminderTimes(db, medicationId);

  await db.delete(medicationReminderTimes).where(eq(medicationReminderTimes.medicationId, medicationId));

  const inserted = await insertReminderTimes(db, medicationId, input.reminderTimes);

  return { removed, inserted };
}

export async function endMedication(
  db: MedicationsDb,
  medicationId: number,
  endDate: string
): Promise<MedicationReminderTime[]> {
  await assertMedicationExists(db, medicationId);
  await db.update(medications).set({ endDate }).where(eq(medications.id, medicationId));
  return loadReminderTimes(db, medicationId);
}

export async function setReminderTimeNotificationId(
  db: MedicationsDb,
  reminderTimeId: number,
  notificationId: string | null
): Promise<void> {
  await db
    .update(medicationReminderTimes)
    .set({ notificationId })
    .where(eq(medicationReminderTimes.id, reminderTimeId));
}

export async function logMedicationTaken(db: MedicationsDb, medicationId: number, takenAt: string): Promise<void> {
  await assertMedicationExists(db, medicationId);
  await db.insert(medicationLog).values({ medicationId, takenAt });
}

export async function listMedicationIdsTakenOn(db: MedicationsDb, date: string): Promise<number[]> {
  const rows = await db
    .select({ medicationId: medicationLog.medicationId })
    .from(medicationLog)
    .where(like(medicationLog.takenAt, `${date}%`));
  return [...new Set(rows.map((row) => row.medicationId))];
}

export async function deleteMedication(db: MedicationsDb, medicationId: number): Promise<MedicationReminderTime[]> {
  await assertMedicationExists(db, medicationId);
  const reminderTimes = await loadReminderTimes(db, medicationId);
  await db.delete(medicationLog).where(eq(medicationLog.medicationId, medicationId));
  await db.delete(medicationReminderTimes).where(eq(medicationReminderTimes.medicationId, medicationId));
  await db.delete(medications).where(eq(medications.id, medicationId));
  return reminderTimes;
}
