import { isValidCalendarDate } from '../medications/dateValidation';
import type { DoctorVisitInput } from './types';

export interface DoctorVisitFormState {
  visitDate: string;
  doctorName: string;
  reason: string;
  note: string;
  nextAppointmentDate: string;
}

export const INITIAL_DOCTOR_VISIT_FORM_STATE: DoctorVisitFormState = {
  visitDate: new Date().toISOString().slice(0, 10),
  doctorName: '',
  reason: '',
  note: '',
  nextAppointmentDate: '',
};

export function validateDoctorVisitForm(state: DoctorVisitFormState): string[] {
  const errors: string[] = [];

  if (!isValidCalendarDate(state.visitDate)) {
    errors.push('Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).');
  }
  if (state.nextAppointmentDate.length > 0 && !isValidCalendarDate(state.nextAppointmentDate)) {
    errors.push('Bitte ein gültiges Datum für den nächsten Termin eingeben (JJJJ-MM-TT) oder leer lassen.');
  }

  return errors;
}

export function buildDoctorVisitInput(state: DoctorVisitFormState): DoctorVisitInput {
  const trimmedDoctorName = state.doctorName.trim();
  const trimmedReason = state.reason.trim();
  const trimmedNote = state.note.trim();

  return {
    visitDate: state.visitDate,
    doctorName: trimmedDoctorName.length > 0 ? trimmedDoctorName : null,
    reason: trimmedReason.length > 0 ? trimmedReason : null,
    note: trimmedNote.length > 0 ? trimmedNote : null,
    nextAppointmentDate: state.nextAppointmentDate.length > 0 ? state.nextAppointmentDate : null,
  };
}
