import type { StoolConsistency, TriggerCategory } from './constants';

export interface NewDiaryEntryInput {
  occurredAt: string;
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency;
  painLevel: number;
  symptoms: string[];
  note: string | null;
  triggerCategories: TriggerCategory[];
}

export interface DiaryEntryWithTriggers {
  id: number;
  occurredAt: string;
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: string;
  painLevel: number;
  symptoms: string[];
  note: string | null;
  triggerCategories: string[];
}
