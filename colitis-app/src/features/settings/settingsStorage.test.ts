import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storeMock.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storeMock.delete(key);
      return Promise.resolve();
    }),
  },
}));

import {
  getThemeId,
  setThemeId,
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
  getBackupReminderEnabledRaw,
  setBackupReminderEnabled,
  getBackupReminderIntervalDays,
  setBackupReminderIntervalDays,
  getLastBackupAt,
  setLastBackupAt,
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
  getCommunityDisclaimerSeen,
  setCommunityDisclaimerSeen,
} from './settingsStorage';

beforeEach(() => {
  storeMock.clear();
  vi.clearAllMocks();
});

describe('getThemeId', () => {
  it('returns "light" when nothing is stored', async () => {
    expect(await getThemeId()).toBe('light');
  });

  it('returns the persisted theme after setThemeId', async () => {
    await setThemeId('dark');
    expect(await getThemeId()).toBe('dark');
  });

  it('falls back to "light" for an invalid stored value', async () => {
    storeMock.set('colitis2go.settings.themeId', 'not-a-real-theme');
    expect(await getThemeId()).toBe('light');
  });
});

describe('daily joke settings', () => {
  it('defaults dailyJokeEnabled to false', async () => {
    expect(await getDailyJokeEnabled()).toBe(false);
  });

  it('persists dailyJokeEnabled', async () => {
    await setDailyJokeEnabled(true);
    expect(await getDailyJokeEnabled()).toBe(true);
  });

  it('defaults includeIllnessJokes to false', async () => {
    expect(await getIncludeIllnessJokes()).toBe(false);
  });

  it('persists includeIllnessJokes independently from dailyJokeEnabled', async () => {
    await setDailyJokeEnabled(true);
    await setIncludeIllnessJokes(true);
    expect(await getDailyJokeEnabled()).toBe(true);
    expect(await getIncludeIllnessJokes()).toBe(true);
  });
});

describe('backup reminder settings', () => {
  it('returns null for backupReminderEnabledRaw when never set', async () => {
    expect(await getBackupReminderEnabledRaw()).toBeNull();
  });

  it('persists an explicit backupReminderEnabled value', async () => {
    await setBackupReminderEnabled(false);
    expect(await getBackupReminderEnabledRaw()).toBe(false);
    await setBackupReminderEnabled(true);
    expect(await getBackupReminderEnabledRaw()).toBe(true);
  });

  it('defaults backupReminderIntervalDays to 30', async () => {
    expect(await getBackupReminderIntervalDays()).toBe(30);
  });

  it('persists backupReminderIntervalDays', async () => {
    await setBackupReminderIntervalDays(60);
    expect(await getBackupReminderIntervalDays()).toBe(60);
  });

  it('defaults lastBackupAt to null', async () => {
    expect(await getLastBackupAt()).toBeNull();
  });

  it('persists lastBackupAt', async () => {
    await setLastBackupAt('2026-07-21T10:00:00.000Z');
    expect(await getLastBackupAt()).toBe('2026-07-21T10:00:00.000Z');
  });

  it('defaults backupReminderNotificationId to null', async () => {
    expect(await getBackupReminderNotificationId()).toBeNull();
  });

  it('persists and clears backupReminderNotificationId', async () => {
    await setBackupReminderNotificationId('notif-abc');
    expect(await getBackupReminderNotificationId()).toBe('notif-abc');
    await setBackupReminderNotificationId(null);
    expect(await getBackupReminderNotificationId()).toBeNull();
  });
});

describe('community disclaimer setting', () => {
  it('defaults communityDisclaimerSeen to false', async () => {
    expect(await getCommunityDisclaimerSeen()).toBe(false);
  });

  it('persists communityDisclaimerSeen', async () => {
    await setCommunityDisclaimerSeen(true);
    expect(await getCommunityDisclaimerSeen()).toBe(true);
  });
});
