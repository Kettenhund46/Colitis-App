import type { Toilet } from './types';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export function parseOverpassResponse(data: unknown): Toilet[] {
  const response = data as Partial<OverpassResponse> | null;
  if (!response || !Array.isArray(response.elements)) {
    return [];
  }

  const toilets: Toilet[] = [];
  for (const element of response.elements) {
    if (typeof element.lat !== 'number' || typeof element.lon !== 'number') {
      continue;
    }
    toilets.push({
      id: String(element.id),
      latitude: element.lat,
      longitude: element.lon,
      name: element.tags?.name ?? null,
      openingHours: element.tags?.opening_hours ?? null,
    });
  }
  return toilets;
}
