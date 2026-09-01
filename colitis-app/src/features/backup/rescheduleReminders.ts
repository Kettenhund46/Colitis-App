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
import { setReminderTimeNotificationId } from '../medications/db/medicationsRepository';
import { setScreeningReminderNotificationId } from '../medications/db/screeningRepository';
import { setDoctorVisitNotificationId } from '../doctorVisits/db/doctorVisitsRepository';
import {
  buildAppointmentReminderTrigger,
  buildAppointmentReminderContent,
} from '../doctorVisits/appointmentReminder';
import type { BackupDb } from './db/backupRepository';
import type { BackupData } from './types';

export async function rescheduleAllReminders(
  db: BackupDb,
  data: BackupData,
  now: Date = new Date()
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
    return;
  }

  for (const reminderTime of data.tables.medicationReminderTimes) {
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
}
