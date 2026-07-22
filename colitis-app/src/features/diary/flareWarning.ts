import { groupEntriesByDay, rateDayEntries, formatDateKey } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

const FLARE_WARNING_WINDOW_DAYS = 7;
const FLARE_WARNING_THRESHOLD = 3;

export function shouldShowFlareWarning(entries: DiaryEntryWithTriggers[], referenceDate: Date): boolean {
  const entriesByDay = groupEntriesByDay(entries);
  let badDayCount = 0;

  for (let offset = 0; offset < FLARE_WARNING_WINDOW_DAYS; offset++) {
    const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - offset);
    const dateKey = formatDateKey(day);
    const dayEntries = entriesByDay.get(dateKey) ?? [];

    if (dayEntries.length > 0 && rateDayEntries(dayEntries) === 'bad') {
      badDayCount++;
    }
  }

  return badDayCount >= FLARE_WARNING_THRESHOLD;
}
