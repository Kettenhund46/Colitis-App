import { TRIGGER_CATEGORY_OPTIONS } from './constants';
import type { TriggerCategory } from './constants';
import type { DiaryEntryWithTriggers } from './types';

export interface TriggerPatternStat {
  category: TriggerCategory;
  entryCount: number;
  averagePainLevel: number;
}

export function computeTriggerPatterns(entries: DiaryEntryWithTriggers[]): TriggerPatternStat[] {
  const stats: TriggerPatternStat[] = [];

  for (const option of TRIGGER_CATEGORY_OPTIONS) {
    const matchingEntries = entries.filter((entry) => entry.triggerCategories.includes(option.key));

    if (matchingEntries.length === 0) {
      continue;
    }

    const totalPainLevel = matchingEntries.reduce((sum, entry) => sum + entry.painLevel, 0);
    const averagePainLevel = Math.round((totalPainLevel / matchingEntries.length) * 10) / 10;

    stats.push({
      category: option.key,
      entryCount: matchingEntries.length,
      averagePainLevel,
    });
  }

  return stats;
}
