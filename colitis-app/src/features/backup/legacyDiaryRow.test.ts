import { describe, it, expect } from 'vitest';
import { normalizeDiaryRow, LEGACY_BLOOD_LEVEL } from './legacyDiaryRow';
import type { BackupData } from './types';

type DiaryRow = BackupData['tables']['diaryEntries'][number];

const CURRENT_ROW: DiaryRow = {
  id: 1,
  occurredAt: '2026-07-14T09:00:00.000Z',
  stoolFrequency: 3,
  bloodLevel: 2,
  stoolConsistency: 'weich',
  painLevel: 4,
  symptoms: 'Bauchschmerzen',
  note: null,
};

/** Wie eine Zeile in einer Sicherung vor der Umstellung aussah. */
function legacyRow(hasBlood: boolean): DiaryRow {
  const { bloodLevel, ...rest } = CURRENT_ROW;
  return { ...rest, hasBlood } as unknown as DiaryRow;
}

describe('normalizeDiaryRow', () => {
  it('leaves a current row untouched', () => {
    expect(normalizeDiaryRow(CURRENT_ROW)).toBe(CURRENT_ROW);
  });

  it('keeps level 0 of a current row instead of mistaking it for a legacy row', () => {
    const noBlood: DiaryRow = { ...CURRENT_ROW, bloodLevel: 0 };
    expect(normalizeDiaryRow(noBlood)).toBe(noBlood);
  });

  it('turns a legacy yes into the mildest positive level', () => {
    expect(normalizeDiaryRow(legacyRow(true)).bloodLevel).toBe(LEGACY_BLOOD_LEVEL);
  });

  it('turns a legacy no into no blood', () => {
    expect(normalizeDiaryRow(legacyRow(false)).bloodLevel).toBe(0);
  });

  it('accepts the number 1 that SQLite stores for a boolean', () => {
    const row = { ...legacyRow(false), hasBlood: 1 } as unknown as DiaryRow;
    expect(normalizeDiaryRow(row).bloodLevel).toBe(LEGACY_BLOOD_LEVEL);
  });

  it('drops the legacy key so nothing downstream reads it again', () => {
    expect(normalizeDiaryRow(legacyRow(true))).not.toHaveProperty('hasBlood');
  });

  it('carries every other field across unchanged', () => {
    const normalized = normalizeDiaryRow(legacyRow(true));

    expect(normalized.id).toBe(CURRENT_ROW.id);
    expect(normalized.occurredAt).toBe(CURRENT_ROW.occurredAt);
    expect(normalized.stoolFrequency).toBe(CURRENT_ROW.stoolFrequency);
    expect(normalized.stoolConsistency).toBe(CURRENT_ROW.stoolConsistency);
    expect(normalized.painLevel).toBe(CURRENT_ROW.painLevel);
    expect(normalized.symptoms).toBe(CURRENT_ROW.symptoms);
  });
});
