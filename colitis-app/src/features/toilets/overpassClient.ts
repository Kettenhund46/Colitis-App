import { buildOverpassToiletsQuery } from './buildOverpassToiletsQuery';
import { parseOverpassResponse } from './parseOverpassResponse';
import type { Coordinates, Toilet } from './types';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export async function fetchNearbyToilets(center: Coordinates, radiusMeters: number): Promise<Toilet[]> {
  const query = buildOverpassToiletsQuery(center, radiusMeters);
  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`Overpass-Anfrage fehlgeschlagen (Status ${response.status})`);
  }

  const data: unknown = await response.json();
  return parseOverpassResponse(data);
}
