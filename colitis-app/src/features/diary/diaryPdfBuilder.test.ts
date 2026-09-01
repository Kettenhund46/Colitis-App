import { describe, it, expect } from 'vitest';
import { buildDiaryPdfHtml } from './diaryPdfBuilder';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 3,
    bloodLevel: 0,
    stoolConsistency: 'weich',
    painLevel: 4,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('buildDiaryPdfHtml', () => {
  it('includes a title and the formatted date for each entry', () => {
    const html = buildDiaryPdfHtml([makeEntry()]);
    expect(html).toContain('Tagebuch');
    expect(html).toContain('08.07.2026');
  });

  it('renders a message when there are no entries', () => {
    const html = buildDiaryPdfHtml([]);
    expect(html).toContain('Keine Einträge vorhanden.');
  });

  it('includes stool frequency, consistency label, and pain level', () => {
    const html = buildDiaryPdfHtml([makeEntry({ stoolFrequency: 5, stoolConsistency: 'waessrig', painLevel: 8 })]);
    expect(html).toContain('5');
    expect(html).toContain('Wässrig');
    expect(html).toContain('8/10');
  });

  it('flags blood in stool only when present', () => {
    const withBlood = buildDiaryPdfHtml([makeEntry({ bloodLevel: 1 })]);
    expect(withBlood).toContain('Blut im Stuhl');

    const withoutBlood = buildDiaryPdfHtml([makeEntry({ bloodLevel: 0 })]);
    expect(withoutBlood).not.toContain('Blut im Stuhl');
  });

  it('renders German labels for trigger categories and symptoms', () => {
    const html = buildDiaryPdfHtml([
      makeEntry({ triggerCategories: ['stress', 'ernaehrung'], symptoms: ['fieber'] }),
    ]);
    expect(html).toContain('Stress');
    expect(html).toContain('Ernährung');
    expect(html).toContain('Fieber');
  });

  it('renders a free-text note', () => {
    const html = buildDiaryPdfHtml([makeEntry({ note: 'Nach dem Frühstück' })]);
    expect(html).toContain('Nach dem Frühstück');
  });

  it('escapes HTML special characters in the note', () => {
    const html = buildDiaryPdfHtml([makeEntry({ note: '<script>alert(1)</script> & "quoted"' })]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('renders multiple entries in the given order', () => {
    const html = buildDiaryPdfHtml([
      makeEntry({ id: 1, occurredAt: '2026-07-08T10:00:00.000Z' }),
      makeEntry({ id: 2, occurredAt: '2026-07-06T10:00:00.000Z' }),
    ]);
    const firstIndex = html.indexOf('08.07.2026');
    const secondIndex = html.indexOf('06.07.2026');
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });

  it('shows the food trigger note in parentheses next to Ernährung', () => {
    const html = buildDiaryPdfHtml([makeEntry({ triggerCategories: ['ernaehrung'], foodTriggerNote: 'Kaffee' })]);
    expect(html).toContain('Ernährung (Kaffee)');
  });
});
