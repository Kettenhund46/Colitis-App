import { describe, it, expect } from 'vitest';
import { buildDiaryCsv } from './diaryCsvBuilder';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 3,
    hasBlood: false,
    stoolConsistency: 'weich',
    painLevel: 4,
    symptoms: [],
    note: null,
    triggerCategories: [],
    ...overrides,
  };
}

describe('buildDiaryCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildDiaryCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('includes the German header row, semicolon-separated', () => {
    const csv = buildDiaryCsv([]);
    const firstLine = csv.slice(1).split('\r\n')[0];
    expect(firstLine).toBe(
      'Datum;Stuhlgang-Häufigkeit;Konsistenz;Schmerzlevel;Blut im Stuhl;Auslöser;Symptome;Notiz'
    );
  });

  it('contains only the header when there are no entries', () => {
    const csv = buildDiaryCsv([]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(1);
  });

  it('writes one row per entry with frequency, consistency label, pain level, and blood flag', () => {
    const csv = buildDiaryCsv([makeEntry({ stoolFrequency: 5, stoolConsistency: 'waessrig', painLevel: 8 })]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toContain('08.07.2026');
    expect(row).toContain(';5;Wässrig;8;Nein;;;');
  });

  it('renders "Ja" or "Nein" for blood in stool', () => {
    const withBlood = buildDiaryCsv([makeEntry({ hasBlood: true })]);
    expect(withBlood.slice(1).split('\r\n')[1]).toContain(';Ja;');

    const withoutBlood = buildDiaryCsv([makeEntry({ hasBlood: false })]);
    expect(withoutBlood.slice(1).split('\r\n')[1]).toContain(';Nein;');
  });

  it('joins multiple trigger and symptom labels with commas inside one cell', () => {
    const csv = buildDiaryCsv([
      makeEntry({ triggerCategories: ['stress', 'ernaehrung'], symptoms: ['fieber', 'muedigkeit'] }),
    ]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toContain('Stress, Ernährung');
    expect(row).toContain('Fieber, Müdigkeit');
  });

  it('leaves the note column empty when there is no note', () => {
    const csv = buildDiaryCsv([makeEntry({ note: null })]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row.endsWith(';')).toBe(true);
  });

  it('writes a plain note as-is', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Nach dem Frühstück' })]);
    expect(csv).toContain('Nach dem Frühstück');
  });

  it('quotes a note containing a semicolon', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Stress; viel Kaffee' })]);
    expect(csv).toContain('"Stress; viel Kaffee"');
  });

  it('doubles embedded double quotes and wraps the field in quotes', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Arzt sagte "alles gut"' })]);
    expect(csv).toContain('"Arzt sagte ""alles gut"""');
  });

  it('quotes a note containing a line break', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Zeile eins\nZeile zwei' })]);
    expect(csv).toContain('"Zeile eins\nZeile zwei"');
  });

  it('writes multiple entries as multiple rows in the given order', () => {
    const csv = buildDiaryCsv([
      makeEntry({ id: 1, occurredAt: '2026-07-08T10:00:00.000Z' }),
      makeEntry({ id: 2, occurredAt: '2026-07-06T10:00:00.000Z' }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('08.07.2026');
    expect(lines[2]).toContain('06.07.2026');
  });
});
