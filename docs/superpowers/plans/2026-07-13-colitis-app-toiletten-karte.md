# Toiletten-Finder – Kartenansicht, Standort & Overpass-Anbindung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adrian öffnet den Toiletten-Tab und sieht eine Karte mit öffentlichen Toiletten in seiner Nähe (aus OpenStreetMap/Overpass), kann auf einen Marker tippen und sich extern dorthin navigieren lassen.

**Architecture:** Eine `WebView` rendert eine lokal gebündelte, selbstständige HTML-Seite mit Leaflet.js (Karten-Bibliothek als String ins Bundle generiert, kein CDN, kein Google-Konto). React Native und die WebView kommunizieren über eine Message-Bridge (`injectJavaScript` rein, `onMessage`/`window.ReactNativeWebView.postMessage` raus). Die eigentliche Overpass-Anfrage und das Parsen der Ergebnisse laufen als reine, testbare TypeScript-Funktionen im React-Native-Teil — die WebView bekommt nur fertige Toiletten-Daten zum Anzeigen.

**Tech Stack:** TypeScript, React Native/Expo Router, Vitest, `react-native-webview`, `expo-location`, `leaflet` (nur als Build-Time-DevDependency zur HTML-Generierung, wird nicht als JS-Modul in die App importiert).

## Global Constraints

