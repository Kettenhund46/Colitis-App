import {
  getDiaryReminderEnabled,
  getDiaryReminderTime,
  getDiaryReminderNotificationId,
  setDiaryReminderNotificationId,
} from '../settings/settingsStorage';
import { isValidReminderTime } from '../medications/reminderScheduling';
import {
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleDailyReminder,
} from '../../lib/notifications/notificationService';

const DIARY_REMINDER_CONTENT = {
  title: 'Wie war dein Tag?',
  body: 'Kurz im Tagebuch festhalten.',
};

export type DiaryReminderResult =
  | 'scheduled'
  | 'disabled'
  | 'invalid-time'
  | 'permission-denied'
  | 'failed';

export async function rescheduleDiaryReminder(): Promise<DiaryReminderResult> {
  const [enabled, time] = await Promise.all([getDiaryReminderEnabled(), getDiaryReminderTime()]);

  if (enabled && !isValidReminderTime(time)) {
    return 'invalid-time';
  }

  const existingNotificationId = await getDiaryReminderNotificationId();
  if (existingNotificationId !== null) {
    await cancelScheduledReminder(existingNotificationId);
    await setDiaryReminderNotificationId(null);
  }

  if (!enabled) {
    return 'disabled';
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return 'permission-denied';
  }

  try {
    const notificationId = await scheduleDailyReminder(time, DIARY_REMINDER_CONTENT);
    await setDiaryReminderNotificationId(notificationId);
    return 'scheduled';
  } catch (error: unknown) {
    console.error('[Tagebuch] Erinnerung konnte nicht geplant werden:', error);
    await setDiaryReminderNotificationId(null);
    return 'failed';
  }
}
