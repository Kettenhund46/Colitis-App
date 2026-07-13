import { describe, it, expect } from 'vitest';
import { buildOverpassToiletsQuery } from './buildOverpassToiletsQuery';

describe('buildOverpassToiletsQuery', () => {
  it('builds an Overpass QL query for public toilets around a center point', () => {
    const query = buildOverpassToiletsQuery({ latitude: 52.52, longitude: 13.405 }, 1500);

    expect(query).toBe(
      '[out:json][timeout:25];node["amenity"="toilets"](around:1500,52.52,13.405);out body;'
    );
  });

  it('uses the given radius in the query', () => {
    const query = buildOverpassToiletsQuery({ latitude: 0, longitude: 0 }, 500);

    expect(query).toContain('around:500,0,0');
  });
});
