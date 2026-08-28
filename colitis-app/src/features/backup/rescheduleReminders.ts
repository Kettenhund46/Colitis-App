import {
  cancelAllScheduledReminders,
  configureNotificationHandling,
  rememberScheduledReminder,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
} from '../../lib/notifications/notificationService';
import {
  buildMedicationReminderContent,
  buildScreeningReminderContent,
} from '../medications/notifications/reminderContent';
import { setReminderTimeNotificationId } from '../medications/db/medicationsRepository';
import { setScreeningReminderNotificationId } from '../medications/db/screeningRepository';
import type { BackupDb } from './db/backupRepository';
import type { BackupData } from './types';

export async function rescheduleAllReminders(db: BackupDb, data: BackupData): Promise<void> {
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
}
