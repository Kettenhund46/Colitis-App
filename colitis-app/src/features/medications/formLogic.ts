import type { MedicationInput } from './types';

export interface MedicationFormState {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string;
  reminderTimes: string[];
}

export const INITIAL_MEDICATION_FORM_STATE: MedicationFormState = {
  name: '',
  dose: '',
  schedule: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  reminderTimes: [],
};

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!DATE_PATTERN.test(state.startDate)) {
    errors.push('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  }
  if (state.endDate.length > 0 && !DATE_PATTERN.test(state.endDate)) {
    errors.push('Bitte ein gültiges Enddatum eingeben (JJJJ-MM-TT) oder leer lassen.');
  }
  for (const time of state.reminderTimes) {
    if (!REMINDER_TIME_PATTERN.test(time)) {
      errors.push(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm).`);
    }
  }

  return errors;
}

export function buildMedicationInput(state: MedicationFormState): MedicationInput {
  return {
    name: state.name.trim(),
    dose: state.dose.trim(),
    schedule: state.schedule.trim(),
    startDate: state.startDate,
    endDate: state.endDate.length > 0 ? state.endDate : null,
    reminderTimes: state.reminderTimes,
  };
}

export function addReminderTime(times: string[], time: string): string[] {
  return [...times, time];
}

export function removeReminderTime(times: string[], index: number): string[] {
  return times.filter((_, i) => i !== index);
}
