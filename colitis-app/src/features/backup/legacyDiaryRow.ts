import type { BackupData } from './types';

type DiaryRow = BackupData['tables']['diaryEntries'][number];

/**
 * Sicherungen von vor der Umstellung auf vier Blutstufen kennen nur
 * `hasBlood: true/false`. Ohne Uebersetzung ginge die Angabe beim
 * Wiederherstellen still verloren: Der unbekannte Schluessel wird beim
 * Einfuegen ignoriert, und `blood_level` fiele auf seinen Vorgabewert 0
 * zurueck -- aus "Blut vermerkt" wuerde "kein Blut".
 *
 * "Ja" wird zu Stufe 1 (Schlieren), derselben zurueckhaltenden Deutung, mit
 * der auch die Migration die vorhandenen Eintraege uebernommen hat.
 */
export const LEGACY_BLOOD_LEVEL = 1;

export function normalizeDiaryRow(row: DiaryRow): DiaryRow {
  if (typeof row.bloodLevel === 'number') {
    return row;
  }

  const { hasBlood, ...rest } = row as DiaryRow & { hasBlood?: unknown };

  return {
    ...rest,
    bloodLevel: hasBlood === true || hasBlood === 1 ? LEGACY_BLOOD_LEVEL : 0,
  };
}
