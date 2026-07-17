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
