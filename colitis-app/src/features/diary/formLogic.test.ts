import { describe, it, expect } from 'vitest';
import {
  INITIAL_DIARY_ENTRY_FORM_STATE,
  buildDiaryEntryInput,
  toggleListValue,
  validateDiaryEntryForm,
  appendFoodSuggestion,
} from './formLogic';

describe('validateDiaryEntryForm', () => {
  it('requires a stool consistency to be selected', () => {
    const errors = validateDiaryEntryForm(INITIAL_DIARY_ENTRY_FORM_STATE);
    expect(errors).toContain('Bitte eine Stuhlgang-Konsistenz auswählen.');
  });

  it('returns no errors for a valid state', () => {
    const errors = validateDiaryEntryForm({
      ...INITIAL_DIARY_ENTRY_FORM_STATE,
      stoolConsistency: 'normal',
    });
    expect(errors).toEqual([]);
  });

  it('flags a pain level outside 0-10', () => {
    const errors = validateDiaryEntryForm({
      ...INITIAL_DIARY_ENTRY_FORM_STATE,
      stoolConsistency: 'normal',
      painLevel: 11,
    });
    expect(errors).toContain('Das Schmerzlevel muss zwischen 0 und 10 liegen.');
  });
});

describe('buildDiaryEntryInput', () => {
  it('throws when stool consistency is missing', () => {
    expect(() => buildDiaryEntryInput(INITIAL_DIARY_ENTRY_FORM_STATE, '2026-07-08T10:00:00.000Z')).toThrow();
  });

  it('trims whitespace-only notes to null', () => {
    const input = buildDiaryEntryInput(
      { ...INITIAL_DIARY_ENTRY_FORM_STATE, stoolConsistency: 'normal', note: '   ' },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.note).toBeNull();
  });

  it('carries all fields through unchanged', () => {
    const input = buildDiaryEntryInput(
      {
        stoolFrequency: 4,
        bloodLevel: 1,
        nocturnalStools: 0,
        stoolConsistency: 'waessrig',
        painLevel: 7,
        symptoms: ['fieber'],
        note: '  Starke Schmerzen nach dem Essen  ',
        triggerCategories: ['ernaehrung'],
        foodTriggerNote: 'Kaffee',
      },
      '2026-07-08T10:00:00.000Z'
    );

    expect(input).toEqual({
      occurredAt: '2026-07-08T10:00:00.000Z',
      stoolFrequency: 4,
      bloodLevel: 1,
      nocturnalStools: 0,
      stoolConsistency: 'waessrig',
      painLevel: 7,
      symptoms: ['fieber'],
      note: 'Starke Schmerzen nach dem Essen',
      triggerCategories: ['ernaehrung'],
      foodTriggerNote: 'Kaffee',
    });
  });

  it('includes the food trigger note when ernaehrung is selected and text is present', () => {
    const input = buildDiaryEntryInput(
      {
        ...INITIAL_DIARY_ENTRY_FORM_STATE,
        stoolConsistency: 'normal',
        triggerCategories: ['ernaehrung'],
        foodTriggerNote: '  Kaffee, Milchprodukte  ',
      },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.foodTriggerNote).toBe('Kaffee, Milchprodukte');
  });

  it('discards the food trigger note when ernaehrung is not selected', () => {
    const input = buildDiaryEntryInput(
      {
        ...INITIAL_DIARY_ENTRY_FORM_STATE,
        stoolConsistency: 'normal',
        triggerCategories: ['stress'],
        foodTriggerNote: 'Kaffee',
      },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.foodTriggerNote).toBeNull();
  });

  it('sets a null food trigger note when ernaehrung is selected but no text was entered', () => {
    const input = buildDiaryEntryInput(
      {
        ...INITIAL_DIARY_ENTRY_FORM_STATE,
        stoolConsistency: 'normal',
        triggerCategories: ['ernaehrung'],
        foodTriggerNote: '   ',
      },
      '2026-07-08T10:00:00.000Z'
    );
    expect(input.foodTriggerNote).toBeNull();
  });
});

describe('toggleListValue', () => {
  it('adds a value that is not yet in the list', () => {
    expect(toggleListValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a value that is already in the list', () => {
    expect(toggleListValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('does not mutate the original list', () => {
    const original = ['a'];
    toggleListValue(original, 'b');
    expect(original).toEqual(['a']);
  });
});

describe('appendFoodSuggestion', () => {
  it('sets the suggestion directly when the field is empty', () => {
    expect(appendFoodSuggestion('', 'Kaffee')).toBe('Kaffee');
  });

  it('sets the suggestion directly when the field is only whitespace', () => {
    expect(appendFoodSuggestion('   ', 'Kaffee')).toBe('Kaffee');
  });

  it('appends a second suggestion with a comma', () => {
    expect(appendFoodSuggestion('Kaffee', 'Milchprodukte')).toBe('Kaffee, Milchprodukte');
  });

  it('does not add a duplicate suggestion', () => {
    expect(appendFoodSuggestion('Kaffee, Milchprodukte', 'Kaffee')).toBe('Kaffee, Milchprodukte');
  });

  it('is robust to extra whitespace around existing entries', () => {
    expect(appendFoodSuggestion('Kaffee ,  Milchprodukte', 'Milchprodukte')).toBe('Kaffee ,  Milchprodukte');
  });

  it('preserves free-text additions alongside chip suggestions', () => {
    expect(appendFoodSuggestion('Schokolade', 'Kaffee')).toBe('Schokolade, Kaffee');
  });
});
