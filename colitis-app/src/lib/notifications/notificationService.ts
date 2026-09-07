import * as Notifications from 'expo-notifications';
import { buildDailyReminderTrigger, buildScreeningReminderTrigger } from '../../features/medications/reminderScheduling';
import { runWithPendingPermission } from '../permissions/pendingPermissionGuard';

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

/**
 * Ab Android 13 zeigt diese Anfrage einen Systemdialog, der die App in den
 * Hintergrund legt. Der Merker haelt die App-Sperre so lange zurueck --
 * derselbe Schutz, den der Standort-Dialog seit dem 23.07. hat. Er sitzt hier
 * und nicht an den Aufrufstellen, weil es sechs davon gibt und die siebte
 * sonst wieder ohne auskommt.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await runWithPendingPermission(() =>
    Notifications.requestPermissionsAsync()
  );
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

export async function scheduleDateReminder(date: Date, content: ReminderContent): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

/**
 * Hinterlegt die Kennung einer eben geplanten Benachrichtigung. Schlaegt das
 * Hinterlegen fehl, wird die Benachrichtigung wieder storniert und der Fehler
 * weitergereicht: Eine Benachrichtigung, deren Kennung niemand kennt, laesst
 * sich spaeter nicht mehr gezielt abbestellen -- sie kaeme weiter, auch nachdem
 * der Nutzer die Erinnerung ausgeschaltet hat.
 *
 * `null` heisst, dass gar nichts geplant wurde; dann gibt es auch nichts zu
 * stornieren.
 */
export async function rememberScheduledReminder(
  notificationId: string | null,
  remember: (notificationId: string | null) => Promise<void>
): Promise<void> {
  try {
    await remember(notificationId);
  } catch (error: unknown) {
    if (notificationId !== null) {
      await cancelScheduledReminder(notificationId);
    }
    throw error;
  }
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
