import { describe, it, expect } from 'vitest';
import { isValidCalendarDate } from './dateValidation';

describe('isValidCalendarDate', () => {
  it('accepts a valid date', () => {
    expect(isValidCalendarDate('2026-07-12')).toBe(true);
  });

  it('accepts a valid leap day', () => {
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
  });

  it('rejects a non-existent leap day', () => {
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
  });

  it('rejects an out-of-range month', () => {
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
  });

  it('rejects an out-of-range day', () => {
    expect(isValidCalendarDate('2026-01-45')).toBe(false);
  });

  it('rejects values that do not match the JJJJ-MM-TT format', () => {
    expect(isValidCalendarDate('12.07.2026')).toBe(false);
    expect(isValidCalendarDate('2026-7-12')).toBe(false);
    expect(isValidCalendarDate('')).toBe(false);
  });
});
