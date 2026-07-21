import * as Notifications from 'expo-notifications';
import { buildDailyReminderTrigger, buildScreeningReminderTrigger } from '../../features/medications/reminderScheduling';

export interface ReminderContent {
  title: string;
  body: string;
}

export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(time: string, content: ReminderContent): Promise<string> {
  const { hour, minute } = buildDailyReminderTrigger(time);
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export async function scheduleScreeningReminder(
  nextDueDate: string,
  content: ReminderContent,
  now: Date = new Date()
): Promise<string | null> {
  const trigger = buildScreeningReminderTrigger(nextDueDate, now);
  if (trigger === null) {
    return null;
  }
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.date },
  });
}

export async function cancelScheduledReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error: unknown) {
    console.error('[Medikamente] Erinnerung konnte nicht storniert werden:', error);
  }
}

export async function cancelAllScheduledReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
