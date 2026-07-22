import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, labelFor, buildTriggerLabels } from './constants';
import { formatOccurredAt } from './formatting';
import type { DiaryEntryWithTriggers } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEntrySection(entry: DiaryEntryWithTriggers): string {
  const consistencyLabel = labelFor(STOOL_CONSISTENCY_OPTIONS, entry.stoolConsistency);
  const triggerLabels = buildTriggerLabels(entry.triggerCategories, entry.foodTriggerNote);
  const symptomLabels = entry.symptoms.map((symptom) => labelFor(SYMPTOM_OPTIONS, symptom));

  return `
    <section class="entry">
      <h2>${escapeHtml(formatOccurredAt(entry.occurredAt))}</h2>
      <p>Stuhlgang: ${entry.stoolFrequency}&times; &middot; ${escapeHtml(consistencyLabel)}</p>
      <p>Schmerzlevel: ${entry.painLevel}/10</p>
      ${entry.hasBlood ? '<p class="warning">Blut im Stuhl</p>' : ''}
      ${triggerLabels.length > 0 ? `<p>Auslöser: ${escapeHtml(triggerLabels.join(', '))}</p>` : ''}
      ${symptomLabels.length > 0 ? `<p>Symptome: ${escapeHtml(symptomLabels.join(', '))}</p>` : ''}
      ${entry.note ? `<p class="note">${escapeHtml(entry.note)}</p>` : ''}
    </section>
  `;
}

export function buildDiaryPdfHtml(entries: DiaryEntryWithTriggers[]): string {
  const body =
    entries.length > 0
      ? entries.map(buildEntrySection).join('\n')
      : '<p>Keine Einträge vorhanden.</p>';

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .entry { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .entry h2 { font-size: 14px; margin: 0 0 6px; }
          .entry p { font-size: 12px; margin: 2px 0; }
          .warning { color: #B5533C; font-weight: 600; }
          .note { font-style: italic; }
        </style>
      </head>
      <body>
        <h1>Tagebuch</h1>
        <p class="generated">Erstellt am ${escapeHtml(formatOccurredAt(new Date().toISOString()))}</p>
        ${body}
      </body>
    </html>
  `;
}
