export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Toilet {
  id: string;
  latitude: number;
  longitude: number;
  name: string | null;
  openingHours: string | null;
}

export interface SavedPlace {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  note: string | null;
  category: string;
}

export interface SavedPlaceInput {
  name: string;
  latitude: number;
  longitude: number;
  note: string | null;
  category: string;
}

export type WebViewToNativeMessage =
  | { type: 'ready' }
  | { type: 'regionChange'; latitude: number; longitude: number }
  | { type: 'markerTap'; id: string; kind: 'toilet' | 'place' }
  | { type: 'longPress'; latitude: number; longitude: number };
