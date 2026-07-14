import { describe, it, expect } from 'vitest';
import {
  INITIAL_SAVED_PLACE_FORM_STATE,
  CATEGORY_SUGGESTIONS,
  validateSavedPlaceForm,
  buildSavedPlaceInput,
} from './savedPlaceFormLogic';

describe('validateSavedPlaceForm', () => {
  it('requires a name', () => {
    const errors = validateSavedPlaceForm(INITIAL_SAVED_PLACE_FORM_STATE);
    expect(errors).toContain('Bitte einen Namen eingeben.');
  });

  it('passes with a non-empty name and empty category/note', () => {
    const errors = validateSavedPlaceForm({ ...INITIAL_SAVED_PLACE_FORM_STATE, name: 'Büro' });
    expect(errors).toEqual([]);
  });

  it('rejects a name that is only whitespace', () => {
    const errors = validateSavedPlaceForm({ ...INITIAL_SAVED_PLACE_FORM_STATE, name: '   ' });
    expect(errors).toContain('Bitte einen Namen eingeben.');
  });
});

describe('CATEGORY_SUGGESTIONS', () => {
  it('offers the four agreed suggestion chips', () => {
    expect(CATEGORY_SUGGESTIONS).toEqual(['Arbeit', 'Freunde', 'Café', 'Sonstiges']);
  });
});

describe('buildSavedPlaceInput', () => {
  it('trims name/category/note and attaches the given coordinates', () => {
    const input = buildSavedPlaceInput(
      { name: '  Büro  ', category: ' Arbeit ', note: '  2. Stock  ' },
      { latitude: 52.52, longitude: 13.405 }
    );
    expect(input).toEqual({
      name: 'Büro',
      category: 'Arbeit',
      note: '2. Stock',
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  it('converts an empty note to null', () => {
    const input = buildSavedPlaceInput(
      { name: 'Büro', category: 'Arbeit', note: '   ' },
      { latitude: 52.52, longitude: 13.405 }
    );
    expect(input.note).toBeNull();
  });
});
