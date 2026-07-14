import type { Coordinates, SavedPlaceInput } from './types';

export interface SavedPlaceFormState {
  name: string;
  category: string;
  note: string;
}

export const CATEGORY_SUGGESTIONS = ['Arbeit', 'Freunde', 'Café', 'Sonstiges'] as const;

export const INITIAL_SAVED_PLACE_FORM_STATE: SavedPlaceFormState = {
  name: '',
  category: '',
  note: '',
};

export function validateSavedPlaceForm(state: SavedPlaceFormState): string[] {
  const errors: string[] = [];
  if (state.name.trim().length === 0) {
    errors.push('Bitte einen Namen eingeben.');
  }
  return errors;
}

export function buildSavedPlaceInput(state: SavedPlaceFormState, coordinates: Coordinates): SavedPlaceInput {
  const trimmedNote = state.note.trim();
  return {
    name: state.name.trim(),
    category: state.category.trim(),
    note: trimmedNote.length > 0 ? trimmedNote : null,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}
