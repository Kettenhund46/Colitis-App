import { describe, it, expect } from 'vitest';
import { parseOverpassResponse } from './parseOverpassResponse';

describe('parseOverpassResponse', () => {
  it('maps OSM elements with tags into toilets', () => {
    const data = {
      elements: [
        {
          type: 'node',
          id: 12345,
          lat: 52.52,
          lon: 13.405,
          tags: { amenity: 'toilets', name: 'Bahnhof-Toilette', opening_hours: '24/7' },
        },
      ],
    };

    expect(parseOverpassResponse(data)).toEqual([
      {
        id: '12345',
        latitude: 52.52,
        longitude: 13.405,
        name: 'Bahnhof-Toilette',
        openingHours: '24/7',
      },
    ]);
  });

  it('defaults name and openingHours to null when tags are missing', () => {
    const data = {
      elements: [{ type: 'node', id: 999, lat: 1, lon: 2, tags: { amenity: 'toilets' } }],
    };

    expect(parseOverpassResponse(data)).toEqual([
      { id: '999', latitude: 1, longitude: 2, name: null, openingHours: null },
    ]);
  });

  it('defaults name and openingHours to null when there are no tags at all', () => {
    const data = { elements: [{ type: 'node', id: 1, lat: 1, lon: 1 }] };

    expect(parseOverpassResponse(data)).toEqual([
      { id: '1', latitude: 1, longitude: 1, name: null, openingHours: null },
    ]);
  });

  it('skips elements without coordinates', () => {
    const data = { elements: [{ type: 'node', id: 1, tags: { amenity: 'toilets' } }] };

    expect(parseOverpassResponse(data)).toEqual([]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseOverpassResponse(null)).toEqual([]);
    expect(parseOverpassResponse({})).toEqual([]);
    expect(parseOverpassResponse({ elements: 'not-an-array' })).toEqual([]);
  });
});
