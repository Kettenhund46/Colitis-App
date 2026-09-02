import { asc, eq, gte } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { medications, medicationReminderTimes, medicationLog } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Medication, MedicationInput, MedicationReminderTime, MedicationIntake } from '../types';

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
      unitsPerIntake: input.unitsPerIntake,
      packUnits: input.packUnits,
      stockUnits: input.stockUnits,
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
    unitsPerIntake: input.unitsPerIntake,
    packUnits: input.packUnits,
    stockUnits: input.stockUnits,
    supplyNotificationId: null,
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

/**
 * Eine Zeile in ein Medikament. Lag zeichengleich in listMedications und
 * getMedicationById -- mit den vier Vorratsfeldern waere die Kopie zur
 * Fehlerquelle geworden.
 */
async function rowToMedication(
  db: MedicationsDb,
  row: typeof medications.$inferSelect
): Promise<Medication> {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose,
    schedule: row.schedule,
    startDate: row.startDate,
    endDate: row.endDate,
    sideEffectsNote: row.sideEffectsNote,
    unitsPerIntake: row.unitsPerIntake,
    packUnits: row.packUnits,
    stockUnits: row.stockUnits,
    supplyNotificationId: row.supplyNotificationId,
    reminderTimes: await loadReminderTimes(db, row.id),
  };
}

export async function listMedications(db: MedicationsDb): Promise<Medication[]> {
  const medicationRows = await db.select().from(medications).orderBy(asc(medications.name));

  const result: Medication[] = [];
  for (const medication of medicationRows) {
    result.push(await rowToMedication(db, medication));
  }
  return result;
}

export async function getMedicationById(db: MedicationsDb, medicationId: number): Promise<Medication | null> {
  const rows = await db.select().from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    return null;
  }
  return rowToMedication(db, rows[0]);
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
      unitsPerIntake: input.unitsPerIntake,
      packUnits: input.packUnits,
      stockUnits: input.stockUnits,
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

export async function setMedicationStock(
  db: MedicationsDb,
  medicationId: number,
  stockUnits: number | null
): Promise<void> {
  await db.update(medications).set({ stockUnits }).where(eq(medications.id, medicationId));
}

export async function setSupplyNotificationId(
  db: MedicationsDb,
  medicationId: number,
  supplyNotificationId: string | null
): Promise<void> {
  await db.update(medications).set({ supplyNotificationId }).where(eq(medications.id, medicationId));
}

export async function logMedicationTaken(db: MedicationsDb, medicationId: number, takenAt: string): Promise<void> {
  await assertMedicationExists(db, medicationId);
  await db.insert(medicationLog).values({ medicationId, takenAt });
}

/**
 * Alle Einnahmen ab der Untergrenze, aelteste zuerst. fromIsoInclusive null
 * liest das ganze Protokoll. Der gespeicherte Zeitstempel ist ISO in UTC,
 * deshalb ist der lexikografische Vergleich zugleich der zeitliche.
 */
export async function listMedicationIntakes(
  db: MedicationsDb,
  fromIsoInclusive: string | null
): Promise<MedicationIntake[]> {
  const columns = {
    id: medicationLog.id,
    medicationId: medicationLog.medicationId,
    takenAt: medicationLog.takenAt,
  };

  if (fromIsoInclusive === null) {
    return db.select(columns).from(medicationLog).orderBy(asc(medicationLog.takenAt));
  }

  return db
    .select(columns)
    .from(medicationLog)
    .where(gte(medicationLog.takenAt, fromIsoInclusive))
    .orderBy(asc(medicationLog.takenAt));
}

export async function deleteMedicationIntake(db: MedicationsDb, intakeId: number): Promise<void> {
  await db.delete(medicationLog).where(eq(medicationLog.id, intakeId));
}

export async function deleteMedication(db: MedicationsDb, medicationId: number): Promise<MedicationReminderTime[]> {
  await assertMedicationExists(db, medicationId);
  const reminderTimes = await loadReminderTimes(db, medicationId);
  await db.delete(medicationLog).where(eq(medicationLog.medicationId, medicationId));
  await db.delete(medicationReminderTimes).where(eq(medicationReminderTimes.medicationId, medicationId));
  await db.delete(medications).where(eq(medications.id, medicationId));
  return reminderTimes;
}
