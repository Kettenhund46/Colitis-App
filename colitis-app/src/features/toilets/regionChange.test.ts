import { describe, it, expect } from 'vitest';
import { hasMovedSignificantly } from './regionChange';

describe('hasMovedSignificantly', () => {
  it('returns false when the movement is below the threshold', () => {
    const previous = { latitude: 52.52, longitude: 13.405 };
    const next = { latitude: 52.5201, longitude: 13.405 };
    expect(hasMovedSignificantly(previous, next, 300)).toBe(false);
  });

  it('returns true when the movement exceeds the threshold', () => {
    const previous = { latitude: 52.52, longitude: 13.405 };
    const next = { latitude: 52.53, longitude: 13.405 };
    expect(hasMovedSignificantly(previous, next, 300)).toBe(true);
  });

  it('returns false for identical points', () => {
    const point = { latitude: 52.52, longitude: 13.405 };
    expect(hasMovedSignificantly(point, point, 300)).toBe(false);
  });
});
