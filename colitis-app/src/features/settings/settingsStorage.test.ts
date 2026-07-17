import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storeMock.set(key, value);
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