- Alle Daten bleiben lokal; einzige externen Netzwerkzugriffe sind die OSM-Kartenkacheln und die Overpass-API-Anfrage (beide ohne Account, ohne Übertragung von Gesundheitsdaten) — deckt sich mit dem Datenschutz-Grundsatz der Hauptspec.
- UI-Sprache: Deutsch, durchgehend.
- Design-Ton: ruhig/warm — ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts` für alle React-Native-UI-Elemente (die WebView-Karte selbst folgt Leaflets eigenem Rendering, nicht den App-Tokens).
- **Kein `react-native-maps`** — benötigt auf Android zwingend einen Google-Maps-API-Key (Google-Cloud-Konto), was dem Projektgrundsatz "kein Account-System" widerspricht. Stattdessen: WebView + Leaflet.js, als vollständig selbstständiger HTML-String mit inline eingebettetem JS/CSS generiert (bekannte, dokumentierte Einschränkung von `react-native-webview`: separate lokale Asset-Dateien mit relativen Pfaden funktionieren plattformübergreifend nicht zuverlässig — siehe react-native-webview GitHub Issues #428/#518 — daher alles in einem einzigen HTML-String).
- Overpass-Suchradius: fest **1500 Meter** um den aktuellen Kartenmittelpunkt.
- Automatische Neusuche bei Kartenverschiebung nur, wenn sich der Mittelpunkt um mehr als **300 Meter** verändert hat (kein manueller "Suchen"-Button).
- Standort: ausschließlich Vordergrund-Berechtigung (`expo-location`, `requestForegroundPermissionsAsync`), keine Hintergrund-Standortabfrage. Wird angefragt, sobald der Toiletten-Tab geöffnet wird.
- Standort verweigert/nicht verfügbar → Karte bleibt nutzbar (neutraler Standardausschnitt, Mitte Deutschlands: 51.1657, 10.4515), deutscher Hinweisbanner, keine Toiletten-Suche ohne bekannten Mittelpunkt.
- Overpass-Anfrage fehlgeschlagen → deutsche Fehlermeldung statt leerer/stiller Zustand, Karte bleibt bedienbar.
- Marker-Tap → Infokarte mit Name/Distanz/Öffnungszeiten (falls in OSM vorhanden) + Button "Route dorthin", öffnet die auf dem Gerät bereits installierte Karten-App über einen plattformübergreifenden Navigations-Link (kein eigenes Navigationssystem).
- React Native lässt sich unter Vitest nicht parsen/rendern (bestätigte Einschränkung aus allen bisherigen Schritten) — WebView-Komponente, Screens und die generierte HTML-Datei bekommen keine automatisierten Tests; alle reine Logik (Overpass-Query-Bau, Antwort-Parsing, Distanzberechnung, Schwellwert-Logik, Navigations-Link-Bau) wird vollständig automatisiert getestet.
- **Explizit nicht Teil dieses Plans** (Teil B, separater späterer Plan): eigene gespeicherte "sichere Orte", Schnellzugriff-Button vom App-Start, Offline-Fallback/Caching zuletzt geladener Toiletten bei fehlendem Netz.

---

### Task 1: Domain-Typen, Konstanten + reine Overpass-/Geo-Logik

**Files:**
- Create: `colitis-app/src/features/toilets/types.ts`
- Create: `colitis-app/src/features/toilets/constants.ts`
- Create: `colitis-app/src/features/toilets/buildOverpassToiletsQuery.ts`
- Test: `colitis-app/src/features/toilets/buildOverpassToiletsQuery.test.ts`
- Create: `colitis-app/src/features/toilets/parseOverpassResponse.ts`
- Test: `colitis-app/src/features/toilets/parseOverpassResponse.test.ts`
- Create: `colitis-app/src/features/toilets/distance.ts`
- Test: `colitis-app/src/features/toilets/distance.test.ts`
- Create: `colitis-app/src/features/toilets/regionChange.ts`
- Test: `colitis-app/src/features/toilets/regionChange.test.ts`

**Interfaces:**
- Consumes: nichts (reine Domain-Typen und framework-freie Logik).
- Produces: `Coordinates` `{latitude: number, longitude: number}`, `Toilet` `{id: string, latitude: number, longitude: number, name: string | null, openingHours: string | null}`, `WebViewToNativeMessage` (discriminated union `{type:'ready'} | {type:'regionChange', latitude: number, longitude: number} | {type:'markerTap', id: string}`) in `types.ts`; `SEARCH_RADIUS_METERS = 1500`, `REGION_CHANGE_THRESHOLD_METERS = 300` in `constants.ts`; `buildOverpassToiletsQuery(center: Coordinates, radiusMeters: number): string`; `parseOverpassResponse(data: unknown): Toilet[]`; `haversineDistanceMeters(a: Coordinates, b: Coordinates): number`; `hasMovedSignificantly(previous: Coordinates, next: Coordinates, thresholdMeters: number): boolean`. Werden von Task 2 (Overpass-Client), Task 3 (Karten-Komponente), Task 4 (Infokarte/Navigations-Link) und Task 5 (Screen) verwendet.

- [ ] **Step 1: `types.ts` und `constants.ts` anlegen (keine Tests nötig — reine Deklarationen)**

Create `colitis-app/src/features/toilets/types.ts`:

```typescript
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
```

Create `colitis-app/src/features/toilets/constants.ts`:

```typescript
export const SEARCH_RADIUS_METERS = 1500;
export const REGION_CHANGE_THRESHOLD_METERS = 300;
```

- [ ] **Step 2: Write the failing test for `buildOverpassToiletsQuery.ts`**

Create `colitis-app/src/features/toilets/buildOverpassToiletsQuery.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/toilets/buildOverpassToiletsQuery.test.ts`
Expected: FAIL with "Cannot find module './buildOverpassToiletsQuery'" (module does not exist yet)

- [ ] **Step 4: Write the implementation**

Create `colitis-app/src/features/toilets/buildOverpassToiletsQuery.ts`:

```typescript
import type { Coordinates } from './types';

