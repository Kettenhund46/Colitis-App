import {
  requestNotificationPermission,
  cancelScheduledReminder,
  rememberScheduledReminder,
  scheduleDateReminder,
} from '../../lib/notifications/notificationService';
import { buildAppointmentReminderTrigger, buildAppointmentReminderContent } from './appointmentReminder';
import { getDoctorVisitById, setDoctorVisitNotificationId } from './db/doctorVisitsRepository';
import type { DoctorVisitsDb } from './db/doctorVisitsRepository';

export type AppointmentReminderResult =
  | 'scheduled'
  | 'no-appointment'
  | 'in-past'
  | 'permission-denied'
  | 'visit-missing';

/**
 * Plant die Erinnerung an den Folgetermin eines Arztbesuchs neu. Eine bereits
 * geplante wird zuerst storniert, damit ein geaendertes Datum nicht zwei
 * Benachrichtigungen hinterlaesst.
 *
 * Der Besuch wird hier selbst geladen: Aufrufer haben mal das Formular, mal
 * nur die Kennung, und die zuletzt gespeicherte Benachrichtigungs-Kennung
 * steht ohnehin nur in der Datenbank.
 */
export async function rescheduleAppointmentReminder(
  db: DoctorVisitsDb,
  visitId: number,
  now: Date = new Date()
): Promise<AppointmentReminderResult> {
  const visit = await getDoctorVisitById(db, visitId);
  if (visit === null) {
    return 'visit-missing';
  }

  if (visit.nextAppointmentNotificationId !== null) {
    await cancelScheduledReminder(visit.nextAppointmentNotificationId);
    await setDoctorVisitNotificationId(db, visit.id, null);
  }

  if (visit.nextAppointmentDate === null) {
    return 'no-appointment';
  }

  const trigger = buildAppointmentReminderTrigger(visit.nextAppointmentDate, now);
  if (trigger === null) {
    return 'in-past';
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return 'permission-denied';
  }

  const notificationId = await scheduleDateReminder(trigger.date, buildAppointmentReminderContent(visit));
  await rememberScheduledReminder(notificationId, (id) => setDoctorVisitNotificationId(db, visit.id, id));
  return 'scheduled';
}

/**
 * Storniert die Erinnerung eines Besuchs. Vor dem Loeschen aufzurufen --
 * danach ist die Kennung nicht mehr zu finden und die Benachrichtigung
 * kaeme trotzdem.
 */
export async function cancelAppointmentReminder(db: DoctorVisitsDb, visitId: number): Promise<void> {
  const visit = await getDoctorVisitById(db, visitId);
  if (visit === null || visit.nextAppointmentNotificationId === null) {
    return;
  }
  await cancelScheduledReminder(visit.nextAppointmentNotificationId);
  await setDoctorVisitNotificationId(db, visit.id, null);
}
