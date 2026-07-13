import { describe, it, expect } from 'vitest';
import { buildNavigationUrl } from './navigationLink';

describe('buildNavigationUrl', () => {
  it('builds a cross-platform maps navigation URL for the given coordinates', () => {
    const url = buildNavigationUrl({ latitude: 52.52, longitude: 13.405 });
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=52.52,13.405');
  });
});