export function buildOverpassToiletsQuery(center: Coordinates, radiusMeters: number): string {
  return `[out:json][timeout:25];node["amenity"="toilets"](around:${radiusMeters},${center.latitude},${center.longitude});out body;`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/toilets/buildOverpassToiletsQuery.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing tests for `parseOverpassResponse.ts`**

Create `colitis-app/src/features/toilets/parseOverpassResponse.test.ts`:

```typescript
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
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx vitest run src/features/toilets/parseOverpassResponse.test.ts`
Expected: FAIL with "Cannot find module './parseOverpassResponse'" (module does not exist yet)

- [ ] **Step 8: Write the implementation**

Create `colitis-app/src/features/toilets/parseOverpassResponse.ts`:

```typescript
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
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/features/toilets/parseOverpassResponse.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 10: Write the failing tests for `distance.ts`**

Create `colitis-app/src/features/toilets/distance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters } from './distance';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMeters({ latitude: 52.52, longitude: 13.405 }, { latitude: 52.52, longitude: 13.405 })).toBe(0);
  });

  it('returns approximately 111km for one degree of longitude at the equator', () => {
    const distance = haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    expect(distance).toBeGreaterThan(110000);
    expect(distance).toBeLessThan(112000);
  });

  it('returns approximately 500-510km between Berlin and Munich', () => {
    const berlin = { latitude: 52.52, longitude: 13.405 };
    const munich = { latitude: 48.1351, longitude: 11.582 };
    const distance = haversineDistanceMeters(berlin, munich);
    expect(distance).toBeGreaterThan(500000);
    expect(distance).toBeLessThan(510000);
  });
});
```

- [ ] **Step 11: Run tests to verify they fail**

Run: `npx vitest run src/features/toilets/distance.test.ts`
Expected: FAIL with "Cannot find module './distance'" (module does not exist yet)

- [ ] **Step 12: Write the implementation**

Create `colitis-app/src/features/toilets/distance.ts`:

```typescript
import type { Coordinates } from './types';

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 13: Run tests to verify they pass**

Run: `npx vitest run src/features/toilets/distance.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 14: Write the failing tests for `regionChange.ts`**

Create `colitis-app/src/features/toilets/regionChange.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hasMovedSignificantly } from './regionChange';

describe('hasMovedSignificantly', () => {
  it('returns false when the movement is below the threshold', () => {
    const previous = { latitude: 52.52, longitude: 13.405 };
    const next = { latitude: 52.5201, longitude: 13.405 };
    expect(hasMovedSignificantly(previous, next, 300)).toBe(false);
  });

  it('returns true when the movement exceeds the threshold', () => {
    const previous = { latitude: 52.52, longitude: 13.405 };
    const next = { latitude: 52.53, longitude: 13.405 };
    expect(hasMovedSignificantly(previous, next, 300)).toBe(true);
  });

  it('returns false for identical points', () => {
    const point = { latitude: 52.52, longitude: 13.405 };
    expect(hasMovedSignificantly(point, point, 300)).toBe(false);
  });
});
```

- [ ] **Step 15: Run tests to verify they fail**

Run: `npx vitest run src/features/toilets/regionChange.test.ts`
Expected: FAIL with "Cannot find module './regionChange'" (module does not exist yet)

- [ ] **Step 16: Write the implementation**

Create `colitis-app/src/features/toilets/regionChange.ts`:

```typescript
import type { Coordinates } from './types';
import { haversineDistanceMeters } from './distance';

export function hasMovedSignificantly(previous: Coordinates, next: Coordinates, thresholdMeters: number): boolean {
  return haversineDistanceMeters(previous, next) > thresholdMeters;
}
```

- [ ] **Step 17: Run tests to verify they pass**

Run: `npx vitest run src/features/toilets/regionChange.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 18: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler

- [ ] **Step 19: Commit**

```bash
git add src/features/toilets/types.ts src/features/toilets/constants.ts src/features/toilets/buildOverpassToiletsQuery.ts src/features/toilets/buildOverpassToiletsQuery.test.ts src/features/toilets/parseOverpassResponse.ts src/features/toilets/parseOverpassResponse.test.ts src/features/toilets/distance.ts src/features/toilets/distance.test.ts src/features/toilets/regionChange.ts src/features/toilets/regionChange.test.ts
git commit -m "feat: Domain-Typen und reine Overpass-/Geo-Logik fuer Toiletten-Finder"
```

---

### Task 2: Overpass-Client

**Files:**
- Create: `colitis-app/src/features/toilets/overpassClient.ts`
- Test: `colitis-app/src/features/toilets/overpassClient.test.ts`

