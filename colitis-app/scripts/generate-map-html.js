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
  var placeMarkers = {};

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
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerTap', id: toilet.id, kind: 'toilet' }));
      });
      markers[toilet.id] = marker;
    });
  };

  window.setSavedPlaces = function(placesJson) {
    var places = JSON.parse(placesJson);
    Object.keys(placeMarkers).forEach(function(id) {
      map.removeLayer(placeMarkers[id]);
      delete placeMarkers[id];
    });
    places.forEach(function(place) {
      var marker = L.circleMarker([place.latitude, place.longitude], {
        radius: 10,
        color: '#5B8C7B',
        fillColor: '#5B8C7B',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map);
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerTap', id: String(place.id), kind: 'place' }));
      });
      placeMarkers[place.id] = marker;
    });
  };

  map.on('moveend', function() {
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'regionChange', latitude: center.lat, longitude: center.lng }));
  });

  map.on('contextmenu', function(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'longPress', latitude: e.latlng.lat, longitude: e.latlng.lng }));
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
