import { formatDateKey } from './calendarLogic';
import type { StoolConsistency } from './constants';
import type { DiaryEntryWithTriggers, NewDiaryEntryInput } from './types';

export const STOOL_CONSISTENCY_SEVERITY: Record<StoolConsistency, number> = {
  hart: 0,
  normal: 1,
  weich: 2,
  waessrig: 3,
};

const FALLBACK_CONSISTENCY: StoolConsistency = 'normal';

export interface QuickEntryUpdate {
  stoolFrequency: number;
  hasBlood: boolean;
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
    hasBlood,
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
    hasBlood: existing.hasBlood || hasBlood,
    stoolConsistency: worseConsistency(toKnownConsistency(existing.stoolConsistency), consistency),
  };
}
