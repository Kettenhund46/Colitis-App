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

const cancelScheduledReminder = vi.fn();
const scheduleDailyReminder = vi.fn();
const requestNotificationPermission = vi.fn();

vi.mock('../../lib/notifications/notificationService', () => ({
  cancelScheduledReminder: (notificationId: string) => cancelScheduledReminder(notificationId),
  scheduleDailyReminder: (time: string, content: unknown) => scheduleDailyReminder(time, content),
  requestNotificationPermission: () => requestNotificationPermission(),
}));

import { rescheduleDiaryReminder } from './scheduleDiaryReminder';
import {
  setDiaryReminderEnabled,
  setDiaryReminderTime,
  setDiaryReminderNotificationId,
  getDiaryReminderNotificationId,
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
  });

  it('clears the stored id when scheduling fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    scheduleDailyReminder.mockRejectedValue(new Error('kaputt'));
    await setDiaryReminderNotificationId('alte-kennung');
    await setDiaryReminderEnabled(true);
    await setDiaryReminderTime('20:00');

    const result = await rescheduleDiaryReminder();

    expect(result).toBe('failed');
    expect(await getDiaryReminderNotificationId()).toBeNull();

    consoleError.mockRestore();
  });
});
