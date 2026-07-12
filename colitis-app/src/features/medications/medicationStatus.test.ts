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
});
