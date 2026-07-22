import { desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { doctorVisits } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { DoctorVisit, DoctorVisitInput } from '../types';

export type DoctorVisitsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createDoctorVisit(db: DoctorVisitsDb, input: DoctorVisitInput): Promise<DoctorVisit> {
  const [inserted] = await db
    .insert(doctorVisits)
    .values({
      visitDate: input.visitDate,
      doctorName: input.doctorName,
      reason: input.reason,
      note: input.note,
      nextAppointmentDate: input.nextAppointmentDate,
    })
    .returning({ id: doctorVisits.id });

  return {
    id: inserted.id,
    visitDate: input.visitDate,
    doctorName: input.doctorName,
    reason: input.reason,
    note: input.note,
    nextAppointmentDate: input.nextAppointmentDate,
  };
}

export async function listDoctorVisits(db: DoctorVisitsDb): Promise<DoctorVisit[]> {
  return db.select().from(doctorVisits).orderBy(desc(doctorVisits.visitDate));
}

export async function getDoctorVisitById(db: DoctorVisitsDb, visitId: number): Promise<DoctorVisit | null> {
  const rows = await db.select().from(doctorVisits).where(eq(doctorVisits.id, visitId));
  return rows.length > 0 ? rows[0] : null;
}

async function assertDoctorVisitExists(db: DoctorVisitsDb, visitId: number): Promise<void> {
  const rows = await db.select({ id: doctorVisits.id }).from(doctorVisits).where(eq(doctorVisits.id, visitId));
  if (rows.length === 0) {
    throw new Error(`Arztbesuch mit ID ${visitId} wurde nicht gefunden.`);
  }
}

export async function updateDoctorVisit(db: DoctorVisitsDb, visitId: number, input: DoctorVisitInput): Promise<void> {
  await assertDoctorVisitExists(db, visitId);
  await db
    .update(doctorVisits)
    .set({
      visitDate: input.visitDate,
      doctorName: input.doctorName,
      reason: input.reason,
      note: input.note,
      nextAppointmentDate: input.nextAppointmentDate,
    })
    .where(eq(doctorVisits.id, visitId));
}

export async function deleteDoctorVisit(db: DoctorVisitsDb, visitId: number): Promise<void> {
  await assertDoctorVisitExists(db, visitId);
  await db.delete(doctorVisits).where(eq(doctorVisits.id, visitId));
}
