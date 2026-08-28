import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

const setItemMock = vi.fn((key: string, value: string) => {
  storeMock.set(key, value);
  return Promise.resolve();
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
    setItem: (key: string, value: string) => setItemMock(key, value),
    removeItem: vi.fn((key: string) => {
      storeMock.delete(key);
      return Promise.resolve();
    }),
  },
}));

const cancelScheduledReminder = vi.fn();
const scheduleDailyReminder = vi.fn();
const requestNotificationPermission = vi.fn();

// Nachbau von `rememberScheduledReminder`: Das Original haengt an
// expo-notifications und ist in notificationService.test.ts geprueft. Hier
// zaehlt nur, dass ein Fehlschlag beim Hinterlegen die Benachrichtigung
// wieder storniert.
vi.mock('../../lib/notifications/notificationService', () => ({
  cancelScheduledReminder: (notificationId: string) => cancelScheduledReminder(notificationId),
  scheduleDailyReminder: (time: string, content: unknown) => scheduleDailyReminder(time, content),
  requestNotificationPermission: () => requestNotificationPermission(),
  rememberScheduledReminder: async (
    notificationId: string | null,
    remember: (notificationId: string | null) => Promise<void>
  ) => {
    try {
      await remember(notificationId);
    } catch (error: unknown) {
      if (notificationId !== null) {
        await cancelScheduledReminder(notificationId);
      }
      throw error;
    }
  },
}));

import { rescheduleDiaryReminder } from './scheduleDiaryReminder';
import {
  setDiaryReminderEnabled,
  setDiaryReminderTime,
  setDiaryReminderNotificationId,
  getDiaryReminderNotificationId,
  getDiaryReminderEnabled,
} from '../settings/settingsStorage';

describe('rescheduleDiaryReminder', () => {
  beforeEach(() => {
    storeMock.clear();

    cancelScheduledReminder.mockReset();
    cancelScheduledReminder.mockResolvedValue(undefined);
    scheduleDailyReminder.mockReset();
    scheduleDailyReminder.mockResolvedValue('neue-kennung');
    requestNotificationPermission.mockReset();
    requestNotificationPermission.mockResolvedValue(true);
  });

  it('leaves a running reminder untouched when the stored time is invalid', async () => {
    await setDiaryReminderNotificationId('alte-kennung');
    await setDiaryReminderEnabled(true);
    await setDiaryReminderTime('25:00');

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('invalid-time');
    expect(cancelScheduledReminder).not.toHaveBeenCalled();
    expect(scheduleDailyReminder).not.toHaveBeenCalled();
    expect(await getDiaryReminderNotificationId()).toBe('alte-kennung');
  });

  it('cancels the existing reminder and clears the id when switched off', async () => {
    await setDiaryReminderNotificationId('alte-kennung');
    await setDiaryReminderEnabled(false);

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('disabled');
    expect(cancelScheduledReminder).toHaveBeenCalledWith('alte-kennung');
    expect(scheduleDailyReminder).not.toHaveBeenCalled();
    expect(await getDiaryReminderNotificationId()).toBeNull();
  });

  it('schedules at the stored time and keeps the returned id', async () => {
    await setDiaryReminderEnabled(true);
    await setDiaryReminderTime('07:30');

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('scheduled');
    expect(scheduleDailyReminder).toHaveBeenCalledWith('07:30', expect.anything());
    expect(await getDiaryReminderNotificationId()).toBe('neue-kennung');
  });

  it('reports a denied permission and schedules nothing', async () => {
    requestNotificationPermission.mockResolvedValue(false);
    await setDiaryReminderEnabled(true);
    await setDiaryReminderTime('20:00');

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('permission-denied');
    expect(scheduleDailyReminder).not.toHaveBeenCalled();
    expect(await getDiaryReminderNotificationId()).toBeNull();
    expect(await getDiaryReminderEnabled()).toBe(false);
  });

  it('clears the stored id but keeps the setting on when scheduling fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    scheduleDailyReminder.mockRejectedValue(new Error('kaputt'));
    await setDiaryReminderNotificationId('alte-kennung');
    await setDiaryReminderEnabled(true);
    await setDiaryReminderTime('20:00');

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('failed');
    expect(await getDiaryReminderNotificationId()).toBeNull();
    // Der Wunsch des Nutzers bleibt stehen: Der naechste Start plant erneut.
    expect(await getDiaryReminderEnabled()).toBe(true);

    consoleError.mockRestore();
  });

  it('cancels the fresh notification when its id cannot be stored', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await setDiaryReminderEnabled(true);
    await setDiaryReminderTime('20:00');
    setItemMock.mockImplementationOnce(() => Promise.reject(new Error('Speicher voll')));

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('failed');
    // Sonst liefe eine Erinnerung, die niemand mehr abbestellen kann.
    expect(cancelScheduledReminder).toHaveBeenCalledWith('neue-kennung');

    consoleError.mockRestore();
  });
});
