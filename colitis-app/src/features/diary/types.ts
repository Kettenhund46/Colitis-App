import type { BloodLevel, StoolConsistency, TriggerCategory } from './constants';

export interface NewDiaryEntryInput {
  occurredAt: string;
  stoolFrequency: number;
  bloodLevel: BloodLevel;
  stoolConsistency: StoolConsistency;
  painLevel: number;
  symptoms: string[];
  note: string | null;
  triggerCategories: TriggerCategory[];
  foodTriggerNote: string | null;
}

export interface DiaryEntryWithTriggers {
  id: number;
  occurredAt: string;
  stoolFrequency: number;
  bloodLevel: BloodLevel;
  stoolConsistency: string;
  painLevel: number;
  symptoms: string[];
  note: string | null;
  triggerCategories: string[];
  foodTriggerNote: string | null;
}
