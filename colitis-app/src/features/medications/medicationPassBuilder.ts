import { isMedicationActive, formatLocalDate } from './medicationStatus';
import { computeIntakeAdherence } from './adherence';
import { parseLocalDate, addDays, formatLocalDateKey, eachDayInclusive } from '../../lib/localDate';
import { formatDayCountDative } from '../../lib/counting';
import type { ScheduleHistory } from './scheduleHistory';
import type { Medication, MedicationIntake } from './types';

/**
 * Rueckblick der Einnahme-Zeile im Pass. Drei Monate sind lang genug fuer eine
 * belastbare Quote und kurz genug, dass sie den heutigen Zeitplan beschreibt.
 */
export const PASS_ADHERENCE_DAYS = 90;

export const NO_ADHERENCE_TEXT = 'Noch keine Einnahmen erfasst.';

/**
 * Woraus die Quote entsteht. Steht unter jeder Zahl, damit sie im Sprechzimmer
 * nicht fuer eine Messung gehalten wird.
 */
export const PASS_ORIGIN_NOTE =
  'Die Einnahme-Zahlen stammen aus selbst abgehakten Einnahmen. Pausen sind herausgerechnet.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMedicationStartDate(startDate: string): string {
  const [year, month, day] = startDate.split('-');
  return `${day}.${month}.${year}`;
}

/** Der Zeitraum der Einnahme-Zeile: die letzten 90 Tage einschliesslich heute. */
export function passAdherencePeriod(today: Date): string[] {
  const toDate = formatLocalDateKey(today);
  const fromDate = formatLocalDateKey(addDays(parseLocalDate(toDate), -(PASS_ADHERENCE_DAYS - 1)));
  return eachDayInclusive(fromDate, toDate);
}

export function formatPassAdherenceLabel(completeDays: number, dueDays: number): string {
  if (dueDays === 0) {
    return NO_ADHERENCE_TEXT;
  }
  return `An ${completeDays} von ${formatDayCountDative(dueDays)} vollständig genommen`;
}

function buildMedicationSection(
  medication: Medication,
  intakes: MedicationIntake[],
  history: ScheduleHistory,
  periodDays: string[]
): string {
  const adherence = computeIntakeAdherence(medication, intakes, history, periodDays);
  return `
    <section class="medication">
      <h2>${escapeHtml(medication.name)}</h2>
      <p>${escapeHtml(medication.dose)} &middot; ${escapeHtml(medication.schedule)}</p>
      <p>Seit ${formatMedicationStartDate(medication.startDate)}</p>
      <p class="adherence">${escapeHtml(
        formatPassAdherenceLabel(adherence.completeDays, adherence.dueDays.length)
      )}</p>
    </section>
  `;
}

export function buildMedicationPassHtml(
  medications: Medication[],
  intakes: MedicationIntake[],
  history: ScheduleHistory,
  today: Date
): string {
  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const periodDays = passAdherencePeriod(today);
  const body =
    activeMedications.length > 0
      ? activeMedications
          .map((medication) => buildMedicationSection(medication, intakes, history, periodDays))
          .join('\n')
      : '<p>Keine aktiven Medikamente vorhanden.</p>';

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .medication { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .medication h2 { font-size: 14px; margin: 0 0 6px; }
          .medication p { font-size: 12px; margin: 2px 0; }
          .adherence { font-weight: 700; }
          .origin { color: #6B6259; font-size: 11px; font-style: italic; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Medikamenten-Pass</h1>
        <p class="generated">Erstellt am ${formatMedicationStartDate(formatLocalDate(today))}</p>
        ${body}
        <p class="origin">${escapeHtml(PASS_ORIGIN_NOTE)}</p>
      </body>
    </html>
  `;
}
