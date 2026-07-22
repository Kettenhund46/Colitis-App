import type { DiaryEntryWithTriggers } from './types';

export type DayRating = 'good' | 'medium' | 'bad';

const RATING_SEVERITY: Record<DayRating, number> = {
  good: 0,
  medium: 1,
  bad: 2,
};

export function rateDiaryEntry(entry: DiaryEntryWithTriggers): DayRating {
  if (entry.hasBlood) {
    return 'bad';
  }
  if (entry.painLevel >= 7 || entry.stoolFrequency >= 8) {
    return 'bad';
  }
  if (entry.painLevel >= 4 || entry.stoolFrequency >= 5) {
    return 'medium';
  }
  return 'good';
}

export function rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating {
  let worst: DayRating = 'good';
  for (const entry of entries) {
    const rating = rateDiaryEntry(entry);
    if (RATING_SEVERITY[rating] > RATING_SEVERITY[worst]) {
      worst = rating;
    }
  }
  return worst;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function groupEntriesByDay(entries: DiaryEntryWithTriggers[]): Map<string, DiaryEntryWithTriggers[]> {
  const grouped = new Map<string, DiaryEntryWithTriggers[]>();
  for (const entry of entries) {
    const key = formatDateKey(new Date(entry.occurredAt));
    const existing = grouped.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }
  return grouped;
}

export interface CalendarCell {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
}

const CALENDAR_CELL_COUNT = 42;

export function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekdayMondayIndexed = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekdayMondayIndexed);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < CALENDAR_CELL_COUNT; i++) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      date: formatDateKey(cellDate),
      dayOfMonth: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === month,
    });
  }
  return cells;
}
