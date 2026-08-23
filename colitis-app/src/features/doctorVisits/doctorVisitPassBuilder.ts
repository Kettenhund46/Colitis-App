import type { DoctorVisit } from './types';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function buildVisitSection(visit: DoctorVisit): string {
  return `
    <section class="visit">
      <h2>${escapeHtml(formatGermanDate(visit.visitDate))}</h2>
      ${visit.doctorName ? `<p>${escapeHtml(visit.doctorName)}</p>` : ''}
      ${visit.reason ? `<p>${escapeHtml(visit.reason)}</p>` : ''}
      ${visit.note ? `<p class="note">${escapeHtml(visit.note)}</p>` : ''}
      ${visit.nextAppointmentDate ? `<p>Nächster Termin: ${escapeHtml(formatGermanDate(visit.nextAppointmentDate))}</p>` : ''}
    </section>
  `;
}

export function buildDoctorVisitPassHtml(visits: DoctorVisit[], today: Date): string {
  const body =
    visits.length > 0 ? visits.map(buildVisitSection).join('\n') : '<p>Keine Arztbesuche erfasst.</p>';

  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .visit { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .visit h2 { font-size: 14px; margin: 0 0 6px; }
          .visit p { font-size: 12px; margin: 2px 0; }
          .note { font-style: italic; }
        </style>
      </head>
      <body>
        <h1>Arztbesuch-Übersicht</h1>
        <p class="generated">Erstellt am ${day}.${month}.${year}</p>
        ${body}
      </body>
    </html>
  `;
}
