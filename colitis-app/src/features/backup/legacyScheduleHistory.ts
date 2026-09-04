import { dosesFromReminderTimes } from '../medications/scheduleHistory';
import type { medicationReminderTimes, medications, medicationScheduleHistory } from '../../db/schema';

type MedicationRow = typeof medications.$inferSelect;
type ReminderTimeRow = typeof medicationReminderTimes.$inferSelect;
type ScheduleHistoryRow = typeof medicationScheduleHistory.$inferSelect;

/**
 * Zeitplan-Abschnitte fuer eine Sicherung, die noch keine enthaelt: je
 * Medikament einer, ueber seine ganze Laufzeit und mit der Anzahl aus seinen
 * Erinnerungszeiten.
 *
 * Genau das, was die Migration mit den vorhandenen Daten macht. Ohne diesen
 * Schritt kaeme eine aeltere Sicherung ohne jeden Abschnitt zurueck, und die
 * Rueckschau fiele auf ihren Notnagel zurueck.
 */
export function scheduleHistoryForImport(
  medicationRows: MedicationRow[],
  reminderTimeRows: ReminderTimeRow[]
): ScheduleHistoryRow[] {
  const countByMedication = new Map<number, number>();
  for (const row of reminderTimeRows) {
    countByMedication.set(row.medicationId, (countByMedication.get(row.medicationId) ?? 0) + 1);
  }

  return medicationRows.map((medication, index) => ({
    id: index + 1,
    medicationId: medication.id,
    validFrom: medication.startDate,
    validTo: medication.endDate,
    dosesPerDay: dosesFromReminderTimes(countByMedication.get(medication.id) ?? 0),
  }));
}
