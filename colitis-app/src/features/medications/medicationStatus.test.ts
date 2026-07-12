import { describe, it, expect } from 'vitest';
import { isMedicationActive } from './medicationStatus';

describe('isMedicationActive', () => {
  const today = new Date(2026, 6, 12);

  it('is active when there is no end date', () => {
    expect(isMedicationActive(null, today)).toBe(true);
  });

  it('is active when the end date is today', () => {
    expect(isMedicationActive('2026-07-12', today)).toBe(true);
  });

  it('is active when the end date is in the future', () => {
    expect(isMedicationActive('2026-08-01', today)).toBe(true);
  });

  it('is inactive when the end date is in the past', () => {
    expect(isMedicationActive('2026-07-01', today)).toBe(false);
  });

  it('is inactive when the end date was yesterday, even at local time whose UTC date is still yesterday', () => {
    // Local time just after midnight - UTC date is still the previous day for UTC+ timezones,
    // but the local calendar day has already advanced past the end date.
    const justAfterLocalMidnight = new Date(2026, 6, 12, 0, 30, 0, 0);
    expect(isMedicationActive('2026-07-11', justAfterLocalMidnight)).toBe(false);
  });
});
