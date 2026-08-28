import {
  getDiaryReminderEnabled,
  setDiaryReminderEnabled,
  getDiaryReminderTime,
  getDiaryReminderNotificationId,
  setDiaryReminderNotificationId,
} from '../settings/settingsStorage';
import { isValidReminderTime } from '../medications/reminderScheduling';
import {
  requestNotificationPermission,
  cancelScheduledReminder,
  rememberScheduledReminder,
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
  try {
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
      await setDiaryReminderEnabled(false);
      return 'permission-denied';
    }

    const notificationId = await scheduleDailyReminder(time, DIARY_REMINDER_CONTENT);
    await rememberScheduledReminder(notificationId, setDiaryReminderNotificationId);
    return 'scheduled';
  } catch (error: unknown) {
    // Die Einstellung bleibt an. Ein Fehlschlag hier ist voruebergehend --
    // beim naechsten Start der App wird erneut geplant. Frueher schaltete er
    // die Erinnerung dauerhaft ab, ohne dass der Nutzer je davon erfuhr.
    // Nur das Verweigern der Berechtigung schaltet ab; das ist oben geregelt.
    console.error('[Tagebuch] Erinnerung konnte nicht geplant werden:', error);
    await setDiaryReminderNotificationId(null).catch(() => undefined);
    return 'failed';
  }
}
