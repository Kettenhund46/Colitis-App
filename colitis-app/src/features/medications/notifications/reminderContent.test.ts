import { describe, it, expect } from 'vitest';
import { buildMedicationReminderContent, buildScreeningReminderContent } from './reminderContent';

describe('buildMedicationReminderContent', () => {
  it('includes the medication name and dose in the body', () => {
    expect(buildMedicationReminderContent({ name: 'Mesalazin', dose: '500mg' })).toEqual({
      title: 'Medikamenten-Erinnerung',
      body: 'Mesalazin – 500mg',
    });
  });

  it('still builds a title/body pair when dose is missing', () => {
    expect(buildMedicationReminderContent({ name: 'Mesalazin' })).toEqual({
      title: 'Medikamenten-Erinnerung',
      body: 'Mesalazin – undefined',
    });
  });
});

describe('buildScreeningReminderContent', () => {
  it('uses the note as body when present', () => {
    expect(buildScreeningReminderContent({ note: 'Termin bei Dr. Müller' })).toEqual({
      title: 'Vorsorge-Koloskopie',
      body: 'Termin bei Dr. Müller',
    });
  });

  it('falls back to the default body when note is empty', () => {
    expect(buildScreeningReminderContent({ note: '' })).toEqual({
      title: 'Vorsorge-Koloskopie',
      body: 'Deine Vorsorge-Koloskopie ist fällig.',
    });
  });

  it('falls back to the default body when note is missing', () => {
    expect(buildScreeningReminderContent({})).toEqual({
      title: 'Vorsorge-Koloskopie',
      body: 'Deine Vorsorge-Koloskopie ist fällig.',
    });
  });
});
