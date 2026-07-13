import type { Coordinates } from './types';

export function buildOverpassToiletsQuery(center: Coordinates, radiusMeters: number): string {
  return `[out:json][timeout:25];node["amenity"="toilets"](around:${radiusMeters},${center.latitude},${center.longitude});out body;`;
}