**Interfaces:**
- Consumes: `buildOverpassToiletsQuery`, `parseOverpassResponse` aus Task 1 (`./buildOverpassToiletsQuery`, `./parseOverpassResponse`); `Coordinates`, `Toilet` aus Task 1 (`./types`).
- Produces: `fetchNearbyToilets(center: Coordinates, radiusMeters: number): Promise<Toilet[]>`. Wirft einen `Error` mit deutscher Meldung bei einer nicht-erfolgreichen HTTP-Antwort. Wird von Task 5 (Screen) verwendet.

- [ ] **Step 1: Write the failing tests**

Create `colitis-app/src/features/toilets/overpassClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNearbyToilets } from './overpassClient';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchNearbyToilets', () => {
  it('POSTs the Overpass query and parses the response into toilets', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          elements: [{ type: 'node', id: 1, lat: 52.52, lon: 13.405, tags: { name: 'Test-Toilette' } }],
        }),
    });

    const toilets = await fetchNearbyToilets({ latitude: 52.52, longitude: 13.405 }, 1500);

    expect(toilets).toEqual([
      { id: '1', latitude: 52.52, longitude: 13.405, name: 'Test-Toilette', openingHours: null },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://overpass-api.de/api/interpreter',
      expect.objectContaining({
        method: 'POST',
        body: '[out:json][timeout:25];node["amenity"="toilets"](around:1500,52.52,13.405);out body;',
      })
    );
  });

  it('throws a German error when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 504, json: () => Promise.resolve({}) });

    await expect(fetchNearbyToilets({ latitude: 0, longitude: 0 }, 1500)).rejects.toThrow(
      'Overpass-Anfrage fehlgeschlagen (Status 504)'
    );
  });

  it('propagates a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    await expect(fetchNearbyToilets({ latitude: 0, longitude: 0 }, 1500)).rejects.toThrow('network unreachable');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/toilets/overpassClient.test.ts`
Expected: FAIL with "Cannot find module './overpassClient'" (module does not exist yet)

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/toilets/overpassClient.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/toilets/overpassClient.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler

- [ ] **Step 6: Commit**

```bash
git add src/features/toilets/overpassClient.ts src/features/toilets/overpassClient.test.ts
git commit -m "feat: Overpass-Client fuer Toiletten-Suche"
```

---

### Task 3: Leaflet-Karten-HTML (generiert) + ToiletMapView-Komponente

**Files:**
- Create: `colitis-app/scripts/generate-map-html.js`
- Create (generiert, per Skript): `colitis-app/src/features/toilets/mapHtml.generated.ts`
- Create: `colitis-app/src/features/toilets/components/ToiletMapView.tsx`

**Interfaces:**
- Consumes: `Coordinates`, `Toilet`, `WebViewToNativeMessage` aus Task 1 (`../types`); `MAP_HTML` aus dem generierten `../mapHtml.generated`.
- Produces: React-Komponente `ToiletMapView` mit Props `{center: Coordinates, toilets: Toilet[], onRegionChange: (center: Coordinates) => void, onMarkerTap: (toiletId: string) => void}`. Wird von Task 5 (Screen) verwendet.
- Kein automatisierter Test für `ToiletMapView.tsx` und die generierte HTML-Datei (React Native/WebView-Rendering — bestätigte Einschränkung).

**Hintergrund:** `react-native-webview` kann keine lokalen HTML-Dateien mit separaten, relativ referenzierten CSS-/JS-Assets zuverlässig plattformübergreifend laden (bekannte, offene Einschränkung der Bibliothek). Die Lösung: die komplette Leaflet-Bibliothek (JS + CSS) wird als **ein einziger, in sich geschlossener HTML-String** generiert und über `source={{ html: ... }}` geladen — keine externen Dateireferenzen außer den eigentlichen Kartenkachel-Bildern zur Laufzeit (normale `https://`-Bildanfragen, funktionieren unabhängig von der WebView-Ladeart).

