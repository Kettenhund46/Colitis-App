import {
  getBackupReminderEnabledRaw,
  getBackupReminderIntervalDays,
  getLastBackupAt,
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
} from '../settings/settingsStorage';
import { resolveBackupReminderEnabled, buildBackupReminderTrigger } from './reminderScheduling';
import {
  requestNotificationPermission,
  cancelScheduledReminder,
  rememberScheduledReminder,
  scheduleDateReminder,
} from '../../lib/notifications/notificationService';

const BACKUP_REMINDER_CONTENT = {
  title: 'Backup-Erinnerung',
  body: 'Es ist Zeit, ein neues Backup deiner Daten zu erstellen.',
};

export async function rescheduleBackupReminder(now: Date = new Date()): Promise<void> {
  const existingNotificationId = await getBackupReminderNotificationId();
  if (existingNotificationId !== null) {
    await cancelScheduledReminder(existingNotificationId);
    await setBackupReminderNotificationId(null);
  }

  const [rawEnabled, intervalDays, lastBackupAt] = await Promise.all([
    getBackupReminderEnabledRaw(),
    getBackupReminderIntervalDays(),
    getLastBackupAt(),
  ]);

  if (lastBackupAt === null || !resolveBackupReminderEnabled(rawEnabled, lastBackupAt)) {
    return;
  }

  const triggerDate = buildBackupReminderTrigger(lastBackupAt, intervalDays, now);
  if (triggerDate === null) {
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }

  const notificationId = await scheduleDateReminder(triggerDate, BACKUP_REMINDER_CONTENT);
  await rememberScheduledReminder(notificationId, setBackupReminderNotificationId);
}
