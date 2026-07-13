import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters } from './distance';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMeters({ latitude: 52.52, longitude: 13.405 }, { latitude: 52.52, longitude: 13.405 })).toBe(0);
  });

  it('returns approximately 111km for one degree of longitude at the equator', () => {
    const distance = haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    expect(distance).toBeGreaterThan(110000);
    expect(distance).toBeLessThan(112000);
  });

  it('returns approximately 500-510km between Berlin and Munich', () => {
    const berlin = { latitude: 52.52, longitude: 13.405 };
    const munich = { latitude: 48.1351, longitude: 11.582 };
    const distance = haversineDistanceMeters(berlin, munich);
    expect(distance).toBeGreaterThan(500000);
    expect(distance).toBeLessThan(510000);
  });
});