- [ ] **Step 1: `leaflet` als DevDependency installieren**

Run: `cd colitis-app && npm install --save-dev leaflet`
Expected: `package.json` bekommt einen neuen `devDependencies`-Eintrag `"leaflet": "^<aktuelle Version>"`, `node_modules/leaflet/dist/leaflet.js` und `node_modules/leaflet/dist/leaflet.css` existieren.

- [ ] **Step 2: Generator-Skript schreiben**

Create `colitis-app/scripts/generate-map-html.js`:

```javascript
const fs = require('fs');
const path = require('path');

const leafletJs = fs.readFileSync(
  path.join(__dirname, '../node_modules/leaflet/dist/leaflet.js'),
  'utf-8'
);
const leafletCss = fs.readFileSync(
  path.join(__dirname, '../node_modules/leaflet/dist/leaflet.css'),
  'utf-8'
);

const bridgeScript = `
  var map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap-Mitwirkende'
  }).addTo(map);

  var markers = {};

  window.setCenter = function(lat, lon) {
    map.setView([lat, lon], 15);
  };

  window.setToilets = function(toiletsJson) {
    var toilets = JSON.parse(toiletsJson);
    Object.keys(markers).forEach(function(id) {
      map.removeLayer(markers[id]);
      delete markers[id];
    });
    toilets.forEach(function(toilet) {
      var marker = L.marker([toilet.latitude, toilet.longitude]).addTo(map);
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerTap', id: toilet.id }));
      });
      markers[toilet.id] = marker;
    });
  };

  map.on('moveend', function() {
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'regionChange', latitude: center.lat, longitude: center.lng }));
  });

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
`;

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    ${leafletCss}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    ${leafletJs}
  </script>
  <script>
    ${bridgeScript}
  </script>
</body>
</html>`;

const output = `// GENERATED FILE - do not edit by hand.
// Regenerate with: node scripts/generate-map-html.js
// (requires the "leaflet" devDependency to be installed)
export const MAP_HTML: string = ${JSON.stringify(html)};
`;

fs.writeFileSync(path.join(__dirname, '../src/features/toilets/mapHtml.generated.ts'), output);
console.log('Wrote src/features/toilets/mapHtml.generated.ts');
```

- [ ] **Step 3: Skript ausführen**

Run: `node scripts/generate-map-html.js`
Expected: Ausgabe `Wrote src/features/toilets/mapHtml.generated.ts`, die Datei `colitis-app/src/features/toilets/mapHtml.generated.ts` existiert und exportiert eine nicht-leere String-Konstante `MAP_HTML`.

- [ ] **Step 4: Typprüfung der generierten Datei**

Run: `npx tsc --noEmit`
Expected: keine TypeScript-Fehler (bestätigt, dass die generierte Datei syntaktisch gültiges TypeScript ist)

- [ ] **Step 5: `react-native-webview` installieren**

Run: `npx expo install react-native-webview`
Expected: `package.json` bekommt einen neuen Eintrag `"react-native-webview": "~<von Expo für SDK 57 aufgelöste Version>"`.

- [ ] **Step 6: `ToiletMapView`-Komponente erstellen**

Create `colitis-app/src/features/toilets/components/ToiletMapView.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from '../mapHtml.generated';
import type { Coordinates, Toilet, WebViewToNativeMessage } from '../types';

interface ToiletMapViewProps {
  center: Coordinates;
  toilets: Toilet[];
  onRegionChange: (center: Coordinates) => void;
  onMarkerTap: (toiletId: string) => void;
}

