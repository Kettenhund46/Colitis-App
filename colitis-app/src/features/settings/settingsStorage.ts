import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from '../../theme/types';

const THEME_STORAGE_KEY = 'colitis2go.settings.themeId';
const DAILY_JOKE_ENABLED_KEY = 'colitis2go.settings.dailyJokeEnabled';
const INCLUDE_ILLNESS_JOKES_KEY = 'colitis2go.settings.includeIllnessJokes';

const VALID_THEME_IDS: ThemeId[] = ['light', 'dark', 'light-blue'];

function isThemeId(value: string | null): value is ThemeId {
  return VALID_THEME_IDS.includes(value as ThemeId);
}

export async function getThemeId(): Promise<ThemeId> {
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : 'light';
}

export async function setThemeId(themeId: ThemeId): Promise<void> {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
}

export async function getDailyJokeEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(DAILY_JOKE_ENABLED_KEY);
  return stored === 'true';
}

export async function setDailyJokeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DAILY_JOKE_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getIncludeIllnessJokes(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(INCLUDE_ILLNESS_JOKES_KEY);
  return stored === 'true';
}

export async function setIncludeIllnessJokes(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(INCLUDE_ILLNESS_JOKES_KEY, enabled ? 'true' : 'false');
}

const BACKUP_REMINDER_ENABLED_KEY = 'colitis2go.settings.backupReminderEnabled';
const BACKUP_REMINDER_INTERVAL_DAYS_KEY = 'colitis2go.settings.backupReminderIntervalDays';
const LAST_BACKUP_AT_KEY = 'colitis2go.settings.lastBackupAt';
const BACKUP_REMINDER_NOTIFICATION_ID_KEY = 'colitis2go.settings.backupReminderNotificationId';

const DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS = 30;

export async function getBackupReminderEnabledRaw(): Promise<boolean | null> {
  const stored = await AsyncStorage.getItem(BACKUP_REMINDER_ENABLED_KEY);
  if (stored === null) {
    return null;
  }
  return stored === 'true';
}

export async function setBackupReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BACKUP_REMINDER_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getBackupReminderIntervalDays(): Promise<number> {
  const stored = await AsyncStorage.getItem(BACKUP_REMINDER_INTERVAL_DAYS_KEY);
  const parsed = stored === null ? NaN : Number(stored);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS;
}

export async function setBackupReminderIntervalDays(days: number): Promise<void> {
  await AsyncStorage.setItem(BACKUP_REMINDER_INTERVAL_DAYS_KEY, String(days));
}

export async function getLastBackupAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_BACKUP_AT_KEY);
}

export async function setLastBackupAt(isoDate: string): Promise<void> {
  await AsyncStorage.setItem(LAST_BACKUP_AT_KEY, isoDate);
}

export async function getBackupReminderNotificationId(): Promise<string | null> {
  return AsyncStorage.getItem(BACKUP_REMINDER_NOTIFICATION_ID_KEY);
}

export async function setBackupReminderNotificationId(notificationId: string | null): Promise<void> {
  if (notificationId === null) {
    await AsyncStorage.removeItem(BACKUP_REMINDER_NOTIFICATION_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(BACKUP_REMINDER_NOTIFICATION_ID_KEY, notificationId);
}

const COMMUNITY_DISCLAIMER_SEEN_KEY = 'colitis2go.settings.communityDisclaimerSeen';

export async function getCommunityDisclaimerSeen(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(COMMUNITY_DISCLAIMER_SEEN_KEY);
  return stored === 'true';
}

export async function setCommunityDisclaimerSeen(seen: boolean): Promise<void> {
  await AsyncStorage.setItem(COMMUNITY_DISCLAIMER_SEEN_KEY, seen ? 'true' : 'false');
}

const SWIPE_NAVIGATION_ENABLED_KEY = 'colitis2go.settings.swipeNavigationEnabled';

/** Voreinstellung: eingeschaltet, solange nichts gespeichert wurde. */
export async function getSwipeNavigationEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(SWIPE_NAVIGATION_ENABLED_KEY);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
}

export async function setSwipeNavigationEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SWIPE_NAVIGATION_ENABLED_KEY, enabled ? 'true' : 'false');
}
