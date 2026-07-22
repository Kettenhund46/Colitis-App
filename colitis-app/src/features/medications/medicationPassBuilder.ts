import { isMedicationActive, formatLocalDate } from './medicationStatus';
import type { Medication } from './types';

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

function buildMedicationSection(medication: Medication): string {
  return `
    <section class="medication">
      <h2>${escapeHtml(medication.name)}</h2>
      <p>${escapeHtml(medication.dose)} &middot; ${escapeHtml(medication.schedule)}</p>
      <p>Seit ${formatMedicationStartDate(medication.startDate)}</p>
    </section>
  `;
}

export function buildMedicationPassHtml(medications: Medication[], today: Date): string {
  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const body =
    activeMedications.length > 0
      ? activeMedications.map(buildMedicationSection).join('\n')
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
        </style>
      </head>
      <body>
        <h1>Medikamenten-Pass</h1>
        <p class="generated">Erstellt am ${formatMedicationStartDate(formatLocalDate(today))}</p>
        ${body}
      </body>
    </html>
  `;
}