export function ToiletMapView({ center, toilets, onRegionChange, onMarkerTap }: ToiletMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setCenter(${center.latitude}, ${center.longitude}); true;`);
  }, [isReady, center]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setToilets(${JSON.stringify(JSON.stringify(toilets))}); true;`);
  }, [isReady, toilets]);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    let message: WebViewToNativeMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WebViewToNativeMessage;
    } catch {
      return;
    }

    if (message.type === 'ready') {
      setIsReady(true);
    } else if (message.type === 'regionChange') {
      onRegionChange({ latitude: message.latitude, longitude: message.longitude });
    } else if (message.type === 'markerTap') {
      onMarkerTap(message.id);
    }
  }

  return (
    <WebView
      ref={webViewRef}
      style={styles.webview}
      source={{ html: MAP_HTML }}
      onMessage={handleMessage}
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});
```

- [ ] **Step 7: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine TypeScript-Fehler

- [ ] **Step 8: Commit**

```bash
git add scripts/generate-map-html.js src/features/toilets/mapHtml.generated.ts src/features/toilets/components/ToiletMapView.tsx package.json package-lock.json
git commit -m "feat: Leaflet-Karten-HTML generieren und ToiletMapView-Komponente erstellen"
```

---

### Task 4: Infokarte, Standort-Hinweisbanner + Navigations-Link

**Files:**
- Create: `colitis-app/src/features/toilets/navigationLink.ts`
- Test: `colitis-app/src/features/toilets/navigationLink.test.ts`
- Create: `colitis-app/src/features/toilets/components/ToiletInfoCard.tsx`
- Create: `colitis-app/src/features/toilets/components/LocationPermissionBanner.tsx`

**Interfaces:**
- Consumes: `Coordinates`, `Toilet` aus Task 1 (`../types`); `tokens` aus `src/styles/tokens.ts`.
- Produces: `buildNavigationUrl(destination: Coordinates): string`; React-Komponenten `ToiletInfoCard` (Props `{toilet: Toilet, distanceMeters: number, onNavigate: () => void, onClose: () => void}`) und `LocationPermissionBanner` (keine Props). Werden von Task 5 (Screen) verwendet.
- Kein automatisierter Test für die beiden `.tsx`-Komponenten (React Native — bestätigte Einschränkung). `navigationLink.ts` ist reine Logik und wird vollständig getestet.

- [ ] **Step 1: Write the failing test for `navigationLink.ts`**

Create `colitis-app/src/features/toilets/navigationLink.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildNavigationUrl } from './navigationLink';

