import type { DiaryEntryWithTriggers } from './types';
import type { BloodLevel } from './constants';
import type { CardAccent } from '../../components/ui/Card';
import { formatLocalDateKey as formatDateKey } from '../../lib/localDate';

export type DayRating = 'good' | 'medium' | 'bad';

export interface DayTotals {
  totalStoolFrequency: number;
  worstPainLevel: number;
  /** Stuhlgaenge des Tages, die den Schlaf unterbrochen haben. */
  nocturnalStools: number;
  /** Die schwerste Blutbeimengung des Tages -- der Mayo-Teilwert nimmt das Schlimmste. */
  worstBloodLevel: BloodLevel;
}

/** Ob an diesem Tag ueberhaupt Blut vermerkt war. */
export function hasBlood(totals: DayTotals): boolean {
  return totals.worstBloodLevel > 0;
}

export function sumDayTotals(entries: DiaryEntryWithTriggers[]): DayTotals {
  return {
    totalStoolFrequency: entries.reduce((total, entry) => total + entry.stoolFrequency, 0),
    worstPainLevel: entries.reduce((worst, entry) => Math.max(worst, entry.painLevel), 0),
    nocturnalStools: entries.reduce((total, entry) => total + entry.nocturnalStools, 0),
    worstBloodLevel: entries.reduce<BloodLevel>(
      (worst, entry) => (entry.bloodLevel > worst ? entry.bloodLevel : worst),
      0
    ),
  };
}

export function rateDayTotals(totals: DayTotals): DayRating {
  if (hasBlood(totals)) {
    return 'bad';
  }
  if (totals.worstPainLevel >= 7 || totals.totalStoolFrequency >= 8) {
    return 'bad';
  }
  if (totals.worstPainLevel >= 4 || totals.totalStoolFrequency >= 5) {
    return 'medium';
  }
  return 'good';
}

export function rateDiaryEntry(entry: DiaryEntryWithTriggers): DayRating {
  return rateDayTotals({
    totalStoolFrequency: entry.stoolFrequency,
    worstPainLevel: entry.painLevel,
    nocturnalStools: entry.nocturnalStools,
    worstBloodLevel: entry.bloodLevel,
  });
}

export function rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating {
  return rateDayTotals(sumDayTotals(entries));
}

export { formatDateKey };

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

export function buildDayRatings(entries: DiaryEntryWithTriggers[]): Map<string, DayRating> {
  const ratings = new Map<string, DayRating>();
  for (const [dateKey, dayEntries] of groupEntriesByDay(entries)) {
    ratings.set(dateKey, rateDayEntries(dayEntries));
  }
  return ratings;
}

/** Uebersetzt die Tagesbewertung in die Bedeutung der Kartenkante. */
export function accentForRating(rating: DayRating | undefined): CardAccent | undefined {
  if (rating === undefined) {
    return undefined;
  }
  switch (rating) {
    case 'good':
      return 'good';
    case 'medium':
      return 'warning';
    case 'bad':
      return 'danger';
  }
}
