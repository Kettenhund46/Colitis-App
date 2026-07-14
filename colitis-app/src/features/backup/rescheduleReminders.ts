import {
  cancelAllScheduledReminders,
  configureNotificationHandling,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
} from '../medications/notifications/notificationService';
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
    const notificationId = await scheduleDailyReminder(reminderTime.time, {
      title: 'Medikamenten-Erinnerung',
      body: medication ? `Zeit für ${medication.name}` : 'Zeit für dein Medikament',
    });
    await setReminderTimeNotificationId(db, reminderTime.id, notificationId);
  }

  for (const screeningReminder of data.tables.screeningReminders) {
    const notificationId = await scheduleScreeningReminder(screeningReminder.nextDueDate, {
      title: 'Vorsorge-Koloskopie',
      body:
        screeningReminder.note && screeningReminder.note.length > 0
          ? screeningReminder.note
          : 'Deine Vorsorge-Koloskopie ist fällig.',
    });
    await setScreeningReminderNotificationId(db, screeningReminder.id, notificationId);
  }
}