describe('buildNavigationUrl', () => {
  it('builds a cross-platform maps navigation URL for the given coordinates', () => {
    const url = buildNavigationUrl({ latitude: 52.52, longitude: 13.405 });
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=52.52,13.405');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/toilets/navigationLink.test.ts`
Expected: FAIL with "Cannot find module './navigationLink'" (module does not exist yet)

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/toilets/navigationLink.ts`:

```typescript
import type { Coordinates } from './types';

export function buildNavigationUrl(destination: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/toilets/navigationLink.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: `ToiletInfoCard`-Komponente erstellen**

Create `colitis-app/src/features/toilets/components/ToiletInfoCard.tsx`:

```typescript
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { Toilet } from '../types';

interface ToiletInfoCardProps {
  toilet: Toilet;
  distanceMeters: number;
  onNavigate: () => void;
  onClose: () => void;
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m entfernt`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km entfernt`;
}

export function ToiletInfoCard({ toilet, distanceMeters, onNavigate, onClose }: ToiletInfoCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Infokarte schließen"
        style={styles.closeButton}
        onPress={onClose}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
      <Text style={styles.name}>{toilet.name ?? 'Öffentliche Toilette'}</Text>
      <Text style={styles.detail}>{formatDistance(distanceMeters)}</Text>
      {toilet.openingHours && <Text style={styles.detail}>Öffnungszeiten: {toilet.openingHours}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Route dorthin"
        style={styles.navigateButton}
        onPress={onNavigate}
      >
        <Text style={styles.navigateButtonText}>Route dorthin</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    bottom: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  closeButton: {
    position: 'absolute',
    right: tokens.spacing.sm,
    top: tokens.spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.textSecondary,
  },
  name: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
    paddingRight: tokens.spacing.lg,
  },
  detail: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.xs,
  },
  navigateButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  navigateButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 6: `LocationPermissionBanner`-Komponente erstellen**

Create `colitis-app/src/features/toilets/components/LocationPermissionBanner.tsx`:

```typescript
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';

export function LocationPermissionBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Standortberechtigung erforderlich, um Toiletten in deiner Nähe zu finden.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Geräteeinstellungen öffnen"
        style={styles.settingsButton}
        onPress={() => Linking.openSettings()}
      >
        <Text style={styles.settingsButtonText}>Einstellungen öffnen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.sm,
    alignItems: 'center',
  },
  text: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  settingsButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 8,
    backgroundColor: tokens.colors.primary,
  },
  settingsButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.sm,
  },
});
```

- [ ] **Step 7: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler

- [ ] **Step 8: Commit**

```bash
git add src/features/toilets/navigationLink.ts src/features/toilets/navigationLink.test.ts src/features/toilets/components/ToiletInfoCard.tsx src/features/toilets/components/LocationPermissionBanner.tsx
git commit -m "feat: Infokarte, Standort-Hinweisbanner und Navigations-Link fuer Toiletten-Finder"
```

---

### Task 5: Screen-Wiring (Standort, Overpass-Orchestrierung, Karte)

**Files:**
- Modify: `colitis-app/app/(tabs)/toiletten/index.tsx`

**Interfaces:**
- Consumes: `ToiletMapView` (Task 3), `ToiletInfoCard`, `LocationPermissionBanner`, `buildNavigationUrl` (Task 4), `fetchNearbyToilets` (Task 2), `haversineDistanceMeters`, `hasMovedSignificantly`, `SEARCH_RADIUS_METERS`, `REGION_CHANGE_THRESHOLD_METERS`, `Coordinates`, `Toilet` (Task 1).
- Produces: nichts weiter (Endpunkt der Feature-Kette). Keine automatisierten Tests (React Native/Expo-Router-Screen — bestätigte Einschränkung); Verifikation über `tsc --noEmit` und den späteren manuellen Alltagstest.
- `app/(tabs)/_layout.tsx` und `app/(tabs)/toiletten/_layout.tsx` (falls vorhanden) bleiben unverändert — der "Toiletten"-Tab ist bereits aus Schritt 1 registriert, nur der Platzhalter-Inhalt von `index.tsx` wird ersetzt.

- [ ] **Step 1: `expo-location` installieren**

Run: `cd colitis-app && npx expo install expo-location`
Expected: `package.json` bekommt einen neuen Eintrag `"expo-location": "~<von Expo für SDK 57 aufgelöste Version>"`. Kein `app.json`-Plugin-Eintrag nötig (laut Expo-SDK-57-Doku nur für optionale iOS-Text-Anpassung erforderlich, hier nicht benötigt, App zielt zuerst auf Android).

- [ ] **Step 2: Platzhalter-Screen durch echten Toiletten-Screen ersetzen**

Modify `colitis-app/app/(tabs)/toiletten/index.tsx` (kompletter Dateiinhalt, ersetzt den bisherigen Platzhalter):

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { ToiletMapView } from '../../../src/features/toilets/components/ToiletMapView';
import { ToiletInfoCard } from '../../../src/features/toilets/components/ToiletInfoCard';
import { LocationPermissionBanner } from '../../../src/features/toilets/components/LocationPermissionBanner';
import { fetchNearbyToilets } from '../../../src/features/toilets/overpassClient';
import { haversineDistanceMeters } from '../../../src/features/toilets/distance';
import { hasMovedSignificantly } from '../../../src/features/toilets/regionChange';
import { buildNavigationUrl } from '../../../src/features/toilets/navigationLink';
import { SEARCH_RADIUS_METERS, REGION_CHANGE_THRESHOLD_METERS } from '../../../src/features/toilets/constants';
import { tokens } from '../../../src/styles/tokens';
import type { Coordinates, Toilet } from '../../../src/features/toilets/types';

const DEFAULT_CENTER: Coordinates = { latitude: 51.1657, longitude: 10.4515 };

export default function ToilettenScreen() {
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [lastSearchedCenter, setLastSearchedCenter] = useState<Coordinates | null>(null);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [selectedToiletId, setSelectedToiletId] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      Location.requestForegroundPermissionsAsync()
        .then(async (permission) => {
          if (!isActive) {
            return;
          }
          if (permission.status !== 'granted') {
            setLocationDenied(true);
            return;
          }
          setLocationDenied(false);
          const position = await Location.getCurrentPositionAsync({});
          if (!isActive) {
            return;
          }
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(coords);
          setMapCenter(coords);
          await searchAround(coords);
        })
        .catch((error: unknown) => {
          console.error('[Toiletten] Standort konnte nicht ermittelt werden:', error);
          if (isActive) {
            setLocationDenied(true);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function searchAround(center: Coordinates) {
    try {
      const results = await fetchNearbyToilets(center, SEARCH_RADIUS_METERS);
      setToilets(results);
      setLastSearchedCenter(center);
      setLoadError(null);
    } catch (error: unknown) {
      console.error('[Toiletten] Toiletten konnten nicht geladen werden:', error);
      setLoadError('Toiletten konnten nicht geladen werden.');
    }
  }

  function handleRegionChange(center: Coordinates) {
    setMapCenter(center);
    if (!lastSearchedCenter || hasMovedSignificantly(lastSearchedCenter, center, REGION_CHANGE_THRESHOLD_METERS)) {
      searchAround(center);
    }
  }

  function handleMarkerTap(toiletId: string) {
    setSelectedToiletId(toiletId);
  }

  function handleNavigate(toilet: Toilet) {
    Linking.openURL(buildNavigationUrl({ latitude: toilet.latitude, longitude: toilet.longitude }));
  }

  const selectedToilet = toilets.find((toilet) => toilet.id === selectedToiletId) ?? null;

  return (
    <View style={styles.container}>
      {locationDenied && <LocationPermissionBanner />}
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}
      <ToiletMapView
        center={mapCenter}
        toilets={toilets}
        onRegionChange={handleRegionChange}
        onMarkerTap={handleMarkerTap}
      />
      {selectedToilet && (
        <ToiletInfoCard
          toilet={selectedToilet}
          distanceMeters={haversineDistanceMeters(userLocation ?? mapCenter, selectedToilet)}
          onNavigate={() => handleNavigate(selectedToilet)}
          onClose={() => setSelectedToiletId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
});
```

