import { groupEntriesByDay, formatDateKey } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

export type TrendRangeDays = 7 | 30 | 90;

export interface DailyAverage {
  date: string;
  averagePainLevel: number | null;
  averageStoolFrequency: number | null;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return roundToOneDecimal(sum / values.length);
}

export function buildDailyAverages(
  entries: DiaryEntryWithTriggers[],
  rangeDays: TrendRangeDays,
  referenceDate: Date = new Date()
): DailyAverage[] {
  const entriesByDay = groupEntriesByDay(entries);
  const days: DailyAverage[] = [];

  for (let offset = rangeDays - 1; offset >= 0; offset--) {
    const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - offset);
    const dateKey = formatDateKey(day);
    const dayEntries = entriesByDay.get(dateKey) ?? [];

    days.push({
      date: dateKey,
      averagePainLevel: averageOf(dayEntries.map((entry) => entry.painLevel)),
      averageStoolFrequency: averageOf(dayEntries.map((entry) => entry.stoolFrequency)),
    });
  }

  return days;
}
