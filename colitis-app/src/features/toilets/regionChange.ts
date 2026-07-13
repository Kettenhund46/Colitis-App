import type { Coordinates } from './types';
import { haversineDistanceMeters } from './distance';

export function hasMovedSignificantly(previous: Coordinates, next: Coordinates, thresholdMeters: number): boolean {
  return haversineDistanceMeters(previous, next) > thresholdMeters;
}
