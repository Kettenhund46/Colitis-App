import {
  STOOL_CONSISTENCY_OPTIONS,
  SYMPTOM_OPTIONS,
  BLOOD_LEVEL_LABELS,
  labelFor,
  buildTriggerLabels,
} from './constants';
import { formatOccurredAt } from './formatting';
import type { DiaryEntryWithTriggers } from './types';

const CSV_DELIMITER = ';';
const CSV_LINE_BREAK = '\r\n';
const CSV_BOM = '﻿';

const CSV_HEADER = [
  'Datum',
  'Stuhlgang-Häufigkeit',
  'Konsistenz',
  'Schmerzlevel',
  'Blut im Stuhl',
  'Auslöser',
  'Symptome',
  'Notiz',
];

function escapeCsvField(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildEntryRow(entry: DiaryEntryWithTriggers): string {
  const consistencyLabel = labelFor(STOOL_CONSISTENCY_OPTIONS, entry.stoolConsistency);
  const triggerLabels = buildTriggerLabels(entry.triggerCategories, entry.foodTriggerNote);
  const symptomLabels = entry.symptoms.map((symptom) => labelFor(SYMPTOM_OPTIONS, symptom));

  const fields = [
    formatOccurredAt(entry.occurredAt),
    String(entry.stoolFrequency),
    consistencyLabel,
    String(entry.painLevel),
    BLOOD_LEVEL_LABELS[entry.bloodLevel],
    triggerLabels.join(', '),
    symptomLabels.join(', '),
    entry.note ?? '',
  ];

  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

export function buildDiaryCsv(entries: DiaryEntryWithTriggers[]): string {
  const rows = [CSV_HEADER.join(CSV_DELIMITER), ...entries.map(buildEntryRow)];
  return CSV_BOM + rows.join(CSV_LINE_BREAK);
}
