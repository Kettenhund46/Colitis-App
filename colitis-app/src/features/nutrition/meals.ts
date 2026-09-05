import { formatLocalDateKey } from '../../lib/localDate';
import type { Meal } from './types';

/** Reicht fuer eine Mahlzeit in Worten, ohne dass daraus ein Aufsatz wird. */
export const MAX_MEAL_LENGTH = 300;

export const MEALS_HINT =
  'Trag ein, was du gegessen hast — kurz genügt. Später zeigt dir die Auswertung, was vor auffälligen Tagen auf dem Teller lag.';

export const EMPTY_MEALS_TITLE = 'Noch keine Mahlzeit erfasst';
export const EMPTY_MEALS_DESCRIPTION =
  'Je regelmäßiger du einträgst, desto eher fällt ein Muster auf. Ein Stichwort pro Mahlzeit reicht.';

const TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

export function isValidMealText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MEAL_LENGTH;
}

export function isValidMealTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/**
 * Setzt lokales Datum und Uhrzeit zu einem Zeitpunkt zusammen. Gespeichert
 * wird UTC, eingegeben wird lokal -- ohne diesen Schritt landete eine
 * Mahlzeit vom fruehen Morgen auf dem Vortag.
 */
export function toEatenAtIso(dateKey: string, time: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function localDayOf(meal: Meal): string {
  return formatLocalDateKey(new Date(meal.eatenAt));
}

export function formatMealTime(meal: Meal): string {
  const parsed = new Date(meal.eatenAt);
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Neueste zuerst, ohne die uebergebene Liste zu veraendern. */
export function sortNewestFirst(meals: Meal[]): Meal[] {
  return meals.slice().sort((a, b) => b.eatenAt.localeCompare(a.eatenAt));
}

/**
 * Nach lokalem Kalendertag gruppiert, neueste Tage zuerst und innerhalb eines
 * Tages die spaeteste Mahlzeit oben.
 */
export function groupByDay(meals: Meal[]): Map<string, Meal[]> {
  const byDay = new Map<string, Meal[]>();
  for (const meal of sortNewestFirst(meals)) {
    const day = localDayOf(meal);
    const bucket = byDay.get(day);
    if (bucket === undefined) {
      byDay.set(day, [meal]);
    } else {
      bucket.push(meal);
    }
  }
  return byDay;
}

export function formatMealCountLabel(count: number): string {
  if (count === 0) {
    return 'Noch nichts erfasst';
  }
  return count === 1 ? '1 Mahlzeit erfasst' : `${count} Mahlzeiten erfasst`;
}
