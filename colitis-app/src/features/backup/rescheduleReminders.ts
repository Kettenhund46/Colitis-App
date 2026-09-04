import {
  cancelAllScheduledReminders,
  configureNotificationHandling,
  rememberScheduledReminder,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleDateReminder,
  scheduleScreeningReminder,
} from '../../lib/notifications/notificationService';
import {
  buildMedicationReminderContent,
  buildScreeningReminderContent,
} from '../medications/notifications/reminderContent';
import {
  setReminderTimeNotificationId,
  setSupplyNotificationId,
} from '../medications/db/medicationsRepository';
import { setScreeningReminderNotificationId } from '../medications/db/screeningRepository';
import { setDoctorVisitNotificationId } from '../doctorVisits/db/doctorVisitsRepository';
import { rescheduleSupplyReminder } from '../medications/scheduleSupplyReminder';
import { DEFAULT_PRESCRIPTION_LEAD_DAYS } from '../medications/supply';
import {
  buildAppointmentReminderTrigger,
  buildAppointmentReminderContent,
} from '../doctorVisits/appointmentReminder';
import { pausedMedicationIdsOn } from '../medications/scheduleHistory';
import { formatLocalDateKey } from '../../lib/localDate';
import type { BackupDb } from './db/backupRepository';
import type { BackupData } from './types';

export async function rescheduleAllReminders(
  db: BackupDb,
  data: BackupData,
  now: Date = new Date(),
  prescriptionLeadDays: number = DEFAULT_PRESCRIPTION_LEAD_DAYS
): Promise<void> {
  configureNotificationHandling();

  await cancelAllScheduledReminders();

  const granted = await requestNotificationPermission();
  if (!granted) {
    for (const reminderTime of data.tables.medicationReminderTimes) {
      await setReminderTimeNotificationId(db, reminderTime.id, null);
    }
    for (const screeningReminder of data.tables.screeningReminders) {
      await setScreeningReminderNotificationId(db, screeningReminder.id, null);
    }
    for (const visit of data.tables.doctorVisits) {
      await setDoctorVisitNotificationId(db, visit.id, null);
    }
    for (const medication of data.tables.medications) {
      await setSupplyNotificationId(db, medication.id, null);
    }
    return;
  }

  // Was zum Zeitpunkt der Sicherung pausiert war, bleibt pausiert: Eine
  // Wiederherstellung darf ein ausgesetztes Medikament nicht wieder klingeln
  // lassen.
  // Fehlen die Abschnitte -- aeltere Sicherung --, ist nichts pausiert.
  const pausedMedicationIds = pausedMedicationIdsOn(
    data.tables.medicationScheduleHistory ?? [],
    formatLocalDateKey(now)
  );

  for (const reminderTime of data.tables.medicationReminderTimes) {
    if (pausedMedicationIds.has(reminderTime.medicationId)) {
      await setReminderTimeNotificationId(db, reminderTime.id, null);
      continue;
    }
    const medication = data.tables.medications.find((candidate) => candidate.id === reminderTime.medicationId);
    const content = medication
      ? buildMedicationReminderContent(medication)
      : { title: 'Medikamenten-Erinnerung', body: 'Zeit für dein Medikament' };
    const notificationId = await scheduleDailyReminder(reminderTime.time, content);
    await rememberScheduledReminder(notificationId, (id) =>
      setReminderTimeNotificationId(db, reminderTime.id, id)
    );
  }

  for (const screeningReminder of data.tables.screeningReminders) {
    const notificationId = await scheduleScreeningReminder(
      screeningReminder.nextDueDate,
      buildScreeningReminderContent(screeningReminder)
    );
    await rememberScheduledReminder(notificationId, (id) =>
      setScreeningReminderNotificationId(db, screeningReminder.id, id)
    );
  }

  // Die aus der Sicherung stammenden Kennungen zeigen ins Leere -- oben wurde
  // alles storniert. Jeder Besuch bekommt deshalb entweder eine neue Kennung
  // oder ausdruecklich keine.
  for (const visit of data.tables.doctorVisits) {
    const trigger =
      visit.nextAppointmentDate === null
        ? null
        : buildAppointmentReminderTrigger(visit.nextAppointmentDate, now);

    if (trigger === null) {
      await setDoctorVisitNotificationId(db, visit.id, null);
      continue;
    }

    const notificationId = await scheduleDateReminder(trigger.date, buildAppointmentReminderContent(visit));
    await rememberScheduledReminder(notificationId, (id) => setDoctorVisitNotificationId(db, visit.id, id));
  }

  // Die Rezept-Erinnerungen haengen am Vorrat und damit an den
  // Erinnerungszeiten, die eben erst wieder eingespielt wurden. Deshalb
  // stehen sie am Ende und lesen das Medikament frisch aus der Datenbank.
  for (const medication of data.tables.medications) {
    await setSupplyNotificationId(db, medication.id, null);
    await rescheduleSupplyReminder(db, medication.id, prescriptionLeadDays, now);
  }
}
