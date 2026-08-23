import { describe, it, expect } from 'vitest';
import { buildVisitSummaryHtml } from './visitSummaryPdfBuilder';
import type { VisitSummary } from './visitSummary';

const TODAY = new Date(2026, 7, 23);

function summary(overrides: Partial<VisitSummary> = {}): VisitSummary {
  return {
    period: {
      fromDate: '2026-05-12',
      toDate: '2026-08-23',
      dayCount: 104,
      sinceVisitLabel: 'seit dem Besuch bei Dr. Weber',
    },
    daysWithEntries: 96,
    figures: {
      stoolsPerDay: 3.2,
      daysWithBlood: 12,
      averagePainLevel: 2.4,
      goodDays: 71,
      mediumDays: 18,
      badDays: 7,
    },
    phases: [],
    triggers: [],
    medications: [],
    nextScreeningDate: null,
    isEmpty: false,
    ...overrides,
  };
}

describe('buildVisitSummaryHtml', () => {
  it('names the period', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('12.05.2026 – 23.08.2026 · 104 Tage seit dem Besuch bei Dr. Weber');
  });

  it('shows the four figures', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('3,2');
    expect(html).toContain('12');
    expect(html).toContain('2,4');
    expect(html).toContain('96 von 104');
  });

  it('shows the day ratings', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('71 gut · 18 mittel · 7 schub-verdächtig');
  });

  it('replaces the figures with the hint when the period is too sparse', () => {
    const html = buildVisitSummaryHtml(summary({ figures: null, daysWithEntries: 4 }), TODAY);
    expect(html).toContain('An 4 von 104 Tagen wurde etwas erfasst');
    expect(html).not.toContain('schub-verdächtig');
  });

  it('lists the notable phases', () => {
    const html = buildVisitSummaryHtml(
      summary({
        phases: [
          { fromDate: '2026-07-03', toDate: '2026-07-14', spanDays: 12, affectedDays: 8, daysWithBlood: 6 },
        ],
      }),
      TODAY
    );
    expect(html).toContain('03.07.2026 – 14.07.2026: an 8 von 12 Tagen');
  });

  it('says so when there is no notable phase', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('Keine zusammenhängende auffällige Phase.');
  });

  it('lists the triggers with their share', () => {
    const html = buildVisitSummaryHtml(
      summary({ triggers: [{ label: 'Stress', percent: 61 }] }),
      TODAY
    );
    expect(html).toContain('Stress (61 %)');
  });

  it('lists a medication with its intake line', () => {
    const html = buildVisitSummaryHtml(
      summary({
        medications: [
          {
            name: 'Mesalazin',
            dose: '500 mg',
            schedule: '3x täglich',
            startDate: '2026-05-04',
            endDate: null,
            dueDays: 104,
            daysWithIntake: 96,
            totalIntakes: 268,
          },
        ],
      }),
      TODAY
    );
    expect(html).toContain('Mesalazin');
    expect(html).toContain('An 96 von 104 Tagen erfasst, 268 Einnahmen');
  });

  it('marks an ended medication with its end date', () => {
    const html = buildVisitSummaryHtml(
      summary({
        medications: [
          {
            name: 'Prednisolon',
            dose: '20 mg',
            schedule: 'morgens',
            startDate: '2026-05-04',
            endDate: '2026-08-08',
            dueDays: 88,
            daysWithIntake: 88,
            totalIntakes: 88,
          },
        ],
      }),
      TODAY
    );
    expect(html).toContain('beendet am 08.08.2026');
  });

  it('shows the screening date only when one is stored', () => {
    expect(buildVisitSummaryHtml(summary({ nextScreeningDate: '2027-01-15' }), TODAY)).toContain(
      'Nächste Vorsorge-Koloskopie: 15.01.2027'
    );
    expect(buildVisitSummaryHtml(summary(), TODAY)).not.toContain('Vorsorge-Koloskopie');
  });

  it('escapes markup in a medication name', () => {
    const html = buildVisitSummaryHtml(
      summary({
        medications: [
          {
            name: '<script>alert(1)</script>',
            dose: '1',
            schedule: '1',
            startDate: '2026-05-04',
            endDate: null,
            dueDays: 1,
            daysWithIntake: 1,
            totalIntakes: 1,
          },
        ],
      }),
      TODAY
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('carries the creation date and the origin note', () => {
    const html = buildVisitSummaryHtml(summary(), TODAY);
    expect(html).toContain('Erstellt am 23.08.2026');
    expect(html).toContain('Die Angaben stammen aus einem selbstgeführten Tagebuch.');
  });
});
