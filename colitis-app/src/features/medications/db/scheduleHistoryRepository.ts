import { asc, eq } from 'drizzle-orm';
import { medicationScheduleHistory } from '../../../db/schema';
import { groupByMedication, planScheduleChange } from '../scheduleHistory';
import type { ScheduleHistory, ScheduleSegment } from '../scheduleHistory';
import type { MedicationsDb } from './medicationsRepository';

function rowToSegment(row: typeof medicationScheduleHistory.$inferSelect): ScheduleSegment {
  return {
    id: row.id,
    validFrom: row.validFrom,
    validTo: row.validTo,
    dosesPerDay: row.dosesPerDay,
  };
}

export async function listScheduleSegments(
  db: MedicationsDb,
  medicationId: number
): Promise<ScheduleSegment[]> {
  const rows = await db
    .select()
    .from(medicationScheduleHistory)
    .where(eq(medicationScheduleHistory.medicationId, medicationId))
    .orderBy(asc(medicationScheduleHistory.validFrom));
  return rows.map(rowToSegment);
}

/** Die Abschnitte aller Medikamente in einem Zug -- die Rueckschau braucht sie alle. */
export async function listScheduleHistory(db: MedicationsDb): Promise<ScheduleHistory> {
  const rows = await db
    .select()
    .from(medicationScheduleHistory)
    .orderBy(asc(medicationScheduleHistory.validFrom));

  return groupByMedication(
    rows.map((row) => ({ ...rowToSegment(row), medicationId: row.medicationId }))
  );
}

/**
 * Schreibt eine Aenderung der taeglichen Anzahl mit Wirkung ab `changeDate`
 * fort. Die Entscheidung, was zu tun ist, faellt in `planScheduleChange`;
 * hier wird sie nur ausgefuehrt.
 */
export async function applyScheduleChange(
  db: MedicationsDb,
  medicationId: number,
  changeDate: string,
  dosesPerDay: number
): Promise<void> {
  const segments = await listScheduleSegments(db, medicationId);
  const change = planScheduleChange(segments, changeDate, dosesPerDay);

  if (change.kind === 'none') {
    return;
  }

  if (change.kind === 'open') {
    await db
      .insert(medicationScheduleHistory)
      .values({
        medicationId,
        validFrom: change.validFrom,
        validTo: null,
        dosesPerDay: change.dosesPerDay,
      });
    return;
  }

  if (change.kind === 'replace') {
    await db
      .update(medicationScheduleHistory)
      .set({ dosesPerDay: change.dosesPerDay })
      .where(eq(medicationScheduleHistory.id, change.segmentId));
    return;
  }

  await db
    .update(medicationScheduleHistory)
    .set({ validTo: change.validTo })
    .where(eq(medicationScheduleHistory.id, change.segmentId));
  await db
    .insert(medicationScheduleHistory)
    .values({
      medicationId,
      validFrom: change.validFrom,
      validTo: null,
      dosesPerDay: change.dosesPerDay,
    });
}

/**
 * Beendet die Historie zum Enddatum.
 *
 * Wird ein Medikament rueckwirkend beendet, koennen mehrere Abschnitte hinter
 * dem Enddatum liegen. Die verschwinden, und der letzte verbleibende endet am
 * Enddatum -- sonst bliebe ein Abschnitt stehen, der ueber das Ende des
 * Medikaments hinausreicht.
 */
export async function closeScheduleAt(
  db: MedicationsDb,
  medicationId: number,
  endDate: string
): Promise<void> {
  const segments = await listScheduleSegments(db, medicationId);

  for (const segment of segments) {
    if (endDate < segment.validFrom) {
      await db.delete(medicationScheduleHistory).where(eq(medicationScheduleHistory.id, segment.id));
    }
  }

  const remaining = segments.filter((segment) => endDate >= segment.validFrom);
  const last = remaining[remaining.length - 1];
  if (last === undefined || (last.validTo !== null && last.validTo <= endDate)) {
    return;
  }

  await db
    .update(medicationScheduleHistory)
    .set({ validTo: endDate })
    .where(eq(medicationScheduleHistory.id, last.id));
}

/**
 * Zieht den fruehesten Abschnitt auf das Startdatum des Medikaments nach.
 * Wird das Startdatum vorverlegt, laegen die Tage davor sonst ausserhalb
 * jedes Abschnitts und fielen aus der Rueckschau heraus.
 */
export async function alignHistoryStart(
  db: MedicationsDb,
  medicationId: number,
  startDate: string
): Promise<void> {
  const segments = await listScheduleSegments(db, medicationId);
  const earliest = segments[0];
  if (earliest === undefined || earliest.validFrom === startDate) {
    return;
  }
  // Nur solange der Abschnitt danach noch Tage behaelt.
  if (earliest.validTo !== null && startDate > earliest.validTo) {
    return;
  }
  await db
    .update(medicationScheduleHistory)
    .set({ validFrom: startDate })
    .where(eq(medicationScheduleHistory.id, earliest.id));
}

/** Loescht die Historie eines Medikaments -- Kind vor Elternteil. */
export async function deleteScheduleHistory(
  db: MedicationsDb,
  medicationId: number
): Promise<void> {
  await db
    .delete(medicationScheduleHistory)
    .where(eq(medicationScheduleHistory.medicationId, medicationId));
}
