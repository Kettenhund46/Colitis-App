import { describe, it, expect, vi, beforeEach } from 'vitest';

const scheduleNotificationAsync = vi.fn((..._args: unknown[]) => Promise.resolve('notif-id-123'));
const cancelScheduledNotificationAsync = vi.fn((..._args: unknown[]) => Promise.resolve());
const requestPermissionsAsync = vi.fn((..._args: unknown[]) => Promise.resolve({ status: 'granted' }));
const setNotificationHandler = vi.fn();

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => scheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => cancelScheduledNotificationAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  setNotificationHandler: (...args: unknown[]) => setNotificationHandler(...args),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

import {
  configureNotificationHandling,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
  cancelScheduledReminder,
} from './notificationService';

beforeEach(() => {
  vi.clearAllMocks();
  scheduleNotificationAsync.mockResolvedValue('notif-id-123');
});

describe('configureNotificationHandling', () => {
  it('registers a handler that shows banners and plays sound in the foreground', async () => {
    configureNotificationHandling();

    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
    const handlerArg = setNotificationHandler.mock.calls[0][0] as {
      handleNotification: () => Promise<Record<string, boolean>>;
    };
    const behavior = await handlerArg.handleNotification();
    expect(behavior).toEqual({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });
});

describe('requestNotificationPermission', () => {
  it('returns true when permission is granted', async () => {
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    expect(await requestNotificationPermission()).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await requestNotificationPermission()).toBe(false);
  });
});

describe('scheduleDailyReminder', () => {
  it('schedules a daily trigger at the parsed hour/minute and returns the identifier', async () => {
    const id = await scheduleDailyReminder('08:30', { title: 'Medikament', body: 'Zeit für Salofalk' });

    expect(id).toBe('notif-id-123');
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Medikament', body: 'Zeit für Salofalk' },
      trigger: { type: 'daily', hour: 8, minute: 30 },
    });
  });
});

describe('scheduleScreeningReminder', () => {
  it('schedules a date trigger and returns the identifier when the date is in the future', async () => {
    const now = new Date(2026, 0, 1, 8, 0, 0, 0);
    const id = await scheduleScreeningReminder('2026-06-01', { title: 'Vorsorge', body: 'Koloskopie fällig' }, now);

    expect(id).toBe('notif-id-123');
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Vorsorge', body: 'Koloskopie fällig' },
      trigger: { type: 'date', date: new Date(2026, 5, 1, 9, 0, 0, 0) },
    });
  });

  it('does not schedule and returns null when the due date has already passed', async () => {
    const now = new Date(2026, 6, 1, 8, 0, 0, 0);
    const id = await scheduleScreeningReminder('2026-06-01', { title: 'Vorsorge', body: 'Koloskopie fällig' }, now);

    expect(id).toBeNull();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelScheduledReminder', () => {
  it('cancels the given notification id', async () => {
    await cancelScheduledReminder('notif-id-123');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id-123');
  });

  it('logs and does not throw when cancellation fails', async () => {
    cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('not found'));
    await expect(cancelScheduledReminder('unknown-id')).resolves.toBeUndefined();
  });
});
