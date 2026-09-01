import { isValidCalendarDate } from '../medications/dateValidation';
import type { DateTrigger } from '../medications/reminderScheduling';
import type { ReminderContent } from '../../lib/notifications/notificationService';
import type { DoctorVisit } from './types';

/**
 * Wie viele Tage vor dem Termin erinnert wird. Ein Abend Vorlauf: Zeit, die
 * Zusammenfassung anzusehen und Fragen zu notieren. Am Terminmorgen waere es
 * dafuer zu spaet.
 */
export const APPOINTMENT_REMINDER_LEAD_DAYS: number = 1;
const APPOINTMENT_REMINDER_HOUR = 18;
const APPOINTMENT_REMINDER_MINUTE = 0;

/**
 * Der Zeitpunkt der Erinnerung, oder `null`, wenn er bereits vorbei ist --
 * dann wird nichts geplant. Ein Termin morgen frueh faellt darunter, weil der
 * Vorabend schon vergangen ist.
 */
export function buildAppointmentReminderTrigger(
  nextAppointmentDate: string,
  now: Date
): DateTrigger | null {
  if (!isValidCalendarDate(nextAppointmentDate)) {
    throw new Error(`Ungültiges Termindatum: "${nextAppointmentDate}" (erwartet JJJJ-MM-TT)`);
  }

  const [year, month, day] = nextAppointmentDate.split('-').map(Number);
  // Der Tagesanteil darf negativ werden -- der Date-Konstruktor rechnet ueber
  // Monats- und Jahresgrenzen hinweg. Der 1. Maerz minus ein Tag ist der
  // 28. oder 29. Februar, ohne dass hier gerechnet werden muss.
  const remindAt = new Date(
    year,
    month - 1,
    day - APPOINTMENT_REMINDER_LEAD_DAYS,
    APPOINTMENT_REMINDER_HOUR,
    APPOINTMENT_REMINDER_MINUTE,
    0,
    0
  );

  if (remindAt.getTime() <= now.getTime()) {
    return null;
  }
  return { type: 'date', date: remindAt };
}

export function buildAppointmentReminderTitle(): string {
  return APPOINTMENT_REMINDER_LEAD_DAYS === 1
    ? 'Morgen ist dein Arzttermin'
    : `Dein Arzttermin ist in ${APPOINTMENT_REMINDER_LEAD_DAYS} Tagen`;
}

export function buildAppointmentReminderContent(visit: DoctorVisit): ReminderContent {
  const doctorName = visit.doctorName?.trim() ?? '';
  const where = doctorName.length > 0 ? ` bei ${doctorName}` : '';
  const reason = visit.reason?.trim() ?? '';
  const because = reason.length > 0 ? ` (${reason})` : '';

  return {
    title: buildAppointmentReminderTitle(),
    body: `Termin${where}${because}. Deine Zusammenfassung ist bereit.`,
  };
}
