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

export type WebViewToNativeMessage =
  | { type: 'ready' }
  | { type: 'regionChange'; latitude: number; longitude: number }
  | { type: 'markerTap'; id: string };
