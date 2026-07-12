export interface DailyTrigger {
  type: 'daily';
  hour: number;
  minute: number;
}

export interface DateTrigger {
  type: 'date';
  date: Date;
}

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
const SCREENING_REMINDER_HOUR = 9;
const SCREENING_REMINDER_MINUTE = 0;

export function isValidReminderTime(time: string): boolean {
  return REMINDER_TIME_PATTERN.test(time);
}

export function buildDailyReminderTrigger(time: string): DailyTrigger {
  const match = REMINDER_TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm)`);
  }
  return { type: 'daily', hour: Number(match[1]), minute: Number(match[2]) };
}

export function buildScreeningReminderTrigger(nextDueDate: string, now: Date): DateTrigger | null {
  const [year, month, day] = nextDueDate.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day, SCREENING_REMINDER_HOUR, SCREENING_REMINDER_MINUTE, 0, 0);
  if (dueDate.getTime() <= now.getTime()) {
    return null;
  }
  return { type: 'date', date: dueDate };
}