- [ ] **Step 3: Volle Test-Suite + Typprüfung laufen lassen**

Run: `npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün (108 Tests insgesamt, siehe Hinweis unten), keine TypeScript-Fehler

Hinweis zur erwarteten Testanzahl: Vor diesem Plan lag der Stand bei 91 Tests. Task 1 fügt 13 hinzu (2 buildOverpassToiletsQuery + 5 parseOverpassResponse + 3 distance + 3 regionChange), Task 2 fügt 3 hinzu (overpassClient), Task 4 fügt 1 hinzu (navigationLink) — macht insgesamt 91 + 17 = 108 Tests nach Abschluss von Task 4. Task 3 und Task 5 fügen keine neuen Tests hinzu.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/toiletten/index.tsx" package.json package-lock.json
git commit -m "feat: Toiletten-Screen mit Karte, Standort und Overpass-Suche verdrahten"
```

---

## Nach Abschluss aller Tasks

Nach Task 5 folgt die plan-übergreifende Abschluss-Review (whole-branch review) über alle 5 Tasks hinweg, danach `superpowers:finishing-a-development-branch`. Manuelle Prüfpunkte für den späteren Alltagstest (nicht Teil dieser Umsetzung, siehe Global Constraints): tatsächliches Kartenrendering und Kachel-Laden auf einem echten Android-Gerät, Standort-Berechtigungsdialog, Marker-Tap-Verhalten, externe Navigations-App-Weiterleitung, Verhalten bei fehlendem Netz während des Kachel-Ladens.
