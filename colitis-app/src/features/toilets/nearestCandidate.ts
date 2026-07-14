import { haversineDistanceMeters } from './distance';
import type { Coordinates, SavedPlace, Toilet } from './types';

export interface Candidate {
  kind: 'toilet' | 'place';
  id: string;
  latitude: number;
  longitude: number;
}

export function findNearestCandidate(origin: Coordinates, toilets: Toilet[], places: SavedPlace[]): Candidate | null {
  const candidates: Candidate[] = [
    ...toilets.map((toilet) => ({
      kind: 'toilet' as const,
      id: toilet.id,
      latitude: toilet.latitude,
      longitude: toilet.longitude,
    })),
    ...places.map((place) => ({
      kind: 'place' as const,
      id: String(place.id),
      latitude: place.latitude,
      longitude: place.longitude,
    })),
  ];

  if (candidates.length === 0) {
    return null;
  }

  let nearest = candidates[0];
  let nearestDistance = haversineDistanceMeters(origin, nearest);

  for (const candidate of candidates.slice(1)) {
    const distance = haversineDistanceMeters(origin, candidate);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}
