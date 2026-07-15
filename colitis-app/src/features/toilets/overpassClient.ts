import { buildOverpassToiletsQuery } from './buildOverpassToiletsQuery';
import { parseOverpassResponse } from './parseOverpassResponse';
import { OVERPASS_CLIENT_TIMEOUT_MS } from './constants';
import type { Coordinates, Toilet } from './types';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export async function fetchNearbyToilets(center: Coordinates, radiusMeters: number): Promise<Toilet[]> {
  const query = buildOverpassToiletsQuery(center, radiusMeters);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OVERPASS_CLIENT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Overpass-Anfrage abgebrochen (Zeitüberschreitung).');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Overpass-Anfrage fehlgeschlagen (Status ${response.status})`);
  }

  const data: unknown = await response.json();
  return parseOverpassResponse(data);
}
