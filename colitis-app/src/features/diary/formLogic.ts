import type { StoolConsistency, SymptomKey, TriggerCategory } from './constants';
import type { NewDiaryEntryInput } from './types';

export interface DiaryEntryFormState {
  stoolFrequency: number;
  hasBlood: boolean;
  stoolConsistency: StoolConsistency | null;
  painLevel: number;
  symptoms: SymptomKey[];
  note: string;
  triggerCategories: TriggerCategory[];
}

export const INITIAL_DIARY_ENTRY_FORM_STATE: DiaryEntryFormState = {
  stoolFrequency: 0,
  hasBlood: false,
  stoolConsistency: null,
  painLevel: 0,
  symptoms: [],
  note: '',
  triggerCategories: [],
};

export function validateDiaryEntryForm(state: DiaryEntryFormState): string[] {
  const errors: string[] = [];

  if (state.stoolConsistency === null) {
    errors.push('Bitte eine Stuhlgang-Konsistenz auswählen.');
  }
  if (state.stoolFrequency < 0) {
    errors.push('Die Häufigkeit darf nicht negativ sein.');
  }
  if (state.painLevel < 0 || state.painLevel > 10) {
    errors.push('Das Schmerzlevel muss zwischen 0 und 10 liegen.');
  }

  return errors;
}

export function buildDiaryEntryInput(state: DiaryEntryFormState, occurredAt: string): NewDiaryEntryInput {
  if (state.stoolConsistency === null) {
    throw new Error('Formular ist nicht gültig: Stuhlgang-Konsistenz fehlt.');
  }

  const trimmedNote = state.note.trim();

  return {
    occurredAt,
    stoolFrequency: state.stoolFrequency,
    hasBlood: state.hasBlood,
    stoolConsistency: state.stoolConsistency,
    painLevel: state.painLevel,
    symptoms: state.symptoms,
    note: trimmedNote.length > 0 ? trimmedNote : null,
    triggerCategories: state.triggerCategories,
  };
}

export function toggleListValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function appendFoodSuggestion(current: string, suggestion: string): string {
  const trimmed = current.trim();
  if (trimmed.length === 0) {
    return suggestion;
  }
  const parts = trimmed.split(',').map((part) => part.trim());
  if (parts.includes(suggestion)) {
    return trimmed;
  }
  return `${trimmed}, ${suggestion}`;
}
