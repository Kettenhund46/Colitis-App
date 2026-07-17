import { describe, it, expect } from 'vitest';
import { pickJokeForDate } from './pickJokeForDate';

const SAMPLE_JOKES = ['Witz A', 'Witz B', 'Witz C'];

describe('pickJokeForDate', () => {
  it('returns the same joke for the same calendar date', () => {
    const first = pickJokeForDate(new Date(2026, 6, 17, 8, 0), SAMPLE_JOKES);
    const second = pickJokeForDate(new Date(2026, 6, 17, 22, 30), SAMPLE_JOKES);
    expect(first).toBe(second);
  });

  it('returns a joke that is part of the given pool', () => {
    const joke = pickJokeForDate(new Date(2026, 6, 17), SAMPLE_JOKES);
    expect(SAMPLE_JOKES).toContain(joke);
  });

  it('always returns the only joke in a single-element pool', () => {
    expect(pickJokeForDate(new Date(2026, 6, 17), ['Einziger Witz'])).toBe('Einziger Witz');
  });

  it('throws when the pool is empty', () => {
    expect(() => pickJokeForDate(new Date(2026, 6, 17), [])).toThrow('Kein Wortwitz verfügbar.');
  });
});
