import { groupEntriesByDay, formatDateKey } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

export type TrendRangeDays = 7 | 30 | 90;

export interface DailyTrendPoint {
  date: string;
  worstPainLevel: number | null;
  totalStoolFrequency: number | null;
}

export function buildDailyTrend(
  entries: DiaryEntryWithTriggers[],
  rangeDays: TrendRangeDays,
  referenceDate: Date = new Date()
): DailyTrendPoint[] {
  const entriesByDay = groupEntriesByDay(entries);
  const days: DailyTrendPoint[] = [];

  for (let offset = rangeDays - 1; offset >= 0; offset--) {
    const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - offset);
    const dateKey = formatDateKey(day);
    const dayEntries = entriesByDay.get(dateKey) ?? [];

    days.push({
      date: dateKey,
      worstPainLevel:
        dayEntries.length === 0
          ? null
          : dayEntries.reduce((worst, entry) => Math.max(worst, entry.painLevel), 0),
      totalStoolFrequency:
        dayEntries.length === 0
          ? null
          : dayEntries.reduce((total, entry) => total + entry.stoolFrequency, 0),
    });
  }

  return days;
}
