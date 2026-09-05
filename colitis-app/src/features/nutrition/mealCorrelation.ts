import { rateDayEntries, groupEntriesByDay } from '../diary/calendarLogic';
import { sortNewestFirst } from './meals';
import type { DiaryEntryWithTriggers } from '../diary/types';
import type { Meal } from './types';

/**
 * Wie weit vor einem auffaelligen Tag zurueckgeschaut wird. Ein Tag deckt das
 * Abendessen davor und den Morgen desselben Tages ab -- die Spanne, in der ein
 * Zusammenhang ueberhaupt plausibel ist.
 */
export const LOOKBACK_HOURS = 24;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export const CORRELATION_TITLE = 'Vor auffälligen Tagen';

/**
 * Steht unter jeder Ausgabe. Die App zeigt eine zeitliche Nachbarschaft und
 * behauptet ausdruecklich keine Ursache -- dieselbe Linie wie beim
 * Aktivitaetsindex.
 */
export const CORRELATION_NOTE =
  'Das ist ein zeitlicher Zusammenhang, keine Ursache. Aufgeführt ist, was in den 24 Stunden vor dem ersten Eintrag eines schub-verdächtigen Tages erfasst wurde.';

export const NO_CORRELATION_TITLE = 'Noch nichts zu zeigen';
export const NO_CORRELATION_DESCRIPTION =
  'Sobald ein schub-verdächtiger Tag auf erfasste Mahlzeiten trifft, steht er hier. Bis dahin lohnt es sich, beides weiterzuführen.';

export interface BadDayMeals {
  /** Lokaler Kalendertag des auffaelligen Tages, YYYY-MM-DD. */
  date: string;
  /** Erster Eintrag dieses Tages -- das Ende des Rueckblick-Fensters. */
  referenceAt: string;
  /** Die Mahlzeiten im Fenster, spaeteste zuerst. */
  meals: Meal[];
}

function earliestOccurredAt(entries: DiaryEntryWithTriggers[]): string {
  return entries.reduce(
    (earliest, entry) => (entry.occurredAt < earliest ? entry.occurredAt : earliest),
    entries[0].occurredAt
  );
}

/**
 * Die Mahlzeiten in den `hours` Stunden vor `referenceIso`, spaeteste zuerst.
 * Das Fenster ist am oberen Ende offen: Eine Mahlzeit zur selben Minute wie
 * der Eintrag kann nicht davor liegen.
 */
export function mealsBefore(meals: Meal[], referenceIso: string, hours: number): Meal[] {
  const reference = new Date(referenceIso).getTime();
  const from = reference - hours * MILLISECONDS_PER_HOUR;

  return sortNewestFirst(meals).filter((meal) => {
    const eaten = new Date(meal.eatenAt).getTime();
    return eaten >= from && eaten < reference;
  });
}

/**
 * Je schub-verdaechtigem Tag die Mahlzeiten davor, neueste Tage zuerst.
 *
 * Tage ohne eine einzige Mahlzeit im Fenster fallen heraus: Eine leere Liste
 * traegt keine Aussage und verdeckt nur die Tage, die eine tragen.
 */
export function buildBadDayMeals(
  meals: Meal[],
  entries: DiaryEntryWithTriggers[]
): BadDayMeals[] {
  const result: BadDayMeals[] = [];

  for (const [date, dayEntries] of groupEntriesByDay(entries)) {
    if (rateDayEntries(dayEntries) !== 'bad') {
      continue;
    }
    const referenceAt = earliestOccurredAt(dayEntries);
    const window = mealsBefore(meals, referenceAt, LOOKBACK_HOURS);
    if (window.length === 0) {
      continue;
    }
    result.push({ date, referenceAt, meals: window });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}
