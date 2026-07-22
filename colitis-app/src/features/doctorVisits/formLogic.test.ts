import { describe, it, expect } from 'vitest';
import {
  INITIAL_DOCTOR_VISIT_FORM_STATE,
  validateDoctorVisitForm,
  buildDoctorVisitInput,
  type DoctorVisitFormState,
} from './formLogic';

describe('validateDoctorVisitForm', () => {
  it('requires a valid visit date', () => {
    const state: DoctorVisitFormState = { ...INITIAL_DOCTOR_VISIT_FORM_STATE, visitDate: '' };
    expect(validateDoctorVisitForm(state)).toContain('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
  });

  it('rejects an invalid visit date format', () => {
    const state: DoctorVisitFormState = { ...INITIAL_DOCTOR_VISIT_FORM_STATE, visitDate: '20.07.2026' };
    expect(validateDoctorVisitForm(state)).toContain('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
  });

  it('accepts a valid visit date with all other fields empty', () => {
    const state: DoctorVisitFormState = { ...INITIAL_DOCTOR_VISIT_FORM_STATE, visitDate: '2026-07-20' };
    expect(validateDoctorVisitForm(state)).toEqual([]);
  });

  it('rejects an invalid next appointment date', () => {
    const state: DoctorVisitFormState = {
      ...INITIAL_DOCTOR_VISIT_FORM_STATE,
      visitDate: '2026-07-20',
      nextAppointmentDate: 'nicht-ein-datum',
    };
    expect(validateDoctorVisitForm(state)).toContain(
      'Bitte ein gültiges Datum für den nächsten Termin eingeben (JJJJ-MM-TT) oder leer lassen.'
    );
  });

  it('accepts an empty next appointment date', () => {
    const state: DoctorVisitFormState = {
      ...INITIAL_DOCTOR_VISIT_FORM_STATE,
      visitDate: '2026-07-20',
      nextAppointmentDate: '',
    };
    expect(validateDoctorVisitForm(state)).toEqual([]);
  });
});

describe('buildDoctorVisitInput', () => {
  it('trims text fields and converts empty strings to null', () => {
    const state: DoctorVisitFormState = {
      visitDate: '2026-07-20',
      doctorName: '  ',
      reason: '  ',
      note: '  ',
      nextAppointmentDate: '',
    };

    expect(buildDoctorVisitInput(state)).toEqual({
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });
  });

  it('keeps trimmed non-empty text fields', () => {
    const state: DoctorVisitFormState = {
      visitDate: '2026-07-20',
      doctorName: '  Dr. Müller  ',
      reason: '  Kontrolle  ',
      note: '  Alles unauffällig  ',
      nextAppointmentDate: '2026-10-20',
    };

    expect(buildDoctorVisitInput(state)).toEqual({
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller',
      reason: 'Kontrolle',
      note: 'Alles unauffällig',
      nextAppointmentDate: '2026-10-20',
    });
  });
});
