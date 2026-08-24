import { isValidCalendarDate } from './dateValidation';
import { formatLocalDate } from './medicationStatus';
import type { MedicationInput } from './types';

export interface MedicationFormState {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string;
  sideEffectsNote: string;
  reminderTimes: string[];
}

/**
 * Frischer Formularzustand mit dem heutigen Tag als Startdatum.
 *
 * Bewusst eine Funktion und keine Konstante: Eine Konstante wird einmal beim
 * Laden des Moduls ausgewertet. Bleibt die App ueber Mitternacht im Speicher --
 * bei einer Tagebuch-App der Normalfall --, schluege sie danach den Vortag vor.
 */
export function buildInitialMedicationFormState(): MedicationFormState {
  return {
    name: '',
    dose: '',
    schedule: '',
    startDate: formatLocalDate(new Date()),
    endDate: '',
    sideEffectsNote: '',
    reminderTimes: [],
  };
}

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

export function validateMedicationForm(state: MedicationFormState): string[] {
  const errors: string[] = [];

  if (state.name.trim().length === 0) {
    errors.push('Bitte einen Namen eingeben.');
  }
  if (state.dose.trim().length === 0) {
    errors.push('Bitte eine Dosis eingeben.');
  }
  if (state.schedule.trim().length === 0) {
    errors.push('Bitte ein Einnahmeschema eingeben.');
  }
  if (!isValidCalendarDate(state.startDate)) {
    errors.push('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  }
  if (state.endDate.length > 0 && !isValidCalendarDate(state.endDate)) {
    errors.push('Bitte ein gültiges Enddatum eingeben (JJJJ-MM-TT) oder leer lassen.');
  }
  if (
    state.endDate.length > 0 &&
    isValidCalendarDate(state.startDate) &&
    isValidCalendarDate(state.endDate) &&
    state.endDate < state.startDate
  ) {
    errors.push('Das Enddatum darf nicht vor dem Startdatum liegen.');
  }
  for (const time of state.reminderTimes) {
    if (!REMINDER_TIME_PATTERN.test(time)) {
      errors.push(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm).`);
    }
  }

  return errors;
}

export function buildMedicationInput(state: MedicationFormState): MedicationInput {
  const trimmedSideEffectsNote = state.sideEffectsNote.trim();
  return {
    name: state.name.trim(),
    dose: state.dose.trim(),
    schedule: state.schedule.trim(),
    startDate: state.startDate,
    endDate: state.endDate.length > 0 ? state.endDate : null,
    sideEffectsNote: trimmedSideEffectsNote.length > 0 ? trimmedSideEffectsNote : null,
    reminderTimes: state.reminderTimes,
  };
}

export function addReminderTime(times: string[], time: string): string[] {
  return [...times, time];
}

export function removeReminderTime(times: string[], index: number): string[] {
  return times.filter((_, i) => i !== index);
}
