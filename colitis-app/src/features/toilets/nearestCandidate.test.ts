import { describe, it, expect } from 'vitest';
import { findNearestCandidate } from './nearestCandidate';
import type { Toilet, SavedPlace } from './types';

const origin = { latitude: 52.52, longitude: 13.405 };

const nearToilet: Toilet = {
  id: 'toilet-1',
  latitude: 52.521,
  longitude: 13.406,
  name: null,
  openingHours: null,
};

const farToilet: Toilet = {
  id: 'toilet-2',
  latitude: 52.6,
  longitude: 13.5,
  name: null,
  openingHours: null,
};

const nearPlace: SavedPlace = {
  id: 1,
  name: 'Büro',
  latitude: 52.5201,
  longitude: 13.4051,
  note: null,
  category: 'Arbeit',
};

describe('findNearestCandidate', () => {
  it('returns null when there are no candidates', () => {
    expect(findNearestCandidate(origin, [], [])).toBeNull();
  });

  it('picks the nearest toilet when only toilets are given', () => {
    const result = findNearestCandidate(origin, [farToilet, nearToilet], []);
    expect(result).toEqual({ kind: 'toilet', id: 'toilet-1', latitude: 52.521, longitude: 13.406 });
  });

  it('picks a saved place over a farther toilet, regardless of type', () => {
    const result = findNearestCandidate(origin, [farToilet], [nearPlace]);
    expect(result).toEqual({ kind: 'place', id: '1', latitude: 52.5201, longitude: 13.4051 });
  });

  it('picks the nearer of a close toilet and a closer saved place', () => {
    const result = findNearestCandidate(origin, [nearToilet], [nearPlace]);
    expect(result).toEqual({ kind: 'place', id: '1', latitude: 52.5201, longitude: 13.4051 });
  });
});
