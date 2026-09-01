import { formatDateKey } from './calendarLogic';
import type { BloodLevel, StoolConsistency } from './constants';
import type { DiaryEntryWithTriggers, NewDiaryEntryInput } from './types';

export const STOOL_CONSISTENCY_SEVERITY: Record<StoolConsistency, number> = {
  hart: 0,
  normal: 1,
  weich: 2,
  waessrig: 3,
};

const FALLBACK_CONSISTENCY: StoolConsistency = 'normal';

/**
 * Der Schnell-Eintrag kennt Blut nur als ja/nein -- vier Stufen wuerden aus
 * zwei Tipps drei machen und ihm den Sinn nehmen. "Ja" gilt deshalb als
 * Schlieren, die zurueckhaltendste Deutung. Im vollen Formular laesst sich
 * der Tag nachschaerfen; der Tageswert nimmt ohnehin die schwerste Angabe.
 */
export const QUICK_ENTRY_BLOOD_LEVEL: BloodLevel = 1;

export function worseBloodLevel(a: BloodLevel, b: BloodLevel): BloodLevel {
  return b > a ? b : a;
}

export interface QuickEntryUpdate {
  stoolFrequency: number;
  bloodLevel: BloodLevel;
  stoolConsistency: StoolConsistency;
}

function toKnownConsistency(value: string): StoolConsistency {
  return value in STOOL_CONSISTENCY_SEVERITY ? (value as StoolConsistency) : FALLBACK_CONSISTENCY;
}

export function worseConsistency(a: StoolConsistency, b: StoolConsistency): StoolConsistency {
  return STOOL_CONSISTENCY_SEVERITY[b] > STOOL_CONSISTENCY_SEVERITY[a] ? b : a;
}

export function findTodaysEntry(
  entries: DiaryEntryWithTriggers[],
  now: Date
): DiaryEntryWithTriggers | null {
  const todayKey = formatDateKey(now);
  let newest: DiaryEntryWithTriggers | null = null;

  for (const entry of entries) {
    if (formatDateKey(new Date(entry.occurredAt)) !== todayKey) {
      continue;
    }
    if (newest === null || entry.occurredAt > newest.occurredAt) {
      newest = entry;
    }
  }

  return newest;
}

export function buildQuickEntryInput(
  consistency: StoolConsistency,
  hasBlood: boolean,
  occurredAt: string
): NewDiaryEntryInput {
  return {
    occurredAt,
    stoolFrequency: 1,
    bloodLevel: hasBlood ? QUICK_ENTRY_BLOOD_LEVEL : 0,
    nocturnalStools: 0,
    stoolConsistency: consistency,
    painLevel: 0,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
  };
}

export function buildQuickEntryUpdate(
  existing: DiaryEntryWithTriggers,
  consistency: StoolConsistency,
  hasBlood: boolean
): QuickEntryUpdate {
  return {
    stoolFrequency: existing.stoolFrequency + 1,
    bloodLevel: worseBloodLevel(existing.bloodLevel, hasBlood ? QUICK_ENTRY_BLOOD_LEVEL : 0),
    stoolConsistency: worseConsistency(toKnownConsistency(existing.stoolConsistency), consistency),
  };
}

export interface TodaySummary {
  entryCount: number;
  totalStoolFrequency: number;
  hasBlood: boolean;
}

export function summarizeToday(entries: DiaryEntryWithTriggers[], now: Date): TodaySummary {
  const todayKey = formatDateKey(now);
  const todaysEntries = entries.filter(
    (entry) => formatDateKey(new Date(entry.occurredAt)) === todayKey
  );

  return {
    entryCount: todaysEntries.length,
    totalStoolFrequency: todaysEntries.reduce((total, entry) => total + entry.stoolFrequency, 0),
    hasBlood: todaysEntries.some((entry) => entry.bloodLevel > 0),
  };
}
