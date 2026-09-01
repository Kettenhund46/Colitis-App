import { describe, it, expect } from 'vitest';
import { formatDecimalComma } from './formatNumber';

describe('formatDecimalComma', () => {
  it('writes the separator as a comma', () => {
    expect(formatDecimalComma(3.4)).toBe('3,4');
  });

  it('always shows one decimal, also for whole numbers', () => {
    expect(formatDecimalComma(3)).toBe('3,0');
  });

  it('rounds to one decimal', () => {
    expect(formatDecimalComma(1.66)).toBe('1,7');
  });

  it('keeps the sign of a negative value', () => {
    expect(formatDecimalComma(-0.5)).toBe('-0,5');
  });
});
