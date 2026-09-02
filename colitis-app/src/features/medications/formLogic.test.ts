import { describe, it, expect } from 'vitest';
import {
  buildInitialMedicationFormState,
  validateMedicationForm,
  buildMedicationInput,
  addReminderTime,
  removeReminderTime,
} from './formLogic';

describe('validateMedicationForm', () => {
  it('requires name, dose and schedule', () => {
    const errors = validateMedicationForm(buildInitialMedicationFormState());
    expect(errors).toContain('Bitte einen Namen eingeben.');
    expect(errors).toContain('Bitte eine Dosis eingeben.');
    expect(errors).toContain('Bitte ein Einnahmeschema eingeben.');
  });

  it('rejects an invalid start date', () => {
    const errors = validateMedicationForm({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '12.07.2026',
    });
    expect(errors).toContain('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  });

  it('rejects an invalid reminder time', () => {
    const errors = validateMedicationForm({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      reminderTimes: ['8 Uhr'],
    });
    expect(errors).toContain('Ungültige Erinnerungszeit: "8 Uhr" (erwartet HH:mm).');
  });

  it('passes with valid required fields and no reminder times', () => {
    const errors = validateMedicationForm({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
    });
    expect(errors).toEqual([]);
  });

  it('rejects a start date that does not exist on the calendar', () => {
    const errors = validateMedicationForm({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-13-45',
    });
    expect(errors).toContain('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  });

  it('rejects an end date before the start date', () => {
    const errors = validateMedicationForm({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: '2026-07-01',
    });
    expect(errors).toContain('Das Enddatum darf nicht vor dem Startdatum liegen.');
  });
});

describe('buildMedicationInput', () => {
  it('trims text fields and converts an empty end date to null', () => {
    const input = buildMedicationInput({
      ...buildInitialMedicationFormState(),
      name: '  Salofalk  ',
      dose: ' 500mg ',
      schedule: ' 1x täglich ',
      startDate: '2026-07-12',
      endDate: '',
      reminderTimes: ['08:00'],
    });
    expect(input).toEqual({
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: null,
      sideEffectsNote: null,
      // Vorgabe des leeren Formulars: eine Einheit je Einnahme, kein Vorrat.
      unitsPerIntake: 1,
      packUnits: null,
      stockUnits: null,
      reminderTimes: ['08:00'],
    });
  });

  it('keeps a provided end date', () => {
    const input = buildMedicationInput({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      endDate: '2026-08-01',
    });
    expect(input.endDate).toBe('2026-08-01');
  });

  it('trims a side effects note and converts an empty string to null', () => {
    const input = buildMedicationInput({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      sideEffectsNote: '  Übelkeit  ',
    });
    expect(input.sideEffectsNote).toBe('Übelkeit');
  });

  it('converts an empty side effects note to null', () => {
    const input = buildMedicationInput({
      ...buildInitialMedicationFormState(),
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      sideEffectsNote: '   ',
    });
    expect(input.sideEffectsNote).toBeNull();
  });
});

describe('addReminderTime / removeReminderTime', () => {
  it('adds a time to the end of the list', () => {
    expect(addReminderTime(['08:00'], '20:00')).toEqual(['08:00', '20:00']);
  });

  it('removes a time by index', () => {
    expect(removeReminderTime(['08:00', '20:00'], 0)).toEqual(['20:00']);
  });
});
