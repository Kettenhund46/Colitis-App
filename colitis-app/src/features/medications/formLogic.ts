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
  /**
   * Die drei Vorratsfelder als Text, weil sie aus Eingabefeldern kommen.
   * Leerer Bestand heisst: kein Vorrat fuehren -- nicht "null Tabletten".
   */
  unitsPerIntake: string;
  packUnits: string;
  stockUnits: string;
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
    unitsPerIntake: '1',
    packUnits: '',
    stockUnits: '',
    reminderTimes: [],
  };
}

const COUNT_PATTERN = /^\d+$/;

function isNonNegativeInteger(value: string): boolean {
  return COUNT_PATTERN.test(value.trim());
}

/** Leer ist erlaubt; steht etwas da, muss es mindestens 1 sein. */
function isOptionalPositiveInteger(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || (COUNT_PATTERN.test(trimmed) && Number(trimmed) >= 1);
}

/** Leeres Feld wird zu null -- die Angabe fehlt, sie ist nicht null. */
export function parseCount(value: string): number | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : Number(trimmed);
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
  if (!isOptionalPositiveInteger(state.unitsPerIntake) || state.unitsPerIntake.trim().length === 0) {
    errors.push('Einheiten pro Einnahme muss eine ganze Zahl ab 1 sein.');
  }
  if (!isOptionalPositiveInteger(state.packUnits)) {
    errors.push('Packungsgröße muss eine ganze Zahl ab 1 sein oder leer bleiben.');
  }
  if (state.stockUnits.trim().length > 0 && !isNonNegativeInteger(state.stockUnits)) {
    errors.push('Vorrat muss eine ganze Zahl ab 0 sein oder leer bleiben.');
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
    unitsPerIntake: parseCount(state.unitsPerIntake) ?? 1,
    packUnits: parseCount(state.packUnits),
    stockUnits: parseCount(state.stockUnits),
    reminderTimes: state.reminderTimes,
  };
}

export function addReminderTime(times: string[], time: string): string[] {
  return [...times, time];
}

export function removeReminderTime(times: string[], index: number): string[] {
  return times.filter((_, i) => i !== index);
}
