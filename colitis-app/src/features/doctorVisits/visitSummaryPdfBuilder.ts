import { escapeHtml, formatGermanDate } from './doctorVisitPassBuilder';
import {
  formatDecimal,
  formatMedicationIntakeLabel,
  formatPeriodLabel,
  formatPhaseLabel,
  formatRatingLabel,
  formatSparseDataLabel,
  formatTriggerListLabel,
} from './visitSummary';
import type { MedicationSummaryLine, VisitSummary } from './visitSummary';

function buildFiguresSection(summary: VisitSummary): string {
  if (summary.figures === null) {
    return `<p class="sparse">${escapeHtml(
      formatSparseDataLabel(summary.daysWithEntries, summary.period.dayCount)
    )}</p>`;
  }

  const figures = summary.figures;
  return `
    <div class="kpis">
      <div class="kpi"><span class="n">${formatDecimal(figures.stoolsPerDay)}</span><span class="l">Stühle pro Tag</span></div>
      <div class="kpi"><span class="n">${figures.daysWithBlood}</span><span class="l">Tage mit Blut</span></div>
      <div class="kpi"><span class="n">${formatDecimal(figures.averagePainLevel)}</span><span class="l">Schmerz von 10</span></div>
      <div class="kpi"><span class="n">${summary.daysWithEntries} von ${summary.period.dayCount}</span><span class="l">Tagen erfasst</span></div>
    </div>
    <h2>Tagesbewertung</h2>
    <p>${escapeHtml(formatRatingLabel(figures))}</p>
  `;
}

function buildPhasesSection(summary: VisitSummary): string {
  if (summary.figures === null) {
    return '';
  }
  const body =
    summary.phases.length === 0
      ? '<p>Keine zusammenhängende auffällige Phase.</p>'
      : summary.phases.map((phase) => `<p>${escapeHtml(formatPhaseLabel(phase))}</p>`).join('\n');
  return `<h2>Auffällige Phasen</h2>${body}`;
}

function buildTriggersSection(summary: VisitSummary): string {
  if (summary.figures === null || summary.triggers.length === 0) {
    return '';
  }
  return `<h2>Häufigste Auslöser</h2><p>${escapeHtml(formatTriggerListLabel(summary.triggers))}</p>`;
}

function buildMedicationSection(line: MedicationSummaryLine): string {
  const ended = line.endDate === null ? '' : ` · beendet am ${formatGermanDate(line.endDate)}`;
  return `
    <div class="med${line.endDate === null ? '' : ' ended'}">
      <p class="med-name">${escapeHtml(line.name)}</p>
      <p class="med-detail">${escapeHtml(line.dose)} · ${escapeHtml(line.schedule)} · seit ${formatGermanDate(line.startDate)}${ended}</p>
      <p class="med-detail">${escapeHtml(formatMedicationIntakeLabel(line))}</p>
    </div>
  `;
}

function buildMedicationsSection(summary: VisitSummary): string {
  if (summary.medications.length === 0) {
    return '<h2>Medikamente</h2><p>Im Zeitraum war kein Medikament hinterlegt.</p>';
  }
  return `<h2>Medikamente</h2>${summary.medications.map(buildMedicationSection).join('\n')}`;
}

function buildScreeningSection(summary: VisitSummary): string {
  if (summary.nextScreeningDate === null) {
    return '';
  }
  return `<p class="screening">Nächste Vorsorge-Koloskopie: ${formatGermanDate(summary.nextScreeningDate)}</p>`;
}

export function buildVisitSummaryHtml(summary: VisitSummary, today: Date): string {
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
          h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6B6259; margin: 18px 0 6px; }
          p { font-size: 12px; margin: 3px 0; line-height: 1.5; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 20px; }
          .kpis { display: flex; gap: 10px; }
          .kpi { flex: 1; background: #F7F3EC; border-radius: 8px; padding: 10px; text-align: center; }
          .kpi .n { display: block; font-size: 19px; font-weight: 700; }
          .kpi .l { display: block; font-size: 10px; color: #6B6259; margin-top: 3px; }
          .sparse { font-style: italic; }
          .med { border-top: 1px solid #E4DACB; padding: 7px 0; }
          .med.ended { color: #6B6259; }
          .med-name { font-weight: 700; margin: 0; }
          .med-detail { color: #6B6259; margin: 1px 0; }
          .screening { margin-top: 14px; }
          .footer { color: #6B6259; font-size: 11px; margin-top: 24px; border-top: 1px solid #E4DACB; padding-top: 8px; }
        </style>
      </head>
      <body>
        <h1>Zusammenfassung für den Arztbesuch</h1>
        <p class="generated">${escapeHtml(formatPeriodLabel(summary.period))}</p>
        ${buildFiguresSection(summary)}
        ${buildPhasesSection(summary)}
        ${buildTriggersSection(summary)}
        ${buildMedicationsSection(summary)}
        ${buildScreeningSection(summary)}
        <p class="footer">Erstellt am ${day}.${month}.${year} · Die Angaben stammen aus einem selbstgeführten Tagebuch.</p>
      </body>
    </html>
  `;
}
