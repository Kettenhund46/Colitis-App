import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_PRESCRIPTION_LEAD_DAYS,
  MAX_PRESCRIPTION_LEAD_DAYS,
} from '../medications/supply';
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

const PRESCRIPTION_LEAD_DAYS_KEY = 'colitis2go.settings.prescriptionLeadDays';

/**
 * Vorlauf in Tagen, bevor an ein neues Rezept erinnert wird. Anders als der
 * Normalwert der Stuhlgaenge hat er eine sinnvolle Vorgabe -- sieben Tage
 * passen fuer fast jedes Praeparat.
 */
export async function getPrescriptionLeadDays(): Promise<number> {
  const stored = await AsyncStorage.getItem(PRESCRIPTION_LEAD_DAYS_KEY);
  if (stored === null) {
    return DEFAULT_PRESCRIPTION_LEAD_DAYS;
  }
  const parsed = Number(stored);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_PRESCRIPTION_LEAD_DAYS) {
    return DEFAULT_PRESCRIPTION_LEAD_DAYS;
  }
  return parsed;
}

export async function setPrescriptionLeadDays(days: number): Promise<void> {
  await AsyncStorage.setItem(PRESCRIPTION_LEAD_DAYS_KEY, String(days));
}

const NORMAL_STOOL_FREQUENCY_KEY = 'colitis2go.settings.normalStoolFrequency';

/** Obergrenze, damit ein Tippfehler nicht als Normalwert durchgeht. */
export const MAX_NORMAL_STOOL_FREQUENCY = 20;

/**
 * Die uebliche Zahl an Stuhlgaengen pro Tag ausserhalb eines Schubs. `null`
 * heisst: noch nicht angegeben -- dann laesst sich die Krankheitsaktivitaet
 * nicht rechnen, weil ihr Frequenz-Teilwert relativ dazu zaehlt. Kein
 * Vorgabewert, weil geraten hier eine falsche Zahl erzeugen wuerde.
 */
export async function getNormalStoolFrequency(): Promise<number | null> {
  const stored = await AsyncStorage.getItem(NORMAL_STOOL_FREQUENCY_KEY);
  if (stored === null) {
    return null;
  }
  const parsed = Number(stored);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_NORMAL_STOOL_FREQUENCY) {
    return null;
  }
  return parsed;
}

export async function setNormalStoolFrequency(value: number | null): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(NORMAL_STOOL_FREQUENCY_KEY);
    return;
  }
  await AsyncStorage.setItem(NORMAL_STOOL_FREQUENCY_KEY, String(value));
}

const ONBOARDING_SEEN_KEY = 'colitis2go.settings.onboardingSeen';

export async function getOnboardingSeen(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
  return stored === 'true';
}

export async function setOnboardingSeen(seen: boolean): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, seen ? 'true' : 'false');
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

const DIARY_REMINDER_ENABLED_KEY = 'colitis2go.settings.diaryReminderEnabled';
const DIARY_REMINDER_TIME_KEY = 'colitis2go.settings.diaryReminderTime';
const DIARY_REMINDER_NOTIFICATION_ID_KEY = 'colitis2go.settings.diaryReminderNotificationId';

export const DEFAULT_DIARY_REMINDER_TIME = '20:00';

/** Voreinstellung: ausgeschaltet, solange nichts gespeichert wurde. */
export async function getDiaryReminderEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(DIARY_REMINDER_ENABLED_KEY);
  return stored === 'true';
}

export async function setDiaryReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DIARY_REMINDER_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getDiaryReminderTime(): Promise<string> {
  const stored = await AsyncStorage.getItem(DIARY_REMINDER_TIME_KEY);
  return stored ?? DEFAULT_DIARY_REMINDER_TIME;
}

export async function setDiaryReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(DIARY_REMINDER_TIME_KEY, time);
}

export async function getDiaryReminderNotificationId(): Promise<string | null> {
  return AsyncStorage.getItem(DIARY_REMINDER_NOTIFICATION_ID_KEY);
}

export async function setDiaryReminderNotificationId(notificationId: string | null): Promise<void> {
  if (notificationId === null) {
    await AsyncStorage.removeItem(DIARY_REMINDER_NOTIFICATION_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(DIARY_REMINDER_NOTIFICATION_ID_KEY, notificationId);
}
